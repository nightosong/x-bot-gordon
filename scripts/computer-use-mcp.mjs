import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

const PERMISSION_REQUIRED_PREFIX = "GORDON_COMPUTER_USE_PERMISSION_REQUIRED";
const COMPUTER_USE_TIMEOUT_MS = 8_000;
const COMPUTER_USE_OUTPUT_MAX_BYTES = 256 * 1024;
const MAX_ACCESSIBILITY_ELEMENTS = 100;
const SCREENSHOT_DIR = path.join(os.tmpdir(), "gordon-computer-use");

const KEY_CODE_MAP = new Map([
  ["return", 36],
  ["enter", 36],
  ["tab", 48],
  ["space", 49],
  ["escape", 53],
  ["esc", 53],
  ["delete", 51],
  ["backspace", 51],
  ["forward_delete", 117],
  ["home", 115],
  ["end", 119],
  ["page_up", 116],
  ["page_down", 121],
  ["up", 126],
  ["down", 125],
  ["left", 123],
  ["right", 124]
]);

const MODIFIER_MAP = new Map([
  ["command", "command down"],
  ["cmd", "command down"],
  ["meta", "command down"],
  ["control", "control down"],
  ["ctrl", "control down"],
  ["option", "option down"],
  ["alt", "option down"],
  ["shift", "shift down"]
]);

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function ok(id, result) {
  send({
    jsonrpc: "2.0",
    id,
    result
  });
}

function fail(id, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message
    }
  });
}

function buildTextResult(text, structuredContent = undefined) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    ...(structuredContent ? { structuredContent } : {})
  };
}

function assertDarwin() {
  if (process.platform !== "darwin") {
    throw new Error("computer_use 当前仅支持 macOS 桌面端");
  }
}

function assertComputerUseAllowed(toolName, action) {
  assertDarwin();

  if (process.env.GORDON_COMPUTER_USE_ALLOWED === "1") {
    return;
  }

  throw new Error(
    `${PERMISSION_REQUIRED_PREFIX} ${JSON.stringify({
      toolName,
      action,
      reason: "需要读取或控制本机桌面，本次授权只对当前 Agent 运行生效。"
    })}`
  );
}

function assertSafeText(value, label) {
  const text = String(value ?? "");

  if (text.includes("\u0000") || /[\r\n]/.test(text)) {
    throw new Error(`${label} 不允许包含空字节或换行`);
  }

  return text;
}

function quoteAppleScriptString(value) {
  return `"${String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")}"`;
}

function normalizeAppName(value) {
  const appName = assertSafeText(value, "app").trim();

  if (!appName || appName.length > 120) {
    throw new Error("app 不能为空且不能超过 120 个字符");
  }

  return appName;
}

function normalizeUrl(value) {
  const rawUrl = assertSafeText(value, "url").trim();

  if (!rawUrl) {
    throw new Error("url 不能为空");
  }

  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("url 必须是有效 URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("open_url 仅支持 http 或 https URL");
  }

  return parsed.toString();
}

function clampInteger(value, defaultValue, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

async function runProcess(command, args, options = {}) {
  const timeoutMs = clampInteger(options.timeoutMs, COMPUTER_USE_TIMEOUT_MS, 1_000, 20_000);
  const maxOutputBytes = clampInteger(options.maxOutputBytes, COMPUTER_USE_OUTPUT_MAX_BYTES, 4 * 1024, COMPUTER_USE_OUTPUT_MAX_BYTES);

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        ...(options.env || {})
      }
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let settled = false;
    let forceKillTimer;

    const appendChunk = (streamName, chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
      const currentBytes = streamName === "stdout" ? stdoutBytes : stderrBytes;
      const remainingBytes = maxOutputBytes - currentBytes;

      if (remainingBytes <= 0) {
        if (streamName === "stdout") {
          stdoutTruncated = true;
        } else {
          stderrTruncated = true;
        }
        return;
      }

      const selected = buffer.byteLength > remainingBytes ? buffer.subarray(0, remainingBytes) : buffer;

      if (streamName === "stdout") {
        stdout += selected.toString("utf8");
        stdoutBytes += selected.byteLength;
        stdoutTruncated = stdoutTruncated || buffer.byteLength > remainingBytes;
      } else {
        stderr += selected.toString("utf8");
        stderrBytes += selected.byteLength;
        stderrTruncated = stderrTruncated || buffer.byteLength > remainingBytes;
      }
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1_000);
    }, timeoutMs);

    const finish = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }

      callback();
    };

    child.stdout.on("data", (chunk) => appendChunk("stdout", chunk));
    child.stderr.on("data", (chunk) => appendChunk("stderr", chunk));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (exitCode, signal) =>
      finish(() =>
        resolve({
          command,
          args,
          exitCode,
          signal,
          stdout,
          stderr,
          stdoutTruncated,
          stderrTruncated,
          timedOut
        })
      )
    );
  });
}

async function runAppleScript(lines, options = {}) {
  const args = lines.flatMap((line) => ["-e", line]);
  const result = await runProcess("osascript", args, options);

  if (result.exitCode !== 0) {
    const errorText = result.stderr.trim() || `osascript exit ${result.exitCode ?? "unknown"}`;

    if (/(-10827|-1743|assistive|accessibility|not authorized|not allowed|未获授权|不允许)/i.test(errorText)) {
      throw new Error(
        `Computer Use 无法访问 macOS 辅助功能或自动化权限。请在系统设置 -> 隐私与安全性中为 Gordon/终端授予“辅助功能”和必要的“自动化”权限。原始错误：${errorText}`
      );
    }

    throw new Error(errorText);
  }

  return result.stdout.trim();
}

function parseTabLines(text, columns) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const values = line.split("\t");
      const entry = {};

      for (let index = 0; index < columns.length; index += 1) {
        entry[columns[index]] = values[index] ?? "";
      }

      return entry;
    });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function clampRatio(value, defaultValue) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.max(0.05, Math.min(0.95, parsed));
}

async function listApps(argumentsObject) {
  assertComputerUseAllowed("list_apps", "读取当前运行中的可见应用");
  const output = await runAppleScript([
    'set outputLines to {}',
    'tell application "System Events"',
    '  set visibleProcesses to every application process whose background only is false',
    '  repeat with currentProcess in visibleProcesses',
    '    set processName to ""',
    '    set isFrontmost to "false"',
    '    set windowCount to "0"',
    '    try',
    '      set processName to name of currentProcess as text',
    '      set isFrontmost to frontmost of currentProcess as text',
    '      set windowCount to (count of windows of currentProcess) as text',
    '      set end of outputLines to processName & tab & isFrontmost & tab & windowCount',
    '    end try',
    '  end repeat',
    'end tell',
    "set AppleScript's text item delimiters to linefeed",
    "return outputLines as text"
  ]);
  const apps = parseTabLines(output, ["name", "frontmost", "windowCount"]).map((entry) => ({
    name: entry.name,
    frontmost: entry.frontmost === "true",
    windowCount: Number(entry.windowCount) || 0
  }));

  return buildTextResult(
    apps.length
      ? apps.map((app) => `${app.frontmost ? "*" : "-"} ${app.name} (${app.windowCount} window${app.windowCount === 1 ? "" : "s"})`).join("\n")
      : "未发现可见应用",
    {
      apps
    }
  );
}

async function getAppState(argumentsObject) {
  assertComputerUseAllowed("get_app_state", "读取应用窗口与辅助功能树");
  const requestedApp = String(argumentsObject?.app || "").trim();
  const maxElements = clampInteger(argumentsObject?.maxElements, MAX_ACCESSIBILITY_ELEMENTS, 1, 200);
  const appSelector =
    requestedApp.length > 0
      ? `set targetProcess to first application process whose name is ${quoteAppleScriptString(normalizeAppName(requestedApp))}`
      : "set targetProcess to first application process whose frontmost is true";
  const output = await runAppleScript(
    [
      "on safeText(theValue)",
      "  try",
      "    return theValue as text",
      "  on error",
      "    return \"\"",
      "  end try",
      "end safeText",
      "set outputLines to {}",
      "tell application \"System Events\"",
      `  ${appSelector}`,
      "  set processName to name of targetProcess as text",
      "  set isFrontmost to frontmost of targetProcess as text",
      "  set end of outputLines to \"APP\" & tab & processName & tab & isFrontmost",
      "  set windowIndex to 0",
      "  repeat with currentWindow in windows of targetProcess",
      "    set windowIndex to windowIndex + 1",
      "    set windowName to my safeText(name of currentWindow)",
      "    set windowPosition to my safeText(position of currentWindow)",
      "    set windowSize to my safeText(size of currentWindow)",
      "    set end of outputLines to \"WINDOW\" & tab & (windowIndex as text) & tab & windowName & tab & windowPosition & tab & windowSize",
      "  end repeat",
      "  try",
      "    set targetWindow to window 1 of targetProcess",
      "    set allElements to entire contents of targetWindow",
      `    set elementLimit to ${maxElements}`,
      "    if (count of allElements) < elementLimit then set elementLimit to count of allElements",
      "    repeat with elementIndex from 1 to elementLimit",
      "      set currentElement to item elementIndex of allElements",
      "      set roleText to my safeText(role of currentElement)",
      "      set subroleText to my safeText(subrole of currentElement)",
      "      set nameText to my safeText(name of currentElement)",
      "      set descriptionText to my safeText(description of currentElement)",
      "      set valueText to my safeText(value of currentElement)",
      "      set enabledText to my safeText(enabled of currentElement)",
      "      set positionText to my safeText(position of currentElement)",
      "      set sizeText to my safeText(size of currentElement)",
      "      if roleText is not \"\" or nameText is not \"\" or descriptionText is not \"\" or valueText is not \"\" then",
      "        set end of outputLines to \"ELEMENT\" & tab & (elementIndex as text) & tab & roleText & tab & subroleText & tab & nameText & tab & descriptionText & tab & valueText & tab & enabledText & tab & positionText & tab & sizeText",
      "      end if",
      "    end repeat",
      "  end try",
      "end tell",
      "set AppleScript's text item delimiters to linefeed",
      "return outputLines as text"
    ],
    {
      timeoutMs: 12_000
    }
  );
  const windows = [];
  const elements = [];
  let appName = requestedApp || "";
  let frontmost = false;

  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const parts = line.split("\t");
    const recordType = parts[0];

    if (recordType === "APP") {
      appName = parts[1] || appName;
      frontmost = parts[2] === "true";
    }

    if (recordType === "WINDOW") {
      windows.push({
        index: Number(parts[1]) || windows.length + 1,
        title: parts[2] || "",
        position: parts[3] || "",
        size: parts[4] || ""
      });
    }

    if (recordType === "ELEMENT") {
      elements.push({
        index: Number(parts[1]) || elements.length + 1,
        role: parts[2] || "",
        subrole: parts[3] || "",
        name: parts[4] || "",
        description: parts[5] || "",
        value: parts[6] || "",
        enabled: parts[7] === "true",
        position: parts[8] || "",
        size: parts[9] || ""
      });
    }
  }

  return buildTextResult(
    [
      `app: ${appName || "(unknown)"}`,
      `frontmost: ${frontmost}`,
      "",
      "windows:",
      ...(windows.length
        ? windows.map((entry) => `${entry.index}. ${entry.title || "(untitled)"} pos=${entry.position || "-"} size=${entry.size || "-"}`)
        : ["(none)"]),
      "",
      "elements:",
      ...(elements.length
        ? elements.map((entry) =>
            [
              `${entry.index}. ${entry.role || "AXElement"}`,
              entry.name ? `name=${entry.name}` : "",
              entry.description ? `desc=${entry.description}` : "",
              entry.value ? `value=${entry.value}` : "",
              entry.position ? `pos=${entry.position}` : "",
              entry.size ? `size=${entry.size}` : "",
              `enabled=${entry.enabled}`
            ]
              .filter(Boolean)
              .join(" | ")
          )
        : ["(none or no accessibility permission)"])
    ].join("\n"),
    {
      app: appName,
      frontmost,
      windows,
      elements,
      maxElements
    }
  );
}

async function openApp(argumentsObject) {
  assertComputerUseAllowed("open_app", "打开本机应用");
  const appName = normalizeAppName(argumentsObject?.app);
  const result = await runProcess("open", ["-a", appName]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `open exit ${result.exitCode ?? "unknown"}`);
  }

  return buildTextResult(`opened app: ${appName}`, {
    app: appName,
    opened: true
  });
}

async function openUrl(argumentsObject) {
  assertComputerUseAllowed("open_url", "用默认浏览器打开 URL");
  const url = normalizeUrl(argumentsObject?.url);
  const result = await runProcess("open", [url]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `open exit ${result.exitCode ?? "unknown"}`);
  }

  return buildTextResult(`opened url: ${url}`, {
    url,
    opened: true
  });
}

async function wait(argumentsObject) {
  const ms = clampInteger(argumentsObject?.ms, 1_500, 250, 10_000);

  await delay(ms);

  return buildTextResult(`waited ${ms}ms`, {
    ms
  });
}

function buildModifierClause(value) {
  const modifiers = Array.isArray(value) ? value : [];
  const normalized = [];

  for (const modifier of modifiers) {
    const mapped = MODIFIER_MAP.get(String(modifier || "").trim().toLowerCase());

    if (!mapped) {
      throw new Error(`不支持的修饰键：${modifier}`);
    }

    if (!normalized.includes(mapped)) {
      normalized.push(mapped);
    }
  }

  return normalized.length ? ` using {${normalized.join(", ")}}` : "";
}

async function pressKey(argumentsObject) {
  assertComputerUseAllowed("press_key", "向前台应用发送按键");
  const key = assertSafeText(argumentsObject?.key, "key").trim().toLowerCase();
  const repeatCount = clampInteger(argumentsObject?.repeat, 1, 1, 20);
  const modifierClause = buildModifierClause(argumentsObject?.modifiers);

  if (!key) {
    throw new Error("key 不能为空");
  }

  const keyCode = KEY_CODE_MAP.get(key);
  const scriptLines = ['tell application "System Events"', `  repeat ${repeatCount} times`];

  if (keyCode !== undefined) {
    scriptLines.push(`    key code ${keyCode}${modifierClause}`);
  } else if (key.length === 1) {
    scriptLines.push(`    keystroke ${quoteAppleScriptString(key)}${modifierClause}`);
  } else {
    throw new Error(`不支持的按键：${key}`);
  }

  scriptLines.push("  end repeat", "end tell");
  await runAppleScript(scriptLines);

  return buildTextResult(`pressed key: ${key}`, {
    key,
    repeat: repeatCount,
    modifiers: Array.isArray(argumentsObject?.modifiers) ? argumentsObject.modifiers.map(String) : []
  });
}

async function typeText(argumentsObject) {
  assertComputerUseAllowed("type_text", "向前台应用输入文本");
  const text = String(argumentsObject?.text ?? "");

  if (!text) {
    throw new Error("text 不能为空");
  }

  if (text.includes("\u0000") || text.length > 5_000) {
    throw new Error("text 不允许包含空字节，且长度不能超过 5000 字符");
  }

  await runAppleScript(['tell application "System Events"', `  keystroke ${quoteAppleScriptString(text)}`, "end tell"], {
    timeoutMs: 12_000
  });

  return buildTextResult(`typed ${text.length} characters`, {
    length: text.length
  });
}

async function click(argumentsObject) {
  assertComputerUseAllowed("click", "点击屏幕坐标或辅助功能元素");
  const appName = String(argumentsObject?.app || "").trim();
  const elementIndex = Number(argumentsObject?.elementIndex);
  const clickCount = clampInteger(argumentsObject?.clickCount, 1, 1, 3);
  const x = Number(argumentsObject?.x);
  const y = Number(argumentsObject?.y);

  if (Number.isInteger(elementIndex) && elementIndex > 0) {
    const appSelector = appName
      ? `set targetProcess to first application process whose name is ${quoteAppleScriptString(normalizeAppName(appName))}`
      : "set targetProcess to first application process whose frontmost is true";
    const scriptLines = [
      'tell application "System Events"',
      `  ${appSelector}`,
      "  set frontmost of targetProcess to true",
      "  set targetWindow to window 1 of targetProcess",
      "  set allElements to entire contents of targetWindow",
      `  set targetElement to item ${elementIndex} of allElements`
    ];

    for (let index = 0; index < clickCount; index += 1) {
      scriptLines.push("  click targetElement");
    }

    scriptLines.push("end tell");
    await runAppleScript(scriptLines);

    return buildTextResult(`clicked element: ${elementIndex}`, {
      app: appName || null,
      elementIndex,
      clickCount
    });
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("click 需要提供 elementIndex，或提供 x/y 坐标");
  }

  const scriptLines = ['tell application "System Events"'];

  for (let index = 0; index < clickCount; index += 1) {
    scriptLines.push(`  click at {${Math.round(x)}, ${Math.round(y)}}`);
  }

  scriptLines.push("end tell");
  await runAppleScript(scriptLines);

  return buildTextResult(`clicked at: ${Math.round(x)}, ${Math.round(y)}`, {
    x: Math.round(x),
    y: Math.round(y),
    clickCount
  });
}

async function clickText(argumentsObject) {
  assertComputerUseAllowed("click_text", "按可见文本点击辅助功能元素");
  const query = normalizeSearchText(assertSafeText(argumentsObject?.text, "text"));
  const matchMode = String(argumentsObject?.match || "contains").trim().toLowerCase();
  const appName = String(argumentsObject?.app || "").trim();
  const maxElements = clampInteger(argumentsObject?.maxElements, 200, 1, 200);
  const clickCount = clampInteger(argumentsObject?.clickCount, 1, 1, 3);

  if (!query) {
    throw new Error("text 不能为空");
  }

  if (!["contains", "exact"].includes(matchMode)) {
    throw new Error("match 只支持 contains 或 exact");
  }

  const state = await getAppState({
    app: appName,
    maxElements
  });
  const elements = Array.isArray(state.structuredContent?.elements) ? state.structuredContent.elements : [];
  const matched = elements.find((element) => {
    const candidates = [element.name, element.description, element.value]
      .map((item) => normalizeSearchText(item))
      .filter(Boolean);

    return candidates.some((candidate) => (matchMode === "exact" ? candidate === query : candidate.includes(query)));
  });

  if (!matched?.index) {
    throw new Error(`未找到包含文本「${query}」的可点击元素`);
  }

  await click({
    app: appName || state.structuredContent?.app,
    elementIndex: matched.index,
    clickCount
  });

  return buildTextResult(
    [
      `clicked text: ${argumentsObject?.text}`,
      `elementIndex: ${matched.index}`,
      matched.name ? `name: ${matched.name}` : "",
      matched.description ? `description: ${matched.description}` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    {
      app: appName || state.structuredContent?.app || null,
      elementIndex: matched.index,
      match: {
        role: matched.role || "",
        name: matched.name || "",
        description: matched.description || "",
        value: matched.value || ""
      },
      clickCount
    }
  );
}

async function clickWindowArea(argumentsObject) {
  assertComputerUseAllowed("click_window_area", "点击前台或指定应用窗口的相对区域");
  const appName = String(argumentsObject?.app || "").trim();
  const horizontalRatio = clampRatio(argumentsObject?.horizontalRatio, 0.5);
  const verticalRatio = clampRatio(argumentsObject?.verticalRatio, 0.56);
  const clickCount = clampInteger(argumentsObject?.clickCount, 1, 1, 3);
  const appSelector = appName
    ? `set targetProcess to first application process whose name is ${quoteAppleScriptString(normalizeAppName(appName))}`
    : "set targetProcess to first application process whose frontmost is true";
  const scriptLines = [
    "on safeText(theValue)",
    "  try",
    "    return theValue as text",
    "  on error",
    "    return \"\"",
    "  end try",
    "end safeText",
    'tell application "System Events"',
    `  ${appSelector}`,
    "  set frontmost of targetProcess to true",
    "  set processName to name of targetProcess as text",
    "  set targetWindow to window 1 of targetProcess",
    "  set windowName to my safeText(name of targetWindow)",
    "  set windowPosition to position of targetWindow",
    "  set windowSize to size of targetWindow",
    "  set originX to item 1 of windowPosition",
    "  set originY to item 2 of windowPosition",
    "  set windowWidth to item 1 of windowSize",
    "  set windowHeight to item 2 of windowSize",
    `  set targetX to originX + ((windowWidth * ${horizontalRatio}) as integer)`,
    `  set targetY to originY + ((windowHeight * ${verticalRatio}) as integer)`
  ];

  for (let index = 0; index < clickCount; index += 1) {
    scriptLines.push("  click at {targetX, targetY}");
  }

  scriptLines.push('  return processName & tab & windowName & tab & (targetX as text) & tab & (targetY as text)');
  scriptLines.push("end tell");
  const output = await runAppleScript(scriptLines);
  const [processName = "", windowName = "", xText = "", yText = ""] = output.split("\t");
  const x = Number(xText);
  const y = Number(yText);

  return buildTextResult(`clicked window area: ${Math.round(x)}, ${Math.round(y)}`, {
    app: processName || appName || null,
    windowTitle: windowName,
    x: Math.round(x),
    y: Math.round(y),
    horizontalRatio,
    verticalRatio,
    clickCount
  });
}

async function playMedia(argumentsObject) {
  assertComputerUseAllowed("play_media", "尝试播放前台浏览器或应用中的媒体");
  const alsoPressSpace = Boolean(argumentsObject?.alsoPressSpace);
  const appName = String(argumentsObject?.app || "").trim();
  const areaResult = await clickWindowArea({
    app: appName,
    horizontalRatio: argumentsObject?.horizontalRatio ?? 0.5,
    verticalRatio: argumentsObject?.verticalRatio ?? 0.56,
    clickCount: 1
  });

  if (alsoPressSpace) {
    await delay(300);
    await pressKey({
      key: "space"
    });
  }

  return buildTextResult(
    [
      "media playback attempted",
      `clicked: ${areaResult.structuredContent?.x ?? "-"}, ${areaResult.structuredContent?.y ?? "-"}`,
      alsoPressSpace ? "space key also sent" : "space key not sent"
    ].join("\n"),
    {
      app: areaResult.structuredContent?.app || appName || null,
      windowTitle: areaResult.structuredContent?.windowTitle || "",
      x: areaResult.structuredContent?.x,
      y: areaResult.structuredContent?.y,
      alsoPressSpace,
      verificationHint: "调用 take_screenshot 或 get_app_state 确认页面是否进入播放状态；若未播放，可再调用 press_key space 或 click_text 查找播放按钮。"
    }
  );
}

async function takeScreenshot(argumentsObject) {
  assertComputerUseAllowed("take_screenshot", "截取当前屏幕并保存到临时文件");
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const targetPath = path.join(SCREENSHOT_DIR, `screenshot-${Date.now()}.png`);
  const result = await runProcess("screencapture", ["-x", "-t", "png", targetPath], {
    timeoutMs: 10_000,
    maxOutputBytes: 32 * 1024
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `screencapture exit ${result.exitCode ?? "unknown"}`);
  }

  const stat = await fs.stat(targetPath);

  return buildTextResult(`screenshot: ${targetPath}\nsize: ${stat.size}`, {
    path: targetPath,
    size: stat.size
  });
}

function getTools() {
  return [
    {
      name: "list_apps",
      description: "列出当前可见桌面应用、是否前台以及窗口数量。首次调用会申请本轮 Computer Use 授权。",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_app_state",
      description: "读取指定应用或前台应用的窗口信息与辅助功能元素树，返回可点击元素 index。",
      inputSchema: {
        type: "object",
        properties: {
          app: {
            type: "string",
            description: "应用进程名；不填时读取前台应用"
          },
          maxElements: {
            type: "integer",
            description: "最多返回元素数，默认 100，上限 200"
          }
        }
      }
    },
    {
      name: "open_app",
      description: "打开 macOS 应用。",
      inputSchema: {
        type: "object",
        required: ["app"],
        properties: {
          app: {
            type: "string",
            description: "应用名称，例如 Safari、Google Chrome、Finder"
          }
        }
      }
    },
    {
      name: "open_url",
      description: "使用默认浏览器打开 http(s) URL。",
      inputSchema: {
        type: "object",
        required: ["url"],
        properties: {
          url: {
            type: "string",
            description: "http 或 https URL"
          }
        }
      }
    },
    {
      name: "wait",
      description: "等待页面、应用或动画加载完成。适合 open_url、点击搜索结果、视频页面加载后的短暂停顿。",
      inputSchema: {
        type: "object",
        properties: {
          ms: {
            type: "integer",
            description: "等待毫秒数，默认 1500，上限 10000"
          }
        }
      }
    },
    {
      name: "click",
      description: "点击辅助功能元素 index，或点击屏幕坐标。优先配合 get_app_state 返回的 elementIndex 使用。",
      inputSchema: {
        type: "object",
        properties: {
          app: {
            type: "string",
            description: "应用进程名；点击 elementIndex 时可选"
          },
          elementIndex: {
            type: "integer",
            description: "get_app_state 返回的元素 index"
          },
          x: {
            type: "number",
            description: "屏幕 X 坐标"
          },
          y: {
            type: "number",
            description: "屏幕 Y 坐标"
          },
          clickCount: {
            type: "integer",
            description: "点击次数，1-3，默认 1"
          }
        }
      }
    },
    {
      name: "click_text",
      description: "按可见文本查找并点击辅助功能元素。适合点击搜索结果、站内入口、播放、全屏、确认等按钮，比手动猜 elementIndex 更稳定。",
      inputSchema: {
        type: "object",
        required: ["text"],
        properties: {
          text: {
            type: "string",
            description: "要匹配的可见文本，例如 bilibili、凡人修仙传、播放、番剧"
          },
          app: {
            type: "string",
            description: "应用进程名；不填时读取前台应用"
          },
          match: {
            type: "string",
            enum: ["contains", "exact"],
            description: "匹配方式，默认 contains"
          },
          maxElements: {
            type: "integer",
            description: "最多扫描元素数，默认 200，上限 200"
          },
          clickCount: {
            type: "integer",
            description: "点击次数，1-3，默认 1"
          }
        }
      }
    },
    {
      name: "click_window_area",
      description: "点击前台或指定应用窗口的相对区域。适合网页播放器按钮未出现在辅助功能树时，点击窗口中心或播放器区域。",
      inputSchema: {
        type: "object",
        properties: {
          app: {
            type: "string",
            description: "应用进程名；不填时点击前台应用"
          },
          horizontalRatio: {
            type: "number",
            description: "窗口横向比例，0.05-0.95，默认 0.5"
          },
          verticalRatio: {
            type: "number",
            description: "窗口纵向比例，0.05-0.95，默认 0.56"
          },
          clickCount: {
            type: "integer",
            description: "点击次数，1-3，默认 1"
          }
        }
      }
    },
    {
      name: "play_media",
      description: "尝试播放当前浏览器或应用中的视频/音频：默认点击窗口播放器区域，并返回验证建议。适合 B 站、网页视频或播放器控件不稳定的页面。",
      inputSchema: {
        type: "object",
        properties: {
          app: {
            type: "string",
            description: "应用进程名；不填时操作前台应用"
          },
          horizontalRatio: {
            type: "number",
            description: "播放器点击横向比例，默认 0.5"
          },
          verticalRatio: {
            type: "number",
            description: "播放器点击纵向比例，默认 0.56"
          },
          alsoPressSpace: {
            type: "boolean",
            description: "点击后是否额外发送空格键，默认 false；只有确认点击未触发播放时再启用"
          }
        }
      }
    },
    {
      name: "type_text",
      description: "向前台应用输入文本。",
      inputSchema: {
        type: "object",
        required: ["text"],
        properties: {
          text: {
            type: "string",
            description: "要输入的文本，最多 5000 字符"
          }
        }
      }
    },
    {
      name: "press_key",
      description: "向前台应用发送按键，支持 return、tab、escape、方向键、page_up/page_down 等，也支持单字符。",
      inputSchema: {
        type: "object",
        required: ["key"],
        properties: {
          key: {
            type: "string",
            description: "按键名或单字符"
          },
          modifiers: {
            type: "array",
            items: {
              type: "string",
              enum: ["command", "control", "option", "shift"]
            },
            description: "可选修饰键"
          },
          repeat: {
            type: "integer",
            description: "重复次数，1-20，默认 1"
          }
        }
      }
    },
    {
      name: "take_screenshot",
      description: "截取当前屏幕并保存到临时 PNG 文件，返回本地文件路径。",
      inputSchema: {
        type: "object",
        properties: {}
      }
    }
  ];
}

async function handleRequest(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    ok(id, {
      protocolVersion: "2025-11-25",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "computer-use",
        version: "0.1.0"
      }
    });
    return;
  }

  if (method === "tools/list") {
    ok(id, {
      tools: getTools()
    });
    return;
  }

  if (method === "tools/call") {
    const toolName = String(params?.name || "").trim();
    const argumentsObject = params?.arguments && typeof params.arguments === "object" ? params.arguments : {};

    if (toolName === "list_apps") {
      ok(id, await listApps(argumentsObject));
      return;
    }

    if (toolName === "get_app_state") {
      ok(id, await getAppState(argumentsObject));
      return;
    }

    if (toolName === "open_app") {
      ok(id, await openApp(argumentsObject));
      return;
    }

    if (toolName === "open_url") {
      ok(id, await openUrl(argumentsObject));
      return;
    }

    if (toolName === "wait") {
      ok(id, await wait(argumentsObject));
      return;
    }

    if (toolName === "click") {
      ok(id, await click(argumentsObject));
      return;
    }

    if (toolName === "click_text") {
      ok(id, await clickText(argumentsObject));
      return;
    }

    if (toolName === "click_window_area") {
      ok(id, await clickWindowArea(argumentsObject));
      return;
    }

    if (toolName === "play_media") {
      ok(id, await playMedia(argumentsObject));
      return;
    }

    if (toolName === "type_text") {
      ok(id, await typeText(argumentsObject));
      return;
    }

    if (toolName === "press_key") {
      ok(id, await pressKey(argumentsObject));
      return;
    }

    if (toolName === "take_screenshot") {
      ok(id, await takeScreenshot(argumentsObject));
      return;
    }

    throw new Error(`未知工具：${toolName}`);
  }

  if (method === "notifications/initialized") {
    return;
  }

  throw new Error(`未知方法：${method}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", async (line) => {
  const trimmed = line.trim();

  if (!trimmed) {
    return;
  }

  let message;

  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (typeof message.id !== "number") {
    if (message.method === "notifications/initialized") {
      return;
    }

    return;
  }

  try {
    await handleRequest(message);
  } catch (error) {
    fail(message.id, error instanceof Error ? error.message : String(error));
  }
});

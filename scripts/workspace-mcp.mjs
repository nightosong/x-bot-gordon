import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

const workspaceRoot = path.resolve(process.env.GORDON_WORKSPACE_ROOT || process.cwd());
const gordonDataRoot = path.resolve(
  process.env.GORDON_DATA_ROOT || path.join(process.env.GORDON_HOME || path.join(os.homedir(), ".gord"), "data")
);
const PERMISSION_REQUIRED_PREFIX = "GORDON_PERMISSION_REQUIRED";
const TEXT_FILE_MAX_BYTES = 256 * 1024;
const JSON_FILE_MAX_BYTES = 2 * 1024 * 1024;
const SEARCH_RESULT_LIMIT = 80;
const WEB_SEARCH_RESULT_LIMIT = 8;
const WEB_SEARCH_TIMEOUT_MS = 10_000;
const WEB_FETCH_MAX_BYTES = 2 * 1024 * 1024;
const WEB_PAGE_MAX_BYTES = 768 * 1024;
const WEB_PAGE_TEXT_MAX_CHARS = 24_000;
const WEB_PAGE_LINK_LIMIT = 30;
const SHELL_COMMAND_TIMEOUT_MS = 10_000;
const SHELL_COMMAND_MAX_TIMEOUT_MS = 20_000;
const SHELL_OUTPUT_MAX_BYTES = 256 * 1024;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", ".pnpm-store"]);
const WEB_SEARCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const ALLOWED_SHELL_COMMANDS = new Set(["curl", "rg", "diff", "file", "stat", "wc", "head", "tail", "sed"]);

function parseAllowedRoots() {
  const rawValue = String(process.env.GORDON_WORKSPACE_ALLOWED_ROOTS || "").trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (Array.isArray(parsed)) {
      return parsed.map((entry) => path.resolve(String(entry))).filter(Boolean);
    }
  } catch {
    return rawValue
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => path.resolve(entry));
  }

  return [];
}

const allowedRoots = Array.from(new Set([workspaceRoot, gordonDataRoot, ...parseAllowedRoots()]));

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

function toRelativePath(targetPath) {
  const resolvedPath = path.resolve(targetPath);

  if (!isPathInsideDirectory(workspaceRoot, resolvedPath)) {
    return resolvedPath;
  }

  const relativePath = path.relative(workspaceRoot, resolvedPath);
  return relativePath || ".";
}

function isPathInsideDirectory(basePath, targetPath) {
  const relativePath = path.relative(basePath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function expandInputPath(inputPath = ".") {
  const rawPath = String(inputPath || ".").trim() || ".";

  if (rawPath === "~") {
    return os.homedir();
  }

  if (rawPath.startsWith("~/") || rawPath.startsWith("~\\")) {
    return path.join(os.homedir(), rawPath.slice(2));
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(workspaceRoot, rawPath);
}

function buildPermissionPayload(targetPath) {
  return {
    path: targetPath,
    suggestedRoot: targetPath,
    workspaceRoot,
    allowedRoots
  };
}

function throwPermissionRequired(targetPath) {
  throw new Error(`${PERMISSION_REQUIRED_PREFIX} ${JSON.stringify(buildPermissionPayload(targetPath))}`);
}

function resolveWorkspacePath(inputPath = ".") {
  const resolvedPath = path.resolve(expandInputPath(inputPath));

  if (!allowedRoots.some((allowedRoot) => isPathInsideDirectory(allowedRoot, resolvedPath))) {
    throwPermissionRequired(resolvedPath);
  }

  return resolvedPath;
}

function normalizeWorkspacePath(inputPath = ".") {
  return toRelativePath(resolveWorkspacePath(inputPath));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function assertTextContent(content) {
  if (typeof content !== "string") {
    throw new Error("content 必须是字符串");
  }
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(text) {
  return decodeHtmlEntities(String(text || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
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

function clampInteger(value, defaultValue, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function assertSafeArgument(value, label = "参数") {
  if (String(value).includes("\u0000")) {
    throw new Error(`${label} 不允许包含空字节`);
  }
}

function normalizeHttpUrl(value, label = "url") {
  const rawUrl = String(value || "").trim();
  assertSafeArgument(rawUrl, label);

  if (!rawUrl) {
    throw new Error(`${label} 不能为空`);
  }

  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} 必须是有效 URL`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} 仅支持 http 或 https`);
  }

  return parsed.toString();
}

function truncateByBytes(text, maxBytes) {
  const buffer = Buffer.from(String(text || ""), "utf8");

  if (buffer.byteLength <= maxBytes) {
    return {
      text: String(text || ""),
      truncated: false
    };
  }

  return {
    text: buffer.subarray(0, maxBytes).toString("utf8"),
    truncated: true
  };
}

function truncateByChars(text, maxChars) {
  const value = String(text || "");

  if (value.length <= maxChars) {
    return {
      text: value,
      truncated: false
    };
  }

  return {
    text: value.slice(0, maxChars),
    truncated: true
  };
}

async function readResponseTextWithLimit(response, maxBytes) {
  if (!response.body?.getReader) {
    const rawText = await response.text();
    return truncateByBytes(rawText, maxBytes).text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
    const remainingBytes = maxBytes - bytesRead;

    if (remainingBytes <= 0) {
      await reader.cancel();
      break;
    }

    if (chunk.byteLength > remainingBytes) {
      text += decoder.decode(chunk.subarray(0, remainingBytes), { stream: true });
      bytesRead += remainingBytes;
      await reader.cancel();
      break;
    }

    text += decoder.decode(chunk, { stream: true });
    bytesRead += chunk.byteLength;
  }

  text += decoder.decode();
  return text;
}

async function runProcess(command, args, options = {}) {
  const timeoutMs = clampInteger(options.timeoutMs, SHELL_COMMAND_TIMEOUT_MS, 1_000, SHELL_COMMAND_MAX_TIMEOUT_MS);
  const maxOutputBytes = clampInteger(options.maxOutputBytes, SHELL_OUTPUT_MAX_BYTES, 4 * 1024, SHELL_OUTPUT_MAX_BYTES);

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || workspaceRoot,
      shell: false,
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
      const selectedText = selected.toString("utf8");

      if (streamName === "stdout") {
        stdout += selectedText;
        stdoutBytes += selected.byteLength;
        stdoutTruncated = stdoutTruncated || buffer.byteLength > remainingBytes;
      } else {
        stderr += selectedText;
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

    child.on("error", (error) => {
      finish(() => reject(error));
    });

    child.on("close", (exitCode, signal) => {
      finish(() =>
        resolve({
          command,
          args,
          cwd: options.cwd || workspaceRoot,
          exitCode,
          signal,
          stdout,
          stderr,
          stdoutTruncated,
          stderrTruncated,
          timedOut
        })
      );
    });
  });
}

async function listDirectory(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const normalizedEntries = entries
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 120)
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other"
    }));

  return {
    content: [
      {
        type: "text",
        text: [
          `workspace: ${workspaceRoot}`,
          `path: ${toRelativePath(targetPath)}`,
          "",
          ...normalizedEntries.map((entry) => `${entry.type === "dir" ? "[dir]" : "[file]"} ${entry.name}`)
        ].join("\n")
      }
    ],
    structuredContent: {
      workspaceRoot,
      path: toRelativePath(targetPath),
      entries: normalizedEntries
    }
  };
}

async function readFileContent(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const stat = await fs.stat(targetPath);

  if (!stat.isFile()) {
    throw new Error("目标路径不是文件");
  }

  if (stat.size > TEXT_FILE_MAX_BYTES) {
    throw new Error(`文件过大，当前只允许读取 ${TEXT_FILE_MAX_BYTES} 字节以内的文本文件`);
  }

  const rawContent = await fs.readFile(targetPath, "utf8");
  const lines = rawContent.split("\n");
  const startLine = Math.max(1, Number(argumentsObject?.startLine) || 1);
  const endLine = Math.min(lines.length, Number(argumentsObject?.endLine) || Math.min(lines.length, startLine + 199));
  const selectedLines = lines
    .slice(startLine - 1, endLine)
    .map((line, index) => `${String(startLine + index).padStart(4, " ")} | ${line}`);

  return {
    content: [
      {
        type: "text",
        text: [`path: ${toRelativePath(targetPath)}`, `lines: ${startLine}-${endLine}`, "", ...selectedLines].join("\n")
      }
    ],
    structuredContent: {
      path: toRelativePath(targetPath),
      startLine,
      endLine,
      lineCount: lines.length
    }
  };
}

async function getPathInfo(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const exists = await pathExists(targetPath);

  if (!exists) {
    return buildTextResult(`path: ${toRelativePath(targetPath)}\nexists: false`, {
      path: toRelativePath(targetPath),
      exists: false
    });
  }

  const stat = await fs.stat(targetPath);
  const info = {
    path: toRelativePath(targetPath),
    exists: true,
    type: stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other",
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };

  return buildTextResult(
    [
      `path: ${info.path}`,
      `exists: true`,
      `type: ${info.type}`,
      `size: ${info.size}`,
      `updatedAt: ${info.updatedAt}`
    ].join("\n"),
    info
  );
}

async function validateJsonFile(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const stat = await fs.stat(targetPath);

  if (!stat.isFile()) {
    throw new Error("目标路径不是文件");
  }

  if (stat.size > JSON_FILE_MAX_BYTES) {
    throw new Error(`JSON 文件过大，当前只允许校验 ${JSON_FILE_MAX_BYTES} 字节以内的文件`);
  }

  const rawContent = await fs.readFile(targetPath, "utf8");
  let parsed;

  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON 解析失败：${message}`);
  }

  const jsonType = Array.isArray(parsed) ? "array" : parsed === null ? "null" : typeof parsed;
  const topLevelCount =
    Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0;

  return buildTextResult(
    [
      `path: ${toRelativePath(targetPath)}`,
      "valid: true",
      `type: ${jsonType}`,
      `topLevelCount: ${topLevelCount}`,
      `size: ${stat.size}`
    ].join("\n"),
    {
      path: toRelativePath(targetPath),
      valid: true,
      type: jsonType,
      topLevelCount,
      size: stat.size
    }
  );
}

async function normalizePath(argumentsObject) {
  const relativePath = normalizeWorkspacePath(argumentsObject?.path);

  return buildTextResult(`path: ${relativePath}`, {
    workspaceRoot,
    path: relativePath
  });
}

async function joinPath(argumentsObject) {
  const segments = Array.isArray(argumentsObject?.segments) ? argumentsObject.segments : [];

  if (!segments.length) {
    throw new Error("join_path 需要提供 segments");
  }

  const joinedPath = path.join(...segments.map((segment) => String(segment)));
  const relativePath = normalizeWorkspacePath(joinedPath);

  return buildTextResult(`path: ${relativePath}`, {
    workspaceRoot,
    path: relativePath,
    segments: segments.map((segment) => String(segment))
  });
}

async function relativePath(argumentsObject) {
  const fromPath = resolveWorkspacePath(argumentsObject?.fromPath);
  const toPath = resolveWorkspacePath(argumentsObject?.toPath);
  const fromStatExists = await pathExists(fromPath);
  const fromBasePath = fromStatExists && (await fs.stat(fromPath)).isFile() ? path.dirname(fromPath) : fromPath;
  const computedPath = path.relative(fromBasePath, toPath) || ".";

  return buildTextResult(`path: ${computedPath}`, {
    fromPath: toRelativePath(fromBasePath),
    toPath: toRelativePath(toPath),
    path: computedPath
  });
}

async function writeFileContent(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const mode = String(argumentsObject?.mode || "overwrite").trim();
  const createDirectories = Boolean(argumentsObject?.createDirectories);
  const content = argumentsObject?.content;
  assertTextContent(content);

  if (createDirectories) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
  }

  const alreadyExists = await pathExists(targetPath);

  if (mode === "create" && alreadyExists) {
    throw new Error("目标文件已存在，create 模式不允许覆盖");
  }

  if (mode === "append") {
    await fs.appendFile(targetPath, content, "utf8");
  } else {
    await fs.writeFile(targetPath, content, "utf8");
  }

  const finalStat = await fs.stat(targetPath);

  return buildTextResult(
    [
      `path: ${toRelativePath(targetPath)}`,
      `mode: ${mode}`,
      `size: ${finalStat.size}`,
      alreadyExists ? "status: updated" : "status: created"
    ].join("\n"),
    {
      path: toRelativePath(targetPath),
      mode,
      size: finalStat.size,
      status: alreadyExists ? "updated" : "created"
    }
  );
}

async function replaceInFile(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const findText = String(argumentsObject?.findText || "");
  const replaceText = String(argumentsObject?.replaceText || "");
  const replaceAll = Boolean(argumentsObject?.replaceAll);

  if (!findText) {
    throw new Error("replace_in_file 需要提供 findText");
  }

  const original = await fs.readFile(targetPath, "utf8");
  const occurrenceCount = original.split(findText).length - 1;

  if (!occurrenceCount) {
    throw new Error("未找到需要替换的文本");
  }

  const updated = replaceAll ? original.split(findText).join(replaceText) : original.replace(findText, replaceText);
  await fs.writeFile(targetPath, updated, "utf8");

  return buildTextResult(
    [
      `path: ${toRelativePath(targetPath)}`,
      `replaced: ${replaceAll ? occurrenceCount : 1}`,
      `mode: ${replaceAll ? "replace_all" : "replace_first"}`
    ].join("\n"),
    {
      path: toRelativePath(targetPath),
      replaced: replaceAll ? occurrenceCount : 1,
      mode: replaceAll ? "replace_all" : "replace_first"
    }
  );
}

async function createDirectory(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  await fs.mkdir(targetPath, { recursive: true });

  return buildTextResult(`directory created: ${toRelativePath(targetPath)}`, {
    path: toRelativePath(targetPath),
    created: true
  });
}

async function movePath(argumentsObject) {
  const fromPath = resolveWorkspacePath(argumentsObject?.fromPath);
  const toPath = resolveWorkspacePath(argumentsObject?.toPath);
  const createDirectories = Boolean(argumentsObject?.createDirectories);

  if (!(await pathExists(fromPath))) {
    throw new Error("源路径不存在");
  }

  if (createDirectories) {
    await fs.mkdir(path.dirname(toPath), { recursive: true });
  }

  await fs.rename(fromPath, toPath);

  return buildTextResult(
    [`from: ${toRelativePath(fromPath)}`, `to: ${toRelativePath(toPath)}`, "status: moved"].join("\n"),
    {
      fromPath: toRelativePath(fromPath),
      toPath: toRelativePath(toPath),
      moved: true
    }
  );
}

async function deletePath(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const recursive = Boolean(argumentsObject?.recursive);

  if (!(await pathExists(targetPath))) {
    throw new Error("目标路径不存在");
  }

  const stat = await fs.stat(targetPath);

  if (stat.isDirectory()) {
    await fs.rm(targetPath, { recursive, force: false });
  } else {
    await fs.unlink(targetPath);
  }

  return buildTextResult(`deleted: ${toRelativePath(targetPath)}`, {
    path: toRelativePath(targetPath),
    deleted: true,
    recursive
  });
}

async function isSearchableTextFile(filePath) {
  const stat = await fs.stat(filePath);

  if (!stat.isFile() || stat.size > TEXT_FILE_MAX_BYTES) {
    return false;
  }

  const content = await fs.readFile(filePath, "utf8");

  if (content.includes("\u0000")) {
    return false;
  }

  return content;
}

async function collectSearchResults(query, directoryPath, results) {
  if (results.length >= SEARCH_RESULT_LIMIT) {
    return;
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (results.length >= SEARCH_RESULT_LIMIT) {
      return;
    }

    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await collectSearchResults(query, absolutePath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = await isSearchableTextFile(absolutePath);

    if (!content) {
      continue;
    }

    const lines = content.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      if (results.length >= SEARCH_RESULT_LIMIT) {
        return;
      }

      if (lines[index].toLowerCase().includes(query)) {
        results.push({
          path: toRelativePath(absolutePath),
          line: index + 1,
          preview: lines[index].trim()
        });
      }
    }
  }
}

async function searchFiles(argumentsObject) {
  const query = String(argumentsObject?.query || "").trim().toLowerCase();

  if (!query) {
    throw new Error("search_files 需要提供 query");
  }

  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const stat = await fs.stat(targetPath);
  const baseDirectory = stat.isDirectory() ? targetPath : path.dirname(targetPath);
  const results = [];

  await collectSearchResults(query, baseDirectory, results);

  return {
    content: [
      {
        type: "text",
        text: results.length
          ? results.map((result) => `${result.path}:${result.line}: ${result.preview}`).join("\n")
          : "未找到匹配结果"
      }
    ],
    structuredContent: {
      path: toRelativePath(baseDirectory),
      query,
      count: results.length,
      results
    }
  };
}

function getWebSearchLimit(argumentsObject) {
  const rawLimit = Number(argumentsObject?.limit ?? WEB_SEARCH_RESULT_LIMIT);

  if (!Number.isFinite(rawLimit)) {
    return WEB_SEARCH_RESULT_LIMIT;
  }

  return Math.max(1, Math.min(10, Math.floor(rawLimit)));
}

function buildSearchUrl(engine, query, mode = "html") {
  const encodedQuery = encodeURIComponent(query);

  if (engine === "bing" && mode === "rss") {
    return `https://www.bing.com/search?q=${encodedQuery}&format=rss&setlang=zh-CN&cc=CN&mkt=zh-CN`;
  }

  if (engine === "bing") {
    return `https://www.bing.com/search?q=${encodedQuery}&setlang=zh-CN&cc=CN&mkt=zh-CN`;
  }

  if (engine === "baidu") {
    return `https://www.baidu.com/s?wd=${encodedQuery}&rn=10&ie=utf-8`;
  }

  return `https://www.google.com/search?hl=zh-CN&num=10&q=${encodedQuery}`;
}

async function fetchTextWithFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = clampInteger(options.timeoutMs, WEB_SEARCH_TIMEOUT_MS, 1_000, SHELL_COMMAND_MAX_TIMEOUT_MS);
  const maxBytes = clampInteger(options.maxBytes, WEB_FETCH_MAX_BYTES, 16 * 1024, WEB_FETCH_MAX_BYTES);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": WEB_SEARCH_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await readResponseTextWithLimit(response, maxBytes);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithCurl(url, options = {}) {
  const timeoutMs = clampInteger(options.timeoutMs, WEB_SEARCH_TIMEOUT_MS, 1_000, SHELL_COMMAND_MAX_TIMEOUT_MS);
  const maxBytes = clampInteger(options.maxBytes, WEB_FETCH_MAX_BYTES, 16 * 1024, WEB_FETCH_MAX_BYTES);
  const result = await runProcess(
    "curl",
    [
      "-L",
      "--compressed",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "-A",
      WEB_SEARCH_USER_AGENT,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: zh-CN,zh;q=0.9,en;q=0.7",
      url
    ],
    {
      timeoutMs,
      maxOutputBytes: maxBytes
    }
  );

  if (result.exitCode === 0 && result.stdout.trim()) {
    return result.stdout;
  }

  throw new Error(result.stderr.trim() || `curl exit ${result.exitCode ?? "unknown"}`);
}

async function fetchText(url, options = {}) {
  try {
    return await fetchTextWithFetch(url, options);
  } catch (fetchError) {
    try {
      return await fetchTextWithCurl(url, options);
    } catch (curlError) {
      throw new Error(
        `fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}; curl failed: ${
          curlError instanceof Error ? curlError.message : String(curlError)
        }`
      );
    }
  }
}

function safeDecodeUrl(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeXmlEntities(text) {
  return decodeHtmlEntities(
    String(text || "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&#(\d+);/g, (_match, code) => {
        const value = Number(code);
        return Number.isFinite(value) ? String.fromCodePoint(value) : "";
      })
      .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
        const value = Number.parseInt(code, 16);
        return Number.isFinite(value) ? String.fromCodePoint(value) : "";
      })
  );
}

function normalizeSearchUrl(url) {
  const trimmed = safeDecodeUrl(String(url || "").trim());

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/url?")) {
    try {
      const parsed = new URL(trimmed, "https://www.google.com");
      return parsed.searchParams.get("q") || trimmed;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return trimmed;
}

function normalizeSearchResult(title, url, snippet) {
  return {
    title: stripHtml(title),
    url: normalizeSearchUrl(url),
    snippet: stripHtml(snippet)
  };
}

function pushSearchResult(results, seenUrls, candidate, limit) {
  const title = String(candidate?.title || "").trim();
  const url = normalizeSearchUrl(candidate?.url || "");
  const snippet = String(candidate?.snippet || "").trim();

  if (!title || !url || seenUrls.has(url)) {
    return;
  }

  seenUrls.add(url);
  results.push({
    title,
    url,
    snippet
  });

  if (results.length > limit) {
    results.length = limit;
  }
}

function extractRssResults(xml, limit = WEB_SEARCH_RESULT_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const itemPattern = /<item\b[\s\S]*?<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) && results.length < limit) {
    const item = match[0];
    const title = decodeXmlEntities(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const link = decodeXmlEntities(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "");
    const snippet = decodeXmlEntities(item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "");

    pushSearchResult(results, seenUrls, normalizeSearchResult(title, link, snippet), limit);
  }

  return results;
}

function extractGoogleResults(html, limit = WEB_SEARCH_RESULT_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const blockPattern = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/gi;
  let match;

  while ((match = blockPattern.exec(html)) && results.length < limit) {
    const url = normalizeSearchUrl(match[1]);

    if (!url || url.includes("google.") || url.startsWith("#")) {
      continue;
    }

    const afterBlock = html.slice(match.index + match[0].length, match.index + match[0].length + 900);
    const snippet = afterBlock.match(/<div[^>]*>([\s\S]{0,420}?)<\/div>/i)?.[1] || "";
    pushSearchResult(results, seenUrls, normalizeSearchResult(match[2], url, snippet), limit);
  }

  return results;
}

function extractBingResults(html, limit = WEB_SEARCH_RESULT_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const pattern =
    /<li[^>]*class="[^"]*\bb_algo\b[^"]*"[\s\S]*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < limit) {
    pushSearchResult(results, seenUrls, normalizeSearchResult(match[2], match[1], match[3] || ""), limit);
  }

  return results;
}

function extractBaiduResults(html, limit = WEB_SEARCH_RESULT_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const blockPattern = /<div[^>]+(?:class|tpl)="[^"]*(?:result|c-container)[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
  let match;

  while ((match = blockPattern.exec(html)) && results.length < limit) {
    const block = match[0];
    const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);

    if (!titleMatch) {
      continue;
    }

    const snippet =
      block.match(/<(?:span|div)[^>]+class="[^"]*(?:c-abstract|content-right|content-left|result-desc)[^"]*"[^>]*>([\s\S]{0,700}?)<\/(?:span|div)>/i)?.[1] ||
      block.match(/<div[^>]+class="[^"]*c-span-last[^"]*"[^>]*>([\s\S]{0,700}?)<\/div>/i)?.[1] ||
      "";
    pushSearchResult(results, seenUrls, normalizeSearchResult(titleMatch[2], titleMatch[1], snippet), limit);
  }

  if (results.length) {
    return results;
  }

  const fallbackPattern = /<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi;

  while ((match = fallbackPattern.exec(html)) && results.length < limit) {
    pushSearchResult(results, seenUrls, normalizeSearchResult(match[2], match[1], ""), limit);
  }

  return results;
}

function parseSearchResults(engine, payload, limit, mode = "html") {
  if (mode === "rss") {
    return extractRssResults(payload, limit);
  }

  if (engine === "bing") {
    return extractBingResults(payload, limit);
  }

  if (engine === "baidu") {
    return extractBaiduResults(payload, limit);
  }

  return extractGoogleResults(payload, limit);
}

function buildEngineAttempts(engine, query) {
  if (engine === "bing") {
    return [
      { engine: "bing", mode: "rss", url: buildSearchUrl("bing", query, "rss") },
      { engine: "bing", mode: "html", url: buildSearchUrl("bing", query, "html") }
    ];
  }

  return [{ engine, mode: "html", url: buildSearchUrl(engine, query, "html") }];
}

async function searchWithEngine(engine, query, limit) {
  const errors = [];

  for (const attempt of buildEngineAttempts(engine, query)) {
    try {
      const payload = await fetchText(attempt.url);
      const results = parseSearchResults(attempt.engine, payload, limit, attempt.mode);

      if (results.length) {
        return {
          engine: attempt.engine,
          sourceUrl: attempt.url,
          mode: attempt.mode,
          results,
          errors
        };
      }

      errors.push(`${attempt.engine}/${attempt.mode}: 未解析到结果`);
    } catch (error) {
      errors.push(`${attempt.engine}/${attempt.mode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    engine,
    sourceUrl: buildSearchUrl(engine, query),
    mode: "html",
    results: [],
    errors
  };
}

async function webSearch(argumentsObject) {
  const query = String(argumentsObject?.query || "").trim();
  const requestedEngine = String(argumentsObject?.engine || "auto").trim().toLowerCase();
  const limit = getWebSearchLimit(argumentsObject);

  if (!query) {
    throw new Error("web_search 需要提供 query");
  }

  const supportedEngines = new Set(["auto", "google", "bing", "baidu"]);

  if (!supportedEngines.has(requestedEngine)) {
    throw new Error("web_search 的 engine 仅支持 auto、google、bing、baidu");
  }

  const engineOrder = requestedEngine === "auto" ? ["bing", "baidu", "google"] : [requestedEngine];
  const attemptErrors = [];
  let selectedResult = null;

  for (const engine of engineOrder) {
    const result = await searchWithEngine(engine, query, limit);
    attemptErrors.push(...result.errors);

    if (result.results.length) {
      selectedResult = result;
      break;
    }
  }

  const results = selectedResult?.results ?? [];
  const engine = selectedResult?.engine ?? engineOrder[0];
  const sourceUrl = selectedResult?.sourceUrl ?? buildSearchUrl(engine, query);

  return buildTextResult(
    results.length
      ? results
          .map((result, index) => [`${index + 1}. ${result.title}`, result.url, result.snippet].filter(Boolean).join("\n"))
          .join("\n\n")
      : `未解析到可用搜索结果。${attemptErrors.length ? `\n${attemptErrors.join("\n")}` : ""}`,
    {
      requestedEngine,
      engine,
      sourceUrl,
      query,
      limit,
      count: results.length,
      results,
      errors: attemptErrors
    }
  );
}

function getHtmlAttribute(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag || "").match(pattern);
  return decodeHtmlEntities(match?.[1] || match?.[2] || match?.[3] || "").trim();
}

function extractMetaContent(html, candidates) {
  const candidateSet = new Set(candidates.map((candidate) => candidate.toLowerCase()));
  const metaPattern = /<meta\b[^>]*>/gi;
  let match;

  while ((match = metaPattern.exec(html))) {
    const tag = match[0];
    const name = getHtmlAttribute(tag, "name").toLowerCase();
    const property = getHtmlAttribute(tag, "property").toLowerCase();

    if (candidateSet.has(name) || candidateSet.has(property)) {
      const content = getHtmlAttribute(tag, "content");

      if (content) {
        return stripHtml(content);
      }
    }
  }

  return "";
}

function extractPageTitle(html) {
  const ogTitle = extractMetaContent(html, ["og:title", "twitter:title"]);

  if (ogTitle) {
    return ogTitle;
  }

  return stripHtml(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function htmlToReadableText(html) {
  const withoutNoise = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutNoise
    .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|header|footer|main|aside|nav|li|h[1-6]|tr|blockquote|pre)>/gi, "\n");

  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractPageLinks(html, sourceUrl, limit = WEB_PAGE_LINK_LIMIT) {
  const links = [];
  const seenUrls = new Set();
  const linkPattern = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) && links.length < limit) {
    const href = getHtmlAttribute(match[1], "href");

    if (!href || /^(?:javascript|mailto|tel):/i.test(href) || href.startsWith("#")) {
      continue;
    }

    let absoluteUrl;

    try {
      absoluteUrl = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }

    if (!/^https?:\/\//i.test(absoluteUrl) || seenUrls.has(absoluteUrl)) {
      continue;
    }

    const text = stripHtml(match[2]).slice(0, 120);
    seenUrls.add(absoluteUrl);
    links.push({
      text,
      url: absoluteUrl
    });
  }

  return links;
}

async function readWebPage(argumentsObject) {
  const sourceUrl = normalizeHttpUrl(argumentsObject?.url);
  const maxBytes = clampInteger(argumentsObject?.maxBytes, WEB_PAGE_MAX_BYTES, 16 * 1024, WEB_FETCH_MAX_BYTES);
  const html = await fetchText(sourceUrl, {
    maxBytes,
    timeoutMs: WEB_SEARCH_TIMEOUT_MS
  });
  const title = extractPageTitle(html);
  const description = extractMetaContent(html, ["description", "og:description", "twitter:description"]);
  const readableText = htmlToReadableText(html);
  const excerpt = truncateByChars(readableText, WEB_PAGE_TEXT_MAX_CHARS);
  const links = extractPageLinks(html, sourceUrl);
  const bytesRead = Buffer.byteLength(html, "utf8");

  return buildTextResult(
    [
      `url: ${sourceUrl}`,
      title ? `title: ${title}` : "",
      description ? `description: ${description}` : "",
      `bytesRead: ${bytesRead}`,
      excerpt.truncated ? `text: 前 ${WEB_PAGE_TEXT_MAX_CHARS} 字符` : "text:",
      "",
      excerpt.text || "未提取到可读正文",
      links.length ? "" : "",
      links.length ? "links:" : "",
      ...links.map((link, index) => `${index + 1}. ${link.text || link.url}\n${link.url}`)
    ]
      .filter((line) => line !== "")
      .join("\n"),
    {
      url: sourceUrl,
      title,
      description,
      bytesRead,
      maxBytes,
      text: excerpt.text,
      textTruncated: excerpt.truncated,
      links
    }
  );
}

async function inspectPath(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const exists = await pathExists(targetPath);
  const relativeTargetPath = toRelativePath(targetPath);

  if (!exists) {
    return buildTextResult(`path: ${relativeTargetPath}\nexists: false`, {
      path: relativeTargetPath,
      exists: false
    });
  }

  const stat = await fs.stat(targetPath);
  const type = stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other";
  const baseInfo = {
    path: relativeTargetPath,
    exists: true,
    type,
    size: stat.size,
    mode: `0${(stat.mode & 0o777).toString(8)}`,
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString()
  };

  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const directoryCount = entries.filter((entry) => entry.isDirectory()).length;
    const fileCount = entries.filter((entry) => entry.isFile()).length;
    const sampleEntries = entries
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 30)
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other"
      }));
    const info = {
      ...baseInfo,
      entryCount: entries.length,
      directoryCount,
      fileCount,
      sampleEntries
    };

    return buildTextResult(
      [
        `path: ${info.path}`,
        "exists: true",
        "type: dir",
        `entries: ${info.entryCount}`,
        `directories: ${directoryCount}`,
        `files: ${fileCount}`,
        `updatedAt: ${info.updatedAt}`,
        "",
        ...sampleEntries.map((entry) => `${entry.type === "dir" ? "[dir]" : "[file]"} ${entry.name}`)
      ].join("\n"),
      info
    );
  }

  if (stat.isFile()) {
    let lineCount = null;
    let isLikelyText = false;

    if (stat.size <= TEXT_FILE_MAX_BYTES) {
      const buffer = await fs.readFile(targetPath);
      isLikelyText = !buffer.includes(0);

      if (isLikelyText) {
        lineCount = buffer.toString("utf8").split("\n").length;
      }
    }

    const info = {
      ...baseInfo,
      extension: path.extname(targetPath),
      isLikelyText,
      lineCount
    };

    return buildTextResult(
      [
        `path: ${info.path}`,
        "exists: true",
        "type: file",
        `size: ${info.size}`,
        `extension: ${info.extension || "(none)"}`,
        `isLikelyText: ${isLikelyText}`,
        lineCount ? `lineCount: ${lineCount}` : "",
        `updatedAt: ${info.updatedAt}`
      ]
        .filter(Boolean)
        .join("\n"),
      info
    );
  }

  return buildTextResult(
    [
      `path: ${baseInfo.path}`,
      "exists: true",
      `type: ${type}`,
      `size: ${baseInfo.size}`,
      `updatedAt: ${baseInfo.updatedAt}`
    ].join("\n"),
    baseInfo
  );
}

async function diffPaths(argumentsObject) {
  const leftPath = resolveWorkspacePath(argumentsObject?.leftPath);
  const rightPath = resolveWorkspacePath(argumentsObject?.rightPath);
  const contextLines = clampInteger(argumentsObject?.contextLines, 3, 0, 20);
  const [leftStat, rightStat] = await Promise.all([fs.stat(leftPath), fs.stat(rightPath)]);

  if (!leftStat.isFile() || !rightStat.isFile()) {
    throw new Error("diff_paths 当前仅支持文件对比");
  }

  const args = contextLines === 3 ? ["-u", leftPath, rightPath] : ["-U", String(contextLines), leftPath, rightPath];
  const result = await runProcess("diff", args, {
    timeoutMs: SHELL_COMMAND_TIMEOUT_MS,
    maxOutputBytes: SHELL_OUTPUT_MAX_BYTES
  });

  if (![0, 1].includes(result.exitCode)) {
    throw new Error(result.stderr.trim() || `diff exit ${result.exitCode ?? "unknown"}`);
  }

  const different = result.exitCode === 1;
  const diffText = result.stdout.trimEnd();

  return buildTextResult(
    [
      `leftPath: ${toRelativePath(leftPath)}`,
      `rightPath: ${toRelativePath(rightPath)}`,
      `different: ${different}`,
      result.stdoutTruncated ? "stdoutTruncated: true" : "",
      "",
      different ? diffText || "存在差异，但 diff 未输出内容" : "无差异"
    ]
      .filter((line) => line !== "")
      .join("\n"),
    {
      leftPath: toRelativePath(leftPath),
      rightPath: toRelativePath(rightPath),
      contextLines,
      different,
      diff: diffText,
      stdoutTruncated: result.stdoutTruncated
    }
  );
}

function normalizeShellCommandName(value) {
  const command = String(value || "").trim();
  assertSafeArgument(command, "command");

  if (!/^[a-z][a-z0-9_-]*$/i.test(command)) {
    throw new Error("run_shell_command 仅允许传入命令名，不允许路径、shell 片段或复合命令");
  }

  if (!ALLOWED_SHELL_COMMANDS.has(command)) {
    throw new Error(`run_shell_command 不允许执行 ${command}`);
  }

  return command;
}

function normalizeShellArgs(value) {
  const args = Array.isArray(value) ? value : [];

  if (args.length > 40) {
    throw new Error("run_shell_command 参数过多");
  }

  return args.map((arg, index) => {
    const normalized = String(arg);
    assertSafeArgument(normalized, `args[${index}]`);
    return normalized;
  });
}

function parseBoundedInteger(value, label, min, max) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`${label} 必须是 ${min}-${max} 的整数`);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} 必须是 ${min}-${max} 的整数`);
  }

  return parsed;
}

function resolveShellPath(value) {
  return resolveWorkspacePath(value);
}

function validateCurlArgs(args) {
  const normalizedArgs = [];
  let urlCount = 0;
  let hasMaxTime = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (["-L", "--location", "--compressed", "-I", "--head", "-s", "-S", "-sS", "--silent", "--show-error"].includes(arg)) {
      normalizedArgs.push(arg);
      continue;
    }

    if (arg === "--max-time") {
      const value = args[index + 1];
      parseBoundedInteger(value, "--max-time", 1, 20);
      normalizedArgs.push(arg, value);
      hasMaxTime = true;
      index += 1;
      continue;
    }

    if (["-A", "--user-agent", "-H", "--header"].includes(arg)) {
      const value = args[index + 1];

      if (!value || /[\r\n]/.test(value)) {
        throw new Error(`${arg} 的值不能为空或包含换行`);
      }

      normalizedArgs.push(arg, value);
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`curl 参数不在白名单中：${arg}`);
    }

    normalizedArgs.push(normalizeHttpUrl(arg, "curl url"));
    urlCount += 1;
  }

  if (urlCount !== 1) {
    throw new Error("curl 必须且只能访问一个 http(s) URL");
  }

  return hasMaxTime ? normalizedArgs : ["--max-time", String(Math.ceil(WEB_SEARCH_TIMEOUT_MS / 1000)), ...normalizedArgs];
}

function validateDiffCommandArgs(args) {
  const paths = [];
  let contextLines = 3;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "-u") {
      continue;
    }

    if (arg === "-U" || arg === "--unified") {
      contextLines = parseBoundedInteger(args[index + 1], arg, 0, 20);
      index += 1;
      continue;
    }

    const inlineUnified = arg.match(/^-U(\d+)$/);

    if (inlineUnified) {
      contextLines = parseBoundedInteger(inlineUnified[1], "-U", 0, 20);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`diff 参数不在白名单中：${arg}`);
    }

    paths.push(resolveShellPath(arg));
  }

  if (paths.length !== 2) {
    throw new Error("diff 需要两个路径参数");
  }

  return contextLines === 3 ? ["-u", ...paths] : ["-U", String(contextLines), ...paths];
}

function validateFileCommandArgs(args) {
  const flags = [];
  const paths = [];

  for (const arg of args) {
    if (["-b", "--brief", "--mime", "--mime-type"].includes(arg)) {
      flags.push(arg);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`file 参数不在白名单中：${arg}`);
    }

    paths.push(resolveShellPath(arg));
  }

  if (!paths.length || paths.length > 5) {
    throw new Error("file 需要 1-5 个路径参数");
  }

  return [...flags, ...paths];
}

function validateStatCommandArgs(args) {
  if (!args.length || args.length > 5) {
    throw new Error("stat 需要 1-5 个路径参数");
  }

  return args.map((arg) => {
    if (arg.startsWith("-")) {
      throw new Error("stat 当前只允许路径参数");
    }

    return resolveShellPath(arg);
  });
}

function validateWcArgs(args) {
  const normalizedArgs = [];
  const paths = [];

  for (const arg of args) {
    if (/^-[lwcm]+$/.test(arg)) {
      normalizedArgs.push(arg);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`wc 参数不在白名单中：${arg}`);
    }

    paths.push(resolveShellPath(arg));
  }

  if (!paths.length || paths.length > 10) {
    throw new Error("wc 需要 1-10 个路径参数");
  }

  return [...normalizedArgs, ...paths];
}

function validateHeadTailArgs(command, args) {
  const normalizedArgs = [];
  const paths = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const inlineLineCount = arg.match(/^-([1-9]\d{0,2})$/);

    if (inlineLineCount) {
      normalizedArgs.push("-n", String(parseBoundedInteger(inlineLineCount[1], `${command} 行数`, 1, 200)));
      continue;
    }

    if (arg === "-n" || arg === "--lines") {
      normalizedArgs.push("-n", String(parseBoundedInteger(args[index + 1], `${command} 行数`, 1, 200)));
      index += 1;
      continue;
    }

    const inlineLong = arg.match(/^--lines=(\d+)$/);

    if (inlineLong) {
      normalizedArgs.push("-n", String(parseBoundedInteger(inlineLong[1], `${command} 行数`, 1, 200)));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`${command} 参数不在白名单中：${arg}`);
    }

    paths.push(resolveShellPath(arg));
  }

  if (!paths.length || paths.length > 5) {
    throw new Error(`${command} 需要 1-5 个路径参数`);
  }

  return [...normalizedArgs, ...paths];
}

function validateSedArgs(args) {
  if (args.length !== 3 || args[0] !== "-n") {
    throw new Error("sed 仅允许格式：sed -n <start,endp> <path>");
  }

  const rangeMatch = args[1].match(/^(\d{1,6})(?:,(\d{1,6}))?p$/);

  if (!rangeMatch) {
    throw new Error("sed 仅允许按行号读取，例如 1,80p");
  }

  const startLine = parseBoundedInteger(rangeMatch[1], "sed 起始行", 1, 999_999);
  const endLine = rangeMatch[2] ? parseBoundedInteger(rangeMatch[2], "sed 结束行", 1, 999_999) : startLine;

  if (endLine < startLine || endLine - startLine > 500) {
    throw new Error("sed 单次最多读取 501 行，且结束行不能小于起始行");
  }

  return ["-n", `${startLine}${rangeMatch[2] ? `,${endLine}` : ""}p`, resolveShellPath(args[2])];
}

function validateRgValueFlag(flag, value) {
  if (!value) {
    throw new Error(`${flag} 需要提供值`);
  }

  if (["--max-count", "-m"].includes(flag)) {
    return String(parseBoundedInteger(value, flag, 1, 500));
  }

  if (["--context", "-C", "--before-context", "-B", "--after-context", "-A"].includes(flag)) {
    return String(parseBoundedInteger(value, flag, 0, 50));
  }

  if (["--type", "-t"].includes(flag) && !/^[a-z0-9_-]+$/i.test(value)) {
    throw new Error(`${flag} 仅允许简单类型名`);
  }

  if (value.length > 240) {
    throw new Error(`${flag} 的值过长`);
  }

  return value;
}

function validateRgArgs(args) {
  const normalizedArgs = [];
  const positionals = [];
  const noValueFlags = new Set([
    "-n",
    "--line-number",
    "-i",
    "--ignore-case",
    "-S",
    "--smart-case",
    "-F",
    "--fixed-strings",
    "--hidden",
    "--no-heading",
    "--heading",
    "--files"
  ]);
  const valueFlags = new Set([
    "--glob",
    "-g",
    "--max-count",
    "-m",
    "--context",
    "-C",
    "--before-context",
    "-B",
    "--after-context",
    "-A",
    "--type",
    "-t"
  ]);
  let filesMode = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      throw new Error("rg 当前不支持 -- 分隔符；请把搜索词作为普通参数传入");
    }

    if (noValueFlags.has(arg)) {
      normalizedArgs.push(arg);
      filesMode = filesMode || arg === "--files";
      continue;
    }

    const longFlagWithValue = arg.match(/^(--(?:glob|max-count|context|before-context|after-context|type))=(.+)$/);

    if (longFlagWithValue) {
      const [, flag, value] = longFlagWithValue;
      normalizedArgs.push(flag, validateRgValueFlag(flag, value));
      continue;
    }

    if (valueFlags.has(arg)) {
      normalizedArgs.push(arg, validateRgValueFlag(arg, args[index + 1]));
      index += 1;
      continue;
    }

    const shortContext = arg.match(/^-(A|B|C|m)(\d+)$/);

    if (shortContext) {
      const flag = shortContext[1] === "m" ? "-m" : `-${shortContext[1]}`;
      normalizedArgs.push(flag, validateRgValueFlag(flag, shortContext[2]));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`rg 参数不在白名单中：${arg}`);
    }

    positionals.push(arg);
  }

  if (filesMode) {
    if (positionals.length > 10) {
      throw new Error("rg --files 最多允许 10 个路径参数");
    }

    return [...normalizedArgs, ...positionals.map((entry) => resolveShellPath(entry))];
  }

  if (!positionals.length) {
    throw new Error("rg 需要搜索关键词");
  }

  const [pattern, ...paths] = positionals;

  if (pattern.length > 500) {
    throw new Error("rg 搜索关键词过长");
  }

  if (paths.length > 10) {
    throw new Error("rg 最多允许 10 个路径参数");
  }

  return [...normalizedArgs, pattern, ...paths.map((entry) => resolveShellPath(entry))];
}

function validateShellCommandArgs(command, args) {
  if (command === "curl") {
    return validateCurlArgs(args);
  }

  if (command === "rg") {
    return validateRgArgs(args);
  }

  if (command === "diff") {
    return validateDiffCommandArgs(args);
  }

  if (command === "file") {
    return validateFileCommandArgs(args);
  }

  if (command === "stat") {
    return validateStatCommandArgs(args);
  }

  if (command === "wc") {
    return validateWcArgs(args);
  }

  if (command === "head" || command === "tail") {
    return validateHeadTailArgs(command, args);
  }

  if (command === "sed") {
    return validateSedArgs(args);
  }

  throw new Error(`未实现命令校验：${command}`);
}

async function runShellCommand(argumentsObject) {
  const command = normalizeShellCommandName(argumentsObject?.command);
  const rawArgs = normalizeShellArgs(argumentsObject?.args);
  const cwd = resolveWorkspacePath(argumentsObject?.cwd || ".");
  const timeoutMs = clampInteger(
    argumentsObject?.timeoutMs,
    SHELL_COMMAND_TIMEOUT_MS,
    1_000,
    SHELL_COMMAND_MAX_TIMEOUT_MS
  );
  const args = validateShellCommandArgs(command, rawArgs);
  const result = await runProcess(command, args, {
    cwd,
    timeoutMs,
    maxOutputBytes: SHELL_OUTPUT_MAX_BYTES
  });
  const stdout = result.stdout.trimEnd();
  const stderr = result.stderr.trimEnd();

  return buildTextResult(
    [
      `command: ${command}`,
      `cwd: ${toRelativePath(cwd)}`,
      `exitCode: ${result.exitCode ?? "null"}`,
      result.signal ? `signal: ${result.signal}` : "",
      result.timedOut ? "timedOut: true" : "",
      result.stdoutTruncated ? "stdoutTruncated: true" : "",
      result.stderrTruncated ? "stderrTruncated: true" : "",
      stdout ? "\nstdout:" : "",
      stdout,
      stderr ? "\nstderr:" : "",
      stderr
    ]
      .filter((line) => line !== "")
      .join("\n"),
    {
      command,
      args,
      cwd: toRelativePath(cwd),
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      stdout,
      stderr,
      stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated
    }
  );
}

function getTools() {
  return [
    {
      name: "list_directory",
      description: "列出当前工作区或指定目录下的文件与子目录。",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的路径，默认 ."
          }
        }
      }
    },
    {
      name: "read_file",
      description: "读取指定文本文件，可选起止行号。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的文件路径"
          },
          startLine: {
            type: "integer",
            description: "起始行号，默认 1"
          },
          endLine: {
            type: "integer",
            description: "结束行号，默认最多返回 200 行"
          }
        }
      }
    },
    {
      name: "search_files",
      description: "在工作区文本文件中搜索关键词，返回匹配到的文件和行号。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description: "要搜索的关键词，按不区分大小写的纯文本匹配"
          },
          path: {
            type: "string",
            description: "可选，限定搜索目录"
          }
        }
      }
    },
    {
      name: "path_info",
      description: "查看指定路径是否存在、类型、大小和更新时间。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的路径"
          }
        }
      }
    },
    {
      name: "validate_json_file",
      description:
        "校验指定 JSON 文件是否能被正确解析，返回顶层类型、顶层字段/数组数量和文件大小；适合写入 book.json、chapters.json 或配置文件后做解析验证。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录或 Gordon 数据根的 JSON 文件路径"
          }
        }
      }
    },
    {
      name: "inspect_path",
      description: "更细致地检查文件或目录：文件会返回扩展名、文本判断和行数，目录会返回子项数量与样例列表。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的路径；访问工作区外路径时会触发授权流程"
          }
        }
      }
    },
    {
      name: "normalize_path",
      description: "将输入路径解析为工作区内的规范相对路径，并阻止越界路径。",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的路径，默认 ."
          }
        }
      }
    },
    {
      name: "join_path",
      description: "拼接路径片段，并返回工作区内的规范相对路径。",
      inputSchema: {
        type: "object",
        required: ["segments"],
        properties: {
          segments: {
            type: "array",
            items: {
              type: "string"
            },
            description: "要拼接的路径片段"
          }
        }
      }
    },
    {
      name: "relative_path",
      description: "计算两个工作区路径之间的相对路径。",
      inputSchema: {
        type: "object",
        required: ["fromPath", "toPath"],
        properties: {
          fromPath: {
            type: "string",
            description: "起始文件或目录路径"
          },
          toPath: {
            type: "string",
            description: "目标文件或目录路径"
          }
        }
      }
    },
    {
      name: "write_file",
      description: "创建、覆盖或追加文本文件内容。",
      inputSchema: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的文件路径"
          },
          content: {
            type: "string",
            description: "要写入的文本内容"
          },
          mode: {
            type: "string",
            description: "create、overwrite 或 append，默认 overwrite"
          },
          createDirectories: {
            type: "boolean",
            description: "是否自动创建上级目录"
          }
        }
      }
    },
    {
      name: "replace_in_file",
      description: "在指定文件中替换一段文本，适合小范围精确修改。",
      inputSchema: {
        type: "object",
        required: ["path", "findText", "replaceText"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的文件路径"
          },
          findText: {
            type: "string",
            description: "要查找的原始文本"
          },
          replaceText: {
            type: "string",
            description: "替换后的文本"
          },
          replaceAll: {
            type: "boolean",
            description: "是否替换所有匹配，默认 false"
          }
        }
      }
    },
    {
      name: "create_directory",
      description: "创建目录，支持递归创建父目录。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的目录路径"
          }
        }
      }
    },
    {
      name: "move_path",
      description: "移动或重命名文件、目录。",
      inputSchema: {
        type: "object",
        required: ["fromPath", "toPath"],
        properties: {
          fromPath: {
            type: "string",
            description: "源路径"
          },
          toPath: {
            type: "string",
            description: "目标路径"
          },
          createDirectories: {
            type: "boolean",
            description: "是否自动创建目标父目录"
          }
        }
      }
    },
    {
      name: "delete_path",
      description: "删除文件或目录；删除目录时可显式开启 recursive。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的目标路径"
          },
          recursive: {
            type: "boolean",
            description: "删除目录时是否递归删除"
          }
        }
      }
    },
    {
      name: "read_web_page",
      description: "读取一个 http(s) 网页正文，返回标题、描述、可读文本摘录和页面链接；适合在 web_search 找到 URL 后继续读取内容。",
      inputSchema: {
        type: "object",
        required: ["url"],
        properties: {
          url: {
            type: "string",
            description: "要读取的 http 或 https URL"
          },
          maxBytes: {
            type: "integer",
            description: "最多抓取字节数，默认 786432，上限 2097152"
          }
        }
      }
    },
    {
      name: "diff_paths",
      description: "对比两个工作区内文本文件，返回 unified diff；优先用于文件差异查看，避免直接执行 shell diff。",
      inputSchema: {
        type: "object",
        required: ["leftPath", "rightPath"],
        properties: {
          leftPath: {
            type: "string",
            description: "左侧文件路径"
          },
          rightPath: {
            type: "string",
            description: "右侧文件路径"
          },
          contextLines: {
            type: "integer",
            description: "diff 上下文行数，0-20，默认 3"
          }
        }
      }
    },
    {
      name: "web_search",
      description: "做基础联网搜索，适合查询实时信息、官网资料、新闻或当前网络内容；支持 auto、bing、baidu、google，返回标题、链接和摘要。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description: "搜索关键词"
          },
          engine: {
            type: "string",
            enum: ["auto", "bing", "baidu", "google"],
            description: "搜索引擎，可选 auto、bing、baidu、google，默认 auto；auto 会按 bing、baidu、google 兜底"
          },
          limit: {
            type: "integer",
            description: "最多返回结果数，1-10，默认 8"
          }
        }
      }
    },
    {
      name: "run_shell_command",
      description:
        "受限命令兜底工具，只允许 curl、rg、diff、file、stat、wc、head、tail、sed 的安全参数；不会通过 shell 执行，不支持管道、重定向或复合命令。",
      inputSchema: {
        type: "object",
        required: ["command"],
        properties: {
          command: {
            type: "string",
            enum: ["curl", "rg", "diff", "file", "stat", "wc", "head", "tail", "sed"],
            description: "要执行的白名单命令"
          },
          args: {
            type: "array",
            items: {
              type: "string"
            },
            description: "命令参数数组；路径参数会走工作区权限校验"
          },
          cwd: {
            type: "string",
            description: "执行目录，默认工作区根目录；访问工作区外目录时会触发授权流程"
          },
          timeoutMs: {
            type: "integer",
            description: "超时时间，1000-20000ms，默认 10000ms"
          }
        }
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
        name: "workspace-tools",
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

    if (toolName === "list_directory") {
      ok(id, await listDirectory(argumentsObject));
      return;
    }

    if (toolName === "read_file") {
      ok(id, await readFileContent(argumentsObject));
      return;
    }

    if (toolName === "search_files") {
      ok(id, await searchFiles(argumentsObject));
      return;
    }

    if (toolName === "path_info") {
      ok(id, await getPathInfo(argumentsObject));
      return;
    }

    if (toolName === "validate_json_file") {
      ok(id, await validateJsonFile(argumentsObject));
      return;
    }

    if (toolName === "inspect_path") {
      ok(id, await inspectPath(argumentsObject));
      return;
    }

    if (toolName === "normalize_path") {
      ok(id, await normalizePath(argumentsObject));
      return;
    }

    if (toolName === "join_path") {
      ok(id, await joinPath(argumentsObject));
      return;
    }

    if (toolName === "relative_path") {
      ok(id, await relativePath(argumentsObject));
      return;
    }

    if (toolName === "write_file") {
      ok(id, await writeFileContent(argumentsObject));
      return;
    }

    if (toolName === "replace_in_file") {
      ok(id, await replaceInFile(argumentsObject));
      return;
    }

    if (toolName === "create_directory") {
      ok(id, await createDirectory(argumentsObject));
      return;
    }

    if (toolName === "move_path") {
      ok(id, await movePath(argumentsObject));
      return;
    }

    if (toolName === "delete_path") {
      ok(id, await deletePath(argumentsObject));
      return;
    }

    if (toolName === "read_web_page") {
      ok(id, await readWebPage(argumentsObject));
      return;
    }

    if (toolName === "diff_paths") {
      ok(id, await diffPaths(argumentsObject));
      return;
    }

    if (toolName === "web_search") {
      ok(id, await webSearch(argumentsObject));
      return;
    }

    if (toolName === "run_shell_command") {
      ok(id, await runShellCommand(argumentsObject));
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

import {
  BUILTIN_COMIC_SKILL_ID,
  BUILTIN_APPLICATION_TOOLS_MCP_ID,
  BUILTIN_GORDON_AGENT_ID,
  BUILTIN_GORDON_TOOLS_MCP_ID
} from "../../lib/presenter.js";
import { didAgentMutateWorkbenchResources } from "../shell/workbenchRefreshDetection.js";

const MARKETPLACE_AGENT_APP_META = {
  comic: {
    appName: "丹青溢彩",
    skillHint: "comic planning / visual consistency / image generation tools",
    skillId: BUILTIN_COMIC_SKILL_ID,
    runningText: "Gordon 正在处理漫画任务..."
  },
  video: {
    appName: "流光绘影",
    skillHint: "video planning / shot prompt / generation tools",
    runningText: "Gordon 正在处理视频任务..."
  },
  music: {
    appName: "瑶琴映月",
    skillHint: "music production / lyric polish / music generation tools",
    runningText: "Gordon 正在处理音乐任务..."
  },
  fortune: {
    appName: "灵犀照命",
    skillHint: "fortune reading / reality calibration / attachment-aware conversation",
    runningText: "Gordon 正在处理解读任务..."
  }
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function compactText(value, maxLength = 220) {
  const text = normalizeText(value).replace(/\s+/g, " ");

  if (!text) {
    return "";
  }

  const chars = Array.from(text);
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join("")}...` : text;
}

function isWriteIntent(value) {
  return /保存|写入|写回|改写|修改|更新|替换|覆盖|落盘|同步|提交|应用到|放进项目|放进章节|直接改|直接写|更新到/u.test(
    normalizeText(value)
  );
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function isAbortError(error) {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? error ?? "");
  return name === "AbortError" || /abort|aborted|cancelled|canceled|停止|中断/u.test(message);
}

function createProgressEventId(appId) {
  return `marketplace_agent_${appId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeJson(value, maxLength = 12000) {
  try {
    const text = JSON.stringify(value ?? null, null, 2);
    return text.length > maxLength ? `${text.slice(0, maxLength)}\n...（已截断 ${text.length - maxLength} 字）` : text;
  } catch {
    return String(value ?? "");
  }
}

function normalizeAgentProgress(payload = {}, fallback = {}) {
  const now = new Date().toISOString();
  return {
    progressEventId: normalizeText(payload.progressEventId ?? fallback.progressEventId),
    appId: normalizeText(fallback.appId),
    phase: payload.phase ?? fallback.phase ?? "running",
    statusText: compactText(payload.statusText || fallback.statusText || "Gordon 正在处理应用任务...", 180),
    text: typeof payload.text === "string" ? payload.text : fallback.text ?? "",
    profileLabel: payload.profileLabel ?? fallback.profileLabel ?? null,
    model: payload.model ?? fallback.model ?? null,
    skillName: payload.skillName ?? fallback.skillName ?? null,
    autoSelectedMcp: Boolean(payload.autoSelectedMcp ?? fallback.autoSelectedMcp),
    mcpServerName: payload.mcpServerName ?? fallback.mcpServerName ?? null,
    mcpToolName: payload.mcpToolName ?? fallback.mcpToolName ?? null,
    mcpResultText: payload.mcpResultText ?? fallback.mcpResultText ?? null,
    mcpCalls: Array.isArray(payload.mcpCalls) ? [...payload.mcpCalls] : fallback.mcpCalls ?? [],
    stopReason: payload.stopReason ?? fallback.stopReason ?? "",
    taskLedger: payload.taskLedger ?? fallback.taskLedger ?? null,
    steps: Array.isArray(payload.steps) ? [...payload.steps] : fallback.steps ?? [],
    createdAt: payload.createdAt ?? fallback.createdAt ?? now,
    updatedAt: payload.updatedAt ?? fallback.updatedAt ?? now,
    ...(payload.tone || fallback.tone ? { tone: payload.tone ?? fallback.tone } : {})
  };
}

function extractGeneratedArtifacts(result) {
  const calls = Array.isArray(result?.mcpCalls) ? result.mcpCalls : [];
  return calls.flatMap((call) => (Array.isArray(call?.artifacts) ? call.artifacts : []));
}

function normalizeAgentImageArtifact(artifact, index = 0) {
  if (artifact?.kind !== "image") {
    return null;
  }

  const src = normalizeText(artifact.url || artifact.dataUrl);
  if (!src) {
    return null;
  }

  const provider = normalizeText(artifact.provider);
  const model = normalizeText(artifact.model);

  return {
    id: normalizeText(artifact.id) || `marketplace_agent_image_${index + 1}`,
    title: normalizeText(artifact.title) || `Gordon 生成图 ${index + 1}`,
    src,
    url: normalizeText(artifact.url),
    provider,
    model,
    prompt: normalizeText(artifact.prompt),
    meta: [provider, model].filter(Boolean).join(" / ")
  };
}

function normalizeAgentAudioArtifact(artifact) {
  if (artifact?.kind !== "audio") {
    return null;
  }

  const url = normalizeText(artifact.url || artifact.dataUrl);
  if (!url) {
    return null;
  }

  return {
    id: normalizeText(artifact.id),
    title: normalizeText(artifact.title),
    url,
    provider: normalizeText(artifact.provider),
    model: normalizeText(artifact.model),
    metadata: artifact.metadata && typeof artifact.metadata === "object" ? artifact.metadata : {}
  };
}

function findLatestMusicTaskId(result) {
  const calls = Array.isArray(result?.mcpCalls) ? result.mcpCalls : [];

  for (const call of [...calls].reverse()) {
    const structured = call?.structuredContent && typeof call.structuredContent === "object" ? call.structuredContent : null;
    const taskId = normalizeText(structured?.taskId || structured?.result?.task_id || structured?.result?.taskId);
    if (taskId) {
      return taskId;
    }
  }

  return "";
}

function buildAgentRunInput({ appId, appName, modeLabel, taskLabel, contextText, instruction, outputTarget, writeIntent }) {
  return [
    `你是 Gordon，正在应用广场「${appName}」里处理任务。`,
    "",
    "产品运行逻辑：",
    "- 快速模式：直接调用当前应用的轻量模型或工具，适合快速出草案。",
    "- Gordon 处理模式：由 Gordon Agent 主导目标理解、质量判断、状态连续性、风险控制和必要工具调用；工具只是操作能力，不替代 Gordon 决策。",
    "- 本轮属于 Gordon 处理模式，请先判断任务目标，再决定是否需要调用工具；不要把工具调用当作固定流程。",
    "",
    "当前任务：",
    `- 应用：${appName}`,
    `- 模块：${modeLabel || "当前工作区"}`,
    `- 动作：${taskLabel || "Gordon 处理"}`,
    `- 输出位置：${
      writeIntent
        ? outputTarget || "用户明确要求写回 / 修改应用资产；请使用 Application Tools 或可用 fallback 完成写入，并在写后读回验证。"
        : outputTarget || "输出到当前应用的预览/备注区域，不直接覆盖用户资产"
    }`,
    "",
    "当前上下文：",
    contextText || "暂无上下文",
    "",
    "用户补充要求：",
    instruction || "按当前项目状态推进，保证结果可直接用于下一步操作。",
    "",
    "输出要求：",
    "- 先给可直接使用的结果，不输出内部隐藏推理。",
    writeIntent
      ? "- 用户本轮有明确写回 / 修改意图：必须优先尝试通过 Application Tools 读取定位、dryRun=false 写回、再读回验证；没有成功工具结果前，不要把计划说成已完成。"
      : "- 若用户只是构思、评审或生成草案，优先输出到当前预览区，不主动覆盖应用资产。",
    "- 若调用了工具，简要说明工具产物和下一步可操作方式。",
    "- 若没有必要调用工具，给出高质量草案、提示词、规划或解读，并说明可如何落到快速工具按钮。",
    "- 不要要求用户手动复制到别处；结果会由 Gordon 回填到当前应用区域。"
  ].join("\n");
}

function buildRunRequest(input, toPlainIpcData, options = {}) {
  const runRequest = {
    agentProfileId: BUILTIN_GORDON_AGENT_ID,
    userInput: [
      input,
      "",
      "Gordon Runtime Hint：",
      `- preferredApplicationToolServer：${BUILTIN_APPLICATION_TOOLS_MCP_ID}`,
      `- preferredGenerationToolServer：${BUILTIN_GORDON_TOOLS_MCP_ID}`,
      options.applicationToolHint ? `- applicationToolHint：${options.applicationToolHint}` : "",
      "- Gordon 是主导决策层；Runtime 会从完整授权工具集中生成本轮 Planner 可见工具白名单，前端不做工具硬路由。",
      options.writeIntent
        ? "- 本轮用户明确要求保存 / 写入 / 改写应用资产：必须进入工具闭环，优先用应用语义工具写回并读回验证；若工具不可用或失败，再使用允许的 fallback，不要只输出“下一步应该做什么”。"
        : "",
      options.writeIntent
        ? "- 如果当前应用工具确实未覆盖目标写回能力，先尝试允许的 Workspace fallback；仍无法安全落盘时，明确报告阻塞和已验证事实，不要声称已完成。"
        : "- 如当前应用工具未覆盖写回能力，请仅输出到本轮预览结果，不要声称已经写回应用资产。"
    ].filter(Boolean).join("\n"),
    ...(options.skillId ? { skillId: options.skillId } : {}),
    autoSelectMcp: true
  };

  return typeof toPlainIpcData === "function" ? toPlainIpcData(runRequest) : JSON.parse(JSON.stringify(runRequest));
}

function normalizeProgressInlineText(value) {
  return String(value ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseToolNameFromStep(step) {
  return normalizeProgressInlineText(step?.detail).split(" / 参数：")[0]?.trim() || "";
}

function parseToolArgumentsFromStep(step) {
  return normalizeProgressInlineText(step?.detail).split(" / 参数：")[1]?.trim() || "";
}

function parseServerNameFromStep(step) {
  const detail = normalizeProgressInlineText(step?.detail);
  return detail.split("（")[0]?.trim() || detail.split("/")[0]?.trim() || "";
}

function getProgressStepTime(step, fallback = "") {
  return normalizeText(step?.createdAt) || fallback;
}

function isPermissionStep(step) {
  return [
    "workspace_permission_requested",
    "workspace_permission_granted",
    "workspace_permission_denied",
    "computer_use_permission_requested",
    "computer_use_permission_granted",
    "computer_use_permission_denied",
    "tool_permission_requested",
    "tool_permission_granted",
    "tool_permission_denied"
  ].includes(step?.type);
}

function getPermissionDomainLabel(step) {
  if (String(step?.type ?? "").startsWith("computer_use_")) {
    return "桌面控制";
  }

  if (String(step?.type ?? "").startsWith("tool_permission_")) {
    return "工具授权";
  }

  return "外部路径";
}

function getPermissionTag(step) {
  if (!isPermissionStep(step)) {
    return null;
  }

  if (String(step.type).endsWith("_requested")) {
    return {
      label: `${getPermissionDomainLabel(step)} · 待授权`,
      className: "is-waiting",
      detail: compactText(step.detail, 120),
      priority: 1
    };
  }

  if (String(step.type).endsWith("_granted")) {
    return {
      label: `${getPermissionDomainLabel(step)} · 已授权`,
      className: "is-done",
      detail: compactText(step.detail, 120),
      priority: 2
    };
  }

  return {
    label: `${getPermissionDomainLabel(step)} · 已拒绝`,
    className: "is-error",
    detail: compactText(step.detail, 120),
    priority: 3
  };
}

function getToolPermissionTags(steps, toolIndex = 0) {
  const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");
  const selectedStep = selectedToolSteps[toolIndex];

  if (!selectedStep) {
    return [];
  }

  const selectedStepIndex = steps.indexOf(selectedStep);
  const nextSelectedStep = selectedToolSteps[toolIndex + 1];
  const nextSelectedStepIndex = nextSelectedStep ? steps.indexOf(nextSelectedStep) : steps.length;
  const latestByDomain = new Map();

  for (const step of steps.slice(selectedStepIndex + 1, nextSelectedStepIndex)) {
    const tag = getPermissionTag(step);

    if (!tag) {
      continue;
    }

    latestByDomain.set(getPermissionDomainLabel(step), tag);
  }

  return Array.from(latestByDomain.values()).sort((left, right) => right.priority - left.priority);
}

function getToolTerminalStep(steps, toolIndex = 0) {
  const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");
  const selectedStep = selectedToolSteps[toolIndex];

  if (!selectedStep) {
    return null;
  }

  const selectedStepIndex = steps.indexOf(selectedStep);
  const nextSelectedStep = selectedToolSteps[toolIndex + 1];
  const nextSelectedStepIndex = nextSelectedStep ? steps.indexOf(nextSelectedStep) : steps.length;

  return (
    steps
      .slice(selectedStepIndex + 1, nextSelectedStepIndex)
      .reverse()
      .find((step) => step?.type === "mcp_tool_called" || step?.type === "mcp_tool_failed") ?? null
  );
}

function normalizeProgressTags(tags = []) {
  return tags
    .filter(Boolean)
    .map((tag) => (typeof tag === "string" ? { label: tag, className: "", detail: "" } : tag))
    .filter((tag) => normalizeText(tag.label));
}

function normalizeProgressVisibleSequence(items) {
  let toolStepIndex = 0;

  return items.map((item) => {
    if (item?.sequenceMode !== "tool") {
      return item;
    }

    toolStepIndex += 1;

    return {
      ...item,
      marker: `${toolStepIndex}`,
      label: `${item.label} · 步骤 ${toolStepIndex}`
    };
  });
}

function hasProgressRunningClass(item) {
  return String(item?.className ?? "")
    .split(/\s+/u)
    .includes("is-running");
}

function normalizeProgressRunningState(items) {
  const latestIndex = items.length - 1;

  return items.map((item, index) => {
    if (index === latestIndex || !hasProgressRunningClass(item)) {
      return item;
    }

    return {
      ...item,
      className: String(item.className ?? "")
        .split(/\s+/u)
        .filter((token) => token && token !== "is-running")
        .join(" ")
    };
  });
}

export function createMarketplaceAgentActions({
  appContextProviders = {},
  createLocalId,
  desktopApi,
  refreshWorkbenchSnapshot,
  resultHandlers = {},
  setStatus,
  toPlainIpcData,
  ui
}) {
  let activeProgressEventId = "";

  function setAppBusy(appId, isBusy) {
    if (appId === "comic") {
      ui.marketplace.comic.isAiRunning = Boolean(isBusy);
    } else if (appId === "video") {
      ui.marketplace.video.isGenerating = Boolean(isBusy);
    } else if (appId === "music") {
      ui.marketplace.music.isGenerating = Boolean(isBusy);
    } else if (appId === "fortune") {
      ui.marketplace.fortune.isGenerating = Boolean(isBusy);
    }
  }

  function setAppFeedback(appId, text, tone = "neutral") {
    if (appId === "comic") {
      ui.marketplace.comic.aiFeedback = normalizeText(text);
      ui.marketplace.comic.aiFeedbackTone = tone;
    } else if (appId === "video") {
      ui.marketplace.video.feedback = normalizeText(text);
      ui.marketplace.video.feedbackTone = tone;
    } else if (appId === "music") {
      ui.marketplace.music.feedback = normalizeText(text);
      ui.marketplace.music.feedbackTone = tone;
    } else if (appId === "fortune") {
      ui.marketplace.fortune.feedback = normalizeText(text);
      ui.marketplace.fortune.feedbackTone = tone;
    }
  }

  function ensureAgentState() {
    if (!ui.marketplace.agent || typeof ui.marketplace.agent !== "object") {
      ui.marketplace.agent = {
        activeAppId: "",
        activeProgressEventId: "",
        progress: null
      };
    }

    return ui.marketplace.agent;
  }

  function setProgress(progress) {
    ensureAgentState().progress = progress;
  }

  function startProgress(appId, progressEventId, statusText) {
    const state = ensureAgentState();
    state.activeAppId = appId;
    state.activeProgressEventId = progressEventId;
    setProgress(
      normalizeAgentProgress(
        {},
        {
          appId,
          progressEventId,
          statusText,
          steps: [
            {
              id: `${progressEventId}_selected`,
              type: "agent_selected",
              title: "已交给 Gordon",
              detail: "Gordon 将根据目标、上下文和工具集合决定处理方式。",
              createdAt: new Date().toISOString()
            }
          ]
        }
      )
    );
  }

  function finalizeProgress(phase, statusText, extra = {}) {
    const current = ensureAgentState().progress;
    if (!current?.progressEventId) {
      return;
    }

    setProgress(
      normalizeAgentProgress(
        {
          ...current,
          ...extra,
          phase,
          statusText,
          updatedAt: new Date().toISOString()
        },
        current
      )
    );
  }

  function handleMarketplaceAgentRunProgress(payload) {
    const state = ensureAgentState();
    const progressEventId = normalizeText(payload?.progressEventId);

    if (!progressEventId || (progressEventId !== activeProgressEventId && progressEventId !== state.activeProgressEventId)) {
      return;
    }

    setProgress(normalizeAgentProgress(payload, { appId: state.activeAppId, progressEventId }));
  }

  function getMarketplaceAgentProgress(appId = "") {
    const progress = ensureAgentState().progress;
    const normalizedAppId = normalizeText(appId);

    if (!progress) {
      return null;
    }

    if (normalizedAppId && progress.appId !== normalizedAppId) {
      return null;
    }

    return progress;
  }

  function getMarketplaceAgentProgressItems(progress = ensureAgentState().progress) {
    if (!progress) {
      return [];
    }

    const steps = Array.isArray(progress.steps) ? progress.steps : [];
    const calls = Array.isArray(progress.mcpCalls) ? progress.mcpCalls : [];
    const phase = progress.phase ?? "running";
    const isRunning = phase === "running";
    const contextStep = steps.find((step) => step?.type === "agent_selected") ?? steps[0] ?? null;
    const modelStep = steps.find((step) => step?.type === "model_selected");
    const skillStep = steps.find((step) => step?.type === "skill_selected");
    const authorizedStep = [...steps].reverse().find((step) => step?.type === "mcp_authorized");
    const selectedToolSteps = steps.filter((step) => step?.type === "mcp_tool_selected");
    const hasRuntimeWork = Boolean(
      steps.some((step) =>
        [
          "mcp_auto_planning",
          "mcp_args_repaired",
          "mcp_retrying",
          "mcp_fallback_planned",
          "mcp_fallback_selected",
          "mcp_auto_stopped",
          "mcp_tool_selected",
          "mcp_tool_called",
          "mcp_tool_failed",
          "skill_handler_started",
          "skill_handler_completed",
          "skill_handler_failed",
          "model_invoked",
          "completed"
        ].includes(step?.type)
      ) || calls.length || progress.text || phase !== "running"
    );
    const timelineItems = [];

    timelineItems.push({
      id: `marketplace_agent_context_${progress.progressEventId}`,
      kind: "context",
      marker: "识",
      label: "上下文",
      title: "上下文就绪",
      detail: compactText(
        [
          progress.profileLabel ? `Agent：${progress.profileLabel}` : contextStep?.detail,
          progress.model || modelStep?.detail ? `模型：${progress.model || modelStep?.detail}` : "",
          progress.skillName || skillStep?.detail ? `Skill：${progress.skillName || skillStep?.detail}` : "",
          authorizedStep?.detail ? `工具：${authorizedStep.detail}` : ""
        ]
          .filter(Boolean)
          .join(" / ") || "已建立应用上下文",
        180
      ),
      tags: normalizeProgressTags(["Gordon", progress.skillName ? "Skill" : "Agent"].filter(Boolean)),
      className: hasRuntimeWork ? "is-context is-completed" : "is-context is-running",
      createdAt: progress.createdAt || contextStep?.createdAt || "",
      sortIndex: -1
    });

    steps.forEach((step, index) => {
      const detail = compactText(step.detail || progress.statusText, 180);
      const createdAt = getProgressStepTime(step, progress.updatedAt || "");

      if (step.type === "mcp_auto_planning") {
        timelineItems.push({
          id: step.id ?? `marketplace_agent_plan_${progress.progressEventId}_${index}`,
          kind: "plan",
          marker: "判",
          label: /主动验证/u.test(step.title ?? "") ? "验证规划" : "规划",
          title: step.title || "规划下一步",
          detail,
          tags: normalizeProgressTags(["Gordon 判断"]),
          className: "is-plan is-running",
          createdAt,
          sortIndex: index
        });
        return;
      }

      if (step.type === "mcp_args_repaired") {
        timelineItems.push({
          id: step.id ?? `marketplace_agent_repair_${progress.progressEventId}_${index}`,
          kind: "adjust",
          marker: "调",
          label: "调整",
          title: "修正工具参数",
          detail,
          tags: normalizeProgressTags(["参数修复"]),
          className: "is-adjust is-running",
          createdAt,
          sortIndex: index
        });
        return;
      }

      if (step.type === "mcp_retrying") {
        timelineItems.push({
          id: step.id ?? `marketplace_agent_retry_${progress.progressEventId}_${index}`,
          kind: "adjust",
          marker: "重",
          label: "重试",
          title: "工具调用重试",
          detail,
          tags: normalizeProgressTags(["恢复"]),
          className: "is-adjust is-running",
          createdAt,
          sortIndex: index
        });
        return;
      }

      if (step.type === "mcp_fallback_planned" || step.type === "mcp_fallback_selected") {
        timelineItems.push({
          id: step.id ?? `marketplace_agent_fallback_${progress.progressEventId}_${index}`,
          kind: "recover",
          marker: "换",
          label: "恢复策略",
          title: step.title || "切换备用工具",
          detail,
          tags: normalizeProgressTags(["fallback"]),
          className: "is-recover is-running",
          createdAt,
          sortIndex: index
        });
        return;
      }

      if (step.type === "mcp_auto_stopped") {
        const hasFailure = /失败|停止|拒绝|重复|最大/u.test(`${step.title ?? ""} ${step.detail ?? ""}`);

        if (!hasFailure && !calls.length) {
          return;
        }

        timelineItems.push({
          id: step.id ?? `marketplace_agent_stop_${progress.progressEventId}_${index}`,
          kind: "reflect",
          marker: hasFailure ? "!" : "判",
          label: hasFailure ? "复盘" : "继续判断",
          title: step.title || "工具规划完成",
          detail,
          tags: normalizeProgressTags([hasFailure ? "需关注" : "判断完成"]),
          className: hasFailure ? "is-reflect is-error" : "is-reflect",
          createdAt,
          sortIndex: index
        });
        return;
      }

      if (step.type === "skill_handler_started" || step.type === "skill_handler_completed" || step.type === "skill_handler_failed") {
        const failed = step.type === "skill_handler_failed";
        const started = step.type === "skill_handler_started";

        timelineItems.push({
          id: step.id ?? `marketplace_agent_skill_${progress.progressEventId}_${index}`,
          kind: "execute",
          marker: failed ? "!" : "执",
          label: "执行 Skill",
          title: step.title || (failed ? "Skill Handler 执行失败" : "Skill Handler 执行"),
          detail,
          tags: normalizeProgressTags(["Skill"]),
          className: `is-execute ${failed ? "is-error" : started ? "is-running" : "is-completed"}`,
          createdAt,
          sortIndex: index
        });
        return;
      }

      if (step.type === "model_invoked") {
        timelineItems.push({
          id: step.id ?? `marketplace_agent_model_${progress.progressEventId}_${index}`,
          kind: "final",
          marker: "答",
          label: "整理",
          title: "整理最终答复",
          detail: detail || "工具输出已经汇总，正在生成最终回复。",
          tags: normalizeProgressTags(["输出"]),
          className: "is-final is-running",
          createdAt,
          sortIndex: index
        });
        return;
      }

      if (step.type === "completed") {
        timelineItems.push({
          id: step.id ?? `marketplace_agent_completed_${progress.progressEventId}_${index}`,
          kind: "final",
          marker: "成",
          label: "完成",
          title: "本轮处理完成",
          detail,
          tags: normalizeProgressTags(["完成"]),
          className: "is-final is-completed",
          createdAt,
          sortIndex: index
        });
      }
    });

    calls.forEach((call, index) => {
      const selectedStep = selectedToolSteps[index] ?? null;
      const terminalStep = getToolTerminalStep(steps, index);
      const tags = normalizeProgressTags([
        call.autoSelected ? "自动工具" : "",
        call.repairReason ? "参数修复" : "",
        call.recovered ? "已恢复" : "",
        call.fallbackFromToolName ? "fallback" : "",
        ...getToolPermissionTags(steps, index)
      ]);
      const output = compactText(call.resultText, 260);
      const detailParts = [];

      if (selectedStep) {
        const argumentText = parseToolArgumentsFromStep(selectedStep);
        if (argumentText) {
          detailParts.push(`参数：${compactText(argumentText, 180)}`);
        }
      }

      if (call.expectedOutcome) {
        detailParts.push(`预期：${compactText(call.expectedOutcome, 120)}`);
      }

      if (call.failureReason) {
        detailParts.push(compactText(call.failureReason, 140));
      }

      timelineItems.push({
        id: selectedStep?.id ? `${selectedStep.id}_marketplace_tool` : `marketplace_agent_tool_${progress.progressEventId}_${index}`,
        kind: "execute",
        sequenceMode: "tool",
        marker: `${index + 1}`,
        label: call.isError ? "执行失败" : "执行",
        title: `${call.serverName || parseServerNameFromStep(steps.find((step) => step?.type === "mcp_server_selected")) || "工具服务"} / ${call.toolName || parseToolNameFromStep(selectedStep) || "工具"}`,
        detail: detailParts.join(" · "),
        tags,
        output,
        outputLabel: call.isError ? "错误输出" : "中间输出",
        className: call.isError ? "is-execute is-error" : "is-execute is-completed",
        createdAt: terminalStep?.createdAt || call.createdAt || selectedStep?.createdAt || progress.updatedAt || "",
        sortIndex: steps.indexOf(terminalStep ?? selectedStep ?? null)
      });
    });

    if (selectedToolSteps.length > calls.length) {
      const selectedStep = selectedToolSteps[selectedToolSteps.length - 1];
      const selectedStepIndex = steps.indexOf(selectedStep);
      const serverStep = steps
        .slice(0, selectedStepIndex)
        .reverse()
        .find((step) => step?.type === "mcp_server_selected");
      const tags = normalizeProgressTags(getToolPermissionTags(steps, selectedToolSteps.length - 1));
      const denied = tags.some((tag) => tag.className === "is-error");

      timelineItems.push({
        id: `${selectedStep?.id ?? "pending_tool"}_marketplace_pending_tool`,
        kind: "execute",
        sequenceMode: "tool",
        marker: `${calls.length + 1}`,
        label: denied ? "执行受阻" : "执行中",
        title: `${parseServerNameFromStep(serverStep) || "工具服务"} / ${parseToolNameFromStep(selectedStep) || "工具"}`,
        detail: parseToolArgumentsFromStep(selectedStep)
          ? `参数：${compactText(parseToolArgumentsFromStep(selectedStep), 180)}`
          : "参数已确定，正在等待工具返回。",
        tags,
        output: denied ? "授权被拒绝，Gordon 会调整路线或停止当前工具调用。" : "工具正在运行，返回后会把中间输出接在这里。",
        outputLabel: denied ? "授权状态" : "中间输出",
        className: denied ? "is-execute is-error" : "is-execute is-running",
        createdAt: selectedStep?.createdAt || progress.updatedAt || "",
        sortIndex: selectedStepIndex
      });
    }

    if (isRunning && timelineItems.length <= 1) {
      timelineItems.push({
        id: `marketplace_agent_waiting_${progress.progressEventId}`,
        kind: "plan",
        marker: "判",
        label: "规划",
        title: "等待 Gordon 推进",
        detail: compactText(progress.statusText || "正在判断是否需要工具", 150),
        tags: normalizeProgressTags(["处理中"]),
        className: "is-plan is-running",
        createdAt: progress.updatedAt || "",
        sortIndex: 0
      });
    }

    if (phase === "completed" && !timelineItems.some((item) => item.kind === "final" && item.label === "完成")) {
      timelineItems.push({
        id: `marketplace_agent_final_${progress.progressEventId}`,
        kind: "final",
        marker: "成",
        label: "完成",
        title: "结果已回填",
        detail: "Gordon 处理结果已进入当前应用区域。",
        tags: normalizeProgressTags(["完成"]),
        className: "is-final is-completed",
        createdAt: progress.updatedAt || "",
        sortIndex: steps.length + calls.length + 1
      });
    }

    if (phase === "failed") {
      timelineItems.push({
        id: `marketplace_agent_failed_${progress.progressEventId}`,
        kind: "reflect",
        marker: "!",
        label: progress.tone === "warning" ? "停止" : "失败",
        title: progress.tone === "warning" ? "处理已停止" : "处理失败",
        detail: compactText(progress.stopReason || progress.statusText, 150),
        tags: normalizeProgressTags([progress.tone === "warning" ? "已停止" : "失败"]),
        className: progress.tone === "warning" ? "is-reflect is-warning" : "is-reflect is-error",
        createdAt: progress.updatedAt || "",
        sortIndex: steps.length + calls.length + 2
      });
    }

    const visibleItems = timelineItems.sort((left, right) => {
      const leftSortIndex = left.sortIndex;
      const rightSortIndex = right.sortIndex;

      if (leftSortIndex >= 0 && rightSortIndex >= 0 && leftSortIndex !== rightSortIndex) {
        return leftSortIndex - rightSortIndex;
      }

      return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    });

    return normalizeProgressVisibleSequence(normalizeProgressRunningState(visibleItems));
  }

  async function cancelMarketplaceAgentRun() {
    const progressEventId = activeProgressEventId || ensureAgentState().activeProgressEventId;
    if (!progressEventId || !desktopApi?.cancelAgentRun) {
      return;
    }

    await desktopApi.cancelAgentRun(progressEventId).catch((error) => {
      console.warn("Failed to cancel marketplace agent request", error);
    });
  }

  async function runMarketplaceAgentTask(appId, options = {}) {
    const meta = MARKETPLACE_AGENT_APP_META[appId] ?? {
      appName: options.appName || "应用广场",
      skillHint: "application workflow",
      runningText: "Gordon 正在处理应用任务..."
    };
    const provider = appContextProviders[appId];
    const state = ensureAgentState();

    if (state.activeProgressEventId) {
      return;
    }

    if (!desktopApi?.runAgent) {
      (options.setFeedback ?? ((text, tone) => setAppFeedback(appId, text, tone)))("Gordon Agent 桥接未就绪。", "danger");
      return;
    }

    const context = typeof provider === "function" ? provider(options) : null;
    const contextText = normalizeText(context?.contextText || options.contextText);
    const instruction = context?.instruction ?? options.instruction;
    const writeIntent = Boolean(
      options.writeIntent ??
        context?.writeIntent ??
        (isWriteIntent(instruction) || isWriteIntent(options.taskLabel) || isWriteIntent(context?.taskLabel))
    );

    if (!contextText) {
      (options.setFeedback ?? ((text, tone) => setAppFeedback(appId, text, tone)))("当前应用上下文不足，无法交给 Gordon 处理。", "warning");
      return;
    }

    const progressEventId = createProgressEventId(appId);
    const input = buildAgentRunInput({
      appId,
      appName: context?.appName || meta.appName,
      modeLabel: context?.modeLabel || options.modeLabel,
      taskLabel: context?.taskLabel || options.taskLabel,
      contextText,
      instruction,
      outputTarget: writeIntent
        ? context?.writeOutputTarget ?? options.writeOutputTarget
        : context?.outputTarget ?? options.outputTarget,
      writeIntent
    });
    const runRequest = buildRunRequest(input, toPlainIpcData, {
      skillId: options.skillId ?? meta.skillId,
      applicationToolHint: options.applicationToolHint ?? context?.applicationToolHint,
      writeIntent
    });

    try {
      activeProgressEventId = progressEventId;
      state.activeAppId = appId;
      state.activeProgressEventId = progressEventId;
      startProgress(appId, progressEventId, meta.runningText);
      (options.setBusy ?? ((isBusy) => setAppBusy(appId, isBusy)))(true);
      (options.setFeedback ?? ((text, tone) => setAppFeedback(appId, text, tone)))("Gordon 正在接管处理...", "neutral");
      setStatus?.(`${meta.appName}正在交给 Gordon 处理。`, "neutral");

      const result = await desktopApi.runAgent({
        ...runRequest,
        progressEventId
      });

      const output = normalizeText(result?.text) || normalizeText(result?.mcpResultText) || "Gordon 已完成处理，但没有返回可展示文本。";
      const artifacts = extractGeneratedArtifacts(result);
      const handler = resultHandlers[appId];

      if (typeof handler === "function") {
        handler({ result, output, artifacts, context, options });
      }

      if (typeof refreshWorkbenchSnapshot === "function" && didAgentMutateWorkbenchResources(result)) {
        await refreshWorkbenchSnapshot();
      }

      finalizeProgress("completed", "Gordon 已完成处理。", {
        text: output,
        profileLabel: result?.profileLabel ?? state.progress?.profileLabel ?? null,
        model: result?.model ?? state.progress?.model ?? null,
        skillName: result?.skillName ?? state.progress?.skillName ?? null,
        mcpResultText: result?.mcpResultText ?? state.progress?.mcpResultText ?? null,
        mcpCalls: Array.isArray(result?.mcpCalls) ? result.mcpCalls : state.progress?.mcpCalls ?? [],
        stopReason: result?.stopReason ?? state.progress?.stopReason ?? "",
        taskLedger: result?.taskLedger ?? state.progress?.taskLedger ?? null,
        steps: Array.isArray(result?.steps) ? result.steps : state.progress?.steps ?? [],
        updatedAt: result?.updatedAt ?? new Date().toISOString()
      });
      (options.setFeedback ?? ((text, tone) => setAppFeedback(appId, text, tone)))("Gordon 处理完成，结果已回填。", "success");
      setStatus?.(`${meta.appName}Gordon 处理已完成。`, "success");
    } catch (error) {
      console.error("Failed to run marketplace agent task", error);
      const message = getErrorMessage(error);
      const stopped = isAbortError(error);
      finalizeProgress("failed", stopped ? "Gordon 处理已停止。" : `Gordon 处理失败：${message}`, {
        tone: stopped ? "warning" : "danger",
        stopReason: stopped ? "用户停止了本轮 Gordon 处理。" : message
      });
      (options.setFeedback ?? ((text, tone) => setAppFeedback(appId, text, tone)))(stopped ? "Gordon 处理已停止。" : `Gordon 处理失败：${message}`, stopped ? "warning" : "danger");
      setStatus?.(stopped ? `${meta.appName}Gordon 处理已停止。` : `${meta.appName}Gordon 处理失败：${message}`, stopped ? "warning" : "danger");
    } finally {
      (options.setBusy ?? ((isBusy) => setAppBusy(appId, isBusy)))(false);
      activeProgressEventId = "";
      state.activeProgressEventId = "";
    }
  }

  return {
    cancelMarketplaceAgentRun,
    getMarketplaceAgentProgress,
    getMarketplaceAgentProgressItems,
    handleMarketplaceAgentRunProgress,
    normalizeAgentAudioArtifact,
    normalizeAgentImageArtifact,
    runMarketplaceAgentTask,
    sanitizeJson,
    findLatestMusicTaskId
  };
}

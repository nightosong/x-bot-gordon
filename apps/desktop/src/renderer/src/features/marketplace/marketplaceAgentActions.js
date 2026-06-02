import {
  BUILTIN_APPLICATION_TOOLS_MCP_ID,
  BUILTIN_GORDON_AGENT_ID,
  BUILTIN_GORDON_TOOLS_MCP_ID
} from "../../lib/presenter.js";

const MARKETPLACE_AGENT_APP_META = {
  comic: {
    appName: "丹青溢彩",
    skillHint: "comic planning / visual consistency / image generation tools",
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

function buildAgentRunInput({ appId, appName, modeLabel, taskLabel, contextText, instruction, outputTarget }) {
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
    `- 输出位置：${outputTarget || "输出到当前应用的预览/备注区域，不直接覆盖用户资产"}`,
    "",
    "当前上下文：",
    contextText || "暂无上下文",
    "",
    "用户补充要求：",
    instruction || "按当前项目状态推进，保证结果可直接用于下一步操作。",
    "",
    "输出要求：",
    "- 先给可直接使用的结果，不输出内部隐藏推理。",
    "- 若调用了工具，简要说明工具产物和下一步可操作方式。",
    "- 若没有必要调用工具，给出高质量草案、提示词、规划或解读，并说明可如何落到快速工具按钮。",
    "- 不要要求用户手动复制到别处；结果会由 Gordon 回填到当前应用区域。"
  ].join("\n");
}

function buildRunRequest(input, toPlainIpcData) {
  const runRequest = {
    agentProfileId: BUILTIN_GORDON_AGENT_ID,
    userInput: [
      input,
      "",
      "Gordon Runtime Hint：",
      `- preferredApplicationToolServer：${BUILTIN_APPLICATION_TOOLS_MCP_ID}`,
      `- preferredGenerationToolServer：${BUILTIN_GORDON_TOOLS_MCP_ID}`,
      "- Gordon 是主导决策层；工具集合完整授权后交给模型判断，不要用前端硬规则裁剪候选工具。",
      "- 如当前应用工具未覆盖写回能力，请仅输出到本轮预览结果，不要声称已经写回应用资产。"
    ].join("\n"),
    autoSelectMcp: true
  };

  return typeof toPlainIpcData === "function" ? toPlainIpcData(runRequest) : JSON.parse(JSON.stringify(runRequest));
}

export function createMarketplaceAgentActions({
  appContextProviders = {},
  createLocalId,
  desktopApi,
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
    const items = [];
    const contextStep = steps.find((step) => step?.type === "agent_selected") ?? steps[0] ?? null;
    const planningStep = [...steps]
      .reverse()
      .find((step) => ["planning", "tool_planned", "tool_selected", "tool_plan_critic"].includes(step?.type));
    const toolSteps = steps.filter((step) => ["tool_started", "tool_completed", "tool_failed", "tool_fallback"].includes(step?.type));
    const skillStep = [...steps].reverse().find((step) => String(step?.type ?? "").startsWith("skill_handler"));

    items.push({
      id: `marketplace_agent_context_${progress.progressEventId}`,
      marker: "1",
      title: "上下文就绪",
      detail: compactText(progress.profileLabel ? `Agent：${progress.profileLabel}` : contextStep?.detail || "已建立应用上下文", 150),
      tags: ["Gordon", "Agent"].filter(Boolean),
      className: progress.phase === "failed" ? "is-warning" : "is-completed"
    });

    if (planningStep) {
      items.push({
        id: planningStep.id ?? `marketplace_agent_planning_${progress.progressEventId}`,
        marker: String(items.length + 1),
        title: planningStep.title || "规划下一步",
        detail: compactText(planningStep.detail || progress.statusText, 150),
        tags: ["规划"],
        className: progress.phase === "failed" ? "is-warning" : "is-completed"
      });
    } else if (progress.phase === "running") {
      items.push({
        id: `marketplace_agent_waiting_${progress.progressEventId}`,
        marker: String(items.length + 1),
        title: "等待 Gordon 推进",
        detail: compactText(progress.statusText || "正在判断是否需要工具", 150),
        tags: ["处理中"],
        className: "is-running"
      });
    }

    toolSteps.slice(-3).forEach((step) => {
      items.push({
        id: step.id ?? `marketplace_agent_tool_${progress.progressEventId}_${items.length}`,
        marker: String(items.length + 1),
        title: step.title || "工具处理",
        detail: compactText(step.detail, 150),
        tags: ["工具"],
        className:
          step.type === "tool_failed"
            ? "is-error"
            : step.type === "tool_fallback"
              ? "is-warning"
              : step.type === "tool_started"
                ? "is-running"
                : "is-completed"
      });
    });

    if (skillStep) {
      items.push({
        id: skillStep.id ?? `marketplace_agent_skill_${progress.progressEventId}`,
        marker: String(items.length + 1),
        title: skillStep.title || "Skill 处理",
        detail: compactText(skillStep.detail, 150),
        tags: ["Skill"],
        className: skillStep.type === "skill_handler_failed" ? "is-error" : "is-completed"
      });
    }

    if (progress.phase === "completed") {
      items.push({
        id: `marketplace_agent_final_${progress.progressEventId}`,
        marker: String(items.length + 1),
        title: "结果已回填",
        detail: "Gordon 处理结果已进入当前应用区域。",
        tags: ["完成"],
        className: "is-completed"
      });
    }

    if (progress.phase === "failed") {
      items.push({
        id: `marketplace_agent_failed_${progress.progressEventId}`,
        marker: String(items.length + 1),
        title: progress.tone === "warning" ? "处理已停止" : "处理失败",
        detail: compactText(progress.stopReason || progress.statusText, 150),
        tags: [progress.tone === "warning" ? "已停止" : "失败"],
        className: progress.tone === "warning" ? "is-warning" : "is-error"
      });
    }

    return items.slice(0, 6);
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
      instruction: context?.instruction ?? options.instruction,
      outputTarget: context?.outputTarget ?? options.outputTarget
    });
    const runRequest = buildRunRequest(input, toPlainIpcData);

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

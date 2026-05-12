const MARKETPLACE_FIELD_AI_SYSTEM_PROMPT = `你是 Gordon 应用广场的字段级文本优化助手。
你只服务当前一个编辑框：根据字段用途、上下文和用户要求，生成可以直接填回该字段的正文。
不要输出解释、寒暄、代码块包裹或“以下是”等前后缀。
保留用户已有的关键事实、名称、约束和语气；需要补全时只补与当前应用和字段强相关的内容，不编造外部事实。
如果字段是提示词，请输出更清晰、可执行的提示词；如果字段是故事、分镜、设定或草案，请输出结构更稳、信息更完整的正文。`;

function normalizeFieldAiText(value) {
  return String(value ?? "").trim();
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function buildAppendText(currentText, outputText) {
  const current = String(currentText ?? "").trimEnd();
  const output = String(outputText ?? "").trim();

  if (!current) {
    return output;
  }

  return `${current}\n\n${output}`;
}

export function createMarketplaceFieldAiActions({ createLocalId, desktopApi, setStatus, ui }) {
  let activeTarget = null;

  function getState() {
    return ui.marketplace.fieldAi;
  }

  function getActiveTargetValue() {
    if (typeof activeTarget?.getValue === "function") {
      return String(activeTarget.getValue() ?? "");
    }

    return String(getState().sourceText ?? "");
  }

  function setFieldAiFeedback(text, tone = "neutral") {
    const state = getState();
    state.feedback = normalizeFieldAiText(text);
    state.feedbackTone = tone;
  }

  function openMarketplaceFieldAi(target = {}) {
    const fieldId = normalizeFieldAiText(target.fieldId ?? target.id);

    if (!fieldId) {
      return;
    }

    const state = getState();
    const isSameTarget = state.targetId === fieldId;
    const value = typeof target.getValue === "function" ? target.getValue() : target.value;

    activeTarget = {
      fieldId,
      appName: normalizeFieldAiText(target.appName) || "应用广场",
      fieldLabel: normalizeFieldAiText(target.label) || "当前字段",
      context: normalizeFieldAiText(target.context),
      getValue: target.getValue,
      setValue: target.setValue
    };

    state.isOpen = true;
    state.targetId = fieldId;
    state.appName = activeTarget.appName;
    state.fieldLabel = activeTarget.fieldLabel;
    state.context = activeTarget.context;
    state.sourceText = String(value ?? "");

    if (!isSameTarget) {
      state.instruction = "";
      state.output = "";
      setFieldAiFeedback("", "neutral");
    }
  }

  function closeMarketplaceFieldAi() {
    const state = getState();

    if (state.isGenerating && state.requestId && desktopApi?.cancelModelText) {
      void desktopApi.cancelModelText(state.requestId);
    }

    activeTarget = null;
    state.isOpen = false;
    state.targetId = "";
    state.appName = "";
    state.fieldLabel = "";
    state.context = "";
    state.sourceText = "";
    state.requestId = "";
    state.isGenerating = false;
  }

  function setMarketplaceFieldAiInstruction(value) {
    getState().instruction = String(value ?? "");
  }

  function setMarketplaceFieldAiOutput(value) {
    getState().output = String(value ?? "");
  }

  function buildMarketplaceFieldAiPrompt() {
    const state = getState();
    const sourceText = normalizeFieldAiText(getActiveTargetValue()) || "当前字段为空，请根据上下文和用户要求生成可直接填写的内容。";
    const instruction = normalizeFieldAiText(state.instruction) || "优化表达、补齐结构、提升可执行性，保持原有意图。";
    const context = normalizeFieldAiText(activeTarget?.context ?? state.context) || "未提供额外上下文。";

    return [
      `应用：${activeTarget?.appName || state.appName || "应用广场"}`,
      `字段：${activeTarget?.fieldLabel || state.fieldLabel || "当前字段"}`,
      "",
      "当前字段内容：",
      sourceText,
      "",
      "附近上下文：",
      context,
      "",
      "用户优化要求：",
      instruction,
      "",
      "请只输出要写入该字段的最终内容。"
    ].join("\n");
  }

  async function generateMarketplaceFieldAiOutput() {
    const state = getState();

    if (state.isGenerating) {
      return;
    }

    if (!activeTarget) {
      setFieldAiFeedback("请先选择一个编辑框。", "warning");
      return;
    }

    if (!desktopApi?.invokeModelText) {
      setFieldAiFeedback("AI 桥接未就绪。", "danger");
      return;
    }

    const requestId =
      typeof createLocalId === "function"
        ? createLocalId("marketplace_field_ai_request")
        : `marketplace_field_ai_request_${Date.now()}`;

    try {
      state.isGenerating = true;
      state.requestId = requestId;
      state.output = "";
      state.sourceText = getActiveTargetValue();
      setFieldAiFeedback("正在优化...", "neutral");
      setStatus(`${activeTarget.appName}正在优化「${activeTarget.fieldLabel}」。`, "neutral");

      const result = await desktopApi.invokeModelText({
        requestId,
        temperature: 0.68,
        maxOutputTokens: 2200,
        messages: [
          {
            role: "system",
            content: MARKETPLACE_FIELD_AI_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildMarketplaceFieldAiPrompt()
          }
        ]
      });

      if (state.requestId !== requestId) {
        return;
      }

      const output = normalizeFieldAiText(result?.text);

      if (!output) {
        setFieldAiFeedback("模型没有返回可写入内容。", "warning");
        return;
      }

      state.output = output;
      setFieldAiFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "优化结果已生成。", "success");
      setStatus(`${activeTarget.appName}已生成字段优化结果。`, "success");
    } catch (error) {
      if (state.requestId !== requestId) {
        return;
      }

      console.error("Failed to optimize marketplace field", error);
      const message = getErrorMessage(error);
      setFieldAiFeedback(`优化失败：${message}`, "danger");
      setStatus(`字段优化失败：${message}`, "danger");
    } finally {
      if (state.requestId === requestId) {
        state.isGenerating = false;
        state.requestId = "";
      }
    }
  }

  async function cancelMarketplaceFieldAiRun() {
    const state = getState();
    const requestId = state.requestId;

    if (!state.isGenerating || !requestId) {
      return;
    }

    try {
      if (desktopApi?.cancelModelText) {
        await desktopApi.cancelModelText(requestId);
      }
      setFieldAiFeedback("已停止优化。", "neutral");
      setStatus("字段优化已停止。", "neutral");
    } catch (error) {
      console.error("Failed to cancel marketplace field AI run", error);
      setFieldAiFeedback(`停止失败：${getErrorMessage(error)}`, "danger");
    } finally {
      if (state.requestId === requestId) {
        state.isGenerating = false;
        state.requestId = "";
      }
    }
  }

  function applyMarketplaceFieldAiOutput(mode = "replace") {
    const state = getState();
    const output = normalizeFieldAiText(state.output);

    if (!output) {
      setFieldAiFeedback("还没有可写入的优化结果。", "warning");
      return;
    }

    if (typeof activeTarget?.setValue !== "function") {
      setFieldAiFeedback("当前字段暂不支持写入。", "danger");
      return;
    }

    const currentText = getActiveTargetValue();
    const nextText = mode === "append" ? buildAppendText(currentText, output) : output;
    const appName = activeTarget.appName;
    const fieldLabel = activeTarget.fieldLabel;

    activeTarget.setValue(nextText);
    setStatus(`${appName}已写入「${fieldLabel}」。`, "success");
    closeMarketplaceFieldAi();
  }

  function getMarketplaceFieldAiFeedbackClass() {
    const tone = getState().feedbackTone;
    return tone ? `is-${tone}` : "";
  }

  return {
    applyMarketplaceFieldAiOutput,
    cancelMarketplaceFieldAiRun,
    closeMarketplaceFieldAi,
    generateMarketplaceFieldAiOutput,
    getMarketplaceFieldAiFeedbackClass,
    openMarketplaceFieldAi,
    setMarketplaceFieldAiInstruction,
    setMarketplaceFieldAiOutput
  };
}

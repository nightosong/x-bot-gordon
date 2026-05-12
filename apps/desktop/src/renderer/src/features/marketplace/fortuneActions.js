import { computed } from "vue";

import { FORTUNE_APP_NAME, FORTUNE_READING_MODES } from "./marketplaceConfig.js";

const FORTUNE_SYSTEM_PROMPT = `你是 Gordon 应用广场里的「灵犀照命」，负责占卜与运势类文字解读。
你的定位是娱乐性、反思性和行动提示，不宣称预测必然发生，不替代医疗、法律、财务、心理等专业建议。
回答需要克制、温和、可复盘，避免恐吓、绝对化判断和宿命论。
如果用户问题涉及高风险决策，请转为风险识别、信息补全、求助专业人士和下一步低风险验证。
输出中文，使用清晰小标题，包含：趋势主轴、当前阻力、机会窗口、行动建议、复盘提示。`;

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function normalizeFortuneText(value) {
  return String(value ?? "").trim();
}

export function createFortuneActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId,
  setStatus,
  ui
}) {
  const activeFortuneModeMeta = computed(
    () => FORTUNE_READING_MODES.find((mode) => mode.id === ui.marketplace.fortune.activeMode) ?? FORTUNE_READING_MODES[0]
  );

  function setFortuneFeedback(text, tone = "neutral") {
    ui.marketplace.fortune.feedback = normalizeFortuneText(text);
    ui.marketplace.fortune.feedbackTone = tone;
  }

  function setFortuneMode(modeId) {
    ui.marketplace.fortune.activeMode = FORTUNE_READING_MODES.some((mode) => mode.id === modeId) ? modeId : "daily";
    setFortuneFeedback("", "neutral");
  }

  function setFortuneQuestion(value) {
    ui.marketplace.fortune.question = String(value ?? "");
  }

  function setFortuneBirthInfo(value) {
    ui.marketplace.fortune.birthInfo = String(value ?? "");
  }

  function setFortuneContext(value) {
    ui.marketplace.fortune.context = String(value ?? "");
  }

  function openFortuneApp() {
    writeRef(activeFeature, featureMarketplaceId);
    ui.marketplace.view = "fortune";
  }

  function backFortuneMarketplace() {
    ui.marketplace.view = "apps";
  }

  function clearFortuneReading() {
    ui.marketplace.fortune.output = "";
    setFortuneFeedback("", "neutral");
  }

  function getFortuneFeedbackClass() {
    return ui.marketplace.fortune.feedbackTone ? `is-${ui.marketplace.fortune.feedbackTone}` : "";
  }

  function buildFortunePrompt() {
    const mode = activeFortuneModeMeta.value;
    const question = normalizeFortuneText(ui.marketplace.fortune.question) || mode.placeholder;
    const birthInfo = normalizeFortuneText(ui.marketplace.fortune.birthInfo) || "未提供";
    const context = normalizeFortuneText(ui.marketplace.fortune.context) || "未提供";

    return [
      `解读类型：${mode.label}`,
      `解读重点：${mode.focus}`,
      `用户问题：${question}`,
      `出生/时间信息：${birthInfo}`,
      `补充背景：${context}`,
      "",
      "请给出一份适合用户阅读和复盘的占卜/运势参考。不要编造确定事实，不要给出绝对承诺。"
    ].join("\n");
  }

  async function generateFortuneReading() {
    if (ui.marketplace.fortune.isGenerating) {
      return;
    }

    if (!desktopApi?.invokeModelText) {
      setFortuneFeedback("AI 桥接未就绪。", "danger");
      return;
    }

    const mode = activeFortuneModeMeta.value;
    const requestId =
      typeof createLocalId === "function" ? createLocalId("fortune_model_request") : `fortune_model_request_${Date.now()}`;

    try {
      ui.marketplace.fortune.isGenerating = true;
      ui.marketplace.fortune.output = "";
      setFortuneFeedback("正在生成解读...", "neutral");
      setStatus(`${FORTUNE_APP_NAME}正在生成${mode.label}。`, "neutral");

      const result = await desktopApi.invokeModelText({
        requestId,
        temperature: 0.72,
        maxOutputTokens: 1400,
        messages: [
          {
            role: "system",
            content: FORTUNE_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildFortunePrompt()
          }
        ]
      });

      ui.marketplace.fortune.output = normalizeFortuneText(result?.text);
      setFortuneFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "解读已生成。", "success");
      setStatus(`${FORTUNE_APP_NAME}已生成解读。`, "success");
    } catch (error) {
      console.error("Failed to generate fortune reading", error);
      const message = getErrorMessage(error);
      setFortuneFeedback(`生成失败：${message}`, "danger");
      setStatus(`${FORTUNE_APP_NAME}生成失败：${message}`, "danger");
    } finally {
      ui.marketplace.fortune.isGenerating = false;
    }
  }

  return {
    activeFortuneModeMeta,
    backFortuneMarketplace,
    clearFortuneReading,
    generateFortuneReading,
    getFortuneFeedbackClass,
    openFortuneApp,
    setFortuneBirthInfo,
    setFortuneContext,
    setFortuneMode,
    setFortuneQuestion
  };
}

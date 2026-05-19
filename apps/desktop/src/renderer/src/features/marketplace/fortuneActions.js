import { computed } from "vue";

import { FORTUNE_ANALYSIS_METHODS, FORTUNE_APP_NAME, FORTUNE_READING_MODES } from "./marketplaceConfig.js";

const FORTUNE_SYSTEM_PROMPT = `你是 Gordon 应用广场里的「灵犀照命」，负责占卜与运势类文字解读。
你的定位是娱乐性、反思性和行动提示，不宣称预测必然发生，不替代医疗、法律、财务、心理等专业建议。
回答需要克制、温和、可复盘，避免恐吓、绝对化判断、宿命论和玄学压迫感。
如果用户问题涉及高风险决策，请转为风险识别、信息补全、求助专业人士和下一步低风险验证。
你的工作逻辑：
1. 先做资料完整度检查，明确哪些信息已用于解读，哪些信息不足；不得虚构八字四柱、紫微星曜、卦象、掌纹或户型细节。
2. 按用户选择的框架取象，再用现实背景校准；优先形成「象意线索 -> 交叉印证 -> 趋势判断 -> 行动建议 -> 复盘指标」。
3. 看相/手相只能基于用户主动提供的描述做传统象意比喻，不根据外貌推断身份、道德、寿命、疾病、颜值或必然贫富。
4. 风水只给可逆、低成本、低风险的空间整理、动线、光照、收纳、位置和色材建议，不诱导购买开运物或制造焦虑。
5. 涉及金钱、医疗、法律、心理危机、亲密关系安全时，必须提醒用户寻求专业支持，并把结论降级为参考。
输出中文，使用清晰小标题，包含：资料完整度、核心象意、趋势主轴、分项解读、行动建议、复盘提示、娱乐边界。`;

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
  const activeFortuneMethodLabels = computed(() =>
    (activeFortuneModeMeta.value?.methods ?? []).map((methodId) => FORTUNE_ANALYSIS_METHODS[methodId]?.label).filter(Boolean)
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

  function setFortuneProfileInfo(value) {
    ui.marketplace.fortune.profileInfo = String(value ?? "");
  }

  function setFortuneBirthInfo(value) {
    ui.marketplace.fortune.birthInfo = String(value ?? "");
  }

  function setFortuneAppearanceInfo(value) {
    ui.marketplace.fortune.appearanceInfo = String(value ?? "");
  }

  function setFortuneSpaceInfo(value) {
    ui.marketplace.fortune.spaceInfo = String(value ?? "");
  }

  function setFortuneNameInfo(value) {
    ui.marketplace.fortune.nameInfo = String(value ?? "");
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
    const profileInfo = normalizeFortuneText(ui.marketplace.fortune.profileInfo) || "未提供";
    const birthInfo = normalizeFortuneText(ui.marketplace.fortune.birthInfo) || "未提供";
    const appearanceInfo = normalizeFortuneText(ui.marketplace.fortune.appearanceInfo) || "未提供";
    const spaceInfo = normalizeFortuneText(ui.marketplace.fortune.spaceInfo) || "未提供";
    const nameInfo = normalizeFortuneText(ui.marketplace.fortune.nameInfo) || "未提供";
    const context = normalizeFortuneText(ui.marketplace.fortune.context) || "未提供";
    const methods = (mode.methods ?? [])
      .map((methodId) => {
        const method = FORTUNE_ANALYSIS_METHODS[methodId];
        return method ? `- ${method.label}：${method.prompt}` : "";
      })
      .filter(Boolean)
      .join("\n");

    return [
      `解读类型：${mode.label}`,
      `解读重点：${mode.focus}`,
      "采用框架：",
      methods || "- 现实校准：围绕用户问题、背景和可复盘行动给出参考。",
      `用户问题：${question}`,
      `基础资料：${profileInfo}`,
      `出生/时间信息：${birthInfo}`,
      `面相/手相线索：${appearanceInfo}`,
      `空间/风水线索：${spaceInfo}`,
      `姓名/数字线索：${nameInfo}`,
      `补充背景：${context}`,
      "",
      "请给出一份适合用户阅读和复盘的占卜/运势参考。",
      "要求：",
      "1. 开头先说明资料完整度，列出本次真正使用到的线索和缺失项。",
      "2. 如果资料不足以排盘或起卦，要明确降级为象意/现实参考，不要假装已经精确计算。",
      "3. 对每个判断给出线索来源，例如来自命盘信息、相学描述、风水布局、姓名数字或现实背景。",
      "4. 建议必须具体、温和、可执行，并附带 1-3 个后续复盘指标。",
      "5. 不要给出绝对承诺、灾祸恐吓、开运物购买建议或高风险决策指令。"
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
        maxOutputTokens: 1800,
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
    activeFortuneMethodLabels,
    backFortuneMarketplace,
    clearFortuneReading,
    generateFortuneReading,
    getFortuneFeedbackClass,
    openFortuneApp,
    setFortuneAppearanceInfo,
    setFortuneBirthInfo,
    setFortuneContext,
    setFortuneMode,
    setFortuneNameInfo,
    setFortuneProfileInfo,
    setFortuneSpaceInfo,
    setFortuneQuestion
  };
}

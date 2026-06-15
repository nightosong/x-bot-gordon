import { computed } from "vue";

import { FORTUNE_ANALYSIS_METHODS, FORTUNE_APP_NAME, FORTUNE_READING_MODES } from "./marketplaceConfig.js";

const FORTUNE_REAL_ICHING_HEXAGRAMS =
  "乾、坤、屯、蒙、需、讼、师、比、小畜、履、泰、否、同人、大有、谦、豫、随、蛊、临、观、噬嗑、贲、剥、复、无妄、大畜、颐、大过、坎、离、咸、恒、遁、大壮、晋、明夷、家人、睽、蹇、解、损、益、夬、姤、萃、升、困、井、革、鼎、震、艮、渐、归妹、丰、旅、巽、兑、涣、节、中孚、小过、既济、未济";

const FORTUNE_SYSTEM_PROMPT = `你是 Gordon 应用广场里的「灵犀照命」，负责占卜与运势类文字解读。
你的定位是娱乐性、反思性和行动提示，不宣称预测必然发生，不替代医疗、法律、财务、心理等专业建议。
回答需要克制、温和、可复盘，避免恐吓、绝对化判断、宿命论和玄学压迫感。
如果用户问题涉及高风险决策，请转为风险识别、信息补全、求助专业人士和下一步低风险验证。
对话目标：
1. 先判断用户想问什么，再判断适合哪种框架：今日趋势、综合看命、八字、紫微、面相手相、阳宅风水、事业财运、感情关系、抉择占卜或年月趋势。
2. 通过聊天补齐必要信息。信息不足时只追问 1-3 个最关键问题，不要急着完整解读；如果用户只想轻量参考，可以降级为象意解读。
3. 信息足够时再给「取象框架」和「卦名/盘名/象名」。必须解释名称来源，区分严格起卦、时间取象、数字取象、空间取象、用户描述取象、现实背景取象。
4. 严格使用周易卦名时，只能从 64 卦中选择：${FORTUNE_REAL_ICHING_HEXAGRAMS}。如果没有可验证的起卦过程，必须写成「象意取名」，不得假装是真实排出的本卦/变卦。
5. 八字/紫微资料不足时，只能给命局主题名或追问资料，不得伪造四柱、十神、星曜、宫位和大限流年。
6. 看相/手相必须基于用户主动描述、图片可读线索或附件文字；若当前模型无法读图，要请用户描述手型、掌纹、主线、面部气色、拍摄角度等关键线索。
7. 风水必须基于户型/工位用途、朝向、门窗、动线、床桌灶厕、光照、收纳和用户困扰；只给可逆、低成本、低风险的调整建议，不诱导购买开运物。
8. 涉及金钱、医疗、法律、心理危机、亲密关系安全时，必须提醒用户寻求专业支持，并把结论降级为参考。
常用信息槽位：
- 通用问询：用户真正的问题、期待看的时间范围、最近现实背景、可接受的行动边界。
- 易占/抉择：一个清晰问题、A/B 选项或目标、起问时间/数字/方位/随机数、用户最担心的后果。
- 八字：公历或农历出生年月日、出生时辰、出生地/时区、资料是否准确；传统流派需要性别时再询问，不收集证件号。
- 紫微：公历或农历出生年月日、出生时辰、出生地/时区、性别或已有命盘截图；没有命盘不得虚构星曜落宫。
- 面相/手相：照片或描述、左/右手、惯用手、年龄段可选、主要掌纹/手型/气色/五官线索；不得推断敏感身份和健康诊断。
- 阳宅风水：房间/工位用途、朝向、门窗位置、床/桌/灶/厕/镜子/杂物位置、光照通风、当前困扰。
输出方式：
- 需要追问时，用自然聊天语气列 1-3 个问题，并说明为什么需要这些信息。
- 可以解读时，使用「资料完整度 -> 取象依据 -> 卦名/象名 -> 核心象意 -> 趋势与风险 -> 可执行建议 -> 复盘指标」。
- 卦名/象名要短、有记忆点，但不能玄乎压人；每个判断都要能追溯到用户提供的线索。
输出中文，语气温和，适合聊天，不要像表格填报。`;

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

function normalizeFortuneList(value) {
  return Array.isArray(value) ? value : [];
}

function formatFortuneTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatFortuneFullTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function isImageAttachment(attachment) {
  const mimeType = String(attachment?.mimeType ?? "");
  const kind = String(attachment?.kind ?? "");
  return kind === "image" || mimeType.startsWith("image/");
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

  function ensureFortuneChatState() {
    if (!Array.isArray(ui.marketplace.fortune.messages)) {
      ui.marketplace.fortune.messages = [];
    }

    if (!Array.isArray(ui.marketplace.fortune.chatAttachments)) {
      ui.marketplace.fortune.chatAttachments = [];
    }
  }

  function setFortuneMode(modeId) {
    ui.marketplace.fortune.activeMode = FORTUNE_READING_MODES.some((mode) => mode.id === modeId) ? modeId : "daily";
    setFortuneFeedback("", "neutral");
  }

  function setFortuneChatInput(value) {
    ui.marketplace.fortune.chatInput = String(value ?? "");
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
    ensureFortuneChatState();
    ui.marketplace.fortune.messages = [];
    ui.marketplace.fortune.chatInput = "";
    ui.marketplace.fortune.chatAttachments = [];
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
      `本轮参考时间：${formatFortuneFullTime()}`,
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

  function buildFortuneAttachmentContext(attachments) {
    const normalizedAttachments = normalizeFortuneList(attachments);

    if (!normalizedAttachments.length) {
      return "";
    }

    return normalizedAttachments
      .map((attachment, index) => {
        const header = [
          `附件 ${index + 1}: ${attachment?.name ?? "未命名附件"}`,
          `类型: ${attachment?.mimeType || attachment?.extension || "unknown"}`,
          `读取状态: ${attachment?.readStatus ?? "unknown"}`
        ].join("\n");

        if (attachment?.extractedText?.trim()) {
          return `${header}\n正文:\n${attachment.extractedText.trim()}`;
        }

        if (isImageAttachment(attachment)) {
          return `${header}\n说明: 用户上传了图片。若当前模型不能直接读取图像，请先追问用户描述关键可见线索，例如手掌主线、掌丘、手型、面部气色、户型方位或照片角度，不要假装已经看见图片细节。`;
        }

        if (attachment?.errorMessage) {
          return `${header}\n读取错误: ${attachment.errorMessage}`;
        }

        return `${header}\n说明: 该附件暂时没有可注入模型的文本正文。`;
      })
      .join("\n\n");
  }

  function buildFortuneMessageContent(message) {
    const content = normalizeFortuneText(message?.content);
    const attachmentContext = buildFortuneAttachmentContext(message?.attachments);

    return [content || "(用户未输入文字，仅上传附件)", attachmentContext ? `\n【附件信息】\n${attachmentContext}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  function buildFortuneChatMessages() {
    const mode = activeFortuneModeMeta.value;
    const methods = (mode.methods ?? [])
      .map((methodId) => {
        const method = FORTUNE_ANALYSIS_METHODS[methodId];
        return method ? `- ${method.label}：${method.prompt}` : "";
      })
      .filter(Boolean)
      .join("\n");
    const history = normalizeFortuneList(ui.marketplace.fortune.messages).slice(-12);

    return [
      {
        role: "system",
        content: [
          FORTUNE_SYSTEM_PROMPT,
          "",
          `当前用户选择的解读类型：${mode.label}`,
          `当前解读重点：${mode.focus}`,
          `本轮参考时间：${formatFortuneFullTime()}`,
          "当前可用取象框架：",
          methods || "- 现实校准：围绕用户问题、背景和可复盘行动给出参考。",
          "",
          "对话策略：",
          "- 第一轮或资料明显不足时，优先追问，不要直接长篇解读；追问最多 3 个问题。",
          "- 若用户给了具体问题、时间/数字/出生资料/空间线索/相学线索之一，可以开始给象意卦名或阶段性解读。",
          "- 若选择易占且没有数字、起问时间或明确起卦方式，可以使用本轮参考时间做时间取象；若不能严格计算，就标注为象意取名。",
          "- 若用户上传图片但没有可读图像内容，先请用户补充可见细节；如果附件文字已可读，则结合附件正文。",
          "- 给卦名时必须说明它是严格起卦、时间取象、数字取象，还是象意取名；真实周易卦名只能使用系统提示里列出的 64 卦。"
        ].join("\n")
      },
      ...history.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: buildFortuneMessageContent(message)
      }))
    ];
  }

  function addFortuneMessage(message) {
    ensureFortuneChatState();
    ui.marketplace.fortune.messages = [
      ...ui.marketplace.fortune.messages,
      {
        id: typeof createLocalId === "function" ? createLocalId("fortune_message") : `fortune_message_${Date.now()}`,
        role: message.role,
        content: String(message.content ?? ""),
        modeId: ui.marketplace.fortune.activeMode,
        modeLabel: activeFortuneModeMeta.value?.label ?? "",
        createdAt: new Date().toISOString(),
        ...(Array.isArray(message.attachments) && message.attachments.length ? { attachments: message.attachments } : {}),
        ...(message.state ? { state: message.state } : {})
      }
    ];
  }

  async function selectFortuneAttachments() {
    if (ui.marketplace.fortune.isGenerating) {
      return;
    }

    if (!desktopApi?.selectCommandWorkshopAttachments) {
      setFortuneFeedback("附件选择能力未就绪。", "danger");
      return;
    }

    try {
      ensureFortuneChatState();
      const attachments = await desktopApi.selectCommandWorkshopAttachments();

      if (!attachments?.length) {
        return;
      }

      const currentPaths = new Set(ui.marketplace.fortune.chatAttachments.map((attachment) => attachment.path));
      const nextAttachments = attachments.filter((attachment) => !currentPaths.has(attachment.path));
      ui.marketplace.fortune.chatAttachments = [...ui.marketplace.fortune.chatAttachments, ...nextAttachments];
      setFortuneFeedback(`已添加 ${nextAttachments.length || attachments.length} 个附件。`, "success");
    } catch (error) {
      console.error("Failed to select fortune attachments", error);
      setFortuneFeedback(`附件读取失败：${getErrorMessage(error)}`, "danger");
    }
  }

  function removeFortuneAttachment(attachmentId) {
    ensureFortuneChatState();
    ui.marketplace.fortune.chatAttachments = ui.marketplace.fortune.chatAttachments.filter(
      (attachment) => attachment.id !== attachmentId
    );
  }

  async function sendFortuneMessage() {
    if (ui.marketplace.fortune.isGenerating) {
      return;
    }

    if (!desktopApi?.invokeModelText) {
      setFortuneFeedback("AI 桥接未就绪。", "danger");
      return;
    }

    ensureFortuneChatState();

    const input = normalizeFortuneText(ui.marketplace.fortune.chatInput);
    const attachments = normalizeFortuneList(ui.marketplace.fortune.chatAttachments);

    if (!input && !attachments.length) {
      setFortuneFeedback("先输入问题，或上传手相、面相、户型等参考图片。", "warning");
      return;
    }

    addFortuneMessage({
      role: "user",
      content: input || "我上传了一些参考资料，请先判断还需要我补充什么。",
      attachments
    });

    ui.marketplace.fortune.chatInput = "";
    ui.marketplace.fortune.chatAttachments = [];
    ui.marketplace.fortune.output = "";

    const mode = activeFortuneModeMeta.value;
    const requestId =
      typeof createLocalId === "function" ? createLocalId("fortune_chat_request") : `fortune_chat_request_${Date.now()}`;

    try {
      ui.marketplace.fortune.isGenerating = true;
      setFortuneFeedback("正在推演回复...", "neutral");
      setStatus(`${FORTUNE_APP_NAME}正在整理${mode.label}回复。`, "neutral");

      const result = await desktopApi.invokeModelText({
        requestId,
        temperature: 0.68,
        maxOutputTokens: 1900,
        messages: buildFortuneChatMessages()
      });

      const text = normalizeFortuneText(result?.text);
      addFortuneMessage({
        role: "assistant",
        content: text || "我没有得到可用回复，可以换一种问法再试一次。",
        state: text ? "completed" : "error"
      });
      ui.marketplace.fortune.output = text;
      setFortuneFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 回复。` : "已回复。", "success");
      setStatus(`${FORTUNE_APP_NAME}已回复。`, "success");
    } catch (error) {
      console.error("Failed to send fortune message", error);
      const message = getErrorMessage(error);
      addFortuneMessage({
        role: "assistant",
        content: `这次推演失败：${message}`,
        state: "error"
      });
      setFortuneFeedback(`回复失败：${message}`, "danger");
      setStatus(`${FORTUNE_APP_NAME}回复失败：${message}`, "danger");
    } finally {
      ui.marketplace.fortune.isGenerating = false;
    }
  }

  async function generateFortuneReading() {
    ensureFortuneChatState();

    if (normalizeFortuneText(ui.marketplace.fortune.chatInput) || ui.marketplace.fortune.chatAttachments.length) {
      await sendFortuneMessage();
      return;
    }

    if (!ui.marketplace.fortune.messages.length) {
      ui.marketplace.fortune.chatInput = normalizeFortuneText(ui.marketplace.fortune.question) || activeFortuneModeMeta.value?.placeholder || "";
      await sendFortuneMessage();
      return;
    }

    if (ui.marketplace.fortune.isGenerating) {
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
    addFortuneMessage,
    clearFortuneReading,
    formatFortuneTime,
    generateFortuneReading,
    getFortuneFeedbackClass,
    openFortuneApp,
    removeFortuneAttachment,
    selectFortuneAttachments,
    sendFortuneMessage,
    setFortuneAppearanceInfo,
    setFortuneBirthInfo,
    setFortuneChatInput,
    setFortuneContext,
    setFortuneMode,
    setFortuneNameInfo,
    setFortuneProfileInfo,
    setFortuneSpaceInfo,
    setFortuneQuestion
  };
}

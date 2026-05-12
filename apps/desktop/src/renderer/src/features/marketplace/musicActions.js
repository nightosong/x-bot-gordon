import { computed } from "vue";

import { MUSIC_APP_NAME, MUSIC_CREATION_MODES } from "./marketplaceConfig.js";

const MUSIC_SYSTEM_PROMPT = `你是 Gordon 应用广场里的「瑶琴映月」，负责音乐创作、歌词打磨、编曲策划和音乐生成提示词整理。
你需要像音乐制作人一样工作：先抓主题和情绪，再组织歌曲结构、曲风标签、乐器层次、节奏速度和可执行的生成提示词。
输出应适合作为后续 music_gen 工具或人工创作的输入，不要声称已经生成真实音频。
如果用户提供已有歌词或参考内容，需要保留其核心意图，并提升可唱性、画面感和段落推进。
输出中文，使用清晰小标题，按任务类型给出必要内容。`;

function writeRef(target, value) {
  if (target && typeof target === "object" && "value" in target) {
    target.value = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "未知错误";
}

function normalizeMusicText(value) {
  return String(value ?? "").trim();
}

export function createMusicActions({
  activeFeature,
  createLocalId,
  desktopApi,
  featureMarketplaceId,
  setStatus,
  ui
}) {
  const activeMusicModeMeta = computed(
    () => MUSIC_CREATION_MODES.find((mode) => mode.id === ui.marketplace.music.activeMode) ?? MUSIC_CREATION_MODES[0]
  );

  function setMusicFeedback(text, tone = "neutral") {
    ui.marketplace.music.feedback = normalizeMusicText(text);
    ui.marketplace.music.feedbackTone = tone;
  }

  function setMusicMode(modeId) {
    ui.marketplace.music.activeMode = MUSIC_CREATION_MODES.some((mode) => mode.id === modeId) ? modeId : "song";
    setMusicFeedback("", "neutral");
  }

  function setMusicTheme(value) {
    ui.marketplace.music.theme = String(value ?? "");
  }

  function setMusicStyle(value) {
    ui.marketplace.music.style = String(value ?? "");
  }

  function setMusicReference(value) {
    ui.marketplace.music.reference = String(value ?? "");
  }

  function openMusicApp() {
    writeRef(activeFeature, featureMarketplaceId);
    ui.marketplace.view = "music";
  }

  function backMusicMarketplace() {
    ui.marketplace.view = "apps";
  }

  function clearMusicOutput() {
    ui.marketplace.music.output = "";
    setMusicFeedback("", "neutral");
  }

  function getMusicFeedbackClass() {
    return ui.marketplace.music.feedbackTone ? `is-${ui.marketplace.music.feedbackTone}` : "";
  }

  function buildMusicPrompt() {
    const mode = activeMusicModeMeta.value;
    const theme = normalizeMusicText(ui.marketplace.music.theme) || mode.placeholder;
    const style = normalizeMusicText(ui.marketplace.music.style) || "未指定，请根据主题给出合适曲风";
    const reference = normalizeMusicText(ui.marketplace.music.reference) || "未提供";

    return [
      `创作类型：${mode.label}`,
      `创作重点：${mode.focus}`,
      `主题 / 需求：${theme}`,
      `曲风 / 情绪 / 场景：${style}`,
      `参考歌词 / 素材：${reference}`,
      "",
      "请给出可以直接进入音乐制作或 music_gen 工具调用前准备的结果。",
      "如适用，请包含：歌名、曲风标签、BPM/速度建议、段落结构、歌词、编曲说明、music_gen 正向提示词、限制/负向提示词、复听检查点。"
    ].join("\n");
  }

  async function generateMusicDraft() {
    if (ui.marketplace.music.isGenerating) {
      return;
    }

    if (!desktopApi?.invokeModelText) {
      setMusicFeedback("AI 桥接未就绪。", "danger");
      return;
    }

    const mode = activeMusicModeMeta.value;
    const requestId =
      typeof createLocalId === "function" ? createLocalId("music_model_request") : `music_model_request_${Date.now()}`;

    try {
      ui.marketplace.music.isGenerating = true;
      ui.marketplace.music.output = "";
      setMusicFeedback("正在谱写草案...", "neutral");
      setStatus(`${MUSIC_APP_NAME}正在生成${mode.label}。`, "neutral");

      const result = await desktopApi.invokeModelText({
        requestId,
        temperature: 0.78,
        maxOutputTokens: 1900,
        messages: [
          {
            role: "system",
            content: MUSIC_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildMusicPrompt()
          }
        ]
      });

      ui.marketplace.music.output = normalizeMusicText(result?.text);
      setMusicFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "音乐草案已生成。", "success");
      setStatus(`${MUSIC_APP_NAME}已生成音乐草案。`, "success");
    } catch (error) {
      console.error("Failed to generate music draft", error);
      const message = getErrorMessage(error);
      setMusicFeedback(`生成失败：${message}`, "danger");
      setStatus(`${MUSIC_APP_NAME}生成失败：${message}`, "danger");
    } finally {
      ui.marketplace.music.isGenerating = false;
    }
  }

  return {
    activeMusicModeMeta,
    backMusicMarketplace,
    clearMusicOutput,
    generateMusicDraft,
    getMusicFeedbackClass,
    openMusicApp,
    setMusicMode,
    setMusicReference,
    setMusicStyle,
    setMusicTheme
  };
}

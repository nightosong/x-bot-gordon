import { buildCommandWorkshopArtifact } from "../../lib/presenter.js";

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function buildCommandWorkshopLiveArtifact(progress) {
  return {
    ...buildCommandWorkshopArtifact({
      profileLabel: progress?.profileLabel ?? "",
      model: progress?.model ?? "",
      skillName: progress?.skillName ?? null,
      autoSelectedMcp: Boolean(progress?.autoSelectedMcp),
      mcpServerName: progress?.mcpServerName ?? null,
      mcpToolName: progress?.mcpToolName ?? null,
      mcpResultText: progress?.mcpResultText ?? null,
      mcpCalls: [...(progress?.mcpCalls ?? [])],
      stopReason: progress?.stopReason ?? "",
      taskLedger: progress?.taskLedger ?? null,
      steps: [...(progress?.steps ?? [])],
      createdAt: progress?.createdAt ?? new Date().toISOString()
    }),
    isLive: true
  };
}

export function getCommandAttachmentTitle(attachment) {
  const sizeKb = Math.max(1, Math.round((attachment?.sizeBytes ?? 0) / 1024));
  const statusText =
    {
      readable: "已读取正文",
      binary: "二进制附件",
      unsupported: "暂不支持正文读取",
      error: attachment?.errorMessage ? `读取失败：${attachment.errorMessage}` : "读取失败"
    }[attachment?.readStatus] ?? "附件";

  return `${attachment?.name ?? "附件"} · ${sizeKb} KB · ${statusText}`;
}

export function buildCommandAttachmentContext(attachments) {
  const normalizedAttachments = normalizeList(attachments);

  if (!normalizedAttachments.length) {
    return "";
  }

  return normalizedAttachments
    .map((attachment, index) => {
      const header = `附件 ${index + 1}: ${attachment?.name ?? "未命名附件"}
路径: ${attachment?.path ?? ""}
类型: ${attachment?.mimeType || attachment?.extension || "unknown"}
读取状态: ${attachment?.readStatus ?? "unknown"}`;

      if (attachment?.extractedText?.trim()) {
        return `${header}
正文:
${attachment.extractedText.trim()}`;
      }

      if (attachment?.errorMessage) {
        return `${header}
读取错误: ${attachment.errorMessage}`;
      }

      return `${header}
说明: 该文件已作为附件传入，但当前没有可注入模型的文本正文。`;
    })
    .join("\n\n");
}

function findMarketplaceResource(items, id) {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId || !Array.isArray(items)) {
    return null;
  }

  return items.find((item) => item?.id === normalizedId) ?? null;
}

export function buildCommandApplicationContext(ui, workbench) {
  const marketplace = ui?.marketplace;

  if (!marketplace || marketplace.view === "apps") {
    return "";
  }

  if (["writingShelf", "writingDetail"].includes(marketplace.view)) {
    const writingState = marketplace.writing ?? {};
    const books = Array.isArray(writingState.books) && writingState.books.length ? writingState.books : workbench?.writingBooks ?? [];
    const book = findMarketplaceResource(books, writingState.activeBookId) ?? books[0] ?? null;
    const chapter = findMarketplaceResource(book?.chapters ?? [], writingState.activeChapterId);
    const lines = [
      "当前应用广场上下文：",
      "应用：墨笔生花（writing）",
      `视图：${marketplace.view}`,
      book ? `当前小说：${book.title}（id=${book.id}）` : "当前小说：未选中",
      `当前 tab：${writingState.activeTab || "intro"}`,
      chapter ? `当前章节：第 ${chapter.index} 章 ${chapter.title}（id=${chapter.id}）` : "当前章节：未选中"
    ];

    lines.push("当用户提到“这个小说”“当前章节”“这里”等指代时，优先按以上上下文理解。需要读写应用资产时使用 Application Tools。");
    return lines.join("\n");
  }

  if (["comicShelf", "comicDetail"].includes(marketplace.view)) {
    const comicState = marketplace.comic ?? {};
    const projects = Array.isArray(comicState.projects) && comicState.projects.length ? comicState.projects : workbench?.comicProjects ?? [];
    const project = findMarketplaceResource(projects, comicState.activeProjectId) ?? projects[0] ?? null;
    const chapter = findMarketplaceResource(project?.chapters ?? [], comicState.activeChapterId);

    return [
      "当前应用广场上下文：",
      "应用：丹青溢彩（comic）",
      `视图：${marketplace.view}`,
      project ? `当前项目：${project.title}（id=${project.id}）` : "当前项目：未选中",
      `当前 tab：${comicState.activeTab || "intro"}`,
      chapter ? `当前章节：第 ${chapter.index} 章 ${chapter.title}（id=${chapter.id}）` : "当前章节：未选中",
      "当用户要求读取、保存、写回、创建或修改漫画项目 / 章节 / 分镜 / 素材时，优先使用 Application Tools 的 comic_* 工具；新增章节使用 comic_create_chapter，修改已有章节使用 comic_update_chapter，并在写后读回验证。"
    ].join("\n");
  }

  if (["videoShelf", "videoDetail"].includes(marketplace.view)) {
    const videoState = marketplace.video ?? {};
    const projects = Array.isArray(videoState.projects) && videoState.projects.length ? videoState.projects : workbench?.videoProjects ?? [];
    const project = findMarketplaceResource(projects, videoState.activeProjectId) ?? projects[0] ?? null;
    const shot = findMarketplaceResource(project?.shots ?? [], videoState.activeShotId);

    return [
      "当前应用广场上下文：",
      "应用：流光绘影（video）",
      `视图：${marketplace.view}`,
      project ? `当前项目：${project.title}（id=${project.id}）` : "当前项目：未选中",
      `当前 tab：${videoState.activeTab || "concept"}`,
      shot ? `当前镜头：${shot.index}. ${shot.title}（id=${shot.id}）` : "当前镜头：未选中",
      "当前 Application Tools 首版优先支持墨笔生花；其它应用可先基于上下文给出方案。"
    ].join("\n");
  }

  if (["musicShelf", "musicDetail"].includes(marketplace.view)) {
    const musicState = marketplace.music ?? {};
    const projects = Array.isArray(musicState.projects) && musicState.projects.length ? musicState.projects : workbench?.musicProjects ?? [];
    const project = findMarketplaceResource(projects, musicState.activeProjectId) ?? projects[0] ?? null;
    const track = findMarketplaceResource(project?.tracks ?? [], musicState.activeTrackId);

    return [
      "当前应用广场上下文：",
      "应用：瑶琴映月（music）",
      `视图：${marketplace.view}`,
      project ? `当前专辑：${project.title}（id=${project.id}）` : "当前专辑：未选中",
      track ? `当前曲目：${track.index}. ${track.title}（id=${track.id}，状态=${track.status || "draft"}）` : "当前曲目：未选中",
      `当前模式：${musicState.activeMode || track?.kind || "song"}`,
      `曲目提示词：${track?.prompt || musicState.theme || "未填写"}`,
      `曲风 / 情绪：${track?.style || musicState.style || "未填写"}`,
      `任务 ID：${track?.taskId || "暂无"}`,
      "需要生成真实音频时优先使用 Gordon Tools 的 music_gen；需要读写本地音乐专辑时可基于当前上下文给出操作建议。"
    ].join("\n");
  }

  if (marketplace.view === "fortune") {
    const fortuneState = marketplace.fortune ?? {};

    return [
      "当前应用广场上下文：",
      "应用：灵犀照命（fortune）",
      `当前模式：${fortuneState.activeMode || "daily"}`,
      `关注问题：${fortuneState.question || "未填写"}`,
      `补充背景：${fortuneState.context || "未填写"}`,
      "当前 Application Tools 首版优先支持墨笔生花；其它应用可先基于上下文给出方案。"
    ].join("\n");
  }

  return "";
}

export function buildCommandUserInputForAgent(content, attachments, applicationContext = "") {
  const attachmentContext = buildCommandAttachmentContext(attachments);
  const sections = [content || "请阅读并处理我上传的附件。"];

  if (applicationContext) {
    sections.push(applicationContext);
  }

  if (attachmentContext) {
    sections.push(`以下是本轮上传附件的后台读取结果：
${attachmentContext}`);
  }

  return sections.join("\n\n");
}

export function buildConversationMessagesForAgentRun(messages) {
  return normalizeList(messages)
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => ({
      role: message.role,
      content:
        message.role === "user"
          ? buildCommandUserInputForAgent(message.content, message.attachments ?? [])
          : message.content
    }));
}

export function findLatestCommandTaskLedger(messages) {
  for (const message of [...normalizeList(messages)].reverse()) {
    const ledger = message?.artifact?.taskLedger;

    if (message?.role === "assistant" && ledger && typeof ledger === "object" && !Array.isArray(ledger)) {
      return ledger;
    }
  }

  return null;
}

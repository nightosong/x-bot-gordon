function compactMarketplaceContext(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

export function createMarketplaceAgentContextProviders({
  comicActions,
  comicAiActions,
  fortuneActions,
  musicActions,
  truncateText,
  ui,
  videoActions
}) {
  function buildComicAgentContext() {
    const project = comicActions.activeComicProject.value;
    const chapter = comicActions.activeComicChapter.value;
    const task = comicAiActions.activeComicAiTask.value;
    const assets = comicActions.activeComicChapterAssets.value ?? [];

    if (!project) {
      return null;
    }

    return {
      appName: "丹青溢彩",
      modeLabel: comicActions.activeComicTabMeta.value?.fieldLabel ?? "漫画项目",
      taskLabel: task?.label ?? "漫画 Gordon 处理",
      instruction: ui.marketplace.comic.aiInstruction,
      outputTarget: "回填到灵绘小筑输出区；如生成了图片产物，同步进入图片预览，不直接替换章节图片区。",
      writeOutputTarget:
        "用户明确要求写回时，优先使用 Application Tools 修改丹青溢彩项目 / 章节 / 分镜 / 素材字段，并读回验证；最终同时把执行摘要回填到灵绘小筑输出区。",
      applicationToolHint:
        "丹青溢彩任务优先使用 Application Tools：comic_read_project 读取当前项目；comic_create_chapter 新增/补全实际章节实体；comic_update_project_fields 写项目字段；comic_update_assets 写素材库；comic_update_chapter 写已有章节标题、内容简介、章节正文和分镜提示；comic_update_chapter_images 写章节图片。实际出图使用 Gordon Tools / image_gen。",
      contextText: compactMarketplaceContext([
        `项目 ID：${project.id}`,
        `项目：${project.title}`,
        `类型：${project.genre}`,
        `形态：${comicActions.getComicProjectFormatLabel(project.format)}`,
        `画面：${comicActions.getComicProjectPaletteLabel(project.palette)}`,
        `页数目标：${project.pageCount}`,
        `项目封面：${project.coverUrl ? "已设置" : "未设置"}`,
        project.coverPrompt ? `封面提示词：${project.coverPrompt}` : "",
        `故事与画面目标：${project.summary || "暂无"}`,
        `画风与镜头：${project.visualStyle || "暂无"}`,
        `规划：${project.episodePlan || "暂无"}`,
        `当前章节 ID：${chapter?.id ?? "暂无"}`,
        `当前章节：${chapter ? comicActions.getComicChapterDisplayTitle(chapter, comicActions.activeComicChapterIndex.value) : "暂无"}`,
        chapter ? `章节更新时间：${chapter.updatedAt || "暂无"}` : "",
        chapter ? `章节内容简介：${chapter.summary || "暂无"}` : "",
        chapter ? `章节正文/故事内容：${truncateText(chapter.content || "暂无", 1400)}` : "",
        chapter ? `分镜与出图提示：${chapter.prompt || "暂无"}` : "",
        `项目更新时间：${project.updatedAt || "暂无"}`,
        `当前任务：${task?.label ?? "未选择"} / ${task?.goal ?? ""}`,
        `引用素材：${assets.length} 个`,
        ...assets.map((asset, index) => `${index + 1}. ${asset.name} / ${asset.description || asset.prompt || "暂无描述"}`)
      ])
    };
  }

  function buildVideoAgentContext() {
    const project = videoActions.activeVideoProject.value;
    const shot = videoActions.activeVideoShot.value;

    if (!project) {
      return null;
    }

    return {
      appName: "流光绘影",
      modeLabel: videoActions.activeVideoTabMeta.value?.fieldLabel ?? "视频项目",
      taskLabel: ui.marketplace.video.activeTab === "generate" ? "镜头 Gordon 处理" : "视频项目 Gordon 处理",
      outputTarget: "回填到当前镜头生成结果区；不直接提交镜头状态。",
      contextText: compactMarketplaceContext([
        `项目：${project.title}`,
        `类型：${project.genre}`,
        `模式：${videoActions.getVideoProjectModeLabel(project.mode)}`,
        `画幅：${videoActions.getVideoProjectAspectRatioLabel(project.aspectRatio)}`,
        `默认时长：${project.durationSeconds} 秒`,
        `项目封面：${project.coverUrl ? "已设置" : "未设置"}`,
        project.coverPrompt ? `封面提示词：${project.coverPrompt}` : "",
        `主题与用途：${project.summary || "暂无"}`,
        `视觉与运动风格：${project.visualStyle || "暂无"}`,
        `分镜总规划：${project.storyboardPlan || "暂无"}`,
        `镜头数量：${videoActions.activeVideoShots.value.length}`,
        shot ? `当前镜头：${videoActions.getVideoShotDisplayTitle(shot, videoActions.activeVideoShotIndex.value)}` : "",
        shot ? `镜头说明：${shot.summary || "暂无"}` : "",
        shot ? `参考素材 / 首帧说明：${shot.reference || "暂无"}` : "",
        shot ? `正向提示词：${shot.prompt || "暂无"}` : "",
        shot ? `反向提示词：${shot.negativePrompt || "暂无"}` : "",
        shot ? `生成结果：${shot.output || "暂无"}` : ""
      ])
    };
  }

  function buildMusicAgentContext() {
    const project = musicActions.activeMusicProject.value;
    const track = musicActions.activeMusicTrack.value;

    if (!project || !track) {
      return null;
    }

    return {
      appName: "瑶琴映月",
      modeLabel: musicActions.activeMusicModeMeta.value?.label ?? "音乐创作",
      taskLabel: "音乐 Gordon 处理",
      outputTarget: "回填到当前曲目的制作草案；如生成了音频产物，同步回填播放器信息。",
      contextText: compactMarketplaceContext([
        `专辑：${project.title}`,
        `制作人：${project.artist}`,
        `风格：${project.genre}`,
        `情绪：${project.mood}`,
        `专辑封面：${project.coverUrl ? "已设置" : "未设置"}`,
        project.coverPrompt ? `封面提示词：${project.coverPrompt}` : "",
        `专辑方向：${project.summary || "暂无"}`,
        `当前曲目：${musicActions.getMusicTrackDisplayTitle(track, musicActions.activeMusicTrackIndex.value)}`,
        `创作类型：${musicActions.getMusicTrackKindLabel(track.kind)}`,
        `状态：${musicActions.getMusicTrackStatusLabel(track.status)}`,
        `生成提示词：${track.prompt || "暂无"}`,
        `曲风 / 情绪 / 场景：${track.style || "暂无"}`,
        `歌词 / 素材：${track.lyrics || "暂无"}`,
        `负向限制：${track.negativePrompt || "暂无"}`,
        `任务 ID：${track.taskId || "暂无"}`,
        `制作草案：${track.notes || "暂无"}`
      ])
    };
  }

  function buildFortuneAgentContext() {
    const mode = fortuneActions.activeFortuneModeMeta.value;
    const messages = Array.isArray(ui.marketplace.fortune.messages) ? ui.marketplace.fortune.messages : [];
    const pendingInput = String(ui.marketplace.fortune.chatInput ?? "").trim();

    return {
      appName: "灵犀照命",
      modeLabel: mode?.label ?? "运势解读",
      taskLabel: "Gordon 对话处理",
      instruction: pendingInput || "结合当前对话继续处理，必要时追问，信息足够时给出可复盘解读。",
      outputTarget: "作为 Gordon 回复写入当前聊天流。",
      contextText: compactMarketplaceContext([
        `解读类型：${mode?.label ?? ""}`,
        `解读重点：${mode?.focus ?? ""}`,
        `采用框架：${fortuneActions.activeFortuneMethodLabels.value?.join(" / ") ?? ""}`,
        `当前待发送问题：${pendingInput || "暂无"}`,
        `附件数量：${(ui.marketplace.fortune.chatAttachments ?? []).length}`,
        "最近对话：",
        ...messages.slice(-8).map((message) => `${message.role === "assistant" ? "灵犀" : "用户"}：${truncateText(message.content, 420)}`)
      ])
    };
  }

  return {
    comic: buildComicAgentContext,
    video: buildVideoAgentContext,
    music: buildMusicAgentContext,
    fortune: buildFortuneAgentContext
  };
}

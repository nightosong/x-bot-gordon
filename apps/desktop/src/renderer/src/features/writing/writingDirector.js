function normalizeText(value) {
  return String(value ?? "").trim();
}

function compactText(value, maxLength = 220) {
  const text = normalizeText(value).replace(/\s+/g, " ");

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  return normalizeText(value)
    .split(/[,\n，、/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

const WRITING_PRODUCT_PURITY_PROTOCOL = [
  "作品成品纯净协议：",
  "- 书籍介绍、大纲指导、补充设定、章节简介、章节目录和正文必须是作品世界内部成立的成品文本，不是修改记录、审稿报告或讨论纪要。",
  "- 可以在内部吸收作者聊天、旧版设定、review 建议、资产盘点和取舍判断；最终写入作品字段时，只留下成品设定、成品目录或成品正文。",
  "- 成品中不得出现“根据你的要求、上一版、这一版、旧版、新版、本次调整、修改建议、review 建议、讨论上下文、用户明确要求”等元叙述。",
  "- 成品中不得出现“保留、融合、降级、删除、取舍判断、资产盘点、风险残留、待审备注、不要、不写、不再使用、必须删除、必须降级”等内部处理语言。",
  "- 需要表达边界时，转成正向作品设定：例如把“不写宫廷斗争”写成“王朝以军镇、关牒、粮道、供奉院等制度力量影响江湖”；把“不加入妖鬼”写成“奇异感来自自然风物、民俗传闻、旧路与人心”。",
  "- 审稿报告和内部计划可以出现修改建议；但只要输出目标是 intro / outlineGuide / extraIntroSections / chapters.summary / storyAssets / narrativeState，就必须先内化为纯净成品。"
].join("\n");

function inferProductPurityConstraint({ tabId, task }) {
  const taskId = normalizeText(task?.id);

  if (["continuityMemory", "relationshipContinuity", "narrativeState", "styleProfile"].includes(taskId)) {
    return "状态写回时只记录作品内稳定事实；不要把作者讨论、旧版对比、删除理由或用户要求原文写成故事资产。";
  }

  if (isReviewTaskId(taskId)) {
    return "审阅报告可以说明修改建议；若提供可写回片段，片段本身仍必须保持作品成品纯净。";
  }

  if (tabId === "chapter" && taskId !== "chapterPlan") {
    return "章节正文只输出小说正文，不夹带创作过程、修改说明、状态标签或工程术语。";
  }

  return "本轮输出若会进入书籍介绍、大纲指导、补充设定、章节简介或目录，必须是纯净作品成品，不夹带旧方案对比和讨论上下文。";
}

function inferWritingIntent(tabId, taskId) {
  if (tabId === "chapter") {
    if (taskId === "chapterPlan") {
      return "chapter_planning";
    }
    if (["continuityAudit", "antiAIGenerated", "openingReview", "review"].includes(taskId)) {
      return "chapter_verification";
    }
    return "chapter_generation";
  }

  if (tabId === "outline") {
    return taskId === "structure" ? "structure_planning" : "structure_verification";
  }

  if (["continuityMemory", "relationshipContinuity", "narrativeState", "styleProfile"].includes(taskId)) {
    return "state_commit";
  }

  return taskId === "openingAudit" ? "foundation_verification" : "foundation_planning";
}

function inferWritingPhase(intent) {
  if (intent.includes("verification")) {
    return "verifying";
  }
  if (intent === "state_commit") {
    return "committing";
  }
  if (intent.includes("generation")) {
    return "executing";
  }
  return "planning";
}

function inferSkillNodes(intent, taskId) {
  const nodesByIntent = {
    foundation_planning: ["story_planner", "world_builder", "character_designer", "state_tracker"],
    foundation_verification: ["opening_auditor", "continuity_auditor"],
    structure_planning: ["plot_engine", "arc_planner", "state_tracker"],
    structure_verification: ["arc_planner", "continuity_auditor"],
    chapter_planning: ["chapter_planner", "plot_engine", "state_tracker"],
    chapter_generation: ["chapter_planner", "chapter_writer", "style_controller", "story_memory", "state_tracker"],
    chapter_verification: ["continuity_auditor", taskId === "antiAIGenerated" ? "style_controller" : "scene_specialist"],
    state_commit: ["story_memory", "state_tracker"]
  };

  return nodesByIntent[intent] ?? ["story_planner", "state_tracker"];
}

function inferFocus({ book, tabId, task, currentChapter }) {
  const taskGoal = normalizeText(task?.goal);
  const genre = normalizeText(book?.genreProfile?.primaryGenre || book?.genre);
  const storyEngine = normalizeText(book?.genreProfile?.storyEngine);
  const focus = [
    taskGoal || "完成当前写作任务",
    genre ? `题材策略：${genre}` : "",
    storyEngine ? `故事发动机：${storyEngine}` : "",
    tabId === "chapter" && currentChapter?.summary ? `当前章节职责：${compactText(currentChapter.summary, 180)}` : ""
  ].filter(Boolean);

  return focus.length ? focus : ["根据作者目标推进作品，而不是机械执行按钮任务"];
}

function inferRisks({ book, tabId, task, instruction }) {
  const text = `${book?.genre ?? ""}\n${book?.genreProfile?.primaryGenre ?? ""}\n${book?.genreProfile?.storyEngine ?? ""}\n${task?.label ?? ""}\n${instruction ?? ""}`;
  const risks = [
    "Prompt 工作流惯性：只生成文本、不判断本轮最值得推进什么",
    "状态被动写回：新增事实没有证据载体，后续章节容易漂移"
  ];

  if (/武侠|江湖|剑|门派|宗门|隐宗|隐秘门派/u.test(text)) {
    risks.push("武侠套路漂移：揭阴谋、争天下第一、到一地悟一招、把游历写成任务链");
  }

  if (/成长|升级|修行|武学|技艺|境界/u.test(text)) {
    risks.push("成长机制化：把技艺提升写成战斗结算或关卡奖励，而不是铺垫后的水到渠成");
  }

  if (tabId === "outline" || task?.id === "structure") {
    risks.push("目录主题公园化：每卷过于工整地承担一堂课，缺少偶然、错路、白走和余味");
  }

  if (tabId === "chapter") {
    risks.push("正文混入编辑说明：章节正文必须保持作品文本，不输出 state_delta、工具术语或工作流解释");
  }

  return risks;
}

function inferConstraints({ tabId, task }) {
  const taskId = normalizeText(task?.id);
  const constraints = [
    "用户本轮明确要求优先级最高；Genre Profile、storyAssets、Narrative State 只能辅助判断，不能反向替用户改题材。",
    "Gordon 负责导演和验证；PromptBuilder 只把导演计划转换成模型输入，不替代 Gordon 做决策。",
    "作品成品中不得出现 Agent、Skill、工作流、节点、Schema、状态提交等内部工程语言。",
    inferProductPurityConstraint({ tabId, task })
  ];

  if (tabId === "chapter" && taskId !== "chapterPlan") {
    constraints.push("章节正文只输出正文；稳定事实由写回后的 story_memory / state_tracker 抽取。");
  }

  if (["continuityMemory", "relationshipContinuity", "narrativeState", "styleProfile"].includes(taskId)) {
    constraints.push("状态类任务必须输出可解析 JSON，并为长期事实写 evidenceRefs 与 impact。");
  }

  if (["openingAudit", "outlineAudit", "pacing", "hookDirector", "arcTracker", "planDrift", "continuityAudit", "antiAIGenerated", "openingReview", "review"].includes(taskId)) {
    constraints.push("审阅类任务只给问题、证据和最小修法，不自动改写正文或设定。");
  }

  return constraints;
}

function inferTasks(intent) {
  const tasksByIntent = {
    foundation_planning: ["观察作品资产", "提出本轮设定取舍", "生成可写入内容", "标注后续状态提交点"],
    foundation_verification: ["读取开篇和设定", "检查追读力与设定负担", "输出问题证据和修复顺序"],
    structure_planning: ["读取题材画像和资产", "制定阶段/卷章推进", "检查长线因果和节奏", "输出可落盘目录"],
    structure_verification: ["读取目录与事件图", "检查计划漂移", "给出最小调整建议"],
    chapter_planning: ["观察当前章节职责", "设计本章冲突和信息差", "限定代价与结尾钩子"],
    chapter_generation: ["观察前后章节", "生成场景正文", "避免解释性旁白", "为后续 story_memory 留下证据载体"],
    chapter_verification: ["读取当前正文", "定位连续性/AI味/节奏问题", "给出最小替换片段"],
    state_commit: ["抽取稳定事实", "写入 evidenceRefs", "生成 Narrative State 增量"]
  };

  return tasksByIntent[intent] ?? ["观察", "计划", "执行", "验证"];
}

function isReviewTaskId(taskId) {
  return [
    "openingAudit",
    "outlineAudit",
    "pacing",
    "hookDirector",
    "arcTracker",
    "planDrift",
    "continuityAudit",
    "antiAIGenerated",
    "openingReview",
    "review"
  ].includes(taskId);
}

function inferSuccessCriteria({ tabId, task }) {
  const taskId = normalizeText(task?.id);

  if (tabId === "chapter" && taskId !== "chapterPlan" && !isReviewTaskId(taskId)) {
    return [
      "输出可以直接作为章节正文使用，开头不带章节标题或说明。",
      "至少有一处可验证变化：行动、关系、资源、伤势、名声、路线、规则、证据载体或未兑现承诺。",
      "不把成长写成即时升级；若出现技艺领悟，必须能看出前文铺垫或本章只留下半成手感。"
    ];
  }

  if (tabId === "outline" && taskId === "structure") {
    return [
      "目录可落盘为 parts / chapters，章节 index 连续且每章能支撑 3000-5000 字正文。",
      "全书不是揭穿终极阴谋、掌权或天下第一路线；阶段收束落在行路、关系、技艺、地方余波和价值选择。",
      "结构保留偶然、错路、白走和未解释余味，避免每卷像固定课程。"
    ];
  }

  if (["continuityMemory", "relationshipContinuity", "narrativeState", "styleProfile"].includes(taskId)) {
    return [
      "输出 JSON 可解析。",
      "长期事实有 evidenceRefs 或作者要求来源。",
      "抽象判断被转成具体事件、证据载体、关系变化或后续影响。"
    ];
  }

  return [
    "输出只服务当前任务，不寒暄、不解释提示词。",
    "指出问题时给证据和修复顺序。",
    "不引入违背作者要求的新主线或新设定。"
  ];
}

function buildConflictSeed({ book, tabId, task, currentChapter, instruction }) {
  const genre = normalizeText(book?.genreProfile?.primaryGenre || book?.genre || "小说");
  const storyEngine = normalizeText(book?.genreProfile?.storyEngine);
  const base = tabId === "chapter" && currentChapter?.summary
    ? compactText(currentChapter.summary, 180)
    : compactText(instruction || book?.outlineGuide || book?.intro || task?.goal, 180);

  return {
    source: base || "从当前作品状态中提取下一处必须推进的行动难题",
    pressure: storyEngine || genre,
    changeTarget: tabId === "chapter" ? "本章必须留下可追踪后果" : "本轮必须改变后续可写性"
  };
}

export function buildWritingDirectorPlan({ book, tabId, task, instruction, currentChapter }) {
  const intent = inferWritingIntent(tabId, task?.id);

  return {
    director: "Gordon",
    skill: "writing",
    intent,
    phase: inferWritingPhase(intent),
    skillNodes: inferSkillNodes(intent, task?.id),
    focus: inferFocus({ book, tabId, task, currentChapter }),
    tasks: inferTasks(intent),
    risks: inferRisks({ book, tabId, task, instruction }),
    constraints: inferConstraints({ tabId, task }),
    successCriteria: inferSuccessCriteria({ tabId, task }),
    conflictSeed: buildConflictSeed({ book, tabId, task, currentChapter, instruction }),
    stateCommitPolicy: {
      mode: intent === "state_commit" ? "direct_json_delta" : tabId === "chapter" ? "post_apply_story_memory" : "suggested_delta",
      rule:
        tabId === "chapter"
          ? "正文生成保持纯净；用户点击写入后再由 story_memory / state_tracker 抽取 storyAssets 与 Narrative State。"
          : "若本轮产生长期事实，输出必须说明证据来源、后续影响和写回位置。"
    }
  };
}

export function buildWritingDirectorPlanContent(plan) {
  if (!plan) {
    return "";
  }

  return [
    `director：${plan.director}（Gordon 主导本轮写作决策）`,
    `activeSkill：${plan.skill}`,
    `intent：${plan.intent}`,
    `phase：${plan.phase}`,
    `skillNodes：${(plan.skillNodes ?? []).join(" -> ")}`,
    "",
    "focus：",
    ...(plan.focus ?? []).map((item) => `- ${item}`),
    "",
    "tasks：",
    ...(plan.tasks ?? []).map((item) => `- ${item}`),
    "",
    "riskCheck：",
    ...(plan.risks ?? []).map((item) => `- ${item}`),
    "",
    "constraints：",
    ...(plan.constraints ?? []).map((item) => `- ${item}`),
    "",
    "successCriteria：",
    ...(plan.successCriteria ?? []).map((item) => `- ${item}`),
    "",
    "conflictSeed：",
    `- source：${plan.conflictSeed?.source ?? "未设定"}`,
    `- pressure：${plan.conflictSeed?.pressure ?? "未设定"}`,
    `- changeTarget：${plan.conflictSeed?.changeTarget ?? "未设定"}`,
    "",
    "stateCommitPolicy：",
    `- mode：${plan.stateCommitPolicy?.mode ?? "suggested_delta"}`,
    `- rule：${plan.stateCommitPolicy?.rule ?? "若产生长期事实，必须可证据化写回。"}`
  ].join("\n");
}

function buildEventNodeLine(node, index, kind) {
  const label = normalizeText(node?.label || node?.title || node?.name || `${kind}_${index + 1}`);
  const summary = compactText(node?.summary || node?.detail || node?.description || node?.setup || "", 160);
  const status = normalizeText(node?.status);
  const evidence = normalizeList(node?.evidenceChapterIds).slice(0, 3).join(", ");

  return [
    `E${index + 1}.${kind}：${label}`,
    summary ? ` -> ${summary}` : "",
    status ? ` / status=${status}` : "",
    evidence ? ` / evidence=${evidence}` : ""
  ].join("");
}

export function buildWritingEventGraphContext({ book, chapters = [], currentChapter = null }, maxItems = 14) {
  if (!book) {
    return "";
  }

  const state = book.narrativeState && typeof book.narrativeState === "object" ? book.narrativeState : {};
  const nodes = [
    ...(Array.isArray(state.timelineEvents) ? state.timelineEvents.map((node) => ({ ...node, kind: "timeline" })) : []),
    ...(Array.isArray(state.arcs) ? state.arcs.map((node) => ({ ...node, kind: "arc" })) : []),
    ...(Array.isArray(state.foreshadows) ? state.foreshadows.map((node) => ({ ...node, kind: "foreshadow" })) : []),
    ...(Array.isArray(state.resources) ? state.resources.map((node) => ({ ...node, kind: "resource" })) : []),
    ...(Array.isArray(state.regions) ? state.regions.map((node) => ({ ...node, kind: "region" })) : [])
  ];
  const sortedChapters = [...(Array.isArray(chapters) ? chapters : [])]
    .sort((left, right) => Number(left?.index ?? 0) - Number(right?.index ?? 0));
  const currentIndex = currentChapter
    ? sortedChapters.findIndex((chapter) => chapter?.id === currentChapter.id)
    : -1;
  const recentChapters = sortedChapters
    .filter((chapter, index) => {
      if (currentIndex >= 0) {
        return index < currentIndex;
      }

      return chapter?.status === "done";
    })
    .slice(-5);
  const chapterNodes = recentChapters.map((chapter) => ({
    kind: "chapter",
    label: `第${chapter.index ?? "?"}章 ${chapter.title ?? ""}`.trim(),
    summary: chapter.summary || chapter.content,
    status: chapter.status
  }));
  const visibleNodes = [...nodes, ...chapterNodes].slice(-maxItems);

  if (!visibleNodes.length) {
    return "暂无显式 Event Graph。Gordon 本轮需要从 Genre Profile、storyAssets、Narrative State 和章节目录中临时构建因果判断。";
  }

  return [
    "轻量 Event Graph（用于因果与状态连续性，不是正文设定）：",
    ...visibleNodes.map((node, index) => buildEventNodeLine(node, index, node.kind ?? "event")),
    "",
    "使用规则：后续输出必须尊重这些事件造成的关系、资源、路线、伏笔和世界状态后果；不能把它们当作装饰性摘要。"
  ].join("\n");
}

export function buildWritingAgentTaskPackage({
  appName = "墨笔生花",
  book,
  tabTitle,
  task,
  instruction,
  directorPlanContent,
  eventGraphContent,
  genreProfileContent,
  storyMemoryContent,
  narrativeStateContent,
  styleProfileContent,
  introContent,
  outlineContent,
  chapterContext,
  currentModuleContent,
  outputTarget = "预览，不直接写回",
  writeIntent = false
}) {
  if (!book) {
    return "";
  }

  return [
    `你是 Gordon，正在应用广场「${appName}」中处理一项小说创作任务。`,
    "请加载并使用内置 writing Skill，而不是把本任务当成普通聊天或一次性文本续写。",
    "",
    "本轮目标：",
    `- 作品：${book.title ?? "未命名故事"}`,
    `- 当前模块：${tabTitle || "未设定"}`,
    `- 当前任务：${task?.label ?? "综合写作"} - ${task?.goal ?? "按作者要求推进作品"}`,
    `- 输出目标：${outputTarget}`,
    `- 作者额外要求：${normalizeText(instruction) || "无"}`,
    "",
    "执行协议：",
    "- 先根据 Writing Director Plan 判断本轮真正意图和成功标准。",
    "- 再根据 writing Skill 的节点方法完成规划、生成、审阅或状态提交。",
    "- 如需写回应用资产，优先使用 Application Tools 的墨笔生花工具；无法覆盖时才使用 Workspace Tools 直接维护 ~/.gord/data/workbench/writing-books。",
    writeIntent
      ? "- 本轮作者已经明确要求写回 / 修改：允许设置 dryRun=false 执行真实写回；写回前先读取定位，写回后必须读回验证关键字段。"
      : "- 写回前如果会覆盖正文、目录或长期设定，优先给出 dryRun / 预览；用户明确要求直接保存时才真实写回。",
    "- 写回后必须验证 JSON 可解析、目标书籍 / 章节存在、关键字段符合本轮目标。",
    "- 小说正文、简介、目录和设定成品不得暴露 Agent、Skill、工具、Schema、状态提交等内部工程语言。",
    "- 小说正文、简介、目录和设定成品也不得暴露上一版 / 这一版 / 旧方案 / 新方案 / 本次调整 / 修改建议 / review 建议 / 用户要求 / 保留 / 融合 / 降级 / 删除 / 风险残留等讨论或审稿痕迹。",
    "- 如果需要表达作者排除的内容，必须改写成作品内正向设定语言，而不是写成“不写某内容 / 不加入某元素”。",
    "",
    WRITING_PRODUCT_PURITY_PROTOCOL,
    "",
    "Writing Director Plan：",
    directorPlanContent || "(暂无导演计划；请先自行根据上下文建立本轮计划。)",
    "",
    "Genre Profile：",
    genreProfileContent || "(空)",
    "",
    "Story Memory / Narrative Runtime：",
    storyMemoryContent || "(空)",
    "",
    "Narrative State：",
    narrativeStateContent || "(空)",
    "",
    "Event Graph：",
    eventGraphContent || "(暂无 Event Graph。)",
    "",
    "Style Profile：",
    styleProfileContent || "(空)",
    "",
    "故事介绍与规划：",
    introContent || "(空)",
    "",
    "章节目录：",
    outlineContent || "(空)",
    "",
    "当前章节：",
    chapterContext || "(空)",
    "",
    "当前模块原文：",
    currentModuleContent || "(空)",
    "",
    "请基于以上上下文完成本轮任务。输出要清晰、可执行、可写回；如果只适合预览，请明确给出预览内容和建议写回位置。"
  ].join("\n");
}

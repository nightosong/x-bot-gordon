export const WORKFLOW_DEFAULT_ENVIRONMENTS = [
  { id: "dev", label: "DEV", baseUrl: "" },
  { id: "test", label: "TEST", baseUrl: "" },
  { id: "pre", label: "PRE", baseUrl: "" },
  { id: "prod", label: "PROD", baseUrl: "" }
];

export const WORKFLOW_CURL_BODY_OPTIONS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--json"]);

let fallbackIdSeed = 0;

function createFallbackLocalId(prefix) {
  fallbackIdSeed += 1;
  return `${prefix}_${Date.now()}_${fallbackIdSeed}`;
}

export function createWorkflowState(createLocalId = createFallbackLocalId) {
  return {
    view: "library",
    activeCardId: null,
    activeRecordId: null,
    activeInfoWindowId: null,
    activeInfoReaderItemId: null,
    copiedStepId: null,
    bodyStepId: null,
    bodyDraftText: "",
    bodyFeedbackText: "",
    bodyFeedbackTone: "neutral",
    bodyPanelCollapsed: false,
    apiKeyVisible: false,
    searchQuery: "",
    infoSearchQuery: "",
    infoSourceFilter: "",
    infoTopicFilter: "",
    infoStatusFilter: "",
    infoRailCollapsed: false,
    financeSymbolQuery: "",
    financeRange: "1mo",
    financeInterval: "1d",
    isQueryingFinanceBrief: false,
    financeBriefError: "",
    liveStreamUrlInput: "",
    liveStreamPlatform: "bilibili",
    liveStreamActiveSourceId: null,
    liveStreamResolvedUrl: "",
    liveStreamError: "",
    isLiveStreamLoading: false,
    liveStreamReloadKey: 0,
    editingRecordId: null,
    editingInfoWindowId: null,
    isRunning: false,
    isCancelling: false,
    isRefreshingInfoWindow: false,
    isInfoReaderLoading: false,
    infoReaderError: "",
    infoReaderResolvedUrl: "",
    runResult: null,
    activeProgressEventId: null,
    expandedStepIds: [],
    isSavingRecord: false,
    isSavingInfoWindow: false,
    recordDraft: createWorkflowRecordDraft(createLocalId),
    infoWindowDraft: createInfoRadarWindowDraft(createLocalId)
  };
}

export function createDefaultWorkflowEnvironments(seedBaseUrl = "", seedApiKey = "") {
  return WORKFLOW_DEFAULT_ENVIRONMENTS.map((environment) => ({
    ...environment,
    baseUrl: environment.id === "prod" ? seedBaseUrl : "",
    apiKey: environment.id === "prod" ? seedApiKey : ""
  }));
}

export function createWorkflowOutputDraft(overrides = {}, createLocalId = createFallbackLocalId) {
  return {
    id: overrides.id ?? createLocalId("workflow_output_draft"),
    name: overrides.name ?? "",
    path: overrides.path ?? ""
  };
}

export function createWorkflowStepDraft(overrides = {}, createLocalId = createFallbackLocalId) {
  const successValues = Array.isArray(overrides.successValues) ? overrides.successValues : [];
  const failureValues = Array.isArray(overrides.failureValues) ? overrides.failureValues : [];

  return {
    id: overrides.id ?? createLocalId("workflow_step_draft"),
    name: overrides.name ?? "",
    curl: overrides.curl ?? "",
    waitBeforeMs: String(overrides.waitBeforeMs ?? 0),
    executionMode: overrides.executionMode ?? (overrides.completionPath ? "polling" : "once"),
    pollIntervalMs: String(overrides.pollIntervalMs ?? 5000),
    maxAttempts: String(overrides.maxAttempts ?? 20),
    completionPath: overrides.completionPath ?? "",
    successValuesText: successValues.join(", "),
    failureValuesText: failureValues.join(", "),
    produces: (Array.isArray(overrides.produces) ? overrides.produces : []).map((binding) =>
      createWorkflowOutputDraft(binding, createLocalId)
    )
  };
}

export function createWorkflowRecordDraft(createLocalId = createFallbackLocalId) {
  return {
    name: "",
    scenario: "",
    mode: "single",
    tagsText: "curl, API",
    pollIntervalMs: "3000",
    maxAttempts: "20",
    activeEnvironmentId: "prod",
    apiKey: "",
    environments: createDefaultWorkflowEnvironments(),
    steps: [createWorkflowStepDraft({}, createLocalId)],
    notes: ""
  };
}

export function createInfoRadarSourceDraft(overrides = {}, createLocalId = createFallbackLocalId) {
  return {
    id: overrides.id ?? createLocalId("info_source_draft"),
    kind: overrides.kind ?? "rss",  // rss | web_page | search | wechat | github | reddit | manual
    title: overrides.title ?? "",
    url: overrides.url ?? "",
    query: overrides.query ?? "",
    enabled: overrides.enabled !== false,
    tagsText: Array.isArray(overrides.tags) ? overrides.tags.join("，") : overrides.tagsText ?? "",
    notes: overrides.notes ?? "",
    lastDiscoveredAt: overrides.lastDiscoveredAt ?? ""
  };
}

// 前沿信息预设库：一键搭建高质量技术 / AI / 研究情报窗口，避免用户从零手填来源。
// 这些预设只作为"新建窗口初始草稿"注入，保存后仍归属用户配置（写入本地仓储），不做项目级硬编码窗口。
export const INFO_RADAR_WINDOW_PRESETS = [
  {
    id: "frontier-tech",
    label: "前沿科技",
    icon: "rocket",
    accent: "cyan",
    title: "前沿科技雷达",
    category: "技术",
    cadence: "daily",
    summary: "聚合全球头部科技媒体与产品发布，随时跟进最新技术风向。",
    keywords: "AI，芯片，模型，开源，发布，突破",
    negativeKeywords: "广告，招聘，课程，优惠",
    digestPrompt: "按影响力、技术新颖度和落地可行性归纳，标注值得深入研究的方向。",
    sources: [
      { kind: "rss", title: "The Verge", url: "https://www.theverge.com/rss/index.xml", tags: ["科技", "综合"] },
      { kind: "rss", title: "TechCrunch", url: "https://techcrunch.com/feed/", tags: ["科技", "创业"] },
      { kind: "rss", title: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", tags: ["科技", "深度"] },
      { kind: "rss", title: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", tags: ["前沿", "研究"] },
      { kind: "search", title: "前沿科技突破", query: "前沿科技 重大突破", tags: ["聚合"] }
    ]
  },
  {
    id: "ai-frontier",
    label: "AI 前沿",
    icon: "sparkles",
    accent: "gold",
    title: "AI 前沿雷达",
    category: "AI",
    cadence: "daily",
    summary: "追踪大模型、智能体与 AI 产品的最新进展和官方发布。",
    keywords: "大模型，Agent，LLM，多模态，推理，发布",
    negativeKeywords: "招聘，广告，课程",
    digestPrompt: "区分官方发布、研究进展和行业动态，突出可复用的能力与方法。",
    sources: [
      { kind: "rss", title: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", tags: ["官方", "AI"] },
      { kind: "rss", title: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", tags: ["官方", "AI"] },
      { kind: "rss", title: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", tags: ["开源", "AI"] },
      { kind: "search", title: "大模型最新进展", query: "大模型 最新 进展", tags: ["聚合"] },
      { kind: "search", title: "AI Agent 动态", query: "AI Agent 智能体 发布", tags: ["聚合"] }
    ]
  },
  {
    id: "dev-frontier",
    label: "开发者",
    icon: "code",
    accent: "cyan",
    title: "开发者雷达",
    category: "技术",
    cadence: "daily",
    summary: "聚合开源社区、工程实践与热门项目动态。",
    keywords: "开源，框架，工具，工程，实践，release",
    negativeKeywords: "招聘，广告",
    digestPrompt: "突出对日常开发有价值的工具、库和工程实践，标注可直接采用的项目。",
    sources: [
      { kind: "rss", title: "Hacker News", url: "https://hnrss.org/frontpage", tags: ["社区", "热门"] },
      { kind: "rss", title: "GitHub Blog", url: "https://github.blog/feed/", tags: ["官方", "开发"] },
      { kind: "rss", title: "InfoQ", url: "https://feed.infoq.com/", tags: ["工程", "架构"] },
      { kind: "search", title: "热门开源项目", query: "热门 开源项目 GitHub", tags: ["聚合"] },
      { kind: "github", title: "GitHub Daily Trending", url: "https://github.com/trending.atom", tags: ["GitHub", "热门"] },
      { kind: "reddit", title: "r/programming", url: "https://www.reddit.com/r/programming/.rss", tags: ["Reddit", "开发"] }
    ]
  },
  {
    id: "research-frontier",
    label: "科研前沿",
    icon: "flask",
    accent: "gold",
    title: "科研前沿雷达",
    category: "科研",
    cadence: "weekly",
    summary: "追踪学术论文与研究机构的前沿成果。",
    keywords: "论文，研究，突破，实验，成果",
    negativeKeywords: "招聘，广告，课程",
    digestPrompt: "提炼研究问题、方法创新与结论，标注潜在应用价值。",
    sources: [
      { kind: "rss", title: "arXiv cs.AI", url: "https://export.arxiv.org/rss/cs.AI", tags: ["论文", "AI"] },
      { kind: "rss", title: "Nature News", url: "https://www.nature.com/nature.rss", tags: ["顶刊", "科研"] },
      { kind: "search", title: "最新研究成果", query: "最新 研究成果 突破", tags: ["聚合"] }
    ]
  },

  {
    id: "algorithm-frontier",
    label: "算法前沿",
    icon: "code",
    accent: "cyan",
    title: "算法与机器学习前沿",
    category: "算法",
    cadence: "daily",
    summary: "追踪机器学习、深度学习、算法理论与 NLP 最新论文和工程进展。",
    keywords: "算法，神经网络，深度学习，NLP，强化学习，优化，Transformer",
    negativeKeywords: "招聘，广告，课程",
    digestPrompt: "提炼核心方法创新和实验结论，标注可落地复现的技术和开源代码链接。",
    sources: [
      { kind: "rss", title: "arXiv cs.LG", url: "https://export.arxiv.org/rss/cs.LG", tags: ["论文", "机器学习"] },
      { kind: "rss", title: "arXiv cs.CL", url: "https://export.arxiv.org/rss/cs.CL", tags: ["论文", "NLP"] },
      { kind: "rss", title: "arXiv cs.CV", url: "https://export.arxiv.org/rss/cs.CV", tags: ["论文", "视觉"] },
      { kind: "rss", title: "arXiv stat.ML", url: "https://export.arxiv.org/rss/stat.ML", tags: ["论文", "统计"] },
      { kind: "rss", title: "Papers With Code", url: "https://paperswithcode.com/latest.xml", tags: ["论文", "开源"] },
      { kind: "rss", title: "Distill Blog", url: "https://distill.pub/rss.xml", tags: ["深度", "可视化"] },
      { kind: "search", title: "算法新论文", query: "machine learning algorithm paper 2025", tags: ["聚合"] },
      { kind: "github", title: "GitHub ML Trending", url: "https://github.com/trending/python.atom?since=weekly", tags: ["GitHub", "热门"] },
      { kind: "reddit", title: "r/MachineLearning", url: "https://www.reddit.com/r/MachineLearning/.rss", tags: ["Reddit", "学术"] }
    ]
  },
  {
    id: "finance-market",
    label: "金融市场",
    icon: "stats",
    accent: "gold",
    title: "全球金融市场雷达",
    category: "金融",
    cadence: "daily",
    summary: "聚合全球主要金融媒体、宏观经济与市场动态，覆盖外汇、大宗商品和债券市场。",
    keywords: "金融，市场，美联储，利率，通胀，汇率，债券，大宗商品",
    negativeKeywords: "广告，理财产品，贷款，优惠",
    digestPrompt: "按市场影响层级归纳：宏观政策变化 > 市场结构性信号 > 短期波动，标注值得持续关注的风险或机会。",
    sources: [
      { kind: "rss", title: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews", tags: ["国际", "宏观"] },
      { kind: "rss", title: "Financial Times", url: "https://www.ft.com/rss/home", tags: ["国际", "金融"] },
      { kind: "rss", title: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss", tags: ["市场", "数据"] },
      { kind: "rss", title: "WSJ Markets", url: "https://feeds.content.dowjones.io/public/rss/mktw_realtimeheadlines", tags: ["市场"] },
      { kind: "rss", title: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", tags: ["市场"] },
      { kind: "search", title: "全球金融动态", query: "global financial market macro 2025", tags: ["聚合"] },
      { kind: "search", title: "美联储政策", query: "美联储 货币政策 利率", tags: ["聚合"] },
      { kind: "reddit", title: "r/investing", url: "https://www.reddit.com/r/investing/.rss", tags: ["Reddit", "投资"] },
      { kind: "reddit", title: "r/economics", url: "https://www.reddit.com/r/economics/.rss", tags: ["Reddit", "经济"] }
    ]
  },
  {
    id: "a-share-market",
    label: "A股市场",
    icon: "stats",
    accent: "gold",
    title: "A股与中国资本市场",
    category: "金融",
    cadence: "daily",
    summary: "追踪 A 股行情、监管政策、上市公司公告和主要券商研报动态。",
    keywords: "A股，上证，深证，创业板，科创板，监管，基金，IPO",
    negativeKeywords: "广告，理财，贷款，炒股神器",
    digestPrompt: "区分政策面信号、资金流向和个股重大公告，标注可能影响指数方向的核心因素。",
    sources: [
      { kind: "rss", title: "证监会新闻", url: "https://www.csrc.gov.cn/csrc/c100028/zfxxgk_zdgk.shtml", tags: ["监管", "官方"] },
      { kind: "rss", title: "新浪财经", url: "https://rss.sina.com.cn/news/china/finance1.xml", tags: ["综合", "财经"] },
      { kind: "search", title: "A股市场动态", query: "A股 市场 行情 监管 政策", tags: ["聚合"] },
      { kind: "search", title: "中国经济数据", query: "中国经济 GDP 通胀 PMI 数据", tags: ["聚合"] },
      { kind: "search", title: "上市公司重大公告", query: "上市公司 重大公告 并购 增发", tags: ["聚合"] }
    ]
  },
  {
    id: "world-politics",
    label: "政治外交",
    icon: "globe",
    accent: "cyan",
    title: "全球政治与外交雷达",
    category: "政治",
    cadence: "daily",
    summary: "追踪主要国家政治动向、地缘冲突、外交谈判与国际组织动态。",
    keywords: "地缘政治，外交，制裁，谈判，选举，冲突，峰会，联合国",
    negativeKeywords: "广告，娱乐，体育",
    digestPrompt: "按地区和重要性分类，标注对全球经济或科技格局有直接影响的政治事件。",
    sources: [
      { kind: "rss", title: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews", tags: ["国际", "综合"] },
      { kind: "rss", title: "BBC World News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", tags: ["国际", "BBC"] },
      { kind: "rss", title: "AP Top News", url: "https://rsshub.app/apnews/topics/ap-top-news", tags: ["国际", "AP"] },
      { kind: "rss", title: "Foreign Affairs", url: "https://www.foreignaffairs.com/rss.xml", tags: ["外交", "深度"] },
      { kind: "rss", title: "外交部发言", url: "https://www.fmprc.gov.cn/web/fyrbt_673021/rss_674481.xml", tags: ["官方", "中国外交"] },
      { kind: "search", title: "地缘政治动态", query: "geopolitics diplomacy sanctions conflict 2025", tags: ["聚合"] },
      { kind: "search", title: "中美关系", query: "中美关系 贸易 外交 谈判", tags: ["聚合"] }
    ]
  },
  {
    id: "biotech-frontier",
    label: "生物科技",
    icon: "flask",
    accent: "gold",
    title: "生物科技前沿雷达",
    category: "生物",
    cadence: "weekly",
    summary: "追踪生物技术、基因编辑、药物研发、合成生物学与生命科学最新进展。",
    keywords: "基因编辑，CRISPR，蛋白质，药物，临床试验，合成生物，细胞治疗",
    negativeKeywords: "广告，招聘，课程",
    digestPrompt: "提炼技术突破点和临床进展，标注离商业化或临床应用最近的研究方向。",
    sources: [
      { kind: "rss", title: "bioRxiv Bioinformatics", url: "https://connect.biorxiv.org/biorxiv_xml.php?subject=bioinformatics", tags: ["预印本", "生信"] },
      { kind: "rss", title: "bioRxiv Cell Biology", url: "https://connect.biorxiv.org/biorxiv_xml.php?subject=cell_biology", tags: ["预印本", "细胞"] },
      { kind: "rss", title: "Nature Biotechnology", url: "https://www.nature.com/nbt.rss", tags: ["顶刊", "生物技术"] },
      { kind: "rss", title: "Science Translational Med", url: "https://www.science.org/rss/stm.xml", tags: ["顶刊", "转化医学"] },
      { kind: "rss", title: "arXiv q-bio", url: "https://export.arxiv.org/rss/q-bio", tags: ["论文", "计算生物"] },
      { kind: "search", title: "生物技术突破", query: "biotech breakthrough CRISPR gene therapy 2025", tags: ["聚合"] },
      { kind: "search", title: "新药研发进展", query: "新药 临床试验 FDA 审批 突破", tags: ["聚合"] }
    ]
  },
  {
    id: "agriculture-food",
    label: "农业食农",
    icon: "flask",
    accent: "cyan",
    title: "农业与食农科技雷达",
    category: "农业",
    cadence: "weekly",
    summary: "追踪精准农业、食品科技、粮食安全、农业政策与农业生物技术的最新进展。",
    keywords: "农业，粮食，精准农业，食品科技，转基因，种业，病虫害，气候农业",
    negativeKeywords: "广告，招聘，课程",
    digestPrompt: "区分政策、技术突破和产业化动态，标注对粮食安全或农业生产率有重大影响的进展。",
    sources: [
      { kind: "rss", title: "FAO News", url: "https://www.fao.org/news/rss-feed/en/", tags: ["官方", "粮农组织"] },
      { kind: "rss", title: "USDA Blog", url: "https://www.usda.gov/media/blog/rss.xml", tags: ["官方", "美国农业"] },
      { kind: "rss", title: "AgFunder News", url: "https://agfundernews.com/feed", tags: ["农业科技", "投资"] },
      { kind: "rss", title: "Food Navigator", url: "https://www.foodnavigator.com/rss/editorial/FoodNavigator.com", tags: ["食品", "科技"] },
      { kind: "search", title: "精准农业技术", query: "precision agriculture technology AI crop 2025", tags: ["聚合"] },
      { kind: "search", title: "粮食安全动态", query: "粮食安全 农业政策 种业 育种", tags: ["聚合"] },
      { kind: "search", title: "农业生物技术", query: "agricultural biotech GMO gene editing crop", tags: ["聚合"] }
    ]
  },
  {
    id: "quantum-physics",
    label: "量子与物理",
    icon: "zap",
    accent: "cyan",
    title: "量子计算与物理前沿",
    category: "物理",
    cadence: "weekly",
    summary: "追踪量子计算、量子通信、凝聚态物理和高能物理的最新研究突破。",
    keywords: "量子计算，量子纠错，量子通信，超导，凝聚态，粒子物理",
    negativeKeywords: "广告，招聘，课程",
    digestPrompt: "标注里程碑式实验结果和理论突破，区分工程实现进展和基础理论研究。",
    sources: [
      { kind: "rss", title: "arXiv quant-ph", url: "https://export.arxiv.org/rss/quant-ph", tags: ["论文", "量子"] },
      { kind: "rss", title: "arXiv cond-mat", url: "https://export.arxiv.org/rss/cond-mat", tags: ["论文", "凝聚态"] },
      { kind: "rss", title: "arXiv hep-th", url: "https://export.arxiv.org/rss/hep-th", tags: ["论文", "高能"] },
      { kind: "rss", title: "Physical Review Letters", url: "https://feeds.aps.org/rss/recent/prl.xml", tags: ["顶刊", "物理"] },
      { kind: "rss", title: "Nature Physics", url: "https://www.nature.com/nphys.rss", tags: ["顶刊", "物理"] },
      { kind: "search", title: "量子计算突破", query: "quantum computing qubit breakthrough 2025", tags: ["聚合"] }
    ]
  }
];
export function findInfoRadarWindowPreset(presetId) {
  return INFO_RADAR_WINDOW_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function createInfoRadarWindowDraftFromPreset(preset, createLocalId = createFallbackLocalId) {
  if (!preset) {
    return createInfoRadarWindowDraft(createLocalId);
  }

  return createInfoRadarWindowDraft(createLocalId, {
    title: preset.title,
    category: preset.category,
    cadence: preset.cadence,
    summary: preset.summary,
    keywordsText: preset.keywords,
    negativeKeywordsText: preset.negativeKeywords,
    digestPrompt: preset.digestPrompt,
    sources: (preset.sources ?? []).map((source) => ({
      kind: source.kind ?? "rss",
      title: source.title ?? "",
      url: source.url ?? "",
      query: source.query ?? "",
      enabled: true,
      tags: source.tags ?? []
    }))
  });
}

export function createInfoRadarWindowDraft(createLocalId = createFallbackLocalId, overrides = {}) {
  return {
    title: overrides.title ?? "",
    summary: overrides.summary ?? "",
    category: overrides.category ?? "技术",
    status: overrides.status ?? "active",
    cadence: overrides.cadence ?? "manual",
    keywordsText: Array.isArray(overrides.keywords) ? overrides.keywords.join("，") : overrides.keywordsText ?? "",
    negativeKeywordsText: Array.isArray(overrides.negativeKeywords)
      ? overrides.negativeKeywords.join("，")
      : overrides.negativeKeywordsText ?? "",
    digestPrompt: overrides.digestPrompt ?? "",
    sources: Array.isArray(overrides.sources)
      ? overrides.sources.map((source) => createInfoRadarSourceDraft(source, createLocalId))
      : [createInfoRadarSourceDraft({}, createLocalId)]
  };
}

export function createInfoRadarWindowDraftFromWindow(window, createLocalId = createFallbackLocalId) {
  return createInfoRadarWindowDraft(createLocalId, {
    title: window?.title ?? "",
    summary: window?.summary ?? "",
    category: window?.category ?? "综合",
    status: window?.status ?? "active",
    cadence: window?.cadence ?? "manual",
    keywords: window?.keywords ?? [],
    negativeKeywords: window?.negativeKeywords ?? [],
    digestPrompt: window?.digestPrompt ?? "",
    sources: window?.sources ?? []
  });
}

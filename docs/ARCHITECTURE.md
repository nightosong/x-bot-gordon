# Gordon 项目架构与功能说明

## 1. 项目定位

Gordon 是一个面向持续演进的工作助手，当前以桌面端和 CLI 为主要运行形态。

核心目标：

- 提供统一的工作入口，承接首页、模型管理、任务笔记和后续能力扩展
- 把参考资料和执行经验沉淀成可复用的本地资产
- 以统一领域模型承接不同供应商、不同工作模块和不同运行端

## 2. 当前目录结构

| 目录 | 作用 |
|---|---|
| `apps/desktop` | Electron 桌面端，当前已升级为 `Electron ^41.2.1 + Vue ^3.5.32`，并保持原有工作台布局与视觉风格 |
| `apps/cli` | CLI 入口，支持摘要、模块、Provider、Memory 等命令 |
| `packages/agent` | Agent 首版执行编排，负责 Agent + Skill 运行链 |
| `packages/core` | Gordon 产品蓝图与工作台快照聚合 |
| `packages/providers` | 模型供应商目录与接入元数据 |
| `packages/memory` | 参考资料库、经验库的读写 |
| `packages/workbench` | 工作模块、任务、数据库连接、流程中心、模型配置与能力拓展配置仓储 |
| `packages/shared` | 共享类型、路径工具等基础定义 |
| `prompts` | 系统内置提示词资产目录，主要承接 Agent、工作台级提示词与应用级 prompt 资产 |
| `skills` | 系统内置 Skill 资产目录，随应用打包；只承接内置 Skill，不作为用户自定义 Skill 的写入位置 |
| `~/.gord` | Gordon 用户主目录，启动时自动初始化，当前承接用户 Skill、配置、工作台数据、缓存和日志；用户手动新增、GitHub 导入或外部加载的 Skill 一律落在 `~/.gord/skills` |
| `data` | 旧版开发期本地 JSON 数据目录；当前只作为历史迁移来源和本地备份，不再作为默认运行数据根 |
| `docs` | 项目架构说明、开发进度清单与界面风格约束 |

## 3. 运行形态

### 桌面端

- 入口文件：`apps/desktop/src/main.ts`
- 渲染层：`apps/desktop/src/renderer`
- 渲染层功能模块目录：`apps/desktop/src/renderer/src/features`
  - `shell`：桌面壳层导航、功能入口、首页机器人舞台、工作台快照启动 / 刷新与根级 watcher 接线
  - `model-management`：模型管理页面组件、模型编辑状态、余额 / 用量运行态、Provider 字段配置与页面事件 actions 归属
  - `weekly`：任务笔记 / 任务清单的页面组件、配置、初始状态、任务树运行时 helper、日报 / 周报 / 述职报告辅助转换、编辑器同步、自动保存、报表输出状态、页面事件 actions 与后续业务逻辑归属
  - `command-workshop`：命令工坊页面组件、会话草稿、输入区状态、附件上下文拼装、Agent 消息转换、会话动作与运行编排归属
  - `workflow-library`：流程中心页面组件、信息雷达窗口配置、金融快报行情状态、直播流房间配置、workflow 配置、环境草稿、请求步骤草稿、curl / Body 解析、信息刷新 / 金融行情 / 直播页加载 / 运行结果展示 helper、页面事件 actions 与执行编排归属
  - `marketplace`：应用广场页面组件、小说 / 漫画 / 视频 / 音乐 / 运势占卜应用入口配置、项目型应用通用封面管理、应用 Gordon 处理层、共享 AI 助手操作条、共享过程流组件、应用上下文 provider、漫画与视频项目 actions、音乐创作与运势解读 actions 与应用级状态归属
  - `writing`：`墨笔生花` 的配置、prompt 构建、书稿基础 actions、AI 工作流 actions 与 AI 抽屉组件
  - `extensions`：能力拓展页面组件、Agent / Skill / MCP / TOOL 编辑状态、Runner 状态与页面事件 actions 归属
- 当前能力：
  - 基于 Vue 的桌面端工作台壳层
  - 保留原有“左侧品牌卡 + 功能卡 / 右侧工作区”的主布局
  - 首页机器人工作区、模型管理、任务笔记、流程中心、命令工坊、能力拓展六大页面语义
  - 模型管理页面
  - 任务笔记页面
  - 应用广场页面，当前已接入写作助手“墨笔生花”、漫画创作应用“丹青溢彩”、视频生成应用“流光绘影”、音乐创作应用“瑶琴映月”和占卜运势应用“灵犀照命”入口
  - 应用广场应用级 AI 助手统一使用 `AiAssistantActionBar.vue` 表达“状态 / 快速模式 / Gordon 处理”三段动作；快速模式负责轻量生成或专用工具调用，Gordon 处理负责默认 Agent 主导的深度任务推进，其中墨笔生花显式结合内置 `writing` Skill，丹青溢彩显式结合内置 `comic` Skill
  - 应用广场字段级 AI 优化能力，支持在具体编辑框旁唤起紧凑悬浮面板，调用优先模型生成结果并替换或追加回当前字段
  - 应用广场项目型资产通用封面能力，墨笔生花书籍、丹青溢彩漫画项目、流光绘影视频项目和瑶琴映月音乐专辑均支持封面 URL、本地上传、`image_gen` 生成、草稿预览、确认写回和下载；灵犀照命当前为对话态应用，暂不挂项目封面
  - 流程中心页面，当前包含信息雷达、金融快报、直播流与模型接口测试四类入口：信息雷达用于维护动态信息窗口、RSS / 网页 / 搜索 / 公众号线索来源、关键词过滤、刷新结果和信息流可视化；金融快报用于查询黄金、股票等金融标的行情并展示 K 线快照；直播流用于收藏 Bilibili、小红书等固定直播页并在右侧原生网页舞台观看；模型接口测试继续承接独立 curl 工作流舞台
  - 命令工坊页面
  - 命令工坊输入区附件上传，支持图片、视频、文本、文档、表格和数据类文件作为会话上下文
  - 能力拓展管理页面
  - 本地 JSON 持久化的模型配置、拖拽排序与优先模型设置
- 模型配置支持 Chat Completions / Responses 接口格式选择与流式输出开关，默认启用流式；命令工坊和单独生成入口都会按模型配置决定是否请求流式输出，遇到不兼容 `stream=true` 的代理网关时可按模型关闭
  - 基于优先模型的大模型文本调用能力
  - 已配置本地 macOS 打包链路：`pnpm run dist:mac` 先构建桌面端，再通过 `electron-builder` 生成 ad-hoc 本地签名 DMG，产物输出到 `release/`；渲染层 Vite 构建会清理旧 hash 产物，避免历史构建文件被 `dist/**/*` 打进安装包；若只需要保留安装包，可使用 `pnpm run dist:mac:clean` 在打包后清理 `mac-arm64 / *.blockmap / latest-mac.yml / builder-debug.yml` 等辅助产物；打包产物只携带 `prompts / skills / scripts` 等内置资源，不携带仓库旧版 `data/`，首次启动会自动初始化 `~/.gord` 并使用 `~/.gord/data` 作为工作台数据根，用户 Skill 统一放在 `~/.gord/skills`
  - Agent + Skill 测试运行与执行日志
  - Gordon 自绘确认 / 提醒窗口，覆盖权限申请、删除确认与关键失败提醒，避免回退到系统默认窗体

### CLI

- 入口文件：`apps/cli/src/index.ts`
- 当前命令：
  - `summary`
  - `providers`
  - `modules`
  - `tasks`
  - `memory list <references|experience>`
  - `memory add <references|experience> <title> <summary> [tag1,tag2]`

## 4. 核心分层

### 4.1 Core

`packages/core`

负责 Gordon 的产品蓝图、定位信息和工作台聚合快照。

当前输出重点：

- Gordon 身份定义
- 运行端定义
- 多模态目标
- 设计原则
- 未来扩展方向
- 汇总 Provider、Memory、Task、Workbench 数据

### 4.1 Agent

`packages/agent`

负责 Gordon 当前首版 Agent 执行编排：

- 读取 Agent / Skill / MCP / 模型配置
- 绑定 Agent 的系统提示词与指定 Skill
- 调用模型完成一次测试运行
- 记录执行步骤与执行日志

当前约束：

- 已接通单轮 Agent + Skill + MCP Tool 运行链
- MCP 已支持“手动指定工具”与“模型自动选工具”两种单轮执行方式
- 当前自动选择已支持最多 6 轮的有限自动编排，并带有重复调用保护
- 已加入基础失败恢复：MCP 调用失败会记录为失败结果，并参与后续停止判断
- 已加入基础重试机制：针对可重试错误会进行有限次数退避重试
- 已加入 schema-aware（基于 schema 的）参数修复，可在工具参数不匹配时尝试一次受控修复
- 已加入 fallback tool 策略：当当前 tool 失败时，会在剩余候选中规划替代工具接管当前轮次
- 当前错误分流已细化为“可重试 / schema 不匹配 / 工具不可用 / 工具执行失败 / 权限受限 / 环境状态变化 / 工具不匹配 / 时序过早 / 目标不存在”等路径，并落到执行日志和前端标签
- 命令工坊运行链已按 harness Agent 语义收敛：自动工具模式会把当前 Agent 授权的完整工具集合交给工具规划模型，由模型判断是否需要工具以及选择哪个工具；代码层负责权限授权、安全边界、参数修复、重试、fallback、重复调用保护和执行记录，不再用硬编码规则预先裁剪工具候选集；工具候选会先转成 `capability / verbs / executionDomain / riskLevel / cost / sideEffects / reversibility / descriptionSummary / schema` 结构化元数据，并清洗工具描述中的 prompt-injection 式文本；没有外部 MCP 时不再显示“已接入 MCP”
- 自动工具循环已引入首版任务账本（Task Ledger）：运行时会维护 `taskPhase / objective / constraints / completedSubtasks / pendingSubtasks / activePlan / decisionMemory / decisionTrace / observations / evidenceGraph / discoveredFacts / failedAttempts / environmentState / userInterruptions / successCriteria / structuredSuccessCriteria / nextActionHint`，工具规划模型每轮都会看到当前账本，并为下一次工具调用返回 `expectedOutcome` 与 `verificationMethod`；其中 `decisionMemory` 作为工作记忆记录已放弃路线、已证伪假设、已采纳判断和关键恢复策略，active 记忆会持续注入规划，只有新证据出现时才由模型标记为 `superseded`，避免长链路里重复同一失败路径；工具返回后会通过模型压缩观察结果并更新账本，最终回复也会结合账本判断完成状态，避免长链路中丢失目标、阶段、决策依据、分层观察、成功条件和失败恢复线索；命令工坊会把上一轮助手消息中的 `taskLedger` 作为下一轮 `AgentRunRequest.taskLedger` 注入，让同一会话的长期任务可以跨轮延续
- 自动工具循环已引入首版 Context Packet：运行时会把最新用户请求、最近会话、任务账本、Decision Memory、Evidence Graph、观察证据、工具历史、验证状态、失败恢复和开放问题压缩为统一 JSON 上下文，注入工具规划、工具结果压缩、fallback、主动验证和最终回复节点；这让模型每轮优先读取 `goal / constraints / plan / decisionMemory / evidence / verification / recovery / openQuestions`，而不是从冗长聊天记录里重新拼任务状态
- 自动工具循环已引入 Capability Routing（能力路由）与 Planner Tool View（规划器可见工具视图）：runtime 会基于 Context Packet 推断当前能力需求，并按能力、动作、执行域、成本、风险、副作用和可逆性对工具做分组排序，最终只把本轮相关的可见工具白名单注入 Planner、fallback planner 和主动验证节点；路径拼接、相对路径、桌面点击 / 输入 / 按键等低层原语默认下沉为 runtime/工具服务内部能力，不再每轮直接暴露给模型选择
- 自动工具循环已引入 Tool Requirement Engine（工具需求引擎）：Runtime 会在通用 Planner 之前把本轮判定为 `optional / required`，并对 URL / 最新官网资料 / 价格来源、workspace 文件与代码、桌面应用、媒体生成、墨笔生花 / 丹青溢彩应用资产等强工具任务建立硬约束；`required` 场景下 Planner 只能选择如何满足工具需求，不能以 `shouldCall:false` 直接回答，若 Planner 拒绝、返回无效计划或超时，Runtime 会尝试按能力路由和 schema 生成 required fallback 工具计划，仍无法安全补齐参数时才进入 safe failure，并要求最终回复说明 required 工具步骤未执行
- 自动工具循环已引入 Task Continuation Engine（任务延续引擎）：Runtime 会在通用 Planner 前把本轮输入分类为 `new_task / continuation / direction_change`；当用户输入“继续 / 接着做 / 继续修 / 把剩下的做完”等延续信号，且上一轮 `taskLedger` 仍有 `pendingSubtasks / activePlan / structuredSuccessCriteria / nextActionHint` 等可执行状态时，会保留上一轮目标、计划和下一步提示，并尝试通过 Resource Gateway、Capability Routing 与 required fallback 直接构造下一步工具调用，跳过通用资源任务 Planner；若用户提出新的具体目标、明确转向，或账本状态无法安全映射为工具参数，则创建新任务账本并回到 Requirement + Planner 路径
- Agent Runtime 已引入 Resource Registry（资源注册表）与 Resource Gateway（资源网关）第一阶段，命令工坊会把用户目标、会话、任务账本和工具历史识别成 `codebase.project / workspace.filesystem / web.source / desktop.app / artifact.output / media.asset / writing.book / comic.project / conversation.thread` 等资源候选，并通过 Resource Resolver（资源解析器）抽取文件路径、URL、桌面应用、生成任务 ID、artifact、小说书稿、章节、漫画项目和漫画章节等 `resolvedRefs`；同时 Capability Registry（能力注册表）会按资源类型生成 `codebase.inspect / codebase.edit / codebase.verify / web.research / desktop.inspect / desktop.operate / media.generate / writing.review_continuity / writing.update_asset / comic.import_story / comic.read_project / comic.split_storyboard / comic.render_images` 等能力声明，并在 Context Packet 中注入 `resources.primaryResource / candidates / resolvedRefs / capabilityRegistry / capabilityFrame / gatewayPlan / routingPolicy`；其中 `gatewayPlan` 会把当前资源能力组织为 inspect / act / verify 步骤，提供 `toolBias / argumentHints / verificationBias`，让 Planner、fallback planner 和主动验证节点优先围绕同一资源、同一能力路线推进，再选择具体工具；Planner 提示已从单纯“工具规划器”升级为“资源任务规划器”，按 Resource -> Capability -> Tool 的顺序规划，让 Gordon 更接近 Codex / OpenClaw 式桌面 Agent 助手：代码项目、网页来源、桌面应用、生成产物和应用资产都是可持续推进的资源，工具只是执行落地方式
- 当前 Agent runtime 已形成 Task Continuation / Requirement / Planner / Critic / Executor / Verifier 的最小分层：Task Continuation Engine 负责判断是否恢复当前任务执行状态；Tool Requirement Engine 负责判断本轮是否必须用工具；Planner 只在新任务、方向变化或不安全恢复时负责在 Planner Tool View 中选择工具、记录决策轨迹和账本 patch；Plan Critic 负责在执行前检查 required 工具约束、active Decision Memory、`expectedOutcome / verificationMethod` 和近期重复调用，但不负责高风险动作拒绝；Executor 负责权限授权、安全边界、参数修复、重试和 fallback，高风险写入、生成、执行或删除类工具会进入 Gordon 自绘授权弹窗，用户允许后继续执行，拒绝后以权限受限失败进入恢复链；Verifier 已从任务账本中独立出来，会根据工具历史对 `tool_result / artifact_created / artifact_exists / command_passed / command_exit_zero / file_contains / file_exists / url_opened / url_matches / ui_state / ui_contains / json_path_equals` 等结构化成功条件更新状态，并输出 verification evidence（验证证据）回写到任务账本的 discovered facts 与 Evidence Graph，避免直接把“模型认为完成”当作真实完成；主动验证规划只作为确定性工具历史验证后的兜底动作，Runtime 会先判断剩余 pending / unknown 条件是否属于 `file_exists / file_contains / command_exit_zero / url_matches / ui_contains / json_path_equals` 等可行动硬断言，泛化 `tool_result`、已有 artifact 或缺少明确 target / expected 的弱条件不会再启动 LLM 规划；若主动验证规划超时或异常，会降级为最终回复整理并写入账本提示，不作为用户可见复盘卡片展示；验证策略上下文提供每类成功条件的 intent、能力偏好、执行域偏好、风险边界、参数提示、证据要求和失败信号，主动验证完成后会基于工具画像、成功条件状态变化和 evidence 质量生成 `qualityScore / riskLevel / evidenceGrade` 摘要并回写账本，供后续恢复或最终回复判断使用
- 结构化成功条件已升级到 v2：新任务优先使用 `file_exists / command_exit_zero / artifact_exists / url_matches / ui_contains / json_path_equals` 等更确定的断言类型，旧的 `file_contains / command_passed / artifact_created / url_opened / ui_state` 继续兼容；Verifier 会对文件存在、命令退出码、artifact 可引用、URL 匹配、UI 文本和简单 JSON 点路径做确定性判断，降低只靠自然语言包含匹配收尾的比例
- Evidence Graph 由 runtime 根据真实工具结果和验证结果生成，模型可在 Context Packet 中读取，但不能通过 ledger patch 直接伪造证据节点；首版节点包含 `kind / claim / source / evidenceRefs / confidence / durability / createdAt`，用于把“为什么相信这个事实”从普通摘要升级为可引用工作记忆
- `packages/agent/src/runtime.ts` 当前只保留运行编排、权限、Skill Handler、工具执行和最终回复组装；任务账本、Resource Registry、Context Packet、Capability Routing、Task Continuation Engine、Tool Requirement Engine、Evidence Graph、Plan Critic、工具元数据、失败分类和成功条件验证分别拆到 `ledger.ts`、`resource-registry.ts`、`context-packet.ts`、`capability-router.ts`、`task-continuation.ts`、`tool-requirement.ts`、`evidence-graph.ts`、`plan-critic.ts`、`tool-metadata.ts`、`failure-classifier.ts` 与 `verifier.ts`，并通过 `pnpm run test:agent` 覆盖关键纯逻辑和 runtime 级集成回归；当前集成回归会用本地假模型与假 MCP 服务跑完整 `runAgent` 自动工具链，验证 Planner Tool View 收敛候选后 Computer Use 仍可被模型选择执行，且 required workspace 任务在 Planner 超时或“继续”恢复时会由 Runtime fallback 执行工具
- 默认 Gordon Agent 已按持续执行型工程 Agent 重新组织系统提示词：通过 Discuss / Explore / Research / Execute / Verify 模式、目标状态维护、约束集收敛、局部上下文读取、工具优先级树、默认验证、失败恢复和停止条件，约束其持续推进任务到可验证结果，而不是把可执行任务降级为建议
- 内置 `arthur-research` Skill 承接原 Arthur Research OS 科研能力，作为 Gordon 可加载的科研协作技能，而不是独立 Agent；它面向问题发现、假设形成、创新性拆解、证据验证、早期错误方向识别、论文写作、审稿评价、rebuttal（审稿回复）和投稿打磨，并通过 `references/` 拆分 Research OS 生命周期与 claim 控制、核心研究协议、研究模式、审稿模拟、研究台账和化工结晶领域适配；旧 Arthur 会话会兼容迁移到 Gordon + `arthur-research`
- 内置 `Gordon Tools` 作为能力工具服务接入默认 Agent，会按能力拓展 TOOL 配置动态暴露已启用工具；当前 `image_gen` 可通过 OpenAI 系列图片配置调用 `imagen` / `imagen/edit` 并同步返回图片产物，图生图会按上游要求使用 multipart 图片字段上传引用图，支持 URL、data URL、base64 和本地图片文件输入；`video_gen` 可通过 Seedance 配置提交文生视频、首帧生视频、首尾帧生视频、参考图生视频任务，支持提交接口、轮询接口、`taskIdPath` 和 `resultUrlPath` 配置，`submit / query` 默认都会执行工具层短轮询并把 `pending / completed / pollExhausted / pollFailed / pollHistory` 写入结构化结果，`music_gen` 可通过 Mureka / Suno 配置发起歌曲 / 配乐生成或查询任务，生成与查询同样默认在工具层短轮询并尽量一次调用返回音频 URL
- 内置 `Application Tools` 作为应用广场资产工具服务接入默认 Agent，当前支持 `墨笔生花` 小说书稿的新建、列表读取、章节读取、全文检索、章节修改预览 / 写回、书籍字段修改预览 / 写回和故事资产写回；同时支持 `丹青溢彩` 漫画项目新建、来源元数据记录、批量章节导入、项目/章节/素材/图片读取、项目字段预览 / 写回、实际章节实体创建、已有章节分镜轨道预览 / 写回、分镜图片追加 / 替换和素材库合并 / 替换。写回优先走工作台仓储能力。若 Application Tools 不可用、未覆盖目标能力或调用失败，Agent 可 fallback 到 `Workspace Tools` 直接维护 `~/.gord/data/workbench` 下的应用数据文件，并在写入后校验关键 JSON 可解析
- 内置 `Search Tools` 作为独立联网搜索与研究工具服务接入默认 Agent，提供 `web_search_v2`、`web_research` 与 `github_search_repositories`：优先使用 Tavily / Brave Search / Serper / SearXNG API，缺少配置时回退 Bing / Baidu / Google；`web_research` 会执行多查询、官方域名过滤 / 偏好、去重排序、落地页正文读取和页面内相关链接发现，适合最新事实、官方文档、技术 / 产品调研和带来源结论；GitHub 仓库搜索直接走 GitHub API，适合开源项目、参考实现和生态对比；对于 Anthropic / Claude 等厂商当前模型清单、价格和发布状态，Runtime 会优先生成英文官方查询、限制官方域名并传入官方 pinned source URL，Search Tools 会在泛搜索前直接读取模型总览、价格、Release Notes 与关键发布公告；返回结果还会经过官方域名、实体相关性和证据充分性门禁，模型/价格任务必须包含来源正文、模型名称或 API ID、价格数字等信号，无关词典页、第三方噪声或仅命中官网首页都不会被当作有效证据
- 命令工坊会话消息已支持附件元数据沉淀；桌面端主进程负责文件选择、基础类型识别和正文提取，并把可读取内容注入本轮 Agent 上下文
- 命令工坊会保留工具调用返回的结构化产物，图片、音频、视频生成类工具返回的 URL 或 base64 数据会在助手消息下方直接展示为生成结果预览
- 命令工坊 AI 回复支持从消息底部操作组导出为本地 PDF 或 DOCX：PDF 由桌面端主进程通过 Electron 打印引擎按 A4 文档样式生成，保留富文本层级、表格、代码块和轻量公式渲染；DOCX 通过本地文档包生成，优先作为可继续编辑的结构化 Word 文档
- 命令工坊用户可见执行链路已收敛为按需轻量过程流：简单问答不展示开场思考卡片，真实出现工具执行、权限授权、参数修复、重试 / fallback、停止原因或最终整理时才按时间线展示；成功工具调用默认只呈现动作标题、目标摘要和状态标签，原始返回保留在 artifact 中，错误、授权异常和停止原因才提供可展开输出；底部不再重复展示关键动作详情链
- 命令工坊输入区提供访问权限模式选择，默认 `无需申请`：当前 Agent 运行会自动授予外部路径、Computer Use 与高风险工具的本轮运行时权限，不写入长期配置，Runtime 会直接进入执行与必要重试；用户可切换为 `按需申请`，恢复执行前 Gordon 自绘授权确认
- 命令工坊运行时引导会在工具规划前、工具返回后、主动验证前、最终回复前和最终回复生成后继续被消费；若最终回复流式生成期间收到用户引导，Runtime 会撤回当前回复草稿、重新评估工具需求，必要时通过 required fallback 补充真实工具结果后再重新生成最终回复
- 内置工作区工具访问仓库外路径时会触发 Gordon 风格的桌面端本轮授权弹窗，用户允许后会把授权目录注入当前工具调用并自动重试
- 内置 `Workspace Tools / web_search` 保留为基础搜索兜底；需要高质量联网研究时由 Agent 工具规划优先选择 `Search Tools / web_research`
- 内置工作区工具已补充 `read_web_page`、`inspect_path`、`diff_paths` 与受限 `run_shell_command`，优先通过专用工具处理 URL、路径检查和文件对比，白名单命令仅作为诊断兜底
- 内置 `Computer Use` 作为独立本地工具服务接入默认 Agent，可读取应用状态、打开应用/URL、等待页面加载、按可见文本点击、点击窗口相对区域、尝试播放网页媒体、点击、输入、按键和截屏；首次读取或控制桌面会触发 Gordon 风格的本轮授权弹窗
- 当前仍未进入开放式无限循环，fallback 也保持在有限轮次内的受控恢复
- MCP `http` 端当前优先支持 JSON 响应，同时兼容基础 SSE 响应解析

### 4.2 Providers

`packages/providers`

负责模型供应商目录定义，当前支持：

- OpenAI
- Azure
- Anthropic
- Google
- 豆包
- 千问
- DeepSeek
- 月之暗面
- 智谱
- Grok
- OpenAI-like

说明：

- `openai_like` 用于兼容 OpenAI 协议的网关或第三方模型服务
- Azure 当前走独立 Azure 推理链路，其余豆包 / 千问 / DeepSeek / 月之暗面 / 智谱 / Grok 走 OpenAI-compatible 兼容链路
- 当前已接入统一文本调用链，按 Provider 适配 OpenAI-compatible / Azure / Anthropic / Google 四类请求路径
- 文本调用链默认输出预算统一为 `32k`（`32768`）tokens；调用方显式传入 `maxOutputTokens` 时仍以调用方为准
- OpenAI-compatible 调用链支持 `chat_completions` 与 `responses` 两种接口格式；Responses 模式会请求 `/responses`，使用 `input` / `instructions` 请求体并自动带稳定 `prompt_cache_key`
- 文本调用链的非流式响应会先按原始文本读取，再兼容解析 JSON 或 SSE 事件文本；Responses 模式额外兼容第三方网关在 `/responses` 上返回 Chat Completions 风格 `choices[].delta.content / reasoning_content` 或仅在最终完成事件里返回 `response.output_text` 的情况；如果当前模型配置的接口格式返回空文本或协议错误，会直接按该配置报错，不再自动改打另一种接口格式
- 图像、视频、音乐、TTS（语音合成）、ASR（语音识别）等多模态服务不作为模型管理配置类型维护；内置生成能力优先沉淀在能力拓展的 TOOL 配置中，后续通过 MCP tool 接入 Agent 调用链

### 4.3 Memory

`packages/memory`

负责双层记忆体系：

- `references`：参考资料库
- `experience`：经验库

当前存储位置：

- `~/.gord/data/memory/references.json`
- `~/.gord/data/memory/experience.json`

### 4.4 Workbench

`packages/workbench`

负责工作模块与本地仓储能力，当前包含：

- 工作模块定义
- 任务列表
- 按周归档的任务笔记、周报和述职报告记录
- 面向日报 / 周报 / 述职报告的项目级任务树、任务状态与阶段备注
- 数据库连接列表
- 流程中心资产、信息雷达窗口与可复用 curl 工作流记录
- 模型配置列表
- 优先模型设置
- Skill 配置列表
- MCP Server 配置列表
- TOOL 配置列表
- Agent 配置列表
- 内置 Gordon Agent、基础 Skill、`arthur-research` 科研 Skill、工作区本地工具与 Gordon 能力工具

当前用户主目录与数据根：

- 默认 Gordon Home 为 `~/.gord`，可通过 `GORDON_HOME` 覆盖
- 默认数据根统一为 `~/.gord/data`，桌面端、CLI、内置 Gordon Tools 均走同一位置；可通过 `GORDON_DATA_ROOT` 覆盖
- 启动时会把旧版项目 `data/` 和旧版 Electron 用户数据目录下的 `data/` 安全迁移到当前数据根；若目标已有同名文件且内容不同，会先备份到 `~/.gord/data-migration-backups/`，并通过迁移标记避免重复覆盖
- 桌面端与 CLI 启动时会自动创建 `config / data / data/workbench / data/memory / skills / prompts / logs / cache`

当前数据文件：

- `~/.gord/data/workbench/tasks.json`
- `~/.gord/data/workbench/weekly-progress.json`
- `~/.gord/data/workbench/database-connections.json`
- `~/.gord/data/workbench/workflow-library.json`
- `~/.gord/data/workbench/writing-books/<书名>/book.json`
- `~/.gord/data/workbench/writing-books/<书名>/chapters.json`
- `~/.gord/data/workbench/writing-books/<书名>/chapters/<uuid-hex>.md`
- `~/.gord/data/workbench/comic-projects.json`
- `~/.gord/data/workbench/comic-images/<项目 id>/...`
- `~/.gord/data/workbench/video-projects.json`
- `~/.gord/data/workbench/music-projects.json`
- `~/.gord/data/workbench/model-settings.json`
- `~/.gord/data/workbench/model-balance-history.json`
- `~/.gord/data/workbench/skills.json`
- `~/.gord/data/workbench/mcp-servers.json`
- `~/.gord/data/workbench/tool-configs.json`
- `~/.gord/data/workbench/agent-profiles.json`
- `~/.gord/data/workbench/agent-run-logs.json`
- `~/.gord/data/workbench/command-workshop-sessions.json`

其中：

- `~/.gord/skills` 支持递归发现，任意层级目录只要包含 `SKILL.md` 就会被视为一个用户 Skill；目录内的 `references/`、`assets/`、`scripts/` 作为该 Skill 的附属资源，除非自身也包含 `SKILL.md`
- 内置 Skill 随应用资源保留在仓库 / 打包资源的 `skills/` 目录；用户手工新增、界面编辑、GitHub 导入或外部加载的 Skill 必须落在 `~/.gord/skills` 根目录下，需要命名空间或能力包分组时可使用 `~/.gord/skills/<namespace>/<skill-name>/SKILL.md`
- 内置 `skill-creator` 负责创建、更新和校验 Gordon 本地 Skill 资产
- 内置 `writing` 作为 `skills/writing` 下的复合小说创作 Skill，内部按 `story_planner / story_rebuilder / world_builder / character_designer / plot_engine / arc_planner / state_tracker / chapter_planner / chapter_writer / story_memory（连续性资料更新） / style_controller / scene_specialist / opening_auditor / continuity_auditor` 节点描述可组合工作流；写作子能力保持在一个 Skill 内，通过 `references/story-map-design.md`、`references/world-organization.md`、`references/creature-ecology-design.md`、`references/monster-system.md`、`references/combat-system.md`、`references/character-lineage.md`、`references/narrative-control.md`、`references/arc-planner.md`、`references/state-tracker.md`、`references/style-controller.md`、`references/continuity-auditor.md`、`references/scene-specialist.md` 补强故事地图、世界组织、怪物生态网、怪物生存民俗、战斗体系、人物谱系、叙事刹车、卷结构、世界 / 角色状态机、风格控制、一致性审核和高张力场景设计；系统补设定时默认先确认主角渴望、抵达方向与出发理由，再补世界构成、路线地方、战斗生存、主角轨迹、人物谱系和怪物生态网；人物设计默认先建谱系，再补生活惯性、人物气味、地方化身体习惯、关系小证据和留白，避免角色只作为叙事功能存在；探险 / 末世游历类题材禁止默认落入世界真相、阴谋揭秘、公布真相、RPG 地图解锁或任务链结构；怪物、异兽和灾变生物默认先设计生态发动机、物种谱系、食物网、尺度 / 栖境 / 体态矩阵、关键种和季节变化，再设计人类长期共存后的习俗、误解、职业禁忌、方言和交易，最后进入战斗能力，并避免虫、蛛、菌等低成本形态主导物种想象；战斗体系默认从世界压力、生存工种、非击杀目标、动态空间、时间压力、感官压迫、错误代价、对手反制、失败后果和人物变化推导，避免技能树、固定小队配置和静态对轰
- 内置 `comic` 作为 `skills/comic` 下的复合漫画创作 Skill，内部按 `source_importer / project_planner / asset_director / chapter_planner / storyboard_director / image_prompt_director / image_producer / visual_continuity_auditor / project_memory` 节点描述可组合工作流；具体漫画项目推进、小说来源导入、章节分镜、视觉连续性和出图提示词方法下沉到 `references/project-workflow.md`、`references/storyboard-system.md`、`references/visual-continuity.md` 与 `references/image-prompting.md`。丹青溢彩 Gordon 处理会显式附加该 Skill，并优先通过 Application Tools 的 `comic_*` 工具读取 / 写回漫画项目资产，实际图片生成继续由 Gordon Tools 的 `image_gen` 承接。
- `writing` Skill 已补充自然终局与技艺领悟铺垫链约束：长篇终局默认收束到人物继续生活、路线抵达、关系清账、地方余波、传承延续和价值选择；武学、技艺和能力提升必须回扣旧训、误用、观察、训练、伤势、关系或地方经验，通过多章铺垫、延迟兑现和后续验证自然发生，避免每到一地固定悟招、每场战斗突破或每卷破境的关卡奖励感。
- `writing` Skill 的 `references/` 当前定位为作品设计深参考库，不再按 200-300 行强制收敛；`SKILL.md` 只保留导航、节点和调用顺序，具体创作方法论、设计矩阵、类型差异、失败诊断、审核问题和示例下沉到对应 reference，单个 reference 后续可扩展到 1000-2000 行。
- `monster-system` reference 当前在生态网和生存民俗基础上，额外约束怪物设计优先级、生成收敛、生态色谱、日常低等级生物、怪物塑造人和非人社会逻辑，避免怪物体系过度数据库化或只剩战斗单位。
- `story-map-design` reference 当前在地图层级、路线成本和地方活法基础上，额外约束身体进入感、地图节奏层、路线不确定性、地方经济链、记忆锚点、最小必要地图原则和地图塑造人格，避免地图体系过度宏观化、关卡化或数据库化。
- `narrative-control / arc-planner / state-tracker` reference 当前分别承担叙事控制、阶段规划和状态机维护：叙事控制限制设定扩写、信息释放、叙事压缩和怪物压过人；阶段规划承接卷 / 大阶段目标、假目标、阶段压力、关系位移、代价、回收和结尾反转；状态机维护 `world_state / character_state / economicFlows / themeAnchors / irreversibleConsequences`，让长篇的伤势、资源、路线、势力、经济和主题持续可追踪。
- 新增、编辑或导入 Skill 时，只会复用 `~/.gord/skills` 内的用户目录；如果旧数据里带有仓库 `skills/` 或其它外部路径，会重新分配到 `~/.gord/skills/<skill-name>/`，只有重名时才会自动追加短后缀避让
- Skill 的来源、启停状态、说明、handler 引用等元数据继续保存在 `~/.gord/data/workbench/skills.json`；未登记但本地已存在的 `~/.gord/skills/**/SKILL.md` 会在列表和 Agent 可选能力中被自动合成为本地 Skill
- 内置多模态生成能力在 `~/.gord/data/workbench/tool-configs.json` 中维护 TOOL 配置，当前默认包含 `image_gen`、`video_gen`、`music_gen` 三类能力；每类能力维护可用供应商、默认供应商、API Key、模型 / 能力 ID、接口协议和启停状态；OpenAI 系列图片生成在仓储默认逻辑中内置 `imagen` / `imagen/edit` 端点和工具参数清单，默认使用 `n=1`、`quality=medium`，其中 `imagen/edit` 会把单张引用图作为 multipart `image` 上传，多张引用图作为 `image[0] / image[1]...` 上传；Seedance 视频生成默认模型为 `doubao-seedance-2-0-260128`，默认按火山 `volengine` 代理接口调用 `POST /gpt-proxy/volengine/video/submit` 与 `GET /gpt-proxy/volengine/video/task/{task_id}`，并通过可配置 `taskIdPath` / `resultUrlPath` 解析任务 ID 和视频 URL，支持文生视频、图生视频、首尾帧生视频、参考图 / 视频 / 音频生视频；Mureka / Suno 音乐生成在仓储默认逻辑中内置歌曲生成、纯音乐 / 配乐生成和任务查询端点，其中 Suno 走代理提交 `/gpt-proxy/suno/generate` 与 POST 查询 `/gpt-proxy/suno/detail`；视频和音乐工具会把提交超时、单次查询超时与轮询总预算分开控制，达到预算时返回 `pending=true`，查询链路失败时返回 `pollFailed=true / pollError`，工具调用时会输出脱敏诊断日志，供后续 Agent 工具调用参考，不在编辑页外显
- `墨笔生花` 应用固定在应用广场中，小说书稿作为本地资产落在 `~/.gord/data/workbench/writing-books`；每本书单独维护配置 JSON、章节目录 JSON 和章节 Markdown 正文，不再写死在渲染层常量里；章节正文文件使用稳定的 `<uuid-hex>.md`，由 `chapters.json` 的 `fileName` 映射；目录规划阶段只保存章节元信息，不为无正文章节提前生成 `fileName` 或空 md，首次写入正文时才创建章节文件并回写映射；`book.json` 的 `genreProfile` 承接题材画像（主类型、子类型、storyEngine、受众和语气），`parts` 承接幕 / 卷级设计，`extraIntroSections` 承接故事介绍页的题材自定义设定条目，`storyAssets` 承接结构化故事资产（命题、世界观、人物、关系、时间线、伏笔、规则、人物弧线、风格档案和连续性备注），`narrativeState` 承接统一叙事状态图（人物状态、世界规则、资源 / 债务 / 伤势、区域状态、伏笔压力、故事弧、时间线、连续性风险和计划漂移）；`storyAssets` 与 `narrativeState` 的长期事实支持 `evidenceRefs` 和 `impact`，人物变化通过 `characterArcs` 维护 want / need / currentStage / nextPressure / endpoint；旧书籍只有在缺少 `narrativeState` 时才会从 `storyAssets` 初始化一份基础状态，后续以 `narrativeState` 作为叙事运行时主数据；`outlinePlannerJob` 承接长篇分批规划任务进度、重试状态、最近错误与继续执行所需目标参数，`chapters.json` 的 `partIndex` 标注章节所属幕 / 卷；章节目录使用 integer `index` 表示全书连续章序，`title` 只保存不含“第X章”前缀的纯标题；长篇分批规划保存时会按章节 `index` 和本地已有章节做增量合并，避免批次异常覆盖已落盘章节
- `墨笔生花` 的写作提示词资产已迁移到 `prompts/workbench/writing/`，包括大师系统提示词、叙事技巧内核、商业自评内核、章节输出默认约束与 AI 任务专属提示词；主进程通过白名单 prompt id 读取，渲染层启动时动态加载，`apps/desktop/src/renderer/src/features/writing/writingPromptBuilder.js` 负责组装最终 prompt；`apps/desktop/src/renderer/src/features/writing/writingConfig.js` 承接写作应用 tab、篇幅策略、AI 任务、状态与长篇规划参数；`writingActions.js` 承接书架、书籍详情、章节编辑、导出和自动保存动作；`writingAiActions.js` 承接 prompt 预览、模型调用、长篇分批规划、AI 输出解析与写回，并通过 `buildWritingAgentContext / buildWritingAgentRunInput` 复用同一份写作上下文构造 Gordon `AgentRunRequest`；`writingDirector.js` 承接首版 Gordon 写作导演层，会在每轮普通生成、长篇 Master Plan、分批章节规划和章节写回后的连续性更新前生成 `intent / phase / skillNodes / focus / risks / constraints / successCriteria / conflictSeed / stateCommitPolicy`，并把压缩后的 Gordon Agent Runtime、内置 `writing` Skill 核心技巧、Writing Director Plan、轻量 Event Graph 和可交给 Gordon runtime 的任务包注入上下文；`WritingAiDrawer.vue` 承接添香小筑抽屉 UI，并展示 Gordon 处理的轻量过程流；`App.vue` 只保留顶层接线和 Agent 进度事件分发
- 应用广场的字段级 AI 优化由 `features/marketplace/FieldAiOptimizer.vue` 和 `features/marketplace/fieldAiActions.js` 承接：组件负责编辑框旁的星光按钮、悬浮输入、生成结果预览和替换 / 追加动作；actions 负责当前字段目标、上下文拼装、优先模型文本调用、停止请求与写回 setter。该能力已接入墨笔生花、丹青溢彩、流光绘影和瑶琴映月中的主要长文本编辑框，后续新增应用只需传入字段 id、应用名、当前值、上下文和写回函数即可复用
- 应用广场已抽出通用 Gordon 处理层：`features/marketplace/marketplaceAgentActions.js` 负责构造默认 Gordon Agent 请求、运行 / 停止、过程事件压缩、artifact 解析和结果回填；`features/marketplace/marketplaceAgentContext.js` 负责把丹青溢彩、流光绘影、瑶琴映月和灵犀照命的当前项目 / 曲目 / 镜头 / 对话状态压缩成应用上下文 provider；`features/marketplace/GordonAgentProgress.vue` 负责统一展示应用内 Gordon 过程流和停止入口，并被墨笔生花、丹青溢彩、流光绘影、瑶琴映月、灵犀照命复用。应用内统一区分“快速模式”和“Gordon 处理”：快速模式直接调用当前应用的轻量模型或专用工具，适合快速出草案或单步操作；Gordon 处理由 Gordon Agent 主导目标理解、质量判断、状态连续性、风险控制与必要工具调用，工具只是操作集合，不替代 Agent 决策。后续新增应用应优先复用该层，而不是各自硬编码一套 Agent 按钮、上下文构造和进度显示。
- `墨笔生花` 的章节正文生成提示词内置 4000-5000 字、包括第一段在内每段两个汉字宽度缩进、正文开头不带章节标题等默认约束；书籍详情左侧信息轨左下角提供“导出”入口，可按 `txt / md` 导出当前书籍的已完成章节到用户选择的本地目录，导出文件名固定为 `<书籍名>.<扩展名>`；书籍名称和自定义设定标题支持临时清空，10 秒内没有新输入才回退旧名；书架支持删除书籍，删除时书稿目录会移入系统回收站；书架为空时在列表区域中央显示轻量提示
- `墨笔生花` 的 AI 辅助已按 Gordon + `writing` Skill + Narrative Runtime（叙事运行时）增强，内置“搭底盘 -> 规划结构 -> 生产章节 -> 审阅修正”的创作阶段。当前“快速模式”走写作应用内的快速模型调用与本地写回链路；添香小筑另有“Gordon 处理”入口，会把同一份写作上下文构造成标准 `AgentRunRequest`，指定默认 Gordon Agent、内置 `writing` Skill，并开启完整工具集合下的自动工具编排，结果先回填到输出区，不直接覆盖书稿。Gordon 处理会监听 `AgentRunProgressEvent`，在抽屉中展示紧凑过程流：建立上下文、规划、工具调用、授权状态、Skill 执行、整理输出和失败 / 停止状态都聚合为稳定步骤，不把权限授权拆成额外跳号步骤。每轮 prompt 会先由 Gordon 写作导演层收敛本轮意图、风险、成功标准、冲突种子和状态提交策略，再把压缩后的 Gordon Agent Runtime、`writing` Skill 核心技巧、`Genre Profile`、结构化 `storyAssets`、`narrativeState`、人物弧线、风格画像、轻量 Event Graph、幕 / 卷、最近章节、当前章节、后续承接、伏笔与规则提醒一起注入模型，要求生成前主动读取题材画像、storyEngine、人物状态、关系债务、资源 / 伤势、区域变化、世界规则、时间线、未回收伏笔和故事弧；题材画像会让探险、都市、言情、悬疑、历史、科幻、奇幻、武侠和现实题材使用不同推进策略，避免所有作品默认落入探险升级或真相揭露框架；长篇 Master Plan 和分批目录规划也会注入 Gordon 写作导演计划、Genre Profile、Narrative Runtime 与 Event Graph，降低前后批次漂移。添香小筑新增“叙事状态图、风格画像、故事弧跟踪、计划漂移分析、连续性校验”等动作，并在抽屉中按创作阶段筛选任务；故事介绍页新增轻量 Narrative State 状态卡，展示人物、规则、伏笔、故事弧和风险数量，左侧信息轨可维护题材画像。故事介绍输出按任务意图写回“简短介绍”或统一后的“大纲指导”，旧版 `seriesPlan` 仅作为兼容字段读取并合并进“大纲指导”，章内计划写回当前章节简介；快速模式、Gordon 处理和长篇分批规划均可通过运行浮层停止当前请求；章节 AI 输出写入正文后，会额外执行 story_memory / state_tracker 状态提交，抽取新增稳定事实、证据载体、信息差变化、对手反制、伏笔线索、人物弧线和 Narrative State 节点并合并回 `book.json`；正文生成保持纯净，不强制输出 `state_delta` 或 JSON，连续性资料、设定账本和 `memoryNotes` 只作为内部管理资料，避免被模型误扩写为“记忆/失忆/遗忘/档案”等核心题材
- `任务笔记`、`命令工坊`、`流程中心`、`应用广场` 不再继续把新配置、状态工厂或可复用纯逻辑直接追加到 `App.vue`；新增配置、草稿状态、运行时转换、展示 helper、业务动作和模块页面组件应优先落到对应 `features/<module>/` 下；`App.vue` 当前只保留功能视图选择、少量共享状态和 feature actions 接线，Gordon 弹窗、左侧壳层、首页机器人运行时、工作台快照启动 / 刷新和根级 watcher 已拆出到 `components/` 与 `features/shell/`
- `丹青溢彩` 应用固定在应用广场中，漫画项目作为本地资产落在 `~/.gord/data/workbench/comic-projects.json`，章节图片和素材图片会文件化沉淀到 `~/.gord/data/workbench/comic-images/`，当前支持从应用入口进入项目架、新建项目、进入项目详情，并维护单图海报 / 连载漫画、单色 / 彩绘、类型、画风、页数、总介绍、项目级素材库、目录章节、章节文本来源、`ComicChapter.storyboards` 分镜轨道和分镜图片；素材库挂在总介绍 tab 内，可维护人物（16:9 单张三视图）、物品（16:9 单张三视图）、场景（多图 / 多视角）素材，左侧素材列表可折叠，素材具备唯一 id 与项目内唯一命名，章节通过 `assetRefs` 引用素材；`features/marketplace/comicActions.js` 承接项目归一化、素材管理、自动保存、删除、章节编辑、AI 目录 / 分镜写入、分镜图片结构化存储和 Markdown 导出动作，`features/marketplace/comicAiActions.js` 与 `ComicAiDrawer.vue` 承接灵绘小筑抽屉：总介绍与目录 tab 通过优先文本模型生成漫画介绍、画风规划、总规划或章节目录，单章生成 tab 可先把章节简介 / 正文拆成多条可编辑分镜，再对当前分镜通过内置 `Gordon Tools / image_gen` 生成单张漫画图、漫画页、封面海报或多张连续图；单章生成页以左侧分镜轨道、中间当前分镜画面和右侧分镜编辑器作为主工作区，章节文本输入保持可折叠辅助状态，出图时会把当前章节引用素材的图片视图作为图生图参考传入，并把图片通过 `storyboardId` 挂回当前分镜；项目型应用详情页统一把书名 / 作品名移入左侧可折叠信息轨编辑，顶部原标题区域承接 tab 导航，编辑区不再嵌套二级标题卡，切换内容直接铺进主舞台；左侧单行输入和下拉控件保持 mini 化，字段 label 使用更醒目的暖金强调色，更新时间与“导出”入口统一落在信息轨左下角，作品名称和素材命名支持临时清空并在 10 秒无新输入后回退；项目架为空时在列表区域中央显示轻量提示
- `流光绘影` 应用固定在应用广场中，视频项目作为本地资产落在 `~/.gord/data/workbench/video-projects.json`，当前支持从应用入口进入项目架、新建项目、进入项目详情，并维护文生视频 / 图生视频、画幅、默认时长、项目概念、视觉与运动风格、分镜规划、镜头列表、镜头提示词、反向提示词、参考素材和生成结果；`features/marketplace/videoActions.js` 承接项目归一化、自动保存、删除、镜头编辑和 Markdown 导出动作
- `瑶琴映月` 应用固定在应用广场中，采用“应用入口 -> 专辑列表 -> 专辑编辑详情”的三段式结构；音乐专辑作为本地资产落在 `~/.gord/data/workbench/music-projects.json`，当前支持空列表提示、新建专辑、左侧可折叠专辑信息轨、顶部“全部 / 草稿 / 成品”tab 筛选、右侧曲目编辑、音频 URL 播放器、专辑 Markdown 导出、顶部瑶音小筑助手入口、优先模型生成制作草案、通过内置 `Gordon Tools / music_gen` 调用 Mureka / Suno 发起歌曲或纯音乐生成；`music_gen` 默认在工具内部提交并短轮询到音频产物，若等待预算耗尽则保留任务 ID 与 pending 状态供后续继续查询；瑶音小筑沿用项目型应用助手抽屉的任务选择、运行和当前曲目反馈结构；`features/marketplace/musicActions.js` 承接专辑归一化、列表 / 详情流转、自动保存、删除、导出、曲目编辑、文本草案生成和 `music_gen` 工具调用动作
- `灵犀照命` 应用固定在应用广场中，定位为占卜与运势类轻量问询工作台；当前支持从应用入口进入独立对话页，左侧保留今日运势、综合看命、面相手相、阳宅风水、事业财运、感情关系、抉择占卜七个常用解读类型；解读逻辑通过 `FORTUNE_ANALYSIS_METHODS` 维护八字、紫微、易占、相学、风水、姓名数理、星象与现实校准等框架，并在提示词中要求先识别问题与资料完整度，必要时追问 1-3 个关键信息，再按取象来源、卦名 / 盘名、交叉印证、趋势判断、行动建议和复盘指标输出；右侧聊天区支持用户输入问题并上传图片或资料附件，继续复用优先模型生成娱乐性、反思性、可复盘的趋势参考；`features/marketplace/fortuneActions.js` 承接状态切换、聊天消息、附件队列和模型调用动作
- 模型余额查询除保存最新快照到 `model-settings.json` 外，还会把手动刷新和后台每小时轮询的快照沉淀到 `model-balance-history.json`；模型管理列表项提供用量统计入口，统计卡片按本地时间凌晨 1 点到次日凌晨 1 点作为日界线展示近 30 天每日消耗，遇到余额计数器归零或月中 16 日 13 点后的重置场景时按新周期继续累计，避免产生负用量

### 4.5 Shared

`packages/shared`

负责共享类型和基础工具，当前重点承接：

- `ProviderKind`
- `ModelProfile`
- `ModelSettings`
- `ToolConfig`
- `WorkbenchSnapshot`
- 路径解析工具

## 5. 当前已落地功能

### 首页与导航

- 首页继续保留左侧品牌卡、设置菜单、功能卡与右侧机器人工作区
- 左侧功能卡继续承接首页、应用广场、任务笔记、流程中心、命令工坊的主入口
- 模型管理与能力拓展继续通过品牌卡设置菜单进入
- 右侧工作区继续承接机器人、模型管理、任务笔记、命令工坊与能力拓展内容
- 渲染层实现已迁移到 Vue，但布局、类名体系与整体风格保持原版语义

### 模型管理

- 已配置列表
- 添加新配置入口
- 供应商切换式配置编辑器
- 优先模型设置
- 模型余额查询小组件与刷新入口
- 余额查询提取器代码配置与即时试跑
- 模型用量统计卡片，展示近 30 天每日用量和摘要指标
- 编辑已有配置
- 优先模型驱动的真实文本调用链
- 模型管理前端边界已拆为 `ModelManagementView.vue` 与 `modelManagementActions.js`；`App.vue` 只注入工作台状态、桌面桥接、弹窗 / 状态提示和刷新快照依赖

当前支持供应商：

- OpenAI
- Azure
- Google
- Anthropic
- 豆包
- 千问
- DeepSeek
- 月之暗面
- 智谱
- Grok
- OpenAI-like

示例模型展示：

- GPT 系列
- Gemini 系列
- Claude 系列
- DeepSeek / Kimi / Qwen / Doubao 等兼容模型

### 任务笔记

- 按周自动创建当前计划
- 周一自动归档上一周内容
- 历史周报查看
- 周报列表已升级为“本周驾驶舱 + 历史记录”概览态
- 当前周编辑页已升级为“项目推进 / 汇报视图”切换式编辑台
- 项目推进视图已收口为“项目名称 + 折叠任务列表”的轻量编辑器，并进一步压缩为树形清单式密度
- 支持项目行、任务行的就地新增 / 删除，以及任务状态按钮菜单
- 支持任务行“更多”菜单，内含删除与 AI 轻量优化入口
- 项目下的任务结构已升级为递归任务树，任务行右侧 `+` 会新增下一层级子任务，并随自动保存、结构化文本回写与历史重开一起保留层级
- 任务节点已补充 `createdAt / updatedAt` 时间戳，用于识别今日更新的叶子任务
- 周报编辑态与命令工坊聊天态已切换到右侧工作区的沉浸式容器层，外层不再重复叠加模块边距
- 编辑页头部已收口为“返回 / 视图切换 + 日期 / 右侧主动作”，自动保存提示改为日期角落的小号状态字
- 汇报视图输出支持 Markdown 清洗后的预览与富文本剪贴板复制；复制按钮会写入 `text/html` 与 `text/plain`，用于把已渲染内容直接粘贴到飞书聊天窗口

### 命令工坊

- `features/command-workshop/CommandWorkshopView.vue` 承接会话列表、消息流、过程链路、消息底部操作组、高级设置和输入区模板；`commandWorkshopActions.js` 承接会话切换、消息复制、PDF/DOCX 导出、附件选择、MCP tools 读取、提交运行、进度回显和执行链路展示 helper
- AI 回复消息底部按“时间 + 图标群”展示操作，当前支持复制富文本、导出 PDF 和导出 DOCX；导出请求经 preload 桥转交主进程，主进程负责保存对话框、文件名净化、PDF 打印和 DOCX 文件包写入

### 应用广场

- 当前首个落地应用为 `墨笔生花`，应用广场已新增漫画创作应用入口 `丹青溢彩`
- `墨笔生花` 定位为小说写作助手，采用“应用入口 -> 书架 -> 书籍详情”的三段式结构
- `丹青溢彩` 定位为漫画创作应用，采用“应用入口 -> 项目架 -> 项目详情”的三段式结构；项目架空白时与 `墨笔生花` 书架一致保持空白内容区，项目详情采用“总介绍 / 目录 / 单章生成”三个 tab，对应漫画总设定、章节文本 / 目录辅助信息和单章分镜轨道 / 分镜图片生成
- `features/marketplace/MarketplaceView.vue` 承接应用广场入口、写作书架 / 详情、漫画项目架 / 详情、视频项目架 / 详情、音乐专辑列表 / 详情、应用 AI 抽屉挂载和导出弹框模板；`features/marketplace/FortuneWorkbench.vue` 承接 `灵犀照命` 独立对话页模板、快速模式入口、Gordon 处理入口和过程流展示；`App.vue` 仅通过 `marketplaceViewContext` 注入状态与动作，应用 Gordon 上下文构造已下沉到 `marketplaceAgentContext.js`
- `features/writing/writingActions.js` 承接 `墨笔生花` 的书稿归一化、自动保存、书架 / 章节动作、导入导出与基础 UI 状态；`features/writing/writingAiActions.js` 承接 AI prompt、模型请求、长篇分批规划、重试 / 中断、AI 输出解析与写回
- `features/marketplace/comicActions.js` 承接 `丹青溢彩` 的项目归一化、项目架动作、章节动作、自动保存与 Markdown 导出
- 书架支持新建书籍和导入本地 `.txt / .md / .json` 书稿
- 书籍详情页包含故事介绍、书籍目录、章节编写三个 tab，每个 tab 都支持直接编辑和 AI 辅助；故事介绍固定字段采用折叠编辑卡，并支持按题材动态新增人物关系、怪物体系、战斗体系等自定义设定条目
- AI 辅助会按短篇 / 中篇 / 长篇切换创作策略，并结合当前 tab、写作动作、作者额外要求和全书上下文生成提示词
- AI 辅助任务以用户结果为主：故事介绍提供“搭建故事设定 / 打磨故事设定 / 生成书籍介绍 / 开篇体检”，书籍目录提供“规划章节目录 / 目录体检”，章节编写提供章内计划、初稿、扩写、对白、高潮场面、压缩润色、开篇自评和章节质检；世界观、人物关系、前三章、节奏、伏笔、一致性、证据载体和对手反制等能力作为提示词内核服务这些主动作
- 书籍目录的长篇分批规划会先生成幕 / 卷 Master Plan，再按批次生成章节目录并持续落盘；模型请求通过 `requestId + AbortController` 支持当前批次即时取消，取消后任务状态写回 `cancelled`；临时网络、网关 5xx 或空正文类错误会在当前批次内自动退避重试，连续失败后保留 `failed` 状态并允许从本地缺失的第一章继续规划

### 流程中心

- 已从“效率工具”收敛为 `流程中心 / workflow`，采用“首页工作流卡片 -> 当前资源工作区 / 工作流列表 -> 执行 / 配置页”的结构；首页只承担入口，不把信息流、行情看板、curl 详情和配置面板摊平
- 当前内置四个默认卡片：`信息雷达`、`金融快报`、`直播流` 与 `模型接口测试`
- 流程中心的当前卡片与工作区视图在模块切换时保持内存态；用户从任务笔记、命令工坊等页面切回流程中心会恢复离开前的资源工作区，只有点击流程中心内部返回入口才回到首页卡片列表
- `信息雷达` 采用 Resource-Oriented Agent（面向资源的 Agent）思路，核心资源是 `InfoRadarWindow` 信息窗口；每个窗口维护 `sources / keywords / negativeKeywords / digestPrompt / items / runHistory / cadence`，用于追踪技术、政治、金融、科研、公众号等来源。当前支持 RSS / Atom、普通网页、公开搜索 RSS 和搜狗微信公众号线索由桌面主进程刷新，按关键词与排除词过滤、去重、记录刷新结果；其中公众号来源只做低频线索发现，不把公众号正文当作普通网页反复抓取，成功、空结果或限流后的搜索页访问时间会写入 source 的 `lastDiscoveredAt`，冷却期内跳过再次访问并复用已有条目；公众号条目长期只保存标题、作者、发布时间和摘要等线索，不保存 `mp.weixin.qq.com/s?...signature...` 临时链接，点击打开时会按标题 / 作者重新低频检索可用链接并在软件内阅读页加载；信息雷达初始化只提供能力入口，不硬编码预置具体信息窗口，Agent / 大模型、科研论文、金融、生物学等关注窗口属于用户配置，统一落在 `~/.gord/data/workbench/workflow-library.json`；页面内展示来源 / 标签筛选、普通信息流和相关性分数；来源阅读页由主进程 `BrowserView` 内嵌承载，标题栏只保留返回、单行标题和外部打开，正文区域随右侧主舞台铺满并提供加载 / 失败兜底
- `金融快报` 核心资源是 `FinanceBriefConfig`，维护常用金融标的、当前区间 / 周期和最近行情快照。当前默认内置黄金期货 `GC=F` 与招商银行 A 股 `600036.SS`，通过桌面主进程调用 Yahoo Finance Chart API 拉取免密公开行情，解析为本地 `FinanceBriefSnapshot`；渲染层使用独立 `FinanceKlineChart.vue` 和 `lightweight-charts` 绘制 K 线、真实价格 / 时间坐标和成交量副图，支持十字线 OHLC（开高低收）读取、滚轮缩放、拖动浏览、最新价格线、MA5 / MA20、成交量开关和聚焦模式。区间支持 `1d / 5d / 1mo / 3mo / 6mo / 1y / ytd / 2y / 5y`，周期支持 `1m / 5m / 15m / 30m / 60m / 1d / 1wk / 1mo`，日内图会保留最多 10000 个有效行情点并按交易所时区格式化坐标，长区间分钟线会自动收敛到短区间以适配 Yahoo 免费接口限制；黄金类标的会保留原始美元 / 金衡盎司报价，并按 `1 金衡盎司 = 31.1034768 克` 派生 `USD/g` 克价，若 `CNY=X` 汇率可用则同步派生 `CNY/g`；用户也可以输入其它 Yahoo Finance symbol 做临时查询，查询成功后写回本地快照和常用标的列表
- `直播流` 核心资源是 `LiveStreamConfig`，维护固定直播房间或直播页 URL，默认内置用户关注的 Bilibili `https://live.bilibili.com/blanc/6` 纯净播放页。渲染层采用左侧直播间轨道 + 右侧播放器舞台，Bilibili 支持输入房间号或完整直播间 URL，并统一归一化为 `/blanc/<roomId>` 播放页；小红书和自定义直播源先按固定直播页 URL 打开；桌面主进程通过独立 `BrowserView` 加载直播网页，并与信息雷达阅读页使用不同持久化分区，切换页面时会自动关闭对应原生视图。Bilibili 直播页加载后会注入播放器剧场模式，尽量隐藏网页头部、侧栏、聊天和推荐区域，并在识别播放器后隐藏同层级非播放器旁支模块，只保留播放器画面铺满直播舞台；若页面出现登录二维码、验证码或跳转到登录 / 授权页，会自动退出剧场模式并抬高登录弹层，确保二维码可完整扫码。直播流使用 `persist:gordon-live-stream` 持久化分区，扫码后的 Bilibili Cookie 会在 Gordon 内部直播间之间复用并随应用重启保留，但不直接共享系统 Chrome 的登录态；桌面主进程默认通过 `--log-level=3` 与 `--disable-logging` 静音 Chromium native 控制台噪声，减少 Bilibili WebRTC / P2P 探测失败刷屏，可通过 `GORDON_CHROMIUM_DISABLE_LOGGING=0` 临时恢复底层日志；该策略不禁用 WebRTC / P2P 探测，也不拦截 Bilibili 直播网络请求。当前不默认解析平台原始 `m3u8 / flv` 流，优先保持平台页面登录态、弹幕和播放兼容性
- `模型接口测试` 继续承接历史工作流记录、动态请求步骤、`$BASE_URL / $API_KEY / $TASK_ID` 风格变量、步骤产出变量 JSONPath 提取、dev/test/pre/prod 环境 Base URL + APIKEY 注入、步骤级单次 / 轮询执行、轮询终止判断、请求 Body 快捷编辑与 JSON 修复、实时 stdout / stderr 输出和运行中主动中断，并支持从界面新建、编辑、删除和执行 curl 工作流
- 渲染层 `features/workflow-library/workflowConfig.js` 承接流程中心默认配置、信息窗口草稿、金融查询状态与 curl 记录草稿工厂，`features/workflow-library/workflowRuntime.js` 承接信息雷达展示 helper、金融行情展示 helper、curl 解析、Body 修复、环境归一化、record 草稿转换和运行结果展示 helper，`features/workflow-library/workflowActions.js` 承接选择同步、信息窗口编辑保存 / 删除 / 刷新、金融行情查询、记录保存 / 复制 / 删除、环境 / Body 写回、运行中断和 IPC 进度回显动作
- 流程中心资产统一通过本地 JSON 仓储持久化：`~/.gord/data/workbench/workflow-library.json`；其中 `WorkflowLibraryItem.kind` 当前支持 `info-radar`、`finance-brief`、`live-stream` 与 `api-test`，旧 `api-suite` 会继续迁移为 `api-test`
- 编辑页头部在滚动时会保持固定，项目推进视图也已移除项目卡片外层的额外包裹容器
- 编辑页滚动已下沉到内部内容壳层，修复 sticky 头部滚动时的轻微上移感，并将滚动条收口为自动弱显的短轨样式
- 返回列表已改为折线箭头图标入口，继续保留原有返回语义
- 任务优化中会进入整行锁定态，并将序号切换为运行中转圈反馈
- 支持项目名、任务名的直接编辑与自动保存
- 汇报视图除周报外，已新增基于“今日更新叶子任务”的日报生成动作，并支持选择起始日期 / 结束日期、填写身份职责 / 重点项目 / 强调方向等补充要求，把范围内日报素材交给大模型生成专业述职报告
- 汇报视图已收口为统一的“日报 / 周报 / 述职报告”模式面板，三类报告复用同一套输出区与执行入口
- 列表页顶部统计卡片已进一步压缩为轻量数字卡，仅保留领导周报的绿色更新时间提示
- 周报列表项已收口为单行摘要结构，只保留标题、短标签、更新时间与删除动作
- 周报列表滚动区已补顶部安全边距，修复首条记录上边缘裁切；“本周”标签与删除动作也已升级为更鲜明的状态徽标和图标按钮
- 支持自动提炼可汇报结果、风险待协调事项与下周继续推进清单
- 汇报视图中的周报模板已升级为“默认模板 + 自定义模板集合”，支持模板选择、新增时一次性命名、内容维护与删除
- 默认模板已调整为“项目列表 + 任务清单 + 完成情况”的结构化输出，更适合直接展示本周推进项
- 任务优化提示词已支持“短文本自适应增强”，会在不虚构事实的前提下补齐更专业的动作与对象表达，并避免把多条任务机械改写为“完成XXX”
- 当被优化的任务下仍挂有子任务时，优化结果会偏向父任务级概述，不再把下级任务机械合并成一条长句
- 日报大模型优化会在保留项目任务树层级的前提下统一叙述格式、技术缩写大小写和状态表达，优先输出精准简练的工作推进项
- 日报输出区已支持通过飞书群机器人发送富文本卡片消息，正文放入卡片 `markdown` 元素渲染，卡片标题保持“前缀 + 日期”的精简格式；飞书群设置支持开启工作日北京时间 18:30 自动日报，桌面主进程会在应用运行期间定时检查当前 active 周记录，提取今天更新的叶子任务、按既有日报提示词优化、发送到飞书群，并把最近执行日期、状态和消息回写到 `~/.gord/data/workbench/weekly-feishu-settings.json`
- 当前本地数据已具备对接飞书文档 / 多维表格的字段基础，后续可继续映射项目、任务、状态和备注
- 系统内置周报提示词、默认周报模板、内置 Agent / Skill 提示词已提升为仓库根目录 `prompts/` 下的 Markdown 资产，由运行时统一读取

### 命令工坊

- 命令工坊沿用“会话列表 / 对话态”两段式结构
- 支持会话列表、多轮消息、执行结果回看、轻量过程流摘要、按需展开输出与停止原因展示
- 高级设置保持在当前会话输入区内部，不额外拆出并列主窗格
- 命令工坊前端边界已拆为 `CommandWorkshopView.vue`、`commandWorkshopState.js`、`commandWorkshopRuntime.js` 与 `commandWorkshopActions.js`；`App.vue` 仅注入响应式状态、桌面桥接、弹窗 / 状态提示和视图 ref
- 会话列表已收口为可滚动的单行摘要卡，只保留标题、更新时间、消息数、响应数与删除动作
- 聊天页头部、消息气泡、代码块、输入区与高级设置面板已整体压缩为更高信息密度的紧凑布局
- 高级设置已进一步收口为三行紧凑配置条：`Agent / Skill / 自动工具`、`工具服务 / 工具 + 读取工具`、`工具参数 JSON`
- 聊天消息下的执行链路已升级为主消息内的轻量按需过程流，不再在消息底部重复展示关键动作时间线；内部工具规划、Planner Tool View 和工具数量摘要不作为主卡片外显，运行中主状态以透明内联状态展示准备工具、判断动作、执行工具和整理回复；权限授权、工具使用、失败恢复和 Skill Handler 结果会按发生顺序呈现，工具步骤标题会映射为“读取网页内容 / 联网研究资料 / 处理应用资产”等任务语义，原始工具服务与 tool name 仅作为弱化辅助标签保留；成功工具原始返回默认不占据消息流，错误、授权异常和停止原因通过折叠输出回看，最终回复仍独立展示
- 当用户在命令工坊中明确要求创建、写入、保存或更新 `墨笔生花` 小说资产时，前端会在本轮自动启用工具模式；Agent 侧会从当前授权工具集合生成 Planner Tool View，让模型在应用语义工具和必要文件级工具之间选择
- 当用户输入包含 URL、联网调研、文件 / 代码处理、媒体生成、桌面操作或附件处理等强工具信号时，即使用户手动关闭自动工具，本轮也会自动进入工具编排；后端保留完整授权工具集作为执行边界，但工具规划模型每轮只接收按能力域收敛后的可见工具白名单
- 会话内继续任务时，`commandWorkshopRuntime.js` 会从最近一条助手消息的 artifact 中取出 `taskLedger`，`commandWorkshopActions.js` 会随下一轮 `runAgent` 请求传入；Agent runtime 会把它归一化后注入规划上下文，并把最新用户请求记录为 `userInterruptions / nextActionHint`，从而延续目标、计划、Decision Memory、观察、失败恢复和成功条件

### 界面设计系统

- 桌面端视觉方向已从偏深色赛博卡片，调整为更轻、更自由的浅色玻璃质感工作台
- 统一使用 `Avenir Next` / `Avenir Next Condensed` 与暖白、青绿、珊瑚色视觉系统
- 支持更有弹性的页面编排：主舞台优先，必要时允许附着式上下文轨道或侧向面板

### 能力拓展管理

- 从首页左侧品牌卡设置菜单进入 Agent / Skill / MCP Server / TOOL 管理页
- Agent 支持绑定模型、Skill、MCP Server
- Skill 支持维护名称、说明、提示模板与处理器引用
- Skill 已补充来源元数据，能够区分“手工定义”与“GitHub 导入”
- Skill 列表会递归扫描 `~/.gord/skills/**/SKILL.md`，未写入 `~/.gord/data/workbench/skills.json` 的本地目录也会自动出现在可选能力中
- Skill 支持从 GitHub 镜像整个 Skill 目录到本地 `~/.gord/skills` 目录，并将 `SKILL.md` 导入为本地 SkillDefinition
- 带 handler 的 Skill 已支持按本地镜像目录执行，当前默认支持 `node` / `python3` / `sh` 脚本入口
- Skill handler 输出既可以作为补充上下文继续喂给模型，也可以直接产出最终结果
- Skill handler 已有正式输入输出协议 `gordon-skill/v1`，运行时会通过 `stdin JSON + env + cwd` 传入执行上下文
- MCP Server 支持维护 `stdio` / `http` 两类连接配置
- TOOL 配置用于维护内置工具能力的供应商凭证与默认路由，当前内置 `image_gen`（OpenAI / Gemini / 即梦）、`video_gen`（Seedance / PixVerse / Veo / Sora）和 `music_gen`（Mureka / Suno）；其中 `image_gen/openai` 的运行时元数据内置文生图 `imagen`、图生图 `imagen/edit` 端点，以及 `prompt / model / size / image / images` 参数边界；`video_gen/seedance` 维护提交接口、轮询接口、`taskIdPath` 与 `resultUrlPath`，默认走火山 `volengine` 代理接口，工具层支持 `text_to_video / first_frame_to_video / first_last_frame_to_video / reference_to_video`，`submit / query` 都会按默认预算自动轮询；`music_gen/mureka` 内置 `/v1/song/generate`、`/v1/soundtrack/generate`、`/v1/song/query/{task_id}` 与 `/v1/vocal/clone`，`music_gen/suno` 走代理提交 `/gpt-proxy/suno/generate` 与 POST 查询 `/gpt-proxy/suno/detail`，生成和查询默认短轮询到音频产物或明确 pending / pollFailed；默认 Agent 通过内置 `Gordon Tools` MCP 服务发现并调用已启用 TOOL
- 本地 JSON 持久化能力拓展配置
- 支持从 Agent 列表进入运行测试页
- 支持单轮 Agent + Skill 测试运行
- 支持读取 MCP tools 列表并在 Runner 中选择工具
- 支持先调用 MCP tool，再把结果回填给 Agent 完成最终输出
- 支持未手动指定 tool 时，由模型自动规划工具与参数
- 支持在自动模式下连续规划多轮工具调用，并展示每轮调用明细
- 内置 `Workspace Tools` 已提供文件增删改查、目录创建、移动/重命名、工作区搜索、路径信息与路径规范化/拼接/相对路径计算、网页读取、文件对比、JSON 解析验证与受限命令诊断工具；默认允许访问当前仓库与 `~/.gord/data`，可在 Application Tools 缺口场景下直接维护 `~/.gord/data/workbench` 的应用资产文件
- 内置 `Search Tools` 已提供高质量联网检索与研究证据包工具：`web_search_v2` 返回去重排序后的搜索列表，`web_research` 返回多查询结果、正文摘录、来源元数据与页面内发现的相关官方链接，`github_search_repositories` 返回 GitHub 仓库链接、stars、forks、语言、topic、license 与更新时间；API provider 可通过 `TAVILY_API_KEY`、`BRAVE_SEARCH_API_KEY`、`SERPER_API_KEY`、`SEARXNG_BASE_URL` 环境变量启用，GitHub API 可选 `GITHUB_TOKEN` 提升限额
- 内置 `Computer Use` 已提供 `list_apps / get_app_state / open_app / open_url / wait / click_text / click_window_area / play_media / click / type_text / press_key / take_screenshot`，当前优先支持 macOS 桌面端；浏览器视频任务会优先使用等待、文本点击、媒体播放和截图验证这组高阶动作，避免直接猜测底层坐标
- 内置 `Gordon Tools` 已提供按 TOOL 配置动态发现的能力工具，当前覆盖 `image_gen`、`video_gen` 与 `music_gen`
- 内置 `Application Tools` 已提供应用广场资产工具，当前优先覆盖 `墨笔生花` 小说书稿的新建、读、搜、预览和写回；新建小说可一次性写入简介、大纲、题材画像、分卷 / 章节目录、补充设定区块、`storyAssets` 与 `narrativeState`，已有小说可通过 `writing_update_book_fields` 维护 `genreProfile`，并通过 `writing_update_story_assets` 合并或替换世界观、人物、人物弧线、关系、伏笔、规则、风格档案、连续性备注和 Narrative State 节点；当应用语义工具不可用或不覆盖目标操作时，默认 Agent 会改用 `Workspace Tools` 读取目录结构、写入 `book.json / chapters.json / chapters/*.md`，并校验 JSON 解析结果
- 命令工坊中的执行链路统一收敛为“可见动作 / 授权与恢复 / 停止原因 / 最终整理 / 按需展开输出”，一次工具调用只占一行轻量过程项，并在标题中区分内置本地工具与外部 MCP；未发生真实工具或异常动作时不额外展示过程卡片
- 当本地工具需要访问工作区外路径时，会通过 Gordon 自绘授权窗口申请本轮访问授权，授权后继续原工具调用
- 支持记录停止原因与 MCP 失败恢复信息
- 支持记录 MCP 重试过程、恢复状态与错误类型
- 支持记录最近执行日志与执行步骤
- 能力拓展页已补专用紧凑布局：列表卡片、编辑表单与 Agent Runner 结果区统一压缩字号与间距，Runner 历史区下沉为整行区块
- 能力拓展列表态已改为 `Agent / Skill / MCP / TOOL` 四页签切换，避免多类配置同时堆叠在一个长页面里
- 能力拓展前端边界已拆为 `ExtensionsManagementView.vue` 与 `extensionsActions.js`；`App.vue` 只注入工作台状态、桌面桥接、弹窗 / 状态提示和共享 Agent 查询 helper

### 命令工坊

- 首页入口进入真实命令工坊 chat 工作台
- 默认内置 Gordon Agent，直接复用当前优先模型作为兜底执行角色；科研协作能力通过 `arthur-research` Skill 加载，强调科研决策优先级、假设剪枝、致命审稿检查和最小区分实验
- 默认内置基础 Skill 与工作区本地工具，保证首次进入即可开始对话
- 支持按会话沉淀多轮消息历史
- 支持在会话内选择 Agent、附加 Skill
- 支持自动或手动限定工具服务 / tool
- 支持将最近对话上下文继续带入下一轮 Agent 运行
- 支持在消息中回看工具执行过程、授权与恢复动作、停止原因，以及错误或必要输出的折叠明细
- 支持运行中继续输入请求并加入请求队列，队列显示在输入框上方，普通队列项会在当前轮完成后按顺序自动进入下一轮；队列项可点击“引导”直接进入对话并从队列移除，随后通过运行时引导队列静默注入当前 Agent 运行，在下一次工具规划、工具返回、主动验证或最终回复等 Runtime 决策点影响当前轮执行方向，也可编辑或删除
- 命令工坊会把“查下 / 查查 / 查一查”等口语查询识别为工具任务；对 Anthropic / Claude 等厂商当前模型清单、官方价格、最新资料这类容易变化的问题，Tool Requirement Engine 会强制走外部证据工具，并对常见输入笔误做查询归一化；如果第一次检索结果未命中预期官方域名、与用户问题不相关，或缺少模型/API ID/价格数字等回答所需证据，Runtime 会自动换用下一条官方 canonical query 或 pinned source 补搜，仍失败时最终回复会被约束为说明证据缺失，而不是输出基于旧记忆的“最新”清单
- 输入区附件按钮右侧保留访问权限下拉框，默认 `无需申请`，用户可在每轮提交前切换 `按需申请 / 无需申请`，对应值会随 `AgentRunRequest.permissionMode` 进入 Runtime 权限链路
- 支持会话列表切换与删除

## 6. 当前未完成但已预留的方向

- 应用广场实际内容
- 更多 workflow 卡片与工作记录维护能力
- 能力拓展实际执行编排
- 数据库管理能力页面
- 更正式的持久化方案，例如 SQLite
- MCP 独立测试页与更细粒度的连接诊断
- Skill / MCP 统一 capability 多轮编排与自动重试策略

## 7. 开发约束建议

- 新增功能前，先确认属于哪一层
- 尽量复用 `packages/shared` 中的共享类型
- UI 层不要直接耦合底层存储实现
- 仓储优先通过 `packages/workbench` 或 `packages/memory` 承接
- 文档与进度变更优先同步到 `docs/CHANGELOG.md`
- 页面结构与交互风格优先参考 `docs/STYLE.md`

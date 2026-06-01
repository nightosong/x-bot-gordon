# Gordon 开发进度与清单

## 1. 文档定位

这份文档用于记录 **当前有效的开发状态、已确认的设计收敛结果、下一步待办**。

它不是提交级（commit 级）流水账。详细历史改动以 Git 记录为准；这里应优先服务后续开发判断。

## 2. 维护规则

- 只保留当前仍然生效的结论，不重复记录同一问题的多轮微调过程
- 像素级样式微调、文案替换、图标替换、间距收紧等低价值记录，不单独保留
- 同一模块如果经历多次重构，只保留“当前结构”和“后续仍需继续做的点”
- 当文档和代码状态不一致时，以代码现状为准，并顺手回写文档
- 若需要回溯某次具体修改原因，请直接查 Git，不在这里堆叠历史过程

## 3. 当前状态概览

| 模块 | 状态 | 当前结论 |
|---|---|---|
| 桌面端基础框架 | 已完成 | 已升级为 `Electron ^41.2.1 + Vue ^3.5.32 + Vite`，保留原有工作台产品语义 |
| 首页与导航 | 已完成 | 采用“左侧品牌卡 + 功能入口 + 右侧单一主工作区”结构 |
| 桌面端视觉统一 | 已完成首版 | 已收敛为 Gordon Dark Glass Workbench（深色玻璃工作台）方向，沿用当前深色 Gordon 色系，优先通过全局 token、暗色玻璃卡片、状态色和控件质感统一，不改变现有架构排版 |
| 桌面端弹窗系统 | 已完成首版 | 权限申请、删除确认、关键失败提醒与轻量输入已切换到 Gordon 自绘确认 / 提醒窗口，不再依赖系统默认 confirm/alert/prompt；独立确认窗口已关闭 Node 集成并通过主进程拦截受控确认链接返回结果 |
| 首页机器人工作区 | 已完成 | 已切换为本地 `@splinetool/runtime` 方案 |
| 模型管理 | 已完成 | 已支持配置列表、供应商切换、编辑、优先模型、余额查询、用量统计、Chat Completions / Responses 接口格式、流式输出开关与真实文本调用；多模态生成不进入模型管理，改由能力拓展 TOOL 配置承接 |
| 模型配置持久化 | 已完成 | 当前走本地 JSON 仓储 |
| 任务笔记 | 已完成三阶段 | 已形成“本周驾驶舱 + 历史记录 + 项目推进/汇报双视图”的当前形态，汇报视图支持日报、周报和按日期范围生成述职报告 |
| 命令工坊 | 已完成首版 | 已支持多轮会话、默认 Agent、附件上传、按需工具调用和按需过程流展示；简单问答不再展示开场思考 / 执行计划卡片，真实工具执行、授权、参数修复、重试 / fallback、中间输出和停止原因才进入可见时间线，并按 harness Agent 语义区分本地工具和外部 MCP；默认 Agent 已接入 Workspace Tools、Search Tools、Gordon Tools 与 Application Tools，可进行高质量联网研究、GitHub 仓库搜索、发现已启用的 TOOL 配置，并可新建或联动应用广场的墨笔生花小说资产；自动工具循环已引入首版任务账本、决策轨迹、分层观察和结构化成功条件，工具规划每轮基于 `taskPhase / activePlan / structuredSuccessCriteria / observations / failedAttempts` 决定下一步，并为工具调用记录预期结果与验证方式；同一会话会把上一轮助手消息 artifact 中的 `taskLedger` 注入下一轮 Agent 请求，支持长期任务跨轮延续；当前以 Gordon 持续执行型工程 Agent 为唯一默认内置 Agent，科研协作通过 `arthur-research` Skill 加载，显然需要工具的任务会自动进入工具编排和验证闭环 |
| 能力拓展管理 | 已完成三阶段 | Agent / Skill / MCP / TOOL 管理、Runner、自动选 tool 已接通，已内置 `skill-creator` |
| CLI 基础命令 | 已完成 | `summary / providers / modules / tasks / memory` 已可用 |
| 双层记忆体系 | 已完成 | `references / experience` 已接通 |
| 应用广场 | 已完成首版 | 当前已接入写作助手“墨笔生花”，支持应用入口、书架、书籍详情三 tab、篇幅策略、章节化目录 / 编写状态、本地书稿持久化、结构化 storyAssets 故事资产、Narrative State 叙事状态图、长文本创作工作流式 AI 辅助、prompt 资产外置、黄金一章/三章自评、章节生成后的连续性资料写回和已完成章节书稿导出；漫画创作应用“丹青溢彩”已支持应用入口、项目架、新建项目、项目详情三 tab、本地项目持久化、项目级素材库和灵绘小筑抽屉，总介绍 / 目录通过优先文本模型生成漫画介绍、画风规划、总规划或章节目录，素材库可维护人物（16:9 单张三视图）、物品（16:9 单张三视图）、场景（多图 / 多视角）并在单章生成中引用，素材库左侧列表可折叠，单章生成通过 `image_gen` 生成单张漫画图、漫画页分镜、封面海报或多张连续图，并以左侧图片舞台 + 右侧选中图片参数 / 生图提示词联动面板展示章节内容；章节图片已从生成稿正文拆到 `ComicChapter.images`，每张图记录自身提示词、尺寸和质量，旧 Markdown 图片可自动迁移，data URL 图片会文件化沉淀到 `data/workbench/comic-images/`；视频生成应用“流光绘影”已支持应用入口、项目架、新建项目、项目详情三 tab、镜头规划和本地项目持久化；项目型详情页已统一把书名 / 项目名移到左侧折叠信息轨，顶部原标题区域用于承载 tab 导航，编辑区不再叠加二级标题卡，左侧单行输入和下拉控件已 mini 化并使用暖金色字段 label，标题 / 命名类输入支持临时清空并在 10 秒无新输入后回退；音乐创作应用“瑶琴映月”已升级为“应用入口 -> 专辑列表 -> 专辑编辑详情”，支持空列表提示、新建专辑、左侧可折叠专辑信息轨、顶部全部 / 草稿 / 成品 tab、播放器、曲目编辑、专辑 Markdown 导出、顶部瑶音小筑助手入口、优先模型生成制作草案，并可通过 `music_gen` 调用 Mureka / Suno 发起生成和查询结果；占卜运势应用“灵犀照命”已升级为多流派对话问询工作台，左侧保留今日运势、综合看命、面相手相、阳宅风水、事业财运、感情关系、抉择占卜七个常用入口，右侧以聊天流承接用户问题、图片 / 资料附件、必要信息追问、象意取卦 / 盘名和可复盘解读，提示词按资料完整度、取象来源、卦名合理性、交叉印证、行动建议和复盘指标生成参考；主要长文本编辑框已接入字段级 AI 优化，可在字段旁调用优先模型并替换或追加回当前字段；应用广场主模板、写作基础动作、写作 AI 编排、漫画项目动作、漫画 AI 抽屉、视频项目动作、音乐创作动作、运势解读动作与字段优化动作已迁入 feature 模块 |
| 流程中心 | 已完成三阶段 | 已从“效率工具”收敛为 workflow 入口，模型接口测试已支持动态请求步骤、环境切换、环境级 APIKEY 注入、请求 Body 快捷编辑、响应变量提取、步骤级轮询、实时执行输出、可中断执行、可视化执行状态与折叠式请求步骤；流程中心页面动作已迁入 `workflowActions.js` |
| 渲染层模块化 | 进行中 | `App.vue` 正在从全量业务承载收敛为顶层壳层；`shell / model-management / weekly / command-workshop / workflow-library / marketplace / writing / extensions` 已建立 feature 目录，优先承接各模块配置、初始状态、prompt 构建、可复用纯逻辑、业务动作与局部页面组件；`App.vue` 已降至约 900 行，继续保留功能视图选择、少量共享状态和跨模块接线 |
| Database Center | 待开发 | 仅有模块定位与数据层预留，页面未完成 |

## 4. 当前已落地能力

### 4.1 基础工程

- 已完成 `apps/desktop`、`apps/cli`、`packages/agent`、`packages/core`、`packages/providers`、`packages/memory`、`packages/workbench`、`packages/shared` 的基础分层
- 已配置本地 macOS 安装包构建链路，`pnpm run dist:mac` 会执行桌面端构建并通过 `electron-builder` 输出 ad-hoc 本地签名 DMG 到 `release/`；渲染层构建会清理旧 hash 产物，避免历史 Vite 文件累积进安装包；`pnpm run dist:mac:clean` 可在打包后清理 `mac-arm64 / *.blockmap / latest-mac.yml / builder-debug.yml` 等辅助产物，仅保留 DMG；`release/` 已加入 `.gitignore`，DMG 不携带仓库旧版 `data/`，桌面端和 CLI 启动会自动初始化 `~/.gord`，工作台数据统一落到 `~/.gord/data`，用户新增 / GitHub 导入 Skill 默认落到 `~/.gord/skills`
- 桌面端主窗口和导出窗口已显式声明 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`，与自绘确认窗口保持一致的安全姿态；preload 桥接唯一源文件为 `apps/desktop/src/preload.ts`，构建时由 `scripts/copy-desktop-assets.mjs` 生成 `dist/apps/desktop/src/preload.cjs`，源码树不再保留手写同步副本；旧版非 Vue `renderer.js` 已移除，渲染入口以 Vite `apps/desktop/src/renderer/index.html` -> `src/main.js` 为准。当前桥接覆盖 prompt 资产读取、TOOL 配置、命令工坊导出、视频 / 音乐项目保存导出和飞书日报配置 / 发送等 IPC 能力
- 已建立共享类型、工作台快照聚合与本地 JSON 示例数据
- 系统级提示词已迁移到仓库根目录 `prompts/`，避免散落在代码里

### 4.2 首页与桌面端壳层

- 首页保持“左侧品牌卡 + 功能卡 + 右侧工作区”的单主舞台结构
- 桌面端主窗口初始尺寸与最小尺寸统一固定为 `1180x760`，避免工作台在过窄窗口下破坏主舞台布局
- 模型管理、能力拓展等次级管理入口统一收进品牌卡设置菜单
- 渲染层已完成 Vue 化，但保留 Gordon 当前桌面工作台的核心布局语义
- 渲染层已建立 feature 目录边界：`shell` 承接工作台壳层配置、左侧导航、首页机器人舞台、工作台快照启动 / 刷新和根级 watcher，`model-management` 承接模型管理页面组件、编辑状态、余额 / 用量运行态和页面事件 actions，`weekly` 承接任务笔记页面组件、配置、初始状态、任务树 helper、日报 Markdown 生成、模板选择同步、驾驶舱洞察、编辑器同步、自动保存、报表输出状态和页面事件 actions，`command-workshop` 承接命令工坊页面组件、会话状态、附件上下文拼装、Agent 消息转换、执行中 artifact 组装和页面事件 actions，`workflow-library` 承接流程中心页面组件、环境 / 步骤 / 记录草稿、curl / Body 解析、record 转换、运行结果展示 helper 和页面事件 actions，`marketplace` 承接应用广场页面组件、漫画 / 视频项目动作、音乐创作动作与运势解读动作，`writing` 承接 `墨笔生花` 配置、prompt 构建、书稿基础 actions、AI actions 和局部组件，`extensions` 承接能力拓展页面组件、Agent / Skill / MCP / TOOL 编辑状态、Runner 状态和页面事件 actions；后续新增业务逻辑应优先进入对应 feature 模块
- 首页机器人区域已使用本地 Spline runtime，不依赖在线 viewer
- 桌面端视觉已收敛为 Gordon Dark Glass Workbench（深色玻璃工作台）方向，统一深色海军蓝基底、青绿色主强调、暖金色辅助强调、珊瑚色风险态、暗色玻璃表面和克制渐变
- 当前视觉统一只调整全局样式与通用组件质感，不改变已确认的左侧入口 / 右侧主工作区架构排版
- 全局滚动条已统一为纤细无边框样式，轨道、角落和按钮保持透明；任务清单、应用广场、模型用量与字段级 AI 等区域只通过滚动条颜色变量做局部区分，不再单独定义粗细或透明边框
- 功能图标已收敛为 `lucide-vue-next` + `GIcon` 语义组件；按钮图标统一走线性、`currentColor` 和状态 token，品牌 / 模型 Logo 继续保留本地 SVG
- 权限申请、删除确认、关键失败提醒与周报模板命名已接入 Gordon 自绘弹窗，继续沿用 Gordon 深色玻璃、青绿主动作与珊瑚风险态

### 4.3 模型管理与调用链

- 支持模型配置列表、新增、编辑、启停、删除、拖拽排序与优先模型设置
- 图像、视频、音乐、TTS（语音合成）、ASR（语音识别）等多模态服务不作为模型配置类型维护；内置生成能力先在能力拓展的 TOOL 配置中维护供应商凭证与默认路由，并通过内置 `Gordon Tools` MCP 服务暴露给 Agent 调用
- 模型管理渲染层已拆出 `features/model-management/ModelManagementView.vue` 与 `features/model-management/modelManagementActions.js`：页面组件承接列表、供应商选择、编辑器和用量统计模板；actions 承接编辑状态、Provider 字段、余额查询、用量统计、保存、启停和删除动作；`App.vue` 当前只负责注入工作台状态、桌面桥接、弹窗 / 状态提示和刷新快照依赖
- 已支持为模型配置填写余额查询提取器代码，按 `request + extractor` 协议发起查询并自动注入 `{{apiKey}}`
- 已在已配置列表补齐余额小组件，可展示最近更新时间、已使用 / 剩余金额并支持手动刷新
- 已在余额刷新按钮左侧增加用量统计入口，点击后从配置列表切换到数据统计卡片；后台会每小时沉淀余额快照，统计卡片按凌晨 1 点日界线展示近 30 天每日用量，并对月中 16 日 13 点后的余额归零做简单重置处理
- 当前支持 `OpenAI / Azure / Google / Anthropic / 豆包 / 千问 / DeepSeek / 月之暗面 / 智谱 / Grok / OpenAI-like`
- 已接通基于优先模型的真实文本调用链
- 已按 Provider 区分 `OpenAI-compatible / Azure / Anthropic / Google` 四类请求路径
- 统一文本调用链默认 `max_tokens / max_output_tokens` 为 `32k`（`32768`）tokens，未显式指定输出预算的请求会使用该默认值；墨笔生花普通生成、章节生成和长篇规划的默认输出预算同步使用 `32k`
- 模型配置已支持“接口格式”与“流式输出”开关；OpenAI-compatible 可选 `Chat Completions` 或 `Responses API`，Responses 模式会调用 `/responses` 并自动附带稳定 `prompt_cache_key`，默认启用流式；命令工坊和单独生成入口都会按模型配置决定是否请求流式输出，遇到代理网关不接受 `stream=true` 时，可在模型编辑中关闭，调用链会直接走非流式请求；模型调用层只按当前模型配置的 Provider、Base URL 与接口格式执行，不内置部门代理或特定网关路由判断
- 针对 OpenAI-compatible / Azure / Anthropic / Google 响应已补充兼容解析与无正文诊断日志；非流式分支会先读取原始文本，再识别 JSON 或 SSE `: keep-alive` / `data:` 事件文本；Responses 模式额外兼容第三方网关返回 Chat Completions 风格增量片段或最终完成快照；当当前接口格式返回空文本、协议不匹配或网关业务错误时，会直接按模型配置报错，不再自动跨 `Responses / Chat Completions` 改打另一种接口格式，避免误导用户判断模型协议配置

### 4.4 任务笔记

- 已形成“本周驾驶舱 + 历史周报列表”的列表态
- 周报列表右上角已改为按已有年份生成的 mini 年份筛选；列表展示当前年份下的全部周记录，不再只截取最近 5 条
- 当前周编辑页采用“项目推进 / 汇报视图”双视图结构，不再回退为并排多窗格
- 项目推进以递归任务树为主数据结构，支持项目、任务、子任务的就地新增、删除、编辑、任务级子树折叠、通过序号圆圈拖拽子任务到项目根目录或其他子任务下，并在移动时保留整棵子任务树、根级投放反馈与自动保存
- 任务状态、时间戳、结构化文本回写与历史周重开链路已接通
- 任务表达优化已接通，并对短文本增强、父任务概述、动词多样性和避免机械“完成XXX”等场景做了约束
- 单条任务优化提示词已增强为信息密度提升方向，按“动作 + 对象 + 内容/范围 + 目的/影响”改写日报任务项，并补充模型协议、参数映射、统一调用、兼容适配等平台工程表达规则
- 汇报视图已统一收敛为“日报 / 周报 / 述职报告”模式面板，共用一套输出区与执行入口；述职报告支持右侧起始日期 / 结束日期选择，并提供可折叠的补充要求输入，可填写身份、职责、重点项目和希望强调的贡献，生成时会聚合日期范围内日报素材并交给优先模型生成正式述职报告
- 汇报视图底部总结已从多张大卡收敛为单张紧凑“汇报摘要”，通过质量 / 结果 / 风险 / 下周 tab 切换查看，避免挤占日报和周报输出区空间
- 周报模板选择已并入汇报视图右上工具栏，使用自绘紧凑下拉控件，减少标签占位并保持菜单项风格一致
- 周报模板编辑区已改为可折叠面板，并补充右上角字段级 AI 优化入口，可生成优化结果后替换或追加回模板
- 日报基于“今日更新叶子任务”生成；周报基于当前项目树与模板生成；述职报告基于所选日期范围内的日报素材生成，提示词要求按阶段成果、风险控制、能力沉淀和后续计划做专业归纳，不编造未记录指标
- 日报输出区在日报模式下直接使用 `YYYY/MM/DD 日报` 作为标题，不再额外占用右上角提示位
- 日报输出区已支持飞书群发送：标题栏时间标签右侧可配置群机器人 Webhook / 签名密钥 / 标题前缀，日报生成按钮右侧提供分享图标按钮，由主进程调用飞书 webhook 发送富文本卡片消息；卡片正文使用 `markdown` 元素渲染，卡片标题保持“前缀 + 日期”的精简格式
- 周切换自动补新周记录时，会继承上周仍未结束的任务分支，并保留对应父级链路，便于连续推进
- 周报模板已支持默认模板与自定义模板管理
- 周报 / 日报 / 述职报告输出的 Markdown 清洗、预览、层级保留与富文本剪贴板复制链路已做过专项收敛；复制时会写入 `text/html` 与 `text/plain`，便于把已渲染的报告直接粘贴到飞书聊天窗口，日报大模型优化会在保留任务树结构的前提下统一叙述格式、技术名词大小写与状态表达
- 任务笔记渲染层已拆出 `features/weekly/WeeklyWorkbench.vue`、`features/weekly/weeklyRuntime.js` 与 `features/weekly/weeklyActions.js`：`WeeklyWorkbench.vue` 承接任务笔记列表态、项目推进编辑态和汇报视图模板；`weeklyRuntime.js` 集中承接任务树遍历、任务状态推导、日报 Markdown 构建、日报层级校验、述职报告日期范围素材聚合、模板选择同步、任务记录标签、Markdown 输出清洗和驾驶舱洞察；`weeklyActions.js` 承接周记录打开 / 删除、编辑器同步、项目与任务增删改、任务表达优化、模板新增 / 删除、报表模式切换、手动 / 自动保存、日报 / 周报 / 述职报告生成和输出复制等页面事件处理；`App.vue` 当前只负责注入响应式状态、桌面桥接和弹窗 / 状态提示依赖，并保留 computed / watch 接线

### 4.5 应用广场

- 应用广场已从占位页接入写作助手 `墨笔生花`，并新增漫画创作入口 `丹青溢彩`、视频生成入口 `流光绘影`、音乐创作入口 `瑶琴映月` 与占卜运势入口 `灵犀照命`
- `墨笔生花` 采用“应用入口 -> 书架 -> 书籍详情”的三段式结构
- `丹青溢彩` 采用“应用入口 -> 项目架 -> 项目详情”的三段式结构，定位为漫画创作工具；项目架布局与 `墨笔生花` 书架一致，空列表时会在列表区域中央显示轻量提示；项目详情已对齐为“总介绍 / 目录 / 单章生成”三个 tab，支持左侧项目信息折叠、通过左下角“导出”入口导出项目 Markdown，并维护单色 / 彩绘、单图海报 / 连载企划、类型、画风、页数、项目级素材库、分镜简介和章节图片区；总介绍 tab 可在项目设定与素材库之间切换，素材库支持创建人物（16:9 单张三视图）、物品（16:9 单张三视图）、场景（多图 / 多视角），左侧素材列表可折叠，素材具备唯一 id 与项目内唯一命名；右上角提供与添香小筑位置一致的灵绘小筑抽屉，总介绍与目录下只展示文本生成动作，支持写回故事与画面目标、画风与镜头、总规划或章节目录；单章生成下才展示数量 / 尺寸 / 质量，并通过 `image_gen` 生成单张漫画图、漫画页分镜、封面海报或多张连续图，当前章节可勾选引用素材，出图时会把引用素材视图图源作为 `images` 传入图生图，图片结果写入章节图片区而不再塞入生成稿正文；单章生成页右侧按左侧选中图片联动显示图片参数和可 AI 优化的生图提示词；单章生成的章节选择下拉已和 `墨笔生花` 对齐，打开时会定位到当前章节；`墨笔生花`、`丹青溢彩`、`流光绘影` 的详情页标题统一移到左侧信息轨编辑，顶部标题位统一承接 tab 导航，编辑内容直接铺开而不再包一层带标题的外框；左侧信息轨的单行输入、下拉框和字段 label 统一收敛为更紧凑的 mini 风格，更新时间与“导出”入口统一落在信息轨左下角；标题 / 命名类输入支持临时清空，10 秒内没有新输入才回退旧名；项目架与书架均支持右上角胶囊删除按钮，删除前使用 Gordon 自绘确认框并把本地资产移入系统回收站
- `流光绘影` 采用“应用入口 -> 项目架 -> 项目详情”的三段式结构，定位为视频生成项目工作台；项目架布局与 `墨笔生花` 书架一致，空列表时会在列表区域中央显示轻量提示；项目详情包含“项目设定 / 镜头规划 / 生成台”三个 tab，支持左侧项目信息折叠、通过“项目导出”弹框导出项目 Markdown、新建镜头，并维护文生视频 / 图生视频、画幅、类型、默认时长、项目概念、视觉与运动风格、分镜规划、镜头说明、参考素材、正向提示词、反向提示词和生成结果
- `瑶琴映月` 采用“应用入口 -> 专辑列表 -> 专辑编辑详情”的三段式结构，定位为音乐生成与成品管理工具；专辑列表对齐 `墨笔生花` 书架和 `丹青溢彩` 项目架，支持空列表提示和新建专辑；专辑详情对齐项目型编辑页，左侧为可折叠专辑信息轨，底部左侧展示更新时间、右侧提供导出入口，顶部标题位改为全部 / 草稿 / 成品 tab，右侧为曲目编辑与播放器，制作草案收敛为轻量字段而非大标题卡片，瑶音小筑助手抽屉对齐添香小筑 / 灵绘小筑的任务选择、运行和反馈结构；当前支持本地专辑库、专辑信息编辑、专辑 Markdown 导出、曲目草稿 / 成品筛选、曲目编辑、音频 URL 播放器、优先模型生成制作草案，并可通过 `music_gen` 调用 Mureka / Suno 发起歌曲或纯音乐生成任务，再用任务 ID 查询结果并回填音频
- `灵犀照命` 采用“应用入口 -> 独立对话页”的轻量结构，定位为占卜与运势问询工作台；当前左侧保留今日运势、综合看命、面相手相、阳宅风水、事业财运、感情关系、抉择占卜七个常用入口，用户可通过聊天输入问题并上传手相、面相、户型、工位或资料附件，应用会按信息完整度先追问必要资料，再复用当前优先模型生成娱乐性、反思性、可复盘的卦名 / 盘名与趋势参考
- `墨笔生花` 应用入口固定在项目中，生成或导入的小说不再硬编码到前端常量，而是落在 `~/.gord/data/workbench/writing-books/<书名>/`
- 每本小说本地目录包含 `book.json`、`chapters.json` 和按需生成的 `chapters/<uuid-hex>.md`，分别承接故事介绍 / 篇幅配置、幕 / 卷设计、结构化 `storyAssets` 故事资产、`narrativeState` 统一叙事状态图、长篇分批规划任务、章节目录元信息和章节正文；章节标题变更只更新 `chapters.json`，不会再依赖标题作为正文文件名；无正文章节不会提前生成 `fileName` 或空 md，首次写入正文时才创建章节文件并回写映射；幕 / 卷落在 `book.json.parts`，题材自定义设定条目落在 `book.json.extraIntroSections`，故事命题、世界观、人物、关系、时间线、伏笔、规则、风格档案和连续性备注落在 `book.json.storyAssets`，人物状态、世界规则、资源 / 债务 / 伤势、区域状态、伏笔压力、故事弧、时间线、连续性风险和计划漂移落在 `book.json.narrativeState`；旧书籍只有缺少 `narrativeState` 时才会从 `storyAssets` 初始化基础状态，后续以 `narrativeState` 为叙事运行时主数据，避免旧资产结构阻挡重构路线；长篇目录生成进度落在 `book.json.outlinePlannerJob`，章节通过 `partIndex` 关联；章节目录以 integer `index` 标注全书连续章序，`title` 保存纯标题，避免界面出现“第X章 第X章 …”
- 章节正文生成提示词已内置默认写作约束：正文控制在 4000-5000 字、合理分段、包括第一段在内每段保留两个汉字宽度缩进、正文开头不输出“第X章”标题；AI 输出写回章节前也会清理开头章节标题
- `墨笔生花` AI 辅助已从单纯写作提示词增强为 Narrative Runtime：内置搭底盘、规划结构、生产章节和审阅修正四个创作阶段；提示词会注入结构化 `storyAssets`、`narrativeState`、风格画像、幕 / 卷、最近章节、当前章节、后续承接、伏笔与规则提醒，并注入黄金一章/三章自评标准，重点识别开场拥挤、人物过多、群像开局、设定倾倒、环境堆砌、人物白描、章节颗粒度过碎、标题模板化、战力 / 时间线 / 资源冲突、故事弧停滞和计划漂移等目录 / 开篇 / 长篇稳定性雷区；添香小筑用户入口已按创作阶段筛选写作动作，新增叙事状态图、风格画像、故事弧跟踪、计划漂移分析和连续性校验，故事介绍页展示轻量 Narrative State 指标；章节 AI 输出写入正文后会执行 story_memory 抽取，将新增稳定事实、证据载体、信息差变化、对手反制、伏笔线索和状态图节点合并回 `book.json.storyAssets / narrativeState`，同时声明连续性资料、设定账本和 `memoryNotes` 只是内部管理资料，避免被模型误扩写为“记忆/失忆/遗忘/档案”等核心题材
- `墨笔生花` 的“搭建故事设定 / 打磨故事设定 / 生成书籍介绍”提示词已补充未来异生态、侵蚀开荒和职业化战斗成长题材的纠偏规则：核心体验优先定位为“进入危险而壮丽的新生态世界”，主线保持持续移动和卷级新区域，主角成长落到战斗能力、危险区域权限、资源调度、人脉与通行权等硬成长，限制文明反思、身份撕裂、旧世界哀歌和世界真相讨论压过冒险生存；其中“打磨故事设定”在识别到全新、替换、重做、剔除、不希望、不要、保留纯粹等方向调整时，会按设定替换协议输出可直接替换「大纲指导」的新设定稿，不再把保留 / 删除 / 取舍判断作为写回正文。
- `墨笔生花` 写作 prompt 资产已外置到 `prompts/workbench/writing/`，由主进程白名单 IPC 动态读取，渲染层通过 `features/writing/writingPromptBuilder.js` 组装最终 prompt；写作应用配置已迁移到 `features/writing/writingConfig.js`，`features/writing/writingActions.js` 承接书架、书籍详情、章节编辑、导入导出与自动保存动作，`features/writing/writingAiActions.js` 承接 prompt 预览、模型调用、长篇分批规划、AI 输出解析与写回，添香小筑抽屉已拆为 `features/writing/WritingAiDrawer.vue`
- 应用广场主模板已拆入 `features/marketplace/MarketplaceView.vue`，承接应用入口、写作书架 / 详情、漫画项目架 / 详情、视频项目架 / 详情、音乐专辑列表 / 详情、运势解读页、写作 AI 抽屉挂载和导出弹框；`App.vue` 当前通过 `marketplaceViewContext` 按漫画 actions、视频 actions、音乐 actions、运势 actions、写作 actions、写作 AI actions 分组注入，避免在顶层展开上百个应用字段
- 应用广场已新增通用字段级 AI 优化器：`FieldAiOptimizer.vue` 负责编辑框旁的紧凑星光按钮和悬浮面板，`fieldAiActions.js` 负责优先模型调用、停止、替换 / 追加写回；当前已接入墨笔生花、丹青溢彩、流光绘影和瑶琴映月的主要 textarea，后续新增编辑框通过传入字段 id、上下文和 setter 即可复用
- `丹青溢彩` 漫画项目动作已拆入 `features/marketplace/comicActions.js`，包括项目归一化、项目架动作、章节编辑、自动保存、删除与 Markdown 导出
- `流光绘影` 视频项目动作已拆入 `features/marketplace/videoActions.js`，包括项目归一化、项目架动作、镜头编辑、自动保存、删除与 Markdown 导出；视频项目持久化落在 `~/.gord/data/workbench/video-projects.json`
- `瑶琴映月` 音乐创作动作已拆入 `features/marketplace/musicActions.js`，包括专辑归一化、本地自动保存、删除、导出、曲目编辑、草稿 / 成品状态、优先模型调用、`music_gen` 工具调用、任务查询和生成反馈；音乐专辑持久化落在 `~/.gord/data/workbench/music-projects.json`
- `灵犀照命` 运势解读动作已拆入 `features/marketplace/fortuneActions.js`，包括入口切换、类型切换、聊天消息、附件队列、优先模型调用和生成反馈；命理框架元数据维护在 `FORTUNE_ANALYSIS_METHODS`，当前覆盖八字、紫微、易占、相学、风水、姓名数理、星象和现实校准
- `墨笔生花` 添香小筑任务已收敛：故事介绍保留“搭建故事设定 / 打磨故事设定 / 生成书籍介绍 / 开篇体检”，并新增“沉淀连续性 / 关系连续性”用于维护结构化故事资产；书籍目录保留“规划章节目录 / 目录体检”，并新增“节奏导演 / 追读钩子”用于长篇节奏和章节追读审阅；章节编写保留章内计划、初稿、扩写、对白增强、高潮场面、压缩润色、开篇自评和章节质检，并新增“AI 味检测”；体检、自评、质检、节奏、追读和 AI 味检测默认只用于审阅，不会通过“追加 / 替换”写入正文或设定
- 书籍详情左侧信息轨左下角已提供小型“导出”入口，可选择 `txt / md` 与输出目录，将当前书籍的已完成章节按“书名 -> 书籍介绍 -> 幕/卷 -> 章节标题 -> 章节正文”顺序拼接成固定文件名 `<书籍名>.<扩展名>` 的本地文件，确认保存后自动关闭弹窗
- 书架支持从本地书稿目录加载、新建书籍、上传 `.txt / .md / .json` 书稿，并展示篇幅、类型、字数和完整度
- 书籍详情页包含故事介绍、书籍目录、章节编写三个 tab：故事介绍会按短篇 / 中篇 / 长篇切换介绍、大纲指导和长篇分部规划，固定介绍字段已改为折叠编辑卡，并支持按题材动态新增人物关系、怪物体系、战斗体系等自定义设定条目；书籍目录采用章节列表 + 右侧章节简介联动编辑面板，左侧章节 item 右侧会以浅色小字标注所属幕 / 卷；章节编写支持选择章节、优先打开最新进行中章节，并可提交标记完成
- 章节编写的章节选择下拉框打开时会自动定位到当前章节，避免长篇项目在百章以后仍从第一章开始查找
- 章节编写顶部控制条的章节选择、搜索、状态标签与提交按钮保持统一高度和字号；提交按钮文案收敛为“提交”，提交后会临时显示变暗的“已提交”，直到重新进入章节或正文发生新修改
- AI 辅助面板支持按 tab 选择写作动作、填写额外要求、预览提示词、调用优先模型后台生成结果，并在动作区明确展示“写入到哪里 / 仅审阅”；生成过程中只锁定当前书籍的编辑工作区，顶部返回书架与切换其它书籍不受阻塞；普通生成建议和长篇分批规划均可通过运行浮层停止当前模型请求
- 提示词会按短篇 / 中篇 / 长篇切换不同创作策略，并按“故事介绍 / 书籍目录 / 章节编写”的每个写作动作拆分专属提示词结构；书籍目录的章节规划已额外支持长篇扩展意图识别，能把“扩写 / 分为 X 幕 / 每幕 X-Y 章 / 几百章 / 上千章”切换为分批规划任务
- 书籍目录的“章节规划”会结合故事介绍、大纲指导、用户要求和已有目录生成最终章节 JSON；生成格式要求 `parts` 承接幕 / 卷设计，`chapters` 每章包含 integer `index`、可选 `partIndex` 与不含“第X章”前缀的 `title`；目录规划提示词要求每章按 3000-5000 字正文容量设计为章节级事件，合并过碎拍点，并禁止“地点 + 初临/旧痕/试探/险声/伏身/短斗/变招/代价/所得/开路”等固定后缀标题；当用户声明重改目录时不代入已有目录，替换 / 追加后会更新 `book.json`、`chapters.json` 与章节 Markdown 映射；当用户提出百章以上的长篇扩展目标时，会先生成幕 / 卷级 Master Plan，再按固定批次生成章节并增量合并落盘，避免单次输出 token 限制把目录压回短篇规模，也避免批次异常时用当前批覆盖已完成章节
- 长篇分批规划已支持真实中断当前模型请求，停止后会把任务标记为 `cancelled`，并在当前书籍运行浮层右侧提供圆形停止键；普通生成建议停止后会按“已停止”收尾，不写入已取消结果
- 长篇分批规划遇到临时网络、网关 5xx 或空正文类错误时，会对当前请求退避重试最多 5 次；仍失败时保留已落盘进度、最近错误和目标参数，前端可直接点击“继续规划”从本地缺失的第一章恢复执行

### 4.6 命令工坊

- 已从占位页升级为真实 chat 工作台
- 采用“会话列表 / 对话态”的两段式结构，保持单一主工作窗口
- 支持会话持久化、多轮消息沉淀、删除会话与继续追问
- 默认内置 Gordon Agent，直接复用当前优先模型作为兜底执行角色；Arthur Research OS 已下沉为 `arthur-research` Skill，可在会话内加载用于问题发现、假设形成、文献研究、证据验证、早期错误方向识别、论文写作、审稿评价与投稿打磨；该 Skill 保留科研决策优先级、假设剪枝、可证伪信息增量目标、致命审稿检查和最小区分实验输出，并对化工结晶研究启用 Crystallization Research Copilot 领域适配
- 默认内置基础 Skill、`Workspace Tools`、`Search Tools`、`Computer Use`、`Gordon Tools` 与 `Application Tools`，保证首次进入即可开始协作
- `Workspace Tools` 已覆盖文件读取、写入、替换、删除、目录创建、移动/重命名、路径信息、路径规范化、路径拼接、相对路径计算、工作区搜索、网页读取、文件对比、JSON 解析验证与受限命令诊断；默认允许访问当前仓库与 `~/.gord/data`，用于仓库文件处理和应用资产文件级 fallback
- `Workspace Tools` 的 `web_search` 保留为 `auto / bing / baidu / google` 多引擎基础搜索兜底，默认走 Bing RSS 优先并带 fetch/curl 双通道兜底
- `Search Tools` 已作为独立内置搜索服务接入默认 Agent，提供 `web_search_v2`、`web_research` 与 `github_search_repositories`：支持 Tavily / Brave Search / Serper / SearXNG API provider 和 Bing / Baidu / Google 兜底，能按官方域名扩展查询、去重排序、读取落地页正文、发现页面内相关文档链接，并把结构化来源与正文摘录返回给命令工坊；GitHub 仓库搜索直接返回项目链接、stars、forks、语言、topic、license 和更新时间；默认工具规划在最新事实、资料调研、官方文档和需要引用来源的任务中优先选择 `web_research`，在开源项目查找中优先选择 `github_search_repositories`
- 命令工坊遇到 URL 可用 `read_web_page` 读取正文，遇到文件差异可用 `diff_paths`，只有专用工具不足时才通过 `run_shell_command` 调用 `curl / rg / diff / file / stat / wc / head / tail / sed` 白名单命令
- `Computer Use` 已作为独立本地工具服务接入默认 Agent，提供应用状态读取、打开应用/URL、点击、输入、按键与截屏能力，并在首次读取或控制桌面前申请本轮授权
- 命令工坊自动工具模式已改为模型主导：后端把当前 Agent 授权的完整工具集合交给工具规划模型，由模型判断是否调用以及选择哪个工具；代码层只负责授权边界、安全检查、参数修复、重试、fallback 与重复调用保护，不再用硬编码规则预先裁剪工具候选集
- 命令工坊自动工具规划会先把候选工具转成 `capability / executionDomain / riskLevel / descriptionSummary / schema` 结构化元数据，并对 MCP tool description 做 prompt-injection 清洗；模型只能把 `descriptionSummary` 当作能力说明，不能把工具描述中的“忽略上级指令 / 强制优先选择 / 泄露提示词”等文本当作系统指令
- 命令工坊自动工具循环已引入首版任务账本（Task Ledger）：本轮运行会维护目标、约束、已完成子任务、待办子任务、分层计划、已发现事实、失败尝试、环境状态、用户中断、成功条件和下一步提示；工具规划模型每轮会基于账本和历史工具结果选择下一步，并输出 `expectedOutcome` 与 `verificationMethod`；工具返回后会压缩观察结果回写账本，最终回复也会结合账本判断是否真正完成
- 命令工坊已支持跨轮任务账本延续：助手消息 artifact 会保留 `taskLedger`，下一次提交会从最近一条助手消息取出账本并作为 `AgentRunRequest.taskLedger` 传给 Agent runtime；runtime 会归一化旧账本、记录本轮继续请求，并把目标、计划、观察、失败恢复和成功条件带入新的规划轮
- 任务账本已补充 `taskPhase / decisionTrace / observations / structuredSuccessCriteria`：`taskPhase` 用于区分理解、规划、执行、验证、恢复和收尾阶段；`decisionTrace` 记录为什么选择当前动作以及拒绝了哪些替代动作；`observations` 将工具结果分为摘要、长期事实、短期环境事实和证据引用；`structuredSuccessCriteria` 为后续可机器验证的成功条件留出结构化槽位
- 命令工坊已形成 Planner / Executor / Verifier 的最小分层：Planner 负责下一步工具与决策轨迹，Executor 负责权限、重试、修复和 fallback，Verifier 已从任务账本中独立出来，会在最终回复前根据工具历史更新结构化成功条件状态，并把匹配到的 evidence 回写到任务账本，避免直接把“模型认为完成”当作真实完成
- Verifier 已支持主动验证首版：当 `tool_result / file_contains / url_opened / command_passed / ui_state / artifact_created` 仍为 pending 或 unknown 时，runtime 会在最终回复前最多发起 2 轮验证规划，由模型在完整授权工具集合中选择最小副作用验证工具；`text_response / custom` 不触发主动验证，也不阻塞最终整理
- Verifier 已新增验证策略上下文：按成功条件类型生成 intent、能力偏好、执行域偏好、风险边界、参数提示、证据要求和失败信号，并注入主动验证规划；该上下文只作为模型规划偏置，不裁剪候选工具，继续保持模型主导工具选择
- 主动验证已新增质量评分与账本回写：每轮主动验证会基于工具画像、成功条件状态变化和 evidence 质量生成 `qualityScore / riskLevel / evidenceGrade`，并把评分摘要写入 `discoveredFacts`；失败或仍未确认时会更新 `nextActionHint`，帮助后续恢复或最终回复准确标注未验证状态
- Agent runtime 关键纯逻辑已从 `runtime.ts` 拆到 `ledger.ts`、`tool-metadata.ts`、`failure-classifier.ts`、`verifier.ts` 与 `runtime-utils.ts`，并新增 `pnpm run test:agent` 覆盖工具描述清洗、工具画像、失败分类、账本归一化 / 合并、结构化成功条件验证和 evidence 生成
- 工具失败分类已从“schema / 不可用 / 执行失败”扩展到权限受限、环境状态变化、工具不匹配、时序过早和目标不存在，便于后续 fallback、账本恢复和前端过程流更准确表达失败本质
- `Gordon Tools` 已作为独立本地工具服务接入默认 Agent，会按能力拓展 TOOL 配置动态暴露已启用工具；当前 `image_gen` 可读取 OpenAI 系列图片配置并调用 `imagen` / `imagen/edit`，`music_gen` 可读取 Mureka / Suno 配置调用歌曲 / 纯音乐生成和任务查询，并把音频 URL 归一化为可展示产物
- `Application Tools` 已作为独立本地应用工具服务接入默认 Agent，首版把命令工坊联到应用广场的 `墨笔生花` 资产，支持新建小说、小说列表、书稿读取、关键词检索、章节修改 dryRun 预览 / 写回、小说字段 dryRun 预览 / 写回，以及结构化故事资产写回；新建小说可一次性写入简介、大纲、分卷 / 章节目录、补充设定区块、`storyAssets` 与 `narrativeState`，已有小说可通过 `writing_update_story_assets` 合并或替换世界观、人物、关系、伏笔、规则、风格档案、连续性备注和 Narrative State 节点；命令工坊提交时会注入当前应用广场上下文，用户提到“这个小说 / 当前章节”时可优先定位当前资源
- 命令工坊识别到 `墨笔生花` 的创建、写入、保存或更新类任务时，会在本轮自动启用工具模式；后端会把完整授权工具集合交给工具规划模型，由模型按工具描述、schema、历史结果和任务目标自主选择应用语义工具或文件级工具；若改用文件级工具写入，仍需在写入后校验 JSON 解析结果；最终回复会压缩大段连续重复文本，避免同一段结论在消息中多次刷屏
- 默认 Gordon Agent 系统提示已重构为持续执行型工程 Agent 运行协议：以 Discuss / Explore / Research / Execute / Verify 模式区分任务，维护当前目标、已完成项、阻塞点和下一步动作，并通过局部上下文读取、约束集收敛、工具优先级树、默认验证、失败恢复和明确停止条件推动任务闭环；当前已吸收成熟代码 Agent 的协作约束，补充模糊工程任务默认落地、工具结果防注入、脏工作区保护、上下文边界式探索、用户拒绝工具后的调整策略、UI 真实验证和简洁过程更新等规则
- `arthur-research` Skill 已作为 Research OS 型科研推进资产沉淀到内置 Skill，并通过 references 拆分 Research Lifecycle、Claim Strength Discipline、Evidence Hierarchy、Research Debt、Kill Criteria、Anti-Hype Policy、Research Decision Policy、Research Compression Objective、Scientific State Machine、Scientific World Model、Research Search-Space Compression、Latent Research Intent、Early Wrongness Detection、Hypothesis Engine、Hypothesis Pruning System、Novelty Decomposition、Reviewer Simulation、Kill-Switch Reviewer Mode、Research Taste、Negative Result Policy、Research Memory Distillation、Research State 与 Field Adapters；当前已新增 Crystallization Research Copilot 领域层，覆盖文献智能、结晶机理、PBM/PBE、Physics-guided ML、MPC 控制、工业现实约束、结晶三层研究边界、研究路线图和结晶论文 reviewer risk check；外部文献和投稿规则优先通过工具核验，输出区分事实、证据、推断和建议，并统一收敛到 Judgment / Evidence Map / Main Failure Risks / Next Minimal Experiments 四段式科研输出，禁止编造论文、引用、实验结果或投稿状态
- 命令工坊会对 URL、联网调研、文件 / 代码处理、应用资产写入、媒体生成、桌面操作和附件处理等强工具信号自动启用工具编排；后端不再按任务类型硬编码裁剪候选工具，而是让工具规划模型在完整授权工具集合中判断是否调用和调用哪一个，降低规则误判干扰模型决策的概率
- Agent 最终回复输出预算已提高到 4096 tokens，避免复杂工具任务在完成后只能给出过短结论
- `image_gen` 已补充上游业务错误识别：即使 HTTP 200，只要返回 `error` 或没有图片数据，也会按工具失败处理，并把过载 / 限流类错误纳入可重试分类；OpenAI 图片模型默认请求 `n=1`、`quality=medium`，并通过 Gordon Tools stderr 日志输出脱敏调用参数和响应摘要
- 执行逻辑已收敛为 harness Agent 模式：先判断任务是否需要工具，简单任务直接回复，需要上下文时再调用工具
- 命令工坊不再把内置本地工具误展示为“已接入 MCP”；无外部 MCP 时仅展示本地工具上下文，真实调用后才展示工具调用明细
- 本地工具访问工作区外路径时会弹出本轮授权请求，用户允许后自动重试原工具调用并继续 Agent 执行链
- 命令工坊已支持展示工具调用产生的结构化产物，`image_gen` 返回图片 URL 或 base64 图片时会在助手消息下方直接渲染预览
- 命令工坊执行链路已从纯聊天回合升级为主消息内按需过程流展示：运行中不再固定回显思路摘要和通用执行计划，内部工具规划不单独刷屏，真实工具调用、授权、参数修复、重试 / fallback、中间输出、停止原因和最终整理才进入可见时间线；底部不再重复展示关键动作详情链
- 聊天输入区已支持左下角加号附件入口，可传入图片、视频、文本、文档、表格和数据类文件；后台至少可读取 `txt / pdf / docx / pptx / xlsx / xls / csv / tsv / json / xml / yaml` 等文本内容并注入本轮上下文
- 命令工坊高级设置中的 Agent、Skill、工具服务和工具选择已从原生下拉框切换为 Gordon 自绘紧凑下拉控件，选项弹层统一使用 Gordon Dark Glass Workbench 的暗色玻璃、青绿色焦点和紧凑列表风格
- 命令工坊消息操作已收敛到底部元信息行：消息头只保留角色身份，消息下方展示时间与轻量图标操作组；AI 回复支持一键复制、导出 PDF 与导出 DOCX，复制优先写入富文本剪贴板并带纯文本兜底，PDF 通过 Electron 打印引擎生成更适合展示的 A4 文档，DOCX 作为可编辑的结构化 Word 文档输出
- 命令工坊 AI 回复富文本渲染已增强：标题、段落、列表、引用、链接、分隔线、表格、代码块和公式具备更明确的阅读层级，AI 消息使用更接近文档输出的阅读宽度与块级边界，支持 `$...$`、`\(...\)`、`$$...$$`、`\[...\]` 等常见轻量公式写法，并对分式、上下标、根号和常见数学符号做本地安全渲染，降低科研 / 技术长回答的文本墙感
- 命令工坊渲染层已拆出 `features/command-workshop/CommandWorkshopView.vue`、`features/command-workshop/commandWorkshopState.js`、`features/command-workshop/commandWorkshopRuntime.js` 与 `features/command-workshop/commandWorkshopActions.js`：页面组件承接会话列表、聊天消息流、执行链路回看、高级设置和输入器模板，并向 App 暴露输入聚焦 / 消息滚动方法；runtime 集中承接附件标题、附件上下文拼装、会话历史转 Agent messages 和执行中 artifact 组装；actions 承接会话切换、删除、附件选择、MCP tools 读取、表单归一化、提交运行、进度回显和执行链路展示 helper；`App.vue` 当前只负责响应式状态注入、桌面桥接注册、弹窗 / 状态提示依赖和视图 ref 接线
- 支持会话内选择 Agent、附加 Skill、自动工具、限定工具服务 / tool；运行中可输入新的引导并发送，命令工坊会先停止当前轮再继续执行新指令
- 助手消息中可回看工具执行过程、中间输出、授权与恢复动作、停止原因与链路摘要；工具参数与中间输出会对敏感字段和媒体大字段做脱敏 / 截断
- 聊天态已支持执行中链路与最终回复流式回显，不再只在最终结果返回后一次性展示；运行中可主动停止，已流出的部分回复会保留在当前会话中；OpenAI-compatible / Azure 网关若在流式通道未产出正文前报错、返回空流，或以 JSON 错误体拒绝 `stream=true`，会自动降级重试普通非流式请求，并在当前桌面进程内把该模型标记为非流式优先，避免同一代理反复打断本轮会话；流式解析已区分真正增量与最终快照，防止部分网关在流末返回完整消息时把回复追加成重复文本
- 命令工坊 IPC 入参与进度事件已增加纯数据化保护，避免联网工具返回复杂结果或继续会话时触发 `An object could not be cloned`

### 4.7 流程中心

- 已从“效率工具”正式收敛为 `流程中心 / workflow`
- 首页采用黄金比例横向 workflow 卡片，每行 3 张；进入模型接口测试后，记录列表同样采用更小的黄金比例卡片，每行 3 张
- 点击卡片后进入工作流列表页；列表页支持搜索、新建、复制、编辑、删除，点击记录进入执行页
- 当前首个落地卡片为 `模型接口测试`
- `模型接口测试` 当前支持沉淀历史记录、动态维护多个 curl 请求步骤、`$BASE_URL / $API_KEY / $TASK_ID` 风格变量、步骤产出变量 JSONPath 提取、dev/test/pre/prod 环境 Base URL + APIKEY 切换、环境级 APIKEY 密码式设置与执行注入、执行页请求 Body 快捷编辑、JSON 粘贴修复与格式化、步骤级单次 / 轮询执行、轮询成功 / 失败终止值、执行中实时 stdout / stderr 刷新、运行中主动中断、执行状态可视化和请求步骤折叠展示，并可从界面新建 / 复制 / 编辑 / 删除 / 执行 curl 工作流
- 流程中心渲染层已拆出 `features/workflow-library/WorkflowLibraryView.vue`、`features/workflow-library/workflowRuntime.js` 与 `features/workflow-library/workflowActions.js`：页面组件承接流程中心首页、工作流列表、编辑器和执行态模板；runtime 集中承接 curl 解析、请求 Body 修复、环境归一化、记录草稿转换、运行前缺失项检查和运行结果展示 helper；actions 承接选择同步、记录保存 / 复制 / 删除、环境与 Body 写回、执行 / 中断和 IPC 进度回显；`App.vue` 当前只保留顶层状态注入和事件注册
- 流程中心资产当前走本地 JSON 仓储：`~/.gord/data/workbench/workflow-library.json`

### 4.8 能力拓展管理

- 已支持 Agent / Skill / MCP Server / TOOL 的本地配置管理
- 能力拓展渲染层已拆出 `features/extensions/ExtensionsManagementView.vue` 与 `features/extensions/extensionsActions.js`：页面组件承接 Agent / Skill / MCP / TOOL 列表、编辑器和 Runner 模板；actions 承接编辑状态、Runner 状态、保存、状态切换、删除、读取工具与运行测试动作；`App.vue` 当前只负责注入工作台状态、桌面桥接、弹窗 / 状态提示和共享 Agent 查询 helper
- 能力拓展页已收敛为 `Agent / Skill / MCP / TOOL` 四页签结构
- TOOL 配置当前内置 `image_gen`、`video_gen`、`music_gen`，分别维护图片、视频、音乐生成能力的供应商启停、默认供应商、API Key、Base URL、模型 / 能力 ID 与备注；供应商范围先覆盖 OpenAI / Gemini / 即梦、Seedance / PixVerse / Veo / Sora、Mureka / Suno；`image_gen/openai` 已内置文生图 `imagen`、图生图 `imagen/edit` 端点与 `prompt / model / size / n / quality / image / images` 参数边界；`music_gen/mureka` 已内置 `/v1/song/generate`、`/v1/soundtrack/generate`、`/v1/song/query/{task_id}` 与 `/v1/vocal/clone`，`music_gen/suno` 已内置 `/api/v1/generate` 与 `/api/v1/generate/record-info`，默认 Agent 可通过 `Gordon Tools` 发现并调用已启用的音乐生成能力
- Agent 支持绑定模型、Skill、MCP Server，并进入 Runner 做测试运行
- 已接通单轮 Agent + Skill 运行链
- MCP 已支持 `stdio / http` 两类配置、tools 读取、手动调用与结果回填
- 自动工具模式已支持最多 3 轮的受控自动编排，并包含重复调用保护
- MCP 失败恢复、有限重试、错误分流、schema-aware 参数修复、fallback tool 已接通
- 最近执行日志、步骤流、停止原因与恢复状态已可回看

### 4.9 Skill 资产体系

- `~/.gord/skills` 目录支持递归发现，任意层级目录只要包含 `SKILL.md` 就会被识别为一个用户 Skill；`references/`、`assets/`、`scripts/` 默认作为所属 Skill 的附属资源；用户手工新增、界面编辑、GitHub 导入或外部加载的 Skill 必须落在 `~/.gord/skills`，内置 Skill 继续随应用资源保留在仓库 / 打包资源的 `skills/` 目录
- Skill 已不再只是 prompt 配置，而是目录级本地资产
- 已新增内置 `skill-creator`，用于创建、更新和校验 Gordon 本地 Skill 资产
- Skill 支持手工创建与 GitHub 导入，GitHub 导入会镜像整个 Skill 目录到本地
- Skill 来源元数据已可区分“手工定义”和“GitHub 导入”
- 带 handler 的 Skill 已支持按本地目录执行
- Skill handler 协议已正式化为 `gordon-skill/v1`
- 已新增内置 `writing` Skill，目录为 `skills/writing`；它作为复合小说创作工作流 Skill，内部约定 `story_planner / story_rebuilder / world_builder / character_designer / plot_engine / arc_planner / state_tracker / chapter_planner / chapter_writer / story_memory（连续性资料更新） / style_controller / scene_specialist / opening_auditor / continuity_auditor` 节点，并通过 `references/story-map-design.md`、`references/world-organization.md`、`references/creature-ecology-design.md`、`references/monster-system.md`、`references/combat-system.md`、`references/character-lineage.md`、`references/narrative-control.md`、`references/arc-planner.md`、`references/state-tracker.md`、`references/style-controller.md`、`references/continuity-auditor.md`、`references/scene-specialist.md` 补强故事地图、世界组织、怪物生态网、怪物生存民俗、战斗体系、人物谱系、叙事刹车、卷结构、世界 / 角色状态机、风格控制、一致性审核和高张力场景设计；当前已沉淀长篇创作提升规则，系统补设定时先确认主角渴望、抵达方向与出发理由，再补世界构成、路线地方、战斗生存、主角轨迹、人物谱系和怪物生态网；探险 / 末世游历类题材禁止默认落入世界真相、阴谋揭秘、公布真相、RPG 地图解锁或任务链结构；大地图必须补地方感、见闻感和人间活法，怪物、异兽和灾变生物必须先设计生态发动机、物种谱系、食物网、尺度 / 栖境 / 体态矩阵、关键种和季节变化，再设计人类长期共存后的习俗、误解、职业禁忌、方言和交易，最后进入战斗能力，并避免虫、蛛、菌等低成本形态主导物种想象；战斗体系从世界压力、生存工种、非击杀目标、动态空间、时间压力、感官压迫、错误代价、对手反制、失败后果和人物变化推导，避免技能树、固定小队配置和静态对轰；人物先建立谱系再补角色档案，同时补生活惯性、人物气味、地方化身体习惯、关系小证据和留白，降低“结构完整但没灵魂”的 AI 味
- `monster-system` reference 已补充怪物设计优先级、生成收敛原则、生态色谱、日常低等级生物、怪物塑造人和非人社会逻辑约束，降低全字段填表和高概念疲劳倾向，优先把怪物写成地方生活、人类关系和价值观的塑形力量。
- `story-map-design` reference 已补充地图设计优先级、最小必要地图原则、地方身体感、地图节奏层、路线不确定性、地方经济链、地图记忆锚点和地图塑造人格约束，降低地图关卡化、宏观化和 schema 填表倾向，优先把地图写成身体经验、地方活法和人物性格的塑形力量。
- `writing` Skill 的 reference 维护策略已从 200-300 行速查表调整为作品设计深参考库：`SKILL.md` 保持导航与节点约定，方法论、矩阵、失败诊断、类型差异和示例下沉到 `references/`，单个 reference 后续允许扩展到 1000-2000 行；当前已对世界组织、风格控制、场景设计、连续性审核、生态设计、地图、人物、怪物和战斗 reference 补充深参考扩展层。
- `writing` Skill 已新增 `narrative-control / arc-planner / state-tracker` 三个 reference 和 `arc_planner / state_tracker` 节点：前者约束设定裁剪、信息释放、叙事压缩、不可逆后果和人类压力优先；中者承接卷 / 大阶段目标、假目标、阶段压力、关系位移、代价、回收和结尾反转；后者维护 `world_state / character_state / economicFlows / themeAnchors / irreversibleConsequences`，防止长篇出现伤势蒸发、资源无限、路线失效、势力失忆和主题丢失。
- `writing` Skill 已补充已有书稿调整的内容保留协议：方向调整前必须盘点 `book.json / chapters.json / extraIntroSections / storyAssets`，对人物谱系、路线地方、世界组织、怪物体系、战斗体系、伏笔和连续性资料按“保留 / 融合 / 降级 / 删除”处理；清空章节规划不得连带清空世界设定内容。`continuity-auditor` 已增加已有内容保留审核矩阵，避免旧补充结构被整块覆盖。

### 4.10 CLI 与 Memory

- CLI 已支持 `summary`、`providers`、`modules`、`tasks`、`memory` 基础命令
- Memory 已完成 `references / experience` 双层结构
- 当前 Memory 仍走本地 JSON 存储，作为后续知识沉淀基础

## 5. 当前已确认的收敛结论

这些结论默认视为 **后续开发继续沿用** 的方向，不再把同一问题重新写成多轮历史记录。

### 5.1 首页与导航

- 首页继续使用“左侧品牌卡 + 左侧功能入口 + 右侧单一主工作区”壳层
- 模型管理、能力拓展等次级入口继续挂在品牌卡设置菜单下
- 不再恢复全宽顶部横栏，也不把多个主功能窗口并列摆放
- 后续视觉迭代继续沿用 Gordon Dark Glass Workbench，不切换为浅色基底或重赛博风格

### 5.2 任务笔记

- 列表态以“本周驾驶舱 + 历史记录”为准
- 编辑态以“项目推进 / 汇报视图”切换为准
- 项目树是任务笔记的主数据结构，不再回退为纯 Markdown 大文本编辑
- 日报与周报继续复用同一套汇报输出面板

### 5.3 流程中心

- 保持“首页入口卡片 -> 工作流列表 -> 执行 / 配置页”的三段式结构，不回退为所有能力同屏并排
- 工作流首页入口卡片和具体工作流内的记录列表都保持三列黄金比例卡片
- 当用户进入某个工作流后，当前功能必须吃满主容器；其它暂时无关功能应退出主视窗
- 工作流执行页优先使用单一主舞台，避免左右并排挤占 curl 操作空间
- 模型接口测试执行页优先展示状态总览、步骤时间线和折叠式请求步骤，避免命令行输出和请求详情同时铺满主舞台
- 工作流记录继续走统一本地资产仓储，不把数据散落到界面常量里
- 模型接口测试继续以“一个卡片下挂多条工作流记录 + 每条记录内含动态请求步骤、环境级 Base URL/APIKEY、响应变量提取和步骤级执行策略”为主数据结构

### 5.4 命令工坊

- 保持“列表态 / 对话态”两段式结构，不回到多栏并列主窗格
- 默认 Agent 必须可直接开工，前置配置应继续下沉
- 高级设置继续附着在输入区上下文中，而不是升级为独立主面板

### 5.5 能力拓展

- Skill 继续作为目录级资产维护，`~/.gord/skills` 是用户新增、GitHub 导入和外部加载 Skill 的唯一用户落点，递归发现允许在命名空间目录下组织能力包；仓库 `skills/` 只放随应用版本发布的内置 Skill
- GitHub 导入继续采用“镜像目录到本地”的方式，而不是只存一份远端引用
- Runner 与执行日志继续承担“调试 Agent / Skill / MCP”的主入口

### 5.6 文档维护

- `docs/ARCHITECTURE.md` 负责讲清项目结构和能力边界
- `docs/STYLE.md` 负责讲清界面与交互规则
- `docs/CHANGELOG.md` 只保留当前有效状态、收敛结论与下一步待办

## 6. 当前 Todo

### 高优先级

- 继续将大组件拆入对应 `features/<module>/` 页面组件；首页壳层细节、Gordon 弹窗、工作台快照运行时与根级 watcher 已从 `App.vue` 迁出，后续优先把 `MarketplaceView.vue` 内部的写作书架、书籍详情 tab、漫画项目详情继续拆成更细组件
- 为模型配置补齐连接测试或校验能力
- 为流程中心补充更多 workflow 卡片与本地维护能力
- 为 MCP Server 增加独立测试页、连接诊断与更明确的错误提示
- 为 Agent 任务账本继续补齐跨会话持久化、观察压缩质量评估、主动验证评分统计持久化、Capability Graph / embedding 召回和失败恢复策略评分，逐步从“工具调用器”演进为长期任务状态机
- 继续扩展 `Gordon Tools` 的真实多模态生成能力，下一步重点补齐 `video_gen` 的供应商调用协议，并为 `music_gen` 增加更多供应商返回结构样本的专项回归
- 为能力拓展继续补齐按 tool / capability 语义分层的恢复策略

### 中优先级

- 继续拆分 `apps/desktop/src/renderer/src/features/marketplace/MarketplaceView.vue`：优先把 `墨笔生花` 书架、书籍详情 tab、章节编辑面板和 `丹青溢彩` 项目详情拆成更细 feature 组件，降低单组件 template 复杂度
- 为模型配置补齐更明确的敏感信息处理策略
- 为任务笔记增加飞书文档 / 多维表格双向同步能力
- 为任务笔记补充拖拽排序、快速插入或更细粒度的结构编辑能力
- 完成 Database Center 的真实页面与交互
- 为 Agent 增加更完整的多轮执行、自动 Skill 选择与默认策略配置

### 低优先级

- 将本地 JSON 仓储升级为 SQLite 或更稳定的持久化方案
- 增加更多 Provider 元数据与模型推荐信息
- 为 CLI 增加更多工作台操作命令

## 7. 最近一次整理

- 已移除大量被后续设计覆盖的中间调整记录
- 已合并同一问题上的重复修改项，改为保留当前有效结论
- 已删除失效 Todo，例如已完成的周报模板多模板管理项
- 最近整理时间：2026-05-15 CST

---
name: writing
description: "长文本小说创作工作流 Skill，适用于小说规划、世界观、人物、剧情推进、章节生成、风格控制、连续性资料更新与一致性审核。"
---

# Writing

用于把小说创作从“直接写一段文本”收敛为可组合的长文本工作流。使用时先判断当前任务属于哪个节点，再按节点输入、输出和上下文依赖完成，不让模型自由漂移。

## 何时使用

| 场景 | 节点 |
|---|---|
| 从题材、主题、风格生成整本书方向 | `story_planner` |
| 需要补强时代、地图、制度、规则、势力 | `world_builder` |
| 需要设计主角、配角、对手、关系与成长线 | `character_designer` |
| 需要判断下一章或下一阶段发生什么 | `plot_engine` |
| 需要先拆本章问题、限制、信息差和代价 | `chapter_planner` |
| 需要把章节简介写成正文 | `chapter_writer` |
| 需要抽取新增事实、伏笔、时间线和规则 | `story_memory`（连续性资料更新） |
| 需要匹配番茄、晋江、轻小说、武侠等风格 | `style_controller` |
| 需要对白、高潮、战斗、反转或爽点强化 | `scene_specialist` |
| 需要按黄金一章/三章检查开篇追读力 | `opening_auditor` |
| 需要检查设定、人名、战力、时间线和伏笔 | `continuity_auditor` |

## 工作流

```text
story_planner
  -> world_builder
  -> character_designer
  -> plot_engine
  -> chapter_planner
  -> chapter_writer
  -> style_controller
  -> story_memory
  -> opening_auditor
  -> continuity_auditor
```

## 参考资料加载

本 Skill 保持一个复合写作能力，细分节点不再拆成嵌套 Skill。遇到下列任务时按需读取 `references/`：

| 任务 | 参考 |
|---|---|
| 风格匹配、文风诊断、类型读感统一 | `references/style-controller.md` |
| 设定、人名、战力、时间线、伏笔一致性检查 | `references/continuity-auditor.md` |
| 对白、战斗、高潮、反转、打脸等高张力场景设计 | `references/scene-specialist.md` |

## 节点约定

### story_planner

输入：`genre`、`theme`、`style`、`length`、作者额外要求。

输出必须结构化：

```json
{
  "premise": "",
  "main_plot": "",
  "core_conflict": "",
  "emotional_promise": "",
  "ending_direction": "",
  "chapter_strategy": ""
}
```

### world_builder

输出世界规则、资源、禁忌、阶层、势力、代价和冲突源。世界观必须能驱动剧情，不能只列名词。

推荐输出：

```json
{
  "worldview": [],
  "rules": [],
  "factions": [],
  "power_system": [],
  "taboos": [],
  "conflict_sources": []
}
```

### character_designer

输出角色目标、欲望、恐惧、秘密、债务、关系变化和成长弧。角色必须能产生选择成本。

推荐输出：

```json
{
  "characters": [
    {
      "name": "",
      "role": "",
      "goal": "",
      "fear": "",
      "secret": "",
      "relationships": [],
      "growth_arc": ""
    }
  ]
}
```

### plot_engine

只负责决定下一阶段怎么推进，不直接写正文。

推荐输出：

```json
{
  "next_conflict": "",
  "twist": "",
  "emotion_goal": "",
  "chapter_target": "",
  "character_shift": "",
  "foreshadow_action": ""
}
```

### chapter_planner

只负责把当前章节目录和上下文拆成可执行计划，不直接写正文。必须明确本章核心问题、场景顺序、主角目标、阻碍、规则/资源/时间限制、信息差、对手反制、证据载体、代价、人物变化、伏笔/回收和结尾钩子。

推荐输出：

```json
{
  "chapter_problem": "",
  "scene_order": [],
  "constraints": [],
  "information_gap": "",
  "opponent_countermove": "",
  "evidence_carrier": "",
  "cost": "",
  "ending_hook": ""
}
```

### chapter_writer

只把确定的章节目标写成正文。必须遵守当前章节职责、人物状态、世界规则和风格约束。正文按“问题 -> 规则/资源限制 -> 信息博弈 -> 对手反制 -> 主角选择 -> 代价/新证据 -> 余波或悬念”推进；正文开头不带章节标题。

### story_memory

章节生成或章节完成后，抽取并更新结构化连续性资料：

```json
{
  "storyAssets": {
    "worldview": [],
    "characters": [],
    "relationships": [],
    "timeline": [],
    "foreshadows": [],
    "rules": [],
    "styleProfile": {},
    "memoryNotes": []
  }
}
```

只记录后续章节必须遵守或可回收的事实，不收录一次性辞藻。`story_memory`、`memoryNotes` 和连续性资料都是内部管理概念，不应被扩写成作品主题、主角能力或世界观机制。

### style_controller

根据目标风格调整叙事密度、句式、声口、爽点、情绪距离和类型期待。风格控制不能破坏既有事实；复杂风格任务先读 `references/style-controller.md`。

### scene_specialist

用于对白、战斗、高潮、打脸、反转、追逃、告白、审判等高张力场景。场面必须有空间调度、信息差、代价和余波；复杂场面先读 `references/scene-specialist.md`。

### opening_auditor

检查第一章和前三章的商业追读力。开篇首先必须是一个顺畅、具体、能读下去的小故事，再承载世界观、主线伏笔和卖点展示。审核维度包括故事通顺度、主角聚焦度、类型/背景清晰度、卖点或金手指吸引力、追读期待、新颖差异化、信息密度和低级错误风险。必须额外检查六类雷区：开场拥挤、人物过多、群像开局、设定倾倒、环境堆砌、人物白描。输出必须给评分、证据、最小修法和可直接替换片段。

### continuity_auditor

检查人名、关系、动机、时间线、地点、能力边界、世界规则、伏笔账本和视角声口。输出问题必须带最小修复方案；长篇或多章节审核先读 `references/continuity-auditor.md`。

## 输出原则

- 能结构化就结构化，目录、章内计划、连续性资料和审核优先 JSON。
- 生成和修订分离，先完成可推进版本，再把需回头处理的内容写入设定账本。
- 生成类任务先内部自评再输出；只有体检、质检、审核类任务才显式输出评分和问题表。
- 作者约束和 AI 台账分离，作者要求优先；AI 维护的连续性资料只记录事实、信息差、证据载体、伏笔和规则边界。
- 开篇优先单主角、单事件、单视角、单冲突，首场命名人物建议小于等于 3 人；长篇可以群像长线，但不建议群像开局。
- 开篇设定必须剧情化释放，环境描写必须服务事件，人物介绍必须通过行动和选择显形。
- 长篇只看局部上下文会崩线，必须同时参考创作圣经、结构化故事资产、最近章节和后续承接。
- 关键转折必须有证据载体，避免用抽象顿悟替代剧情变化；对手或环境必须反制，避免主角一路顺畅。
- 风格可以变化，事实不能漂移。

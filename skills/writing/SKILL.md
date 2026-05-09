---
name: writing
description: "长文本小说创作工作流 Skill，适用于小说规划、世界观、人物、剧情推进、章节生成、风格控制、记忆更新与一致性审核。"
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
| 需要把章节简介写成正文 | `chapter_writer` |
| 需要抽取新增事实、伏笔、时间线和规则 | `story_memory` |
| 需要匹配番茄、晋江、轻小说、武侠等风格 | `style_controller` |
| 需要对白、高潮、战斗、反转或爽点强化 | `scene_specialist` |
| 需要检查设定、人名、战力、时间线和伏笔 | `continuity_auditor` |

## 工作流

```text
story_planner
  -> world_builder
  -> character_designer
  -> plot_engine
  -> chapter_writer
  -> style_controller
  -> story_memory
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

### chapter_writer

只把确定的章节目标写成正文。必须遵守当前章节职责、人物状态、世界规则和风格约束。正文开头不带章节标题。

### story_memory

章节生成或章节完成后，抽取并更新结构化记忆：

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

只记录后续章节必须遵守或可回收的事实，不收录一次性辞藻。

### style_controller

根据目标风格调整叙事密度、句式、声口、爽点、情绪距离和类型期待。风格控制不能破坏既有事实；复杂风格任务先读 `references/style-controller.md`。

### scene_specialist

用于对白、战斗、高潮、打脸、反转、追逃、告白、审判等高张力场景。场面必须有空间调度、信息差、代价和余波；复杂场面先读 `references/scene-specialist.md`。

### continuity_auditor

检查人名、关系、动机、时间线、地点、能力边界、世界规则、伏笔账本和视角声口。输出问题必须带最小修复方案；长篇或多章节审核先读 `references/continuity-auditor.md`。

## 输出原则

- 能结构化就结构化，目录、记忆和审核优先 JSON。
- 生成和修订分离，先完成可推进版本，再把需回头处理的内容写入记忆。
- 长篇只看局部上下文会崩线，必须同时参考创作圣经、结构化故事资产、最近章节和后续承接。
- 风格可以变化，事实不能漂移。

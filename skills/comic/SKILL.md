---
name: comic
description: "漫画创作工作流 Skill，适用于丹青溢彩漫画项目企划、素材库设计、章节分镜、镜头连续性、漫画页/连续图出图提示词、成图验收、章节写回和连载状态维护。"
---

# Comic

用于把漫画创作从“生成一张图”收敛为可持续推进的项目工作流。使用时先判断任务所属节点，再读取丹青溢彩项目上下文和 Application Tools 里的漫画资产，必要时调用 `image_gen`，最后把可保存结果写回项目字段、章节、分镜轨道、素材库或分镜图片区。

## 何时使用

| 场景 | 节点 |
|---|---|
| 从线上小说、上传文本或已有书稿导入漫画项目 | `source_importer` |
| 从题材、角色和视觉目标生成漫画项目方向 | `project_planner` |
| 设计角色、物品、场景素材并保持出图一致性 | `asset_director` |
| 规划章节目录、单章目标和连载节奏 | `chapter_planner` |
| 把一章拆成多条可编辑分镜，覆盖对话、过渡、场景和打斗 | `storyboard_director` |
| 生成漫画图、漫画页、封面海报或连续图组提示词 | `image_prompt_director` |
| 调用图像工具后整理图片产物并写回当前分镜图片区 | `image_producer` |
| 审核成图的角色一致性、镜头可读性和项目连续性 | `visual_continuity_auditor` |
| 更新章节备注、状态、素材引用和后续待办 | `project_memory` |

## 工作流

```text
source_importer（有小说/正文来源时）
  -> project_planner
  -> asset_director
  -> chapter_planner
  -> storyboard_director
  -> image_prompt_director
  -> image_producer（需要实际出图时）
  -> visual_continuity_auditor
  -> project_memory
```

## Application Tools 优先级

丹青溢彩相关任务优先使用 Application Tools 的漫画工具：

- `comic_list_projects`：定位项目。
- `comic_create_project`：新建漫画项目，适合把线上小说、上传文本或漫画企划转入丹青溢彩。
- `comic_read_project`：读取项目、章节、素材和图片。
- `comic_import_chapters`：批量导入或更新章节正文、章节简介和来源引用，适合中篇/长篇小说分批转漫画。
- `comic_update_project_fields`：写回项目级字段。
- `comic_create_chapter`：新增或补全单个实际章节实体。
- `comic_update_chapter`：写回章节标题、章节内容简介、章节正文/故事内容、章节级提示、`storyboards` 分镜轨道、状态和引用素材。
- `comic_update_chapter_images`：写回章节图片产物，可通过 `storyboardId` 或 `storyboardIndex` 挂到当前分镜。
- `comic_update_assets`：写回角色、物品、场景素材库。

默认只在用户明确要求保存、写回、替换、追加、生成并放进项目时设置 `dryRun=false`。如果只是讨论、评审、构思或生成草案，保持 `dryRun=true` 或只输出可用结果。

## 工具协作原则

- `Application Tools` 负责项目资产读写；`Gordon Tools / image_gen` 负责实际图片生成。
- 先读项目再写回。写回时尽量带 `expectedProjectUpdatedAt`，避免覆盖用户刚改的内容。
- 出图前必须提炼稳定视觉约束：角色身份、年龄感、服饰、发型、关键道具、场景、色彩、画幅和构图。
- 有素材库视图图时优先作为参考图使用；没有参考图时必须用文字约束保持一致性，不声称已参考图片。
- 章节文本只是分镜依据，最终漫画创作主体是 `chapter.storyboards[]` 与每条分镜下的图片。
- 小说转漫画时，命令工坊应先完成来源发现、目录/章节正文提取、项目创建和批量章节导入；丹青溢彩主要负责视觉圣经、素材图、分镜图和成图连续性。
- 遇到 Cloudflare、登录、版权或来源不可读时，不要假装已提取章节；应写入 `source.extractionStatus=blocked/partial` 或在回复里说明可恢复路径：换来源、浏览器读取、上传文本、粘贴目录/正文。
- 生成多条分镜时，每条必须推进一个明确故事节点，不要只给章节修改说明或抽象美术词。
- 生成多张连续图时，每张图必须推进一个明确动作节点，不要只换姿势或重复同一画面。
- 写入分镜图片区时，每张图片必须带 `alt / src / prompt / size / quality / storyboardId`，并保留用于复现的生图提示词。

## References

按任务需要读取：

- `references/project-workflow.md`：漫画项目、章节、素材库和用户交互模型。
- `references/storyboard-system.md`：章节分镜、多格漫画页、连续图组和镜头节奏。
- `references/visual-continuity.md`：角色/场景/道具一致性、参考图使用和成图审核。
- `references/image-prompting.md`：漫画图、漫画页、封面海报、连续图组的提示词结构。

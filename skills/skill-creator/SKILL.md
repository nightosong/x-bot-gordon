---
name: skill-creator
description: "创建、更新和校验 Gordon 本地 Skill 资产，适用于把稳定工作流、脚本工具或领域经验沉淀到 skills/ 目录。"
---

# Skill Creator

用于把可复用能力沉淀为 Gordon 的目录级 Skill。Skill 必须放在仓库根目录 `skills/<skill-name>/`，并至少包含 `SKILL.md`。

## 何时使用

| 场景 | 动作 |
|---|---|
| 用户要求创建新 Skill | 新建 `skills/<skill-name>/SKILL.md` |
| 现有流程反复出现 | 抽取稳定步骤、模板或脚本入口 |
| Skill 需要确定性执行 | 优先放入 `scripts/`，在 `SKILL.md` 写清调用方式 |
| Skill 需要大段背景资料 | 放入 `references/`，只在 `SKILL.md` 写导航 |
| Skill 需要输出模板或素材 | 放入 `assets/`，避免塞进正文 |

## 目录规范

```text
skills/<skill-name>/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

除 `SKILL.md` 外，其它目录按需创建。不要为 Skill 额外创建 `README.md`、安装说明、变更日志等冗余文件。

## SKILL.md 要求

`SKILL.md` 必须包含 YAML frontmatter：

```markdown
---
name: skill-name
description: "一句话说明触发场景和能力边界。"
---
```

正文保持短而可执行：

- 先写“何时使用”
- 再写“工作步骤”
- 如有脚本，写清脚本路径、参数和失败处理
- 如有 references，写清什么情况下读取哪一份
- 如有 assets，写清如何复用

## 创建流程

1. 先确认目标能力是否已经存在于 `skills/` 或内置工具中。
2. 选择小写短横线命名，例如 `api-debugger`。
3. 创建 `skills/<skill-name>/SKILL.md`。
4. 如果需要确定性能力，补充 `scripts/`，并让脚本参数清晰、失败信息可读。
5. 如果要成为 Gordon 默认可用能力，需要在 `packages/workbench/src/default-assets.ts` 和 `packages/workbench/src/prompt-assets.ts` 注册。
6. 更新 `docs/ARCHITECTURE.md` 与 `docs/CHANGELOG.md` 中的能力边界和清单。
7. 运行类型检查或对应验证命令。

## 输出偏好

完成后按“结果 / 文件 / 验证 / 风险”汇报。若只创建了 Skill 文件，说明尚未注册为内置能力；若已注册，则说明默认 Agent 可选择该 Skill。

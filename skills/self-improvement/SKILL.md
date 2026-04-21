---
name: self-improvement
description: "沉淀纠错、失败与高价值经验。适用于命令异常、用户纠正、能力缺口、知识过期、重复踩坑和可抽取为新 skill 的稳定模式。"
---

# Self-Improvement Skill

把一次性的出错、纠正和发现，整理成未来还能复用的经验，而不是只在当前会话里临时修过去。

这个 skill 只保留通用工作流，不依赖任何特定平台。平台专属 hook、事件和注入机制不属于本 skill 的核心能力，已刻意移除。

## 何时使用

| 场景 | 动作 |
|---|---|
| 命令、脚本、接口调用出现非预期失败 | 记录到 `.learnings/ERRORS.md` |
| 用户明确纠正了判断、方案或事实 | 记录到 `.learnings/LEARNINGS.md` |
| 发现知识过期、项目约定没吸收、工具用法记错 | 记录到 `.learnings/LEARNINGS.md` |
| 用户提出当前系统没有的新能力 | 记录到 `.learnings/FEATURE_REQUESTS.md` |
| 找到更稳定、更通用的做法 | 记录到 `.learnings/LEARNINGS.md` |
| 同类问题反复出现，已经形成稳定模式 | 评估是否抽取成独立 skill |

## 初始化

第一次使用前，先确保项目或工作区根目录存在 `.learnings/`：

```bash
mkdir -p .learnings
cp -n skills/self-improvement/assets/LEARNINGS.md .learnings/LEARNINGS.md
cp -n skills/self-improvement/assets/ERRORS.md .learnings/ERRORS.md
cp -n skills/self-improvement/assets/FEATURE_REQUESTS.md .learnings/FEATURE_REQUESTS.md
```

如果不方便复制，也可以直接手动创建同名文件。不要覆盖已有内容。

## 工作原则

1. 只沉淀可复用信息
如果只是一次性偶发问题、没有通用价值，可以不记，或者只做简短备注。

2. 不记录敏感信息
不要把 token、密钥、环境变量、整段私有配置或完整原始日志直接写进去。优先写摘要、结论和必要的脱敏片段。

3. 区分“事实”与“建议”
日志里既要说明发生了什么，也要说明以后如何避免，但不要把猜测写成事实。

4. 先短后全
优先记录一条可复用结论，再补上下文；不要把整段会话或整屏终端输出直接贴进去。

5. 真的落盘才说已沉淀
除非你已经写入 `.learnings/`、`AGENTS.md`、项目文档或 skill 文件，否则不要说“已经记住”。

## 建议流程

### 1. 判断是否值得记录

优先记录这些内容：

- 未来大概率还会遇到
- 影响判断、效率或正确性
- 已经有明确根因或明确改进动作
- 对项目约定、工具用法、架构边界有帮助

### 2. 选择正确的落点

- `LEARNINGS.md`
适合纠错、知识缺口、最佳实践、项目约定。

- `ERRORS.md`
适合命令失败、接口异常、工具报错、环境问题。

- `FEATURE_REQUESTS.md`
适合用户提出但当前系统还不支持的能力。

### 3. 评估是否需要“提升”

如果内容已经不只是当前会话可用，可以继续提升到：

- `AGENTS.md`
适合稳定的工作流、协作约定、验证顺序、操作禁忌。

- `docs/ARCHITECTURE.md`
适合长期有效的模块边界、目录职责、系统行为。

- `docs/CHANGELOG.md`
适合已经完成的能力变化、结构调整和后续待办。

- `prompts/`
适合反复出现、应进入系统提示词的行为约束或生成规则。

### 4. 判断是否要抽成新 skill

当一个 learning 已经满足下面条件时，可以考虑抽取为新 skill：

- 不依赖某一次具体任务
- 已经形成稳定步骤、模板或脚本
- 未来多个任务都可能复用
- 单独放成一个 skill 比塞进 `AGENTS.md` 更清晰

可以使用：

```bash
./skills/self-improvement/scripts/extract-skill.sh <skill-name> --dry-run
```

正式生成后，再补充对应内容。

## 输出偏好

当你以这个 skill 的思路工作时，优先给出：

1. 观察：发生了什么，真正的问题是什么
2. 结论：以后要记住什么
3. 落点：应该写到哪里
4. 动作：下一步补什么

如果不值得沉淀，也应明确说“不建议沉淀”，并说明原因。

## 参考资源

- 具体条目示例：`references/examples.md`
- 学习日志模板：`assets/LEARNINGS.md`
- 错误日志模板：`assets/ERRORS.md`
- 需求记录模板：`assets/FEATURE_REQUESTS.md`
- skill 抽取模板：`assets/SKILL-TEMPLATE.md`

## 边界说明

- 本 skill 不自带平台专属 hook、生命周期事件或运行时 glue code。
- 如果某个 agent 或平台支持自动提醒，可以用该平台自己的机制额外接入，但不属于本 skill 的核心内容。
- 平台适配应放在各自平台配置中，不应继续塞回这个通用 skill 目录。

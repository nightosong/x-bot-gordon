import type { ProductBlueprint } from "../../shared/src/index.js";

export function createGordonBlueprint(): ProductBlueprint {
  return {
    identity: {
      primaryName: "Gordon",
      nicknames: ["Gord", "gord"],
      mission: "辅助处理工作中的大小事宜，并把有价值的输入和经验沉淀成可复用资产。",
      role: "桌面端 + CLI 双端工作的 harness agent"
    },
    runtimeSurfaces: ["desktop", "cli"],
    positioning: "一个面向持续演进的工作助手，不预设功能上限。",
    modalityTargets: ["text", "vision", "audio", "tts", "embedding", "image", "video", "music"],
    memoryStrategy: {
      references: "保存 Gordon 获取到的参考资料、文档、规则和上下文。",
      experience: "保存 Gordon 在工作中总结出的经验、套路、规范和可复用策略。"
    },
    growthLoop: [
      {
        id: "collect",
        label: "采集",
        description: "把用户需求、文档、连接器说明和业务资料纳入参考资料库。"
      },
      {
        id: "reflect",
        label: "反思",
        description: "从任务执行中提炼出稳定经验，避免重复踩坑。"
      },
      {
        id: "consolidate",
        label: "固化",
        description: "把成熟经验沉淀为模板、规则、工作流或模块能力。"
      },
      {
        id: "apply",
        label: "应用",
        description: "在桌面端、CLI 和后续自动化场景中复用沉淀成果。"
      }
    ],
    designPrinciples: [
      "共享领域模型优先于页面拼装",
      "记忆库与业务模块解耦",
      "Provider 和工作模块都通过注册表扩展",
      "本地优先，后续再替换成更强存储",
      "允许未来无限延展，而不是为当前需求写死结构"
    ],
    futureDirections: [
      "引入数据库权限和审计机制",
      "引入 Feishu 连接器和同步策略",
      "引入多模态任务编排",
      "引入长期经验评估与自动整理"
    ]
  };
}

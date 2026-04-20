import type { WorkModule } from "../../shared/src/index.js";

export const workModules: WorkModule[] = [
  {
    id: "database-center",
    label: "Database Center",
    value: "数据库配置管理、连接审查、SQL 任务承接的统一入口。",
    status: "seeded",
    surfaces: ["desktop", "cli"],
    extensionPoints: ["connection-form", "credential-store", "sql-runner", "audit-log"]
  },
  {
    id: "task-board",
    label: "Task Board",
    value: "面向周报 / 日报的项目树编辑、任务状态维护与汇报生成工作台。",
    status: "seeded",
    surfaces: ["desktop", "cli"],
    extensionPoints: ["project-task-tree", "rewrite-assistant", "weekly-report-template", "feishu-sync"]
  },
  {
    id: "feishu-hub",
    label: "Feishu Hub",
    value: "飞书文档和表格的读取、编辑与同步入口。",
    status: "seeded",
    surfaces: ["desktop", "cli"],
    extensionPoints: ["doc-reader", "sheet-reader", "doc-writer", "permission-mapping"]
  }
];

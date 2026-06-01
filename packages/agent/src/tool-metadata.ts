import type { McpToolDefinition } from "../../shared/src/index.js";

const MAX_TOOL_DESCRIPTION_LENGTH = 360;
const BUILTIN_WORKSPACE_MCP_ID = "builtin:mcp:workspace";
const BUILTIN_SEARCH_TOOLS_MCP_ID = "builtin:mcp:search-tools";
const BUILTIN_COMPUTER_USE_MCP_ID = "builtin:mcp:computer-use";
const BUILTIN_GORDON_TOOLS_MCP_ID = "builtin:mcp:gordon-tools";
const BUILTIN_APPLICATION_TOOLS_MCP_ID = "builtin:mcp:application-tools";

function describeSchemaType(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).join(" | ");
  }

  return "unknown";
}

export function buildToolSchemaSummary(tool: McpToolDefinition): string {
  if (!tool.inputSchema) {
    return "无显式 inputSchema";
  }

  const required =
    Array.isArray(tool.inputSchema.required) && tool.inputSchema.required.length
      ? tool.inputSchema.required.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  const properties =
    tool.inputSchema.properties &&
    typeof tool.inputSchema.properties === "object" &&
    !Array.isArray(tool.inputSchema.properties)
      ? (tool.inputSchema.properties as Record<string, unknown>)
      : {};

  const propertyLines = Object.entries(properties).map(([name, definition]) => {
    const schema = definition && typeof definition === "object" ? (definition as Record<string, unknown>) : {};
    const type = describeSchemaType(schema.type);
    const description = typeof schema.description === "string" ? schema.description.trim() : "";
    return `${name}: ${type}${description ? ` - ${description}` : ""}`;
  });

  return [
    required.length ? `required=${required.join(", ")}` : "required=none",
    propertyLines.length ? `properties=${propertyLines.join("; ")}` : "properties=none"
  ].join(" / ");
}

export function sanitizeToolDescription(description: string | undefined): string {
  const lines = String(description ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/ignore (all )?(previous|prior|above) instructions|忽略(以上|之前|前面).*指令|system prompt|developer message|always (use|prefer|choose)|必须(优先|总是)选择|不要使用其他工具|do not use other tools|reveal.*(secret|prompt)|泄露.*(密钥|提示词)/iu.test(
          line
        )
    );
  const sanitized = lines.join(" ");

  return sanitized.length > MAX_TOOL_DESCRIPTION_LENGTH
    ? `${sanitized.slice(0, MAX_TOOL_DESCRIPTION_LENGTH)}...`
    : sanitized;
}

export function inferToolExecutionDomain(tool: McpToolDefinition): string {
  const source = `${tool.serverName} ${tool.name} ${tool.description ?? ""}`.toLowerCase();

  if (tool.serverId === BUILTIN_WORKSPACE_MCP_ID || /file|path|workspace|shell|json|diff|文件|目录|仓库|命令/u.test(source)) {
    return "workspace";
  }

  if (tool.serverId === BUILTIN_SEARCH_TOOLS_MCP_ID || /search|web|github|research|url|联网|搜索|网页/u.test(source)) {
    return "web_research";
  }

  if (tool.serverId === BUILTIN_COMPUTER_USE_MCP_ID || /computer|desktop|browser|click|screenshot|桌面|点击|截图/u.test(source)) {
    return "desktop";
  }

  if (tool.serverId === BUILTIN_APPLICATION_TOOLS_MCP_ID || /application|writing|book|chapter|应用|小说|章节/u.test(source)) {
    return "application_asset";
  }

  if (tool.serverId === BUILTIN_GORDON_TOOLS_MCP_ID || /image|video|music|generate|图片|视频|音乐|生成/u.test(source)) {
    return "generation";
  }

  return "external_mcp";
}

export function inferToolRiskLevel(tool: McpToolDefinition): "low" | "medium" | "high" {
  const source = `${tool.name} ${tool.description ?? ""}`.toLowerCase();

  if (/delete|remove|write|update|replace|move|rename|run_shell|execute|click|type|press|drag|生成|写入|修改|删除|移动|重命名|点击|输入/u.test(source)) {
    return "high";
  }

  if (/read|inspect|search|list|query|screenshot|open|读取|检查|搜索|查询|截图|打开/u.test(source)) {
    return "medium";
  }

  return "low";
}

export function inferToolCapabilities(tool: McpToolDefinition): string[] {
  const source = `${tool.serverName} ${tool.name} ${tool.description ?? ""}`.toLowerCase();
  const capabilities: string[] = [];
  const addCapability = (capability: string, patterns: RegExp[]): void => {
    if (patterns.some((pattern) => pattern.test(source))) {
      capabilities.push(capability);
    }
  };

  addCapability("read", [/read|list|inspect|query|screenshot|读取|查看|列出|查询|截图/u]);
  addCapability("write", [/write|update|replace|create|delete|move|rename|写入|更新|创建|删除|移动|重命名/u]);
  addCapability("search", [/search|research|github|web|搜索|调研|联网/u]);
  addCapability("execute", [/run|execute|shell|click|type|press|drag|运行|执行|点击|输入|按键|拖拽/u]);
  addCapability("generate", [/generate|image|video|music|生成|图片|视频|音乐/u]);
  addCapability("verify", [/validate|diff|status|inspect|验证|校验|对比|状态/u]);

  return capabilities.length ? Array.from(new Set(capabilities)) : ["unknown"];
}

export function inferToolVerbs(tool: McpToolDefinition): string[] {
  const source = `${tool.serverName} ${tool.name} ${tool.description ?? ""}`.toLowerCase();
  const verbs: string[] = [];
  const addVerb = (verb: string, patterns: RegExp[]): void => {
    if (patterns.some((pattern) => pattern.test(source))) {
      verbs.push(verb);
    }
  };

  addVerb("read", [/read|list|inspect|query|screenshot|status|读取|查看|列出|查询|截图|状态/u]);
  addVerb("search", [/search|research|github|web|搜索|调研|联网/u]);
  addVerb("open", [/open|navigate|browser|url|打开|访问|浏览器/u]);
  addVerb("write", [/write|update|replace|create|save|写入|更新|创建|保存/u]);
  addVerb("delete", [/delete|remove|删除|移除/u]);
  addVerb("execute", [/run|execute|shell|command|运行|执行|命令/u]);
  addVerb("operate", [/click|type|press|drag|点击|输入|按键|拖拽/u]);
  addVerb("generate", [/generate|image|video|music|生成|图片|视频|音乐/u]);
  addVerb("verify", [/validate|diff|status|inspect|验证|校验|对比|状态/u]);

  return verbs.length ? Array.from(new Set(verbs)) : ["unknown"];
}

export function inferToolCost(tool: McpToolDefinition): "low" | "medium" | "high" {
  const domain = inferToolExecutionDomain(tool);
  const capabilities = inferToolCapabilities(tool);
  const source = `${tool.serverName} ${tool.name} ${tool.description ?? ""}`.toLowerCase();

  if (domain === "generation" || capabilities.includes("generate") || /deep|research|video|music|image|生成|视频|音乐|图片/u.test(source)) {
    return "high";
  }

  if (domain === "desktop" || capabilities.includes("execute") || capabilities.includes("write")) {
    return "medium";
  }

  return "low";
}

export function inferToolSideEffects(tool: McpToolDefinition): "none" | "read_only" | "stateful" | "destructive" {
  const source = `${tool.name} ${tool.description ?? ""}`.toLowerCase();

  if (/delete|remove|move|rename|删除|移除|移动|重命名/u.test(source)) {
    return "destructive";
  }

  if (/write|update|replace|create|save|run_shell|execute|click|type|press|drag|generate|写入|更新|修改|创建|保存|执行|点击|输入|生成/u.test(source)) {
    return "stateful";
  }

  if (/read|list|inspect|query|search|screenshot|status|读取|查看|列出|查询|搜索|截图|状态/u.test(source)) {
    return "read_only";
  }

  return "none";
}

export function inferToolReversibility(tool: McpToolDefinition): "reversible" | "partially_reversible" | "irreversible" | "unknown" {
  const sideEffects = inferToolSideEffects(tool);

  if (sideEffects === "destructive") {
    return "irreversible";
  }

  if (sideEffects === "stateful") {
    return "partially_reversible";
  }

  if (sideEffects === "read_only" || sideEffects === "none") {
    return "reversible";
  }

  return "unknown";
}

export function buildPlannerToolPayload(candidateTools: McpToolDefinition[]): Array<Record<string, unknown>> {
  return candidateTools.map((tool) => ({
    serverId: tool.serverId,
    serverName: tool.serverName,
    name: tool.name,
    capability: inferToolCapabilities(tool),
    verbs: inferToolVerbs(tool),
    executionDomain: inferToolExecutionDomain(tool),
    riskLevel: inferToolRiskLevel(tool),
    cost: inferToolCost(tool),
    sideEffects: inferToolSideEffects(tool),
    reversibility: inferToolReversibility(tool),
    descriptionSummary: sanitizeToolDescription(tool.description),
    schemaSummary: buildToolSchemaSummary(tool),
    inputSchema: tool.inputSchema ?? {}
  }));
}

import { spawn } from "node:child_process";

import { listMcpServers } from "../../workbench/src/index.js";
import type {
  McpServerConfig,
  McpToolCallRequest,
  McpToolCallResult,
  McpToolDefinition
} from "../../shared/src/index.js";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_CLIENT_NAME = "Gordon";
const MCP_CLIENT_VERSION = "0.1.0";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

interface McpTransportClient {
  initialize(): Promise<void>;
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
  notify(method: string, params?: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
}

function buildInitializeParams(): Record<string, unknown> {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: {
      name: MCP_CLIENT_NAME,
      version: MCP_CLIENT_VERSION
    }
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function assertEnabledServer(server: McpServerConfig | undefined): McpServerConfig {
  if (!server) {
    throw new Error("指定的 MCP Server 不存在");
  }

  if (!server.enabled) {
    throw new Error("指定的 MCP Server 当前未启用");
  }

  return server;
}

function normalizeToolDescription(tool: unknown): string {
  if (tool && typeof tool === "object" && "description" in tool && typeof tool.description === "string") {
    return tool.description;
  }

  return "";
}

function normalizeToolInputSchema(tool: unknown): Record<string, unknown> | undefined {
  if (tool && typeof tool === "object" && "inputSchema" in tool && tool.inputSchema && typeof tool.inputSchema === "object") {
    return tool.inputSchema as Record<string, unknown>;
  }

  return undefined;
}

function parseJsonRpcError(response: JsonRpcResponse): string | null {
  return response.error?.message?.trim() || null;
}

function parseToolContentText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      if ("text" in item && typeof item.text === "string") {
        return item.text;
      }

      if ("type" in item && item.type === "resource" && "resource" in item) {
        return JSON.stringify(item.resource, null, 2);
      }

      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function splitCommand(command: string): { executable: string; args: string[] } {
  const trimmed = command.trim();

  if (!trimmed) {
    throw new Error("stdio 类型的 MCP Server 缺少启动命令");
  }

  if (process.platform === "win32") {
    return {
      executable: "cmd.exe",
      args: ["/d", "/s", "/c", trimmed]
    };
  }

  return {
    executable: "/bin/sh",
    args: ["-lc", trimmed]
  };
}

function parseSsePayload(text: string, id: number): JsonRpcResponse | null {
  const events = text.split(/\n\n+/);

  for (const eventBlock of events) {
    const dataLines = eventBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (const data of dataLines) {
      try {
        const payload = JSON.parse(data) as JsonRpcResponse;

        if (payload.id === id || (payload.id === undefined && payload.result)) {
          return payload;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

class HttpMcpClient implements McpTransportClient {
  private readonly endpoint: string;
  private readonly server: McpServerConfig;
  private nextId = 1;
  private sessionId: string | null = null;
  private negotiatedProtocolVersion = MCP_PROTOCOL_VERSION;

  constructor(server: McpServerConfig) {
    if (!server.url?.trim()) {
      throw new Error("http 类型的 MCP Server 缺少服务地址");
    }

    this.server = server;
    this.endpoint = server.url.trim();
  }

  async initialize(): Promise<void> {
    const response = await this.request("initialize", buildInitializeParams());
    const protocolVersion =
      response && typeof response === "object" && "protocolVersion" in response && typeof response.protocolVersion === "string"
        ? response.protocolVersion
        : MCP_PROTOCOL_VERSION;

    this.negotiatedProtocolVersion = protocolVersion;
    await this.notify("notifications/initialized");
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {})
    };

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": this.negotiatedProtocolVersion,
        ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`MCP HTTP 请求失败：HTTP ${response.status}`);
    }

    const sessionId = response.headers.get("mcp-session-id");

    if (sessionId) {
      this.sessionId = sessionId;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (response.status === 202) {
      return null;
    }

    let resultPayload: JsonRpcResponse | null = null;

    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      resultPayload = parseSsePayload(text, id);
    } else {
      resultPayload = (await response.json()) as JsonRpcResponse;
    }

    if (!resultPayload) {
      throw new Error("MCP HTTP 响应为空或无法解析");
    }

    const errorMessage = parseJsonRpcError(resultPayload);

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    return resultPayload.result;
  }

  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const payload = {
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {})
    };

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": this.negotiatedProtocolVersion,
        ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok && response.status !== 202) {
      throw new Error(`MCP 通知发送失败：HTTP ${response.status}`);
    }
  }

  async close(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    try {
      await fetch(this.endpoint, {
        method: "DELETE",
        headers: {
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": this.negotiatedProtocolVersion,
          "Mcp-Session-Id": this.sessionId
        }
      });
    } catch {
      return;
    }
  }
}

class StdioMcpClient implements McpTransportClient {
  private readonly server: McpServerConfig;
  private readonly executable: string;
  private readonly args: string[];
  private readonly child: ReturnType<typeof spawn>;
  private readonly pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
    }
  >();
  private nextId = 1;
  private buffer = "";

  constructor(server: McpServerConfig) {
    if (!server.command?.trim()) {
      throw new Error("stdio 类型的 MCP Server 缺少启动命令");
    }

    this.server = server;
    const resolved = splitCommand(server.command);
    this.executable = resolved.executable;
    this.args = resolved.args;
    this.child = spawn(this.executable, this.args, {
      env: {
        ...process.env,
        ...server.env
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    const stdout = this.child.stdout;
    const stderr = this.child.stderr;

    if (!stdout || !stderr || !this.child.stdin) {
      throw new Error("MCP stdio 进程未正确创建标准输入输出");
    }

    stdout.setEncoding("utf8");
    stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.flushBuffer();
    });
    stderr.setEncoding("utf8");
    stderr.on("data", () => {
      return;
    });
    this.child.on("exit", (code) => {
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error(`MCP stdio 进程已退出，退出码：${code ?? "unknown"}`));
      }

      this.pendingRequests.clear();
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", buildInitializeParams());
    await this.notify("notifications/initialized");
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {})
    };

    const stdin = this.child.stdin;

    if (!stdin) {
      throw new Error("MCP stdio 输入流不可用");
    }

    const response = await new Promise<unknown>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      stdin.write(`${JSON.stringify(payload)}\n`, "utf8", (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });
    });

    return response;
  }

  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const payload = {
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {})
    };

    const stdin = this.child.stdin;

    if (!stdin) {
      throw new Error("MCP stdio 输入流不可用");
    }

    await new Promise<void>((resolve, reject) => {
      stdin.write(`${JSON.stringify(payload)}\n`, "utf8", (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.child.killed) {
      this.child.kill();
    }
  }

  private flushBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      try {
        const payload = JSON.parse(trimmed) as JsonRpcResponse;

        if (typeof payload.id !== "number") {
          continue;
        }

        const pending = this.pendingRequests.get(payload.id);

        if (!pending) {
          continue;
        }

        this.pendingRequests.delete(payload.id);
        const errorMessage = parseJsonRpcError(payload);

        if (errorMessage) {
          pending.reject(new Error(errorMessage));
          continue;
        }

        pending.resolve(payload.result);
      } catch {
        continue;
      }
    }
  }
}

async function createMcpClient(server: McpServerConfig): Promise<McpTransportClient> {
  const client = server.transport === "http" ? new HttpMcpClient(server) : new StdioMcpClient(server);
  await client.initialize();
  return client;
}

function normalizeToolDefinitions(server: McpServerConfig, toolsPayload: unknown): McpToolDefinition[] {
  const tools =
    toolsPayload && typeof toolsPayload === "object" && "tools" in toolsPayload && Array.isArray(toolsPayload.tools)
      ? toolsPayload.tools
      : [];

  const allowlist = new Set(server.toolAllowlist);

  const definitions: McpToolDefinition[] = [];

  for (const tool of tools) {
    if (!tool || typeof tool !== "object" || !("name" in tool) || typeof tool.name !== "string") {
      continue;
    }

    if (allowlist.size && !allowlist.has(tool.name)) {
      continue;
    }

    definitions.push({
      serverId: server.id,
      serverName: server.name,
      name: tool.name,
      description: normalizeToolDescription(tool),
      ...(normalizeToolInputSchema(tool) ? { inputSchema: normalizeToolInputSchema(tool) } : {})
    });
  }

  return definitions;
}

async function withMcpClient<T>(server: McpServerConfig, callback: (client: McpTransportClient) => Promise<T>): Promise<T> {
  const client = await createMcpClient(server);

  try {
    return await callback(client);
  } finally {
    await client.close();
  }
}

export async function listToolsFromMcpServer(serverId: string): Promise<McpToolDefinition[]> {
  const servers = await listMcpServers();
  const server = assertEnabledServer(servers.find((entry) => entry.id === serverId));

  return withMcpClient(server, async (client) => {
    const result = await client.request("tools/list");
    return normalizeToolDefinitions(server, result);
  });
}

export async function callToolOnMcpServer(request: McpToolCallRequest): Promise<McpToolCallResult> {
  const servers = await listMcpServers();
  const server = assertEnabledServer(servers.find((entry) => entry.id === request.serverId));
  const allowlist = new Set(server.toolAllowlist);

  if (allowlist.size && !allowlist.has(request.toolName)) {
    throw new Error("当前工具不在 MCP Server 白名单中");
  }

  return withMcpClient(server, async (client) => {
    const result = await client.request("tools/call", {
      name: request.toolName,
      arguments: request.arguments ?? {}
    });
    const payload = result && typeof result === "object" ? result : {};
    const contentText = parseToolContentText((payload as { content?: unknown }).content);

    return {
      serverId: server.id,
      serverName: server.name,
      toolName: request.toolName,
      contentText: contentText || JSON.stringify(result, null, 2),
      isError: Boolean((payload as { isError?: boolean }).isError),
      structuredContent:
        payload &&
        typeof payload === "object" &&
        "structuredContent" in payload &&
        payload.structuredContent &&
        typeof payload.structuredContent === "object"
          ? (payload.structuredContent as Record<string, unknown>)
          : undefined
    };
  }).catch((error) => {
    throw new Error(`MCP 工具调用失败：${toErrorMessage(error)}`);
  });
}

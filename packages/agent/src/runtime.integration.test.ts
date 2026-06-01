import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { AgentProfile, McpServerConfig, ModelMessage, ModelProfile } from "../../shared/src/index.js";
import {
  saveModelSettings,
  upsertAgentProfile,
  upsertMcpServer
} from "../../workbench/src/index.js";
import { runAgent } from "./runtime.js";

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
}

function readRequestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("error", reject);
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("测试 HTTP 服务没有获得可用地址"));
        return;
      }

      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getModelMessages(body: Record<string, unknown>): ModelMessage[] {
  return Array.isArray(body.messages) ? (body.messages as ModelMessage[]) : [];
}

function getSystemMessage(body: Record<string, unknown>): string {
  return getModelMessages(body).find((message) => message.role === "system")?.content ?? "";
}

function createFakeModelServer(capturedRequests: CapturedRequest[]): Server {
  let plannerCalls = 0;

  return createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(404);
      response.end();
      return;
    }

    const body = await readRequestBody(request);
    capturedRequests.push({
      url: request.url ?? "",
      body
    });

    const systemMessage = getSystemMessage(body);
    let content = "Chrome 页面状态已通过 Computer Use 读取并验证。";

    if (systemMessage.includes("工具规划器")) {
      plannerCalls += 1;
      content =
        plannerCalls === 1
          ? JSON.stringify({
              shouldCall: true,
              serverId: "test:mcp:computer-use",
              toolName: "get_app_state",
              arguments: {
                app: "Google Chrome"
              },
              reason: "用户要求打开或检查浏览器界面，需要使用桌面状态读取工具；能力路由只是提示，完整候选仍可选。",
              expectedOutcome: "返回 Google Chrome 的当前窗口和可见 UI 文本",
              verificationMethod: "工具结果包含 Chrome Ready 或 Google Chrome",
              ledgerPatch: {
                objective: "验证 Gordon 自动工具链可以选择 Computer Use",
                taskPhase: "executing",
                pendingSubtasks: ["读取浏览器桌面状态"],
                activePlan: [
                  {
                    step: "读取 Google Chrome 桌面状态",
                    toolHint: "Computer Use / get_app_state",
                    successCriteria: "工具返回中包含 Google Chrome 或 Chrome Ready",
                    status: "in_progress"
                  }
                ],
                decisionTrace: [
                  {
                    step: "选择 Computer Use 状态读取工具",
                    intent: "验证桌面交互任务不会被能力路由裁剪掉",
                    chosenAction: "test:mcp:computer-use / get_app_state",
                    rejectedAlternatives: ["test:mcp:workspace / read_file"],
                    why: "任务目标是桌面 UI 状态，Computer Use 语义最贴近",
                    expectedOutcome: "获得 Chrome 当前窗口状态"
                  }
                ],
                successCriteria: ["Computer Use 工具结果应能证明 Chrome UI 状态可读"],
                structuredSuccessCriteria: [
                  {
                    type: "ui_contains",
                    target: "Google Chrome",
                    expected: "Chrome Ready",
                    verificationMethod: "检查工具结果中的 visibleText",
                    status: "pending"
                  }
                ],
                nextActionHint: "执行 Computer Use 状态读取"
              }
            })
          : JSON.stringify({
              shouldCall: false,
              serverId: null,
              toolName: null,
              arguments: {},
              reason: "Computer Use 已返回桌面状态，等待 verifier 更新成功条件",
              expectedOutcome: "",
              verificationMethod: "",
              ledgerPatch: {
                taskPhase: "verifying",
                nextActionHint: "根据工具结果验证 UI 文本"
              }
            });
    } else if (systemMessage.includes("任务账本维护器")) {
      content = JSON.stringify({
        objective: "验证 Gordon 自动工具链可以选择 Computer Use",
        taskPhase: "verifying",
        constraints: ["Capability Routing 只提示，不裁剪完整工具候选集"],
        completedSubtasks: ["已读取 Google Chrome 桌面状态"],
        pendingSubtasks: ["验证 UI 文本是否包含 Chrome Ready"],
        activePlan: [
          {
            step: "验证 Computer Use 结果",
            toolHint: "Verifier",
            successCriteria: "ui_contains 条件通过",
            status: "in_progress"
          }
        ],
        decisionMemory: [],
        decisionTrace: [
          {
            step: "压缩 Computer Use 观察",
            intent: "把桌面状态结果写入任务账本",
            chosenAction: "记录 Chrome UI 状态",
            rejectedAlternatives: [],
            why: "工具结果已经包含 Google Chrome 与 Chrome Ready",
            expectedOutcome: "后续 verifier 可独立验证"
          }
        ],
        observations: [
          {
            source: "Computer Use / get_app_state",
            rawRef: "mcp:1",
            summary: "Google Chrome 可见，页面文本包含 Chrome Ready",
            durableFacts: ["Computer Use 工具可以返回桌面状态"],
            ephemeralFacts: ["Google Chrome 当前可见文本包含 Chrome Ready"],
            evidenceRefs: ["mcp:1"]
          }
        ],
        discoveredFacts: ["Computer Use 返回了 Google Chrome 状态"],
        failedAttempts: [],
        environmentState: ["Google Chrome visibleText includes Chrome Ready"],
        userInterruptions: [],
        successCriteria: ["Computer Use 工具结果应能证明 Chrome UI 状态可读"],
        structuredSuccessCriteria: [
          {
            type: "ui_contains",
            target: "Google Chrome",
            expected: "Chrome Ready",
            verificationMethod: "检查工具结果中的 visibleText",
            status: "pending"
          }
        ],
        nextActionHint: "进入成功条件验证"
      });
    } else if (systemMessage.includes("主动验证规划器")) {
      content = JSON.stringify({
        shouldVerify: false,
        serverId: null,
        toolName: null,
        arguments: {},
        reason: "已有 Computer Use 工具结果足以验证 UI 文本",
        expectedOutcome: "",
        verificationMethod: ""
      });
    }

    sendJson(response, {
      choices: [
        {
          message: {
            content
          }
        }
      ]
    });
  });
}

function buildToolDefinitions(pathname: string): unknown[] {
  if (pathname.includes("computer")) {
    return [
      {
        name: "get_app_state",
        description: "Read desktop app state, accessibility tree, visible UI text and screenshot.",
        inputSchema: {
          type: "object",
          required: ["app"],
          properties: {
            app: {
              type: "string",
              description: "Target desktop application name"
            }
          }
        }
      }
    ];
  }

  return [
    {
      name: "read_file",
      description: "Read a file from the workspace.",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "Workspace file path"
          }
        }
      }
    }
  ];
}

function createFakeMcpServer(capturedRequests: CapturedRequest[]): Server {
  return createServer(async (request, response) => {
    if (request.method === "DELETE") {
      response.writeHead(202);
      response.end();
      return;
    }

    if (request.method !== "POST") {
      response.writeHead(404);
      response.end();
      return;
    }

    const body = await readRequestBody(request);
    capturedRequests.push({
      url: request.url ?? "",
      body
    });

    const method = typeof body.method === "string" ? body.method : "";
    const id = typeof body.id === "number" ? body.id : undefined;
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

    if (!id) {
      response.writeHead(202);
      response.end();
      return;
    }

    if (method === "initialize") {
      sendJson(response, {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          serverInfo: {
            name: "fake-mcp",
            version: "0.0.0"
          }
        }
      });
      return;
    }

    if (method === "tools/list") {
      sendJson(response, {
        jsonrpc: "2.0",
        id,
        result: {
          tools: buildToolDefinitions(pathname)
        }
      });
      return;
    }

    if (method === "tools/call") {
      sendJson(response, {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: pathname.includes("computer")
                ? "activeApp=Google Chrome\nvisibleText=Chrome Ready"
                : "workspace file content"
            }
          ],
          structuredContent: pathname.includes("computer")
            ? {
                activeApp: "Google Chrome",
                visibleText: ["Chrome Ready"]
              }
            : {
                content: "workspace file content"
              }
        }
      });
      return;
    }

    sendJson(response, {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Unsupported method: ${method}`
      }
    });
  });
}

test("runAgent keeps Computer Use selectable through capability routing", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createFakeModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:fake",
      provider: "openai_like",
      displayName: "Fake Planner Model",
      model: "fake-planner",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const workspaceServer: McpServerConfig = {
      id: "test:mcp:workspace",
      name: "Workspace Tools",
      description: "Read files from workspace",
      transport: "http",
      url: `${mcpBaseUrl}/workspace`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const computerUseServer: McpServerConfig = {
      id: "test:mcp:computer-use",
      name: "Computer Use",
      description: "Read and control desktop apps",
      transport: "http",
      url: `${mcpBaseUrl}/computer`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:runtime",
      name: "Runtime Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools when needed and keep model-led tool choice.",
      allowedSkillIds: [],
      allowedMcpServerIds: [workspaceServer.id, computerUseServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(workspaceServer);
    await upsertMcpServer(computerUseServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "打开 Chrome 并检查当前页面 UI 是否显示 Chrome Ready",
      autoSelectMcp: true
    });
    const firstPlannerRequest = modelRequests.find((request) => getSystemMessage(request.body).includes("工具规划器"));
    const firstPlannerUserMessage = getModelMessages(firstPlannerRequest?.body ?? {}).find((message) => message.role === "user")?.content ?? "";

    assert.ok(firstPlannerRequest);
    assert.match(firstPlannerUserMessage, /能力路由上下文/u);
    assert.match(firstPlannerUserMessage, /"allToolsAvailable": true/u);
    assert.match(firstPlannerUserMessage, /不做候选裁剪/u);
    assert.match(firstPlannerUserMessage, /test:mcp:computer-use/u);
    assert.match(firstPlannerUserMessage, /test:mcp:workspace/u);
    assert.equal(log.autoSelectedMcp, true);
    assert.equal(log.mcpCalls?.[0]?.serverId, "test:mcp:computer-use");
    assert.equal(log.mcpCalls?.[0]?.toolName, "get_app_state");
    assert.equal(log.taskLedger?.structuredSuccessCriteria[0]?.status, "passed");
    assert.match(log.text, /Computer Use/u);
    assert.ok(mcpRequests.some((request) => request.url.includes("/computer") && request.body.method === "tools/call"));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

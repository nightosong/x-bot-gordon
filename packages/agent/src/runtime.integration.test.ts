import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { AgentProfile, AgentTaskLedger, McpServerConfig, ModelMessage, ModelProfile } from "../../shared/src/index.js";
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
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

    if (systemMessage.includes("工具规划器") || systemMessage.includes("资源任务规划器")) {
      plannerCalls += 1;
      const userMessage = getModelMessages(body).find((message) => message.role === "user")?.content ?? "";

      if (userMessage.includes("test:mcp:application-tools") && userMessage.includes("comic_update_project_fields")) {
        content = JSON.stringify({
          shouldCall: true,
          serverId: "test:mcp:application-tools",
          toolName: "comic_update_project_fields",
          arguments: {
            projectIdOrTitle: "寂寞青梅",
            summary: "《寂寞青梅》讲述刀梦和小梅的江湖故事。",
            visualStyle: "古风武侠彩绘分镜",
            episodePlan: "24 页首章规划",
            dryRun: false
          },
          reason: "用户明确要求写回丹青溢彩项目 OVERVIEW，应使用应用资产写入工具并设置 dryRun=false。",
          expectedOutcome: "项目 OVERVIEW 三个字段写回成功",
          verificationMethod: "工具结果 applied=true，后续可读回项目验证字段内容",
          ledgerPatch: {
            objective: "写回丹青溢彩项目 OVERVIEW",
            taskPhase: "executing",
            pendingSubtasks: ["读回验证项目字段"],
            activePlan: [
              {
                step: "写回 OVERVIEW 三字段",
                toolHint: "Application Tools / comic_update_project_fields",
                successCriteria: "工具结果 applied=true",
                status: "in_progress"
              }
            ],
            structuredSuccessCriteria: [
              {
                type: "tool_result",
                target: "comic_update_project_fields",
                expected: "applied=true",
                verificationMethod: "检查工具 structuredContent.applied",
                status: "pending"
              }
            ],
            decisionTrace: [
              {
                step: "选择漫画项目字段写回工具",
                intent: "完成用户要求的应用资产写入",
                chosenAction: "test:mcp:application-tools / comic_update_project_fields",
                rejectedAlternatives: ["text_response"],
                why: "没有成功工具结果前不能声称写入完成",
                expectedOutcome: "项目字段写回"
              }
            ]
          }
        });
      } else {
        content =
          plannerCalls === 1
          ? JSON.stringify({
              shouldCall: true,
              serverId: "test:mcp:computer-use",
              toolName: "get_app_state",
              arguments: {
                app: "Google Chrome"
              },
              reason: "用户要求打开或检查浏览器界面，需要使用桌面状态读取工具；Planner Tool View 已保留 Computer Use 高阶工具。",
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
      }
    } else if (systemMessage.includes("任务账本维护器")) {
      const userMessage = getModelMessages(body).find((message) => message.role === "user")?.content ?? "";

      if (userMessage.includes("comic_update_project_fields")) {
        content = JSON.stringify({
          objective: "写回丹青溢彩项目 OVERVIEW",
          taskPhase: "verifying",
          constraints: [],
          completedSubtasks: ["已写回 OVERVIEW 三字段"],
          pendingSubtasks: ["读回验证字段内容"],
          activePlan: [],
          decisionMemory: [],
          decisionTrace: [],
          observations: [],
          discoveredFacts: ["comic_update_project_fields 返回 applied=true"],
          failedAttempts: [],
          environmentState: [],
          userInterruptions: [],
          successCriteria: ["项目 OVERVIEW 字段写回成功"],
          structuredSuccessCriteria: [
            {
              type: "tool_result",
              target: "comic_update_project_fields",
              expected: "applied=true",
              verificationMethod: "检查工具 structuredContent.applied",
              status: "pending"
            }
          ],
          nextActionHint: "读回项目验证"
        });
      } else {
        content = JSON.stringify({
        objective: "验证 Gordon 自动工具链可以选择 Computer Use",
        taskPhase: "verifying",
        constraints: ["Capability Routing 会收敛 Planner 可见工具，但不移除 runtime 授权边界"],
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
      }
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

function createFakeDirectGenerationModelServer(capturedRequests: CapturedRequest[]): Server {
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
    let content = "视频生成任务已提交，返回了可播放视频。";

    if (systemMessage.includes("工具规划器") || systemMessage.includes("资源任务规划器")) {
      content = JSON.stringify({
        shouldCall: false,
        serverId: null,
        toolName: null,
        arguments: {},
        reason: "direct generation test should not invoke planner"
      });
    } else if (systemMessage.includes("任务账本维护器")) {
      content = JSON.stringify({
        objective: "生成 5 秒小猫跳舞视频",
        taskPhase: "finalizing",
        constraints: [],
        completedSubtasks: ["video_gen 已返回可播放视频"],
        pendingSubtasks: [],
        activePlan: [],
        decisionMemory: [],
        decisionTrace: [],
        observations: [
          {
            source: "Gordon Tools / video_gen",
            rawRef: "mcp:1",
            summary: "视频生成工具返回了可播放 URL",
            durableFacts: ["video_gen 可用于明确视频生成请求"],
            ephemeralFacts: [],
            evidenceRefs: ["mcp:1"]
          }
        ],
        discoveredFacts: ["video_gen 返回 artifacts[0].url"],
        failedAttempts: [],
        environmentState: [],
        userInterruptions: [],
        successCriteria: ["返回可播放视频 URL"],
        structuredSuccessCriteria: [
          {
            type: "artifact_exists",
            target: "video_gen",
            expected: "返回可展示媒体 artifact、可播放 URL 或可继续查询的 taskId",
            verificationMethod: "检查 video_gen structuredContent 中的 artifacts",
            status: "pending"
          }
        ],
        nextActionHint: "整理最终回复"
      });
    } else if (systemMessage.includes("主动验证规划器")) {
      content = JSON.stringify({
        shouldVerify: false,
        serverId: null,
        toolName: null,
        arguments: {},
        reason: "已有 video_gen artifact 足以完成验证",
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

function createFakeExternalEvidenceModelServer(capturedRequests: CapturedRequest[]): Server {
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
    let content = "已基于 Search Tools 返回的官网来源整理 Claude 价格。";

    if (systemMessage.includes("资源任务规划器")) {
      plannerCalls += 1;
      content =
        plannerCalls === 1
          ? JSON.stringify({
              shouldCall: false,
              serverId: null,
              toolName: null,
              arguments: {},
              reason: "我可以基于已有知识回答 Anthropic Claude 价格。",
              expectedOutcome: "",
              verificationMethod: "",
              ledgerPatch: {
                objective: "确认 Anthropic Claude 最新官方价格",
                taskPhase: "planning",
                decisionTrace: [
                  {
                    step: "尝试直接回答价格",
                    intent: "快速响应用户价格问题",
                    chosenAction: "text_response",
                    rejectedAlternatives: ["Search Tools / web_research"],
                    why: "模型已有相关记忆",
                    expectedOutcome: "生成价格概览"
                  }
                ],
                nextActionHint: "直接整理回复"
              }
            })
          : JSON.stringify({
              shouldCall: true,
              serverId: "test:mcp:search-tools",
              toolName: "web_research",
              arguments: {
                query: "Anthropic Claude latest official API pricing",
                includeDomains: ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"],
                preferredDomains: ["anthropic.com", "docs.anthropic.com", "platform.claude.com", "support.claude.com"],
                provider: "auto",
                maxSearchResults: 10,
                maxPagesToRead: 4
              },
              reason: "用户询问最新官方价格，需要调用 Search Tools 获取官网证据。",
              expectedOutcome: "返回 Anthropic 官方价格页面或文档来源",
              verificationMethod: "检查工具结果包含 Anthropic 官方链接和 pricing 相关正文",
              ledgerPatch: {
                objective: "确认 Anthropic Claude 最新官方价格",
                taskPhase: "executing",
                pendingSubtasks: ["检索 Anthropic 官方 pricing 来源"],
                activePlan: [
                  {
                    step: "联网检索 Anthropic 官方价格",
                    toolHint: "Search Tools / web_research",
                    successCriteria: "返回官方来源证据",
                    status: "in_progress"
                  }
                ],
                structuredSuccessCriteria: [
                  {
                    type: "tool_result",
                    target: "web_research",
                    expected: "外部来源证据",
                    verificationMethod: "检查工具结果包含官方链接或正文",
                    status: "pending"
                  }
                ]
              }
            });
    }

    sendJson(response, {
      id: 1,
      object: "chat.completion",
      choices: [
        {
          message: {
            role: "assistant",
            content
          }
        }
      ],
      model: "fake-external-evidence"
    });
  });
}

function createFakeWorkspaceNoToolModelServer(capturedRequests: CapturedRequest[]): Server {
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
    let content = "已根据 Workspace Tools 返回的真实文件内容整理结果。";

    if (systemMessage.includes("资源任务规划器")) {
      content = JSON.stringify({
        shouldCall: false,
        serverId: null,
        toolName: null,
        arguments: {},
        reason: "用户可能只是想咨询 README 是否存在，可以直接解释。",
        expectedOutcome: "",
        verificationMethod: "",
        ledgerPatch: {
          objective: "检查 README 文件是否存在",
          taskPhase: "planning",
          decisionTrace: [
            {
              step: "尝试直接回答 workspace 文件状态",
              intent: "快速响应用户",
              chosenAction: "text_response",
              rejectedAlternatives: ["Workspace Tools / read_file"],
              why: "Planner 误判为咨询",
              expectedOutcome: "回复 README 状态"
            }
          ],
          nextActionHint: "直接整理回复"
        }
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

function createWorkspaceContinuationLedger(): AgentTaskLedger {
  return {
    taskPhase: "executing",
    objective: "检查 README 文件是否存在",
    constraints: [],
    completedSubtasks: ["已确认需要读取 workspace 文件"],
    pendingSubtasks: ["读取 README 文件确认状态"],
    activePlan: [
      {
        step: "读取 README 文件",
        toolHint: "Workspace Tools / read_file",
        successCriteria: "工具返回 README 内容或不存在状态",
        status: "pending"
      }
    ],
    decisionTrace: [
      {
        step: "上一轮决定读取 README",
        intent: "确认 workspace 文件状态",
        chosenAction: "Workspace Tools / read_file",
        rejectedAlternatives: ["text_response"],
        why: "文件状态必须通过工具确认",
        expectedOutcome: "README 状态"
      }
    ],
    decisionMemory: [],
    observations: [],
    evidenceGraph: [],
    discoveredFacts: [],
    failedAttempts: [],
    environmentState: [],
    userInterruptions: [],
    successCriteria: ["确认 README 状态"],
    structuredSuccessCriteria: [
      {
        type: "tool_result",
        target: "read_file",
        expected: "README 文件内容或不存在状态",
        verificationMethod: "读取 README",
        status: "pending"
      }
    ],
    nextActionHint: "读取 README 文件确认是否存在"
  };
}

function createSlowPlannerModelServer(capturedRequests: CapturedRequest[]): Server {
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

    if (systemMessage.includes("工具规划器") || systemMessage.includes("资源任务规划器")) {
      await delay(200);
      sendJson(response, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                shouldCall: false,
                serverId: null,
                toolName: null,
                arguments: {},
                reason: "slow planner response"
              })
            }
          }
        ]
      });
      return;
    }

    sendJson(response, {
      choices: [
        {
          message: {
            content: "前置工具规划超时，本轮未执行工具。"
          }
        }
      ]
    });
  });
}

function buildToolDefinitions(pathname: string): unknown[] {
  if (pathname.includes("search")) {
    return [
      {
        name: "web_research",
        description: "复合联网研究，执行搜索、读取落地页正文并返回证据包，适合最新事实、官方文档和带来源结论。",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            queries: { type: "array", items: { type: "string" } },
            provider: { type: "string" },
            maxSearchResults: { type: "integer" },
            maxPagesToRead: { type: "integer" },
            includeDomains: { type: "array", items: { type: "string" } },
            preferredDomains: { type: "array", items: { type: "string" } },
            officialUrls: { type: "array", items: { type: "string" } }
          }
        }
      },
      {
        name: "web_search_v2",
        description: "高质量联网搜索，返回去重、评分后的标题、链接、摘要和结构化来源。",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            provider: { type: "string" },
            limit: { type: "integer" },
            includeDomains: { type: "array", items: { type: "string" } },
            preferredDomains: { type: "array", items: { type: "string" } }
          }
        }
      }
    ];
  }

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

  if (pathname.includes("application")) {
    return [
      {
        name: "comic_read_project",
        description: "读取丹青溢彩漫画项目字段。",
        inputSchema: {
          type: "object",
          required: ["projectIdOrTitle"],
          properties: {
            projectIdOrTitle: { type: "string" }
          }
        }
      },
      {
        name: "comic_update_project_fields",
        description: "写回丹青溢彩漫画项目级字段。默认 dryRun=true；用户明确保存/写回时设置 dryRun=false。",
        inputSchema: {
          type: "object",
          required: ["projectIdOrTitle"],
          properties: {
            projectIdOrTitle: { type: "string" },
            summary: { type: "string" },
            visualStyle: { type: "string" },
            episodePlan: { type: "string" },
            dryRun: { type: "boolean" }
          }
        }
      }
    ];
  }

  if (pathname.includes("generation")) {
    return [
      {
        name: "image_gen",
        description: "Generate image assets",
        inputSchema: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: { type: "string" },
            size: { type: "string" }
          }
        }
      },
      {
        name: "video_gen",
        description: "使用 Seedance 视频生成能力，提交 / 查询视频生成任务。",
        inputSchema: {
          type: "object",
          required: ["operation"],
          properties: {
            operation: { type: "string" },
            provider: { type: "string" },
            mode: { type: "string" },
            prompt: { type: "string" },
            durationSeconds: { type: "integer" },
            ratio: { type: "string" },
            resolution: { type: "string" },
            watermark: { type: "boolean" }
          }
        }
      },
      {
        name: "music_gen",
        description: "Generate music assets",
        inputSchema: {
          type: "object",
          required: ["operation", "prompt"],
          properties: {
            operation: { type: "string" },
            prompt: { type: "string" },
            durationSeconds: { type: "integer" }
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
      const params = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};
      const toolName = typeof params.name === "string" ? params.name : "";

      sendJson(response, {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: pathname.includes("computer")
                ? "activeApp=Google Chrome\nvisibleText=Chrome Ready"
                : pathname.includes("search") && toolName === "web_research"
                  ? "source=https://platform.claude.com/docs/en/about-claude/models/overview\nsource=https://platform.claude.com/docs/en/about-claude/pricing\nsummary=Anthropic official pricing page returned Claude API model and price evidence. Claude Sonnet 4.6 input $3 / MTok output $15 / MTok."
                : pathname.includes("application") && toolName === "comic_update_project_fields"
                  ? "applied=true\nproject=寂寞青梅\nsummary includes 刀梦 小梅\nvisualStyle=古风武侠彩绘分镜\nepisodePlan=24 页首章规划"
                  : pathname.includes("generation") && toolName === "video_gen"
                    ? "video_gen 调用完成\noperation=submit\nmode=text_to_video\ntaskId=video-task-1\nstatus=completed\nartifacts=1"
                  : "workspace file content"
            }
          ],
          structuredContent: pathname.includes("computer")
            ? {
                activeApp: "Google Chrome",
                visibleText: ["Chrome Ready"]
              }
            : pathname.includes("search") && toolName === "web_research"
              ? {
                  query: "Anthropic Claude latest official API pricing",
                  sources: [
                    {
                      title: "Anthropic Claude pricing",
                      url: "https://platform.claude.com/docs/en/about-claude/pricing",
                      domain: "platform.claude.com",
                      snippet: "Official Claude API pricing evidence with input $3 / MTok and output $15 / MTok"
                    }
                  ]
                }
            : pathname.includes("application") && toolName === "comic_update_project_fields"
              ? {
                  applied: true,
                  project: {
                    title: "寂寞青梅",
                    summary: "《寂寞青梅》讲述刀梦和小梅的江湖故事。",
                    visualStyle: "古风武侠彩绘分镜",
                    episodePlan: "24 页首章规划"
                  }
                }
              : pathname.includes("generation") && toolName === "video_gen"
                ? {
                    provider: "seedance",
                    operation: "submit",
                    taskId: "video-task-1",
                    status: "completed",
                    artifacts: [
                      {
                        id: "video_gen_1",
                        kind: "video",
                        title: "video_gen 结果 1",
                        url: "https://example.test/cat-dance.mp4",
                        mimeType: "video/mp4",
                        provider: "seedance",
                        model: "seedance-test"
                      }
                    ]
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

function createIrrelevantThenOfficialSearchMcpServer(capturedRequests: CapturedRequest[]): Server {
  let searchCalls = 0;

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
            name: "fake-search-mcp",
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
      const params = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};
      const toolName = typeof params.name === "string" ? params.name : "";

      if (pathname.includes("search") && toolName === "web_research") {
        searchCalls += 1;
        const isFirstSearch = searchCalls === 1;

        sendJson(response, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                  type: "text",
                  text: isFirstSearch
                    ? "source=https://dict.example.test/help\nsummary=帮字词典页面，和 Anthropic/Claude 模型无关"
                  : "source=https://platform.claude.com/docs/en/about-claude/models/overview\nsource=https://platform.claude.com/docs/en/about-claude/pricing\nsource=https://support.claude.com/en/articles/12138966-release-notes\nsummary=Anthropic official Claude models overview and release notes include Claude Fable 5, Mythos 5, Opus 4.8, Sonnet 4.6, Haiku 4.5, API IDs, status, and pricing such as input $3 / MTok output $15 / MTok."
              }
            ],
            structuredContent: isFirstSearch
              ? {
                  query: "帮",
                  sources: [
                    {
                      title: "帮字词典",
                      url: "https://dict.example.test/help",
                      domain: "dict.example.test",
                      snippet: "汉字解释"
                    }
                  ]
                }
              : {
                  query: "Anthropic Claude latest models official model overview",
                  sources: [
                    {
                      title: "Anthropic Claude models overview",
                      url: "https://platform.claude.com/docs/en/about-claude/models/overview",
                      domain: "platform.claude.com",
                      snippet: "Claude model names, API IDs, and current availability."
                    },
                    {
                      title: "Anthropic Claude pricing",
                      url: "https://platform.claude.com/docs/en/about-claude/pricing",
                      domain: "platform.claude.com",
                      snippet: "Official Claude pricing includes input $3 / MTok and output $15 / MTok."
                    },
                    {
                      title: "Claude release notes",
                      url: "https://support.claude.com/en/articles/12138966-release-notes",
                      domain: "support.claude.com",
                      snippet: "Latest Claude release notes and model changes."
                    }
                  ]
                }
          }
        });
        return;
      }

      sendJson(response, {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: "unsupported test tool" }],
          structuredContent: {}
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

function createGoldPriceSearchMcpServer(capturedRequests: CapturedRequest[]): Server {
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
            name: "fake-gold-search-mcp",
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
      const params = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};
      const toolName = typeof params.name === "string" ? params.name : "";

      sendJson(response, {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text:
                pathname.includes("search") && toolName === "web_research"
                  ? "source=https://gold.example.test/live\nsummary=现货黄金 XAU/USD 今日实时价格为 2320.12 美元/盎司，国内黄金约 548.30 元/克。"
                  : "workspace file content"
            }
          ],
          structuredContent:
            pathname.includes("search") && toolName === "web_research"
              ? {
                  query: "今日黄金价格 XAU/USD 现货黄金 实时",
                  sources: [
                    {
                      title: "Gold live price",
                      url: "https://gold.example.test/live",
                      domain: "gold.example.test",
                      snippet: "XAU/USD gold price 2320.12 USD/oz; 黄金 548.30 元/克"
                    }
                  ]
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
    const firstPlannerRequest = modelRequests.find(
      (request) => getSystemMessage(request.body).includes("工具规划器") || getSystemMessage(request.body).includes("资源任务规划器")
    );
    const activeVerificationPlannerRequests = modelRequests.filter((request) => getSystemMessage(request.body).includes("主动验证规划器"));
    const firstPlannerUserMessage = getModelMessages(firstPlannerRequest?.body ?? {}).find((message) => message.role === "user")?.content ?? "";

    assert.ok(firstPlannerRequest);
    assert.equal(activeVerificationPlannerRequests.length, 0);
    assert.match(firstPlannerUserMessage, /能力路由上下文/u);
    assert.match(firstPlannerUserMessage, /"allToolsAvailable": false/u);
    assert.match(firstPlannerUserMessage, /Planner Tool View/u);
    assert.match(firstPlannerUserMessage, /可见工具列表/u);
    assert.match(firstPlannerUserMessage, /test:mcp:computer-use/u);
    assert.match(firstPlannerUserMessage, /test:mcp:workspace/u);
    assert.equal(log.steps.some((step) => /发现 \d+ 个候选工具，接下来由模型选择是否调用/u.test(step.detail)), false);
    assert.ok(log.steps.some((step) => step.title === "Planner 工具视图已生成" && /Planner 可见工具/u.test(step.detail)));
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

test("runAgent directly routes explicit generation requests without planner latency", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-direct-video-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const permissionRequests: unknown[] = [];
  const modelServer = createFakeDirectGenerationModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:fake-direct-video",
      provider: "openai_like",
      displayName: "Fake Direct Video Model",
      model: "fake-direct-video",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const generationToolsServer: McpServerConfig = {
      id: "test:mcp:generation-tools",
      name: "Generation Tools",
      description: "Built-in generation tools",
      transport: "http",
      url: `${mcpBaseUrl}/generation`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:direct-video",
      name: "Direct Video Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools when users ask to generate media.",
      allowedSkillIds: [],
      allowedMcpServerIds: [generationToolsServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(generationToolsServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent(
      {
        agentProfileId: agentProfile.id,
        userInput: "帮我生成一段5s的小猫跳舞视频\n\n当前应用广场上下文：\n应用：丹青溢彩（comic）\n当前项目：测试项目",
        autoSelectMcp: true
      },
      {
        onToolPermissionRequest: async (request) => {
          permissionRequests.push(request);
          return true;
        }
      }
    );
    const genericPlannerRequests = modelRequests.filter((request) => {
      const systemMessage = getSystemMessage(request.body);
      return systemMessage.includes("资源任务规划器");
    });
    const activeVerificationPlannerRequests = modelRequests.filter((request) => getSystemMessage(request.body).includes("主动验证规划器"));
    const toolCallRequest = mcpRequests.find((request) => request.url.includes("/generation") && request.body.method === "tools/call");
    const toolParams = toolCallRequest?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;

    assert.equal(genericPlannerRequests.length, 0);
    assert.equal(activeVerificationPlannerRequests.length, 0);
    assert.equal(permissionRequests.length, 1);
    assert.ok(log.steps.some((step) => step.type === "mcp_auto_planning" && /已识别为视频生成任务/u.test(step.title)));
    assert.equal(log.mcpCalls?.[0]?.serverId, "test:mcp:generation-tools");
    assert.equal(log.mcpCalls?.[0]?.toolName, "video_gen");
    assert.equal(log.mcpCalls?.[0]?.isError, false);
    assert.equal(toolParams?.name, "video_gen");
    assert.deepEqual(toolParams?.arguments, {
      operation: "submit",
      provider: "seedance",
      mode: "text_to_video",
      prompt: "一段5s的小猫跳舞视频",
      durationSeconds: 5,
      ratio: "16:9",
      resolution: "720p",
      watermark: false
    });
    assert.equal(log.mcpCalls?.[0]?.artifacts?.[0]?.url, "https://example.test/cat-dance.mp4");
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent forces external evidence tools for latest official pricing questions", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-external-evidence-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createFakeExternalEvidenceModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:fake-external-evidence",
      provider: "openai_like",
      displayName: "Fake External Evidence Model",
      model: "fake-external-evidence",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const searchToolsServer: McpServerConfig = {
      id: "test:mcp:search-tools",
      name: "Search Tools",
      description: "Search and research the public web",
      transport: "http",
      url: `${mcpBaseUrl}/search`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:external-evidence",
      name: "External Evidence Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools for current official pricing and cite evidence.",
      allowedSkillIds: [],
      allowedMcpServerIds: [searchToolsServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(searchToolsServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "帮我联网查一下 Anthropic Claude 最新官方 API 价格，带上来源",
      autoSelectMcp: true
    });
    const plannerRequests = modelRequests.filter((request) => getSystemMessage(request.body).includes("资源任务规划器"));
    const searchToolCallRequest = mcpRequests.find((request) => request.url.includes("/search") && request.body.method === "tools/call");
    const searchToolParams = searchToolCallRequest?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;

    assert.equal(plannerRequests.length, 1);
    assert.ok(log.steps.some((step) => step.title.includes("已补充外部证据工具")));
    assert.equal(log.autoSelectedMcp, true);
    assert.equal(log.mcpCalls?.[0]?.serverId, "test:mcp:search-tools");
    assert.equal(log.mcpCalls?.[0]?.toolName, "web_research");
    assert.equal(log.mcpCalls?.[0]?.isError, false);
    assert.equal(searchToolParams?.name, "web_research");
    assert.match(String(searchToolParams?.arguments?.query ?? ""), /Anthropic Claude/u);
    assert.deepEqual(searchToolParams?.arguments?.preferredDomains, [
      "anthropic.com",
      "docs.anthropic.com",
      "platform.claude.com",
      "support.claude.com"
    ]);
    assert.deepEqual(searchToolParams?.arguments?.includeDomains, [
      "anthropic.com",
      "docs.anthropic.com",
      "platform.claude.com",
      "support.claude.com"
    ]);
    assert.deepEqual(searchToolParams?.arguments?.officialUrls, [
      "https://platform.claude.com/docs/en/about-claude/models/overview",
      "https://platform.claude.com/docs/en/about-claude/pricing",
      "https://support.claude.com/en/articles/12138966-release-notes",
      "https://www.anthropic.com/news/claude-fable-5-mythos-5",
      "https://www.anthropic.com/news/fable-mythos-access",
      "https://www.anthropic.com/news/claude-opus-4-8"
    ]);
    assert.match(log.mcpResultText ?? "", /platform\.claude\.com/u);
    assert.match(log.text, /Search Tools|官网|来源|pricing|价格/u);
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent uses clean web research query for live gold price questions", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-gold-price-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createFakeExternalEvidenceModelServer(modelRequests);
  const mcpServer = createGoldPriceSearchMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:fake-gold-price",
      provider: "openai_like",
      displayName: "Fake Gold Price Model",
      model: "fake-gold-price",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const searchToolsServer: McpServerConfig = {
      id: "test:mcp:search-tools",
      name: "Search Tools",
      description: "Search and research the public web",
      transport: "http",
      url: `${mcpBaseUrl}/search`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:gold-price",
      name: "Gold Price Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools for current market prices and cite evidence.",
      allowedSkillIds: [],
      allowedMcpServerIds: [searchToolsServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(searchToolsServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "帮我查下现在黄金的价格是多少",
      conversationMessages: [
        { role: "user", content: "你是谁" },
        { role: "assistant", content: "我是 Gordon，一个持续执行型工程 Agent。" }
      ],
      autoSelectMcp: true
    });
    const searchToolCallRequest = mcpRequests.find((request) => request.url.includes("/search") && request.body.method === "tools/call");
    const searchToolParams = searchToolCallRequest?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;

    assert.equal(log.mcpCalls?.[0]?.toolName, "web_research");
    assert.equal(searchToolParams?.name, "web_research");
    assert.equal(searchToolParams?.arguments?.query, "今日黄金价格 XAU/USD 现货黄金 实时");
    assert.doesNotMatch(String(searchToolParams?.arguments?.query ?? ""), /当前会话最近上下文|你是谁|Gordon/u);
    assert.equal(log.mcpCalls?.some((call) => call.toolName === "github_search_repositories"), false);
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent retries official external evidence when first search result is irrelevant", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-external-evidence-retry-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createFakeExternalEvidenceModelServer(modelRequests);
  const mcpServer = createIrrelevantThenOfficialSearchMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:external-evidence-retry",
      provider: "openai_like",
      displayName: "External Evidence Retry Model",
      model: "external-evidence-retry",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const searchToolsServer: McpServerConfig = {
      id: "test:mcp:search-tools-retry",
      name: "Search Tools",
      description: "Search and research the public web",
      transport: "http",
      url: `${mcpBaseUrl}/search`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:external-evidence-retry",
      name: "External Evidence Retry Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use official evidence for current model catalogs.",
      allowedSkillIds: [],
      allowedMcpServerIds: [searchToolsServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(searchToolsServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "帮我查一下anthropic旗下最新的模型有哪些？",
      autoSelectMcp: true
    });
    const searchToolCalls = mcpRequests.filter((request) => request.url.includes("/search") && request.body.method === "tools/call");
    const firstSearchParams = searchToolCalls[0]?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;
    const secondSearchParams = searchToolCalls[1]?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;

    assert.equal(searchToolCalls.length, 2);
    assert.equal(firstSearchParams?.name, "web_research");
    assert.equal(secondSearchParams?.name, "web_research");
    assert.match(String(firstSearchParams?.arguments?.query ?? ""), /Anthropic Claude latest models/u);
    assert.match(String(secondSearchParams?.arguments?.query ?? ""), /Anthropic Claude models overview|Claude model names/u);
    assert.deepEqual(secondSearchParams?.arguments?.includeDomains, [
      "anthropic.com",
      "docs.anthropic.com",
      "platform.claude.com",
      "support.claude.com"
    ]);
    assert.ok(Array.isArray(secondSearchParams?.arguments?.officialUrls));
    assert.ok((secondSearchParams?.arguments?.officialUrls as unknown[]).includes("https://platform.claude.com/docs/en/about-claude/pricing"));
    assert.ok(log.steps.some((step) => /外部证据质量检查未通过/u.test(step.title)));
    assert.match(log.mcpResultText ?? "", /platform\.claude\.com/u);
    assert.match(log.text, /官网来源|Claude|价格|Search Tools/u);
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent falls back to required workspace tools when planner says no tool is needed", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-workspace-no-tool-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createFakeWorkspaceNoToolModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:workspace-no-tool",
      provider: "openai_like",
      displayName: "Workspace No Tool Model",
      model: "workspace-no-tool",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const workspaceServer: McpServerConfig = {
      id: "test:mcp:workspace-no-tool",
      name: "Workspace Tools",
      description: "Read files",
      transport: "http",
      url: `${mcpBaseUrl}/workspace`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:workspace-no-tool",
      name: "Workspace No Tool Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools for workspace file state.",
      allowedSkillIds: [],
      allowedMcpServerIds: [workspaceServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(workspaceServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "检查一下当前项目里的 README 文件是否存在",
      autoSelectMcp: true
    });
    const workspaceToolCallRequest = mcpRequests.find((request) => request.url.includes("/workspace") && request.body.method === "tools/call");
    const workspaceToolParams = workspaceToolCallRequest?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;

    assert.equal(log.mcpCalls?.length ?? 0, 1);
    assert.equal(log.mcpCalls?.[0]?.toolName, "read_file");
    assert.equal(workspaceToolParams?.name, "read_file");
    assert.deepEqual(workspaceToolParams?.arguments, { path: "." });
    assert.ok(log.steps.some((step) => step.type === "mcp_auto_planning" && /required fallback/u.test(step.title)));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent continues an active workspace task without generic planner", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-task-continuation-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createFakeWorkspaceNoToolModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:task-continuation",
      provider: "openai_like",
      displayName: "Task Continuation Model",
      model: "task-continuation",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const workspaceServer: McpServerConfig = {
      id: "test:mcp:workspace-continuation",
      name: "Workspace Tools",
      description: "Read files",
      transport: "http",
      url: `${mcpBaseUrl}/workspace`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:task-continuation",
      name: "Task Continuation Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Continue active tasks from the ledger.",
      allowedSkillIds: [],
      allowedMcpServerIds: [workspaceServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(workspaceServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "继续",
      autoSelectMcp: true,
      taskLedger: createWorkspaceContinuationLedger()
    });
    const genericPlannerRequests = modelRequests.filter((request) => getSystemMessage(request.body).includes("资源任务规划器"));
    const workspaceToolCallRequest = mcpRequests.find((request) => request.url.includes("/workspace") && request.body.method === "tools/call");
    const workspaceToolParams = workspaceToolCallRequest?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;

    assert.equal(genericPlannerRequests.length, 0);
    assert.equal(log.mcpCalls?.length ?? 0, 1);
    assert.equal(log.mcpCalls?.[0]?.toolName, "read_file");
    assert.equal(workspaceToolParams?.name, "read_file");
    assert.deepEqual(workspaceToolParams?.arguments, { path: "." });
    assert.equal(log.taskLedger?.objective, "检查 README 文件是否存在");
    assert.ok(log.taskLedger?.userInterruptions.some((item) => item.includes("继续")));
    assert.ok(log.steps.some((step) => step.type === "mcp_auto_planning" && /继续执行当前任务/u.test(step.title)));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent invokes planner for a new task even when previous ledger exists", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-task-continuation-new-task-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createFakeWorkspaceNoToolModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:task-continuation-new-task",
      provider: "openai_like",
      displayName: "Task Continuation New Task Model",
      model: "task-continuation-new-task",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const workspaceServer: McpServerConfig = {
      id: "test:mcp:workspace-continuation-new-task",
      name: "Workspace Tools",
      description: "Read files",
      transport: "http",
      url: `${mcpBaseUrl}/workspace`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:task-continuation-new-task",
      name: "Task Continuation New Task Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Plan new tasks when the user changes objective.",
      allowedSkillIds: [],
      allowedMcpServerIds: [workspaceServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(workspaceServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "帮我实现登录功能",
      autoSelectMcp: true,
      taskLedger: createWorkspaceContinuationLedger()
    });
    const genericPlannerRequests = modelRequests.filter((request) => getSystemMessage(request.body).includes("资源任务规划器"));

    assert.equal(genericPlannerRequests.length, 1);
    assert.ok(!log.steps.some((step) => step.type === "mcp_auto_planning" && /继续执行当前任务/u.test(step.title)));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent falls back to required workspace tools when the planner exceeds the latency budget", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const previousPlannerTimeout = process.env.GORDON_MCP_PLANNER_TIMEOUT_MS;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-planner-timeout-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const permissionRequests: unknown[] = [];
  const modelServer = createSlowPlannerModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");
    process.env.GORDON_MCP_PLANNER_TIMEOUT_MS = "50";

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:slow-planner",
      provider: "openai_like",
      displayName: "Slow Planner Model",
      model: "slow-planner",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const workspaceServer: McpServerConfig = {
      id: "test:mcp:workspace-timeout",
      name: "Workspace Tools",
      description: "Read files",
      transport: "http",
      url: `${mcpBaseUrl}/workspace`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:planner-timeout",
      name: "Planner Timeout Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools when useful.",
      allowedSkillIds: [],
      allowedMcpServerIds: [workspaceServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(workspaceServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent(
      {
        agentProfileId: agentProfile.id,
        userInput: "检查一下当前项目里的 README 文件是否存在",
        autoSelectMcp: true
      },
      {
        onToolPermissionRequest: async (request) => {
          permissionRequests.push(request);
          return true;
        }
      }
    );
    const genericPlannerRequests = modelRequests.filter((request) => {
      const systemMessage = getSystemMessage(request.body);
      return systemMessage.includes("资源任务规划器");
    });

    const workspaceToolCallRequest = mcpRequests.find((request) => request.url.includes("/workspace") && request.body.method === "tools/call");
    const workspaceToolParams = workspaceToolCallRequest?.body.params as { arguments?: Record<string, unknown>; name?: string } | undefined;

    assert.equal(genericPlannerRequests.length, 1);
    assert.equal(permissionRequests.length, 0);
    assert.equal(log.mcpCalls?.length ?? 0, 1);
    assert.equal(log.mcpCalls?.[0]?.toolName, "read_file");
    assert.equal(workspaceToolParams?.name, "read_file");
    assert.deepEqual(workspaceToolParams?.arguments, { path: "." });
    assert.ok(log.steps.some((step) => step.type === "mcp_auto_planning" && /required fallback/u.test(step.title)));
    assert.ok(log.steps.some((step) => step.type === "mcp_auto_stopped" && /required fallback 已返回/u.test(step.title)));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    if (previousPlannerTimeout === undefined) {
      delete process.env.GORDON_MCP_PLANNER_TIMEOUT_MS;
    } else {
      process.env.GORDON_MCP_PLANNER_TIMEOUT_MS = previousPlannerTimeout;
    }
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent keeps optional planner timeout behavior unchanged", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const previousPlannerTimeout = process.env.GORDON_MCP_PLANNER_TIMEOUT_MS;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-optional-planner-timeout-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createSlowPlannerModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");
    process.env.GORDON_MCP_PLANNER_TIMEOUT_MS = "50";

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:slow-optional-planner",
      provider: "openai_like",
      displayName: "Slow Optional Planner Model",
      model: "slow-optional-planner",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const workspaceServer: McpServerConfig = {
      id: "test:mcp:workspace-optional-timeout",
      name: "Workspace Tools",
      description: "Read files",
      transport: "http",
      url: `${mcpBaseUrl}/workspace`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:optional-planner-timeout",
      name: "Optional Planner Timeout Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools when useful.",
      allowedSkillIds: [],
      allowedMcpServerIds: [workspaceServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(workspaceServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent({
      agentProfileId: agentProfile.id,
      userInput: "解释一下任务账本为什么能帮助长链路 Agent",
      autoSelectMcp: true
    });
    const genericPlannerRequests = modelRequests.filter((request) => {
      const systemMessage = getSystemMessage(request.body);
      return systemMessage.includes("资源任务规划器");
    });

    assert.equal(genericPlannerRequests.length, 1);
    assert.equal(log.mcpCalls?.length ?? 0, 0);
    assert.match(log.stopReason ?? "", /前置工具规划超过/u);
    assert.ok(log.steps.some((step) => step.type === "mcp_auto_stopped" && /工具规划超时/u.test(step.title)));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    if (previousPlannerTimeout === undefined) {
      delete process.env.GORDON_MCP_PLANNER_TIMEOUT_MS;
    } else {
      process.env.GORDON_MCP_PLANNER_TIMEOUT_MS = previousPlannerTimeout;
    }
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent asks permission before executing high-risk application asset tools", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-permission-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const permissionRequests: unknown[] = [];
  const modelServer = createFakeModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:fake-permission",
      provider: "openai_like",
      displayName: "Fake Permission Model",
      model: "fake-planner",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const applicationServer: McpServerConfig = {
      id: "test:mcp:application-tools",
      name: "Application Tools",
      description: "Read and write application assets",
      transport: "http",
      url: `${mcpBaseUrl}/application`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:permission",
      name: "Permission Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools when users ask to write application assets.",
      allowedSkillIds: [],
      allowedMcpServerIds: [applicationServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(applicationServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent(
      {
        agentProfileId: agentProfile.id,
        userInput: "把丹青溢彩项目寂寞青梅的 OVERVIEW 三字段写回，dryRun=false",
        autoSelectMcp: true
      },
      {
        onToolPermissionRequest: async (request) => {
          permissionRequests.push(request);
          return true;
        }
      }
    );

    assert.equal(permissionRequests.length, 1);
    assert.deepEqual(
      log.steps.filter((step) => step.type.startsWith("tool_permission_")).map((step) => step.type),
      ["tool_permission_requested", "tool_permission_granted"]
    );
    assert.equal(log.mcpCalls?.[0]?.serverId, "test:mcp:application-tools");
    assert.equal(log.mcpCalls?.[0]?.toolName, "comic_update_project_fields");
    assert.equal(log.mcpCalls?.[0]?.isError, false);
    assert.equal(log.mcpCalls?.[0]?.structuredContent?.applied, true);
    assert.ok(mcpRequests.some((request) => request.url.includes("/application") && request.body.method === "tools/call"));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent auto-grants high-risk application asset tools when permission mode is auto", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-auto-permission-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const permissionRequests: unknown[] = [];
  const modelServer = createFakeModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:fake-auto-permission",
      provider: "openai_like",
      displayName: "Fake Auto Permission Model",
      model: "fake-planner",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const applicationServer: McpServerConfig = {
      id: "test:mcp:application-tools",
      name: "Application Tools",
      description: "Read and write application assets",
      transport: "http",
      url: `${mcpBaseUrl}/application`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:auto-permission",
      name: "Auto Permission Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use tools when users ask to write application assets.",
      allowedSkillIds: [],
      allowedMcpServerIds: [applicationServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(applicationServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent(
      {
        agentProfileId: agentProfile.id,
        userInput: "把丹青溢彩项目寂寞青梅的 OVERVIEW 三字段写回，dryRun=false",
        permissionMode: "auto",
        autoSelectMcp: true
      },
      {
        onToolPermissionRequest: async (request) => {
          permissionRequests.push(request);
          return true;
        }
      }
    );

    assert.equal(permissionRequests.length, 0);
    assert.deepEqual(
      log.steps.filter((step) => step.type.startsWith("tool_permission_")).map((step) => step.type),
      ["tool_permission_granted"]
    );
    assert.equal(log.mcpCalls?.[0]?.serverId, "test:mcp:application-tools");
    assert.equal(log.mcpCalls?.[0]?.toolName, "comic_update_project_fields");
    assert.equal(log.mcpCalls?.[0]?.isError, false);
    assert.equal(log.mcpCalls?.[0]?.structuredContent?.applied, true);
    assert.ok(mcpRequests.some((request) => request.url.includes("/application") && request.body.method === "tools/call"));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

function createGuidanceAwareModelServer(capturedRequests: CapturedRequest[]): Server {
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
    const userMessage = getModelMessages(body).find((message) => message.role === "user")?.content ?? "";
    let content = userMessage.includes("需要输出对应的价格")
      ? "最终回复已吸收价格引导。"
      : "最终回复未看到价格引导。";

    if (systemMessage.includes("资源任务规划器")) {
      content = JSON.stringify({
        shouldCall: false,
        serverId: null,
        toolName: null,
        arguments: {},
        reason: userMessage.includes("需要输出对应的价格")
          ? "已吸收运行时用户引导：需要输出对应的价格。"
          : "未收到运行时用户引导。",
        expectedOutcome: "整理 Anthropic 模型与价格",
        verificationMethod: "检查最终回复包含价格要求",
        ledgerPatch: {
          objective: "查询 Anthropic 最新模型并输出价格",
          taskPhase: "verifying",
          nextActionHint: "最终回复需要包含价格"
        }
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

function createLateGuidanceModelServer(capturedRequests: CapturedRequest[]): Server {
  let finalCalls = 0;

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
    let content = "基于旧认知整理 Anthropic 模型，没有价格。";

    if (systemMessage.includes("任务账本压缩器")) {
      content = JSON.stringify({
        taskPhase: "verifying",
        discoveredFacts: ["web_research 返回 Anthropic 官方模型和价格证据"],
        completedSubtasks: ["检索 Anthropic 官方模型和价格"],
        pendingSubtasks: [],
        nextActionHint: "最终回复需要包含官方价格"
      });
    } else if (systemMessage.includes("资源任务规划器")) {
      content = JSON.stringify({
        shouldCall: false,
        serverId: null,
        toolName: null,
        arguments: {},
        reason: "先直接回答。",
        expectedOutcome: "整理 Anthropic 模型",
        verificationMethod: "",
        ledgerPatch: {
          objective: "查询 Anthropic 模型",
          taskPhase: "finalizing"
        }
      });
    } else {
      finalCalls += 1;
      content = finalCalls === 1 ? "第一版没有价格。" : "第二版已包含官方价格和来源。";
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

test("runAgent consumes runtime guidance before the current planner turn", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-runtime-guidance-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createGuidanceAwareModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);
  let consumed = false;

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:runtime-guidance",
      provider: "openai_like",
      displayName: "Runtime Guidance Model",
      model: "runtime-guidance",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const searchServer: McpServerConfig = {
      id: "test:mcp:runtime-guidance-search",
      name: "Search Tools",
      description: "Search and research the public web",
      transport: "http",
      url: `${mcpBaseUrl}/search`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:runtime-guidance",
      name: "Runtime Guidance Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use runtime guidance.",
      allowedSkillIds: [],
      allowedMcpServerIds: [searchServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(searchServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent(
      {
        agentProfileId: agentProfile.id,
        userInput: "帮我查一下目前 Anthropic 最新的模型有哪些",
        autoSelectMcp: true
      },
      {
        consumeRuntimeGuidance: async () => {
          if (consumed) {
            return [];
          }

          consumed = true;
          return [
            {
              id: "guidance:price",
              content: "需要输出对应的价格",
              createdAt: "2026-06-15T00:00:00.000Z"
            }
          ];
        }
      }
    );
    const plannerRequest = modelRequests.find((request) => getSystemMessage(request.body).includes("资源任务规划器"));
    const plannerUserMessage = plannerRequest ? getModelMessages(plannerRequest.body).find((message) => message.role === "user")?.content ?? "" : "";

    assert.match(plannerUserMessage, /需要输出对应的价格/u);
    assert.match(log.text, /价格引导/u);
    assert.ok(log.taskLedger?.userInterruptions.some((item) => item.includes("需要输出对应的价格")));
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("runAgent reprocesses guidance that arrives during final response", async () => {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-agent-late-guidance-"));
  const modelRequests: CapturedRequest[] = [];
  const mcpRequests: CapturedRequest[] = [];
  const modelServer = createLateGuidanceModelServer(modelRequests);
  const mcpServer = createFakeMcpServer(mcpRequests);
  let delivered = false;

  try {
    const [modelBaseUrl, mcpBaseUrl] = await Promise.all([listen(modelServer), listen(mcpServer)]);
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");

    const timestamp = "2026-06-01T00:00:00.000Z";
    const modelProfile: ModelProfile = {
      id: "test:model:late-guidance",
      provider: "openai_like",
      displayName: "Late Guidance Model",
      model: "late-guidance",
      apiKey: "test-key",
      baseUrl: modelBaseUrl,
      apiFormat: "chat_completions",
      supportsStreaming: false,
      updatedAt: timestamp
    };
    const searchServer: McpServerConfig = {
      id: "test:mcp:late-guidance-search",
      name: "Search Tools",
      description: "Search and research the public web",
      transport: "http",
      url: `${mcpBaseUrl}/search`,
      env: {},
      toolAllowlist: [],
      enabled: true,
      updatedAt: timestamp
    };
    const agentProfile: AgentProfile = {
      id: "test:agent:late-guidance",
      name: "Late Guidance Test Agent",
      description: "Integration test agent",
      mode: "chat",
      modelProfileId: modelProfile.id,
      systemPrompt: "Use late runtime guidance.",
      allowedSkillIds: [],
      allowedMcpServerIds: [searchServer.id],
      enabled: true,
      updatedAt: timestamp
    };

    await saveModelSettings({
      profiles: [modelProfile],
      activeProfileId: modelProfile.id
    });
    await upsertMcpServer(searchServer);
    await upsertAgentProfile(agentProfile);

    const log = await runAgent(
      {
        agentProfileId: agentProfile.id,
        userInput: "帮我查下anthropic旗下罪行的模型有哪些？",
        autoSelectMcp: true
      },
      {
        consumeRuntimeGuidance: async (lastGuidanceId) => {
          if (delivered || lastGuidanceId) {
            return [];
          }

          const finalCalls = modelRequests.filter((entry) => {
            const systemMessage = getSystemMessage(entry.body);
            return (
              !systemMessage.includes("资源任务规划器") &&
              !systemMessage.includes("任务账本压缩器") &&
              !systemMessage.includes("主动验证规划器")
            );
          }).length;

          if (finalCalls < 1) {
            return [];
          }

          delivered = true;
          return [
            {
              id: "guidance:late-price",
              content: "需要输出对应的官方价格",
              createdAt: "2026-06-15T00:00:00.000Z"
            }
          ];
        }
      }
    );

    const searchToolParams = mcpRequests.find((entry) => entry.body.method === "tools/call")?.body.params as
      | { arguments?: Record<string, unknown> }
      | undefined;

    assert.match(String(searchToolParams?.arguments?.query ?? ""), /latest/u);
    assert.doesNotMatch(String(searchToolParams?.arguments?.query ?? ""), /罪行/u);
    assert.deepEqual(searchToolParams?.arguments?.preferredDomains, [
      "anthropic.com",
      "docs.anthropic.com",
      "platform.claude.com",
      "support.claude.com"
    ]);
    assert.deepEqual(searchToolParams?.arguments?.includeDomains, [
      "anthropic.com",
      "docs.anthropic.com",
      "platform.claude.com",
      "support.claude.com"
    ]);
    assert.match(log.text, /官方价格/u);
    assert.ok(log.taskLedger?.userInterruptions.some((item) => item.includes("官方价格")));
    const finalResponseRequests = modelRequests.filter((entry) => {
      const systemMessage = getSystemMessage(entry.body);
      return (
        !systemMessage.includes("资源任务规划器") &&
        !systemMessage.includes("任务账本压缩器") &&
        !systemMessage.includes("主动验证规划器")
      );
    });
    assert.ok(finalResponseRequests.length >= 2);
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await Promise.allSettled([closeServer(modelServer), closeServer(mcpServer)]);
    await rm(tempHome, { recursive: true, force: true });
  }
});

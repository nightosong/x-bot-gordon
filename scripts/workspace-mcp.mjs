import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const workspaceRoot = path.resolve(process.env.GORDON_WORKSPACE_ROOT || process.cwd());
const TEXT_FILE_MAX_BYTES = 256 * 1024;
const SEARCH_RESULT_LIMIT = 80;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", ".pnpm-store"]);

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function ok(id, result) {
  send({
    jsonrpc: "2.0",
    id,
    result
  });
}

function fail(id, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message
    }
  });
}

function toRelativePath(targetPath) {
  const relativePath = path.relative(workspaceRoot, targetPath);
  return relativePath || ".";
}

function resolveWorkspacePath(inputPath = ".") {
  const resolvedPath = path.resolve(workspaceRoot, String(inputPath || "."));
  const relativePath = path.relative(workspaceRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("目标路径超出当前工作区");
  }

  return resolvedPath;
}

async function listDirectory(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const normalizedEntries = entries
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 120)
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other"
    }));

  return {
    content: [
      {
        type: "text",
        text: [
          `workspace: ${workspaceRoot}`,
          `path: ${toRelativePath(targetPath)}`,
          "",
          ...normalizedEntries.map((entry) => `${entry.type === "dir" ? "[dir]" : "[file]"} ${entry.name}`)
        ].join("\n")
      }
    ],
    structuredContent: {
      workspaceRoot,
      path: toRelativePath(targetPath),
      entries: normalizedEntries
    }
  };
}

async function readFileContent(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const stat = await fs.stat(targetPath);

  if (!stat.isFile()) {
    throw new Error("目标路径不是文件");
  }

  if (stat.size > TEXT_FILE_MAX_BYTES) {
    throw new Error(`文件过大，当前只允许读取 ${TEXT_FILE_MAX_BYTES} 字节以内的文本文件`);
  }

  const rawContent = await fs.readFile(targetPath, "utf8");
  const lines = rawContent.split("\n");
  const startLine = Math.max(1, Number(argumentsObject?.startLine) || 1);
  const endLine = Math.min(lines.length, Number(argumentsObject?.endLine) || Math.min(lines.length, startLine + 199));
  const selectedLines = lines
    .slice(startLine - 1, endLine)
    .map((line, index) => `${String(startLine + index).padStart(4, " ")} | ${line}`);

  return {
    content: [
      {
        type: "text",
        text: [`path: ${toRelativePath(targetPath)}`, `lines: ${startLine}-${endLine}`, "", ...selectedLines].join("\n")
      }
    ],
    structuredContent: {
      path: toRelativePath(targetPath),
      startLine,
      endLine,
      lineCount: lines.length
    }
  };
}

async function isSearchableTextFile(filePath) {
  const stat = await fs.stat(filePath);

  if (!stat.isFile() || stat.size > TEXT_FILE_MAX_BYTES) {
    return false;
  }

  const content = await fs.readFile(filePath, "utf8");

  if (content.includes("\u0000")) {
    return false;
  }

  return content;
}

async function collectSearchResults(query, directoryPath, results) {
  if (results.length >= SEARCH_RESULT_LIMIT) {
    return;
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (results.length >= SEARCH_RESULT_LIMIT) {
      return;
    }

    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await collectSearchResults(query, absolutePath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = await isSearchableTextFile(absolutePath);

    if (!content) {
      continue;
    }

    const lines = content.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      if (results.length >= SEARCH_RESULT_LIMIT) {
        return;
      }

      if (lines[index].toLowerCase().includes(query)) {
        results.push({
          path: toRelativePath(absolutePath),
          line: index + 1,
          preview: lines[index].trim()
        });
      }
    }
  }
}

async function searchFiles(argumentsObject) {
  const query = String(argumentsObject?.query || "").trim().toLowerCase();

  if (!query) {
    throw new Error("search_files 需要提供 query");
  }

  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const stat = await fs.stat(targetPath);
  const baseDirectory = stat.isDirectory() ? targetPath : path.dirname(targetPath);
  const results = [];

  await collectSearchResults(query, baseDirectory, results);

  return {
    content: [
      {
        type: "text",
        text: results.length
          ? results.map((result) => `${result.path}:${result.line}: ${result.preview}`).join("\n")
          : "未找到匹配结果"
      }
    ],
    structuredContent: {
      path: toRelativePath(baseDirectory),
      query,
      count: results.length,
      results
    }
  };
}

function getTools() {
  return [
    {
      name: "list_directory",
      description: "列出当前工作区或指定目录下的文件与子目录。",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的路径，默认 ."
          }
        }
      }
    },
    {
      name: "read_file",
      description: "读取指定文本文件，可选起止行号。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的文件路径"
          },
          startLine: {
            type: "integer",
            description: "起始行号，默认 1"
          },
          endLine: {
            type: "integer",
            description: "结束行号，默认最多返回 200 行"
          }
        }
      }
    },
    {
      name: "search_files",
      description: "在工作区文本文件中搜索关键词，返回匹配到的文件和行号。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description: "要搜索的关键词，按不区分大小写的纯文本匹配"
          },
          path: {
            type: "string",
            description: "可选，限定搜索目录"
          }
        }
      }
    }
  ];
}

async function handleRequest(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    ok(id, {
      protocolVersion: "2025-11-25",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "workspace-tools",
        version: "0.1.0"
      }
    });
    return;
  }

  if (method === "tools/list") {
    ok(id, {
      tools: getTools()
    });
    return;
  }

  if (method === "tools/call") {
    const toolName = String(params?.name || "").trim();
    const argumentsObject = params?.arguments && typeof params.arguments === "object" ? params.arguments : {};

    if (toolName === "list_directory") {
      ok(id, await listDirectory(argumentsObject));
      return;
    }

    if (toolName === "read_file") {
      ok(id, await readFileContent(argumentsObject));
      return;
    }

    if (toolName === "search_files") {
      ok(id, await searchFiles(argumentsObject));
      return;
    }

    throw new Error(`未知工具：${toolName}`);
  }

  if (method === "notifications/initialized") {
    return;
  }

  throw new Error(`未知方法：${method}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", async (line) => {
  const trimmed = line.trim();

  if (!trimmed) {
    return;
  }

  let message;

  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (typeof message.id !== "number") {
    if (message.method === "notifications/initialized") {
      return;
    }

    return;
  }

  try {
    await handleRequest(message);
  } catch (error) {
    fail(message.id, error instanceof Error ? error.message : String(error));
  }
});

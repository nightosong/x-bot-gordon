import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const workspaceRoot = path.resolve(process.env.GORDON_WORKSPACE_ROOT || process.cwd());
const TEXT_FILE_MAX_BYTES = 256 * 1024;
const SEARCH_RESULT_LIMIT = 80;
const WEB_SEARCH_RESULT_LIMIT = 8;
const WEB_SEARCH_TIMEOUT_MS = 10_000;
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

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function assertTextContent(content) {
  if (typeof content !== "string") {
    throw new Error("content 必须是字符串");
  }
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(text) {
  return decodeHtmlEntities(String(text || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function buildTextResult(text, structuredContent = undefined) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    ...(structuredContent ? { structuredContent } : {})
  };
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

async function getPathInfo(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const exists = await pathExists(targetPath);

  if (!exists) {
    return buildTextResult(`path: ${toRelativePath(targetPath)}\nexists: false`, {
      path: toRelativePath(targetPath),
      exists: false
    });
  }

  const stat = await fs.stat(targetPath);
  const info = {
    path: toRelativePath(targetPath),
    exists: true,
    type: stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other",
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };

  return buildTextResult(
    [
      `path: ${info.path}`,
      `exists: true`,
      `type: ${info.type}`,
      `size: ${info.size}`,
      `updatedAt: ${info.updatedAt}`
    ].join("\n"),
    info
  );
}

async function writeFileContent(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const mode = String(argumentsObject?.mode || "overwrite").trim();
  const createDirectories = Boolean(argumentsObject?.createDirectories);
  const content = argumentsObject?.content;
  assertTextContent(content);

  if (createDirectories) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
  }

  const alreadyExists = await pathExists(targetPath);

  if (mode === "create" && alreadyExists) {
    throw new Error("目标文件已存在，create 模式不允许覆盖");
  }

  if (mode === "append") {
    await fs.appendFile(targetPath, content, "utf8");
  } else {
    await fs.writeFile(targetPath, content, "utf8");
  }

  const finalStat = await fs.stat(targetPath);

  return buildTextResult(
    [
      `path: ${toRelativePath(targetPath)}`,
      `mode: ${mode}`,
      `size: ${finalStat.size}`,
      alreadyExists ? "status: updated" : "status: created"
    ].join("\n"),
    {
      path: toRelativePath(targetPath),
      mode,
      size: finalStat.size,
      status: alreadyExists ? "updated" : "created"
    }
  );
}

async function replaceInFile(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const findText = String(argumentsObject?.findText || "");
  const replaceText = String(argumentsObject?.replaceText || "");
  const replaceAll = Boolean(argumentsObject?.replaceAll);

  if (!findText) {
    throw new Error("replace_in_file 需要提供 findText");
  }

  const original = await fs.readFile(targetPath, "utf8");
  const occurrenceCount = original.split(findText).length - 1;

  if (!occurrenceCount) {
    throw new Error("未找到需要替换的文本");
  }

  const updated = replaceAll ? original.split(findText).join(replaceText) : original.replace(findText, replaceText);
  await fs.writeFile(targetPath, updated, "utf8");

  return buildTextResult(
    [
      `path: ${toRelativePath(targetPath)}`,
      `replaced: ${replaceAll ? occurrenceCount : 1}`,
      `mode: ${replaceAll ? "replace_all" : "replace_first"}`
    ].join("\n"),
    {
      path: toRelativePath(targetPath),
      replaced: replaceAll ? occurrenceCount : 1,
      mode: replaceAll ? "replace_all" : "replace_first"
    }
  );
}

async function createDirectory(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  await fs.mkdir(targetPath, { recursive: true });

  return buildTextResult(`directory created: ${toRelativePath(targetPath)}`, {
    path: toRelativePath(targetPath),
    created: true
  });
}

async function movePath(argumentsObject) {
  const fromPath = resolveWorkspacePath(argumentsObject?.fromPath);
  const toPath = resolveWorkspacePath(argumentsObject?.toPath);
  const createDirectories = Boolean(argumentsObject?.createDirectories);

  if (!(await pathExists(fromPath))) {
    throw new Error("源路径不存在");
  }

  if (createDirectories) {
    await fs.mkdir(path.dirname(toPath), { recursive: true });
  }

  await fs.rename(fromPath, toPath);

  return buildTextResult(
    [`from: ${toRelativePath(fromPath)}`, `to: ${toRelativePath(toPath)}`, "status: moved"].join("\n"),
    {
      fromPath: toRelativePath(fromPath),
      toPath: toRelativePath(toPath),
      moved: true
    }
  );
}

async function deletePath(argumentsObject) {
  const targetPath = resolveWorkspacePath(argumentsObject?.path);
  const recursive = Boolean(argumentsObject?.recursive);

  if (!(await pathExists(targetPath))) {
    throw new Error("目标路径不存在");
  }

  const stat = await fs.stat(targetPath);

  if (stat.isDirectory()) {
    await fs.rm(targetPath, { recursive, force: false });
  } else {
    await fs.unlink(targetPath);
  }

  return buildTextResult(`deleted: ${toRelativePath(targetPath)}`, {
    path: toRelativePath(targetPath),
    deleted: true,
    recursive
  });
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

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEB_SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function safeDecodeUrl(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSearchResult(title, url, snippet) {
  return {
    title: stripHtml(title),
    url: safeDecodeUrl(String(url || "").trim()),
    snippet: stripHtml(snippet)
  };
}

function extractGoogleResults(html) {
  const results = [];
  const pattern =
    /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>\s*(?:<br[^>]*>)?\s*<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>(?:[\s\S]{0,800}?<div[^>]*>([\s\S]{0,500}?)<\/div>)?/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < WEB_SEARCH_RESULT_LIMIT) {
    const result = normalizeSearchResult(match[2], match[1], match[3] || "");

    if (result.title && result.url) {
      results.push(result);
    }
  }

  return results;
}

function extractBingResults(html) {
  const results = [];
  const pattern =
    /<li class="b_algo"[\s\S]*?<h2><a href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a><\/h2>[\s\S]*?(?:<p>([\s\S]*?)<\/p>)?[\s\S]*?<\/li>/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < WEB_SEARCH_RESULT_LIMIT) {
    const result = normalizeSearchResult(match[2], match[1], match[3] || "");

    if (result.title && result.url) {
      results.push(result);
    }
  }

  return results;
}

function extractBaiduResults(html) {
  const results = [];
  const pattern =
    /<h3[^>]*class="[^"]*c-title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>[\s\S]*?(?:<span[^>]*class="[^"]*content-right[^"]*"[^>]*>|<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>|<div[^>]*class="[^"]*content-left_2s-H4[^"]*"[^>]*>)([\s\S]{0,500}?)(?:<\/span>|<\/div>)/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < WEB_SEARCH_RESULT_LIMIT) {
    const result = normalizeSearchResult(match[2], match[1], match[3] || "");

    if (result.title && result.url) {
      results.push(result);
    }
  }

  return results;
}

async function webSearch(argumentsObject) {
  const query = String(argumentsObject?.query || "").trim();
  const engine = String(argumentsObject?.engine || "google").trim().toLowerCase();

  if (!query) {
    throw new Error("web_search 需要提供 query");
  }

  const supportedEngines = new Set(["google", "bing", "baidu"]);

  if (!supportedEngines.has(engine)) {
    throw new Error("web_search 的 engine 仅支持 google、bing、baidu");
  }

  const encodedQuery = encodeURIComponent(query);
  const url =
    engine === "bing"
      ? `https://www.bing.com/search?q=${encodedQuery}`
      : engine === "baidu"
        ? `https://www.baidu.com/s?wd=${encodedQuery}`
        : `https://www.google.com/search?hl=zh-CN&q=${encodedQuery}`;

  const html = await fetchText(url);
  const results =
    engine === "bing" ? extractBingResults(html) : engine === "baidu" ? extractBaiduResults(html) : extractGoogleResults(html);

  return buildTextResult(
    results.length
      ? results
          .map((result, index) => [`${index + 1}. ${result.title}`, result.url, result.snippet].filter(Boolean).join("\n"))
          .join("\n\n")
      : "未解析到可用搜索结果",
    {
      engine,
      query,
      count: results.length,
      results
    }
  );
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
    },
    {
      name: "path_info",
      description: "查看指定路径是否存在、类型、大小和更新时间。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的路径"
          }
        }
      }
    },
    {
      name: "write_file",
      description: "创建、覆盖或追加文本文件内容。",
      inputSchema: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的文件路径"
          },
          content: {
            type: "string",
            description: "要写入的文本内容"
          },
          mode: {
            type: "string",
            description: "create、overwrite 或 append，默认 overwrite"
          },
          createDirectories: {
            type: "boolean",
            description: "是否自动创建上级目录"
          }
        }
      }
    },
    {
      name: "replace_in_file",
      description: "在指定文件中替换一段文本，适合小范围精确修改。",
      inputSchema: {
        type: "object",
        required: ["path", "findText", "replaceText"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的文件路径"
          },
          findText: {
            type: "string",
            description: "要查找的原始文本"
          },
          replaceText: {
            type: "string",
            description: "替换后的文本"
          },
          replaceAll: {
            type: "boolean",
            description: "是否替换所有匹配，默认 false"
          }
        }
      }
    },
    {
      name: "create_directory",
      description: "创建目录，支持递归创建父目录。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的目录路径"
          }
        }
      }
    },
    {
      name: "move_path",
      description: "移动或重命名文件、目录。",
      inputSchema: {
        type: "object",
        required: ["fromPath", "toPath"],
        properties: {
          fromPath: {
            type: "string",
            description: "源路径"
          },
          toPath: {
            type: "string",
            description: "目标路径"
          },
          createDirectories: {
            type: "boolean",
            description: "是否自动创建目标父目录"
          }
        }
      }
    },
    {
      name: "delete_path",
      description: "删除文件或目录；删除目录时可显式开启 recursive。",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "相对工作区根目录的目标路径"
          },
          recursive: {
            type: "boolean",
            description: "删除目录时是否递归删除"
          }
        }
      }
    },
    {
      name: "web_search",
      description: "通过 google、bing 或 baidu 做基础联网搜索，返回标题、链接和摘要。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description: "搜索关键词"
          },
          engine: {
            type: "string",
            description: "搜索引擎，可选 google、bing、baidu，默认 google"
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

    if (toolName === "path_info") {
      ok(id, await getPathInfo(argumentsObject));
      return;
    }

    if (toolName === "write_file") {
      ok(id, await writeFileContent(argumentsObject));
      return;
    }

    if (toolName === "replace_in_file") {
      ok(id, await replaceInFile(argumentsObject));
      return;
    }

    if (toolName === "create_directory") {
      ok(id, await createDirectory(argumentsObject));
      return;
    }

    if (toolName === "move_path") {
      ok(id, await movePath(argumentsObject));
      return;
    }

    if (toolName === "delete_path") {
      ok(id, await deletePath(argumentsObject));
      return;
    }

    if (toolName === "web_search") {
      ok(id, await webSearch(argumentsObject));
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

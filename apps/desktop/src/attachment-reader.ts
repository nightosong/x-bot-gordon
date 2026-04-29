import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import mammoth from "mammoth";
import { XMLParser } from "fast-xml-parser";
import XLSX from "xlsx";

import type { CommandWorkshopAttachment, CommandWorkshopAttachmentKind } from "../../../packages/shared/src/index.js";

const MAX_EXTRACTED_TEXT_LENGTH = 80_000;
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl", ".xml", ".yaml", ".yml", ".log", ".html", ".css", ".js", ".ts"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tiff"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"]);
const DATA_EXTENSIONS = new Set([".csv", ".tsv", ".json", ".jsonl", ".xml", ".yaml", ".yml"]);
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".docx", ".pptx"]);
const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xls", ".xlsm", ".csv", ".tsv"]);

function truncateExtractedText(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();

  if (normalized.length <= MAX_EXTRACTED_TEXT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_EXTRACTED_TEXT_LENGTH)}\n\n[内容过长，已截断至 ${MAX_EXTRACTED_TEXT_LENGTH} 字符]`;
}

function inferAttachmentKind(extension: string): CommandWorkshopAttachmentKind {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return "spreadsheet";
  }

  if (DATA_EXTENSIONS.has(extension)) {
    return "data";
  }

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return "document";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  return "other";
}

function inferMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    ".csv": "text/csv",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".gif": "image/gif",
    ".html": "text/html",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".json": "application/json",
    ".md": "text/markdown",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".svg": "image/svg+xml",
    ".tsv": "text/tab-separated-values",
    ".txt": "text/plain",
    ".webp": "image/webp",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xml": "application/xml",
    ".yaml": "application/yaml",
    ".yml": "application/yaml"
  };

  return mimeTypes[extension] ?? "application/octet-stream";
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function collectXmlTextNodes(input: unknown, targetKey: string, output: string[] = []): string[] {
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return output;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => collectXmlTextNodes(item, targetKey, output));
    return output;
  }

  if (!input || typeof input !== "object") {
    return output;
  }

  for (const [key, value] of Object.entries(input)) {
    if (key === targetKey) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string" || typeof item === "number") {
            output.push(String(item));
          } else {
            collectXmlTextNodes(item, "#text", output);
          }
        });
      } else if (typeof value === "string" || typeof value === "number") {
        output.push(String(value));
      } else {
        collectXmlTextNodes(value, "#text", output);
      }
      continue;
    }

    collectXmlTextNodes(value, targetKey, output);
  }

  return output;
}

async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text ?? "";
}

async function extractPptxText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.values(zip.files)
    .filter((file) => /^ppt\/slides\/slide\d+\.xml$/i.test(file.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  const parser = new XMLParser({
    ignoreAttributes: true,
    textNodeName: "#text"
  });
  const slideTexts: string[] = [];

  for (const [index, file] of slideFiles.entries()) {
    const xml = await file.async("text");
    const parsed = parser.parse(xml);
    const text = collectXmlTextNodes(parsed, "a:t")
      .map((value) => decodeXmlText(value).trim())
      .filter(Boolean)
      .join("\n");

    if (text) {
      slideTexts.push(`Slide ${index + 1}\n${text}`);
    }
  }

  return slideTexts.join("\n\n");
}

function extractWorkbookText(filePath: string): string {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
    return csv.trim() ? `Sheet: ${sheetName}\n${csv.trim()}` : "";
  }).filter(Boolean);

  return sheets.join("\n\n");
}

async function extractAttachmentText(filePath: string, extension: string): Promise<string | null> {
  if (TEXT_EXTENSIONS.has(extension)) {
    const buffer = await readFile(filePath);
    return TEXT_DECODER.decode(buffer);
  }

  if (extension === ".pdf") {
    return extractPdfText(filePath);
  }

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (extension === ".pptx") {
    return extractPptxText(filePath);
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return extractWorkbookText(filePath);
  }

  return null;
}

export async function readCommandWorkshopAttachment(filePath: string): Promise<CommandWorkshopAttachment> {
  const fileStat = await stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const baseAttachment = {
    id: `command_attachment_${randomUUID()}`,
    name: path.basename(filePath),
    path: filePath,
    mimeType: inferMimeType(extension),
    extension,
    sizeBytes: fileStat.size,
    kind: inferAttachmentKind(extension)
  };

  try {
    const extractedText = await extractAttachmentText(filePath, extension);

    if (extractedText === null) {
      return {
        ...baseAttachment,
        readStatus: IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension) ? "binary" : "unsupported"
      };
    }

    return {
      ...baseAttachment,
      readStatus: "readable",
      extractedText: truncateExtractedText(extractedText)
    };
  } catch (error) {
    return {
      ...baseAttachment,
      readStatus: "error",
      errorMessage: error instanceof Error ? error.message : "未知读取错误"
    };
  }
}

import { buildCommandWorkshopArtifact } from "../../lib/presenter.js";

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function buildCommandWorkshopLiveArtifact(progress) {
  return buildCommandWorkshopArtifact({
    profileLabel: progress?.profileLabel ?? "",
    model: progress?.model ?? "",
    skillName: progress?.skillName ?? null,
    autoSelectedMcp: Boolean(progress?.autoSelectedMcp),
    mcpServerName: progress?.mcpServerName ?? null,
    mcpToolName: progress?.mcpToolName ?? null,
    mcpResultText: progress?.mcpResultText ?? null,
    mcpCalls: [...(progress?.mcpCalls ?? [])],
    stopReason: progress?.stopReason ?? "",
    steps: [...(progress?.steps ?? [])],
    createdAt: progress?.createdAt ?? new Date().toISOString()
  });
}

export function getCommandAttachmentTitle(attachment) {
  const sizeKb = Math.max(1, Math.round((attachment?.sizeBytes ?? 0) / 1024));
  const statusText =
    {
      readable: "已读取正文",
      binary: "二进制附件",
      unsupported: "暂不支持正文读取",
      error: attachment?.errorMessage ? `读取失败：${attachment.errorMessage}` : "读取失败"
    }[attachment?.readStatus] ?? "附件";

  return `${attachment?.name ?? "附件"} · ${sizeKb} KB · ${statusText}`;
}

export function buildCommandAttachmentContext(attachments) {
  const normalizedAttachments = normalizeList(attachments);

  if (!normalizedAttachments.length) {
    return "";
  }

  return normalizedAttachments
    .map((attachment, index) => {
      const header = `附件 ${index + 1}: ${attachment?.name ?? "未命名附件"}
路径: ${attachment?.path ?? ""}
类型: ${attachment?.mimeType || attachment?.extension || "unknown"}
读取状态: ${attachment?.readStatus ?? "unknown"}`;

      if (attachment?.extractedText?.trim()) {
        return `${header}
正文:
${attachment.extractedText.trim()}`;
      }

      if (attachment?.errorMessage) {
        return `${header}
读取错误: ${attachment.errorMessage}`;
      }

      return `${header}
说明: 该文件已作为附件传入，但当前没有可注入模型的文本正文。`;
    })
    .join("\n\n");
}

export function buildCommandUserInputForAgent(content, attachments) {
  const attachmentContext = buildCommandAttachmentContext(attachments);

  if (!attachmentContext) {
    return content;
  }

  return `${content || "请阅读并处理我上传的附件。"}

以下是本轮上传附件的后台读取结果：
${attachmentContext}`;
}

export function buildConversationMessagesForAgentRun(messages) {
  return normalizeList(messages)
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => ({
      role: message.role,
      content:
        message.role === "user"
          ? buildCommandUserInputForAgent(message.content, message.attachments ?? [])
          : message.content
    }));
}

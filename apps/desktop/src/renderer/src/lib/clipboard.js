export async function copyTextToClipboard(value) {
  const text = String(value ?? "");

  if (!text) {
    throw new Error("没有可复制的内容");
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("当前环境不支持剪贴板复制");
  }
}

export async function copyRichTextToClipboard({ html, text }) {
  const normalizedHtml = String(html ?? "").trim();
  const normalizedText = String(text ?? "").trim();

  if (!normalizedHtml && !normalizedText) {
    throw new Error("没有可复制的内容");
  }

  const ClipboardItemCtor = globalThis.ClipboardItem;

  if (navigator.clipboard?.write && ClipboardItemCtor && normalizedHtml) {
    try {
      await navigator.clipboard.write([
        new ClipboardItemCtor({
          "text/html": new Blob([`<!doctype html><html><head><meta charset="utf-8"></head><body>${normalizedHtml}</body></html>`], {
            type: "text/html"
          }),
          "text/plain": new Blob([normalizedText || normalizedHtml], { type: "text/plain" })
        })
      ]);
      return "html";
    } catch (error) {
      if (!normalizedText) {
        throw error;
      }
    }
  }

  await copyTextToClipboard(normalizedText || normalizedHtml);
  return "text";
}

export function createRichTextClickHandler({ setStatus }) {
  return async function handleRichTextClick(event) {
    const target = event.target instanceof Element ? event.target.closest("[data-command-copy-code]") : null;

    if (!target) {
      return;
    }

    const codeElement = target.closest(".command-code-block")?.querySelector("code");
    const content = codeElement?.textContent ?? "";

    if (!content) {
      return;
    }

    try {
      await copyTextToClipboard(content);
      setStatus("代码已复制。", "success");
    } catch (error) {
      setStatus(`复制失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  };
}

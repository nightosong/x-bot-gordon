import { reactive } from "vue";

function createGordonDialogState() {
  return {
    open: false,
    kind: "alert",
    tone: "neutral",
    title: "",
    message: "",
    detailLines: [],
    inputLabel: "名称",
    inputValue: "",
    inputPlaceholder: "",
    confirmText: "确认",
    cancelText: "取消",
    resolve: null
  };
}

function normalizeGordonDialogDetail(detail) {
  if (Array.isArray(detail)) {
    return detail.map((line) => String(line ?? "").trim()).filter(Boolean);
  }

  const normalized = String(detail ?? "").trim();
  return normalized ? [normalized] : [];
}

export function useGordonDialog() {
  const dialog = reactive(createGordonDialogState());

  function resetGordonDialog() {
    Object.assign(dialog, createGordonDialogState());
  }

  function openGordonDialog(options = {}) {
    if (typeof dialog.resolve === "function") {
      dialog.resolve(false);
    }

    return new Promise((resolve) => {
      Object.assign(dialog, {
        ...createGordonDialogState(),
        open: true,
        kind: options.kind ?? "alert",
        tone: options.tone ?? "neutral",
        title: String(options.title ?? "Gordon"),
        message: String(options.message ?? ""),
        detailLines: normalizeGordonDialogDetail(options.detail),
        inputLabel: String(options.inputLabel ?? "名称"),
        inputValue: String(options.inputValue ?? ""),
        inputPlaceholder: String(options.inputPlaceholder ?? ""),
        confirmText: String(options.confirmText ?? (options.kind === "confirm" ? "确认" : "知道了")),
        cancelText: String(options.cancelText ?? "取消"),
        resolve
      });
    });
  }

  function showConfirmDialog(options = {}) {
    return openGordonDialog({
      kind: "confirm",
      tone: options.tone ?? "warning",
      confirmText: options.confirmText ?? "确认",
      cancelText: options.cancelText ?? "取消",
      ...options
    });
  }

  function showAlertDialog(options = {}) {
    return openGordonDialog({
      kind: "alert",
      tone: options.tone ?? "warning",
      confirmText: options.confirmText ?? "知道了",
      ...options
    });
  }

  function showInputDialog(options = {}) {
    return openGordonDialog({
      kind: "input",
      tone: options.tone ?? "neutral",
      confirmText: options.confirmText ?? "确认",
      cancelText: options.cancelText ?? "取消",
      ...options
    });
  }

  function resolveGordonDialog(confirmed) {
    const resolver = dialog.resolve;
    const kind = dialog.kind;
    const inputValue = dialog.inputValue;
    resetGordonDialog();

    if (typeof resolver === "function") {
      if (kind === "alert") {
        resolver(true);
      } else if (kind === "input") {
        resolver(confirmed ? inputValue : null);
      } else {
        resolver(Boolean(confirmed));
      }
    }
  }

  function handleGordonDialogBackdrop() {
    if (dialog.kind === "alert") {
      resolveGordonDialog(true);
    }
  }

  function handleGordonDialogKeydown(event) {
    if (!dialog.open || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    resolveGordonDialog(false);
  }

  return {
    dialog,
    handleGordonDialogBackdrop,
    handleGordonDialogKeydown,
    resolveGordonDialog,
    showAlertDialog,
    showConfirmDialog,
    showInputDialog
  };
}

import { app, BrowserView, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

import { callToolOnMcpServer, listToolsFromMcpServer, runAgent } from "../../../packages/agent/src/index.js";
import { buildWorkbenchSnapshot } from "../../../packages/core/src/index.js";
import { isPromptAssetId, readPromptAsset, type PromptAssetId } from "../../../packages/workbench/src/prompt-assets.js";
import {
  deleteAgentProfile,
  deleteComicProject,
  deleteCommandWorkshopSession,
  deleteMcpServer,
  deleteMusicProject,
  deleteVideoProject,
  activateModelProfile,
  deleteModelProfile,
  deleteSkillDefinition,
  deleteWeeklyProgress,
  deleteWritingBook,
  getWeeklyFeishuSettings,
  importSkillDefinitionFromGithub,
  listAgentProfiles,
  listCommandWorkshopSessions,
  listComicProjects,
  listMusicProjects,
  listModelBalanceHistory,
  listMcpServers,
  listSkillDefinitions,
  listToolConfigs,
  listWeeklyProgress,
  listVideoProjects,
  listWritingBooks,
  listWorkflowLibrary,
  listModelSettings,
  reorderModelProfiles,
  saveWeeklyFeishuSettings,
  saveWritingBook,
  saveWeeklyProgress,
  toggleAgentProfileStatus,
  toggleMcpServerStatus,
  toggleModelProfileStatus,
  toggleSkillDefinitionStatus,
  toggleToolConfigStatus,
  upsertAgentProfile,
  upsertCommandWorkshopSession,
  upsertComicProject,
  upsertMusicProject,
  upsertVideoProject,
  upsertWorkflowLibraryItem,
  upsertMcpServer,
  upsertModelProfile,
  upsertSkillDefinition,
  upsertToolConfig
} from "../../../packages/workbench/src/index.js";
import type {
  AgentRuntimeGuidance,
  AgentRunProgressEvent,
  ApplicationCoverImageSaveRequest,
  CommandWorkshopMessageExportFormat,
  CommandWorkshopMessageExportRequest,
  ComicProjectExportFormat,
  ComicProjectExportRequest,
  FinanceBriefDerivedMetric,
  FinanceBriefInterval,
  FinanceBriefQuoteRequest,
  FinanceBriefQuoteSnapshot,
  FinanceBriefRange,
  FinanceBriefSnapshot,
  FinanceBriefSymbol,
  InfoRadarItem,
  InfoRadarRefreshResult,
  InfoRadarRefreshRun,
  InfoRadarSource,
  InfoRadarWindow,
  MusicProjectExportFormat,
  MusicProjectExportRequest,
  MusicProject,
  WeeklyDailyReportFeishuSendRequest,
  WeeklyDailyReportFeishuSendResult,
  WeeklyFeishuSettings,
  WeeklyProgressProjectItem,
  WeeklyProgressRecord,
  WeeklyProgressTaskItem,
  VideoProjectExportFormat,
  VideoProjectExportRequest,
  WritingBookExportFormat,
  WritingBookExportRequest
} from "../../../packages/shared/src/index.js";
import { ensureGordonHomeDirectory } from "../../../packages/shared/src/index.js";
import { readCommandWorkshopAttachment } from "./attachment-reader.js";
import {
  generateDailyProgressReport,
  generatePerformanceProgressReport,
  generateWeeklyProgressReport,
  invokeActiveModel,
  rewriteWeeklyProgressItem
} from "./ai.js";
import { queryModelBalance } from "./model-balance.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const desktopAssetDir = path.resolve(currentDir, "..", "assets");
const appIconFileName = process.platform === "win32" ? "gordon.ico" : "gordon.icns";
const appIconPath = path.join(desktopAssetDir, appIconFileName);
const modelTextAbortControllers = new Map<string, AbortController>();
const agentRunAbortControllers = new Map<string, AbortController>();
const agentRunGuidanceQueues = new Map<string, AgentRuntimeGuidance[]>();
const infoRadarReaderViews = new Map<number, InfoRadarNativeReaderView>();
const liveStreamViews = new Map<number, LiveStreamNativeView>();
const MAIN_WINDOW_MIN_WIDTH = 1180;
const MAIN_WINDOW_MIN_HEIGHT = 760;
const LIVE_STREAM_SESSION_PARTITION = "persist:gordon-live-stream";
const MODEL_BALANCE_POLL_INTERVAL_MS = 60 * 60 * 1000;
const MODEL_BALANCE_INITIAL_POLL_DELAY_MS = 60 * 1000;
const WEEKLY_AUTO_DAILY_REPORT_CHECK_INTERVAL_MS = 60 * 1000;
const WEEKLY_AUTO_DAILY_REPORT_DEFAULT_TIME = "18:30";
const WEEKLY_AUTO_DAILY_REPORT_TIMEZONE = "Asia/Shanghai";
let modelBalancePollingTimer: NodeJS.Timeout | null = null;
let modelBalancePollingInFlight = false;
let weeklyAutoDailyReportTimer: NodeJS.Timeout | null = null;
let weeklyAutoDailyReportInFlight = false;
const FEISHU_DAILY_REPORT_CONTENT_LIMIT = 15000;
const FEISHU_DAILY_REPORT_MARKDOWN_TEXT_SIZE = "normal_v2";

function configureChromiumNativeLogging(): void {
  const configuredLogLevel = String(process.env.GORDON_CHROMIUM_LOG_LEVEL ?? "3").trim();
  const logLevel = /^(?:0|1|2|3)$/.test(configuredLogLevel) ? configuredLogLevel : "3";
  const disableLogging = process.env.GORDON_CHROMIUM_DISABLE_LOGGING !== "0";

  app.commandLine.appendSwitch("log-level", logLevel);

  if (disableLogging) {
    app.commandLine.appendSwitch("disable-logging");
  }
}

configureChromiumNativeLogging();

type GordonConfirmWindowTone = "neutral" | "warning" | "danger";

type InfoRadarNativeReaderBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type InfoRadarNativeReaderView =
  {
    ownerWindow: BrowserWindow;
    view: BrowserView;
    bounds: InfoRadarNativeReaderBounds | null;
    visible: boolean;
  };

type LiveStreamNativeView = InfoRadarNativeReaderView;

const BILIBILI_LIVE_THEATER_CSS = `
html.gordon-live-theater,
html.gordon-live-theater body {
  width: 100vw !important;
  height: 100vh !important;
  min-width: 100vw !important;
  min-height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
}

html.gordon-live-auth,
html.gordon-live-auth body {
  width: auto !important;
  height: auto !important;
  min-width: 100vw !important;
  min-height: 100vh !important;
  overflow: auto !important;
  background: #000 !important;
}

body.gordon-live-auth {
  position: static !important;
}

body.gordon-live-auth .bili-mini-login,
body.gordon-live-auth .bili-mini-mask,
body.gordon-live-auth .login-panel-popover,
body.gordon-live-auth .login-panel,
body.gordon-live-auth .login-dialog,
body.gordon-live-auth .login-box,
body.gordon-live-auth .passport-login,
body.gordon-live-auth .qrcode-login,
body.gordon-live-auth .qrcode-img,
body.gordon-live-auth .qr-code,
body.gordon-live-auth .geetest_panel,
body.gordon-live-auth [class*="qrcode"],
body.gordon-live-auth [class*="qr-code"],
body.gordon-live-auth [class*="passport"] {
  z-index: 2147483647 !important;
}

body.gordon-live-theater {
  position: fixed !important;
  inset: 0 !important;
}

body.gordon-live-theater::-webkit-scrollbar,
body.gordon-live-theater *::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
}

body.gordon-live-theater header,
body.gordon-live-theater nav,
body.gordon-live-theater footer,
body.gordon-live-theater .room-info,
body.gordon-live-theater .room-info-cntr,
body.gordon-live-theater .room-info-ctnr,
body.gordon-live-theater .room-info-section,
body.gordon-live-theater .chat-history-panel,
body.gordon-live-theater .chat-panel,
body.gordon-live-theater .gift-panel,
body.gordon-live-theater .rank-list,
body.gordon-live-theater .activity-section,
body.gordon-live-theater .recommend-list,
body.gordon-live-theater .live-sidebar,
body.gordon-live-theater .side-bar,
body.gordon-live-theater .aside-area,
body.gordon-live-theater .anchor-info,
body.gordon-live-theater .room-feed,
body.gordon-live-theater .fans-medal,
body.gordon-live-theater .link-footer,
body.gordon-live-theater .bili-header,
body.gordon-live-theater .bili-footer,
body.gordon-live-theater .live-room-app > aside {
  display: none !important;
}

body.gordon-live-theater .gordon-live-purified-hidden {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

body.gordon-live-theater .gordon-live-player-shell {
  visibility: visible !important;
  opacity: 1 !important;
  transform: none !important;
  contain: none !important;
  overflow: visible !important;
  background: #000 !important;
}

body.gordon-live-theater .gordon-live-player-root {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483000 !important;
  width: 100vw !important;
  height: 100vh !important;
  min-width: 100vw !important;
  min-height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  transform: none !important;
  overflow: hidden !important;
  background: #000 !important;
  box-shadow: none !important;
}

body.gordon-live-theater .gordon-live-player-root video,
body.gordon-live-theater .gordon-live-player-root canvas,
body.gordon-live-theater video.gordon-live-player-root {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  background: #000 !important;
}

body.gordon-live-theater .gordon-live-player-root iframe,
body.gordon-live-theater .gordon-live-player-root embed,
body.gordon-live-theater .gordon-live-player-root object {
  width: 100% !important;
  height: 100% !important;
}
`;

function normalizeInfoRadarNativeReaderUrl(url: unknown): string {
  const normalizedUrl = typeof url === "string" ? url.trim() : "";

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error("来源链接必须是 http 或 https 地址");
  }

  return normalizedUrl;
}

function normalizeInfoRadarNativeReaderBounds(bounds: unknown): InfoRadarNativeReaderBounds {
  const rawBounds = bounds && typeof bounds === "object" ? bounds as Partial<InfoRadarNativeReaderBounds> : {};
  const x = Math.max(0, Math.round(Number(rawBounds.x ?? 0)));
  const y = Math.max(0, Math.round(Number(rawBounds.y ?? 0)));
  const width = Math.max(0, Math.round(Number(rawBounds.width ?? 0)));
  const height = Math.max(0, Math.round(Number(rawBounds.height ?? 0)));

  return { x, y, width, height };
}

function getInfoRadarNativeReaderWebContents(readerView: InfoRadarNativeReaderView): Electron.WebContents {
  return readerView.view.webContents;
}

function setInfoRadarNativeReaderBounds(readerView: InfoRadarNativeReaderView, bounds: InfoRadarNativeReaderBounds): void {
  if (readerView.ownerWindow.isDestroyed()) {
    return;
  }

  if (bounds.width < 120 || bounds.height < 120) {
    return;
  }

  const safeBounds = {
    ...bounds,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height)
  };

  readerView.view.setBounds(safeBounds);
  readerView.bounds = safeBounds;
}

function showInfoRadarNativeReaderView(readerView: InfoRadarNativeReaderView): void {
  if (readerView.visible || readerView.ownerWindow.isDestroyed()) {
    return;
  }

  readerView.ownerWindow.setBrowserView(readerView.view);
  readerView.visible = true;
}

function hideInfoRadarNativeReaderView(readerView: InfoRadarNativeReaderView): void {
  if (!readerView.visible || readerView.ownerWindow.isDestroyed()) {
    readerView.visible = false;
    return;
  }

  readerView.ownerWindow.setBrowserView(null);
  readerView.visible = false;
}

function sendInfoRadarNativeReaderEvent(
  ownerWindow: BrowserWindow,
  payload: { status: "loading" | "ready" | "failed"; url?: string; message?: string }
): void {
  if (ownerWindow.isDestroyed() || ownerWindow.webContents.isDestroyed()) {
    return;
  }

  ownerWindow.webContents.send("gordon:workflow-library:info-reader", payload);
}

function sendLiveStreamNativeViewEvent(
  ownerWindow: BrowserWindow,
  payload: { status: "loading" | "ready" | "failed"; url?: string; message?: string }
): void {
  if (ownerWindow.isDestroyed() || ownerWindow.webContents.isDestroyed()) {
    return;
  }

  ownerWindow.webContents.send("gordon:workflow-library:live-stream", payload);
}

function shouldApplyBilibiliLiveTheaterMode(rawUrl: string): boolean {
  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }

    if (parsedUrl.hostname !== "live.bilibili.com") {
      return false;
    }

    const pathname = parsedUrl.pathname.replace(/\/+$/g, "");
    return pathname === "" || /^\/(?:blanc\/)?\d+$/i.test(pathname) || pathname.startsWith("/blanc/");
  } catch {
    return false;
  }
}

function isBilibiliAuthUrl(rawUrl: string): boolean {
  try {
    const parsedUrl = new URL(rawUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    if (hostname === "passport.bilibili.com") {
      return true;
    }

    if (hostname === "account.bilibili.com") {
      return true;
    }

    if (!hostname.endsWith(".bilibili.com") && hostname !== "bilibili.com") {
      return false;
    }

    return /login|passport|oauth|account/.test(pathname);
  } catch {
    return false;
  }
}

function createBilibiliLiveTheaterScript(): string {
  return `
(() => {
  const css = ${JSON.stringify(BILIBILI_LIVE_THEATER_CSS)};
  const styleId = "gordon-live-theater-style";
  const pageRootClass = "gordon-live-theater";
  const authRootClass = "gordon-live-auth";
  const playerRootClass = "gordon-live-player-root";
  const hiddenClass = "gordon-live-purified-hidden";
  const playerShellClass = "gordon-live-player-shell";
  const playerSelector = [
    "#live-player",
    ".bilibili-live-player",
    ".web-player",
    ".live-player",
    ".live-player-ctnr",
    ".live-player-mounter",
    ".player-section",
    ".player-ctnr",
    ".player-wrapper",
    ".player-area",
    ".room-player-wrapper",
    ".live-room-player",
    ".bpx-player-container",
    ".bpx-player-primary-area",
    ".bpx-player-video-area",
    ".bpx-player-video-wrap"
  ].join(",");
  const authSelector = [
    ".bili-mini-login",
    ".bili-mini-mask",
    ".login-panel-popover",
    ".login-panel",
    ".login-dialog",
    ".login-box",
    ".login-container",
    ".passport-login",
    ".qrcode-login",
    ".qrcode-img",
    ".qr-code",
    ".geetest_panel",
    ".geetest_panel_box",
    "[class*='qrcode']",
    "[class*='qr-code']",
    "[class*='passport']"
  ].join(",");

  const installStyle = () => {
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    if (style.textContent !== css) {
      style.textContent = css;
    }
  };

  const isUsable = (element) => {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const opacity = Number(style.opacity || "1");
    return rect.width >= 160 && rect.height >= 90 && style.display !== "none" && style.visibility !== "hidden" && opacity > 0.01;
  };

  const isVisibleAuthElement = (element) => {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const opacity = Number(style.opacity || "1");
    return rect.width >= 48 && rect.height >= 48 && style.display !== "none" && style.visibility !== "hidden" && opacity > 0.01;
  };

  const areaOf = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  };

  const pickLargest = (elements) => {
    return elements
      .filter(isUsable)
      .sort((left, right) => areaOf(right) - areaOf(left))[0] || null;
  };

  const looksLikePlayer = (element) => {
    const identity = String(element.id || "") + " " + String(element.className || "");
    return /player|video|live|bpx/i.test(identity);
  };

  const looksLikeAuthSurface = (element) => {
    const identity = (String(element.id || "") + " " + String(element.className || "")).toLowerCase();
    return /qrcode|qr-code|passport|mini-login|login-panel|login-dialog|login-box|login-container|geetest|captcha/.test(identity);
  };

  const hasAuthVisual = (element) => {
    if (element.querySelector("canvas, svg")) {
      return true;
    }

    const images = Array.from(element.querySelectorAll("img"));
    return images.some((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width >= 80 && rect.height >= 80;
    });
  };

  const hasVisibleAuthSurface = () => {
    const directMatches = Array.from(document.querySelectorAll(authSelector));

    if (directMatches.some((element) => isVisibleAuthElement(element) && (areaOf(element) >= 4800 || hasAuthVisual(element)))) {
      return true;
    }

    const genericMatches = Array.from(document.querySelectorAll("[id],[class]"));
    return genericMatches.some((element) => {
      if (!looksLikeAuthSurface(element) || !isVisibleAuthElement(element)) {
        return false;
      }

      return areaOf(element) >= 4800 || hasAuthVisual(element);
    });
  };

  const findPlayerRoot = () => {
    const video = pickLargest(Array.from(document.querySelectorAll("video")));

    if (video) {
      const closestPlayer = video.closest(playerSelector);

      if (closestPlayer && isUsable(closestPlayer)) {
        return closestPlayer;
      }

      const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
      let best = video;
      let node = video.parentElement;

      while (node && node !== document.body && node !== document.documentElement) {
        if (isUsable(node)) {
          const nodeArea = areaOf(node);

          if (looksLikePlayer(node) || nodeArea <= viewportArea * 1.12) {
            best = node;
          }
        }

        node = node.parentElement;
      }

      return best;
    }

    return pickLargest(Array.from(document.querySelectorAll(playerSelector)));
  };

  const clearPreviousPlayerRoot = (activeRoot) => {
    document.querySelectorAll("." + playerRootClass).forEach((element) => {
      if (element === activeRoot) {
        return;
      }

      element.classList.remove(playerRootClass);
      element.removeAttribute("data-gordon-live-theater");
    });
  };

  const clearPurifiedLayout = () => {
    document.querySelectorAll("." + hiddenClass).forEach((element) => {
      element.classList.remove(hiddenClass);
      element.removeAttribute("data-gordon-live-purified");
    });

    document.querySelectorAll("." + playerShellClass).forEach((element) => {
      element.classList.remove(playerShellClass);
    });
  };

  const shouldPreservePageElement = (element, playerRoot) => {
    if (!element || !(element instanceof Element)) {
      return true;
    }

    if (element === playerRoot || element.contains(playerRoot) || playerRoot.contains(element)) {
      return true;
    }

    if (looksLikeAuthSurface(element) || element.querySelector(authSelector)) {
      return true;
    }

    const tagName = element.tagName.toLowerCase();
    return tagName === "script" || tagName === "style" || tagName === "link" || tagName === "meta" || tagName === "noscript";
  };

  const hideNonPlayerSibling = (element, playerRoot) => {
    if (shouldPreservePageElement(element, playerRoot)) {
      return;
    }

    element.classList.add(hiddenClass);
    element.setAttribute("data-gordon-live-purified", "true");
  };

  const purifyAroundPlayer = (playerRoot) => {
    if (!playerRoot || !(playerRoot instanceof Element)) {
      return;
    }

    let activeBranch = playerRoot;
    let parent = activeBranch.parentElement;
    let depth = 0;

    while (parent && parent !== document.body && parent !== document.documentElement && depth < 10) {
      parent.classList.add(playerShellClass);
      Array.from(parent.children).forEach((child) => {
        if (child === activeBranch || child.contains(activeBranch)) {
          return;
        }

        hideNonPlayerSibling(child, playerRoot);
      });

      activeBranch = parent;
      parent = activeBranch.parentElement;
      depth += 1;
    }

    if (document.body) {
      Array.from(document.body.children).forEach((child) => {
        if (child === activeBranch || child.contains(activeBranch) || activeBranch.contains(child)) {
          return;
        }

        hideNonPlayerSibling(child, playerRoot);
      });
    }
  };

  const clearTheaterMode = () => {
    document.documentElement.classList.remove(pageRootClass);

    if (document.body) {
      document.body.classList.remove(pageRootClass);
    }

    clearPurifiedLayout();
    clearPreviousPlayerRoot(null);
  };

  const apply = () => {
    installStyle();
    clearPurifiedLayout();

    if (hasVisibleAuthSurface()) {
      clearTheaterMode();
      document.documentElement.classList.add(authRootClass);

      if (document.body) {
        document.body.classList.add(authRootClass);
      }

      window.__gordonLiveTheaterState = "auth";
      return false;
    }

    document.documentElement.classList.remove(authRootClass);

    if (document.body) {
      document.body.classList.remove(authRootClass);
    }

    document.documentElement.classList.add(pageRootClass);

    if (document.body) {
      document.body.classList.add(pageRootClass);
    }

    const playerRoot = findPlayerRoot();

    if (!playerRoot) {
      return false;
    }

    clearPreviousPlayerRoot(playerRoot);

    if (!playerRoot.classList.contains(playerRootClass)) {
      playerRoot.classList.add(playerRootClass);
    }

    playerRoot.setAttribute("data-gordon-live-theater", "true");
    purifyAroundPlayer(playerRoot);
    window.__gordonLiveTheaterState = "theater";
    return true;
  };

  window.__gordonApplyLiveTheater = apply;
  apply();

  if (!window.__gordonLiveTheaterObserver && document.body) {
    let pendingTimer = 0;
    const scheduleApply = () => {
      window.clearTimeout(pendingTimer);
      pendingTimer = window.setTimeout(apply, 120);
    };
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.__gordonLiveTheaterObserver = observer;
  }
})();
`;
}

async function applyBilibiliLiveTheaterMode(webContents: Electron.WebContents, requestedUrl: string): Promise<void> {
  if (webContents.isDestroyed()) {
    return;
  }

  const currentUrl = webContents.getURL() || requestedUrl;

  if (isBilibiliAuthUrl(currentUrl)) {
    return;
  }

  if (!shouldApplyBilibiliLiveTheaterMode(currentUrl)) {
    return;
  }

  try {
    await webContents.executeJavaScript(createBilibiliLiveTheaterScript(), true);
  } catch (error) {
    console.warn("[live-stream] Failed to apply Bilibili theater mode:", error);
  }
}

function flushLiveStreamNativeViewStorage(webContents: Electron.WebContents): void {
  try {
    webContents.session.flushStorageData();
  } catch (error) {
    console.warn("[live-stream] Failed to request live stream storage flush:", error);
  }
}

function detachInfoRadarNativeReaderView(ownerWindow: BrowserWindow): void {
  const windowId = ownerWindow.id;
  const existingView = infoRadarReaderViews.get(windowId);

  if (!existingView) {
    return;
  }

  try {
    if (!ownerWindow.isDestroyed()) {
      hideInfoRadarNativeReaderView(existingView);
    }
  } catch (error) {
    console.warn("[info-radar-reader] Failed to detach native reader view:", error);
  }

  try {
    const webContents = getInfoRadarNativeReaderWebContents(existingView);

    if (!webContents.isDestroyed()) {
      webContents.close();
    }
  } catch (error) {
    console.warn("[info-radar-reader] Failed to close native reader webContents:", error);
  }

  infoRadarReaderViews.delete(windowId);
}

function detachLiveStreamNativeView(ownerWindow: BrowserWindow): void {
  const windowId = ownerWindow.id;
  const existingView = liveStreamViews.get(windowId);

  if (!existingView) {
    return;
  }

  try {
    if (!ownerWindow.isDestroyed()) {
      hideInfoRadarNativeReaderView(existingView);
    }
  } catch (error) {
    console.warn("[live-stream] Failed to detach native live view:", error);
  }

  try {
    const webContents = getInfoRadarNativeReaderWebContents(existingView);

    if (!webContents.isDestroyed()) {
      webContents.close();
    }
  } catch (error) {
    console.warn("[live-stream] Failed to close native live webContents:", error);
  }

  liveStreamViews.delete(windowId);
}

function createInfoRadarNativeReaderView(ownerWindow: BrowserWindow): InfoRadarNativeReaderView {
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "persist:gordon-info-radar"
    }
  });
  view.setBackgroundColor("#0b111c");
  return { ownerWindow, view, bounds: null, visible: false };
}

function createLiveStreamNativeView(ownerWindow: BrowserWindow): LiveStreamNativeView {
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: LIVE_STREAM_SESSION_PARTITION
    }
  });
  view.setBackgroundColor("#050a11");
  return { ownerWindow, view, bounds: null, visible: false };
}

async function openInfoRadarNativeReader(
  ownerWindow: BrowserWindow,
  url: string,
  bounds: InfoRadarNativeReaderBounds
): Promise<void> {
  detachLiveStreamNativeView(ownerWindow);
  detachInfoRadarNativeReaderView(ownerWindow);

  const readerView = createInfoRadarNativeReaderView(ownerWindow);
  const webContents = getInfoRadarNativeReaderWebContents(readerView);
  webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    void shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  webContents.on("will-navigate", (event, targetUrl) => {
    if (/^https?:\/\//i.test(targetUrl)) {
      return;
    }

    event.preventDefault();
  });
  webContents.on("did-start-loading", () => {
    hideInfoRadarNativeReaderView(readerView);
    sendInfoRadarNativeReaderEvent(ownerWindow, { status: "loading", url });
  });
  webContents.on("did-finish-load", () => {
    showInfoRadarNativeReaderView(readerView);
    sendInfoRadarNativeReaderEvent(ownerWindow, { status: "ready", url });
  });
  webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) {
      return;
    }

    hideInfoRadarNativeReaderView(readerView);
    sendInfoRadarNativeReaderEvent(ownerWindow, {
      status: "failed",
      url: validatedUrl || url,
      message: errorDescription || "来源页面加载失败"
    });
  });

  setInfoRadarNativeReaderBounds(readerView, bounds);
  infoRadarReaderViews.set(ownerWindow.id, readerView);
  sendInfoRadarNativeReaderEvent(ownerWindow, { status: "loading", url });

  try {
    await webContents.loadURL(url);
  } catch (error) {
    sendInfoRadarNativeReaderEvent(ownerWindow, {
      status: "failed",
      url,
      message: error instanceof Error ? error.message : "来源页面加载失败"
    });
  }

}

async function openLiveStreamNativeView(
  ownerWindow: BrowserWindow,
  url: string,
  bounds: InfoRadarNativeReaderBounds
): Promise<void> {
  detachInfoRadarNativeReaderView(ownerWindow);
  detachLiveStreamNativeView(ownerWindow);

  const liveView = createLiveStreamNativeView(ownerWindow);
  const webContents = getInfoRadarNativeReaderWebContents(liveView);
  let hasShownLiveView = false;
  let liveViewFallbackTimer: NodeJS.Timeout | null = null;
  const liveTheaterRetryTimers = new Set<NodeJS.Timeout>();
  const clearLiveTheaterRetryTimers = (): void => {
    liveTheaterRetryTimers.forEach((timer) => clearTimeout(timer));
    liveTheaterRetryTimers.clear();
  };
  const applyLiveTheaterIfCurrent = (): void => {
    if (liveStreamViews.get(ownerWindow.id) !== liveView || webContents.isDestroyed()) {
      return;
    }

    void applyBilibiliLiveTheaterMode(webContents, url);
  };
  const scheduleLiveTheaterMode = (delays = [0, 650, 1800, 3600]): void => {
    clearLiveTheaterRetryTimers();
    delays.forEach((delay) => {
      const timer = setTimeout(() => {
        liveTheaterRetryTimers.delete(timer);
        applyLiveTheaterIfCurrent();
      }, delay);
      liveTheaterRetryTimers.add(timer);
    });
  };
  const showLiveViewAsReady = (): void => {
    if (hasShownLiveView) {
      return;
    }

    hasShownLiveView = true;

    if (liveViewFallbackTimer) {
      clearTimeout(liveViewFallbackTimer);
      liveViewFallbackTimer = null;
    }

    showInfoRadarNativeReaderView(liveView);
    sendLiveStreamNativeViewEvent(ownerWindow, { status: "ready", url });
  };
  webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    void shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  webContents.on("will-navigate", (event, targetUrl) => {
    if (/^https?:\/\//i.test(targetUrl)) {
      return;
    }

    event.preventDefault();
  });
  webContents.on("did-start-loading", () => {
    sendLiveStreamNativeViewEvent(ownerWindow, { status: "loading", url });
  });
  webContents.on("did-navigate", () => {
    flushLiveStreamNativeViewStorage(webContents);
  });
  webContents.on("did-navigate-in-page", () => {
    flushLiveStreamNativeViewStorage(webContents);
  });
  webContents.on("dom-ready", () => {
    scheduleLiveTheaterMode();
    showLiveViewAsReady();
  });
  webContents.on("did-finish-load", () => {
    scheduleLiveTheaterMode([0, 500, 1400]);
    showLiveViewAsReady();
  });
  webContents.on("did-stop-loading", () => {
    scheduleLiveTheaterMode([0, 800, 2200]);
    flushLiveStreamNativeViewStorage(webContents);
    showLiveViewAsReady();
  });
  webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) {
      return;
    }

    if (liveViewFallbackTimer) {
      clearTimeout(liveViewFallbackTimer);
      liveViewFallbackTimer = null;
    }

    clearLiveTheaterRetryTimers();
    hideInfoRadarNativeReaderView(liveView);
    sendLiveStreamNativeViewEvent(ownerWindow, {
      status: "failed",
      url: validatedUrl || url,
      message: errorDescription || "直播页面加载失败"
    });
  });

  setInfoRadarNativeReaderBounds(liveView, bounds);
  liveStreamViews.set(ownerWindow.id, liveView);
  sendLiveStreamNativeViewEvent(ownerWindow, { status: "loading", url });
  liveViewFallbackTimer = setTimeout(() => {
    if (liveStreamViews.get(ownerWindow.id) !== liveView) {
      return;
    }

    scheduleLiveTheaterMode([0, 900, 2400]);
    showLiveViewAsReady();
  }, 3000);

  try {
    await webContents.loadURL(url);
  } catch (error) {
    if (liveViewFallbackTimer) {
      clearTimeout(liveViewFallbackTimer);
      liveViewFallbackTimer = null;
    }

    clearLiveTheaterRetryTimers();
    sendLiveStreamNativeViewEvent(ownerWindow, {
      status: "failed",
      url,
      message: error instanceof Error ? error.message : "直播页面加载失败"
    });
  }
}

type GordonConfirmWindowOptions = {
  title: string;
  eyebrow?: string;
  message: string;
  detailLines?: string[];
  confirmText?: string;
  cancelText?: string;
  tone?: GordonConfirmWindowTone;
};

type WorkflowRuntimeEnvironment = {
  id?: string;
  label?: string;
  baseUrl?: string;
  apiKey?: string;
};

type WorkflowRuntimeVariableBinding = {
  name?: string;
  path?: string;
};

type WorkflowRuntimeStep = {
  id?: string;
  name?: string;
  curl?: string;
  waitBeforeMs?: number;
  executionMode?: "once" | "polling";
  pollIntervalMs?: number;
  maxAttempts?: number;
  completionPath?: string;
  successValues?: string[];
  failureValues?: string[];
  produces?: WorkflowRuntimeVariableBinding[];
};

type WorkflowRuntimeRecord = {
  progressEventId?: string;
  activeEnvironmentId?: string;
  environments?: WorkflowRuntimeEnvironment[];
  apiKey?: string;
  steps?: WorkflowRuntimeStep[];
};

type WorkflowRunStatus = "running" | "success" | "failed" | "cancelled";
type WorkflowStepStatus = "pending" | "running" | "success" | "failed" | "cancelled";

type WorkflowRunStepAttempt = {
  attempt: number;
  status: "running" | "success" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  completionValue?: string;
};

type WorkflowRunStepResult = {
  stepId: string;
  name: string;
  mode: "once" | "polling";
  status: WorkflowStepStatus;
  startedAt?: string;
  finishedAt?: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  attempt: number;
  maxAttempts: number;
  completionValue?: string;
  attempts: WorkflowRunStepAttempt[];
};

type WorkflowRunProgressPayload = {
  progressEventId?: string;
  status: WorkflowRunStatus;
  startedAt: string;
  finishedAt?: string;
  variables: Record<string, string>;
  steps: WorkflowRunStepResult[];
};

type WorkflowRunProgressEmitter = (payload: WorkflowRunProgressPayload) => void;

type WorkflowActiveRunContext = {
  controller: AbortController;
  child: ReturnType<typeof spawn> | null;
};

const WORKFLOW_RUN_CANCELLED_MESSAGE = "执行已中断";
const INFO_RADAR_FETCH_TIMEOUT_MS = 18_000;
const INFO_RADAR_MAX_ITEMS_PER_SOURCE = 32;
const INFO_RADAR_MAX_WINDOW_ITEMS = 400;
const FINANCE_BRIEF_FETCH_TIMEOUT_MS = 15_000;
const FINANCE_BRIEF_RANGES = new Set<FinanceBriefRange>(["1d", "5d", "1mo", "3mo", "6mo", "1y", "ytd", "2y", "5y"]);
const FINANCE_BRIEF_INTERVALS = new Set<FinanceBriefInterval>(["1m", "5m", "15m", "30m", "60m", "1d", "1wk", "1mo"]);
const activeWorkflowRuns = new Map<string, WorkflowActiveRunContext>();
const WRITING_BOOK_EXPORT_EXTENSIONS = new Set<WritingBookExportFormat>(["txt", "md"]);
const COMIC_PROJECT_EXPORT_EXTENSIONS = new Set<ComicProjectExportFormat>(["md"]);
const VIDEO_PROJECT_EXPORT_EXTENSIONS = new Set<VideoProjectExportFormat>(["md"]);
const MUSIC_PROJECT_EXPORT_EXTENSIONS = new Set<MusicProjectExportFormat>(["md"]);
const COMMAND_WORKSHOP_MESSAGE_EXPORT_EXTENSIONS = new Set<CommandWorkshopMessageExportFormat>(["pdf", "docx"]);

class WorkflowRunCancelledError extends Error {
  constructor() {
    super(WORKFLOW_RUN_CANCELLED_MESSAGE);
    this.name = "WorkflowRunCancelledError";
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function toCloneableIpcValue<T>(value: T): T {
  const visited = new WeakSet<object>();

  function normalize(input: unknown): unknown {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return input;
    }

    if (typeof input === "bigint" || typeof input === "symbol" || typeof input === "function") {
      return String(input);
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (input instanceof Error) {
      return {
        name: input.name,
        message: input.message,
        stack: input.stack ?? ""
      };
    }

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    if (input instanceof Map) {
      return Object.fromEntries(Array.from(input.entries()).map(([key, entryValue]) => [String(key), normalize(entryValue)]));
    }

    if (input instanceof Set) {
      return Array.from(input.values()).map((item) => normalize(item));
    }

    if (typeof input !== "object") {
      return String(input);
    }

    if (visited.has(input)) {
      return "[Circular]";
    }

    visited.add(input);

    const output: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(input)) {
      output[key] = normalize(entryValue);
    }

    return output;
  }

  return normalize(value) as T;
}

function normalizeFeishuWebhookUrl(value: string): string {
  const webhookUrl = String(value ?? "").trim();

  if (!webhookUrl) {
    throw new Error("请先设置飞书群机器人 Webhook。");
  }

  const url = new URL(webhookUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("飞书 Webhook 必须是 HTTP 或 HTTPS 地址。");
  }

  return url.toString();
}

function buildFeishuSignature(secret: string): { timestamp: string; sign: string } | null {
  const normalizedSecret = String(secret ?? "").trim();

  if (!normalizedSecret) {
    return null;
  }

  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const stringToSign = `${timestamp}\n${normalizedSecret}`;
  const sign = createHmac("sha256", stringToSign).digest("base64");

  return { timestamp, sign };
}

function truncateFeishuDailyReportContent(content: string): string {
  if (content.length <= FEISHU_DAILY_REPORT_CONTENT_LIMIT) {
    return content;
  }

  return `${content.slice(0, FEISHU_DAILY_REPORT_CONTENT_LIMIT)}\n\n... 内容较长，已自动截断后发送。`;
}

function getFeishuDailyReportListLineMeta(line: string): { depth: number; text: string } | null {
  const bulletMatch = line.match(/^([ \t]*)(?:[-*+]|\d+[.)])\s+(.+)$/);

  if (bulletMatch) {
    return {
      depth: Math.max(0, Math.round(bulletMatch[1].replace(/\t/g, "    ").length / 4)),
      text: bulletMatch[2].trim()
    };
  }

  const indentedMatch = line.match(/^([ \t]{2,})(\S.*)$/);

  if (!indentedMatch) {
    return null;
  }

  return {
    depth: Math.max(1, Math.round(indentedMatch[1].replace(/\t/g, "    ").length / 4)),
    text: indentedMatch[2].trim()
  };
}

function normalizeFeishuDailyReportMarkdown(content: string): string {
  const oddSpacePattern = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
  const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/g;
  const bulletLikePattern = /^[•●▪◦‣・·]\s+/;
  const statusSuffixPattern = /(?:（|\()(已完成|进行中|测试中|待开始|受阻)(?:）|\))\s*$/;
  const normalizedLines = String(content ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(zeroWidthPattern, "")
    .replace(oddSpacePattern, " ")
    .replace(/\t/g, "    ")
    .split("\n")
    .map((line) => line.replace(/[ ]+$/g, ""))
    .filter((line) => line.trim());
  const repairedLines: string[] = [];
  let hasProjectHeading = false;

  for (const line of normalizedLines) {
    const unescapedLine = line.replace(/^([ ]*)\\([*+-])\s+/, "$1$2 ");
    const normalizedBulletLine = bulletLikePattern.test(unescapedLine.trim())
      ? `${unescapedLine.match(/^[ ]*/)?.[0] ?? ""}- ${unescapedLine.trim().replace(bulletLikePattern, "")}`
      : unescapedLine;
    const listMeta = getFeishuDailyReportListLineMeta(normalizedBulletLine);

    if (!listMeta) {
      const text = normalizedBulletLine.trim();

      if (/^#{1,6}\s+/.test(text)) {
        repairedLines.push(text);
        hasProjectHeading = true;
        continue;
      }

      if (statusSuffixPattern.test(text) && hasProjectHeading) {
        repairedLines.push(`- ${text}`);
        continue;
      }

      if (repairedLines.length && repairedLines[repairedLines.length - 1]) {
        repairedLines.push("");
      }

      repairedLines.push(`**${text.replace(/^\*+|\*+$/g, "")}**`);
      hasProjectHeading = true;
      continue;
    }

    const text = listMeta.text.replace(/^\*+|\*+$/g, "").trim();

    if (!listMeta.depth && !statusSuffixPattern.test(text)) {
      if (repairedLines.length && repairedLines[repairedLines.length - 1]) {
        repairedLines.push("");
      }

      repairedLines.push(`**${text}**`);
      hasProjectHeading = true;
      continue;
    }

    const depth = !listMeta.depth && statusSuffixPattern.test(text) && hasProjectHeading ? 1 : Math.max(1, listMeta.depth);
    repairedLines.push(`${"  ".repeat(depth - 1)}- ${text}`);
  }

  return repairedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeFeishuDailyReportTitle(value: string): string {
  return String(value ?? "")
    .replace(/\s*日报\s*$/g, "")
    .replace(/周[一二三四五六日天]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFeishuDailyReportPayload(
  settings: WeeklyFeishuSettings,
  request: WeeklyDailyReportFeishuSendRequest
): Record<string, unknown> {
  const titlePrefix = String(settings.titlePrefix ?? "").trim();
  const titleDate = normalizeFeishuDailyReportTitle(request.title);
  const title = [titlePrefix, titleDate].filter(Boolean).join(" ") || "Gordon 日报";
  const content = truncateFeishuDailyReportContent(normalizeFeishuDailyReportMarkdown(String(request.content ?? "").trim()));
  const signature = buildFeishuSignature(settings.secret);
  const payload: Record<string, unknown> = {
    msg_type: "interactive",
    card: {
      schema: "2.0",
      config: {
        update_multi: true,
        style: {
          text_size: {
            [FEISHU_DAILY_REPORT_MARKDOWN_TEXT_SIZE]: {
              default: "normal",
              pc: "normal",
              mobile: "normal"
            }
          }
        }
      },
      body: {
        direction: "vertical",
        padding: "12px 12px 12px 12px",
        elements: [
          {
            tag: "markdown",
            content,
            text_align: "left",
            text_size: FEISHU_DAILY_REPORT_MARKDOWN_TEXT_SIZE,
            margin: "0px 0px 0px 0px"
          }
        ]
      },
      header: {
        title: {
          tag: "plain_text",
          content: title
        },
        template: "turquoise",
        padding: "12px 12px 12px 12px"
      }
    }
  };

  if (signature) {
    payload.timestamp = signature.timestamp;
    payload.sign = signature.sign;
  }

  return payload;
}

async function parseFeishuWebhookResponse(response: Response): Promise<Record<string, unknown>> {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return {};
  }

  try {
    return JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    return { message: responseText };
  }
}

function getFeishuResponseCode(payload: Record<string, unknown>): number | null {
  const rawCode = payload.code ?? payload.Code ?? payload.StatusCode ?? payload.statusCode;
  const code = Number(rawCode);

  return Number.isFinite(code) ? code : null;
}

function getFeishuResponseMessage(payload: Record<string, unknown>): string {
  return String(payload.msg ?? payload.message ?? payload.StatusMessage ?? payload.statusMessage ?? "").trim();
}

async function sendWeeklyDailyReportToFeishu(
  request: WeeklyDailyReportFeishuSendRequest
): Promise<WeeklyDailyReportFeishuSendResult> {
  const settings = await getWeeklyFeishuSettings();
  const webhookUrl = normalizeFeishuWebhookUrl(settings.webhookUrl);
  const content = String(request.content ?? "").trim();

  if (!content) {
    throw new Error("当前没有可发送的日报内容。");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(buildFeishuDailyReportPayload(settings, { ...request, content }))
  });
  const responsePayload = await parseFeishuWebhookResponse(response);
  const responseCode = getFeishuResponseCode(responsePayload);
  const responseMessage = getFeishuResponseMessage(responsePayload) || (response.ok ? "success" : response.statusText);
  const isBusinessOk = responseCode === null || responseCode === 0;

  if (!response.ok || !isBusinessOk) {
    throw new Error(`飞书返回异常：${responseMessage || `HTTP ${response.status}`}`);
  }

  return {
    ok: true,
    sentAt: new Date().toISOString(),
    statusCode: responseCode ?? response.status,
    responseMessage
  };
}

type BeijingDateTimeParts = {
  dateKey: string;
  hour: string;
  minute: string;
  weekday: string;
};

type WeeklyAutoDailyReportStatus = WeeklyFeishuSettings["autoDailyReportLastStatus"];

const WEEKLY_PROGRESS_TASK_STATUS_LABELS: Record<string, string> = {
  planned: "待开始",
  in_progress: "进行中",
  completed: "已完成",
  blocked: "受阻"
};

function getBeijingDateTimeParts(referenceDate = new Date()): BeijingDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WEEKLY_AUTO_DAILY_REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false
  }).formatToParts(referenceDate);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    dateKey: `${pick("year")}-${pick("month")}-${pick("day")}`,
    hour: pick("hour"),
    minute: pick("minute"),
    weekday: pick("weekday")
  };
}

function isBeijingWorkday(parts: BeijingDateTimeParts): boolean {
  return !["Sat", "Sun"].includes(parts.weekday);
}

function getBeijingDailyReportDateTitle(referenceDate = new Date()): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: WEEKLY_AUTO_DAILY_REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(referenceDate);
}

function getWeeklyProgressTaskStatusLabel(status: unknown): string {
  return WEEKLY_PROGRESS_TASK_STATUS_LABELS[String(status ?? "").trim()] ?? WEEKLY_PROGRESS_TASK_STATUS_LABELS.planned;
}

function getTaskChildren(task: WeeklyProgressTaskItem | null | undefined): WeeklyProgressTaskItem[] {
  return Array.isArray(task?.children) ? task.children : [];
}

function getTaskLocalDateKey(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WEEKLY_AUTO_DAILY_REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function filterTasksToUpdatedBranches(tasks: WeeklyProgressTaskItem[] = [], todayKey: string): WeeklyProgressTaskItem[] {
  const filtered: WeeklyProgressTaskItem[] = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    const children = getTaskChildren(task);
    const filteredChildren = filterTasksToUpdatedBranches(children, todayKey);
    const title = String(task.title ?? "").trim();
    const isUpdatedLeaf = !children.length && Boolean(title) && getTaskLocalDateKey(task.updatedAt) === todayKey;

    if (!children.length && !isUpdatedLeaf) {
      continue;
    }

    if (children.length && !filteredChildren.length) {
      continue;
    }

    filtered.push({
      ...task,
      title,
      detail: String(task.detail ?? "").trim(),
      children: filteredChildren
    });
  }

  return filtered;
}

function collectUpdatedLeafTaskCount(projects: WeeklyProgressProjectItem[] = [], todayKey: string): number {
  let count = 0;

  const visit = (tasks: WeeklyProgressTaskItem[] = []) => {
    for (const task of Array.isArray(tasks) ? tasks : []) {
      const children = getTaskChildren(task);

      if (children.length) {
        visit(children);
        continue;
      }

      if (String(task.title ?? "").trim() && getTaskLocalDateKey(task.updatedAt) === todayKey) {
        count += 1;
      }
    }
  };

  for (const project of Array.isArray(projects) ? projects : []) {
    visit(project.tasks);
  }

  return count;
}

function serializeDailyReportTaskLines(tasks: WeeklyProgressTaskItem[] = [], depth = 1): string[] {
  const lines: string[] = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    const indent = "    ".repeat(depth);
    const title = String(task.title ?? "").trim() || "未命名任务";
    const children = getTaskChildren(task);

    if (children.length) {
      lines.push(`${indent}* ${title}`);
      lines.push(...serializeDailyReportTaskLines(children, depth + 1));
      continue;
    }

    lines.push(`${indent}* ${title}（${getWeeklyProgressTaskStatusLabel(task.status)}）`);
  }

  return lines;
}

function buildAutoDailyReportSourceMarkdown(record: WeeklyProgressRecord, todayKey: string): { count: number; markdown: string } {
  const count = collectUpdatedLeafTaskCount(record.projects, todayKey);

  if (!count) {
    return { count, markdown: "" };
  }

  const lines: string[] = [];

  for (const project of Array.isArray(record.projects) ? record.projects : []) {
    const filteredTasks = filterTasksToUpdatedBranches(project.tasks, todayKey);

    if (!filteredTasks.length) {
      continue;
    }

    lines.push(`* ${String(project.title ?? "").trim() || "未命名项目"}`);

    if (String(project.note ?? "").trim()) {
      lines.push(...String(project.note).split("\n").map((line) => `    * 项目备注：${line.trim()}`).filter((line) => line.trim()));
    }

    lines.push(...serializeDailyReportTaskLines(filteredTasks, 1));
    lines.push("");
  }

  return {
    count,
    markdown: lines.join("\n").trim()
  };
}

function hasMatchingMarkdownHierarchy(sourceMarkdown: string, candidateMarkdown: string): boolean {
  const getSignature = (value: string) =>
    String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => {
        const match = line.match(/^([ \t]*)(?:[*+-]|\d+[.)])\s+\S/);
        return match ? Math.round(match[1].replace(/\t/g, "    ").length / 4) : null;
      })
      .filter((item): item is number => item !== null)
      .join(",");

  return getSignature(sourceMarkdown) === getSignature(candidateMarkdown);
}

function normalizeAutoDailyReportMarkdown(value: string): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function selectAutoDailyReportRecord(records: WeeklyProgressRecord[]): WeeklyProgressRecord | null {
  return (
    records.find((record) => record.status === "active") ??
    records.find((record) => Array.isArray(record.projects) && record.projects.length > 0) ??
    records[0] ??
    null
  );
}

function buildWeeklyAutoDailyReportSettingsPatch(
  settings: WeeklyFeishuSettings,
  status: WeeklyAutoDailyReportStatus,
  message: string,
  dateKey: string,
  timestamp = new Date().toISOString()
): WeeklyFeishuSettings {
  return {
    ...settings,
    autoDailyReportLastRunDate: dateKey,
    autoDailyReportLastRunAt: timestamp,
    autoDailyReportLastStatus: status,
    autoDailyReportLastMessage: String(message ?? "").trim()
  };
}

async function recordWeeklyAutoDailyReportResult(
  settings: WeeklyFeishuSettings,
  status: WeeklyAutoDailyReportStatus,
  message: string,
  dateKey: string
): Promise<WeeklyFeishuSettings> {
  return saveWeeklyFeishuSettings(buildWeeklyAutoDailyReportSettingsPatch(settings, status, message, dateKey));
}

async function runWeeklyAutoDailyReport(referenceDate = new Date()): Promise<void> {
  if (weeklyAutoDailyReportInFlight) {
    return;
  }

  weeklyAutoDailyReportInFlight = true;

  try {
    const settings = await getWeeklyFeishuSettings();
    const beijingParts = getBeijingDateTimeParts(referenceDate);

    if (!settings.autoDailyReportEnabled) {
      return;
    }

    if (settings.autoDailyReportLastRunDate === beijingParts.dateKey) {
      return;
    }

    if (!String(settings.webhookUrl ?? "").trim()) {
      await recordWeeklyAutoDailyReportResult(settings, "failed", "飞书群机器人 Webhook 未配置。", beijingParts.dateKey);
      return;
    }

    const records = await listWeeklyProgress();
    const record = selectAutoDailyReportRecord(records);

    if (!record) {
      await recordWeeklyAutoDailyReportResult(settings, "skipped", "没有可用于生成日报的任务笔记。", beijingParts.dateKey);
      return;
    }

    const { count, markdown } = buildAutoDailyReportSourceMarkdown(record, beijingParts.dateKey);

    if (!count || !markdown) {
      await recordWeeklyAutoDailyReportResult(settings, "skipped", "今天没有检测到更新的子任务记录。", beijingParts.dateKey);
      return;
    }

    const baseMarkdown = normalizeAutoDailyReportMarkdown(markdown);
    const dateTitle = getBeijingDailyReportDateTitle(referenceDate);
    let finalMarkdown = baseMarkdown;

    try {
      const result = await generateDailyProgressReport({
        dateTitle,
        weekTitle: record.title,
        content: baseMarkdown
      });
      const optimizedMarkdown = normalizeAutoDailyReportMarkdown(result.text);

      if (optimizedMarkdown && hasMatchingMarkdownHierarchy(baseMarkdown, optimizedMarkdown)) {
        finalMarkdown = optimizedMarkdown;
      }
    } catch (error) {
      console.warn("Weekly auto daily report optimization failed, fallback to base markdown", error);
    }

    await sendWeeklyDailyReportToFeishu({
      title: `${dateTitle} 日报`,
      weekTitle: record.title,
      content: finalMarkdown
    });

    await saveWeeklyProgress({
      ...record,
      generatedDailyReport: finalMarkdown
    });
    await recordWeeklyAutoDailyReportResult(settings, "success", `已自动发送 ${count} 条任务日报。`, beijingParts.dateKey);
  } catch (error) {
    try {
      const settings = await getWeeklyFeishuSettings();
      const beijingParts = getBeijingDateTimeParts(referenceDate);
      await recordWeeklyAutoDailyReportResult(
        settings,
        "failed",
        error instanceof Error ? error.message : "自动日报执行失败。",
        beijingParts.dateKey
      );
    } catch (recordError) {
      console.error("Failed to record weekly auto daily report result", recordError);
    }

    console.error("Weekly auto daily report failed", error);
  } finally {
    weeklyAutoDailyReportInFlight = false;
  }
}

async function checkWeeklyAutoDailyReportSchedule(referenceDate = new Date()): Promise<void> {
  const settings = await getWeeklyFeishuSettings();

  if (!settings.autoDailyReportEnabled) {
    return;
  }

  const beijingParts = getBeijingDateTimeParts(referenceDate);
  const [targetHour = "18", targetMinute = "30"] = String(
    settings.autoDailyReportTime || WEEKLY_AUTO_DAILY_REPORT_DEFAULT_TIME
  )
    .split(":")
    .map((item) => item.padStart(2, "0"));

  if (
    isBeijingWorkday(beijingParts) &&
    beijingParts.hour === targetHour &&
    beijingParts.minute === targetMinute &&
    settings.autoDailyReportLastRunDate !== beijingParts.dateKey
  ) {
    await runWeeklyAutoDailyReport(referenceDate);
  }
}

function startWeeklyAutoDailyReportScheduler(): void {
  if (weeklyAutoDailyReportTimer) {
    clearInterval(weeklyAutoDailyReportTimer);
  }

  weeklyAutoDailyReportTimer = setInterval(() => {
    void checkWeeklyAutoDailyReportSchedule();
  }, WEEKLY_AUTO_DAILY_REPORT_CHECK_INTERVAL_MS);
  void checkWeeklyAutoDailyReportSchedule();
}

function normalizeWritingBookExportFormat(value: unknown): WritingBookExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return WRITING_BOOK_EXPORT_EXTENSIONS.has(format as WritingBookExportFormat) ? (format as WritingBookExportFormat) : "txt";
}

function sanitizeWritingBookExportFileName(value: unknown, format: WritingBookExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名书稿"}.${format}`;
}

function inferApplicationCoverImageMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  };

  return mimeTypes[extension] ?? "image/png";
}

function inferApplicationCoverExtensionFromMimeType(mimeType: string): string {
  const normalizedMimeType = String(mimeType ?? "").trim().toLowerCase().split(";")[0];
  const extensions: Record<string, string> = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp"
  };

  return extensions[normalizedMimeType] ?? "png";
}

function sanitizeApplicationCoverImageFileName(value: unknown, extension = "png"): string {
  const normalizedExtension = String(extension ?? "").trim().toLowerCase().replace(/^\./, "") || "png";
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();

  return `${baseName || "未命名封面"}.${normalizedExtension}`;
}

async function readApplicationCoverImageSource(imageUrl: unknown): Promise<{ buffer: Buffer; extension: string; mimeType: string }> {
  const source = String(imageUrl ?? "").trim();

  if (!source) {
    throw new Error("当前没有可下载的封面图片");
  }

  const dataUrlMatch = source.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);

  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1] || "image/png";
    return {
      buffer: Buffer.from(dataUrlMatch[2], "base64"),
      extension: inferApplicationCoverExtensionFromMimeType(mimeType),
      mimeType
    };
  }

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);

    if (!response.ok) {
      throw new Error(`远端封面下载失败：HTTP ${response.status}`);
    }

    const mimeType = response.headers.get("content-type") || "image/png";
    const urlExtension = path.extname(new URL(source).pathname).replace(/^\./, "").toLowerCase();
    const extension = urlExtension && ["gif", "jpeg", "jpg", "png", "svg", "webp"].includes(urlExtension)
      ? urlExtension
      : inferApplicationCoverExtensionFromMimeType(mimeType);

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      extension,
      mimeType
    };
  }

  throw new Error("只支持下载本地上传/生成的封面或 http(s) 图片 URL");
}

function resolveWritingBookExportPath(request: WritingBookExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: WritingBookExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的正文内容");
  }

  const format = normalizeWritingBookExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeWritingBookExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeComicProjectExportFormat(value: unknown): ComicProjectExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return COMIC_PROJECT_EXPORT_EXTENSIONS.has(format as ComicProjectExportFormat) ? (format as ComicProjectExportFormat) : "md";
}

function sanitizeComicProjectExportFileName(value: unknown, format: ComicProjectExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名漫画项目"}.${format}`;
}

function resolveComicProjectExportPath(request: ComicProjectExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: ComicProjectExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的项目内容");
  }

  const format = normalizeComicProjectExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeComicProjectExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeVideoProjectExportFormat(value: unknown): VideoProjectExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return VIDEO_PROJECT_EXPORT_EXTENSIONS.has(format as VideoProjectExportFormat) ? (format as VideoProjectExportFormat) : "md";
}

function sanitizeVideoProjectExportFileName(value: unknown, format: VideoProjectExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名视频项目"}.${format}`;
}

function resolveVideoProjectExportPath(request: VideoProjectExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: VideoProjectExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的视频项目内容");
  }

  const format = normalizeVideoProjectExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeVideoProjectExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeMusicProjectExportFormat(value: unknown): MusicProjectExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return MUSIC_PROJECT_EXPORT_EXTENSIONS.has(format as MusicProjectExportFormat) ? (format as MusicProjectExportFormat) : "md";
}

function sanitizeMusicProjectExportFileName(value: unknown, format: MusicProjectExportFormat): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${baseName || "未命名音乐专辑"}.${format}`;
}

function resolveMusicProjectExportPath(request: MusicProjectExportRequest): {
  directoryPath: string;
  fileName: string;
  filePath: string;
  format: MusicProjectExportFormat;
  content: string;
} {
  const directoryPath = String(request?.directoryPath ?? "").trim();
  const content = String(request?.content ?? "");

  if (!directoryPath) {
    throw new Error("请选择输出目录");
  }

  if (!content.trim()) {
    throw new Error("没有可导出的音乐专辑内容");
  }

  const format = normalizeMusicProjectExportFormat(request?.format);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  const fileName = sanitizeMusicProjectExportFileName(request?.fileName, format);
  const filePath = path.join(resolvedDirectoryPath, fileName);
  const relativePath = path.relative(resolvedDirectoryPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("导出路径不合法");
  }

  return {
    directoryPath: resolvedDirectoryPath,
    fileName,
    filePath,
    format,
    content: content.endsWith("\n") ? content : `${content}\n`
  };
}

function normalizeCommandWorkshopMessageExportFormat(value: unknown): CommandWorkshopMessageExportFormat {
  const format = String(value ?? "").trim().toLowerCase();
  return COMMAND_WORKSHOP_MESSAGE_EXPORT_EXTENSIONS.has(format as CommandWorkshopMessageExportFormat)
    ? (format as CommandWorkshopMessageExportFormat)
    : "pdf";
}

function sanitizeExportBaseFileName(value: unknown, fallback: string): string {
  const baseName = String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return baseName || fallback;
}

function normalizeCommandWorkshopMessageExportRequest(
  request: CommandWorkshopMessageExportRequest
): CommandWorkshopMessageExportRequest {
  const format = normalizeCommandWorkshopMessageExportFormat(request?.format);
  const contentText = String(request?.contentText ?? "").trim();
  const contentHtml = String(request?.contentHtml ?? "").trim();

  if (!contentText && !contentHtml) {
    throw new Error("当前 AI 回复没有可导出的内容");
  }

  return {
    fileName: `${sanitizeExportBaseFileName(request?.fileName, "Gordon AI 回复")}.${format}`,
    format,
    title: String(request?.title ?? "").trim() || "Gordon AI 回复",
    agentName: String(request?.agentName ?? "").trim() || "Gordon",
    createdAt: String(request?.createdAt ?? "").trim(),
    contentText,
    contentHtml: contentHtml || `<p>${escapeHtml(contentText).replace(/\n/g, "<br />")}</p>`
  };
}

function formatExportDateTime(value: unknown): string {
  const date = new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString("zh-CN", { hour12: false });
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}

function buildCommandWorkshopExportHtml(request: CommandWorkshopMessageExportRequest): string {
  const title = escapeHtml(request.title);
  const agentName = escapeHtml(request.agentName);
  const createdAt = escapeHtml(formatExportDateTime(request.createdAt));

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #1f2933;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 12.5pt;
      line-height: 1.72;
    }
    .document-shell { max-width: 760px; margin: 0 auto; }
    .document-header {
      padding: 0 0 18px;
      margin: 0 0 22px;
      border-bottom: 1px solid #d7e6e2;
    }
    .document-eyebrow {
      margin: 0 0 7px;
      color: #0f8f7b;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 9px;
      color: #18272f;
      font-size: 24pt;
      line-height: 1.18;
      letter-spacing: 0;
    }
    .document-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      color: #60717d;
      font-size: 9.5pt;
    }
    .document-content { overflow-wrap: anywhere; }
    .document-content > *:first-child { margin-top: 0; }
    .command-rich-heading {
      break-after: avoid;
      color: #18313a;
      line-height: 1.28;
      margin: 23px 0 9px;
      letter-spacing: 0;
    }
    .command-rich-heading-depth-1 { font-size: 18pt; }
    .command-rich-heading-depth-2 { font-size: 15pt; }
    .command-rich-heading-depth-3 { font-size: 13.5pt; }
    .command-rich-paragraph { margin: 8px 0; }
    .command-rich-list { margin: 8px 0 10px 0; padding-left: 22px; }
    .command-rich-list .command-rich-list { margin-top: 4px; }
    .command-rich-list-item { margin: 3px 0; padding-left: 2px; }
    .command-rich-list-marker {
      display: inline-block;
      min-width: 26px;
      margin-left: -26px;
      color: #0f8f7b;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    .command-rich-quote {
      margin: 12px 0;
      padding: 9px 13px;
      border-left: 3px solid #0fbea2;
      background: #f4fbf8;
      color: #40515c;
    }
    .command-rich-divider {
      height: 1px;
      margin: 18px 0;
      border: 0;
      background: #d7e6e2;
    }
    .command-rich-link { color: #087f6e; text-decoration: none; border-bottom: 1px solid rgba(8, 127, 110, 0.28); }
    .command-inline-code {
      padding: 1px 4px;
      border: 1px solid #d9e7e4;
      border-radius: 4px;
      background: #f6faf9;
      color: #9f4c3b;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 0.88em;
    }
    .command-code-block {
      break-inside: avoid;
      margin: 13px 0;
      border: 1px solid #d6e4e1;
      border-radius: 8px;
      overflow: hidden;
      background: #f8fbfa;
    }
    .command-code-head {
      display: flex;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid #e1ebe8;
      color: #5c6f79;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .command-code-copy { display: none; }
    .command-code-pre {
      margin: 0;
      padding: 9px 0;
      overflow-wrap: normal;
      white-space: pre-wrap;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 8.5pt;
      line-height: 1.55;
    }
    .command-code-line {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 8px;
      padding: 0 10px;
    }
    .command-code-line-number {
      color: #91a1a9;
      text-align: right;
      user-select: none;
    }
    .command-code-line-content { min-width: 0; }
    .command-rich-table-wrap {
      margin: 14px 0;
      overflow: hidden;
      border: 1px solid #d6e4e1;
      border-radius: 8px;
    }
    .command-rich-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .command-rich-table th,
    .command-rich-table td {
      padding: 7px 9px;
      border-right: 1px solid #dce9e6;
      border-bottom: 1px solid #dce9e6;
      text-align: left;
      vertical-align: top;
    }
    .command-rich-table th {
      background: #eff8f5;
      color: #28414b;
      font-weight: 800;
    }
    .command-rich-table-cell.is-center { text-align: center; }
    .command-rich-table-cell.is-right { text-align: right; }
    .command-math-inline,
    .command-math-block {
      font-family: "Times New Roman", "STIX Two Math", serif;
      color: #17313b;
    }
    .command-math-inline {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      padding: 0 3px;
      border-radius: 4px;
      background: #f3faf8;
      vertical-align: baseline;
    }
    .command-math-block {
      display: flex;
      justify-content: center;
      margin: 14px 0;
      padding: 12px;
      overflow-x: auto;
      border: 1px solid #d8e8e4;
      border-radius: 8px;
      background: #fbfdfc;
      text-align: center;
    }
    .command-math-fraction {
      display: inline-grid;
      grid-template-rows: auto auto;
      align-items: center;
      margin: 0 2px;
      text-align: center;
      vertical-align: middle;
    }
    .command-math-fraction > span:first-child { border-bottom: 1px solid currentColor; }
    .command-math-root-mark { border-top: 1px solid currentColor; margin-right: 2px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      a { color: #087f6e; }
    }
  </style>
</head>
<body>
  <main class="document-shell">
    <header class="document-header">
      <p class="document-eyebrow">Gordon Command Workshop</p>
      <h1>${title}</h1>
      <div class="document-meta">
        <span>Agent: ${agentName}</span>
        <span>生成时间: ${createdAt}</span>
      </div>
    </header>
    <article class="document-content">${request.contentHtml}</article>
  </main>
</body>
</html>`;
}

async function exportCommandWorkshopMessageAsPdf(
  request: CommandWorkshopMessageExportRequest,
  filePath: string
): Promise<number> {
  const exportWindow = new BrowserWindow({
    width: 900,
    height: 1200,
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    const html = buildCommandWorkshopExportHtml(request);
    await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await exportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      preferCSSPageSize: true,
      margins: {
        marginType: "custom",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    await writeFile(filePath, pdf);
    return pdf.byteLength;
  } finally {
    if (!exportWindow.isDestroyed()) {
      exportWindow.destroy();
    }
  }
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeDocxTextLines(text: string): string[] {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "    "));
}

function buildDocxRun(text: string, options: { bold?: boolean; italic?: boolean } = {}): string {
  const runProperties = [
    options.bold ? "<w:b/>" : "",
    options.italic ? "<w:i/>" : ""
  ].join("");
  const safeText = escapeXml(text);
  return `<w:r>${runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ""}<w:t xml:space="preserve">${safeText}</w:t></w:r>`;
}

function buildDocxParagraph(
  text: string,
  style: "Title" | "Subtitle" | "Heading1" | "Heading2" | "Heading3" | "Normal" | "ListParagraph" = "Normal"
): string {
  const paragraphProperties = style === "Normal" ? "" : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  return `<w:p>${paragraphProperties}${buildDocxRun(text)}</w:p>`;
}

function buildCommandWorkshopDocxDocument(request: CommandWorkshopMessageExportRequest): string {
  const lines = normalizeDocxTextLines(request.contentText);
  const paragraphs = [
    buildDocxParagraph(request.title, "Title"),
    buildDocxParagraph(`Agent: ${request.agentName}    生成时间: ${formatExportDateTime(request.createdAt)}`, "Subtitle")
  ];
  let blankCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      blankCount += 1;
      if (blankCount <= 1) {
        paragraphs.push("<w:p/>");
      }
      continue;
    }

    blankCount = 0;

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);

    if (headingMatch) {
      const depth = headingMatch[1].length;
      paragraphs.push(buildDocxParagraph(headingMatch[2], depth === 1 ? "Heading1" : depth === 2 ? "Heading2" : "Heading3"));
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-*+]|\d+(?:\.\d+)*[.)])\s+(.*)$/);

    if (listMatch) {
      paragraphs.push(buildDocxParagraph(`• ${listMatch[1]}`, "ListParagraph"));
      continue;
    }

    if (/^>\s?/.test(line)) {
      paragraphs.push(buildDocxParagraph(line.replace(/^>\s?/, ""), "Subtitle"));
      continue;
    }

    paragraphs.push(buildDocxParagraph(line));
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1260" w:bottom="1440" w:left="1260" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildCommandWorkshopDocxStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Aptos" w:eastAsia="Microsoft YaHei" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="180"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="18313A"/><w:sz w:val="44"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="220"/></w:pPr>
    <w:rPr><w:color w:val="60717D"/><w:sz w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="0F7F6E"/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="18313A"/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="28414B"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:ind w:left="420" w:hanging="220"/><w:spacing w:after="80"/></w:pPr>
  </w:style>
</w:styles>`;
}

async function exportCommandWorkshopMessageAsDocx(
  request: CommandWorkshopMessageExportRequest,
  filePath: string
): Promise<number> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder("word")?.file("document.xml", buildCommandWorkshopDocxDocument(request));
  zip.folder("word")?.file("styles.xml", buildCommandWorkshopDocxStyles());
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(filePath, buffer);
  return buffer.byteLength;
}

function buildGordonConfirmWindowHtml(options: GordonConfirmWindowOptions, confirmUrl: string, cancelUrl: string): string {
  const tone = options.tone ?? "warning";
  const detailItems = (options.detailLines ?? [])
    .filter((line) => String(line ?? "").trim())
    .map((line) => {
      const text = String(line ?? "").trim();
      const separatorIndex = text.indexOf("：");

      if (separatorIndex > 0 && separatorIndex < 8) {
        return `<li><span class="detail-label">${escapeHtml(text.slice(0, separatorIndex))}</span><span class="detail-value">${escapeHtml(text.slice(separatorIndex + 1))}</span></li>`;
      }

      return `<li><span class="detail-label">信息</span><span class="detail-value">${escapeHtml(text)}</span></li>`;
    })
    .join("");
  const escapedConfirmUrl = escapeHtml(confirmUrl);
  const escapedCancelUrl = escapeHtml(cancelUrl);
  const toneLabel = tone === "danger" ? "High Risk" : tone === "warning" ? "Permission" : "Notice";
  const safeEyebrow = options.eyebrow ?? "Gordon Confirm";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --text: #f7f3eb;
        --text-soft: #98a9bf;
        --text-faint: rgba(247, 243, 235, 0.52);
        --line: rgba(151, 182, 216, 0.16);
        --panel: rgba(8, 17, 29, 0.94);
        --window-bg: #08111d;
        --panel-strong: rgba(5, 12, 21, 0.96);
        --panel-soft: rgba(255, 255, 255, 0.05);
        --accent: #5ce1c2;
        --accent-warm: #f5c86b;
        --accent-hot: #ff8d77;
        --tone: var(--accent-warm);
        --tone-soft: rgba(245, 200, 107, 0.12);
        --tone-line: rgba(245, 200, 107, 0.28);
        --shadow: 0 26px 72px rgba(0, 0, 0, 0.42);
        font-family: "Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        min-width: 100%;
        min-height: 100%;
        margin: 0;
        background: var(--window-bg) !important;
      }

      html {
        overflow: hidden;
      }

      body {
        display: grid;
        place-items: center;
        min-height: 100vh;
        color: var(--text);
        padding: 0;
        overflow: hidden;
      }

      .dialog {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100vw;
        height: 100vh;
        min-height: 100vh;
        padding: 18px 18px 22px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 0;
        background:
          radial-gradient(circle at 14% 0%, var(--tone-soft), transparent 32%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.022)),
          var(--panel);
        box-shadow: none;
        backdrop-filter: blur(18px);
        -webkit-app-region: drag;
      }

      .dialog::before {
        content: "";
        position: absolute;
        inset: 0 0 auto;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--tone), rgba(92, 225, 194, 0.58), transparent);
        opacity: 0.86;
      }

      .dialog::after {
        content: "";
        position: absolute;
        right: -72px;
        top: -92px;
        width: 190px;
        height: 190px;
        border-radius: 999px;
        background: radial-gradient(circle, var(--tone-soft), transparent 64%);
        pointer-events: none;
      }

      .dialog.is-danger {
        --tone: var(--accent-hot);
        --tone-soft: rgba(255, 141, 119, 0.13);
        --tone-line: rgba(255, 141, 119, 0.3);
      }

      .head {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 12px;
        align-items: center;
      }

      .mark {
        position: relative;
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        border: 1px solid var(--tone-line);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent),
          var(--tone-soft);
        color: var(--tone);
        box-shadow: inset 0 0 0 1px rgba(247, 243, 235, 0.035), 0 14px 30px rgba(0, 0, 0, 0.2);
      }

      .mark::after {
        content: "";
        position: absolute;
        inset: -5px;
        border: 1px solid var(--tone-line);
        border-radius: 18px;
        opacity: 0.26;
      }

      .mark svg {
        width: 19px;
        height: 19px;
      }

      .eyebrow {
        margin: 0 0 4px;
        color: var(--tone);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        color: rgba(247, 243, 235, 0.96);
        font-size: 18px;
        line-height: 1.26;
      }

      .tone-pill {
        position: absolute;
        top: 18px;
        right: 18px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 9px;
        border: 1px solid var(--tone-line);
        border-radius: 999px;
        background: rgba(5, 12, 21, 0.36);
        color: var(--tone);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .message {
        position: relative;
        z-index: 1;
        margin: 14px 0 0;
        color: rgba(247, 243, 235, 0.72);
        font-size: 12.5px;
        font-weight: 600;
        line-height: 1.66;
      }

      .detail {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 7px;
        flex: 1 1 auto;
        min-height: 58px;
        max-height: 118px;
        margin: 13px 0 0;
        padding: 10px;
        border: 1px solid rgba(151, 182, 216, 0.13);
        border-radius: 15px;
        background:
          linear-gradient(135deg, rgba(92, 225, 194, 0.045), rgba(245, 200, 107, 0.035)),
          rgba(3, 10, 18, 0.35);
        font-size: 11.5px;
        line-height: 1.48;
        list-style: none;
        overflow: auto;
        -webkit-app-region: no-drag;
      }

      .detail li {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        overflow-wrap: anywhere;
      }

      .detail-label {
        color: rgba(247, 243, 235, 0.48);
        font-weight: 900;
        white-space: nowrap;
      }

      .detail-value {
        color: rgba(247, 243, 235, 0.76);
        font-family: "SFMono-Regular", "Menlo", "Consolas", "PingFang SC", monospace;
        font-size: 11px;
        font-weight: 700;
      }

      .scope-note {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 11px 0 0;
        color: rgba(247, 243, 235, 0.52);
        font-size: 11px;
        font-weight: 700;
      }

      .scope-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--tone);
        box-shadow: 0 0 16px var(--tone);
      }

      .actions {
        position: relative;
        z-index: 3;
        flex: 0 0 auto;
        display: flex;
        justify-content: flex-end;
        gap: 9px;
        margin-top: 14px;
        padding-bottom: 2px;
        -webkit-app-region: no-drag;
      }

      .dialog-action {
        display: inline-grid;
        place-items: center;
        min-width: 102px;
        min-height: 36px;
        padding: 0 14px;
        border: 1px solid rgba(247, 243, 235, 0.1);
        border-radius: 12px;
        text-decoration: none;
        font: inherit;
        font-weight: 900;
        font-size: 12px;
        cursor: pointer;
        transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease;
      }

      .secondary {
        background: rgba(255, 255, 255, 0.045);
        color: rgba(247, 243, 235, 0.72);
      }

      .primary {
        border-color: var(--tone-line);
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--tone) 24%, transparent), rgba(255, 255, 255, 0.035)),
          rgba(8, 15, 24, 0.72);
        color: #fff1ca;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
      }

      .dialog.is-danger .primary {
        color: #ffd0c6;
      }

      .dialog-action:hover,
      .dialog-action:focus-visible {
        outline: none;
        transform: translateY(-1px);
      }

      .secondary:hover,
      .secondary:focus-visible {
        border-color: rgba(247, 243, 235, 0.18);
        background: rgba(255, 255, 255, 0.07);
        color: rgba(247, 243, 235, 0.9);
      }

      .primary:hover,
      .primary:focus-visible {
        border-color: var(--tone);
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--tone) 34%, transparent), rgba(255, 255, 255, 0.055)),
          rgba(8, 15, 24, 0.78);
      }

      @supports not (color: color-mix(in srgb, red, transparent)) {
        .primary {
          background: rgba(245, 200, 107, 0.16);
        }

        .dialog.is-danger .primary {
          background: rgba(255, 141, 119, 0.16);
        }
      }

      ::-webkit-scrollbar {
        width: 7px;
      }

      ::-webkit-scrollbar-track {
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: rgba(247, 243, 235, 0.16);
      }
    </style>
  </head>
  <body>
    <main class="dialog is-${escapeHtml(tone)}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <span class="tone-pill">${escapeHtml(toneLabel)}</span>
      <div class="head">
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3 5 6v5c0 4.6 2.9 8.6 7 10 4.1-1.4 7-5.4 7-10V6l-7-3Z" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <div>
          <p class="eyebrow">${escapeHtml(safeEyebrow)}</p>
          <h1 id="dialog-title">${escapeHtml(options.title)}</h1>
        </div>
      </div>
      <p class="message">${escapeHtml(options.message)}</p>
      ${detailItems ? `<ul class="detail">${detailItems}</ul>` : ""}
      <div class="scope-note"><span class="scope-dot" aria-hidden="true"></span><span>仅本轮 Agent 运行生效，关闭或拒绝后不会继续执行该动作。</span></div>
      <div class="actions">
        <a class="dialog-action secondary" href="${escapedCancelUrl}" data-action="cancel">${escapeHtml(options.cancelText ?? "取消")}</a>
        <a class="dialog-action primary" href="${escapedConfirmUrl}" data-action="confirm" autofocus>${escapeHtml(options.confirmText ?? "确认")}</a>
      </div>
    </main>
  </body>
</html>`;
}

function showGordonConfirmWindow(ownerWindow: BrowserWindow | null, options: GordonConfirmWindowOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const confirmUrl = `gordon-confirm://${requestId}/confirm`;
    const cancelUrl = `gordon-confirm://${requestId}/cancel`;
    const confirmWindow = new BrowserWindow({
      width: 540,
      height: 374,
      parent: ownerWindow ?? undefined,
      modal: Boolean(ownerWindow),
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      show: false,
      title: options.title,
      transparent: false,
      backgroundColor: "#08111d",
      hasShadow: false,
      vibrancy: undefined,
      visualEffectState: "inactive",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    let settled = false;
    const settle = (confirmed: boolean) => {
      if (settled) {
        return;
      }

      settled = true;

      if (!confirmWindow.isDestroyed()) {
        confirmWindow.close();
      }

      resolve(confirmed);
    };

    const handleNavigation = (event: Electron.Event, targetUrl: string) => {
      const url = new URL(targetUrl);

      if (url.protocol !== "gordon-confirm:" || url.hostname !== requestId) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      settle(url.pathname.replace(/^\//, "") === "confirm");
    };

    confirmWindow.webContents.on("will-navigate", handleNavigation);
    confirmWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") {
        return;
      }

      if (input.key === "Escape") {
        event.preventDefault();
        settle(false);
      }

      if (input.key === "Enter") {
        event.preventDefault();
        settle(true);
      }
    });
    confirmWindow.once("ready-to-show", () => confirmWindow.show());
    confirmWindow.once("closed", () => settle(false));
    confirmWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildGordonConfirmWindowHtml(options, confirmUrl, cancelUrl))}`).catch(() => {
      settle(false);
    });
  });
}

function splitCurlCommand(command: string): string[] {
  const normalized = String(command ?? "").replace(/\\\r?\n/g, " ").trim();
  const args: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const char of normalized) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
}

function normalizeWorkflowBaseUrl(baseUrl: unknown): string {
  return String(baseUrl ?? "").trim().replace(/\/+$/, "");
}

function getActiveWorkflowEnvironment(record: WorkflowRuntimeRecord): WorkflowRuntimeEnvironment | null {
  const environments = Array.isArray(record?.environments) ? record.environments : [];
  const activeEnvironment =
    environments.find((environment) => String(environment?.id ?? "") === String(record?.activeEnvironmentId ?? "")) ??
    environments.find((environment) => String(environment?.id ?? "") === "prod") ??
    environments[0] ??
    null;

  return activeEnvironment ?? null;
}

function replaceCurlPlaceholders(curl: string, record: WorkflowRuntimeRecord, variables: Record<string, string> = {}): string {
  const activeEnvironment = getActiveWorkflowEnvironment(record);
  const baseUrl = normalizeWorkflowBaseUrl(activeEnvironment?.baseUrl);
  const apiKey = String(activeEnvironment?.apiKey ?? record?.apiKey ?? "").trim();
  const replacements: Record<string, string> = {
    BASE_URL: baseUrl,
    API_KEY: apiKey,
    ...variables
  };
  const resolveReplacement = (placeholder: string, name: string) =>
    Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : placeholder;

  return String(curl ?? "")
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, resolveReplacement)
    .replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, resolveReplacement)
    .replace(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g, resolveReplacement);
}

function mergeWorkflowBaseUrlWithRequestUrl(baseUrl: string, requestUrl: string): string {
  try {
    const base = new URL(baseUrl);
    const request = new URL(requestUrl);
    const basePath = base.pathname.replace(/\/+$/, "");
    const requestPath = request.pathname.startsWith("/") ? request.pathname : `/${request.pathname}`;

    return `${base.origin}${basePath}${requestPath}${request.search}${request.hash}`;
  } catch {
    return requestUrl;
  }
}

function findWorkflowUnresolvedVariables(command: string): string[] {
  const normalized = String(command ?? "");
  const dollarPlaceholders = Array.from(normalized.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)).map((match) => match[1]);
  const bareDollarPlaceholders = Array.from(normalized.matchAll(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g)).map((match) => match[1]);
  const doubleBracePlaceholders = Array.from(normalized.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)).map(
    (match) => match[1]
  );

  return Array.from(new Set([...dollarPlaceholders, ...bareDollarPlaceholders, ...doubleBracePlaceholders]));
}

function buildWorkflowCurlInvocation(
  step: { curl?: string },
  record: WorkflowRuntimeRecord,
  variables: Record<string, string> = {}
): { parts: string[]; unresolvedVariables: string[] } {
  const activeEnvironment = getActiveWorkflowEnvironment(record);
  const baseUrl = normalizeWorkflowBaseUrl(activeEnvironment?.baseUrl);
  const originalCommand = String(step?.curl ?? "");
  const usesBaseUrlPlaceholder = /\$BASE_URL\b|\$\{BASE_URL\}|\{\{\s*BASE_URL\s*\}\}/.test(originalCommand);
  const command = replaceCurlPlaceholders(originalCommand, record, variables);
  const unresolvedVariables = findWorkflowUnresolvedVariables(command);
  const parts = splitCurlCommand(command);
  const requestUrlIndex = parts.findIndex((part, index) => index > 0 && /^https?:\/\//i.test(part));

  if (baseUrl && !usesBaseUrlPlaceholder && requestUrlIndex >= 0) {
    parts[requestUrlIndex] = mergeWorkflowBaseUrlWithRequestUrl(baseUrl, parts[requestUrlIndex]);
  }

  return { parts, unresolvedVariables };
}

function createWorkflowStepResult(step: WorkflowRuntimeStep): WorkflowRunStepResult {
  const mode = step?.executionMode === "polling" ? "polling" : "once";

  return {
    stepId: step?.id ?? "",
    name: step?.name ?? "",
    mode,
    status: "pending",
    exitCode: null,
    stdout: "",
    stderr: "",
    attempt: 0,
    maxAttempts: mode === "polling" ? Math.max(1, Number(step?.maxAttempts ?? 1)) : 1,
    attempts: []
  };
}

function createWorkflowStepAttempt(attempt: number): WorkflowRunStepAttempt {
  return {
    attempt,
    status: "running",
    startedAt: new Date().toISOString(),
    exitCode: null,
    stdout: "",
    stderr: ""
  };
}

function syncWorkflowStepResultFromAttempt(stepResult: WorkflowRunStepResult, attempt: WorkflowRunStepAttempt): void {
  stepResult.startedAt = stepResult.startedAt ?? attempt.startedAt;
  stepResult.exitCode = attempt.exitCode;
  stepResult.stdout = attempt.stdout;
  stepResult.stderr = attempt.stderr;
  stepResult.attempt = attempt.attempt;
  stepResult.completionValue = attempt.completionValue;
}

function appendWorkflowStderr(current: string, message: string): string {
  if (!message) {
    return current;
  }

  if (current.split(/\r?\n/).includes(message)) {
    return current;
  }

  return [current, message].filter(Boolean).join("\n");
}

function markWorkflowStepCancelled(stepResult: WorkflowRunStepResult, message = WORKFLOW_RUN_CANCELLED_MESSAGE): void {
  stepResult.status = "cancelled";
  stepResult.finishedAt = stepResult.finishedAt ?? new Date().toISOString();
  stepResult.stderr = appendWorkflowStderr(stepResult.stderr, message);
}

function markActiveWorkflowStepCancelled(results: WorkflowRunStepResult[]): void {
  const activeStep =
    results.find((step) => step.status === "running") ??
    results.find((step) => step.status === "pending");

  if (!activeStep || activeStep.status === "success" || activeStep.status === "failed" || activeStep.status === "cancelled") {
    return;
  }

  markWorkflowStepCancelled(activeStep);
}

function isWorkflowRunCancelledError(error: unknown): boolean {
  return error instanceof WorkflowRunCancelledError;
}

function throwIfWorkflowRunCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new WorkflowRunCancelledError();
  }
}

function terminateWorkflowChild(child: ReturnType<typeof spawn> | null): void {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Process may have already exited between progress updates and the cancel request.
  }
}

function normalizeWorkflowCompareValue(value: unknown): string {
  return normalizeWorkflowVariableValue(value).trim().toLowerCase();
}

function getWorkflowConfiguredValues(values: unknown, fallback: string[]): string[] {
  const normalized = Array.isArray(values)
    ? values.map((value) => normalizeWorkflowCompareValue(value)).filter(Boolean)
    : [];

  return normalized.length ? normalized : fallback;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new WorkflowRunCancelledError());
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const handleAbort = () => {
      clearTimeout(timer);
      reject(new WorkflowRunCancelledError());
    };

    timer = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, Math.max(0, ms));

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function runCurlAttempt(
  step: WorkflowRuntimeStep,
  record: WorkflowRuntimeRecord,
  variables: Record<string, string>,
  attempt: WorkflowRunStepAttempt,
  onUpdate: () => void,
  timeoutMs = 120_000,
  signal?: AbortSignal,
  activeRun?: WorkflowActiveRunContext
): Promise<WorkflowRunStepAttempt> {
  return new Promise((resolve) => {
    const { parts, unresolvedVariables } = buildWorkflowCurlInvocation(step, record, variables);
    let settled = false;
    let timedOut = false;
    let child: ReturnType<typeof spawn> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let handleAbort: () => void = () => undefined;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
      }

      signal?.removeEventListener("abort", handleAbort);

      if (activeRun?.child === child) {
        activeRun.child = null;
      }
    };

    const settle = (status: "success" | "failed" | "cancelled", exitCode: number | null, stderrSuffix = "") => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      attempt.status = status;
      attempt.finishedAt = new Date().toISOString();
      attempt.exitCode = exitCode;

      if (stderrSuffix) {
        attempt.stderr = appendWorkflowStderr(attempt.stderr, stderrSuffix);
      }

      onUpdate();
      resolve(attempt);
    };

    handleAbort = () => {
      terminateWorkflowChild(child);
      settle("cancelled", null, WORKFLOW_RUN_CANCELLED_MESSAGE);
    };

    if (signal?.aborted) {
      settle("cancelled", null, WORKFLOW_RUN_CANCELLED_MESSAGE);
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });

    timer = setTimeout(() => {
      timedOut = true;
      terminateWorkflowChild(child);
      settle("failed", null, `curl 执行超时（${timeoutMs}ms）`);
    }, timeoutMs);

    if (parts[0] !== "curl") {
      settle("failed", null, "仅支持以 curl 开头的命令");
      return;
    }

    if (unresolvedVariables.length) {
      settle("failed", null, `变量未解析：${unresolvedVariables.join("、")}`);
      return;
    }

    try {
      child = spawn("curl", parts.slice(1), { shell: false });
      if (activeRun) {
        activeRun.child = child;
      }
    } catch (error) {
      settle("failed", null, error instanceof Error ? error.message : String(error));
      return;
    }

    child.stdout?.on("data", (chunk) => {
      attempt.stdout += chunk.toString();
      onUpdate();
    });

    child.stderr?.on("data", (chunk) => {
      attempt.stderr += chunk.toString();
      onUpdate();
    });

    child.on("error", (error) => {
      settle("failed", null, error.message);
    });

    child.on("close", (exitCode) => {
      settle(!timedOut && exitCode === 0 ? "success" : "failed", exitCode);
    });

    onUpdate();
  });
}

async function runWorkflowStep(
  step: WorkflowRuntimeStep,
  record: WorkflowRuntimeRecord,
  variables: Record<string, string>,
  stepResult: WorkflowRunStepResult,
  emitProgress: () => void,
  signal?: AbortSignal,
  activeRun?: WorkflowActiveRunContext
): Promise<"success" | "failed" | "cancelled"> {
  const mode = step?.executionMode === "polling" ? "polling" : "once";
  const maxAttempts = mode === "polling" ? Math.max(1, Number(step?.maxAttempts ?? 1)) : 1;
  const pollIntervalMs = Math.max(0, Number(step?.pollIntervalMs ?? 0));
  const successValues = getWorkflowConfiguredValues(step?.successValues, ["succeeded", "completed", "success", "done", "finished"]);
  const failureValues = getWorkflowConfiguredValues(step?.failureValues, ["failed", "error", "canceled", "cancelled", "fail"]);
  const completionPath = normalizeWorkflowJsonPath(step?.completionPath);

  throwIfWorkflowRunCancelled(signal);
  stepResult.mode = mode;
  stepResult.status = "running";
  stepResult.startedAt = stepResult.startedAt ?? new Date().toISOString();
  stepResult.maxAttempts = maxAttempts;
  emitProgress();

  if (mode === "polling" && !completionPath) {
    stepResult.status = "failed";
    stepResult.finishedAt = new Date().toISOString();
    stepResult.stderr = "轮询步骤缺少状态 JSONPath";
    emitProgress();
    return "failed";
  }

  for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex += 1) {
    throwIfWorkflowRunCancelled(signal);
    const attempt = createWorkflowStepAttempt(attemptIndex);
    stepResult.attempts.push(attempt);
    syncWorkflowStepResultFromAttempt(stepResult, attempt);
    emitProgress();

    await runCurlAttempt(
      step,
      record,
      variables,
      attempt,
      () => {
        syncWorkflowStepResultFromAttempt(stepResult, attempt);
        emitProgress();
      },
      120_000,
      signal,
      activeRun
    );

    syncWorkflowStepResultFromAttempt(stepResult, attempt);

    if (attempt.status === "cancelled") {
      markWorkflowStepCancelled(stepResult);
      emitProgress();
      return "cancelled";
    }

    if (attempt.status !== "success") {
      stepResult.status = "failed";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      emitProgress();
      return "failed";
    }

    if (mode === "once") {
      stepResult.status = "success";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      emitProgress();
      return "success";
    }

    const responseJson = parseWorkflowResponseJson(attempt.stdout);
    const completionValue = normalizeWorkflowVariableValue(readWorkflowJsonPath(responseJson, completionPath));
    const comparableCompletionValue = normalizeWorkflowCompareValue(completionValue);
    attempt.completionValue = completionValue;
    syncWorkflowStepResultFromAttempt(stepResult, attempt);

    if (failureValues.includes(comparableCompletionValue)) {
      stepResult.status = "failed";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      stepResult.stderr = appendWorkflowStderr(stepResult.stderr, `轮询命中失败状态：${completionValue || "空值"}`);
      emitProgress();
      return "failed";
    }

    if (successValues.includes(comparableCompletionValue)) {
      stepResult.status = "success";
      stepResult.finishedAt = attempt.finishedAt ?? new Date().toISOString();
      emitProgress();
      return "success";
    }

    emitProgress();

    if (attemptIndex < maxAttempts && pollIntervalMs > 0) {
      await sleep(pollIntervalMs, signal);
    }
  }

  stepResult.status = "failed";
  stepResult.finishedAt = new Date().toISOString();
  stepResult.stderr = appendWorkflowStderr(
    stepResult.stderr,
    `轮询超过最大轮次，最后状态：${stepResult.completionValue || "未读取到状态"}`
  );
  emitProgress();
  return "failed";
}

function getWorkflowResponseBody(stdout: string): string {
  const normalized = String(stdout ?? "").trim();

  if (!normalized) {
    return "";
  }

  if (!/^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(normalized)) {
    return normalized;
  }

  const parts = normalized.split(/\r?\n\r?\n/).filter(Boolean);
  return parts.at(-1)?.trim() ?? normalized;
}

function parseWorkflowResponseJson(stdout: string): unknown {
  const body = getWorkflowResponseBody(stdout);

  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    const objectStart = body.indexOf("{");
    const objectEnd = body.lastIndexOf("}");
    const arrayStart = body.indexOf("[");
    const arrayEnd = body.lastIndexOf("]");

    const objectCandidate = objectStart >= 0 && objectEnd > objectStart ? body.slice(objectStart, objectEnd + 1) : "";
    const arrayCandidate = arrayStart >= 0 && arrayEnd > arrayStart ? body.slice(arrayStart, arrayEnd + 1) : "";
    const candidate =
      objectCandidate && arrayCandidate
        ? objectStart < arrayStart
          ? objectCandidate
          : arrayCandidate
        : objectCandidate || arrayCandidate;

    if (!candidate) {
      return null;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

function normalizeWorkflowJsonPath(pathValue: unknown): string {
  const normalized = String(pathValue ?? "").trim();

  if (!normalized) {
    return "";
  }

  const dataPathMatch = normalized.match(/(?:^|\n)\s*data\s*:\s*([^\n]+)/i);
  return dataPathMatch?.[1]?.trim() ?? normalized;
}

function readWorkflowJsonPath(input: unknown, pathValue: unknown): unknown {
  const pathText = normalizeWorkflowJsonPath(pathValue);
  const normalizedPath = pathText.startsWith("$") ? pathText.slice(1) : pathText;
  const tokens = normalizedPath
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\./, "")
    .split(".")
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.reduce<unknown>((current, token) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current) && /^\d+$/.test(token)) {
      return current[Number(token)];
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[token];
    }

    return undefined;
  }, input);
}

function normalizeWorkflowVariableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function collectWorkflowStepVariables(step: WorkflowRuntimeStep, stdout: string): Record<string, string> {
  const responseJson = parseWorkflowResponseJson(stdout);
  const variables: Record<string, string> = {};

  if (!responseJson || !Array.isArray(step?.produces)) {
    return variables;
  }

  for (const binding of step.produces) {
    const name = String(binding?.name ?? "").trim();
    const path = normalizeWorkflowJsonPath(binding?.path);

    if (!name || !path) {
      continue;
    }

    const value = normalizeWorkflowVariableValue(readWorkflowJsonPath(responseJson, path));

    if (value) {
      variables[name] = value;
    }
  }

  return variables;
}

async function runWorkflowRecord(record: WorkflowRuntimeRecord, emitProgress?: WorkflowRunProgressEmitter) {
  const startedAt = new Date().toISOString();
  const steps = Array.isArray(record?.steps) ? record.steps : [];
  const results = steps.map((step) => createWorkflowStepResult(step));
  const variables: Record<string, string> = {};
  const progressEventId = String(record?.progressEventId ?? "").trim();
  const activeRun: WorkflowActiveRunContext | null = progressEventId
    ? { controller: new AbortController(), child: null }
    : null;
  const signal = activeRun?.controller.signal;
  let status: WorkflowRunStatus = "running";
  let finishedAt: string | undefined;

  if (progressEventId && activeRun) {
    activeWorkflowRuns.set(progressEventId, activeRun);
  }

  const buildPayload = (): WorkflowRunProgressPayload => ({
    progressEventId: record?.progressEventId,
    status,
    startedAt,
    ...(finishedAt ? { finishedAt } : {}),
    variables: { ...variables },
    steps: results.map((step) => ({
      ...step,
      attempts: step.attempts.map((attempt) => ({ ...attempt }))
    }))
  });

  const emitSnapshot = () => {
    if (record?.progressEventId && emitProgress) {
      emitProgress(buildPayload());
    }
  };

  emitSnapshot();

  try {
    for (const [index, step] of steps.entries()) {
      throwIfWorkflowRunCancelled(signal);

      const stepResult = results[index];
      const waitBeforeMs = Number(step?.waitBeforeMs ?? 0);

      if (waitBeforeMs > 0) {
        stepResult.status = "running";
        stepResult.startedAt = stepResult.startedAt ?? new Date().toISOString();
        stepResult.stderr = `等待 ${waitBeforeMs}ms 后执行`;
        emitSnapshot();
        await sleep(waitBeforeMs, signal);
        stepResult.stderr = "";
      }

      const outcome = await runWorkflowStep(step, record, variables, stepResult, emitSnapshot, signal, activeRun ?? undefined);

      if (outcome === "cancelled") {
        status = "cancelled";
        break;
      }

      if (outcome !== "success") {
        break;
      }

      throwIfWorkflowRunCancelled(signal);
      Object.assign(variables, collectWorkflowStepVariables(step, stepResult.stdout ?? ""));
      emitSnapshot();
    }

    if (status === "running") {
      status = signal?.aborted
        ? "cancelled"
        : results.length > 0 && results.every((result) => result.status === "success")
          ? "success"
          : "failed";
    }
  } catch (error) {
    if (!isWorkflowRunCancelledError(error)) {
      throw error;
    }

    status = "cancelled";
  } finally {
    if (status === "cancelled") {
      markActiveWorkflowStepCancelled(results);
    }

    finishedAt = new Date().toISOString();
    emitSnapshot();

    if (progressEventId) {
      activeWorkflowRuns.delete(progressEventId);
    }
  }

  return buildPayload();
}

function cancelWorkflowRecordRun(progressEventId: unknown): { cancelled: boolean; progressEventId: string } {
  const runId = String(progressEventId ?? "").trim();

  if (!runId) {
    return { cancelled: false, progressEventId: "" };
  }

  const activeRun = activeWorkflowRuns.get(runId);

  if (!activeRun) {
    return { cancelled: false, progressEventId: runId };
  }

  activeRun.controller.abort();

  terminateWorkflowChild(activeRun.child);

  return { cancelled: true, progressEventId: runId };
}

type InfoRadarRefreshRequest = {
  cardId?: string;
  windowId?: string;
};

type InfoRadarWechatResolveRequest = {
  cardId?: string;
  windowId?: string;
  itemId?: string;
};

type InfoRadarSourceFetchResult = {
  items: InfoRadarItem[];
  message?: string;
  skipped?: boolean;
  attempted?: boolean;
};

const INFO_RADAR_WECHAT_DISCOVERY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const infoRadarXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  trimValues: true
});

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function decodeBasicHtmlEntities(value: unknown): string {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => {
      const valueCode = Number(code);
      return Number.isFinite(valueCode) ? String.fromCodePoint(valueCode) : "";
    });
}

function stripHtml(value: unknown): string {
  return decodeBasicHtmlEntities(
    String(value ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function truncateInfoRadarText(value: unknown, maxLength = 280): string {
  const text = stripHtml(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function normalizeInfoRadarComparableText(value: unknown): string {
  return stripHtml(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeInfoRadarComparableUrl(value: unknown): string {
  const url = String(value ?? "").trim();

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";

    for (const volatileParam of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm", "from"]) {
      parsed.searchParams.delete(volatileParam);
    }

    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function getInfoRadarComparableDate(value: unknown): string {
  const timestamp = new Date(String(value ?? "")).getTime();

  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  return normalizeInfoRadarComparableText(value).slice(0, 16);
}

function getInfoRadarStableHash(value: unknown): string {
  return createHmac("sha256", "gordon-info-radar")
    .update(String(value ?? ""))
    .digest("base64url")
    .slice(0, 28);
}

function readXmlText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(readXmlText).filter(Boolean).join(" ");
  }

  if (typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  return readXmlText(record["#cdata"] ?? record["#text"] ?? record.value ?? "");
}

function resolveInfoRadarUrl(value: unknown, baseUrl = ""): string {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  try {
    return baseUrl ? new URL(raw, baseUrl).toString() : new URL(raw).toString();
  } catch {
    return raw;
  }
}

function isInfoRadarWechatTemporaryUrl(value: unknown): boolean {
  const url = String(value ?? "").trim();

  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      /(?:^|\.)mp\.weixin\.qq\.com$/i.test(parsed.hostname) &&
      parsed.pathname === "/s" &&
      (parsed.searchParams.has("signature") || parsed.searchParams.has("timestamp") || parsed.searchParams.has("src"))
    );
  } catch {
    return false;
  }
}

function readAtomLink(value: unknown, baseUrl = ""): string {
  for (const link of toArray(value)) {
    if (typeof link === "string") {
      return resolveInfoRadarUrl(link, baseUrl);
    }

    if (!link || typeof link !== "object") {
      continue;
    }

    const record = link as Record<string, unknown>;
    const href = String(record["@_href"] ?? "").trim();
    const rel = String(record["@_rel"] ?? "alternate").trim();

    if (href && (!rel || rel === "alternate")) {
      return resolveInfoRadarUrl(href, baseUrl);
    }
  }

  return "";
}

function readRssItemLink(item: Record<string, unknown>, baseUrl = ""): string {
  const link = item.link;

  if (typeof link === "string") {
    return resolveInfoRadarUrl(link, baseUrl);
  }

  if (link && typeof link === "object") {
    const linkRecord = link as Record<string, unknown>;
    const href = String(linkRecord["@_href"] ?? linkRecord.href ?? "").trim();

    if (href) {
      return resolveInfoRadarUrl(href, baseUrl);
    }

    const text = readXmlText(link);

    if (text) {
      return resolveInfoRadarUrl(text, baseUrl);
    }
  }

  const guid = item.guid;

  if (typeof guid === "string" && /^https?:\/\//i.test(guid)) {
    return resolveInfoRadarUrl(guid, baseUrl);
  }

  return "";
}

function normalizeInfoRadarDate(value: unknown): string | undefined {
  const text = readXmlText(value).trim();

  if (!text) {
    return undefined;
  }

  const timestamp = new Date(text).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : text;
}

function buildInfoRadarItem(
  source: InfoRadarSource,
  rawItem: {
    title?: unknown;
    url?: unknown;
    resolvedUrl?: unknown;
    summary?: unknown;
    author?: unknown;
    publishedAt?: unknown;
    imageUrl?: unknown;
    tags?: unknown[];
  },
  baseUrl = ""
): InfoRadarItem | null {
  const title = truncateInfoRadarText(readXmlText(rawItem.title), 180);
  const url = resolveInfoRadarUrl(rawItem.url, baseUrl);
  const resolvedUrl = resolveInfoRadarUrl(rawItem.resolvedUrl, baseUrl);
  const summary = truncateInfoRadarText(rawItem.summary, 320);
  const imageUrl = resolveInfoRadarUrl(rawItem.imageUrl, baseUrl);

  if (!title && !url) {
    return null;
  }

  const fetchedAt = new Date().toISOString();
  const isWechatSource = source.kind === "wechat";
  const shouldStoreUrl = !isWechatSource && !isInfoRadarWechatTemporaryUrl(url);
  const shouldStoreResolvedUrl = !isWechatSource && !isInfoRadarWechatTemporaryUrl(resolvedUrl);
  const author = rawItem.author ? truncateInfoRadarText(readXmlText(rawItem.author), 80) : "";
  const publishedAt = rawItem.publishedAt ? normalizeInfoRadarDate(rawItem.publishedAt) ?? readXmlText(rawItem.publishedAt) : "";
  const stableKey = getInfoRadarItemDedupeKey({
    sourceId: source.id,
    sourceTitle: source.title,
    sourceKind: source.kind,
    title: title || url,
    url: shouldStoreUrl ? url : "",
    ...(shouldStoreResolvedUrl ? { resolvedUrl } : {}),
    ...(author ? { author } : {}),
    ...(publishedAt ? { publishedAt } : {}),
  });

  return {
    id: `info_item_${getInfoRadarStableHash(stableKey)}`,
    sourceId: source.id,
    sourceTitle: source.title,
    sourceKind: source.kind,
    title: title || url,
    url: shouldStoreUrl ? url : "",
    ...(shouldStoreResolvedUrl ? { resolvedUrl } : {}),
    summary,
    ...(author ? { author } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    fetchedAt,
    tags: [...(source.tags ?? []), ...(rawItem.tags ?? []).map((tag) => readXmlText(tag)).filter(Boolean)].slice(0, 8),
    matchedKeywords: [],
    score: 0,
    status: "new"
  };
}

function parseInfoRadarFeed(xmlText: string, source: InfoRadarSource, baseUrl = ""): InfoRadarItem[] {
  const parsed = infoRadarXmlParser.parse(xmlText) as Record<string, unknown>;
  const rssChannel = (parsed.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
  const rdfChannel = (parsed["rdf:RDF"] ?? parsed.RDF) as Record<string, unknown> | undefined;
  const atomFeed = parsed.feed as Record<string, unknown> | undefined;

  const rssItems = toArray(rssChannel?.item ?? rdfChannel?.item).map((item) => item as Record<string, unknown>);
  const atomEntries = toArray(atomFeed?.entry).map((entry) => entry as Record<string, unknown>);
  const items: InfoRadarItem[] = [];

  for (const item of rssItems) {
    const normalized = buildInfoRadarItem(
      source,
      {
        title: item.title,
        url: readRssItemLink(item, baseUrl),
        summary: item.description ?? item["content:encoded"] ?? item.summary,
        author: item.author ?? item["dc:creator"],
        publishedAt: item.pubDate ?? item.published ?? item.updated,
        imageUrl:
          (item["media:thumbnail"] as Record<string, unknown> | undefined)?.["@_url"] ??
          (item["media:content"] as Record<string, unknown> | undefined)?.["@_url"] ??
          (item.enclosure as Record<string, unknown> | undefined)?.["@_url"],
        tags: toArray(item.category)
      },
      baseUrl
    );

    if (normalized) {
      items.push(normalized);
    }
  }

  for (const entry of atomEntries) {
    const normalized = buildInfoRadarItem(
      source,
      {
        title: entry.title,
        url: readAtomLink(entry.link, baseUrl) || readXmlText(entry.id),
        summary: entry.summary ?? entry.content,
        author: (entry.author as Record<string, unknown> | undefined)?.name ?? entry.author,
        publishedAt: entry.published ?? entry.updated,
        imageUrl:
          (entry["media:thumbnail"] as Record<string, unknown> | undefined)?.["@_url"] ??
          (entry["media:content"] as Record<string, unknown> | undefined)?.["@_url"],
        tags: toArray(entry.category)
      },
      baseUrl
    );

    if (normalized) {
      items.push(normalized);
    }
  }

  return items;
}

function readHtmlMeta(htmlText: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapedName}["'][^>]*>`, "i");
  return decodeBasicHtmlEntities(htmlText.match(pattern)?.[1] ?? htmlText.match(reversePattern)?.[1] ?? "").trim();
}

function readHtmlAttribute(htmlText: string, attributeName: string): string {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\s${escapedName}=["']([^"']+)["']`, "i");
  return decodeBasicHtmlEntities(htmlText.match(pattern)?.[1] ?? "").trim();
}

function normalizeInfoRadarSearchQuery(query: string): string {
  return String(query ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function createBingRssSearchUrl(query: string): string {
  const normalizedQuery = normalizeInfoRadarSearchQuery(query);
  const params = new URLSearchParams({
    format: "rss",
    q: normalizedQuery
  });

  return `https://www.bing.com/search?${params.toString()}`;
}

function createGoogleNewsRssSearchUrl(query: string): string {
  const normalizedQuery = normalizeInfoRadarSearchQuery(query);
  const params = new URLSearchParams({
    q: normalizedQuery,
    hl: "zh-CN",
    gl: "CN",
    ceid: "CN:zh-Hans"
  });

  return `https://news.google.com/rss/search?${params.toString()}`;
}

function createArxivSearchUrl(query: string): string {
  const normalizedQuery = normalizeInfoRadarSearchQuery(query);
  const params = new URLSearchParams({
    query: normalizedQuery,
    searchtype: "all",
    max_results: "20"
  });
  return `https://export.arxiv.org/search/?${params.toString()}`;
}

function isAcademicSearchQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const academicSignals = [
    "paper", "arxiv", "research", "algorithm", "neural", "model",
    "learning", "theory", "quantum", "bio", "gene", "protein",
    "论文", "算法", "研究", "神经", "模型", "量子", "生物", "基因"
  ];
  return academicSignals.some((signal) => lower.includes(signal));
}

function createInfoRadarWechatSearchUrl(query: string): string {
  return `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(normalizeInfoRadarSearchQuery(query))}`;
}

function getInfoRadarHostName(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function looksLikeInfoRadarArticleUrl(url: string, sourceUrl = ""): boolean {
  const normalizedUrl = String(url ?? "").trim();

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return false;
  }

  const lowerUrl = normalizedUrl.toLowerCase();

  if (/\.(?:png|jpe?g|gif|svg|webp|ico|css|js|zip|pdf)(?:[?#].*)?$/i.test(lowerUrl)) {
    return false;
  }

  if (/#(?:comments|respond|main|content)$/i.test(lowerUrl)) {
    return false;
  }

  const sourceHost = getInfoRadarHostName(sourceUrl);
  const urlHost = getInfoRadarHostName(normalizedUrl);

  if (sourceHost && urlHost && sourceHost !== urlHost) {
    return false;
  }

  try {
    const parsed = new URL(normalizedUrl);
    const pathName = parsed.pathname.toLowerCase();
    return (
      /\/(?:news|blog|post|posts|article|articles|research|discover|technology|ai|20\d{2}|archives?)\//i.test(pathName) ||
      /\/20\d{2}\/\d{1,2}\//.test(pathName) ||
      pathName.split("/").filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
}

function extractInfoRadarHtmlItems(htmlText: string, source: InfoRadarSource, finalUrl = ""): InfoRadarItem[] {
  const html = String(htmlText ?? "");
  const baseUrl = finalUrl || source.url;
  const items: InfoRadarItem[] = [];
  const seenUrls = new Set<string>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const genericTitleRejects = new Set([
    "home",
    "about",
    "contact",
    "privacy",
    "terms",
    "careers",
    "menu",
    "more",
    "learn more",
    "read more",
    "subscribe",
    "首页",
    "关于",
    "联系我们",
    "隐私",
    "更多",
    "阅读更多",
    "阅读全文",
    "订阅"
  ]);

  for (const match of html.matchAll(anchorPattern)) {
    const attributes = match[1] ?? "";
    const innerHtml = match[2] ?? "";
    const href = readHtmlAttribute(attributes, "href");
    const url = resolveInfoRadarUrl(href, baseUrl);

    if (!looksLikeInfoRadarArticleUrl(url, baseUrl)) {
      continue;
    }

    const dedupeUrl = url.toLowerCase().replace(/#.*$/, "").replace(/\/$/, "");

    if (seenUrls.has(dedupeUrl)) {
      continue;
    }

    const fullText = stripHtml(innerHtml);
    const title =
      truncateInfoRadarText(
        stripHtml(innerHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ?? "") ||
          readHtmlAttribute(attributes, "aria-label") ||
          readHtmlAttribute(attributes, "title") ||
          fullText,
        180
      );
    const titleKey = title.toLowerCase();

    if (title.length < 6 || genericTitleRejects.has(titleKey)) {
      continue;
    }

    seenUrls.add(dedupeUrl);

    const imageUrl =
      readHtmlAttribute(innerHtml.match(/<img\b[\s\S]*?>/i)?.[0] ?? "", "src") ||
      readHtmlAttribute(innerHtml.match(/<img\b[\s\S]*?>/i)?.[0] ?? "", "data-src");
    const summary = fullText && fullText !== title ? fullText : "";
    const item = buildInfoRadarItem(
      source,
      {
        title,
        url,
        summary: summary || `${source.title} 发现的新内容`,
        imageUrl,
        tags: source.tags
      },
      baseUrl
    );

    if (item) {
      items.push(item);
    }

    if (items.length >= INFO_RADAR_MAX_ITEMS_PER_SOURCE * 2) {
      break;
    }
  }

  return items;
}

function parseInfoRadarWebPage(htmlText: string, source: InfoRadarSource, finalUrl = ""): InfoRadarItem[] {
  const html = String(htmlText ?? "");
  const extractedItems = extractInfoRadarHtmlItems(html, source, finalUrl);

  if (extractedItems.length) {
    return extractedItems;
  }

  const title =
    readHtmlMeta(html, "og:title") ||
    stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") ||
    source.title;
  const summary =
    readHtmlMeta(html, "description") ||
    readHtmlMeta(html, "og:description") ||
    truncateInfoRadarText(html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "", 320);
  const item = buildInfoRadarItem(
    source,
    {
      title,
      url: finalUrl || source.url,
      summary,
      imageUrl: readHtmlMeta(html, "og:image"),
      tags: source.tags
    },
    source.url
  );

  return item ? [item] : [];
}

function parseInfoRadarWechatSearch(
  htmlText: string,
  source: InfoRadarSource,
  finalUrl = "",
  options: { keepResolvedUrl?: boolean } = {}
): InfoRadarItem[] {
  const html = String(htmlText ?? "");
  const baseUrl = finalUrl || "https://weixin.sogou.com/weixin";
  const items: InfoRadarItem[] = [];
  const blocks = html.match(/<li\b[^>]*id=["']sogou_vr_11002601_box_[^"']+["'][\s\S]*?<\/li>/gi) ?? [];

  for (const block of blocks) {
    const titleAnchor = block.match(/<h3[^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<\/h3>/i);
    const href = titleAnchor ? readHtmlAttribute(titleAnchor[1] ?? "", "href") : "";
    const title = truncateInfoRadarText(
      stripHtml(String(titleAnchor?.[2] ?? "").replace(/<!--red_beg-->|<!--red_end-->/g, "")),
      180
    );
    const summary = truncateInfoRadarText(
      stripHtml(
        (block.match(/<p[^>]+class=["']txt-info["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "").replace(
          /<!--red_beg-->|<!--red_end-->/g,
          ""
        )
      ),
      320
    );
    const author = stripHtml(block.match(/<span[^>]+class=["']all-time-y2["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const epochSeconds = Number(block.match(/timeConvert\(['"]?(\d+)['"]?\)/i)?.[1] ?? "");
    const imageTag = block.match(/<img\b[\s\S]*?>/i)?.[0] ?? "";
    const imageUrl = readHtmlAttribute(imageTag, "data-src") || readHtmlAttribute(imageTag, "src");
    const item = buildInfoRadarItem(
      source,
      {
        title,
        url: "",
        resolvedUrl: href ? resolveInfoRadarUrl(href, baseUrl) : "",
        summary,
        author,
        publishedAt: Number.isFinite(epochSeconds) && epochSeconds > 0 ? new Date(epochSeconds * 1000).toISOString() : undefined,
        imageUrl,
        tags: source.tags
      },
      baseUrl
    );

    if (item) {
      items.push(options.keepResolvedUrl && href ? { ...item, resolvedUrl: resolveInfoRadarUrl(href, baseUrl) } : item);
    }
  }

  return items;
}

async function fetchInfoRadarSearchSource(source: InfoRadarSource): Promise<InfoRadarSourceFetchResult> {
  const query = normalizeInfoRadarSearchQuery(source.query || source.url);

  if (!query) {
    return {
      items: [],
      message: `${source.title} 缺少搜索关键词`
    };
  }

  // 直接给定 URL 时按原样抓取；否则聚合多个公开搜索 RSS 源，扩大信息覆盖面。
  if (/^https?:\/\//i.test(query)) {
    const response = await fetchInfoRadarText(query);
    const items = response.text.trim().startsWith("<")
      ? parseInfoRadarFeed(response.text, source, response.finalUrl)
      : [];

    return {
      items,
      message: items.length ? undefined : `${source.title} 暂无可解析的搜索结果`
    };
  }

  const searchUrls: string[] = [createGoogleNewsRssSearchUrl(query), createBingRssSearchUrl(query)];

  // 学术类查询额外加入 arXiv Atom 搜索，覆盖论文、算法、生物等领域。
  if (isAcademicSearchQuery(query)) {
    searchUrls.push(createArxivSearchUrl(query));
  }
  const aggregated: InfoRadarItem[] = [];
  const failures: string[] = [];

  for (const searchUrl of searchUrls) {
    try {
      const response = await fetchInfoRadarText(searchUrl);

      if (response.text.trim().startsWith("<")) {
        aggregated.push(...parseInfoRadarFeed(response.text, source, response.finalUrl));
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  const items = mergeInfoRadarItems([], aggregated);

  return {
    items,
    message: items.length
      ? undefined
      : failures.length
        ? `${source.title} 搜索源暂不可用：${failures.slice(0, 2).join("；")}`
        : `${source.title} 暂无可解析的搜索结果`
  };
}

async function fetchInfoRadarWechatSource(source: InfoRadarSource): Promise<InfoRadarSourceFetchResult> {
  const query = normalizeInfoRadarSearchQuery(source.query || source.title);

  if (!query) {
    return {
      items: [],
      message: `${source.title} 缺少公众号搜索关键词`
    };
  }

  const searchUrl =
    source.url && /^https?:\/\//i.test(source.url)
      ? source.url
      : createInfoRadarWechatSearchUrl(query);
  const response = await fetchInfoRadarText(searchUrl);
  const items = parseInfoRadarWechatSearch(response.text, source, response.finalUrl);

  return {
    items,
    message: items.length ? undefined : `${source.title} 暂无可解析的公众号结果，可能被搜索页限流`
  };
}

function buildInfoRadarWechatResolveQuery(item: InfoRadarItem, source?: InfoRadarSource): string {
  return normalizeInfoRadarSearchQuery(
    [
      item.title,
      item.author,
      source?.query,
      source?.title && source.title !== item.sourceTitle ? source.title : item.sourceTitle
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getInfoRadarWechatResolveScore(candidate: InfoRadarItem, target: InfoRadarItem): number {
  const candidateTitle = String(candidate.title ?? "").trim().toLowerCase();
  const targetTitle = String(target.title ?? "").trim().toLowerCase();
  const candidateAuthor = String(candidate.author ?? "").trim().toLowerCase();
  const targetAuthor = String(target.author ?? "").trim().toLowerCase();

  let score = 0;

  if (candidateTitle && targetTitle && candidateTitle === targetTitle) {
    score += 100;
  } else if (candidateTitle && targetTitle && (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle))) {
    score += 55;
  }

  if (candidateAuthor && targetAuthor && candidateAuthor === targetAuthor) {
    score += 30;
  }

  const candidatePublishedAt = new Date(candidate.publishedAt ?? "").getTime();
  const targetPublishedAt = new Date(target.publishedAt ?? "").getTime();

  if (Number.isFinite(candidatePublishedAt) && Number.isFinite(targetPublishedAt)) {
    const dayGap = Math.abs(candidatePublishedAt - targetPublishedAt) / 86_400_000;

    if (dayGap < 1) {
      score += 20;
    } else if (dayGap <= 3) {
      score += 10;
    }
  }

  if (candidate.resolvedUrl && !isInfoRadarWechatTemporaryUrl(candidate.resolvedUrl)) {
    score += 5;
  }

  return score;
}

function getInfoRadarSourceLatestFetchedAt(source: InfoRadarSource, radarWindow: InfoRadarWindow): number {
  return Math.max(
    0,
    ...(radarWindow.items ?? [])
      .filter((item) => item.sourceId === source.id || (item.sourceKind === source.kind && item.sourceTitle === source.title))
      .map((item) => new Date(item.fetchedAt || item.publishedAt || "").getTime())
      .filter((timestamp) => Number.isFinite(timestamp))
  );
}

async function fetchInfoRadarText(url: string, timeoutMs = INFO_RADAR_FETCH_TIMEOUT_MS): Promise<{ text: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
        "user-agent": "Mozilla/5.0 (compatible; Gordon Info Radar/1.0; +https://gordon.local)"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      text: await response.text(),
      finalUrl: response.url || url
    };
  } finally {
    clearTimeout(timer);
  }
}

function scoreInfoRadarItem(item: InfoRadarItem, radarWindow: InfoRadarWindow): InfoRadarItem | null {
  const keywords = (radarWindow.keywords ?? []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  const negativeKeywords = (radarWindow.negativeKeywords ?? []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  const searchableText = [
    item.title,
    item.summary,
    item.sourceTitle,
    item.author,
    item.tags?.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  if (negativeKeywords.some((keyword) => searchableText.includes(keyword))) {
    return null;
  }

  const keywordMatches = keywords.filter((keyword) => searchableText.includes(keyword));

  if (keywords.length && !keywordMatches.length) {
    return null;
  }

  const publishedTime = new Date(item.publishedAt ?? "").getTime();
  const ageHours = Number.isFinite(publishedTime) ? Math.max(0, (Date.now() - publishedTime) / 3_600_000) : Number.POSITIVE_INFINITY;
  const recencyScore =
    ageHours <= 24 ? 10 : ageHours <= 72 ? 7 : ageHours <= 24 * 14 ? 4 : item.publishedAt ? 2 : 0;
  const sourceScore = (item.sourceKind === "rss" || item.sourceKind === "github" || item.sourceKind === "reddit") ? 4
    : item.sourceKind === "web_page" ? 3
    : item.sourceKind === "wechat" ? 2 : 1;

  return {
    ...item,
    matchedKeywords: keywordMatches,
    score:
      keywordMatches.length * 10 +
      recencyScore +
      sourceScore +
      (item.summary ? 2 : 0) +
      (item.imageUrl ? 1 : 0)
  };
}

function getInfoRadarItemDedupeKey(
  item: Pick<InfoRadarItem, "sourceId" | "sourceTitle" | "sourceKind" | "title" | "url"> &
    Partial<Pick<InfoRadarItem, "resolvedUrl" | "author" | "publishedAt">>
): string {
  const title = normalizeInfoRadarComparableText(item.title);
  const author = normalizeInfoRadarComparableText(item.author);
  const sourceTitle = normalizeInfoRadarComparableText(item.sourceTitle);

  if (item.sourceKind === "wechat") {
    const publishedDate = getInfoRadarComparableDate(item.publishedAt);
    return ["wechat", title, author, publishedDate].filter(Boolean).join(":");
  }

  const url = normalizeInfoRadarComparableUrl(item.url || item.resolvedUrl);

  if (url) {
    return url;
  }

  return [item.sourceKind, item.sourceId || sourceTitle, title].filter(Boolean).join(":");
}

function getInfoRadarPublishedRank(item: InfoRadarItem): number {
  const timestamp = new Date(item.publishedAt ?? "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getInfoRadarFetchedRank(item: InfoRadarItem): number {
  const timestamp = new Date(item.fetchedAt ?? "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareInfoRadarItems(left: InfoRadarItem, right: InfoRadarItem): number {
  const leftPublishedRank = getInfoRadarPublishedRank(left);
  const rightPublishedRank = getInfoRadarPublishedRank(right);
  const leftHasPublishedAt = leftPublishedRank > 0;
  const rightHasPublishedAt = rightPublishedRank > 0;

  if (leftHasPublishedAt !== rightHasPublishedAt) {
    return leftHasPublishedAt ? -1 : 1;
  }

  if (rightPublishedRank !== leftPublishedRank) {
    return rightPublishedRank - leftPublishedRank;
  }

  const scoreRank = (right.score ?? 0) - (left.score ?? 0);

  if (scoreRank !== 0) {
    return scoreRank;
  }

  return getInfoRadarFetchedRank(right) - getInfoRadarFetchedRank(left);
}

function getInfoRadarStatusRank(status: InfoRadarItem["status"]): number {
  if (status === "saved") {
    return 3;
  }

  if (status === "ignored") {
    return 2;
  }

  return 1;
}

function getPreferredInfoRadarStatus(left?: InfoRadarItem, right?: InfoRadarItem): InfoRadarItem["status"] {
  const leftStatus = left?.status ?? "new";
  const rightStatus = right?.status ?? "new";
  return getInfoRadarStatusRank(leftStatus) >= getInfoRadarStatusRank(rightStatus) ? leftStatus : rightStatus;
}

function getPreferredInfoRadarId(left: InfoRadarItem | undefined, right: InfoRadarItem): string {
  if (!left) {
    return right.id;
  }

  if (left.status === "saved" || left.status === "ignored") {
    return left.id;
  }

  if (right.status === "saved" || right.status === "ignored") {
    return right.id;
  }

  return compareInfoRadarItems(left, right) <= 0 ? left.id : right.id;
}

function getLatestInfoRadarTimestamp(left?: string, right?: string): string {
  const leftTime = new Date(left ?? "").getTime();
  const rightTime = new Date(right ?? "").getTime();

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime >= rightTime ? String(left) : String(right);
  }

  return String(right || left || new Date().toISOString());
}

function stripInfoRadarVolatileItemLinks(item: InfoRadarItem): InfoRadarItem {
  if (item.sourceKind !== "wechat") {
    return item;
  }

  const { resolvedUrl: _resolvedUrl, ...rest } = item;

  return {
    ...rest,
    url: ""
  };
}

function mergeInfoRadarItemPair(existing: InfoRadarItem | undefined, incoming: InfoRadarItem): InfoRadarItem {
  const sanitizedIncoming = stripInfoRadarVolatileItemLinks(incoming);

  if (!existing) {
    return sanitizedIncoming;
  }

  const sanitizedExisting = stripInfoRadarVolatileItemLinks(existing);
  const preferred = compareInfoRadarItems(sanitizedIncoming, sanitizedExisting) < 0 ? sanitizedIncoming : sanitizedExisting;

  return {
    ...sanitizedExisting,
    ...preferred,
    id: getPreferredInfoRadarId(sanitizedExisting, sanitizedIncoming),
    status: getPreferredInfoRadarStatus(sanitizedExisting, sanitizedIncoming),
    fetchedAt: getLatestInfoRadarTimestamp(sanitizedExisting.fetchedAt, sanitizedIncoming.fetchedAt),
    tags: Array.from(new Set([...(sanitizedExisting.tags ?? []), ...(sanitizedIncoming.tags ?? [])])).slice(0, 8),
    matchedKeywords: Array.from(
      new Set([...(sanitizedExisting.matchedKeywords ?? []), ...(sanitizedIncoming.matchedKeywords ?? [])])
    ).slice(0, 8),
    score: Math.max(Number(sanitizedExisting.score ?? 0), Number(sanitizedIncoming.score ?? 0))
  };
}

function mergeInfoRadarItems(existingItems: InfoRadarItem[], fetchedItems: InfoRadarItem[]): InfoRadarItem[] {
  const byKey = new Map<string, InfoRadarItem>();

  for (const item of existingItems ?? []) {
    const key = getInfoRadarItemDedupeKey(item);

    if (key) {
      byKey.set(key, mergeInfoRadarItemPair(byKey.get(key), item));
    }
  }

  for (const item of fetchedItems) {
    const key = getInfoRadarItemDedupeKey(item);

    if (key) {
      byKey.set(key, mergeInfoRadarItemPair(byKey.get(key), item));
    }
  }

  return Array.from(byKey.values())
    .sort(compareInfoRadarItems)
    .slice(0, INFO_RADAR_MAX_WINDOW_ITEMS);
}

async function resolveInfoRadarWechatItemUrl(
  request: InfoRadarWechatResolveRequest
): Promise<{ card: unknown; window: InfoRadarWindow; item: InfoRadarItem; url: string }> {
  const cardId = String(request?.cardId ?? "").trim();
  const windowId = String(request?.windowId ?? "").trim();
  const itemId = String(request?.itemId ?? "").trim();
  const library = await listWorkflowLibrary();
  const card =
    library.find((entry) => entry.id === cardId && entry.kind === "info-radar") ??
    library.find((entry) => entry.kind === "info-radar");

  if (!card) {
    throw new Error("未找到信息雷达卡片");
  }

  const radarWindow =
    (card.infoWindows ?? []).find((entry) => entry.id === windowId) ??
    (card.infoWindows ?? [])[0];

  if (!radarWindow) {
    throw new Error("未找到信息窗口");
  }

  const targetItem = (radarWindow.items ?? []).find((item) => item.id === itemId);

  if (!targetItem) {
    throw new Error("未找到公众号条目");
  }

  if (targetItem.sourceKind !== "wechat") {
    const url = targetItem.url || targetItem.resolvedUrl || "";

    if (!/^https?:\/\//i.test(url)) {
      throw new Error("当前条目没有可打开的来源链接");
    }

    return { card, window: radarWindow, item: targetItem, url };
  }

  const source = (radarWindow.sources ?? []).find((entry) => entry.id === targetItem.sourceId);
  const query = buildInfoRadarWechatResolveQuery(targetItem, source);

  if (!query) {
    throw new Error("公众号条目缺少可用于重新检索的标题或作者");
  }

  const resolverSource: InfoRadarSource = {
    ...(source ?? {
      id: targetItem.sourceId || `info_source_resolver_${randomUUID()}`,
      kind: "wechat",
      title: targetItem.sourceTitle || "公众号",
      url: "",
      query,
      enabled: true,
      tags: targetItem.tags ?? [],
      notes: "",
      updatedAt: new Date().toISOString()
    }),
    kind: "wechat",
    query,
    url: ""
  };
  const response = await fetchInfoRadarText(createInfoRadarWechatSearchUrl(query));
  const candidates = parseInfoRadarWechatSearch(response.text, resolverSource, response.finalUrl, { keepResolvedUrl: true })
    .map((candidate) => ({
      item: candidate,
      score: getInfoRadarWechatResolveScore(candidate, targetItem)
    }))
    .filter((candidate) => candidate.item.resolvedUrl && candidate.score >= 55)
    .sort((left, right) => right.score - left.score);
  const best = candidates[0]?.item ?? null;
  const resolvedUrl = best?.resolvedUrl ?? "";

  if (!resolvedUrl) {
    throw new Error("没有重新检索到可用的公众号链接");
  }

  const now = new Date().toISOString();
  const nextSources = (radarWindow.sources ?? []).map((entry) =>
    entry.id === targetItem.sourceId
      ? {
          ...entry,
          lastDiscoveredAt: now,
          updatedAt: now
        }
      : entry
  );
  const nextWindow: InfoRadarWindow = {
    ...radarWindow,
    sources: nextSources,
    updatedAt: now
  };
  const nextCard = {
    ...card,
    updatedAt: now,
    lastUsedAt: now,
    infoWindows: (card.infoWindows ?? []).map((entry) => (entry.id === nextWindow.id ? nextWindow : entry))
  };
  const nextLibrary = await upsertWorkflowLibraryItem(nextCard);
  const savedCard = nextLibrary.find((entry) => entry.id === nextCard.id) ?? nextCard;
  const savedWindow = (savedCard.infoWindows ?? []).find((entry) => entry.id === nextWindow.id) ?? nextWindow;
  const savedItem = (savedWindow.items ?? []).find((item) => item.id === targetItem.id) ?? targetItem;

  return {
    card: savedCard,
    window: savedWindow,
    item: {
      ...savedItem,
      resolvedUrl
    },
    url: resolvedUrl
  };
}

async function fetchInfoRadarSource(source: InfoRadarSource, radarWindow: InfoRadarWindow): Promise<InfoRadarSourceFetchResult> {
  if (!source.enabled) {
    return { items: [] };
  }

  if (source.kind === "search") {
    const result = await fetchInfoRadarSearchSource(source);
    return {
      ...result,
      items: result.items.slice(0, INFO_RADAR_MAX_ITEMS_PER_SOURCE)
    };
  }

  // GitHub 和 Reddit 本质上都是 RSS/Atom 源，走 RSS 解析链路即可，
  // 但在无 URL 时提供有意义的错误提示。
  if (source.kind === "github" || source.kind === "reddit") {
    if (!source.url) {
      const hint = source.kind === "github"
        ? "请填写 GitHub RSS URL，例如 https://github.com/trending.atom 或仓库 releases RSS"
        : "请填写 Reddit RSS URL，例如 https://www.reddit.com/r/MachineLearning/.rss";
      return { items: [], message: `${source.title} 缺少 URL — ${hint}` };
    }
    const response = await fetchInfoRadarText(source.url);
    const items = parseInfoRadarFeed(response.text, source, response.finalUrl);
    return { items: items.slice(0, INFO_RADAR_MAX_ITEMS_PER_SOURCE) };
  }

  if (source.kind === "wechat") {
    const latestDiscoveredAt = new Date(source.lastDiscoveredAt ?? "").getTime();
    const latestFetchedAt = Math.max(
      Number.isFinite(latestDiscoveredAt) ? latestDiscoveredAt : 0,
      getInfoRadarSourceLatestFetchedAt(source, radarWindow)
    );

    if (latestFetchedAt > 0 && Date.now() - latestFetchedAt < INFO_RADAR_WECHAT_DISCOVERY_COOLDOWN_MS) {
      return {
        items: [],
        skipped: true,
        message: `${source.title} 公众号线索处于低频检索保护中，本次跳过搜索页访问`
      };
    }

    const result = await fetchInfoRadarWechatSource(source);
    return {
      ...result,
      attempted: true,
      items: result.items.slice(0, INFO_RADAR_MAX_ITEMS_PER_SOURCE)
    };
  }

  if (source.kind === "manual") {
    return {
      items: [],
      message: `${source.title} 是手工来源，刷新时不会自动抓取`
    };
  }

  if (!source.url) {
    return {
      items: [],
      message: `${source.title} 缺少 URL`
    };
  }

  const response = await fetchInfoRadarText(source.url);
  const items =
    source.kind === "rss"
      ? parseInfoRadarFeed(response.text, source, response.finalUrl)
      : parseInfoRadarWebPage(response.text, source, response.finalUrl);

  return {
    items: items.slice(0, INFO_RADAR_MAX_ITEMS_PER_SOURCE)
  };
}

async function refreshInfoRadarWindow(request: InfoRadarRefreshRequest): Promise<InfoRadarRefreshResult> {
  const cardId = String(request?.cardId ?? "").trim();
  const windowId = String(request?.windowId ?? "").trim();
  const library = await listWorkflowLibrary();
  const card =
    library.find((entry) => entry.id === cardId && entry.kind === "info-radar") ??
    library.find((entry) => entry.kind === "info-radar");

  if (!card) {
    throw new Error("未找到信息雷达卡片");
  }

  const radarWindow =
    (card.infoWindows ?? []).find((entry) => entry.id === windowId) ??
    (card.infoWindows ?? [])[0];

  if (!radarWindow) {
    throw new Error("未找到信息窗口");
  }

  const startedAt = new Date().toISOString();
  const enabledSources = (radarWindow.sources ?? []).filter((source) => source.enabled !== false);
  const fetchedItems: InfoRadarItem[] = [];
  const messages: string[] = [];
  const blockingMessages: string[] = [];
  const discoveredWechatSourceIds = new Set<string>();

  if (!enabledSources.length) {
    messages.push("当前窗口没有启用的信息源");
    blockingMessages.push("当前窗口没有启用的信息源");
  }

  for (const source of enabledSources) {
    try {
      const result = await fetchInfoRadarSource(source, radarWindow);

      if (source.kind === "wechat" && result.attempted) {
        discoveredWechatSourceIds.add(source.id);
      }

      fetchedItems.push(
        ...result.items
          .map((item) => scoreInfoRadarItem(item, radarWindow))
          .filter((item): item is InfoRadarItem => Boolean(item))
      );

      if (result.message) {
        messages.push(result.message);

        if (!result.skipped) {
          blockingMessages.push(result.message);
        }
      }
    } catch (error) {
      const message = `${source.title || source.url}: ${error instanceof Error ? error.message : String(error)}`;
      messages.push(message);
      blockingMessages.push(message);
    }
  }

  const now = new Date().toISOString();
  const status: InfoRadarRefreshRun["status"] =
    blockingMessages.length && fetchedItems.length
      ? "partial"
      : blockingMessages.length
        ? "failed"
        : "success";
  const run: InfoRadarRefreshRun = {
    id: `info_run_${randomUUID()}`,
    status,
    startedAt,
    finishedAt: now,
    sourceCount: enabledSources.length,
    itemCount: fetchedItems.length,
    message:
      messages.length > 0
        ? messages.slice(0, 4).join("；")
        : fetchedItems.length > 0
          ? `刷新完成，获取 ${fetchedItems.length} 条信息`
          : "刷新完成，暂无匹配的新信息"
  };
  const nextSources = (radarWindow.sources ?? []).map((source) =>
    discoveredWechatSourceIds.has(source.id)
      ? {
          ...source,
          lastDiscoveredAt: now,
          updatedAt: now
        }
      : source
  );
  const nextWindow: InfoRadarWindow = {
    ...radarWindow,
    sources: nextSources,
    items: mergeInfoRadarItems(radarWindow.items ?? [], fetchedItems),
    runHistory: [run, ...(radarWindow.runHistory ?? [])].slice(0, 20),
    lastRefreshedAt: now,
    updatedAt: now
  };
  const nextCard = {
    ...card,
    updatedAt: now,
    lastUsedAt: now,
    infoWindows: (card.infoWindows ?? []).map((entry) => (entry.id === nextWindow.id ? nextWindow : entry))
  };
  const nextLibrary = await upsertWorkflowLibraryItem(nextCard);
  const savedCard = nextLibrary.find((entry) => entry.id === nextCard.id) ?? nextCard;
  const savedWindow = (savedCard.infoWindows ?? []).find((entry) => entry.id === nextWindow.id) ?? nextWindow;

  return {
    card: savedCard,
    window: savedWindow,
    run
  };
}

function normalizeFinanceBriefRange(value: unknown): FinanceBriefRange {
  const range = String(value ?? "").trim();
  return FINANCE_BRIEF_RANGES.has(range as FinanceBriefRange) ? (range as FinanceBriefRange) : "1mo";
}

function normalizeFinanceBriefInterval(value: unknown): FinanceBriefInterval {
  const interval = String(value ?? "").trim();
  return FINANCE_BRIEF_INTERVALS.has(interval as FinanceBriefInterval) ? (interval as FinanceBriefInterval) : "1d";
}

function normalizeFinanceBriefQueryWindow(
  range: FinanceBriefRange,
  interval: FinanceBriefInterval
): { range: FinanceBriefRange; interval: FinanceBriefInterval } {
  if (interval === "1m" && range !== "1d" && range !== "5d") {
    return { range: "1d", interval };
  }

  if ((interval === "5m" || interval === "15m" || interval === "30m" || interval === "60m") && !["1d", "5d", "1mo"].includes(range)) {
    return { range: "1d", interval };
  }

  return { range, interval };
}

function normalizeFinanceBriefSymbolValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function parseFinanceBriefNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseFinanceBriefPrice(value: unknown): number | null {
  const numberValue = parseFinanceBriefNumber(value);
  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function readFinanceBriefArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

const FINANCE_BRIEF_TROY_OUNCE_GRAMS = 31.1034768;
const FINANCE_BRIEF_USD_CNY_SYMBOL = "CNY=X";
const FINANCE_BRIEF_GOLD_SYMBOLS = new Set(["GC=F", "XAUUSD=X", "XAU=X", "MGC=F"]);
const FINANCE_BRIEF_INTRADAY_INTERVALS = new Set<FinanceBriefInterval>(["1m", "5m", "15m", "30m", "60m"]);

function createYahooFinanceChartUrl(symbol: string, range: FinanceBriefRange, interval: FinanceBriefInterval): string {
  const encodedSymbol = encodeURIComponent(symbol);
  const params = new URLSearchParams({
    range,
    interval,
    includePrePost: "false"
  });

  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?${params.toString()}`;
}

function isFinanceBriefGoldSymbol(symbolConfig: FinanceBriefSymbol): boolean {
  const symbol = normalizeFinanceBriefSymbolValue(symbolConfig.symbol);
  const displayName = String(symbolConfig.displayName ?? "").toLowerCase();
  const notes = String(symbolConfig.notes ?? "").toLowerCase();

  return (
    FINANCE_BRIEF_GOLD_SYMBOLS.has(symbol) ||
    (symbolConfig.assetKind === "commodity" && (displayName.includes("gold") || displayName.includes("黄金") || notes.includes("gold")))
  );
}

function isFinanceBriefContinuousIntradaySymbol(symbolConfig: FinanceBriefSymbol): boolean {
  return ["commodity", "forex", "crypto"].includes(symbolConfig.assetKind) || isFinanceBriefGoldSymbol(symbolConfig);
}

function getFinanceBriefFetchRange(symbolConfig: FinanceBriefSymbol, range: FinanceBriefRange, interval: FinanceBriefInterval): FinanceBriefRange {
  if (range === "1d" && FINANCE_BRIEF_INTRADAY_INTERVALS.has(interval) && isFinanceBriefContinuousIntradaySymbol(symbolConfig)) {
    return "5d";
  }

  return range;
}

function trimFinanceBriefPointsForDisplay(
  points: FinanceBriefQuoteSnapshot["points"],
  range: FinanceBriefRange,
  interval: FinanceBriefInterval
): FinanceBriefQuoteSnapshot["points"] {
  if (range !== "1d" || !FINANCE_BRIEF_INTRADAY_INTERVALS.has(interval) || points.length <= 1) {
    return points;
  }

  const sortedPoints = points
    .slice()
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
  const lastTime = new Date(sortedPoints[sortedPoints.length - 1]?.time ?? "").getTime();

  if (!Number.isFinite(lastTime)) {
    return sortedPoints;
  }

  const windowStart = lastTime - 24 * 60 * 60 * 1000;
  const trimmedPoints = sortedPoints.filter((point) => {
    const pointTime = new Date(point.time).getTime();
    return Number.isFinite(pointTime) && pointTime >= windowStart;
  });

  return trimmedPoints.length >= 2 ? trimmedPoints : sortedPoints;
}

function readYahooChartMarketTime(meta: Record<string, unknown>): string | undefined {
  const rawTime = Number(meta.regularMarketTime ?? 0);

  if (!Number.isFinite(rawTime) || rawTime <= 0) {
    return undefined;
  }

  return new Date(rawTime * 1000).toISOString();
}

function readYahooChartTimezoneMeta(meta: Record<string, unknown>): Pick<FinanceBriefQuoteSnapshot, "exchangeTimezoneName" | "timezone" | "gmtoffset"> {
  const exchangeTimezoneName = String(meta.exchangeTimezoneName ?? "").trim();
  const timezone = String(meta.timezone ?? "").trim();
  const gmtoffset = parseFinanceBriefNumber(meta.gmtoffset);

  return {
    ...(exchangeTimezoneName ? { exchangeTimezoneName } : {}),
    ...(timezone ? { timezone } : {}),
    ...(gmtoffset !== null ? { gmtoffset } : {})
  };
}

function normalizeYahooChartPoint(
  timestamp: unknown,
  quote: Record<string, unknown[]>,
  index: number
): FinanceBriefQuoteSnapshot["points"][number] | null {
  const timeSeconds = Number(timestamp);
  const open = parseFinanceBriefPrice(readFinanceBriefArray(quote.open)[index]);
  const high = parseFinanceBriefPrice(readFinanceBriefArray(quote.high)[index]);
  const low = parseFinanceBriefPrice(readFinanceBriefArray(quote.low)[index]);
  const close = parseFinanceBriefPrice(readFinanceBriefArray(quote.close)[index]);
  const volume = parseFinanceBriefNumber(readFinanceBriefArray(quote.volume)[index]);

  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0 || open === null || high === null || low === null || close === null) {
    return null;
  }

  if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
    return null;
  }

  return {
    time: new Date(timeSeconds * 1000).toISOString(),
    open,
    high,
    low,
    close,
    ...(volume !== null ? { volume } : {})
  };
}

async function fetchYahooFinanceLatestPrice(symbol: string): Promise<number | null> {
  const normalizedSymbol = normalizeFinanceBriefSymbolValue(symbol);

  if (!normalizedSymbol) {
    return null;
  }

  const sourceUrl = createYahooFinanceChartUrl(normalizedSymbol, "5d", "1d");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FINANCE_BRIEF_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; Gordon Finance Brief/1.0; +https://gordon.local)"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as Record<string, unknown>;
    const chart = payload.chart as Record<string, unknown> | undefined;
    const result = readFinanceBriefArray<Record<string, unknown>>(chart?.result)[0];
    const meta = (result?.meta && typeof result.meta === "object" ? result.meta : {}) as Record<string, unknown>;

    return parseFinanceBriefPrice(meta.regularMarketPrice);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function createFinanceBriefDerivedMetrics(
  symbolConfig: FinanceBriefSymbol,
  quote: FinanceBriefQuoteSnapshot,
  calculatedAt: string
): Promise<FinanceBriefDerivedMetric[]> {
  const pricePerOunce = parseFinanceBriefPrice(quote.regularMarketPrice);

  if (!isFinanceBriefGoldSymbol(symbolConfig) || pricePerOunce === null) {
    return [];
  }

  const usdPerGram = pricePerOunce / FINANCE_BRIEF_TROY_OUNCE_GRAMS;
  const metrics: FinanceBriefDerivedMetric[] = [
    {
      id: "gold_usd_per_gram",
      label: "美元克价",
      value: usdPerGram,
      unit: "USD/g",
      sourceName: "Yahoo Finance",
      sourceSymbol: quote.symbol,
      calculatedAt,
      notes: "按 1 金衡盎司 = 31.1034768 克由黄金盎司报价换算"
    }
  ];
  const usdCny = await fetchYahooFinanceLatestPrice(FINANCE_BRIEF_USD_CNY_SYMBOL);

  if (usdCny !== null) {
    metrics.push({
      id: "gold_cny_per_gram",
      label: "人民币克价",
      value: usdPerGram * usdCny,
      unit: "CNY/g",
      sourceName: "Yahoo Finance",
      sourceSymbol: FINANCE_BRIEF_USD_CNY_SYMBOL,
      calculatedAt,
      notes: "按 Yahoo Finance USD/CNY 汇率由美元克价换算"
    });
  }

  return metrics;
}

async function fetchYahooFinanceChart(
  symbolConfig: FinanceBriefSymbol,
  range: FinanceBriefRange,
  interval: FinanceBriefInterval
): Promise<FinanceBriefSnapshot> {
  const symbol = normalizeFinanceBriefSymbolValue(symbolConfig.symbol);

  if (!symbol) {
    throw new Error("金融标的缺少 symbol");
  }

  const fetchRange = getFinanceBriefFetchRange(symbolConfig, range, interval);
  const sourceUrl = createYahooFinanceChartUrl(symbol, fetchRange, interval);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FINANCE_BRIEF_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; Gordon Finance Brief/1.0; +https://gordon.local)"
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance HTTP ${response.status}`);
    }

    const payload = await response.json() as Record<string, unknown>;
    const chart = payload.chart as Record<string, unknown> | undefined;
    const errorPayload = chart?.error as Record<string, unknown> | null | undefined;

    if (errorPayload) {
      throw new Error(String(errorPayload.description ?? errorPayload.code ?? "Yahoo Finance 返回错误"));
    }

    const result = readFinanceBriefArray<Record<string, unknown>>(chart?.result)[0];

    if (!result) {
      throw new Error("Yahoo Finance 没有返回行情结果");
    }

    const meta = (result.meta && typeof result.meta === "object" ? result.meta : {}) as Record<string, unknown>;
    const indicators = (result.indicators && typeof result.indicators === "object" ? result.indicators : {}) as Record<string, unknown>;
    const quote = readFinanceBriefArray<Record<string, unknown[]>>(indicators.quote)[0] ?? {};
    const timestamps = readFinanceBriefArray(result.timestamp);
    const rawPoints = timestamps
      .map((timestamp, index) => normalizeYahooChartPoint(timestamp, quote, index))
      .filter((point): point is FinanceBriefQuoteSnapshot["points"][number] => Boolean(point));
    const points = trimFinanceBriefPointsForDisplay(rawPoints, range, interval);
    const regularMarketPrice = parseFinanceBriefPrice(meta.regularMarketPrice);
    const previousClose = parseFinanceBriefPrice(meta.chartPreviousClose);
    const change = regularMarketPrice !== null && previousClose !== null ? regularMarketPrice - previousClose : null;
    const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;
    const marketTime = readYahooChartMarketTime(meta);
    const timezoneMeta = readYahooChartTimezoneMeta(meta);
    const fetchedAt = new Date().toISOString();
    const displayName = String(meta.longName ?? meta.shortName ?? symbolConfig.displayName ?? symbol).trim() || symbol;
    const quoteSnapshot: FinanceBriefQuoteSnapshot = {
      symbol,
      displayName,
      provider: "yahoo",
      currency: String(meta.currency ?? symbolConfig.currency ?? "").trim(),
      exchangeName: String(meta.fullExchangeName ?? meta.exchangeName ?? symbolConfig.market ?? "").trim(),
      ...timezoneMeta,
      ...(marketTime ? { marketTime } : {}),
      regularMarketPrice,
      previousClose,
      dayHigh: parseFinanceBriefPrice(meta.regularMarketDayHigh),
      dayLow: parseFinanceBriefPrice(meta.regularMarketDayLow),
      volume: parseFinanceBriefNumber(meta.regularMarketVolume),
      change,
      changePercent,
      fetchedAt,
      points
    };
    const derivedMetrics = await createFinanceBriefDerivedMetrics(symbolConfig, quoteSnapshot, fetchedAt);

    return {
      symbolId: symbolConfig.id,
      range,
      interval,
      fetchedAt,
      sourceName: "Yahoo Finance",
      sourceUrl,
      quote: quoteSnapshot,
      ...(derivedMetrics.length ? { derivedMetrics } : {})
    };
  } finally {
    clearTimeout(timer);
  }
}

async function queryFinanceBriefQuote(request: FinanceBriefQuoteRequest): Promise<{ card: unknown; snapshot: FinanceBriefSnapshot }> {
  const cardId = String(request?.cardId ?? "").trim();
  const symbolId = String(request?.symbolId ?? "").trim();
  const requestedSymbol = normalizeFinanceBriefSymbolValue(request?.symbol);
  const requestedRange = normalizeFinanceBriefRange(request?.range);
  const requestedInterval = normalizeFinanceBriefInterval(request?.interval);
  const { range, interval } = normalizeFinanceBriefQueryWindow(requestedRange, requestedInterval);
  const library = await listWorkflowLibrary();
  const card =
    library.find((entry) => entry.id === cardId && entry.kind === "finance-brief") ??
    library.find((entry) => entry.kind === "finance-brief");

  if (!card) {
    throw new Error("未找到金融快报卡片");
  }

  const financeBrief = card.financeBrief;
  const configuredSymbols = financeBrief?.symbols ?? [];
  const configuredSymbol =
    configuredSymbols.find((entry) => entry.id === symbolId) ??
    configuredSymbols.find((entry) => normalizeFinanceBriefSymbolValue(entry.symbol) === requestedSymbol) ??
    configuredSymbols.find((entry) => entry.id === financeBrief?.activeSymbolId) ??
    configuredSymbols[0];
  const shouldUseRequestedSymbol =
    requestedSymbol && (!configuredSymbol || normalizeFinanceBriefSymbolValue(configuredSymbol.symbol) !== requestedSymbol);
  const symbolConfig: FinanceBriefSymbol | null = shouldUseRequestedSymbol
    ? {
        id: `finance_symbol_custom_${getInfoRadarStableHash(requestedSymbol)}`,
        symbol: requestedSymbol,
        displayName: requestedSymbol,
        assetKind: "other",
        market: "",
        currency: "",
        provider: "yahoo",
        notes: "临时查询标的",
        sortOrder: configuredSymbols.length,
        updatedAt: new Date().toISOString()
      }
    : configuredSymbol ?? null;

  if (!symbolConfig) {
    throw new Error("金融快报没有可查询的标的");
  }

  const snapshot = await fetchYahooFinanceChart(symbolConfig, range, interval);
  const now = new Date().toISOString();
  const nextSymbols = configuredSymbols.some((entry) => entry.id === symbolConfig.id)
    ? configuredSymbols.map((entry) => entry.id === symbolConfig.id ? { ...entry, updatedAt: now } : entry)
    : [
        ...configuredSymbols,
        {
          ...symbolConfig,
          sortOrder: configuredSymbols.length,
          updatedAt: now
        }
      ];
  const nextCard = {
    ...card,
    updatedAt: now,
    lastUsedAt: now,
    financeBrief: {
      symbols: nextSymbols,
      activeSymbolId: symbolConfig.id,
      range,
      interval,
      updatedAt: now,
      lastSnapshot: snapshot
    }
  };
  const nextLibrary = await upsertWorkflowLibraryItem(nextCard);
  const savedCard = nextLibrary.find((entry) => entry.id === nextCard.id) ?? nextCard;

  return {
    card: savedCard,
    snapshot
  };
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: MAIN_WINDOW_MIN_WIDTH,
    height: MAIN_WINDOW_MIN_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    title: "Gordon",
    icon: appIconPath,
    backgroundColor: "#07111d",
    autoHideMenuBar: true,
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 18, y: 18 }
        }
      : {}),
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await window.loadFile(path.join(currentDir, "renderer", "index.html"));
}

async function pollModelBalanceUsage(): Promise<void> {
  if (modelBalancePollingInFlight) {
    return;
  }

  modelBalancePollingInFlight = true;

  try {
    const settings = await listModelSettings();
    const profiles = settings.profiles.filter(
      (profile) => profile.apiKey?.trim() && String(profile.balanceQueryCode ?? "").trim()
    );

    for (const profile of profiles) {
      try {
        await queryModelBalance({
          profile,
          persistResult: true,
          historySource: "scheduled"
        });
      } catch (error) {
        console.warn(
          `[model-balance] scheduled usage polling failed for ${profile.displayName}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch (error) {
    console.warn("[model-balance] scheduled usage polling failed:", error instanceof Error ? error.message : error);
  } finally {
    modelBalancePollingInFlight = false;
  }
}

function startModelBalanceUsagePolling(): void {
  if (modelBalancePollingTimer) {
    return;
  }

  modelBalancePollingTimer = setInterval(() => {
    void pollModelBalanceUsage();
  }, MODEL_BALANCE_POLL_INTERVAL_MS);

  setTimeout(() => {
    void pollModelBalanceUsage();
  }, MODEL_BALANCE_INITIAL_POLL_DELAY_MS);
}

app.whenReady().then(async () => {
  await ensureGordonHomeDirectory();

  if (process.platform === "darwin" && app.dock) {
    const dockIcon = nativeImage.createFromPath(appIconPath);

    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  ipcMain.handle("gordon:bootstrap", async () => buildWorkbenchSnapshot());
  ipcMain.handle("gordon:prompt-assets:read", async (_event, promptIds: unknown) => {
    if (!Array.isArray(promptIds)) {
      throw new Error("提示词资产读取参数必须是数组");
    }

    const assets: Partial<Record<PromptAssetId, string>> = {};

    for (const promptId of promptIds) {
      if (typeof promptId !== "string" || !isPromptAssetId(promptId)) {
        throw new Error(`未知提示词资产：${String(promptId)}`);
      }

      assets[promptId] = readPromptAsset(promptId);
    }

    return assets;
  });
  ipcMain.handle("gordon:model-settings:list", async () => toCloneableIpcValue(await listModelSettings()));
  ipcMain.handle("gordon:model-settings:upsert", async (_event, profile) =>
    toCloneableIpcValue(await upsertModelProfile(toCloneableIpcValue(profile)))
  );
  ipcMain.handle("gordon:model-settings:activate", async (_event, profileId: string) =>
    toCloneableIpcValue(await activateModelProfile(profileId))
  );
  ipcMain.handle("gordon:model-settings:toggle-status", async (_event, profileId: string) =>
    toCloneableIpcValue(await toggleModelProfileStatus(profileId))
  );
  ipcMain.handle("gordon:model-settings:delete", async (_event, profileId: string) =>
    toCloneableIpcValue(await deleteModelProfile(profileId))
  );
  ipcMain.handle("gordon:model-settings:reorder", async (_event, profileIds: string[]) =>
    toCloneableIpcValue(await reorderModelProfiles(toCloneableIpcValue(profileIds)))
  );
  ipcMain.handle("gordon:model:balance-history", async (_event, profileId?: string) =>
    toCloneableIpcValue(await listModelBalanceHistory(profileId))
  );
  ipcMain.handle("gordon:model:invoke-text", async (_event, request) => {
    const requestId = typeof request?.requestId === "string" && request.requestId.trim() ? request.requestId.trim() : "";
    const abortController = requestId ? new AbortController() : null;

    if (requestId && abortController) {
      modelTextAbortControllers.set(requestId, abortController);
    }

    try {
      return await invokeActiveModel(request, abortController ? { signal: abortController.signal } : {});
    } finally {
      if (requestId) {
        modelTextAbortControllers.delete(requestId);
      }
    }
  });
  ipcMain.handle("gordon:model:cancel-text", async (_event, requestId) => {
    const normalizedRequestId = typeof requestId === "string" ? requestId.trim() : "";
    const abortController = normalizedRequestId ? modelTextAbortControllers.get(normalizedRequestId) : null;

    if (!abortController) {
      return false;
    }

    abortController.abort();
    modelTextAbortControllers.delete(normalizedRequestId);
    return true;
  });
  ipcMain.handle("gordon:model:query-balance", async (_event, request) =>
    toCloneableIpcValue(await queryModelBalance(toCloneableIpcValue(request)))
  );
  ipcMain.handle("gordon:skills:list", async () => listSkillDefinitions());
  ipcMain.handle("gordon:skills:upsert", async (_event, skill) => upsertSkillDefinition(skill));
  ipcMain.handle("gordon:skills:import-from-github", async (_event, request) => importSkillDefinitionFromGithub(request));
  ipcMain.handle("gordon:skills:toggle-status", async (_event, skillId: string) => toggleSkillDefinitionStatus(skillId));
  ipcMain.handle("gordon:skills:delete", async (_event, skillId: string) => deleteSkillDefinition(skillId));
  ipcMain.handle("gordon:mcp-servers:list", async () => listMcpServers());
  ipcMain.handle("gordon:mcp-servers:upsert", async (_event, server) => upsertMcpServer(server));
  ipcMain.handle("gordon:mcp-servers:toggle-status", async (_event, serverId: string) => toggleMcpServerStatus(serverId));
  ipcMain.handle("gordon:mcp-servers:delete", async (_event, serverId: string) => deleteMcpServer(serverId));
  ipcMain.handle("gordon:mcp-servers:list-tools", async (_event, serverId: string) => listToolsFromMcpServer(serverId));
  ipcMain.handle("gordon:mcp-servers:call-tool", async (_event, request) => callToolOnMcpServer(request));
  ipcMain.handle("gordon:tool-configs:list", async () => listToolConfigs());
  ipcMain.handle("gordon:tool-configs:upsert", async (_event, config) => upsertToolConfig(config));
  ipcMain.handle("gordon:tool-configs:toggle-status", async (_event, configId: string) => toggleToolConfigStatus(configId));
  ipcMain.handle("gordon:agent-profiles:list", async () => listAgentProfiles());
  ipcMain.handle("gordon:agent-profiles:upsert", async (_event, profile) => upsertAgentProfile(profile));
  ipcMain.handle("gordon:agent-profiles:toggle-status", async (_event, profileId: string) =>
    toggleAgentProfileStatus(profileId)
  );
  ipcMain.handle("gordon:agent-profiles:delete", async (_event, profileId: string) => deleteAgentProfile(profileId));
  ipcMain.handle("gordon:agent:run", async (event, request) => {
    const grantedWorkspaceRoots = new Set<string>();
    let computerUseGranted = false;
    const autoGrantPermissions = request?.permissionMode === "auto";
    const progressEventId = typeof request?.progressEventId === "string" && request.progressEventId.trim()
      ? request.progressEventId.trim()
      : "";
    const abortController = new AbortController();

    if (progressEventId) {
      agentRunAbortControllers.set(progressEventId, abortController);
      agentRunGuidanceQueues.set(progressEventId, []);
    }

    try {
      const result = await runAgent(toCloneableIpcValue(request), {
        signal: abortController.signal,
        consumeRuntimeGuidance: async (lastGuidanceId) => {
          if (!progressEventId) {
            return [];
          }

          const queue = agentRunGuidanceQueues.get(progressEventId) ?? [];

          if (!lastGuidanceId) {
            return queue.map((item) => toCloneableIpcValue(item) as AgentRuntimeGuidance);
          }

          const lastIndex = queue.findIndex((item) => item.id === lastGuidanceId);
          const nextItems = lastIndex >= 0 ? queue.slice(lastIndex + 1) : queue;

          return nextItems.map((item) => toCloneableIpcValue(item) as AgentRuntimeGuidance);
        },
        onProgress: (payload: AgentRunProgressEvent) => {
          if (!event.sender.isDestroyed()) {
            try {
              event.sender.send("gordon:agent:progress", toCloneableIpcValue(payload));
            } catch (error) {
              console.error("Failed to send agent progress event", error);
            }
          }
        },
        onWorkspacePermissionRequest: async (permissionRequest) => {
          if (autoGrantPermissions) {
            grantedWorkspaceRoots.add(permissionRequest.suggestedRoot);
            return true;
          }

          if (grantedWorkspaceRoots.has(permissionRequest.suggestedRoot)) {
            return true;
          }

          const ownerWindow = BrowserWindow.fromWebContents(event.sender);
          const granted = await showGordonConfirmWindow(ownerWindow, {
            tone: "warning",
            eyebrow: "Permission",
            title: "Gordon 需要访问外部路径",
            message: "是否允许 Gordon 本次访问工作区外的路径？授权只对当前这次 Agent 运行生效，不会写入长期配置。",
            detailLines: [
              `请求路径：${permissionRequest.path}`,
              `授权范围：${permissionRequest.suggestedRoot}`,
              `工具：${permissionRequest.serverName} / ${permissionRequest.toolName}`
            ],
            confirmText: "允许本次访问",
            cancelText: "拒绝"
          });

          if (granted) {
            grantedWorkspaceRoots.add(permissionRequest.suggestedRoot);
          }

          return granted;
        },
        onComputerUsePermissionRequest: async (permissionRequest) => {
          if (autoGrantPermissions) {
            computerUseGranted = true;
            return true;
          }

          if (computerUseGranted) {
            return true;
          }

          const ownerWindow = BrowserWindow.fromWebContents(event.sender);
          const granted = await showGordonConfirmWindow(ownerWindow, {
            tone: "danger",
            eyebrow: "Computer Use",
            title: "Gordon 需要使用桌面控制",
            message: "是否允许 Gordon 本次读取和控制你的桌面？授权只对当前这次 Agent 运行生效，后续运行会重新询问。",
            detailLines: [
              `动作：${permissionRequest.action}`,
              `工具：${permissionRequest.serverName} / ${permissionRequest.toolName}`,
              `原因：${permissionRequest.reason}`
            ],
            confirmText: "允许本次使用",
            cancelText: "拒绝"
          });

          if (granted) {
            computerUseGranted = true;
          }

          return granted;
        },
        onToolPermissionRequest: async (permissionRequest) => {
          if (autoGrantPermissions) {
            return true;
          }

          const ownerWindow = BrowserWindow.fromWebContents(event.sender);
          return showGordonConfirmWindow(ownerWindow, {
            tone: permissionRequest.sideEffects === "destructive" ? "danger" : "warning",
            eyebrow: "Tool Permission",
            title: "Gordon 需要执行高风险工具",
            message: "是否允许 Gordon 本次执行这个会改变本地状态的工具？授权只对当前参数生效。",
            detailLines: [
              `工具：${permissionRequest.serverName} / ${permissionRequest.toolName}`,
              `风险：${permissionRequest.riskLevel}`,
              `影响：${permissionRequest.sideEffects === "destructive" ? "可能删除或替换资产" : "会写入、生成或改变本地状态"}`,
              `参数：${permissionRequest.argumentsPreview}`,
              permissionRequest.expectedOutcome ? `预期：${permissionRequest.expectedOutcome}` : "",
              permissionRequest.verificationMethod ? `验证：${permissionRequest.verificationMethod}` : ""
            ].filter(Boolean),
            confirmText: "允许本次执行",
            cancelText: "拒绝"
          });
        }
      });

      return toCloneableIpcValue(result);
    } finally {
      if (progressEventId) {
        agentRunAbortControllers.delete(progressEventId);
        agentRunGuidanceQueues.delete(progressEventId);
      }
    }
  });
  ipcMain.handle("gordon:agent:add-guidance", async (_event, progressEventId, guidance) => {
    const normalizedProgressEventId = typeof progressEventId === "string" ? progressEventId.trim() : "";
    const content = typeof guidance === "string" ? guidance.trim() : "";

    if (!normalizedProgressEventId || !content || !agentRunAbortControllers.has(normalizedProgressEventId)) {
      return false;
    }

    const item: AgentRuntimeGuidance = {
      id: `agent_guidance_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      createdAt: new Date().toISOString()
    };
    const queue = agentRunGuidanceQueues.get(normalizedProgressEventId) ?? [];
    agentRunGuidanceQueues.set(normalizedProgressEventId, [...queue, item]);

    return true;
  });
  ipcMain.handle("gordon:agent:cancel-run", async (_event, progressEventId) => {
    const normalizedProgressEventId = typeof progressEventId === "string" ? progressEventId.trim() : "";
    const abortController = normalizedProgressEventId ? agentRunAbortControllers.get(normalizedProgressEventId) : null;

    if (!abortController) {
      return false;
    }

    abortController.abort();
    agentRunAbortControllers.delete(normalizedProgressEventId);
    return true;
  });
  ipcMain.handle("gordon:command-workshop:list", async () => listCommandWorkshopSessions());
  ipcMain.handle("gordon:command-workshop:select-attachments", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择要发送给 Gordon 的文件",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "常用文件",
          extensions: [
            "txt",
            "md",
            "csv",
            "tsv",
            "json",
            "xml",
            "yaml",
            "yml",
            "pdf",
            "docx",
            "pptx",
            "xlsx",
            "xls",
            "png",
            "jpg",
            "jpeg",
            "gif",
            "webp",
            "svg",
            "mp4",
            "mov",
            "webm"
          ]
        },
        { name: "所有文件", extensions: ["*"] }
      ]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return [];
    }

    const attachments = await Promise.all(result.filePaths.map((filePath) => readCommandWorkshopAttachment(filePath)));
    return toCloneableIpcValue(attachments);
  });
  ipcMain.handle("gordon:command-workshop:upsert", async (_event, session) => upsertCommandWorkshopSession(session));
  ipcMain.handle("gordon:command-workshop:delete", async (_event, sessionId: string) =>
    deleteCommandWorkshopSession(sessionId)
  );
  ipcMain.handle("gordon:command-workshop:export-message", async (event, request: CommandWorkshopMessageExportRequest) => {
    const exportRequest = normalizeCommandWorkshopMessageExportRequest(request);
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const extension = exportRequest.format;
    const saveDialogOptions = {
      title: extension === "pdf" ? "导出 AI 回复为 PDF" : "导出 AI 回复为 DOCX",
      defaultPath: path.join(app.getPath("documents"), exportRequest.fileName),
      filters: [
        {
          name: extension === "pdf" ? "PDF 文档" : "Word 文档",
          extensions: [extension]
        }
      ]
    } satisfies Electron.SaveDialogOptions;
    const dialogResult = ownerWindow
      ? await dialog.showSaveDialog(ownerWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (dialogResult.canceled || !dialogResult.filePath) {
      return null;
    }

    const normalizedFilePath = dialogResult.filePath.toLowerCase().endsWith(`.${extension}`)
      ? dialogResult.filePath
      : `${dialogResult.filePath}.${extension}`;

    await mkdir(path.dirname(normalizedFilePath), { recursive: true });

    const writtenBytes =
      extension === "pdf"
        ? await exportCommandWorkshopMessageAsPdf(exportRequest, normalizedFilePath)
        : await exportCommandWorkshopMessageAsDocx(exportRequest, normalizedFilePath);

    return {
      filePath: normalizedFilePath,
      fileName: path.basename(normalizedFilePath),
      format: extension,
      writtenBytes
    };
  });
  ipcMain.handle("gordon:workflow-library:upsert", async (_event, item) => upsertWorkflowLibraryItem(item));
  ipcMain.handle("gordon:workflow-library:run-record", async (event, record) =>
    runWorkflowRecord(record, (payload) =>
      event.sender.send("gordon:workflow-library:progress", toCloneableIpcValue(payload))
    )
  );
  ipcMain.handle("gordon:workflow-library:cancel-run", async (_event, progressEventId) =>
    cancelWorkflowRecordRun(progressEventId)
  );
  ipcMain.handle("gordon:workflow-library:refresh-info-window", async (_event, request: InfoRadarRefreshRequest) =>
    toCloneableIpcValue(await refreshInfoRadarWindow(request))
  );
  ipcMain.handle("gordon:workflow-library:query-finance-quote", async (_event, request: FinanceBriefQuoteRequest) =>
    toCloneableIpcValue(await queryFinanceBriefQuote(toCloneableIpcValue(request)))
  );
  ipcMain.handle("gordon:workflow-library:resolve-wechat-item-url", async (_event, request: InfoRadarWechatResolveRequest) =>
    toCloneableIpcValue(await resolveInfoRadarWechatItemUrl(request))
  );
  ipcMain.handle("gordon:workflow-library:open-external-url", async (_event, urlValue) => {
    const url = normalizeInfoRadarNativeReaderUrl(urlValue);
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle("gordon:workflow-library:info-reader:open", async (event, request) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);

    if (!ownerWindow) {
      throw new Error("无法定位 Gordon 主窗口");
    }

    const url = normalizeInfoRadarNativeReaderUrl(request?.url);
    const bounds = normalizeInfoRadarNativeReaderBounds(request?.bounds);
    await openInfoRadarNativeReader(ownerWindow, url, bounds);
    return true;
  });
  ipcMain.handle("gordon:workflow-library:info-reader:set-bounds", async (event, bounds) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);

    if (!ownerWindow) {
      return false;
    }

    const readerView = infoRadarReaderViews.get(ownerWindow.id);

    if (!readerView) {
      return false;
    }

    setInfoRadarNativeReaderBounds(readerView, normalizeInfoRadarNativeReaderBounds(bounds));
    return true;
  });
  ipcMain.handle("gordon:workflow-library:info-reader:close", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);

    if (!ownerWindow) {
      return false;
    }

    detachInfoRadarNativeReaderView(ownerWindow);
    return true;
  });
  ipcMain.handle("gordon:workflow-library:live-stream:open", async (event, request) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);

    if (!ownerWindow) {
      throw new Error("无法定位 Gordon 主窗口");
    }

    const url = normalizeInfoRadarNativeReaderUrl(request?.url);
    const bounds = normalizeInfoRadarNativeReaderBounds(request?.bounds);
    await openLiveStreamNativeView(ownerWindow, url, bounds);
    return true;
  });
  ipcMain.handle("gordon:workflow-library:live-stream:set-bounds", async (event, bounds) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);

    if (!ownerWindow) {
      return false;
    }

    const liveView = liveStreamViews.get(ownerWindow.id);

    if (!liveView) {
      return false;
    }

    setInfoRadarNativeReaderBounds(liveView, normalizeInfoRadarNativeReaderBounds(bounds));
    return true;
  });
  ipcMain.handle("gordon:workflow-library:live-stream:close", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);

    if (!ownerWindow) {
      return false;
    }

    detachLiveStreamNativeView(ownerWindow);
    return true;
  });
  ipcMain.handle("gordon:comic-projects:list", async () => listComicProjects());
  ipcMain.handle("gordon:comic-projects:upsert", async (_event, project) => upsertComicProject(project));
  ipcMain.handle("gordon:comic-projects:delete", async (_event, projectId: string) =>
    deleteComicProject(projectId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:comic-projects:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择丹青溢彩导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  ipcMain.handle("gordon:comic-projects:export", async (_event, request: ComicProjectExportRequest) => {
    const exportTarget = resolveComicProjectExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:video-projects:list", async () => listVideoProjects());
  ipcMain.handle("gordon:video-projects:upsert", async (_event, project) => upsertVideoProject(project));
  ipcMain.handle("gordon:video-projects:delete", async (_event, projectId: string) =>
    deleteVideoProject(projectId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:video-projects:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择流光绘影导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  ipcMain.handle("gordon:video-projects:export", async (_event, request: VideoProjectExportRequest) => {
    const exportTarget = resolveVideoProjectExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:music-projects:list", async () => listMusicProjects());
  ipcMain.handle("gordon:music-projects:upsert", async (_event, project: MusicProject) => upsertMusicProject(project));
  ipcMain.handle("gordon:music-projects:delete", async (_event, projectId: string) =>
    deleteMusicProject(projectId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:music-projects:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择瑶琴映月导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  ipcMain.handle("gordon:music-projects:export", async (_event, request: MusicProjectExportRequest) => {
    const exportTarget = resolveMusicProjectExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:writing-books:list", async () => listWritingBooks());
  ipcMain.handle("gordon:writing-books:save", async (_event, book, options) => saveWritingBook(book, options));
  ipcMain.handle("gordon:writing-books:delete", async (_event, bookId: string) =>
    deleteWritingBook(bookId, (targetPath) => shell.trashItem(targetPath))
  );
  ipcMain.handle("gordon:writing-books:select-export-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择墨笔生花导出目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });
  const handleSelectApplicationCoverImage = async (event: Electron.IpcMainInvokeEvent) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const openDialogOptions = {
      title: "选择作品封面图片",
      properties: ["openFile"],
      filters: [
        {
          name: "图片文件",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"]
        },
        { name: "所有文件", extensions: ["*"] }
      ]
    } satisfies Electron.OpenDialogOptions;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    const filePath = result.filePaths[0];
    const buffer = await readFile(filePath);
    return `data:${inferApplicationCoverImageMimeType(filePath)};base64,${buffer.toString("base64")}`;
  };
  const handleSaveApplicationCoverImage = async (
    event: Electron.IpcMainInvokeEvent,
    request: ApplicationCoverImageSaveRequest
  ) => {
    const imageSource = await readApplicationCoverImageSource(request?.imageUrl);
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const fileName = sanitizeApplicationCoverImageFileName(request?.title, imageSource.extension);
    const saveDialogOptions = {
      title: "下载作品封面",
      defaultPath: path.join(app.getPath("documents"), fileName),
      filters: [
        {
          name: "图片文件",
          extensions: [imageSource.extension]
        },
        {
          name: "所有文件",
          extensions: ["*"]
        }
      ]
    } satisfies Electron.SaveDialogOptions;
    const dialogResult = ownerWindow
      ? await dialog.showSaveDialog(ownerWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (dialogResult.canceled || !dialogResult.filePath) {
      return null;
    }

    const normalizedFilePath = path.extname(dialogResult.filePath)
      ? dialogResult.filePath
      : `${dialogResult.filePath}.${imageSource.extension}`;

    await mkdir(path.dirname(normalizedFilePath), { recursive: true });
    await writeFile(normalizedFilePath, imageSource.buffer);

    return {
      filePath: normalizedFilePath,
      fileName: path.basename(normalizedFilePath),
      writtenBytes: imageSource.buffer.byteLength
    };
  };
  ipcMain.handle("gordon:application-cover:select-image", handleSelectApplicationCoverImage);
  ipcMain.handle("gordon:application-cover:save-image", handleSaveApplicationCoverImage);
  ipcMain.handle("gordon:writing-books:select-cover-image", handleSelectApplicationCoverImage);
  ipcMain.handle("gordon:writing-books:save-cover-image", handleSaveApplicationCoverImage);
  ipcMain.handle("gordon:writing-books:export", async (_event, request: WritingBookExportRequest) => {
    const exportTarget = resolveWritingBookExportPath(request);

    await mkdir(exportTarget.directoryPath, { recursive: true });
    await writeFile(exportTarget.filePath, exportTarget.content, "utf8");

    return {
      filePath: exportTarget.filePath,
      fileName: exportTarget.fileName,
      format: exportTarget.format,
      writtenBytes: Buffer.byteLength(exportTarget.content, "utf8")
    };
  });
  ipcMain.handle("gordon:weekly-progress:list", async () => listWeeklyProgress());
  ipcMain.handle("gordon:weekly-progress:save", async (_event, record) => saveWeeklyProgress(record));
  ipcMain.handle("gordon:weekly-progress:delete", async (_event, recordId: string) => deleteWeeklyProgress(recordId));
  ipcMain.handle("gordon:weekly-progress:rewrite", async (_event, request) => rewriteWeeklyProgressItem(request));
  ipcMain.handle("gordon:weekly-progress:generate-daily-report", async (_event, request) =>
    generateDailyProgressReport(request)
  );
  ipcMain.handle("gordon:weekly-progress:generate-report", async (_event, request) =>
    generateWeeklyProgressReport(request)
  );
  ipcMain.handle("gordon:weekly-progress:generate-performance-report", async (_event, request) =>
    generatePerformanceProgressReport(request)
  );
  ipcMain.handle("gordon:weekly-progress:feishu-settings:get", async () => getWeeklyFeishuSettings());
  ipcMain.handle("gordon:weekly-progress:feishu-settings:save", async (_event, settings: WeeklyFeishuSettings) =>
    saveWeeklyFeishuSettings(settings)
  );
  ipcMain.handle(
    "gordon:weekly-progress:send-daily-report-to-feishu",
    async (_event, request: WeeklyDailyReportFeishuSendRequest) => sendWeeklyDailyReportToFeishu(request)
  );

  await createMainWindow();
  startModelBalanceUsagePolling();
  startWeeklyAutoDailyReportScheduler();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  if (modelBalancePollingTimer) {
    clearInterval(modelBalancePollingTimer);
    modelBalancePollingTimer = null;
  }

  if (weeklyAutoDailyReportTimer) {
    clearInterval(weeklyAutoDailyReportTimer);
    weeklyAutoDailyReportTimer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

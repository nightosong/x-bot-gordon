import saberThemeMeta from "../../../assets/themes/saber/theme.json";
import homeBackgroundUrl from "../../../assets/themes/saber/home-background.png?url";
import bg00Url from "../../../assets/themes/saber/optimized/bg00-standing.webp?url";
import bg01Url from "../../../assets/themes/saber/optimized/bg01-side-sitting.webp?url";
import bg02Url from "../../../assets/themes/saber/optimized/bg02-floor-sit-folded.webp?url";
import bg03Url from "../../../assets/themes/saber/optimized/bg03-kneeling-seiza.webp?url";
import bg04Url from "../../../assets/themes/saber/optimized/bg04-prone-reading.webp?url";
import bg05Url from "../../../assets/themes/saber/optimized/bg05-outward-side-lying.webp?url";
import bg06Url from "../../../assets/themes/saber/optimized/bg06-outward-prone.webp?url";
import bg07Url from "../../../assets/themes/saber/optimized/bg07-outward-kneeling.webp?url";
import bg08Url from "../../../assets/themes/saber/optimized/bg08-outward-side-sit.webp?url";
import bg09Url from "../../../assets/themes/saber/optimized/bg09-daily-hug-knees.webp?url";
import bg10Url from "../../../assets/themes/saber/optimized/bg10-daily-reclining-legfill.webp?url";
import bg11Url from "../../../assets/themes/saber/optimized/bg11-daily-kneel-hipcurve.webp?url";
import bg12Url from "../../../assets/themes/saber/optimized/bg12-daily-side-lying-head-hand.webp?url";
import bg13Url from "../../../assets/themes/saber/optimized/bg13-daily-right-crouch.webp?url";
import bg14Url from "../../../assets/themes/saber/optimized/bg14-daily-side-kneel.webp?url";
import bg15Url from "../../../assets/themes/saber/optimized/bg15-daily-outward-leg-extension.webp?url";
import bg16Url from "../../../assets/themes/saber/optimized/bg16-daily-right-prone.webp?url";
import bg17Url from "../../../assets/themes/saber/optimized/bg17-daily-right-seated.webp?url";
import bg18Url from "../../../assets/themes/saber/optimized/bg18-daily-front-seated.webp?url";

export const SABER_THEME_META = saberThemeMeta;

export const SABER_HOME_BACKGROUND = {
  id: "saber-home",
  label: "Saber home",
  url: homeBackgroundUrl,
  position: "right center"
};

export const SABER_ROTATION_BACKGROUNDS = [
  { id: "standing", url: bg00Url, position: "right bottom" },
  { id: "side-sitting", url: bg01Url, position: "right bottom" },
  { id: "floor-sit-folded", url: bg02Url, position: "right bottom" },
  { id: "kneeling-seiza", url: bg03Url, position: "right bottom" },
  { id: "prone-reading", url: bg04Url, position: "right bottom" },
  { id: "outward-side-lying", url: bg05Url, position: "right bottom" },
  { id: "outward-prone", url: bg06Url, position: "right bottom" },
  { id: "outward-kneeling", url: bg07Url, position: "right bottom" },
  { id: "outward-side-sit", url: bg08Url, position: "right bottom" },
  { id: "daily-hug-knees", url: bg09Url, position: "right bottom" },
  { id: "daily-reclining-legfill", url: bg10Url, position: "right bottom" },
  { id: "daily-kneel-hipcurve", url: bg11Url, position: "right bottom" },
  { id: "daily-side-lying-head-hand", url: bg12Url, position: "right bottom" },
  { id: "daily-right-crouch", url: bg13Url, position: "right bottom" },
  { id: "daily-side-kneel", url: bg14Url, position: "right bottom" },
  { id: "daily-outward-leg-extension", url: bg15Url, position: "right bottom" },
  { id: "daily-right-prone", url: bg16Url, position: "right bottom" },
  { id: "daily-right-seated", url: bg17Url, position: "right bottom" },
  { id: "daily-front-seated", url: bg18Url, position: "right bottom" }
];

const rotationMinutes = Number(saberThemeMeta?.backgroundRotation?.intervalMinutes);

export const SABER_BACKGROUND_ROTATION_INTERVAL_MS =
  Number.isFinite(rotationMinutes) && rotationMinutes > 0 ? rotationMinutes * 60 * 1000 : 120000;
export const SABER_BACKGROUND_EAGER_PRELOAD_COUNT = 2;
export const SABER_BACKGROUND_LOOKAHEAD_PRELOAD_COUNT = 2;
export const SABER_TAB_BACKGROUND_CHANGE_DELAY_MS = 900;
export const SABER_TAB_BACKGROUND_MIN_DWELL_MS = 1800;

const preloadedSaberThemeUrls = new Set();
const activeSaberThemePreloads = new Map();

export function getNextSaberBackgroundIndex(currentIndex) {
  const backgroundCount = SABER_ROTATION_BACKGROUNDS.length;

  if (backgroundCount <= 1) {
    return 0;
  }

  const nextIndex = Math.floor(Math.random() * backgroundCount);
  return nextIndex === currentIndex ? (nextIndex + 1) % backgroundCount : nextIndex;
}

function preloadSaberThemeAsset(asset) {
  if (typeof Image === "undefined") {
    return;
  }

  if (!asset?.url || preloadedSaberThemeUrls.has(asset.url)) {
    return;
  }

  preloadedSaberThemeUrls.add(asset.url);

  const image = new Image();
  activeSaberThemePreloads.set(asset.url, image);
  image.decoding = "async";
  image.onload = image.onerror = () => {
    activeSaberThemePreloads.delete(asset.url);
  };
  image.src = asset.url;
}

export function preloadSaberBackgroundByIndex(index) {
  const backgroundCount = SABER_ROTATION_BACKGROUNDS.length;

  if (!backgroundCount) {
    return;
  }

  const normalizedIndex = ((index % backgroundCount) + backgroundCount) % backgroundCount;
  preloadSaberThemeAsset(SABER_ROTATION_BACKGROUNDS[normalizedIndex]);
}

export function preloadSaberBackgroundWindow(
  activeIndex,
  lookahead = SABER_BACKGROUND_LOOKAHEAD_PRELOAD_COUNT
) {
  for (let offset = 0; offset <= lookahead; offset += 1) {
    preloadSaberBackgroundByIndex(activeIndex + offset);
  }
}

export function preloadSaberThemeImages(limit = SABER_BACKGROUND_EAGER_PRELOAD_COUNT) {
  preloadSaberThemeAsset(SABER_HOME_BACKGROUND);
  SABER_ROTATION_BACKGROUNDS.slice(0, limit).forEach(preloadSaberThemeAsset);
}

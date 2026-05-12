export function createMarketplaceViewContext({
  comicActions,
  comicChapterDropdownMenuRef,
  fieldAiActions,
  fortuneActions,
  musicActions,
  truncateText,
  ui,
  videoActions,
  videoShotDropdownMenuRef,
  writingActions,
  writingAiActions,
  writingChapterDropdownMenuRef
}) {
  return {
    comicActions,
    fieldAiActions,
    fortuneActions,
    musicActions,
    refs: {
      comicChapterDropdownMenuRef,
      videoShotDropdownMenuRef,
      writingChapterDropdownMenuRef
    },
    truncateText,
    ui,
    videoActions,
    writingActions,
    writingAiActions
  };
}

export function createMarketplaceViewContext({
  comicActions,
  comicAiActions,
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
    comicAiActions,
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

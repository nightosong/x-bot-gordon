export function createMarketplaceViewContext({
  comicActions,
  comicChapterDropdownMenuRef,
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

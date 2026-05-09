export function createMarketplaceViewContext({
  comicActions,
  comicChapterDropdownMenuRef,
  truncateText,
  ui,
  writingActions,
  writingAiActions,
  writingChapterDropdownMenuRef
}) {
  return {
    comicActions,
    refs: {
      comicChapterDropdownMenuRef,
      writingChapterDropdownMenuRef
    },
    truncateText,
    ui,
    writingActions,
    writingAiActions
  };
}

export function createMarketplaceViewContext({
  comicActions,
  comicAiActions,
  comicChapterDropdownMenuRef,
  fieldAiActions,
  formatLocalDateTime,
  fortuneActions,
  marketplaceAgentActions,
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
    formatLocalDateTime,
    fortuneActions,
    marketplaceAgentActions,
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

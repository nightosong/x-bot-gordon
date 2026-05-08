<template>
  <div class="app-shell">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <main class="dashboard">
      <section class="left-column">
        <section class="brand-panel">
          <div class="brand-panel-head">
            <div class="brand-lockup">
              <div class="brand-row">
                <MorphingText
                  class="brand-title"
                  base-text="GORDON"
                  :random-texts="BRAND_RANDOM_TEXTS"
                  aria-label="GORDON"
                />
              </div>
            </div>

            <details
              ref="homeSettingsMenuRef"
              class="home-settings-menu"
              :class="{ 'has-active-selection': isHomeSettingsFeature(activeFeature) }"
            >
              <summary aria-label="打开设置菜单">
                <GIcon name="settings" class="home-settings-trigger-gear" />
              </summary>

              <div class="home-settings-menu-panel">
                <button
                  v-for="item in HOME_SETTINGS_ITEMS"
                  :key="item.id"
                  type="button"
                  class="home-settings-item"
                  :class="{ 'is-active': activeFeature === item.id }"
                  @click="handleFeatureSelect(item.id)"
                >
                  <span class="home-settings-item-title">{{ item.title }}</span>
                  <span class="home-settings-item-copy">{{ item.copy }}</span>
                </button>
              </div>
            </details>
          </div>
        </section>

        <section class="feature-panel">
          <div class="feature-board">
            <article
              v-for="(entry, index) in FEATURE_ENTRIES"
              :key="entry.id"
              :class="getFeatureCardClass(entry, index)"
              :data-graffiti="entry.kicker"
              role="button"
              tabindex="0"
              :aria-label="`查看${entry.title}`"
              @click="handleFeatureSelect(entry.id)"
              @keydown.enter.prevent="handleFeatureSelect(entry.id)"
              @keydown.space.prevent="handleFeatureSelect(entry.id)"
              @pointermove="handleCardPointerMove"
              @pointerleave="handleCardPointerLeave"
              @pointercancel="handleCardPointerLeave"
              @pointerup="handleCardPointerLeave"
            >
              <span class="feature-graffiti" aria-hidden="true" :data-text="entry.kicker"></span>

              <div v-if="entry.tier === 'flat'" class="feature-card-flat-row">
                <div>
                  <p class="feature-kicker">{{ entry.kicker }}</p>
                  <p class="feature-title">{{ entry.title }}</p>
                </div>
              </div>

              <template v-else>
                <p class="feature-kicker">{{ entry.kicker }}</p>
                <p class="feature-title">{{ entry.title }}</p>
              </template>
            </article>
          </div>
        </section>
      </section>

      <section class="right-column">
        <section class="workspace-panel" :class="{ 'workspace-panel-flush': isWorkspaceImmersive }">
          <template v-if="activeFeature === FEATURE_HOME">
            <div class="workspace-stage robot-stage">
              <div class="robot-frame">
                <canvas ref="robotCanvasRef" class="robot-canvas" aria-label="Gordon robot"></canvas>
              </div>
            </div>
          </template>

          <template v-else-if="activeFeature === FEATURE_MODEL_MANAGEMENT">
            <ModelManagementView
              :ui="ui"
              :workbench="workbench"
              :active-model-usage-profile="activeModelUsageProfile"
              :active-model-usage-error="activeModelUsageError"
              :is-active-model-usage-loading="isActiveModelUsageLoading"
              :model-usage-summary="modelUsageSummary"
              :model-usage-daily-series="modelUsageDailySeries"
              :model-usage-daily-list-series="modelUsageDailyListSeries"
              :provider-options="providerOptions"
              :model-editor-fields="modelEditorFields"
              :back-model-management="backModelManagement"
              :fill-model-balance-query-template="fillModelBalanceQueryTemplate"
              :format-balance-number="formatBalanceNumber"
              :format-local-date-time="formatLocalDateTime"
              :format-optional-balance-number="formatOptionalBalanceNumber"
              :get-model-balance-snapshot="getModelBalanceSnapshot"
              :get-model-usage-bar-height="getModelUsageBarHeight"
              :get-provider-meta="getProviderMeta"
              :handle-model-balance-refresh="handleModelBalanceRefresh"
              :handle-model-delete="handleModelDelete"
              :handle-model-editor-balance-query="handleModelEditorBalanceQuery"
              :handle-model-editor-save="handleModelEditorSave"
              :handle-model-status-toggle="handleModelStatusToggle"
              :has-model-balance-query="hasModelBalanceQuery"
              :is-model-balance-refreshing="isModelBalanceRefreshing"
              :mark-model-editor-dirty="markModelEditorDirty"
              :open-model-create-picker="openModelCreatePicker"
              :open-model-editor="openModelEditor"
              :open-model-usage-stats="openModelUsageStats"
              :select-model-provider="selectModelProvider"
              :select-popular-model="selectPopularModel"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_MARKETPLACE">
            <div
              class="workspace-stage workspace-stage-scroll"
              :class="{ 'workspace-stage-flush': ui.marketplace.view === 'writingDetail' || ui.marketplace.view === 'comicDetail' }"
            >
              <div
                class="marketplace-shell"
                :class="{
                  'marketplace-shell-detail': ui.marketplace.view === 'writingDetail' || ui.marketplace.view === 'comicDetail',
                  'marketplace-shell-shelf': ui.marketplace.view === 'writingShelf' || ui.marketplace.view === 'comicShelf'
                }"
              >
                <template v-if="ui.marketplace.view === 'apps'">
                  <section class="models-hero workflow-library-hero marketplace-hero">
                    <div>
                      <p class="feature-kicker">Marketplace</p>
                      <p class="models-title">应用广场</p>
                    </div>
                    <div class="workflow-library-hero-side">
                      <span class="status-pill">{{ MARKETPLACE_APP_COUNT }} 个应用</span>
                    </div>
                  </section>

                  <section class="marketplace-app-grid">
                    <article
                      class="marketplace-app-card writing-app-card"
                      role="button"
                      tabindex="0"
                      :aria-label="`进入${WRITING_APP_NAME}`"
                      @click="openWritingAppShelf"
                      @keydown.enter.prevent="openWritingAppShelf"
                      @keydown.space.prevent="openWritingAppShelf"
                    >
                      <div class="writing-app-mark" aria-hidden="true">
                        <span>笔</span>
                      </div>
                      <div class="marketplace-app-copy">
                        <p class="feature-kicker">Novel Studio</p>
                        <p class="marketplace-app-title">{{ WRITING_APP_NAME }}</p>
                        <p class="models-copy">书架、故事设定、目录规划和章节正文都在同一个写作工作台里推进。</p>
                      </div>
                      <div class="marketplace-app-meta">
                        <span class="pill">写作助手</span>
                        <span class="pill pill-neutral">大师提示词</span>
                      </div>
                    </article>

                    <article
                      class="marketplace-app-card comic-app-card"
                      role="button"
                      tabindex="0"
                      :aria-label="`${COMIC_APP_NAME} 漫画创作应用`"
                      @click="openComicAppShelf"
                      @keydown.enter.prevent="openComicAppShelf"
                      @keydown.space.prevent="openComicAppShelf"
                    >
                      <div class="comic-app-mark" aria-hidden="true">
                        <span>漫</span>
                      </div>
                      <div class="marketplace-app-copy">
                        <p class="feature-kicker">Comic Studio</p>
                        <p class="marketplace-app-title">{{ COMIC_APP_NAME }}</p>
                        <p class="models-copy">漫画创作工作台，面向单色、彩绘分镜、单图海报和连载企划。</p>
                      </div>
                      <div class="marketplace-app-meta">
                        <span class="pill">漫画创作</span>
                        <span class="pill pill-neutral">单色 / 彩绘</span>
                        <span class="pill pill-neutral">海报 / 连载</span>
                      </div>
                    </article>
                  </section>
                </template>

                <template v-else-if="ui.marketplace.view === 'comicShelf'">
                  <section class="workflow-library-detail-head writing-shelf-head comic-shelf-head">
                    <div class="workflow-library-detail-head-side">
                      <button type="button" class="model-icon-button weekly-back-button" aria-label="返回应用广场" title="返回应用广场" @click="backComicMarketplace">
                        <GIcon name="return" />
                      </button>
                    </div>

                    <div class="workflow-library-detail-head-center">
                      <p class="workflow-library-detail-title">{{ COMIC_APP_NAME }}</p>
                    </div>

                    <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
                      <span class="status-pill">{{ comicProjects.length }} 个项目</span>
                      <button type="button" class="model-icon-button" aria-label="新建漫画项目" title="新建漫画项目" @click="createComicProject">
                        <GIcon name="add" />
                      </button>
                    </div>
                  </section>

                  <section class="writing-shelf-grid comic-project-grid" :class="{ 'is-empty': !comicProjects.length }">
                    <p v-if="!comicProjects.length" class="writing-shelf-empty" role="status">暂无漫画项目</p>
                    <article
                      v-for="project in comicProjects"
                      :key="project.id"
                      class="writing-book-card comic-project-card"
                      :class="`is-${project.coverTone}`"
                      role="button"
                      tabindex="0"
                      :aria-label="`打开${project.title}`"
                      @click="openComicProject(project.id)"
                      @keydown.enter.prevent="openComicProject(project.id)"
                      @keydown.space.prevent="openComicProject(project.id)"
                    >
                      <button
                        type="button"
                        class="shelf-card-delete"
                        aria-label="删除漫画项目"
                        @click.stop="deleteComicProjectFromShelf(project.id)"
                        @keydown.enter.stop
                        @keydown.space.stop
                      >
                        <GIcon name="delete" :size="12" />
                      </button>
                      <div class="comic-project-cover" aria-hidden="true">
                        <span>{{ project.title.slice(0, 1) || "漫" }}</span>
                      </div>
                      <div class="writing-book-card-main">
                        <div>
                          <p class="writing-book-title">{{ project.title }}</p>
                          <p class="writing-book-meta">{{ getComicProjectFormatLabel(project.format) }} / {{ project.genre }}</p>
                        </div>
                        <p class="models-copy">{{ truncateText(project.summary || project.visualStyle, 98) }}</p>
                        <div class="writing-book-card-foot">
                          <span class="pill">{{ project.status }}</span>
                          <span class="pill pill-neutral">{{ getComicProjectPaletteLabel(project.palette) }}</span>
                          <span class="pill pill-neutral">{{ project.pageCount }} 页</span>
                        </div>
                      </div>
                    </article>
                  </section>
                </template>

                <template v-else-if="ui.marketplace.view === 'writingShelf'">
                  <section class="workflow-library-detail-head writing-shelf-head">
                    <div class="workflow-library-detail-head-side">
                      <button type="button" class="model-icon-button weekly-back-button" aria-label="返回应用广场" title="返回应用广场" @click="backWritingMarketplace">
                        <GIcon name="return" />
                      </button>
                    </div>

                    <div class="workflow-library-detail-head-center">
                      <p class="workflow-library-detail-title">{{ WRITING_APP_NAME }}</p>
                    </div>

                    <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
                      <span class="status-pill">{{ writingBooks.length }} 本书</span>
                      <label class="model-icon-button writing-upload-action" aria-label="上传书稿" title="上传书稿">
                        <GIcon name="upload" />
                        <input type="file" accept=".txt,.md,.json" @change="handleWritingBookUpload" />
                      </label>
                      <button type="button" class="model-icon-button" aria-label="新建书籍" title="新建书籍" @click="createWritingBook">
                        <GIcon name="add" />
                      </button>
                    </div>
                  </section>

                  <section class="writing-shelf-grid" :class="{ 'is-empty': !writingBooks.length }">
                    <p v-if="!writingBooks.length" class="writing-shelf-empty" role="status">暂无书籍</p>
                    <article
                      v-for="book in writingBooks"
                      :key="book.id"
                      class="writing-book-card"
                      :class="`is-${book.coverTone}`"
                      role="button"
                      tabindex="0"
                      :aria-label="`打开${book.title}`"
                      @click="openWritingBook(book.id)"
                      @keydown.enter.prevent="openWritingBook(book.id)"
                      @keydown.space.prevent="openWritingBook(book.id)"
                    >
                      <button
                        type="button"
                        class="shelf-card-delete"
                        aria-label="删除书籍"
                        @click.stop="deleteWritingBookFromShelf(book.id)"
                        @keydown.enter.stop
                        @keydown.space.stop
                      >
                        <GIcon name="delete" :size="12" />
                      </button>
                      <div class="writing-book-cover" aria-hidden="true">
                        <span>{{ book.title.slice(0, 1) }}</span>
                      </div>
                      <div class="writing-book-card-main">
                        <div>
                          <p class="writing-book-title">{{ book.title }}</p>
                          <p class="writing-book-meta">{{ getWritingLengthLabel(book.length) }} / {{ book.genre }}</p>
                        </div>
                        <p class="models-copy">{{ truncateText(book.intro, 98) }}</p>
                        <div class="writing-book-card-foot">
                          <span class="pill">{{ book.status }}</span>
                          <span class="pill pill-neutral">{{ getWritingBookWordCount(book) }} 字</span>
                          <span class="pill pill-neutral">完整度 {{ getWritingBookCompleteness(book) }}%</span>
                        </div>
                      </div>
                    </article>
                  </section>
                </template>

                <template v-else-if="ui.marketplace.view === 'comicDetail' && activeComicProject">
                  <section class="writing-detail-shell comic-detail-shell">
                    <header class="writing-detail-head comic-detail-head">
                      <button type="button" class="model-icon-button weekly-back-button" aria-label="返回项目架" title="返回项目架" @click="backComicShelf">
                        <GIcon name="return" />
                      </button>

                      <div class="writing-detail-title">
                        <input
                          :value="activeComicProject.title"
                          class="writing-title-input"
                          aria-label="漫画项目名"
                          @input="setComicProjectTitle($event.target.value)"
                        />
                      </div>

                      <div class="model-section-actions">
                        <span class="pill">{{ getComicProjectFormatLabel(activeComicProject.format) }}</span>
                        <span class="pill pill-neutral">{{ getComicProjectPaletteLabel(activeComicProject.palette) }}</span>
                      </div>
                    </header>

                    <section
                      class="writing-detail-layout comic-detail-layout"
                      :class="{ 'is-profile-collapsed': ui.marketplace.comic.isProfileCollapsed }"
                    >
                      <aside class="writing-detail-rail comic-detail-rail" :aria-expanded="ui.marketplace.comic.isProfileCollapsed ? 'false' : 'true'">
                        <button
                          type="button"
                          class="model-icon-button writing-profile-toggle"
                          :aria-label="ui.marketplace.comic.isProfileCollapsed ? '展开项目信息' : '折叠项目信息'"
                          :title="ui.marketplace.comic.isProfileCollapsed ? '展开项目信息' : '折叠项目信息'"
                          @click="toggleComicProfileRail"
                        >
                          <GIcon :name="ui.marketplace.comic.isProfileCollapsed ? 'chevronRight' : 'chevronLeft'" />
                        </button>

                        <div v-if="!ui.marketplace.comic.isProfileCollapsed" class="writing-rail-content comic-rail-content">
                          <div class="comic-project-profile">
                            <div class="comic-project-cover comic-project-cover-large" :class="`is-${activeComicProject.coverTone}`" aria-hidden="true">
                              <span>{{ activeComicProject.title.slice(0, 1) || "漫" }}</span>
                            </div>

                            <label class="field">
                              <span class="field-label">形态</span>
                              <select
                                :value="activeComicProject.format"
                                class="field-input writing-mini-select"
                                @change="setComicProjectFormat($event.target.value)"
                              >
                                <option value="poster">单图海报</option>
                                <option value="serial">连载漫画</option>
                              </select>
                            </label>

                            <label class="field">
                              <span class="field-label">画面</span>
                              <select
                                :value="activeComicProject.palette"
                                class="field-input writing-mini-select"
                                @change="setComicProjectPalette($event.target.value)"
                              >
                                <option value="monochrome">单色</option>
                                <option value="color">彩绘</option>
                              </select>
                            </label>

                            <label class="field">
                              <span class="field-label">类型</span>
                              <input
                                :value="activeComicProject.genre"
                                class="field-input writing-mini-input"
                                @input="setComicProjectGenre($event.target.value)"
                              />
                            </label>

                            <label class="field">
                              <span class="field-label">页数</span>
                              <input
                                :value="activeComicProject.pageCount"
                                class="field-input writing-mini-input"
                                type="number"
                                min="1"
                                max="999"
                                @input="setComicProjectPageCount($event.target.value)"
                              />
                            </label>
                          </div>

                          <div class="comic-rail-footer">
                            <div class="writing-stat-list">
                              <span class="pill pill-neutral">更新 {{ formatWritingBookUpdatedAt(activeComicProject.updatedAt) }}</span>
                              <span class="pill pill-neutral">{{ activeComicProject.pageCount }} 页</span>
                              <span class="pill pill-neutral">{{ activeComicChapters.length }} 章</span>
                            </div>
                          </div>
                        </div>

                        <div v-if="!ui.marketplace.comic.isProfileCollapsed" class="writing-profile-actions">
                          <button
                            type="button"
                            class="writing-mini-text-button"
                            :disabled="ui.marketplace.comic.isExporting"
                            :title="`导出 ${activeComicExportFileName}`"
                            @click="openComicExportDialog"
                          >
                            作品导出
                          </button>
                        </div>
                      </aside>

                      <main class="writing-main-stage comic-main-stage">
                        <div class="writing-tab-bar" role="tablist" aria-label="漫画项目详情模块">
                          <button
                            v-for="tab in COMIC_APP_TABS"
                            :key="tab.id"
                            type="button"
                            class="writing-tab"
                            :class="{ 'is-active': ui.marketplace.comic.activeTab === tab.id }"
                            :aria-selected="ui.marketplace.comic.activeTab === tab.id ? 'true' : 'false'"
                            @click="setComicTab(tab.id)"
                          >
                            <span>{{ tab.kicker }}</span>
                            {{ tab.label }}
                          </button>
                        </div>

                        <section class="writing-editor-grid comic-editor-grid">
                          <article class="writing-editor-card comic-editor-card">
                            <div class="writing-editor-head">
                              <div>
                                <p class="feature-kicker">{{ activeComicTabMeta.kicker }}</p>
                                <p class="model-section-title">{{ activeComicTabMeta.fieldLabel }}</p>
                              </div>
                              <span class="status-pill">{{ activeComicProject.status }}</span>
                            </div>

                            <div v-if="ui.marketplace.comic.activeTab === 'intro'" class="writing-intro-stack">
                              <label class="field writing-intro-field">
                                <span class="field-label">故事与画面目标</span>
                                <textarea
                                  class="field-textarea writing-editor-textarea writing-intro-textarea"
                                  :value="activeComicProject.summary"
                                  placeholder="主角、世界观、冲突、核心画面和这组漫画要留下的情绪。"
                                  @input="setComicProjectSummary($event.target.value)"
                                ></textarea>
                              </label>

                              <label class="field writing-intro-field">
                                <span class="field-label">画风与镜头</span>
                                <textarea
                                  class="field-textarea writing-editor-textarea writing-intro-textarea is-large"
                                  :value="activeComicProject.visualStyle"
                                  placeholder="线条、色彩、构图、角色造型、分镜节奏和参考风格。"
                                  @input="setComicProjectVisualStyle($event.target.value)"
                                ></textarea>
                              </label>

                              <label class="field writing-intro-field">
                                <span class="field-label">{{ activeComicProject.format === 'serial' ? '连载总规划' : '海报构图规划' }}</span>
                                <textarea
                                  class="field-textarea writing-editor-textarea writing-intro-textarea is-large"
                                  :value="activeComicProject.episodePlan"
                                  :placeholder="activeComicProject.format === 'serial' ? '按篇章写下主要剧情、角色成长、每话节奏和结尾钩子。' : '写下主体、背景、人物站位、文字区域和最终出图比例。'"
                                  @input="setComicProjectEpisodePlan($event.target.value)"
                                ></textarea>
                              </label>
                            </div>

                            <div v-else-if="ui.marketplace.comic.activeTab === 'outline'" class="writing-outline-board">
                              <div class="writing-chapter-list-panel">
                                <div class="writing-chapter-panel-head">
                                  <div>
                                    <p class="feature-kicker">Chapter List</p>
                                    <p class="writing-panel-title">{{ activeComicChapters.length }} 个章节</p>
                                  </div>
                                  <button type="button" class="model-icon-button" aria-label="新增漫画章节" title="新增漫画章节" @click="createComicChapter">
                                    <GIcon name="add" />
                                  </button>
                                </div>

                                <div class="writing-chapter-list">
                                  <button
                                    v-for="(chapter, index) in activeComicChapters"
                                    :key="chapter.id"
                                    type="button"
                                    class="writing-chapter-list-item"
                                    :class="{
                                      'is-active': activeComicChapter?.id === chapter.id,
                                      'is-done': chapter.status === 'done',
                                      'is-progress': chapter.status === 'inProgress'
                                    }"
                                    @click="selectComicChapter(chapter.id)"
                                  >
                                    <span class="writing-chapter-list-title-row">
                                      <span class="writing-chapter-list-title">{{ getComicChapterDisplayTitle(chapter, index) }}</span>
                                    </span>
                                    <span class="writing-chapter-list-meta">
                                      <span class="status-pill" :class="getComicChapterStatusClass(chapter.status)">
                                        {{ getComicChapterStatusLabel(chapter.status) }}
                                      </span>
                                      <span>{{ chapter.content.length }} 字</span>
                                    </span>
                                  </button>
                                </div>
                              </div>

                              <div v-if="activeComicChapter" class="writing-chapter-summary-panel">
                                <div class="writing-chapter-summary-head">
                                  <div>
                                    <p class="feature-kicker">Chapter Brief</p>
                                    <p class="writing-panel-title">分镜简介</p>
                                  </div>
                                  <span class="status-pill" :class="getComicChapterStatusClass(activeComicChapter.status)">
                                    {{ getComicChapterStatusLabel(activeComicChapter.status) }}
                                  </span>
                                </div>

                                <label class="field">
                                  <span class="field-label">章节标题</span>
                                  <input
                                    :value="activeComicChapter.title"
                                    class="field-input"
                                    @input="setComicChapterTitle(activeComicChapter, $event.target.value)"
                                  />
                                </label>

                                <textarea
                                  class="field-textarea writing-editor-textarea writing-chapter-summary-textarea"
                                  :value="activeComicChapter.summary"
                                  placeholder="写下本章画面目标、分镜顺序、角色动作、对白密度和结尾画面。"
                                  @input="setComicChapterSummary(activeComicChapter, $event.target.value)"
                                ></textarea>

                                <div class="model-section-actions writing-chapter-summary-actions">
                                  <button type="button" class="model-action-secondary" @click="goComicChapter(activeComicChapter.id)">
                                    进入生成
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div v-else class="writing-chapter-workbench">
                              <div v-if="activeComicChapter" class="writing-chapter-commandbar">
                                <div class="writing-chapter-picker-row">
                                  <div class="writing-chapter-picker">
                                    <span class="field-label">当前章节</span>
                                    <div class="writing-chapter-dropdown" :class="{ 'is-open': ui.marketplace.comic.isChapterPickerOpen }">
                                      <button
                                        type="button"
                                        class="writing-chapter-dropdown-trigger"
                                        :aria-expanded="ui.marketplace.comic.isChapterPickerOpen ? 'true' : 'false'"
                                        aria-haspopup="listbox"
                                        @click="toggleComicChapterPicker"
                                      >
                                        <span>{{ getComicChapterDisplayTitle(activeComicChapter, activeComicChapterIndex) }}</span>
                                        <GIcon name="chevronDown" />
                                      </button>

                                      <div
                                        v-if="ui.marketplace.comic.isChapterPickerOpen"
                                        ref="comicChapterDropdownMenuRef"
                                        class="writing-chapter-dropdown-menu"
                                        role="listbox"
                                      >
                                        <button
                                          v-for="entry in filteredComicChapterEntries"
                                          :key="entry.chapter.id"
                                          type="button"
                                          class="writing-chapter-dropdown-item"
                                          :class="{ 'is-active': activeComicChapter?.id === entry.chapter.id }"
                                          role="option"
                                          :aria-selected="activeComicChapter?.id === entry.chapter.id ? 'true' : 'false'"
                                          @click="selectComicChapterFromPicker(entry.chapter.id)"
                                        >
                                          <span>{{ entry.title }}</span>
                                          <small>
                                            {{ getComicChapterStatusLabel(entry.chapter.status) }} / {{ entry.chapter.content.length }} 字
                                          </small>
                                        </button>
                                        <p v-if="!filteredComicChapterEntries.length" class="writing-chapter-dropdown-empty">没有匹配章节</p>
                                      </div>
                                    </div>
                                  </div>

                                  <label class="field writing-chapter-search-field">
                                    <span class="field-label">搜索</span>
                                    <input
                                      v-model="ui.marketplace.comic.chapterSearchQuery"
                                      class="field-input writing-chapter-search-input"
                                      placeholder="章节名"
                                      @focus="setComicChapterPickerOpen(true)"
                                    />
                                  </label>
                                </div>

                                <span class="status-pill writing-chapter-status-pill" :class="getComicChapterStatusClass(activeComicChapter.status)">
                                  {{ getComicChapterStatusLabel(activeComicChapter.status) }}
                                </span>

                                <button type="button" class="model-action writing-chapter-submit" @click="submitComicChapter">
                                  提交
                                </button>
                              </div>

                              <div v-if="activeComicChapter" class="writing-chapter-brief-strip">
                                <strong>{{ getComicChapterDisplayTitle(activeComicChapter, activeComicChapterIndex) }}</strong>
                                <p>{{ activeComicChapter.summary || "这个漫画章节还没有分镜简介。" }}</p>
                              </div>

                              <label v-if="activeComicChapter" class="field writing-intro-field">
                                <span class="field-label">生成提示词</span>
                                <textarea
                                  class="field-textarea writing-editor-textarea comic-prompt-textarea"
                                  :value="activeComicChapter.prompt"
                                  placeholder="写下模型生成这一章漫画所需的画面、角色、镜头、对白和风格约束。"
                                  @input="setComicChapterPrompt(activeComicChapter, $event.target.value)"
                                ></textarea>
                              </label>

                              <textarea
                                v-if="activeComicChapter"
                                class="field-textarea writing-editor-textarea writing-chapter-draft-textarea"
                                :value="activeComicChapter.content"
                                placeholder="这里沉淀单章生成结果、分镜脚本或出图提示词。"
                                @input="setComicChapterContent(activeComicChapter, $event.target.value)"
                              ></textarea>
                            </div>
                          </article>
                        </section>
                      </main>
                    </section>
                  </section>
                </template>

                <template v-else-if="ui.marketplace.view === 'writingDetail' && activeWritingBook">
                  <section class="writing-detail-shell" :class="{ 'is-ai-running': isActiveWritingBookAiRunning }">
                    <header class="writing-detail-head">
                      <button type="button" class="model-icon-button weekly-back-button" aria-label="返回书架" title="返回书架" @click="backWritingShelf">
                        <GIcon name="return" />
                      </button>

                      <div class="writing-detail-title">
                        <input
                          :value="activeWritingBook.title"
                          class="writing-title-input"
                          aria-label="书名"
                          :disabled="isActiveWritingBookAiRunning"
                          @input="setWritingBookTitle($event.target.value)"
                        />
                      </div>

                      <div class="model-section-actions">
                        <span class="pill">{{ activeWritingLengthProfile.label }}</span>
                        <span class="pill pill-neutral">{{ getWritingTabWordCount() }} 字</span>
                      </div>
                    </header>

                    <section
                      class="writing-detail-layout"
                      :class="{
                        'is-profile-collapsed': ui.marketplace.writing.isProfileCollapsed,
                        'is-ai-open': ui.marketplace.writing.isAiDrawerOpen,
                        'is-book-running': isActiveWritingBookAiRunning
                      }"
                    >
                      <aside class="writing-detail-rail" :aria-expanded="ui.marketplace.writing.isProfileCollapsed ? 'false' : 'true'">
                        <button
                          type="button"
                          class="model-icon-button writing-profile-toggle"
                          :aria-label="ui.marketplace.writing.isProfileCollapsed ? '展开书籍信息' : '折叠书籍信息'"
                          :title="ui.marketplace.writing.isProfileCollapsed ? '展开书籍信息' : '折叠书籍信息'"
                          @click="toggleWritingProfileRail"
                        >
                          <GIcon :name="ui.marketplace.writing.isProfileCollapsed ? 'chevronRight' : 'chevronLeft'" />
                        </button>

                        <div v-if="!ui.marketplace.writing.isProfileCollapsed" class="writing-rail-content">
                          <div class="writing-book-profile">
                            <div class="writing-book-cover writing-book-cover-large" :class="`is-${activeWritingBook.coverTone}`" aria-hidden="true">
                              <span>{{ activeWritingBook.title.slice(0, 1) || "书" }}</span>
                            </div>
                            <label class="field">
                              <span class="field-label">篇幅</span>
                              <select
                                :value="activeWritingBook.length"
                                class="field-input writing-mini-select"
                                @change="setWritingBookLength($event.target.value)"
                              >
                                <option value="short">短篇</option>
                                <option value="medium">中篇</option>
                                <option value="long">长篇</option>
                              </select>
                            </label>
                            <label class="field">
                              <span class="field-label">类型</span>
                              <input
                                :value="activeWritingBook.genre"
                                class="field-input writing-mini-input"
                                @input="setWritingBookGenre($event.target.value)"
                              />
                            </label>
                          </div>

                          <div class="writing-method-card">
                            <span class="field-label">篇幅策略</span>
                            <strong>{{ activeWritingLengthProfile.scope }}</strong>
                            <p>{{ activeWritingLengthProfile.method }}</p>
                            <div class="writing-method-card-foot">
                              <span>{{ activeWritingDoneChapterCount }} 章已完成</span>
                            </div>
                          </div>

                          <div class="writing-stat-list">
                            <span class="pill pill-neutral">更新 {{ formatWritingBookUpdatedAt(activeWritingBook.updatedAt) }}</span>
                            <span class="pill pill-neutral">总字数 {{ getWritingBookWordCount(activeWritingBook) }}</span>
                          </div>
                        </div>

                        <div v-if="!ui.marketplace.writing.isProfileCollapsed" class="writing-profile-actions">
                          <button
                            type="button"
                            class="writing-mini-text-button"
                            :disabled="isActiveWritingBookAiRunning"
                            @click="openWritingExportDialog"
                          >
                            书籍导出
                          </button>
                        </div>
                      </aside>

                      <main class="writing-main-stage">
                        <div class="writing-tab-bar" role="tablist" aria-label="书籍详情模块">
                          <button
                            v-for="tab in WRITING_APP_TABS"
                            :key="tab.id"
                            type="button"
                            class="writing-tab"
                            :class="{ 'is-active': ui.marketplace.writing.activeTab === tab.id }"
                            :aria-selected="ui.marketplace.writing.activeTab === tab.id ? 'true' : 'false'"
                            @click="setWritingTab(tab.id)"
                          >
                            <span>{{ tab.kicker }}</span>
                            {{ tab.label }}
                          </button>
                        </div>

                        <section class="writing-editor-grid">
                          <article class="writing-editor-card">
                            <div class="writing-editor-head">
                              <div>
                                <p class="feature-kicker">{{ activeWritingTabMeta.kicker }}</p>
                                <p class="model-section-title">{{ activeWritingTabMeta.fieldLabel }}</p>
                              </div>
                              <div class="writing-editor-tools">
                                <span class="status-pill">{{ getWritingTabWordCount() }} 字</span>
                                <button
                                  type="button"
                                  class="model-icon-button writing-ai-float-trigger"
                                  :aria-label="ui.marketplace.writing.isAiDrawerOpen ? '收起大师辅助' : '打开大师辅助'"
                                  :title="ui.marketplace.writing.isAiDrawerOpen ? '收起大师辅助' : '打开大师辅助'"
                                  @click="setWritingAiDrawerOpen(!ui.marketplace.writing.isAiDrawerOpen)"
                                >
                                  <GIcon name="sparkles" />
                                </button>
                              </div>
                            </div>

                            <div v-if="ui.marketplace.writing.activeTab === 'intro'" class="writing-intro-stack">
                              <label v-for="section in activeWritingIntroSections" :key="section.key" class="field writing-intro-field">
                                <span class="field-label">{{ section.label }}</span>
                                <textarea
                                  class="field-textarea writing-editor-textarea writing-intro-textarea"
                                  :class="{ 'is-large': section.key !== 'intro' }"
                                  :value="getWritingIntroFieldValue(activeWritingBook, section.key)"
                                  :placeholder="section.placeholder"
                                  @input="setWritingIntroField(activeWritingBook, section.key, $event.target.value)"
                                ></textarea>
                              </label>
                            </div>

                            <div v-else-if="ui.marketplace.writing.activeTab === 'outline'" class="writing-outline-board">
                              <div class="writing-chapter-list-panel">
                                <div class="writing-chapter-panel-head">
                                  <div>
                                    <p class="feature-kicker">Chapter List</p>
                                    <p class="writing-panel-title">{{ activeWritingChapters.length }} 个章节</p>
                                  </div>
                                  <button type="button" class="model-icon-button" aria-label="新增章节" title="新增章节" @click="createWritingChapter">
                                    <GIcon name="add" />
                                  </button>
                                </div>

                                <div class="writing-chapter-list">
                                  <button
                                    v-for="(chapter, index) in activeWritingChapters"
                                    :key="chapter.id"
                                    type="button"
                                    class="writing-chapter-list-item"
                                    :class="{
                                      'is-active': activeWritingChapter?.id === chapter.id,
                                      'is-done': chapter.status === 'done',
                                      'is-progress': chapter.status === 'inProgress'
                                    }"
                                    @click="selectWritingChapter(chapter.id)"
                                  >
                                    <span class="writing-chapter-list-title-row">
                                      <span class="writing-chapter-list-title">{{ getWritingChapterDisplayTitle(chapter, index) }}</span>
                                      <span v-if="getWritingChapterPartLabel(activeWritingBook, chapter)" class="writing-chapter-part-label">
                                        {{ getWritingChapterPartLabel(activeWritingBook, chapter) }}
                                      </span>
                                    </span>
                                    <span class="writing-chapter-list-meta">
                                      <span class="status-pill" :class="getWritingChapterStatusClass(chapter.status)">
                                        {{ getWritingChapterStatusLabel(chapter.status) }}
                                      </span>
                                      <span>{{ getWritingChapterWordCount(chapter) }} 字</span>
                                    </span>
                                  </button>
                                </div>
                              </div>

                              <div v-if="activeWritingChapter" class="writing-chapter-summary-panel">
                                <div class="writing-chapter-summary-head">
                                  <div>
                                    <p class="feature-kicker">Chapter Brief</p>
                                    <p class="writing-panel-title">章节简介</p>
                                  </div>
                                  <span class="status-pill" :class="getWritingChapterStatusClass(activeWritingChapter.status)">
                                    {{ getWritingChapterStatusLabel(activeWritingChapter.status) }}
                                  </span>
                                </div>

                                <textarea
                                  class="field-textarea writing-editor-textarea writing-chapter-summary-textarea"
                                  :value="activeWritingChapter.summary"
                                  placeholder="写下本章目标、主要冲突、信息增量、人物变化和结尾钩子。"
                                  @input="setWritingChapterSummary(activeWritingChapter, $event.target.value)"
                                ></textarea>

                                <div class="model-section-actions writing-chapter-summary-actions">
                                  <button type="button" class="model-action-secondary" @click="goWritingChapter(activeWritingChapter.id)">
                                    进入编写
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div v-else class="writing-chapter-workbench">
                              <div v-if="activeWritingChapter" class="writing-chapter-commandbar">
                                <div class="writing-chapter-picker-row">
                                  <div class="writing-chapter-picker">
                                    <span class="field-label">当前章节</span>
                                    <div class="writing-chapter-dropdown" :class="{ 'is-open': ui.marketplace.writing.isChapterPickerOpen }">
                                      <button
                                        type="button"
                                        class="writing-chapter-dropdown-trigger"
                                        :aria-expanded="ui.marketplace.writing.isChapterPickerOpen ? 'true' : 'false'"
                                        aria-haspopup="listbox"
                                        @click="toggleWritingChapterPicker"
                                      >
                                        <span>{{ getWritingChapterDisplayTitle(activeWritingChapter, activeWritingChapterIndex) }}</span>
                                        <GIcon name="chevronDown" />
                                      </button>

                                      <div
                                        v-if="ui.marketplace.writing.isChapterPickerOpen"
                                        ref="writingChapterDropdownMenuRef"
                                        class="writing-chapter-dropdown-menu"
                                        role="listbox"
                                      >
                                        <button
                                          v-for="entry in filteredWritingChapterEntries"
                                          :key="entry.chapter.id"
                                          type="button"
                                          class="writing-chapter-dropdown-item"
                                          :class="{ 'is-active': activeWritingChapter?.id === entry.chapter.id }"
                                          role="option"
                                          :aria-selected="activeWritingChapter?.id === entry.chapter.id ? 'true' : 'false'"
                                          @click="selectWritingChapterFromPicker(entry.chapter.id)"
                                        >
                                          <span>{{ entry.title }}</span>
                                          <small>
                                            {{ getWritingChapterStatusLabel(entry.chapter.status) }} / {{ getWritingChapterWordCount(entry.chapter) }} 字
                                          </small>
                                        </button>
                                        <p v-if="!filteredWritingChapterEntries.length" class="writing-chapter-dropdown-empty">没有匹配章节</p>
                                      </div>
                                    </div>
                                  </div>

                                  <label class="field writing-chapter-search-field">
                                    <span class="field-label">搜索</span>
                                    <input
                                      v-model="ui.marketplace.writing.chapterSearchQuery"
                                      class="field-input writing-chapter-search-input"
                                      placeholder="章节名"
                                      @focus="setWritingChapterPickerOpen(true)"
                                    />
                                  </label>
                                </div>

                                <span class="status-pill writing-chapter-status-pill" :class="getWritingChapterStatusClass(activeWritingChapter.status)">
                                  {{ getWritingChapterStatusLabel(activeWritingChapter.status) }}
                                </span>

                                <button
                                  type="button"
                                  class="model-action writing-chapter-submit"
                                  :class="{ 'is-submitted': isWritingChapterSubmitConfirmed(activeWritingChapter) }"
                                  :disabled="!getWritingChapterWordCount(activeWritingChapter) || isWritingChapterSubmitConfirmed(activeWritingChapter)"
                                  @click="submitWritingChapter"
                                >
                                  <GIcon v-if="isWritingChapterSubmitConfirmed(activeWritingChapter)" name="check" :size="13" />
                                  {{ isWritingChapterSubmitConfirmed(activeWritingChapter) ? "已提交" : "提交" }}
                                </button>
                              </div>

                              <div v-if="activeWritingChapter" class="writing-chapter-brief-strip">
                                <strong>{{ getWritingChapterDisplayTitle(activeWritingChapter, activeWritingChapterIndex) }}</strong>
                                <p>{{ activeWritingChapter.summary || "这个章节还没有简介。" }}</p>
                              </div>

                              <textarea
                                v-if="activeWritingChapter"
                                class="field-textarea writing-editor-textarea writing-chapter-draft-textarea"
                                :value="activeWritingChapter.content"
                                placeholder="从这一章的第一个场景开始写。"
                                @input="setWritingChapterContent(activeWritingChapter, $event.target.value)"
                              ></textarea>
                            </div>
                          </article>

                          <WritingAiDrawer
                            :state="ui.marketplace.writing"
                            :active-writing-task="activeWritingTask"
                            :active-writing-task-options="activeWritingTaskOptions"
                            :active-writing-prompt-preview="activeWritingPromptPreview"
                            :active-writing-long-outline-request="activeWritingLongOutlineRequest"
                            :active-writing-outline-planner-job="activeWritingOutlinePlannerJob"
                            :active-writing-book="activeWritingBook"
                            :toggle-writing-ai-task-picker="toggleWritingAiTaskPicker"
                            :select-writing-ai-task="selectWritingAiTask"
                            :toggle-writing-prompt-preview="toggleWritingPromptPreview"
                            :build-writing-long-outline-target-content="buildWritingLongOutlineTargetContent"
                            :get-writing-outline-planner-status-label="getWritingOutlinePlannerStatusLabel"
                            :get-writing-outline-planner-status-class="getWritingOutlinePlannerStatusClass"
                            :get-writing-outline-planner-progress-percent="getWritingOutlinePlannerProgressPercent"
                            :get-writing-outline-planner-progress-copy="getWritingOutlinePlannerProgressCopy"
                            :get-writing-outline-planner-retry-copy="getWritingOutlinePlannerRetryCopy"
                            :can-resume-writing-outline-planner="canResumeWritingOutlinePlanner"
                            :resume-writing-outline-planning-job="resumeWritingOutlinePlanningJob"
                            :get-writing-ai-run-button-label="getWritingAiRunButtonLabel"
                            :generate-writing-assistant-output="generateWritingAssistantOutput"
                            :get-writing-ai-feedback-class="getWritingAiFeedbackClass"
                            :apply-writing-assistant-output="applyWritingAssistantOutput"
                          />
                        </section>
                      </main>

                      <div v-if="isActiveWritingBookAiRunning" class="writing-ai-busy-shield" role="status" aria-live="polite">
                        <div class="writing-ai-busy-card" :class="{ 'has-stop': isWritingOutlinePlannerRunning(activeWritingOutlinePlannerJob) }">
                          <span class="writing-ai-busy-orbit" aria-hidden="true">
                            <i></i>
                            <i></i>
                            <i></i>
                          </span>
                          <div class="writing-ai-busy-copy">
                            <strong>{{ getWritingBusyTitle() }}</strong>
                            <p>{{ getWritingBusyDescription() }}</p>
                          </div>
                          <button
                            v-if="isWritingOutlinePlannerRunning(activeWritingOutlinePlannerJob)"
                            type="button"
                            class="writing-ai-busy-stop"
                            aria-label="停止任务"
                            title="停止任务"
                            @click="cancelWritingOutlinePlanningJob"
                          >
                            <GIcon name="stop" :size="15" />
                          </button>
                        </div>
                      </div>
                    </section>
                  </section>
                </template>
              </div>
            </div>
          </template>

          <template v-else-if="activeFeature === FEATURE_TASKS">
            <WeeklyWorkbench
              :state="ui.weekly"
              :weekly-progress="workbench.weeklyProgress"
              :active-model="activeModel"
              :weekly-task-rewrite-ids="weeklyTaskRewriteIds"
              :add-weekly-project="addWeeklyProject"
              :add-weekly-report-template="addWeeklyReportTemplate"
              :add-weekly-task="addWeeklyTask"
              :close-weekly-editor="closeWeeklyEditor"
              :handle-rich-text-click="handleRichTextClick"
              :handle-weekly-active-report-generation="handleWeeklyActiveReportGeneration"
              :handle-weekly-delete="handleWeeklyDelete"
              :handle-weekly-report-output-copy="handleWeeklyReportOutputCopy"
              :handle-weekly-report-template-selection-change="handleWeeklyReportTemplateSelectionChange"
              :handle-weekly-save="handleWeeklySave"
              :is-weekly-project-collapsed="isWeeklyProjectCollapsed"
              :open-weekly-record="openWeeklyRecord"
              :optimize-weekly-task-title="optimizeWeeklyTaskTitle"
              :remove-weekly-project="removeWeeklyProject"
              :remove-weekly-selected-report-template="removeWeeklySelectedReportTemplate"
              :remove-weekly-task="removeWeeklyTask"
              :reset-weekly-report-copy-state="resetWeeklyReportCopyState"
              :set-weekly-reporting-mode="setWeeklyReportingMode"
              :set-weekly-report-output-mode="setWeeklyReportOutputMode"
              :set-weekly-task-status="setWeeklyTaskStatus"
              :toggle-weekly-project-collapsed="toggleWeeklyProjectCollapsed"
              :touch-weekly-task-by-id="touchWeeklyTaskById"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_WORKFLOW_LIBRARY">
            <WorkflowLibraryView
              :ui="ui"
              :workflow-library-cards="workflowLibraryCards"
              :workflow-detail-title="workflowDetailTitle"
              :filtered-workflow-records="filteredWorkflowRecords"
              :active-workflow-record="activeWorkflowRecord"
              :active-workflow-metrics="activeWorkflowMetrics"
              :active-workflow-api-key-input-type="activeWorkflowApiKeyInputType"
              :active-workflow-environments="activeWorkflowEnvironments"
              :active-workflow-environment="activeWorkflowEnvironment"
              :active-workflow-body-step-options="activeWorkflowBodyStepOptions"
              :workflow-body-draft-changed="workflowBodyDraftChanged"
              :workflow-run-control-label="workflowRunControlLabel"
              :workflow-run-control-icon="workflowRunControlIcon"
              :workflow-run-status-label="workflowRunStatusLabel"
              :workflow-run-status-tone="workflowRunStatusTone"
              :active-workflow-steps="activeWorkflowSteps"
              :add-workflow-draft-environment="addWorkflowDraftEnvironment"
              :add-workflow-draft-step="addWorkflowDraftStep"
              :add-workflow-step-output="addWorkflowStepOutput"
              :cancel-active-workflow-run="cancelActiveWorkflowRun"
              :delete-workflow-record="deleteWorkflowRecord"
              :duplicate-workflow-record="duplicateWorkflowRecord"
              :format-duration-ms="formatDurationMs"
              :format-local-date-time="formatLocalDateTime"
              :get-workflow-card-count-label="getWorkflowCardCountLabel"
              :get-workflow-run-completed-count="getWorkflowRunCompletedCount"
              :get-workflow-run-duration-label="getWorkflowRunDurationLabel"
              :get-workflow-run-progress-percent="getWorkflowRunProgressPercent"
              :get-workflow-run-summary-text="getWorkflowRunSummaryText"
              :get-workflow-step-mode-label="getWorkflowStepModeLabel"
              :get-workflow-step-progress-percent="getWorkflowStepProgressPercent"
              :get-workflow-step-status-label="getWorkflowStepStatusLabel"
              :get-workflow-step-status-tone="getWorkflowStepStatusTone"
              :get-workflow-step-visual-rows="getWorkflowStepVisualRows"
              :handle-workflow-api-key-input="handleWorkflowApiKeyInput"
              :handle-workflow-back="handleWorkflowBack"
              :handle-workflow-body-draft-input="handleWorkflowBodyDraftInput"
              :handle-workflow-body-step-select="handleWorkflowBodyStepSelect"
              :handle-workflow-curl-copy="handleWorkflowCurlCopy"
              :is-workflow-step-expanded="isWorkflowStepExpanded"
              :open-workflow-card="openWorkflowCard"
              :open-workflow-record="openWorkflowRecord"
              :open-workflow-record-editor="openWorkflowRecordEditor"
              :persist-active-workflow-runtime-config="persistActiveWorkflowRuntimeConfig"
              :persist-workflow-body-draft-to-template="persistWorkflowBodyDraftToTemplate"
              :remove-workflow-draft-environment="removeWorkflowDraftEnvironment"
              :remove-workflow-draft-step="removeWorkflowDraftStep"
              :remove-workflow-step-output="removeWorkflowStepOutput"
              :repair-workflow-body-draft="repairWorkflowBodyDraft"
              :run-active-workflow-record="runActiveWorkflowRecord"
              :save-workflow-record="saveWorkflowRecord"
              :select-workflow-environment="selectWorkflowEnvironment"
              :sync-workflow-body-draft-from-active-step="syncWorkflowBodyDraftFromActiveStep"
              :toggle-workflow-step-expanded="toggleWorkflowStepExpanded"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_COMMAND_WORKSHOP">
            <CommandWorkshopView
              ref="commandWorkshopViewRef"
              :ui="ui"
              :workbench="workbench"
              :active-command-session="activeCommandSession"
              :active-command-messages="activeCommandMessages"
              :command-chat-title="commandChatTitle"
              :command-settings-summary="commandSettingsSummary"
              :enabled-agent-profiles="enabledAgentProfiles"
              :command-selected-agent="commandSelectedAgent"
              :command-runnable-skills="commandRunnableSkills"
              :command-authorized-servers="commandAuthorizedServers"
              :command-tool-options="commandToolOptions"
              :back-to-command-list="backToCommandList"
              :begin-new-command-session="beginNewCommandSession"
              :get-command-artifact-call-secondary="getCommandArtifactCallSecondary"
              :get-command-artifact-call-title="getCommandArtifactCallTitle"
              :get-command-artifact-inline-text="getCommandArtifactInlineText"
              :get-command-artifact-step-secondary="getCommandArtifactStepSecondary"
              :get-command-artifact-summary="getCommandArtifactSummary"
              :get-skill-option-label="getSkillOptionLabel"
              :handle-command-agent-change="handleCommandAgentChange"
              :handle-command-attachment-select="handleCommandAttachmentSelect"
              :handle-command-input-composition-end="handleCommandInputCompositionEnd"
              :handle-command-input-composition-start="handleCommandInputCompositionStart"
              :handle-command-input-enter-keydown="handleCommandInputEnterKeydown"
              :handle-command-load-mcp-tools="handleCommandLoadMcpTools"
              :handle-command-server-change="handleCommandServerChange"
              :handle-command-session-delete="handleCommandSessionDelete"
              :handle-command-submit="handleCommandSubmit"
              :handle-rich-text-click="handleRichTextClick"
              :open-command-session="openCommandSession"
              :remove-command-attachment="removeCommandAttachment"
              :resolve-agent-name="resolveAgentName"
            />
          </template>

          <template v-else-if="activeFeature === FEATURE_EXTENSIONS_MANAGEMENT">
            <ExtensionsManagementView
              :ui="ui"
              :workbench="workbench"
              :runner-agent="runnerAgent"
              :runner-runnable-skills="runnerRunnableSkills"
              :runner-authorized-servers="runnerAuthorizedServers"
              :runner-latest-result="runnerLatestResult"
              :runner-recent-logs="runnerRecentLogs"
              :close-extension-panels="closeExtensionPanels"
              :format-failure-kind="formatFailureKind"
              :format-local-date-time="formatLocalDateTime"
              :get-extension-editor-title="getExtensionEditorTitle"
              :get-extension-initials="getExtensionInitials"
              :get-skill-display-name="getSkillDisplayName"
              :get-skill-local-mirror-detail="getSkillLocalMirrorDetail"
              :get-skill-option-label="getSkillOptionLabel"
              :get-skill-source-detail="getSkillSourceDetail"
              :get-skill-source-label="getSkillSourceLabel"
              :handle-agent-delete="handleAgentDelete"
              :handle-agent-status-toggle="handleAgentStatusToggle"
              :handle-extension-editor-save="handleExtensionEditorSave"
              :handle-mcp-delete="handleMcpDelete"
              :handle-mcp-status-toggle="handleMcpStatusToggle"
              :handle-runner-load-mcp-tools="handleRunnerLoadMcpTools"
              :handle-runner-server-change="handleRunnerServerChange"
              :handle-runner-submit="handleRunnerSubmit"
              :handle-skill-delete="handleSkillDelete"
              :handle-skill-status-toggle="handleSkillStatusToggle"
              :is-builtin-workbench-item="isBuiltinWorkbenchItem"
              :open-agent-runner="openAgentRunner"
              :open-extension-editor="openExtensionEditor"
              :reset-runner-state="resetRunnerState"
              :resolve-bound-model-name="resolveBoundModelName"
              :truncate-text="truncateText"
            />
          </template>

          <template v-else>
            <div class="workspace-stage workspace-stage-scroll">
              <article class="placeholder-card">
                <div>
                  <p class="feature-kicker">Coming Soon</p>
                  <p class="placeholder-title">{{ FEATURE_PLACEHOLDERS[activeFeature]?.title ?? "功能建设中" }}</p>
                  <p class="models-copy">{{ FEATURE_PLACEHOLDERS[activeFeature]?.description ?? "这里后续会补充对应功能模块。" }}</p>
                </div>
              </article>
            </div>
          </template>
        </section>
      </section>
    </main>

    <Transition name="gordon-dialog-fade">
      <div v-if="ui.dialog.open" class="gordon-dialog-backdrop" @click.self="handleGordonDialogBackdrop">
        <section
          class="gordon-dialog"
          :class="[`is-${ui.dialog.tone}`, `is-${ui.dialog.kind}`]"
          role="dialog"
          aria-modal="true"
          :aria-label="ui.dialog.title"
        >
          <div class="gordon-dialog-head">
            <div class="gordon-dialog-mark" aria-hidden="true">
              <GIcon :name="ui.dialog.tone === 'danger' ? 'delete' : ui.dialog.kind === 'confirm' ? 'settings' : 'more'" />
            </div>

            <div>
              <p class="gordon-dialog-kicker">
                {{ ui.dialog.kind === "confirm" ? "Confirm" : ui.dialog.kind === "input" ? "Input" : "Notice" }}
              </p>
              <h2 class="gordon-dialog-title">{{ ui.dialog.title }}</h2>
            </div>
          </div>

          <p v-if="ui.dialog.message" class="gordon-dialog-message">{{ ui.dialog.message }}</p>

          <div v-if="ui.dialog.detailLines.length" class="gordon-dialog-detail">
            <p v-for="line in ui.dialog.detailLines" :key="line">{{ line }}</p>
          </div>

          <label v-if="ui.dialog.kind === 'input'" class="gordon-dialog-field">
            <span class="gordon-dialog-field-label">{{ ui.dialog.inputLabel }}</span>
            <input
              ref="gordonDialogInputRef"
              v-model="ui.dialog.inputValue"
              class="gordon-dialog-input"
              type="text"
              :placeholder="ui.dialog.inputPlaceholder"
              @keydown.enter.prevent="resolveGordonDialog(true)"
            />
          </label>

          <div class="gordon-dialog-actions">
            <button
              v-if="ui.dialog.kind !== 'alert'"
              type="button"
              class="gordon-dialog-button gordon-dialog-button-secondary"
              @click="resolveGordonDialog(false)"
            >
              {{ ui.dialog.cancelText }}
            </button>

            <button
              ref="gordonDialogPrimaryRef"
              type="button"
              class="gordon-dialog-button gordon-dialog-button-primary"
              @click="resolveGordonDialog(true)"
            >
              {{ ui.dialog.confirmText }}
            </button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="gordon-dialog-fade">
      <div
        v-if="ui.marketplace.comic.isExportDialogOpen"
        class="gordon-dialog-backdrop writing-export-backdrop"
        @click.self="closeComicExportDialog"
      >
        <section class="gordon-dialog writing-export-dialog" role="dialog" aria-modal="true" aria-label="作品导出">
          <div class="gordon-dialog-head">
            <div class="gordon-dialog-mark writing-export-mark" aria-hidden="true">漫</div>

            <div>
              <p class="gordon-dialog-kicker">Export</p>
              <h2 class="gordon-dialog-title">作品导出</h2>
            </div>
          </div>

          <p class="gordon-dialog-message">
            导出当前漫画项目的总介绍、目录和单章生成内容，文件名固定为 {{ activeComicExportFileName }}。
          </p>

          <div class="writing-export-panel">
            <div class="writing-export-field">
              <span class="gordon-dialog-field-label">文件类型</span>
              <div class="writing-export-format-row" role="radiogroup" aria-label="导出文件类型">
                <button
                  type="button"
                  class="writing-export-format-button is-active"
                  aria-checked="true"
                  role="radio"
                  :disabled="ui.marketplace.comic.isExporting"
                >
                  Markdown
                </button>
              </div>
            </div>

            <div class="writing-export-field">
              <span class="gordon-dialog-field-label">输出目录</span>
              <div class="writing-export-directory-row">
                <input
                  class="gordon-dialog-input writing-export-directory-input"
                  :value="ui.marketplace.comic.exportDirectory || '尚未选择目录'"
                  readonly
                />
                <button
                  type="button"
                  class="gordon-dialog-button gordon-dialog-button-secondary"
                  :disabled="ui.marketplace.comic.isExporting"
                  @click="selectComicExportDirectory"
                >
                  选择目录
                </button>
              </div>
            </div>

            <div class="writing-export-summary">
              <span>章节数量：{{ activeComicChapters.length }}</span>
              <span>导出文件：{{ activeComicExportFileName }}</span>
            </div>
          </div>

          <p
            v-if="ui.marketplace.comic.exportFeedback"
            class="writing-export-feedback"
            :class="`is-${ui.marketplace.comic.exportFeedbackTone}`"
          >
            {{ ui.marketplace.comic.exportFeedback }}
          </p>

          <div class="gordon-dialog-actions">
            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-secondary"
              :disabled="ui.marketplace.comic.isExporting"
              @click="closeComicExportDialog"
            >
              取消
            </button>

            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-primary"
              :disabled="!canExportActiveComicProject"
              @click="exportActiveComicProject"
            >
              {{ ui.marketplace.comic.isExporting ? "保存中" : "确认" }}
            </button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="gordon-dialog-fade">
      <div
        v-if="ui.marketplace.writing.isExportDialogOpen"
        class="gordon-dialog-backdrop writing-export-backdrop"
        @click.self="closeWritingExportDialog"
      >
        <section class="gordon-dialog writing-export-dialog" role="dialog" aria-modal="true" aria-label="书籍导出">
          <div class="gordon-dialog-head">
            <div class="gordon-dialog-mark writing-export-mark" aria-hidden="true">文</div>

            <div>
              <p class="gordon-dialog-kicker">Export</p>
              <h2 class="gordon-dialog-title">书籍导出</h2>
            </div>
          </div>

          <p class="gordon-dialog-message">
            只拼接已完成章节，文件名固定为 {{ activeWritingExportFileName }}。
          </p>

          <div class="writing-export-panel">
            <div class="writing-export-field">
              <span class="gordon-dialog-field-label">文件类型</span>
              <div class="writing-export-format-row" role="radiogroup" aria-label="导出文件类型">
                <button
                  v-for="format in WRITING_BOOK_EXPORT_FORMATS"
                  :key="format.id"
                  type="button"
                  class="writing-export-format-button"
                  :class="{ 'is-active': ui.marketplace.writing.exportFormat === format.id }"
                  :aria-checked="ui.marketplace.writing.exportFormat === format.id ? 'true' : 'false'"
                  role="radio"
                  :disabled="ui.marketplace.writing.isExporting"
                  @click="setWritingExportFormat(format.id)"
                >
                  {{ format.label }}
                </button>
              </div>
            </div>

            <div class="writing-export-field">
              <span class="gordon-dialog-field-label">输出目录</span>
              <div class="writing-export-directory-row">
                <input
                  class="gordon-dialog-input writing-export-directory-input"
                  :value="ui.marketplace.writing.exportDirectory || '尚未选择目录'"
                  readonly
                />
                <button
                  type="button"
                  class="gordon-dialog-button gordon-dialog-button-secondary"
                  :disabled="ui.marketplace.writing.isExporting"
                  @click="selectWritingExportDirectory"
                >
                  选择目录
                </button>
              </div>
            </div>

            <div class="writing-export-summary">
              <span>已完成章节：{{ activeWritingDoneChapterCount }}</span>
              <span>导出文件：{{ activeWritingExportFileName }}</span>
            </div>
          </div>

          <p
            v-if="ui.marketplace.writing.exportFeedback"
            class="writing-export-feedback"
            :class="`is-${ui.marketplace.writing.exportFeedbackTone}`"
          >
            {{ ui.marketplace.writing.exportFeedback }}
          </p>

          <div class="gordon-dialog-actions">
            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-secondary"
              :disabled="ui.marketplace.writing.isExporting"
              @click="closeWritingExportDialog"
            >
              取消
            </button>

            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-primary"
              :disabled="!canExportActiveWritingBook"
              @click="exportActiveWritingBook"
            >
              {{ ui.marketplace.writing.isExporting ? "保存中" : "确认" }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import robotSceneUrl from "../assets/spline-backups/home-robot-scene.splinecode?url";
import GIcon from "./components/GIcon.vue";
import MorphingText from "./components/MorphingText.vue";
import { createCommandWorkshopActions } from "./features/command-workshop/commandWorkshopActions.js";
import { createCommandWorkshopState } from "./features/command-workshop/commandWorkshopState.js";
import CommandWorkshopView from "./features/command-workshop/CommandWorkshopView.vue";
import ExtensionsManagementView from "./features/extensions/ExtensionsManagementView.vue";
import {
  COMIC_APP_NAME,
  COMIC_APP_TABS,
  COMIC_CHAPTER_STATUS_META,
  COMIC_PROJECT_COVER_TONES,
  COMIC_PROJECT_FORMAT_META,
  COMIC_PROJECT_PALETTE_META,
  MARKETPLACE_APP_COUNT,
  createMarketplaceState
} from "./features/marketplace/marketplaceConfig.js";
import ModelManagementView from "./features/model-management/ModelManagementView.vue";
import {
  BRAND_RANDOM_TEXTS,
  FEATURE_COMMAND_WORKSHOP,
  FEATURE_ENTRIES,
  FEATURE_EXTENSIONS_MANAGEMENT,
  FEATURE_HOME,
  FEATURE_MARKETPLACE,
  FEATURE_MODEL_MANAGEMENT,
  FEATURE_PLACEHOLDERS,
  FEATURE_TASKS,
  FEATURE_WORKFLOW_LIBRARY,
  HOME_SETTINGS_ITEMS
} from "./features/shell/shellConfig.js";
import { createWeeklyState } from "./features/weekly/weeklyConfig.js";
import { createWeeklyActions } from "./features/weekly/weeklyActions.js";
import WeeklyWorkbench from "./features/weekly/WeeklyWorkbench.vue";
import { getWeeklyDraftSnapshot } from "./features/weekly/weeklyRuntime.js";
import {
  createDefaultWorkflowEnvironments,
  createWorkflowOutputDraft as createWorkflowOutputDraftFromConfig,
  createWorkflowRecordDraft as createWorkflowRecordDraftFromConfig,
  createWorkflowState as createWorkflowStateFromConfig,
  createWorkflowStepDraft as createWorkflowStepDraftFromConfig
} from "./features/workflow-library/workflowConfig.js";
import WorkflowLibraryView from "./features/workflow-library/WorkflowLibraryView.vue";
import {
  buildWorkflowInitialRunResult,
  buildWorkflowRecordFromDraft as buildWorkflowRecordFromDraftRuntime,
  createWorkflowRecordDraftFromRecord as createWorkflowRecordDraftFromRecordRuntime,
  extractCurlMethod,
  extractCurlUrl,
  findWorkflowCurlBodySegment,
  formatDurationMs,
  getWorkflowCardCountLabel,
  getWorkflowProtocolSummary,
  getWorkflowRunCompletedCount,
  getWorkflowRunDurationLabel,
  getWorkflowRunProgressPercent,
  getWorkflowRunSummaryText,
  getWorkflowRuntimeMissingFields,
  getWorkflowStepModeLabel,
  getWorkflowStepOutput,
  getWorkflowStepProgressPercent,
  getWorkflowStepStatusLabel,
  getWorkflowStepStatusTone,
  getWorkflowStepVisualRows,
  looksLikeWorkflowJsonBody,
  normalizeWorkflowBodyDraftForCompare,
  normalizeWorkflowEnvironments,
  repairWorkflowBodyText,
  replaceWorkflowCurlBody
} from "./features/workflow-library/workflowRuntime.js";
import {
  WRITING_AI_TASKS,
  WRITING_APP_NAME,
  WRITING_APP_TABS,
  WRITING_AUTOSAVE_DELAY,
  WRITING_BOOK_EXPORT_FORMATS,
  WRITING_CHAPTER_MAX_OUTPUT_TOKENS,
  WRITING_CHAPTER_PREFIX_PATTERN,
  WRITING_CHAPTER_STATUS_META,
  WRITING_INTRO_SECTION_DEFINITIONS,
  WRITING_LENGTH_PROFILES,
  WRITING_LONG_OUTLINE_BATCH_MAX_TOKENS,
  WRITING_LONG_OUTLINE_BATCH_SIZE,
  WRITING_LONG_OUTLINE_MASTER_MAX_TOKENS,
  WRITING_MODEL_MAX_RETRY_ATTEMPTS,
  WRITING_MODEL_RETRY_BASE_DELAY_MS,
  WRITING_MODEL_RETRY_MAX_DELAY_MS,
  WRITING_OUTLINE_EXPANSION_PATTERN,
  WRITING_OUTLINE_REWRITE_PATTERN,
  WRITING_PART_PREFIX_PATTERN
} from "./features/writing/writingConfig.js";
import WritingAiDrawer from "./features/writing/WritingAiDrawer.vue";
import {
  buildWritingAssistantPrompt as buildWritingAssistantPromptFromAssets,
  buildWritingLongOutlineBatchPrompt as buildWritingLongOutlineBatchPromptFromAssets,
  buildWritingLongOutlineMasterPrompt as buildWritingLongOutlineMasterPromptFromAssets,
  createWritingPromptAssets,
  getWritingTaskPromptSpec as getWritingTaskPromptSpecFromAssets,
  loadWritingPromptAssets
} from "./features/writing/writingPromptBuilder.js";
import {
  PROVIDER_ORDER,
  formatLocalDateTime,
  getProviderMeta,
  getSkillDisplayName,
  getSkillLocalMirrorDetail,
  getSkillOptionLabel,
  getSkillSourceDetail,
  getSkillSourceLabel,
  isBuiltinWorkbenchItem,
  maskSecret,
  normalizeTagList,
  parseEnvText,
  renderRichText,
  stringifyEnvRecord,
  truncateText
} from "./lib/presenter.js";

const MODEL_BALANCE_QUERY_TEMPLATE = [
  "({",
  "  request: {",
  "    url: \"https://xxxxx\",",
  "    method: \"GET\",",
  "    headers: {",
  "      Authorization: \"Bearer {{apiKey}}\",",
  "      \"User-Agent\": \"cc-switch/1.0\",",
  "    },",
  "  },",
  "  extractor: function (raw) {",
  "    const response = typeof raw === \"string\" ? JSON.parse(raw) : raw || {};",
  "",
  "    const data = response.resp_data || {};",
  "",
  "    return {",
  "      planName: data.team || \"unknown\",",
  "      remaining: data.money || 0,",
  "      used: 1000 - data.money,",
  "      total: 1000,",
  "      unit: \"USD\",",
  "    };",
  "  },",
  "});"
].join("\n");

const MODEL_USAGE_DAILY_WINDOW_DAYS = 30;
const MODEL_USAGE_DAY_START_HOUR = 1;

const desktopApi = window.gordonDesktop ?? null;
const writingPromptAssets = reactive(createWritingPromptAssets());
let splineApplicationClass = null;
let splineApplicationPromise = null;
let comicAutosaveTimer = null;
let comicSaveInFlight = false;
let comicQueuedSaveProjectId = null;
let writingAutosaveTimer = null;
let writingSaveInFlight = false;
let writingQueuedSave = null;
let activeWritingModelRequestId = "";
let agentProgressListenerId = null;
let workflowProgressListenerId = null;
const writingBookSaveVersions = new Map();

function createEmptyModelSettings() {
  return {
    profiles: [],
    activeProfileId: null
  };
}

function createModelEditorState(provider = "openai", profile = null) {
  return {
    mode: profile ? "edit" : "create",
    profileId: profile?.id ?? null,
    provider,
    values: {
      displayName: profile?.displayName ?? "",
      model: profile?.model ?? "",
      apiKey: profile?.apiKey ?? "",
      baseUrl: profile?.baseUrl ?? "",
      organization: profile?.organization ?? "",
      project: profile?.project ?? "",
      location: profile?.location ?? "",
      notes: profile?.notes ?? "",
      balanceQueryCode: profile?.balanceQueryCode ?? ""
    },
    balanceQueryResult: profile?.balanceSnapshot ?? null,
    balanceQueryError: "",
    isBalanceQuerying: false,
    lastBalanceQueryCode: profile?.balanceQueryCode ?? "",
    apiKeyVisible: false,
    isSaving: false,
    saveState: "idle"
  };
}

function createWorkflowState() {
  return createWorkflowStateFromConfig(createLocalId);
}

function createWorkflowStepDraft(overrides = {}) {
  return createWorkflowStepDraftFromConfig(overrides, createLocalId);
}

function createWorkflowOutputDraft(overrides = {}) {
  return createWorkflowOutputDraftFromConfig(overrides, createLocalId);
}

function createWorkflowRecordDraft() {
  return createWorkflowRecordDraftFromConfig(createLocalId);
}

function createWorkflowRecordDraftFromRecord(record) {
  return createWorkflowRecordDraftFromRecordRuntime(record, { createLocalId });
}

function buildWorkflowRecordFromDraft(draft, existingRecord = null) {
  return buildWorkflowRecordFromDraftRuntime(draft, existingRecord, { createLocalId });
}

function createExtensionEditorState(kind = "agent", entry = null) {
  if (kind === "skill") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        promptTemplate: entry?.promptTemplate ?? "",
        handlerRef: entry?.handlerRef ?? ""
      }
    };
  }

  if (kind === "skill-import") {
    return {
      kind,
      mode: "create",
      entryId: null,
      values: {
        repo: "",
        ref: "main",
        path: ""
      }
    };
  }

  if (kind === "mcp") {
    return {
      kind,
      mode: entry ? "edit" : "create",
      entryId: entry?.id ?? null,
      values: {
        name: entry?.name ?? "",
        description: entry?.description ?? "",
        transport: entry?.transport ?? "stdio",
        command: entry?.command ?? "",
        url: entry?.url ?? "",
        envText: stringifyEnvRecord(entry?.env ?? {}),
        toolAllowlist: (entry?.toolAllowlist ?? []).join(", ")
      }
    };
  }

  return {
    kind: "agent",
    mode: entry ? "edit" : "create",
    entryId: entry?.id ?? null,
    values: {
      name: entry?.name ?? "",
      description: entry?.description ?? "",
      mode: entry?.mode ?? "task",
      modelProfileId: entry?.modelProfileId ?? "",
      systemPrompt: entry?.systemPrompt ?? "",
      allowedSkillIds: [...(entry?.allowedSkillIds ?? [])],
      allowedMcpServerIds: [...(entry?.allowedMcpServerIds ?? [])]
    }
  };
}

function createAgentRunnerState(agentId = "") {
  return {
    agentId,
    skillId: "",
    autoSelectMcp: false,
    mcpServerId: "",
    mcpToolName: "",
    mcpArgumentsText: "{}",
    availableMcpTools: [],
    userInput: "",
    result: null,
    isRunning: false
  };
}

function getExtensionListTab(kind = "agent") {
  if (kind === "skill" || kind === "skill-import") {
    return "skill";
  }

  if (kind === "mcp") {
    return "mcp";
  }

  return "agent";
}

function createExtensionsState() {
  return {
    view: "list",
    listTab: "agent",
    editor: createExtensionEditorState("agent"),
    runner: createAgentRunnerState()
  };
}

function getProviderFields(provider) {
  const commonFields = [
    { key: "displayName", label: "配置名称", placeholder: "例如：OpenAI 主账号", required: true, full: false },
    { key: "model", label: "模型名称", placeholder: "例如：gpt-4.1", required: true, full: false }
  ];
  const apiKeyField = { key: "apiKey", label: "API Key", placeholder: "sk-...", required: true, full: true };
  const openAiCompatibleProviders = new Set([
    "openai_like",
    "doubao",
    "qwen",
    "deepseek",
    "moonshot",
    "zhipu",
    "grok"
  ]);

  if (provider === "openai") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: true },
      apiKeyField,
      { key: "organization", label: "Organization", placeholder: "可选", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "google") {
    return [
      ...commonFields,
      apiKeyField,
      { key: "project", label: "Project", placeholder: "例如：gordon-prod", required: false, full: false },
      { key: "location", label: "Location", placeholder: "例如：us-central1", required: false, full: false },
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "azure") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "Azure OpenAI / Azure AI 推理终端地址", required: true, full: true },
      apiKeyField,
      { key: "notes", label: "备注", placeholder: "可补充资源组、区域或部署说明", required: false, full: true, textarea: true }
    ];
  }

  if (provider === "anthropic") {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "可留空，默认官方地址", required: false, full: true },
      apiKeyField,
      { key: "notes", label: "备注", placeholder: "补充配置说明", required: false, full: true, textarea: true }
    ];
  }

  if (openAiCompatibleProviders.has(provider)) {
    return [
      ...commonFields,
      { key: "baseUrl", label: "Base URL", placeholder: "兼容 OpenAI 的服务地址", required: true, full: true },
      apiKeyField,
      { key: "notes", label: "备注", placeholder: "可补充厂商网关、环境或线路说明", required: false, full: true, textarea: true }
    ];
  }

  return [
    ...commonFields,
    { key: "baseUrl", label: "Base URL", placeholder: "自定义网关地址", required: true, full: true },
    apiKeyField,
    { key: "notes", label: "备注", placeholder: "例如：DeepSeek / Kimi / Qwen / Doubao", required: false, full: true, textarea: true }
  ];
}

function toPlainIpcData(value, fallback = value) {
  const visited = new WeakSet();

  function normalize(input) {
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

    const output = {};

    for (const [key, entryValue] of Object.entries(input)) {
      output[key] = normalize(entryValue);
    }

    return output;
  }

  try {
    return normalize(value);
  } catch {
    return fallback;
  }
}

const activeFeature = ref(FEATURE_HOME);
const homeSettingsMenuRef = ref(null);
const robotCanvasRef = ref(null);
const commandWorkshopViewRef = ref(null);
const gordonDialogPrimaryRef = ref(null);
const gordonDialogInputRef = ref(null);
const comicChapterDropdownMenuRef = ref(null);
const writingChapterDropdownMenuRef = ref(null);
const weeklyTaskRewriteIds = ref([]);

const status = reactive({
  text: "正在加载工作台...",
  tone: "neutral"
});

const workbench = reactive({
  snapshot: null,
  modelSettings: createEmptyModelSettings(),
  weeklyProgress: [],
  workflowLibrary: [],
  writingBooks: [],
  comicProjects: [],
  skillDefinitions: [],
  mcpServers: [],
  agentProfiles: [],
  agentRunLogs: [],
  commandSessions: []
});

const modelBalanceRuntime = reactive({
  loadingByProfileId: {},
  snapshotByProfileId: {},
  feedbackByProfileId: {},
  historyByProfileId: {},
  historyLoadingByProfileId: {},
  historyErrorByProfileId: {}
});

const ui = reactive({
  modelManagement: {
    view: "list",
    editor: createModelEditorState("openai"),
    usageProfileId: ""
  },
  marketplace: createMarketplaceState(),
  weekly: createWeeklyState(),
  workflow: createWorkflowState(),
  dialog: createGordonDialogState(),
  command: createCommandWorkshopState(),
  extensions: createExtensionsState()
});

const robotRuntimeState = {
  app: null,
  canvas: null,
  resizeObserver: null,
  loadToken: 0
};

const isWorkspaceImmersive = computed(
  () =>
    (activeFeature.value === FEATURE_TASKS && ui.weekly.view === "editor") ||
    (activeFeature.value === FEATURE_MARKETPLACE && ui.marketplace.view !== "apps") ||
    (activeFeature.value === FEATURE_WORKFLOW_LIBRARY && ui.workflow.view !== "library") ||
    (activeFeature.value === FEATURE_COMMAND_WORKSHOP && ui.command.view === "chat") ||
    (activeFeature.value === FEATURE_MODEL_MANAGEMENT &&
      (ui.modelManagement.view === "editor" || ui.modelManagement.view === "usage")) ||
    (activeFeature.value === FEATURE_EXTENSIONS_MANAGEMENT && ui.extensions.view === "editor")
);

const providerOptions = computed(() =>
  PROVIDER_ORDER.map((kind) => {
    const provider = workbench.snapshot?.providers?.find((entry) => entry.kind === kind);
    const meta = getProviderMeta(kind);

    return {
      kind,
      label: meta.label,
      short: meta.short,
      copy: provider?.notes ?? meta.copy,
      popularModels: meta.popularModels
    };
  })
);

const activeModel = computed(() =>
  workbench.modelSettings.profiles.find((profile) => profile.id === workbench.modelSettings.activeProfileId) ?? null
);
const activeModelUsageProfile = computed(() =>
  workbench.modelSettings.profiles.find((profile) => profile.id === ui.modelManagement.usageProfileId) ?? null
);
const modelUsageHistoryEntries = computed(() => getModelUsageHistoryEntries(activeModelUsageProfile.value));
const modelUsageDailySeries = computed(() =>
  buildModelUsageDailySeries(modelUsageHistoryEntries.value, MODEL_USAGE_DAILY_WINDOW_DAYS)
);
const modelUsageDailyListSeries = computed(() => [...modelUsageDailySeries.value].reverse());
const modelUsageSummary = computed(() => buildModelUsageSummary(modelUsageDailySeries.value, modelUsageHistoryEntries.value));
const isActiveModelUsageLoading = computed(() =>
  Boolean(activeModelUsageProfile.value && modelBalanceRuntime.historyLoadingByProfileId[activeModelUsageProfile.value.id])
);
const activeModelUsageError = computed(() =>
  activeModelUsageProfile.value ? modelBalanceRuntime.historyErrorByProfileId[activeModelUsageProfile.value.id] ?? "" : ""
);

const enabledAgentProfiles = computed(() => workbench.agentProfiles.filter((profile) => profile.enabled));
const enabledSkills = computed(() => workbench.skillDefinitions.filter((skill) => skill.enabled));
const enabledMcpServers = computed(() => workbench.mcpServers.filter((server) => server.enabled));

const modelEditorFields = computed(() => getProviderFields(ui.modelManagement.editor.provider));
const comicProjects = computed(() => ui.marketplace.comic.projects ?? []);
const activeComicProject = computed(
  () => comicProjects.value.find((project) => project.id === ui.marketplace.comic.activeProjectId) ?? comicProjects.value[0] ?? null
);
const activeComicTabMeta = computed(
  () => COMIC_APP_TABS.find((tab) => tab.id === ui.marketplace.comic.activeTab) ?? COMIC_APP_TABS[0]
);
const activeComicChapters = computed(() => getComicChapters(activeComicProject.value));
const activeComicChapter = computed(
  () =>
    activeComicChapters.value.find((chapter) => chapter.id === ui.marketplace.comic.activeChapterId) ??
    activeComicChapters.value[0] ??
    null
);
const activeComicChapterIndex = computed(() =>
  Math.max(
    0,
    activeComicChapters.value.findIndex((chapter) => chapter.id === activeComicChapter.value?.id)
  )
);
const activeComicExportFileName = computed(() => getComicExportFileName(activeComicProject.value));
const filteredComicChapterEntries = computed(() =>
  getFilteredComicChapterEntries(activeComicChapters.value, ui.marketplace.comic.chapterSearchQuery)
);
const canExportActiveComicProject = computed(
  () =>
    Boolean(
      activeComicProject.value &&
        String(ui.marketplace.comic.exportDirectory ?? "").trim() &&
        !ui.marketplace.comic.isExporting
    )
);
const writingBooks = computed(() => ui.marketplace.writing.books ?? []);
const activeWritingBook = computed(
  () => writingBooks.value.find((book) => book.id === ui.marketplace.writing.activeBookId) ?? writingBooks.value[0] ?? null
);
const activeWritingTabMeta = computed(
  () => WRITING_APP_TABS.find((tab) => tab.id === ui.marketplace.writing.activeTab) ?? WRITING_APP_TABS[0]
);
const activeWritingLengthProfile = computed(
  () => WRITING_LENGTH_PROFILES[activeWritingBook.value?.length ?? "long"] ?? WRITING_LENGTH_PROFILES.long
);
const activeWritingIntroSections = computed(() => getWritingIntroSections(activeWritingBook.value));
const activeWritingChapters = computed(() => getWritingChapters(activeWritingBook.value));
const activeWritingDoneChapters = computed(() => getDoneWritingChapters(activeWritingBook.value));
const activeWritingDoneChapterCount = computed(() => activeWritingDoneChapters.value.length);
const activeWritingChapter = computed(
  () =>
    activeWritingChapters.value.find((chapter) => chapter.id === ui.marketplace.writing.activeChapterId) ??
    getPreferredWritingChapter(activeWritingBook.value) ??
    null
);
const activeWritingChapterIndex = computed(() =>
  Math.max(
    0,
    activeWritingChapters.value.findIndex((chapter) => chapter.id === activeWritingChapter.value?.id)
  )
);
const filteredWritingChapterEntries = computed(() =>
  getFilteredWritingChapterEntries(activeWritingChapters.value, ui.marketplace.writing.chapterSearchQuery)
);
const activeWritingTaskOptions = computed(() => WRITING_AI_TASKS[ui.marketplace.writing.activeTab] ?? WRITING_AI_TASKS.intro);
const activeWritingTask = computed(
  () =>
    activeWritingTaskOptions.value.find((task) => task.id === ui.marketplace.writing.aiTaskId) ??
    activeWritingTaskOptions.value[0] ??
    null
);
const activeWritingOutlinePlannerJob = computed(() => activeWritingBook.value?.outlinePlannerJob ?? null);
const isActiveWritingBookAiRunning = computed(
  () => ui.marketplace.writing.isAiRunning && ui.marketplace.writing.aiRunningBookId === activeWritingBook.value?.id
);
const activeWritingLongOutlineRequest = computed(() =>
  getWritingLongOutlineRequest({
    book: activeWritingBook.value,
    tabId: ui.marketplace.writing.activeTab,
    task: activeWritingTask.value,
    instruction: ui.marketplace.writing.aiInstruction
  })
);
const activeWritingContent = computed({
  get: () => getWritingBookContent(activeWritingBook.value, ui.marketplace.writing.activeTab),
  set: (value) => {
    setWritingBookContent(activeWritingBook.value, ui.marketplace.writing.activeTab, value);
  }
});
const activeWritingPromptPreview = computed(() =>
  buildWritingAssistantPrompt({
    book: activeWritingBook.value,
    tabId: ui.marketplace.writing.activeTab,
    task: activeWritingTask.value,
    instruction: ui.marketplace.writing.aiInstruction
  })
);
const activeWritingExportFileName = computed(() =>
  getWritingExportFileName(activeWritingBook.value, ui.marketplace.writing.exportFormat)
);
const canExportActiveWritingBook = computed(
  () =>
    Boolean(
      activeWritingBook.value &&
        activeWritingDoneChapterCount.value > 0 &&
        String(ui.marketplace.writing.exportDirectory ?? "").trim() &&
        !ui.marketplace.writing.isExporting
    )
);

function hasModelBalanceQuery(profile) {
  return Boolean(String(profile?.balanceQueryCode ?? "").trim());
}

function formatBalanceNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "--";
}

function formatOptionalBalanceNumber(value) {
  return value == null ? "--" : formatBalanceNumber(value);
}

function getModelUsageLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getModelUsageDayStart(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (date.getHours() < MODEL_USAGE_DAY_START_HOUR) {
    date.setDate(date.getDate() - 1);
  }

  date.setHours(MODEL_USAGE_DAY_START_HOUR, 0, 0, 0);
  return date;
}

function formatModelUsageDayLabel(date) {
  return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
}

function getModelUsageHistoryEntries(profile) {
  if (!profile?.id) {
    return [];
  }

  const history = [...(modelBalanceRuntime.historyByProfileId[profile.id] ?? [])];
  const snapshot = getModelBalanceSnapshot(profile);

  if (snapshot?.queriedAt && !history.some((entry) => entry.snapshot?.queriedAt === snapshot.queriedAt)) {
    history.push({
      id: `runtime_${profile.id}_${snapshot.queriedAt}`,
      profileId: profile.id,
      profileName: profile.displayName,
      provider: profile.provider,
      model: profile.model,
      snapshot,
      source: "manual",
      recordedAt: snapshot.queriedAt,
      updatedAt: snapshot.queriedAt
    });
  }

  return history
    .filter((entry) => entry?.snapshot?.queriedAt)
    .sort((left, right) => Date.parse(left.snapshot.queriedAt) - Date.parse(right.snapshot.queriedAt));
}

function buildModelUsageDayWindows(dayCount) {
  const currentDayStart = getModelUsageDayStart(new Date());

  return Array.from({ length: dayCount }, (_item, index) => {
    const start = new Date(currentDayStart);
    start.setDate(currentDayStart.getDate() - (dayCount - index - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    return {
      dateKey: getModelUsageLocalDateKey(start),
      start,
      end,
      label: formatModelUsageDayLabel(start),
      shortLabel: String(start.getDate()).padStart(2, "0")
    };
  });
}

function toUsageSnapshotPoint(entry) {
  const queriedAt = new Date(entry?.snapshot?.queriedAt ?? entry?.recordedAt ?? "");
  const used = Number(entry?.snapshot?.used);
  const remaining = Number(entry?.snapshot?.remaining);
  const total = Number(entry?.snapshot?.total);

  if (Number.isNaN(queriedAt.getTime()) || !Number.isFinite(used)) {
    return null;
  }

  return {
    queriedAt,
    used,
    remaining: Number.isFinite(remaining) ? remaining : null,
    total: Number.isFinite(total) ? total : null,
    unit: String(entry?.snapshot?.unit ?? "USD").trim() || "USD"
  };
}

function buildModelUsageDailySeries(entries, dayCount = MODEL_USAGE_DAILY_WINDOW_DAYS) {
  const points = (Array.isArray(entries) ? entries : [])
    .map(toUsageSnapshotPoint)
    .filter(Boolean)
    .sort((left, right) => left.queriedAt.getTime() - right.queriedAt.getTime());

  return buildModelUsageDayWindows(dayCount).map((day) => {
    const pointsBeforeDay = points.filter((point) => point.queriedAt < day.start);
    const pointsInDay = points.filter((point) => point.queriedAt >= day.start && point.queriedAt < day.end);
    const baseline = pointsBeforeDay[pointsBeforeDay.length - 1] ?? null;
    let previousUsed = baseline?.used ?? pointsInDay[0]?.used ?? null;
    let used = 0;

    pointsInDay.forEach((point) => {
      if (previousUsed == null) {
        previousUsed = point.used;
        return;
      }

      const delta = point.used - previousUsed;

      if (delta >= 0) {
        used += delta;
      } else {
        used += Math.max(0, point.used);
      }

      previousUsed = point.used;
    });

    const latestPoint = pointsInDay[pointsInDay.length - 1] ?? baseline;

    return {
      ...day,
      used,
      remaining: latestPoint?.remaining ?? null,
      total: latestPoint?.total ?? null,
      unit: latestPoint?.unit ?? "USD",
      sampleCount: pointsInDay.length
    };
  });
}

function buildModelUsageSummary(days, entries) {
  const normalizedDays = Array.isArray(days) ? days : [];
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const totalUsed = normalizedDays.reduce((sum, day) => sum + Math.max(0, Number(day.used) || 0), 0);
  const maxUsed = normalizedDays.reduce((max, day) => Math.max(max, Number(day.used) || 0), 0);
  const latestEntry = normalizedEntries[normalizedEntries.length - 1] ?? null;
  const latestSnapshot = latestEntry?.snapshot ?? null;
  const unit = latestSnapshot?.unit ?? normalizedDays.find((day) => day.unit)?.unit ?? "USD";

  return {
    totalUsed,
    averageUsed: normalizedDays.length ? totalUsed / normalizedDays.length : 0,
    maxUsed,
    unit,
    sampleCount: normalizedEntries.length,
    latestUsageText: latestSnapshot
      ? `${formatBalanceNumber(latestSnapshot.used)} / ${formatBalanceNumber(latestSnapshot.remaining)}`
      : "-- / --"
  };
}

function getModelUsageBarHeight(day) {
  const maxUsed = modelUsageSummary.value.maxUsed;

  if (!maxUsed || !day?.used) {
    return "0%";
  }

  return `${Math.max(7, Math.round((day.used / maxUsed) * 100))}%`;
}

function getModelBalanceSnapshot(profile) {
  return modelBalanceRuntime.snapshotByProfileId[profile?.id] ?? profile?.balanceSnapshot ?? null;
}

function getModelBalanceFeedback(profile) {
  return modelBalanceRuntime.feedbackByProfileId[profile?.id] ?? null;
}

function isModelBalanceRefreshing(profileId) {
  return Boolean(modelBalanceRuntime.loadingByProfileId[profileId]);
}

function setModelBalanceRefreshing(profileId, shouldRefresh) {
  modelBalanceRuntime.loadingByProfileId[profileId] = shouldRefresh;
}

function syncModelBalanceRuntimeFromProfiles(profiles = []) {
  const profileIds = new Set((Array.isArray(profiles) ? profiles : []).map((profile) => profile.id));

  Object.keys(modelBalanceRuntime.snapshotByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.snapshotByProfileId[profileId];
    }
  });

  Object.keys(modelBalanceRuntime.loadingByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.loadingByProfileId[profileId];
    }
  });

  Object.keys(modelBalanceRuntime.feedbackByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.feedbackByProfileId[profileId];
    }
  });

  Object.keys(modelBalanceRuntime.historyByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.historyByProfileId[profileId];
    }
  });

  Object.keys(modelBalanceRuntime.historyLoadingByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.historyLoadingByProfileId[profileId];
    }
  });

  Object.keys(modelBalanceRuntime.historyErrorByProfileId).forEach((profileId) => {
    if (!profileIds.has(profileId)) {
      delete modelBalanceRuntime.historyErrorByProfileId[profileId];
    }
  });

  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    modelBalanceRuntime.snapshotByProfileId[profile.id] = profile.balanceSnapshot ?? null;
  });
}

function setModelBalanceFeedback(profileId, text, tone = "neutral") {
  modelBalanceRuntime.feedbackByProfileId[profileId] = {
    text: String(text ?? "").trim(),
    tone
  };
}

function toPlainModelProfile(profile) {
  return {
    id: String(profile?.id ?? ""),
    provider: profile?.provider,
    displayName: String(profile?.displayName ?? ""),
    model: String(profile?.model ?? ""),
    apiKey: String(profile?.apiKey ?? ""),
    baseUrl: String(profile?.baseUrl ?? ""),
    organization: String(profile?.organization ?? ""),
    project: String(profile?.project ?? ""),
    location: String(profile?.location ?? ""),
    notes: String(profile?.notes ?? ""),
    balanceQueryCode: String(profile?.balanceQueryCode ?? ""),
    updatedAt: String(profile?.updatedAt ?? "")
  };
}

function applyModelBalanceSnapshot(profileId, balanceSnapshot) {
  modelBalanceRuntime.snapshotByProfileId[profileId] = balanceSnapshot;
  workbench.modelSettings.profiles = workbench.modelSettings.profiles.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          balanceSnapshot
        }
      : profile
  );

  if (ui.modelManagement.editor.profileId === profileId) {
    ui.modelManagement.editor.balanceQueryResult = balanceSnapshot;
    ui.modelManagement.editor.balanceQueryError = "";
    ui.modelManagement.editor.lastBalanceQueryCode = ui.modelManagement.editor.values.balanceQueryCode.trim();
  }
}

function buildModelEditorPayload() {
  const balanceQueryCode = ui.modelManagement.editor.values.balanceQueryCode.trim();
  const shouldReuseBalanceSnapshot =
    balanceQueryCode && balanceQueryCode === String(ui.modelManagement.editor.lastBalanceQueryCode ?? "").trim();

  return {
    id: ui.modelManagement.editor.profileId ?? `model_${Date.now()}`,
    provider: ui.modelManagement.editor.provider,
    displayName: ui.modelManagement.editor.values.displayName.trim(),
    model: ui.modelManagement.editor.values.model.trim(),
    apiKey: ui.modelManagement.editor.values.apiKey.trim(),
    baseUrl: ui.modelManagement.editor.values.baseUrl.trim(),
    organization: ui.modelManagement.editor.values.organization.trim(),
    project: ui.modelManagement.editor.values.project.trim(),
    location: ui.modelManagement.editor.values.location.trim(),
    notes: ui.modelManagement.editor.values.notes.trim(),
    balanceQueryCode,
    balanceSnapshot: shouldReuseBalanceSnapshot ? ui.modelManagement.editor.balanceQueryResult ?? null : null,
    updatedAt: new Date().toISOString()
  };
}

function getWritingLengthLabel(length) {
  return WRITING_LENGTH_PROFILES[length]?.label ?? WRITING_LENGTH_PROFILES.long.label;
}

function normalizeComicProjectFormatForUi(value) {
  const format = String(value ?? "").trim();
  return COMIC_PROJECT_FORMAT_META[format] ? format : "poster";
}

function normalizeComicProjectPaletteForUi(value) {
  const palette = String(value ?? "").trim();
  return COMIC_PROJECT_PALETTE_META[palette] ? palette : "color";
}

function normalizeComicProjectPageCount(value, fallback = 1) {
  const numeric = Number(value);
  return Math.min(999, Math.max(1, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
}

function normalizeComicChapterStatusForUi(value) {
  return COMIC_CHAPTER_STATUS_META[value] ? value : "todo";
}

function normalizeComicChapterForUi(chapter, index = 0) {
  const now = new Date().toISOString();

  return {
    id: String(chapter?.id ?? "").trim() || createLocalId("comic_chapter"),
    index: Math.max(1, Math.round(Number(chapter?.index ?? index + 1) || index + 1)),
    title: String(chapter?.title ?? "").trim() || `第 ${index + 1} 章`,
    summary: String(chapter?.summary ?? ""),
    prompt: String(chapter?.prompt ?? ""),
    content: String(chapter?.content ?? ""),
    status: normalizeComicChapterStatusForUi(chapter?.status),
    updatedAt: String(chapter?.updatedAt ?? "").trim() || now
  };
}

function normalizeComicChaptersForUi(chapters = []) {
  const normalizedChapters = (Array.isArray(chapters) ? chapters : [])
    .map((chapter, index) => normalizeComicChapterForUi(chapter, index))
    .sort((left, right) => left.index - right.index);

  if (normalizedChapters.length) {
    return normalizedChapters;
  }

  return [
    normalizeComicChapterForUi(
      {
        index: 1,
        title: "开场分镜",
        summary: "写下这一章的场景目标、镜头顺序、角色动作和结尾画面。",
        prompt: "基于总介绍生成开场分镜，明确画面、动作、对白和页数。",
        content: "",
        status: "inProgress"
      },
      0
    )
  ];
}

function normalizeComicProjectForUi(project, index = 0) {
  const now = new Date().toISOString();
  const format = normalizeComicProjectFormatForUi(project?.format);
  const palette = normalizeComicProjectPaletteForUi(project?.palette);
  const createdAt = String(project?.createdAt ?? "").trim() || now;
  const updatedAt = String(project?.updatedAt ?? "").trim() || createdAt;

  return {
    id: String(project?.id ?? "").trim() || createLocalId("comic_project"),
    title: String(project?.title ?? "").trim() || `未命名漫画 ${index + 1}`,
    format,
    palette,
    genre: String(project?.genre ?? "").trim() || "漫画 / 待定类型",
    status: String(project?.status ?? "").trim() || "新建",
    summary: String(project?.summary ?? ""),
    visualStyle: String(project?.visualStyle ?? ""),
    episodePlan: String(project?.episodePlan ?? ""),
    pageCount: normalizeComicProjectPageCount(project?.pageCount, COMIC_PROJECT_FORMAT_META[format]?.defaultPages ?? 1),
    chapters: normalizeComicChaptersForUi(project?.chapters),
    coverTone:
      String(project?.coverTone ?? "").trim() ||
      COMIC_PROJECT_COVER_TONES[index % COMIC_PROJECT_COVER_TONES.length] ||
      "ink",
    createdAt,
    updatedAt
  };
}

function normalizeComicProjectsForUi(projects = []) {
  return (Array.isArray(projects) ? projects : []).map((project, index) => normalizeComicProjectForUi(project, index));
}

function applyComicProjectsFromStorage(projects = [], options = {}) {
  const normalizedProjects = normalizeComicProjectsForUi(projects);
  const preferredProjectId = options.preferProjectId ?? ui.marketplace.comic.activeProjectId;
  const nextProject =
    normalizedProjects.find((project) => project.id === preferredProjectId) ?? normalizedProjects[0] ?? null;

  workbench.comicProjects = normalizedProjects;
  ui.marketplace.comic.projects = normalizedProjects;
  ui.marketplace.comic.activeProjectId = nextProject?.id ?? null;

  if (!nextProject && ui.marketplace.view === "comicDetail") {
    ui.marketplace.view = "comicShelf";
  }

  if (nextProject && !nextProject.chapters.some((chapter) => chapter.id === ui.marketplace.comic.activeChapterId)) {
    ui.marketplace.comic.activeChapterId = nextProject.chapters[0]?.id ?? "";
  }
}

function buildComicProjectSavePayload(project) {
  return {
    id: project.id,
    title: project.title,
    format: normalizeComicProjectFormatForUi(project.format),
    palette: normalizeComicProjectPaletteForUi(project.palette),
    genre: project.genre,
    status: project.status,
    summary: project.summary,
    visualStyle: project.visualStyle,
    episodePlan: project.episodePlan,
    pageCount: normalizeComicProjectPageCount(project.pageCount),
    chapters: getComicChapters(project).map((chapter, index) => ({
      ...normalizeComicChapterForUi(chapter, index),
      updatedAt: chapter.updatedAt
    })),
    coverTone: project.coverTone,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function scheduleComicProjectAutosave(projectId) {
  if (!desktopApi?.upsertComicProject || !projectId) {
    return;
  }

  clearComicAutosaveTimer();

  comicAutosaveTimer = setTimeout(() => {
    comicAutosaveTimer = null;
    persistComicProjectById(projectId, { silent: true });
  }, WRITING_AUTOSAVE_DELAY);
}

function clearComicAutosaveTimer() {
  if (comicAutosaveTimer) {
    clearTimeout(comicAutosaveTimer);
    comicAutosaveTimer = null;
  }
}

function touchComicProject(project, options = {}) {
  if (!project) {
    return;
  }

  project.updatedAt = new Date().toISOString();

  if (options.persist !== false) {
    scheduleComicProjectAutosave(project.id);
  }
}

async function persistComicProjectById(projectId, options = {}) {
  if (!desktopApi?.upsertComicProject || !projectId) {
    return;
  }

  if (comicSaveInFlight) {
    comicQueuedSaveProjectId = projectId;
    return;
  }

  const project = comicProjects.value.find((entry) => entry.id === projectId);

  if (!project) {
    return;
  }

  comicSaveInFlight = true;

  try {
    const savedProjects = await desktopApi.upsertComicProject(buildComicProjectSavePayload(project));
    applyComicProjectsFromStorage(savedProjects, { preferProjectId: projectId });

    if (!options.silent) {
      setStatus("漫画项目已写入本地。", "success");
    }
  } catch (error) {
    console.error("Failed to save comic project", error);

    if (!options.silent) {
      setStatus(`漫画项目保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    }
  } finally {
    comicSaveInFlight = false;

    const queuedProjectId = comicQueuedSaveProjectId;
    comicQueuedSaveProjectId = null;

    if (queuedProjectId) {
      persistComicProjectById(queuedProjectId, { silent: true });
    }
  }
}

function getComicProjectFormatLabel(format) {
  return COMIC_PROJECT_FORMAT_META[normalizeComicProjectFormatForUi(format)]?.label ?? "单图海报";
}

function getComicProjectPaletteLabel(palette) {
  return COMIC_PROJECT_PALETTE_META[normalizeComicProjectPaletteForUi(palette)]?.label ?? "彩绘";
}

function getComicChapters(project) {
  return Array.isArray(project?.chapters) ? project.chapters : [];
}

function getComicChapterDisplayTitle(chapter, index = 0) {
  const order = Number(chapter?.index ?? index + 1);
  const title = String(chapter?.title ?? "").trim();
  return `第 ${Number.isFinite(order) && order > 0 ? order : index + 1} 章 ${title || "未命名分镜"}`;
}

function getComicChapterStatusLabel(status) {
  return COMIC_CHAPTER_STATUS_META[status]?.label ?? COMIC_CHAPTER_STATUS_META.todo.label;
}

function getComicChapterStatusClass(status) {
  return COMIC_CHAPTER_STATUS_META[status]?.className ?? COMIC_CHAPTER_STATUS_META.todo.className;
}

function getFilteredComicChapterEntries(chapters, query) {
  const keyword = String(query ?? "").trim().toLowerCase();

  return (Array.isArray(chapters) ? chapters : [])
    .map((chapter, index) => ({
      chapter,
      index,
      title: getComicChapterDisplayTitle(chapter, index)
    }))
    .filter((entry) => {
      if (!keyword) {
        return true;
      }

      return [entry.title, entry.chapter?.summary, getComicChapterStatusLabel(entry.chapter?.status)]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(keyword));
    });
}

function trimComicExportTextBlock(value) {
  return String(value ?? "").replace(/^(?:[ \t]*\r?\n)+/, "").replace(/[ \t\r\n]+$/, "");
}

function sanitizeComicExportTitle(value) {
  return String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim() || "未命名漫画项目";
}

function getComicExportFileName(project) {
  return `${sanitizeComicExportTitle(project?.title)}.md`;
}

function buildComicProjectExportContent(project) {
  const chapters = getComicChapters(project).slice().sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0));
  const lines = [`# ${sanitizeComicExportTitle(project?.title)}`, ""];
  const summary = trimComicExportTextBlock(project?.summary ?? "");
  const visualStyle = trimComicExportTextBlock(project?.visualStyle ?? "");
  const episodePlan = trimComicExportTextBlock(project?.episodePlan ?? "");

  lines.push("## 项目信息", "");
  lines.push(`- 形态：${getComicProjectFormatLabel(project?.format)}`);
  lines.push(`- 画面：${getComicProjectPaletteLabel(project?.palette)}`);
  lines.push(`- 类型：${project?.genre || "漫画 / 待定类型"}`);
  lines.push(`- 页数：${normalizeComicProjectPageCount(project?.pageCount)} 页`);
  lines.push(`- 状态：${project?.status || "新建"}`, "");

  if (summary) {
    lines.push("## 总介绍", "", summary, "");
  }

  if (visualStyle) {
    lines.push("## 画风与镜头", "", visualStyle, "");
  }

  if (episodePlan) {
    lines.push(project?.format === "serial" ? "## 连载总规划" : "## 海报构图规划", "", episodePlan, "");
  }

  lines.push("## 目录", "");

  if (chapters.length) {
    chapters.forEach((chapter, index) => {
      const title = getComicChapterDisplayTitle(chapter, index);
      const chapterSummary = trimComicExportTextBlock(chapter.summary ?? "") || "暂无分镜简介";
      lines.push(`- ${title}（${getComicChapterStatusLabel(chapter.status)}）：${chapterSummary}`);
    });
  } else {
    lines.push("- 暂无章节");
  }

  lines.push("", "## 单章生成", "");

  chapters.forEach((chapter, index) => {
    const title = getComicChapterDisplayTitle(chapter, index);
    const chapterSummary = trimComicExportTextBlock(chapter.summary ?? "");
    const prompt = trimComicExportTextBlock(chapter.prompt ?? "");
    const content = trimComicExportTextBlock(chapter.content ?? "");

    lines.push(`### ${title}`, "");

    if (chapterSummary) {
      lines.push("#### 分镜简介", "", chapterSummary, "");
    }

    if (prompt) {
      lines.push("#### 生成提示词", "", prompt, "");
    }

    lines.push("#### 生成稿", "", content || "暂无生成稿", "");
  });

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function normalizeWritingBookLengthForUi(value) {
  return WRITING_LENGTH_PROFILES[value] ? value : "long";
}

function normalizeWritingChapterStatusForUi(value) {
  return WRITING_CHAPTER_STATUS_META[value] ? value : "todo";
}

function parseWritingChapterIndex(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));

  if (/^\d+$/.test(normalizedValue)) {
    const parsedValue = Number(normalizedValue);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  const digits = {
    零: 0,
    "〇": 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };
  const units = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
  let total = 0;
  let section = 0;
  let number = 0;

  for (const char of normalizedValue) {
    if (digits[char] !== undefined) {
      number = digits[char];
      continue;
    }

    const unit = units[char];

    if (!unit) {
      return null;
    }

    if (unit === 10000) {
      section = (section + (number || 1)) * unit;
      total += section;
      section = 0;
    } else {
      section += (number || 1) * unit;
    }

    number = 0;
  }

  const parsedValue = total + section + number;
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeWritingChapterIndex(value, fallbackIndex = 0) {
  const normalizedFallback = Number.isFinite(fallbackIndex) && fallbackIndex >= 0 ? fallbackIndex + 1 : 1;
  return parseWritingChapterIndex(value) ?? normalizedFallback;
}

function splitWritingChapterTitlePrefix(value) {
  const title = String(value ?? "")
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
  const match = title.match(WRITING_CHAPTER_PREFIX_PATTERN);

  if (!match) {
    return { index: null, title };
  }

  return {
    index: parseWritingChapterIndex(match[1]),
    title: String(match[2] ?? "").trim()
  };
}

function normalizeWritingBookPartTypeForUi(value) {
  return value === "volume" ? "volume" : "act";
}

function splitWritingBookPartTitlePrefix(value) {
  const title = String(value ?? "")
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
  const match = title.match(WRITING_PART_PREFIX_PATTERN);

  if (!match) {
    return { index: null, type: null, title };
  }

  return {
    index: parseWritingChapterIndex(match[1]),
    type: match[2] === "卷" ? "volume" : "act",
    title: String(match[3] ?? "").trim()
  };
}

function normalizeWritingBookPart(part, index = 0, bookId = "writing_book") {
  const titleParts = splitWritingBookPartTitlePrefix(part?.title);
  const partIndex = normalizeWritingChapterIndex(part?.index ?? titleParts.index, index);
  const partType = normalizeWritingBookPartTypeForUi(part?.type ?? titleParts.type);

  return {
    id: String(part?.id ?? "").trim() || `${bookId}_part_${partIndex}`,
    type: partType,
    index: partIndex,
    title: titleParts.title || `未命名${partType === "volume" ? "卷" : "幕"} ${partIndex}`,
    description: String(part?.description ?? part?.summary ?? "")
  };
}

function normalizeWritingBookPartsForUi(parts = [], bookId = "writing_book") {
  return (Array.isArray(parts) ? parts : [])
    .map((part, index) => normalizeWritingBookPart(part, index, bookId))
    .sort((left, right) => left.index - right.index);
}

function normalizePositiveInteger(value, fallbackValue = 1) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function normalizeWritingOutlinePlannerJobForUi(job) {
  if (!job || typeof job !== "object") {
    return undefined;
  }

  const minChaptersPerPart = normalizePositiveInteger(job.minChaptersPerPart, 80);
  const maxChaptersPerPart = Math.max(minChaptersPerPart, normalizePositiveInteger(job.maxChaptersPerPart, 100));
  const chaptersPerPart = Math.min(maxChaptersPerPart, Math.max(minChaptersPerPart, normalizePositiveInteger(job.chaptersPerPart, Math.round((minChaptersPerPart + maxChaptersPerPart) / 2))));
  const targetPartCount = normalizePositiveInteger(job.targetPartCount, 1);
  const batchSize = Math.min(40, Math.max(5, normalizePositiveInteger(job.batchSize, WRITING_LONG_OUTLINE_BATCH_SIZE)));

  return {
    id: String(job.id ?? "").trim() || createLocalId("writing_outline_job"),
    status: ["idle", "running", "completed", "failed", "cancelled"].includes(job.status) ? job.status : "idle",
    instruction: String(job.instruction ?? ""),
    targetPartCount,
    partType: normalizeWritingBookPartTypeForUi(job.partType),
    minChaptersPerPart,
    maxChaptersPerPart,
    chaptersPerPart,
    batchSize,
    targetChapterCount: targetPartCount * chaptersPerPart,
    generatedChapterCount: Math.max(0, Number(job.generatedChapterCount ?? 0) || 0),
    currentPartIndex: Math.max(0, Number(job.currentPartIndex ?? 0) || 0),
    currentBatchStartIndex: Math.max(0, Number(job.currentBatchStartIndex ?? 0) || 0),
    currentBatchEndIndex: Math.max(0, Number(job.currentBatchEndIndex ?? 0) || 0),
    lastCompletedChapterIndex: Math.max(0, Number(job.lastCompletedChapterIndex ?? 0) || 0),
    retryAttempt: Math.max(0, Number(job.retryAttempt ?? 0) || 0),
    maxRetryAttempts: Math.max(0, Number(job.maxRetryAttempts ?? 0) || 0),
    ...(job.lastRetryAt ? { lastRetryAt: String(job.lastRetryAt) } : {}),
    ...(job.lastError ? { lastError: String(job.lastError) } : {}),
    createdAt: String(job.createdAt ?? new Date().toISOString()),
    updatedAt: String(job.updatedAt ?? new Date().toISOString()),
    ...(job.error ? { error: String(job.error) } : {})
  };
}

function normalizeWritingBookForUi(book, index = 0) {
  const now = new Date().toISOString();
  const bookId = String(book?.id ?? "").trim() || createLocalId("writing_book");
  const normalized = {
    id: bookId,
    title: String(book?.title ?? "").trim() || "未命名故事",
    author: String(book?.author ?? "Song"),
    length: normalizeWritingBookLengthForUi(book?.length),
    genre: String(book?.genre ?? "小说 / 待定类型"),
    status: String(book?.status ?? "新建"),
    updatedAt: String(book?.updatedAt ?? now),
    coverTone: String(book?.coverTone ?? (index % 3 === 0 ? "teal" : index % 3 === 1 ? "coral" : "gold")),
    intro: String(book?.intro ?? ""),
    outlineGuide: String(book?.outlineGuide ?? ""),
    seriesPlan: String(book?.seriesPlan ?? ""),
    directoryName: typeof book?.directoryName === "string" ? book.directoryName : undefined,
    parts: normalizeWritingBookPartsForUi(book?.parts, bookId),
    outlinePlannerJob: normalizeWritingOutlinePlannerJobForUi(book?.outlinePlannerJob),
    chapters: []
  };

  normalized.chapters = (Array.isArray(book?.chapters) ? book.chapters : []).map((chapter, chapterIndex) =>
    normalizeWritingChapter(
      {
        ...chapter,
        status: normalizeWritingChapterStatusForUi(chapter?.status)
      },
      chapterIndex,
      normalized
    )
  );

  return normalized;
}

function normalizeWritingBooksForUi(books = []) {
  return (Array.isArray(books) ? books : []).map((book, index) => normalizeWritingBookForUi(book, index));
}

function syncWritingBookSaveVersions(books = []) {
  const bookIds = new Set(books.map((book) => book.id));

  Array.from(writingBookSaveVersions.keys()).forEach((bookId) => {
    if (!bookIds.has(bookId)) {
      writingBookSaveVersions.delete(bookId);
    }
  });

  books.forEach((book) => {
    if (!writingBookSaveVersions.has(book.id)) {
      writingBookSaveVersions.set(book.id, 0);
    }
  });
}

function applyWritingBooksFromStorage(books = [], options = {}) {
  const normalizedBooks = normalizeWritingBooksForUi(books);
  const preferredBookId = options.preferBookId ?? ui.marketplace.writing.activeBookId;
  const preferredChapterId = options.preferChapterId ?? ui.marketplace.writing.activeChapterId;
  const nextBook = normalizedBooks.find((book) => book.id === preferredBookId) ?? normalizedBooks[0] ?? null;

  workbench.writingBooks = normalizedBooks;
  ui.marketplace.writing.books = normalizedBooks;
  syncWritingBookSaveVersions(normalizedBooks);
  ui.marketplace.writing.activeBookId = nextBook?.id ?? null;

  if (!nextBook) {
    ui.marketplace.writing.activeChapterId = "";
    if (ui.marketplace.view === "writingDetail") {
      ui.marketplace.view = "writingShelf";
    }
    return;
  }

  const chapters = getWritingChapters(nextBook);
  const nextChapter =
    chapters.find((chapter) => chapter.id === preferredChapterId) ?? getPreferredWritingChapter(nextBook) ?? chapters[0] ?? null;
  ui.marketplace.writing.activeChapterId = nextChapter?.id ?? "";
}

function clearWritingAutosaveTimer() {
  if (writingAutosaveTimer) {
    clearTimeout(writingAutosaveTimer);
    writingAutosaveTimer = null;
  }
}

function scheduleWritingBookAutosave(bookId) {
  if (!desktopApi?.saveWritingBook || !bookId) {
    return;
  }

  clearWritingAutosaveTimer();
  writingAutosaveTimer = setTimeout(() => {
    writingAutosaveTimer = null;
    persistWritingBookById(bookId, { silent: true });
  }, WRITING_AUTOSAVE_DELAY);
}

function touchWritingBook(book, options = {}) {
  if (!book) {
    return;
  }

  book.updatedAt = new Date().toISOString();

  if (book.id) {
    writingBookSaveVersions.set(book.id, (writingBookSaveVersions.get(book.id) ?? 0) + 1);
  }

  if (options.persist !== false) {
    scheduleWritingBookAutosave(book.id);
  }
}

function buildWritingBookSavePayload(book) {
  if (!book) {
    return null;
  }

  return toPlainIpcData(
    {
      ...book,
      chapters: getWritingChapters(book).map((chapter) => ({
        ...chapter,
        status: normalizeWritingChapterStatusForUi(chapter.status),
        content: String(chapter.content ?? "")
      }))
    },
    null
  );
}

async function persistWritingBookById(bookId, options = {}) {
  const targetBookId = String(bookId ?? "").trim();

  if (!desktopApi?.saveWritingBook || !targetBookId) {
    return;
  }

  if (writingSaveInFlight) {
    writingQueuedSave = {
      bookId: targetBookId,
      options: {
        ...(writingQueuedSave?.options ?? {}),
        ...options,
        mergeChapters: Boolean(writingQueuedSave?.options?.mergeChapters || options.mergeChapters),
        keepLocal: Boolean(writingQueuedSave?.options?.keepLocal || options.keepLocal),
        silent: Boolean((writingQueuedSave?.options?.silent ?? true) && (options.silent ?? true))
      }
    };
    return;
  }

  const book = writingBooks.value.find((entry) => entry.id === targetBookId);

  if (!book) {
    return;
  }

  const saveVersion = writingBookSaveVersions.get(targetBookId) ?? 0;
  const payload = buildWritingBookSavePayload(book);

  if (!payload) {
    return;
  }

  clearWritingAutosaveTimer();
  writingSaveInFlight = true;

  try {
    const savedBooks = await desktopApi.saveWritingBook(payload, options.mergeChapters ? { mergeChapters: true } : {});

    if (options.keepLocal && (writingBookSaveVersions.get(targetBookId) ?? 0) === saveVersion) {
      const savedBook = normalizeWritingBooksForUi(savedBooks).find((entry) => entry.id === targetBookId);

      if (savedBook) {
        Object.assign(book, savedBook);
        writingBookSaveVersions.set(targetBookId, 0);
      }
    } else if ((writingBookSaveVersions.get(targetBookId) ?? 0) === saveVersion) {
      applyWritingBooksFromStorage(savedBooks, {
        preferBookId: targetBookId,
        preferChapterId: ui.marketplace.writing.activeChapterId
      });
    }

    if (!options.silent) {
      setStatus("小说已保存到本地书稿目录。", "success");
    }
  } catch (error) {
    console.error("Failed to save writing book", error);
    setStatus(`小说保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    writingSaveInFlight = false;

    const queuedSave = writingQueuedSave;
    writingQueuedSave = null;

    if (queuedSave) {
      persistWritingBookById(queuedSave.bookId, queuedSave.options);
    }
  }
}

function setWritingBookTitle(value) {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  book.title = String(value ?? "");
  touchWritingBook(book);
}

function setWritingBookLength(value) {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  book.length = normalizeWritingBookLengthForUi(value);
  touchWritingBook(book);
}

function setWritingBookGenre(value) {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  book.genre = String(value ?? "");
  touchWritingBook(book);
}

function getWritingIntroSections(book) {
  if (book?.length === "long") {
    return [
      WRITING_INTRO_SECTION_DEFINITIONS.intro,
      WRITING_INTRO_SECTION_DEFINITIONS.outlineGuide,
      WRITING_INTRO_SECTION_DEFINITIONS.seriesPlan
    ];
  }

  if (book?.length === "medium") {
    return [WRITING_INTRO_SECTION_DEFINITIONS.intro, WRITING_INTRO_SECTION_DEFINITIONS.outlineGuide];
  }

  return [WRITING_INTRO_SECTION_DEFINITIONS.intro];
}

function getWritingIntroFieldValue(book, key) {
  return String(book?.[key] ?? "");
}

function setWritingIntroField(book, key, value) {
  if (!book || !WRITING_INTRO_SECTION_DEFINITIONS[key]) {
    return;
  }

  book[key] = String(value ?? "");
  touchWritingBook(book);
}

function buildWritingIntroContent(book) {
  if (!book) {
    return "";
  }

  return getWritingIntroSections(book)
    .map((section) => {
      const value = getWritingIntroFieldValue(book, section.key).trim();
      return value ? `【${section.label}】\n${value}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function getWritingChapters(book) {
  if (!book) {
    return [];
  }

  if (!Array.isArray(book.chapters) || book.chapters.length === 0) {
    book.chapters = createWritingChaptersFromLegacyBook(book);
  }

  return book.chapters.map((chapter, index) => normalizeWritingChapter(chapter, index, book));
}

function createWritingChaptersFromLegacyBook(book) {
  const outlineLines = String(book?.outline ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^(\d+[.、]|第.+?章)/.test(line));
  const sourceLines = outlineLines.length ? outlineLines : ["第一章：正文整理"];
  const legacyContent = String(book?.chapter ?? "");

  return sourceLines.map((line, index) => {
    const normalizedLine = line.replace(/^\d+[.、]\s*/, "").replace(/^第.+?章[:：]?\s*/, "");
    const [rawTitle, ...summaryParts] = normalizedLine.split(/[:：]/);

    return {
      id: `${book.id || "writing_book"}_chapter_${index + 1}`,
      index: index + 1,
      title: (rawTitle || `未命名章节 ${index + 1}`).trim(),
      summary: summaryParts.join("：").trim(),
      content: index === 0 ? legacyContent : "",
      status: index === 0 && legacyContent.trim() ? "inProgress" : "todo",
      updatedAt: book.updatedAt ?? new Date().toISOString()
    };
  });
}

function normalizeWritingChapter(chapter, index, book) {
  const normalized = chapter ?? {};
  const titleParts = splitWritingChapterTitlePrefix(normalized.title);

  if (!normalized.id) {
    normalized.id = `${book?.id || "writing_book"}_chapter_${index + 1}`;
  }

  normalized.index = normalizeWritingChapterIndex(normalized.index ?? titleParts.index, index);
  if (normalized.partIndex) {
    normalized.partIndex = normalizeWritingChapterIndex(normalized.partIndex, 0);
  } else {
    delete normalized.partIndex;
  }
  normalized.title = titleParts.title || `未命名章节 ${normalized.index}`;

  normalized.summary = String(normalized.summary ?? "");
  normalized.content = String(normalized.content ?? "");
  normalized.status = WRITING_CHAPTER_STATUS_META[normalized.status] ? normalized.status : "todo";
  normalized.updatedAt = normalized.updatedAt ?? book?.updatedAt ?? new Date().toISOString();

  return normalized;
}

function getPreferredWritingChapter(book) {
  const chapters = getWritingChapters(book);

  if (!chapters.length) {
    return null;
  }

  const inProgressChapters = chapters
    .filter((chapter) => chapter.status === "inProgress")
    .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime());

  return inProgressChapters[0] ?? chapters.find((chapter) => chapter.status === "todo") ?? chapters[chapters.length - 1];
}

function ensureWritingChapterSelection(book = activeWritingBook.value) {
  const chapters = getWritingChapters(book);
  const current = chapters.find((chapter) => chapter.id === ui.marketplace.writing.activeChapterId);

  if (current) {
    return current;
  }

  const preferred = getPreferredWritingChapter(book);
  ui.marketplace.writing.activeChapterId = preferred?.id ?? "";
  return preferred;
}

function selectPreferredWritingChapter(book = activeWritingBook.value) {
  const preferred = getPreferredWritingChapter(book);
  selectWritingChapter(preferred?.id ?? "");
  return preferred;
}

function selectWritingChapter(chapterId) {
  ui.marketplace.writing.activeChapterId = chapterId;
  clearWritingChapterSubmitConfirmation(chapterId);
}

function setWritingChapterPickerOpen(isOpen) {
  ui.marketplace.writing.isChapterPickerOpen = Boolean(isOpen);

  if (ui.marketplace.writing.isChapterPickerOpen) {
    scrollWritingChapterPickerToActive();
  }
}

function toggleWritingChapterPicker() {
  setWritingChapterPickerOpen(!ui.marketplace.writing.isChapterPickerOpen);
}

function selectWritingChapterFromPicker(chapterId) {
  selectWritingChapter(chapterId);
  ui.marketplace.writing.chapterSearchQuery = "";
  setWritingChapterPickerOpen(false);
}

async function scrollWritingChapterPickerToActive() {
  await nextTick();

  const menu = writingChapterDropdownMenuRef.value;
  const activeItem = menu?.querySelector?.(".writing-chapter-dropdown-item.is-active");

  if (!menu || !activeItem) {
    return;
  }

  const targetTop = activeItem.offsetTop - (menu.clientHeight - activeItem.clientHeight) / 2;
  menu.scrollTop = Math.max(0, targetTop);
}

function getWritingChapterDisplayTitle(chapter, index = 0) {
  const order = normalizeWritingChapterIndex(chapter?.index, index);
  const title = splitWritingChapterTitlePrefix(chapter?.title).title || `未命名章节 ${order}`;
  return `第${order}章 ${title}`;
}

function getWritingBookParts(book) {
  if (!book) {
    return [];
  }

  return (Array.isArray(book.parts) ? book.parts : [])
    .slice()
    .sort((left, right) => normalizeWritingChapterIndex(left?.index, 0) - normalizeWritingChapterIndex(right?.index, 0));
}

function getWritingPartDisplayLabel(part) {
  if (!part) {
    return "";
  }

  const label = part.type === "volume" ? "卷" : "幕";
  const title = splitWritingBookPartTitlePrefix(part.title).title || `未命名${label} ${part.index}`;
  return `第${part.index}${label} ${title}`;
}

function getWritingChapterPart(book, chapter) {
  const partIndex = parseWritingChapterIndex(chapter?.partIndex);

  if (!partIndex) {
    return null;
  }

  return getWritingBookParts(book).find((part) => part.index === partIndex) ?? null;
}

function getWritingChapterPartLabel(book, chapter) {
  return getWritingPartDisplayLabel(getWritingChapterPart(book, chapter));
}

function getFilteredWritingChapterEntries(chapters, query) {
  const keyword = String(query ?? "").trim().toLowerCase();

  return (Array.isArray(chapters) ? chapters : [])
    .map((chapter, index) => ({
      chapter,
      index,
      title: getWritingChapterDisplayTitle(chapter, index)
    }))
    .filter((entry) => {
      if (!keyword) {
        return true;
      }

      return [entry.title, entry.chapter?.summary, getWritingChapterStatusLabel(entry.chapter?.status)]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(keyword));
    });
}

function getWritingChapterStatusLabel(status) {
  return WRITING_CHAPTER_STATUS_META[status]?.label ?? WRITING_CHAPTER_STATUS_META.todo.label;
}

function getWritingChapterStatusClass(status) {
  return WRITING_CHAPTER_STATUS_META[status]?.className ?? WRITING_CHAPTER_STATUS_META.todo.className;
}

function getWritingChapterWordCount(chapter) {
  return String(chapter?.content ?? "").replace(/\s+/g, "").length;
}

function isWritingChapterSubmitConfirmed(chapter) {
  return Boolean(
    chapter?.id &&
      ui.marketplace.writing.submittedChapterId === chapter.id &&
      String(chapter.content ?? "") === ui.marketplace.writing.submittedChapterContentSnapshot
  );
}

function clearWritingChapterSubmitConfirmation(chapterId = "") {
  if (!chapterId || ui.marketplace.writing.submittedChapterId === chapterId) {
    ui.marketplace.writing.submittedChapterId = "";
    ui.marketplace.writing.submittedChapterContentSnapshot = "";
  }
}

function normalizeWritingExportFormat(format) {
  const normalized = String(format ?? "").trim().toLowerCase();
  return WRITING_BOOK_EXPORT_FORMATS.some((entry) => entry.id === normalized) ? normalized : "txt";
}

function sanitizeWritingExportTitle(value) {
  return String(value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim() || "未命名书稿";
}

function getWritingExportFileName(book, format) {
  return `${sanitizeWritingExportTitle(book?.title)}.${normalizeWritingExportFormat(format)}`;
}

function getDoneWritingChapters(book) {
  return getWritingChapters(book)
    .filter((chapter) => chapter.status === "done" && String(chapter.content ?? "").trim())
    .sort((left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0));
}

function getWritingExportPartHeading(book, chapter) {
  const part = getWritingChapterPart(book, chapter);

  if (part) {
    return getWritingPartDisplayLabel(part);
  }

  const partIndex = parseWritingChapterIndex(chapter?.partIndex);
  return partIndex ? `第${partIndex}幕` : "";
}

function normalizeWritingChapterDraftOutput(value) {
  const text = String(value ?? "")
    .replace(/^\s*```(?:markdown|md|text)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  if (!text.trim()) {
    return "";
  }

  const lines = text.split(/\r?\n/);

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  const firstLine = String(lines[0] ?? "").trim().replace(/^#+\s*/, "").trim();

  if (WRITING_CHAPTER_PREFIX_PATTERN.test(firstLine)) {
    lines.shift();
  }

  return lines.join("\n").replace(/^(?:\r?\n)+/, "").replace(/[ \t\r\n]+$/, "");
}

function trimWritingExportTextBlock(value) {
  return String(value ?? "").replace(/^(?:[ \t]*\r?\n)+/, "").replace(/[ \t\r\n]+$/, "");
}

function buildWritingBookExportContent(book) {
  const chapters = getDoneWritingChapters(book);
  const allChapters = getWritingChapters(book);
  const lines = [`《${sanitizeWritingExportTitle(book?.title)}》`, ""];
  const intro = trimWritingExportTextBlock(book?.intro ?? "");
  let previousPartHeading = "";

  if (intro) {
    lines.push(intro, "");
  }

  chapters.forEach((chapter) => {
    const partHeading = getWritingExportPartHeading(book, chapter);

    if (partHeading && partHeading !== previousPartHeading) {
      lines.push(partHeading, "");
      previousPartHeading = partHeading;
    }

    const chapterIndex = allChapters.findIndex((entry) => entry.id === chapter.id);
    lines.push(getWritingChapterDisplayTitle(chapter, chapterIndex >= 0 ? chapterIndex : 0), "");
    lines.push(trimWritingExportTextBlock(chapter.content ?? ""), "");
  });

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function setWritingExportFeedback(text, tone = "neutral") {
  ui.marketplace.writing.exportFeedback = String(text ?? "").trim();
  ui.marketplace.writing.exportFeedbackTone = tone;
}

function openWritingExportDialog() {
  if (!activeWritingBook.value) {
    return;
  }

  ui.marketplace.writing.exportFormat = normalizeWritingExportFormat(ui.marketplace.writing.exportFormat);
  ui.marketplace.writing.isExportDialogOpen = true;
  setWritingExportFeedback(
    activeWritingDoneChapterCount.value > 0 ? "" : "当前还没有已完成且有正文的章节，暂时不能导出书稿文件。",
    activeWritingDoneChapterCount.value > 0 ? "neutral" : "warning"
  );
}

function closeWritingExportDialog() {
  if (ui.marketplace.writing.isExporting) {
    return;
  }

  ui.marketplace.writing.isExportDialogOpen = false;
  setWritingExportFeedback("", "neutral");
}

function setWritingExportFormat(format) {
  ui.marketplace.writing.exportFormat = normalizeWritingExportFormat(format);
}

async function selectWritingExportDirectory() {
  if (!desktopApi?.selectWritingBookExportDirectory) {
    setWritingExportFeedback("当前桌面桥接暂不支持选择输出目录。", "danger");
    return;
  }

  try {
    const directoryPath = await desktopApi.selectWritingBookExportDirectory();

    if (directoryPath) {
      ui.marketplace.writing.exportDirectory = directoryPath;
      setWritingExportFeedback("", "neutral");
    }
  } catch (error) {
    console.error("Failed to select writing export directory", error);
    setWritingExportFeedback(`选择目录失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function exportActiveWritingBook() {
  const book = activeWritingBook.value;

  if (!book || ui.marketplace.writing.isExporting) {
    return;
  }

  if (!activeWritingDoneChapterCount.value) {
    setWritingExportFeedback("当前还没有已完成且有正文的章节，暂时不能导出书稿文件。", "warning");
    return;
  }

  if (!String(ui.marketplace.writing.exportDirectory ?? "").trim()) {
    setWritingExportFeedback("请先选择输出目录。", "warning");
    return;
  }

  if (!desktopApi?.exportWritingBook) {
    setWritingExportFeedback("当前桌面桥接暂不支持导出书稿。", "danger");
    return;
  }

  try {
    ui.marketplace.writing.isExporting = true;
    setWritingExportFeedback("正在保存书稿文件...", "neutral");
    const format = normalizeWritingExportFormat(ui.marketplace.writing.exportFormat);
    const result = await desktopApi.exportWritingBook({
      directoryPath: ui.marketplace.writing.exportDirectory,
      fileName: getWritingExportFileName(book, format),
      format,
      content: buildWritingBookExportContent(book)
    });
    ui.marketplace.writing.isExportDialogOpen = false;
    setWritingExportFeedback("", "neutral");
    setStatus(`已导出书稿文件：${result.fileName ?? activeWritingExportFileName.value}`, "success");
  } catch (error) {
    console.error("Failed to export writing book", error);
    setWritingExportFeedback(`导出失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    ui.marketplace.writing.isExporting = false;
  }
}

function buildWritingOutlineContent(book) {
  const partsContent = getWritingBookParts(book)
    .map((part) => `partIndex：${part.index}\npartType：${part.type}\npartTitle：${part.title}\npartDescription：${part.description || "暂无描述"}`)
    .join("\n\n");
  const chaptersContent = getWritingChapters(book)
    .map((chapter, index) => {
      const order = normalizeWritingChapterIndex(chapter.index, index);
      const title = splitWritingChapterTitlePrefix(chapter.title).title || `未命名章节 ${order}`;
      const summary = String(chapter.summary ?? "").trim() || "暂无简介";
      const partLine = chapter.partIndex ? `partIndex：${chapter.partIndex}\n` : "";
      return `${partLine}index：${order}\ntitle：${title}\n状态：${getWritingChapterStatusLabel(chapter.status)}\n简介：${summary}`;
    })
    .join("\n\n");

  return [partsContent ? `【幕/卷设计】\n${partsContent}` : "", chaptersContent ? `【章节目录】\n${chaptersContent}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function setWritingChapterTitle(chapter, value) {
  if (!chapter || !activeWritingBook.value) {
    return;
  }

  const titleParts = splitWritingChapterTitlePrefix(value);
  chapter.index = normalizeWritingChapterIndex(titleParts.index ?? chapter.index, getWritingChapters(activeWritingBook.value).indexOf(chapter));
  chapter.title = titleParts.title;
  chapter.updatedAt = new Date().toISOString();
  touchWritingBook(activeWritingBook.value);
}

function setWritingChapterSummary(chapter, value) {
  if (!chapter || !activeWritingBook.value) {
    return;
  }

  chapter.summary = String(value ?? "");
  chapter.updatedAt = new Date().toISOString();
  touchWritingBook(activeWritingBook.value);
}

function setWritingChapterContent(chapter, value) {
  if (!chapter || !activeWritingBook.value) {
    return;
  }

  chapter.content = String(value ?? "");
  chapter.updatedAt = new Date().toISOString();

  if (
    ui.marketplace.writing.submittedChapterId === chapter.id &&
    chapter.content !== ui.marketplace.writing.submittedChapterContentSnapshot
  ) {
    clearWritingChapterSubmitConfirmation(chapter.id);
  }

  if (chapter.status === "todo" && chapter.content.trim()) {
    chapter.status = "inProgress";
  }

  touchWritingBook(activeWritingBook.value);
}

function createWritingChapter() {
  const book = activeWritingBook.value;

  if (!book) {
    return;
  }

  const chapters = getWritingChapters(book);
  const nextIndex = chapters.length + 1;
  const chapter = {
    id: createLocalId("writing_chapter"),
    index: nextIndex,
    title: `未命名章节 ${nextIndex}`,
    summary: "",
    content: "",
    status: "todo",
    updatedAt: new Date().toISOString()
  };

  book.chapters = [...chapters, chapter];
  selectWritingChapter(chapter.id);
  touchWritingBook(book);
  setStatus("已新增一个章节。", "success");
}

function goWritingChapter(chapterId) {
  selectWritingChapter(chapterId);
  ui.marketplace.writing.activeTab = "chapter";
  ui.marketplace.writing.aiTaskId = WRITING_AI_TASKS.chapter[0].id;
  ui.marketplace.writing.aiOutput = "";
  ui.marketplace.writing.chapterSearchQuery = "";
  setWritingChapterPickerOpen(false);
  setWritingFeedback("", "neutral");
}

function submitWritingChapter() {
  const chapter = activeWritingChapter.value;

  if (!chapter || !activeWritingBook.value) {
    return;
  }

  if (!String(chapter.content ?? "").trim()) {
    setWritingFeedback("章节正文为空，暂时不能提交。", "warning");
    return;
  }

  chapter.status = "done";
  chapter.updatedAt = new Date().toISOString();
  ui.marketplace.writing.submittedChapterId = chapter.id;
  ui.marketplace.writing.submittedChapterContentSnapshot = String(chapter.content ?? "");
  touchWritingBook(activeWritingBook.value);
  setWritingFeedback(`「${chapter.title || "当前章节"}」已标记完成。`, "success");
  setStatus(`章节「${chapter.title || "当前章节"}」已完成。`, "success");
}

function getWritingBookContent(book, tabId) {
  if (!book) {
    return "";
  }

  if (tabId === "outline") {
    return buildWritingOutlineContent(book);
  }

  if (tabId === "chapter") {
    return activeWritingChapter.value?.content ?? getPreferredWritingChapter(book)?.content ?? "";
  }

  return buildWritingIntroContent(book);
}

function setWritingBookContent(book, tabId, value) {
  if (!book) {
    return;
  }

  const content = String(value ?? "");

  if (tabId === "outline") {
    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    if (chapter) {
      setWritingChapterSummary(chapter, content);
    }
  } else if (tabId === "chapter") {
    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    if (chapter) {
      setWritingChapterContent(chapter, content);
    }
  } else {
    book.intro = content;
    touchWritingBook(book);
  }
}

function getWritingBookWordCount(book) {
  const chapterText = getWritingChapters(book)
    .map((chapter) => `${chapter.summary ?? ""}\n${chapter.content ?? ""}`)
    .join("\n");

  return [book?.intro, book?.outlineGuide, book?.seriesPlan, chapterText]
    .map((value) => String(value ?? "").replace(/\s+/g, ""))
    .join("").length;
}

function getWritingTabWordCount(tabId = ui.marketplace.writing.activeTab) {
  return String(getWritingBookContent(activeWritingBook.value, tabId) ?? "").replace(/\s+/g, "").length;
}

function getWritingTabTitle(tabId) {
  return WRITING_APP_TABS.find((tab) => tab.id === tabId)?.label ?? "写作";
}

function formatWritingBookUpdatedAt(value) {
  if (!value) {
    return "刚刚";
  }

  try {
    return formatLocalDateTime(value);
  } catch {
    return String(value);
  }
}

function getWritingBookCompleteness(book) {
  if (!book) {
    return 0;
  }

  const introSections = getWritingIntroSections(book);
  const filledIntroCount = introSections.filter((section) => getWritingIntroFieldValue(book, section.key).trim()).length;
  const introScore = introSections.length ? filledIntroCount / introSections.length : 0;
  const chapters = getWritingChapters(book);
  const chapterScore = chapters.length ? chapters.filter((chapter) => chapter.status === "done").length / chapters.length : 0;
  return Math.round((introScore * 0.4 + chapterScore * 0.6) * 100);
}

function setWritingFeedback(text, tone = "neutral") {
  ui.marketplace.writing.aiFeedback = String(text ?? "").trim();
  ui.marketplace.writing.aiFeedbackTone = tone;
}

function getWritingAiFeedbackClass() {
  if (ui.marketplace.writing.isAiRunning) {
    return "is-running";
  }

  if (ui.marketplace.writing.aiFeedbackTone === "success") {
    return "is-success";
  }

  if (ui.marketplace.writing.aiFeedbackTone === "warning") {
    return "is-warning";
  }

  if (ui.marketplace.writing.aiFeedbackTone === "danger") {
    return "is-danger";
  }

  return "";
}

function toggleWritingProfileRail() {
  if (isActiveWritingBookAiRunning.value) {
    return;
  }

  ui.marketplace.writing.isProfileCollapsed = !ui.marketplace.writing.isProfileCollapsed;
}

function setWritingAiDrawerOpen(isOpen) {
  if (isActiveWritingBookAiRunning.value) {
    return;
  }

  ui.marketplace.writing.isAiDrawerOpen = Boolean(isOpen);
  if (!ui.marketplace.writing.isAiDrawerOpen) {
    setWritingAiTaskPickerOpen(false);
    ui.marketplace.writing.isPromptPreviewOpen = false;
  }
}

function setWritingAiTaskPickerOpen(isOpen) {
  ui.marketplace.writing.isAiTaskPickerOpen = Boolean(isOpen);
}

function toggleWritingAiTaskPicker() {
  setWritingAiTaskPickerOpen(!ui.marketplace.writing.isAiTaskPickerOpen);
}

function selectWritingAiTask(taskId) {
  ui.marketplace.writing.aiTaskId = taskId;
  setWritingAiTaskPickerOpen(false);
}

function toggleWritingPromptPreview() {
  ui.marketplace.writing.isPromptPreviewOpen = !ui.marketplace.writing.isPromptPreviewOpen;
}

function openComicAppShelf() {
  activeFeature.value = FEATURE_MARKETPLACE;
  ui.marketplace.view = "comicShelf";

  if (!ui.marketplace.comic.activeProjectId && comicProjects.value.length) {
    ui.marketplace.comic.activeProjectId = comicProjects.value[0].id;
  }
}

function backComicMarketplace() {
  ui.marketplace.view = "apps";
}

function openComicProject(projectId) {
  ui.marketplace.comic.activeProjectId = projectId;
  ui.marketplace.comic.activeTab = "intro";
  const project = comicProjects.value.find((entry) => entry.id === projectId) ?? null;
  ui.marketplace.comic.activeChapterId = getComicChapters(project)[0]?.id ?? "";
  ui.marketplace.view = "comicDetail";
}

function backComicShelf() {
  ui.marketplace.view = "comicShelf";
}

async function deleteComicProjectFromShelf(projectId) {
  if (!desktopApi?.deleteComicProject) {
    setStatus("漫画项目仓储未就绪，暂时无法删除。", "danger");
    return;
  }

  const project = comicProjects.value.find((entry) => entry.id === projectId) ?? null;
  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除漫画项目",
    message: `确认删除「${project?.title ?? "当前项目"}」吗？项目会移入系统回收站。`,
    detail: "删除后会从项目架移除，可在系统回收站中找回备份文件。",
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  clearComicAutosaveTimer();

  if (comicQueuedSaveProjectId === projectId) {
    comicQueuedSaveProjectId = null;
  }

  try {
    const savedProjects = await desktopApi.deleteComicProject(projectId);
    applyComicProjectsFromStorage(savedProjects, {
      preferProjectId: ui.marketplace.comic.activeProjectId === projectId ? "" : ui.marketplace.comic.activeProjectId
    });
    setStatus("漫画项目已移入系统回收站。", "success");
  } catch (error) {
    console.error("Failed to delete comic project", error);
    setStatus(`漫画项目删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function createComicProject() {
  const now = new Date().toISOString();
  const project = {
    id: createLocalId("comic_project"),
    title: `未命名漫画 ${comicProjects.value.length + 1}`,
    format: "poster",
    palette: "color",
    genre: "漫画 / 待定类型",
    status: "新建",
    summary: "写下漫画的主角、冲突、核心画面和要传达的情绪。",
    visualStyle: "彩绘分镜，角色轮廓清晰，画面层次明确。",
    episodePlan: "单图海报：主体、背景、人物站位、标题区域和最终比例。",
    pageCount: 1,
    coverTone: COMIC_PROJECT_COVER_TONES[comicProjects.value.length % COMIC_PROJECT_COVER_TONES.length],
    chapters: [
      {
        id: createLocalId("comic_chapter"),
        index: 1,
        title: "开场分镜",
        summary: "写下这一章的场景目标、镜头顺序、角色动作和结尾画面。",
        prompt: "基于总介绍生成开场分镜，明确画面、动作、对白和页数。",
        content: "",
        status: "inProgress",
        updatedAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  ui.marketplace.comic.projects = [project, ...comicProjects.value];
  workbench.comicProjects = ui.marketplace.comic.projects;
  ui.marketplace.comic.activeTab = "intro";
  ui.marketplace.comic.activeChapterId = project.chapters[0]?.id ?? "";
  openComicProject(project.id);
  setStatus("已创建一个漫画项目，正在写入本地项目库。", "success");
  await persistComicProjectById(project.id, { silent: false });
}

function setComicProjectField(field, value) {
  const project = activeComicProject.value;

  if (!project) {
    return;
  }

  if (field === "format") {
    const previousFormat = normalizeComicProjectFormatForUi(project.format);
    const previousDefaultPages = COMIC_PROJECT_FORMAT_META[previousFormat]?.defaultPages ?? 1;
    project.format = normalizeComicProjectFormatForUi(value);
    const nextDefaultPages = COMIC_PROJECT_FORMAT_META[project.format]?.defaultPages ?? 1;

    if (!project.pageCount || project.pageCount === previousDefaultPages) {
      project.pageCount = nextDefaultPages;
    }
  } else if (field === "palette") {
    project.palette = normalizeComicProjectPaletteForUi(value);
  } else if (field === "pageCount") {
    project.pageCount = normalizeComicProjectPageCount(value, project.pageCount);
  } else if (field === "title") {
    project.title = String(value ?? "");
  } else {
    project[field] = String(value ?? "");
  }

  touchComicProject(project);
}

function setComicProjectTitle(value) {
  setComicProjectField("title", value);
}

function setComicProjectFormat(value) {
  setComicProjectField("format", value);
}

function setComicProjectPalette(value) {
  setComicProjectField("palette", value);
}

function setComicProjectGenre(value) {
  setComicProjectField("genre", value);
}

function setComicProjectSummary(value) {
  setComicProjectField("summary", value);
}

function setComicProjectVisualStyle(value) {
  setComicProjectField("visualStyle", value);
}

function setComicProjectEpisodePlan(value) {
  setComicProjectField("episodePlan", value);
}

function setComicProjectPageCount(value) {
  setComicProjectField("pageCount", value);
}

function toggleComicProfileRail() {
  ui.marketplace.comic.isProfileCollapsed = !ui.marketplace.comic.isProfileCollapsed;
}

function setComicTab(tabId) {
  ui.marketplace.comic.activeTab = COMIC_APP_TABS.some((tab) => tab.id === tabId) ? tabId : "intro";
}

function selectComicChapter(chapterId) {
  ui.marketplace.comic.activeChapterId = chapterId;
}

function setComicChapterPickerOpen(isOpen) {
  ui.marketplace.comic.isChapterPickerOpen = Boolean(isOpen);

  if (ui.marketplace.comic.isChapterPickerOpen) {
    scrollComicChapterPickerToActive();
  }
}

function toggleComicChapterPicker() {
  setComicChapterPickerOpen(!ui.marketplace.comic.isChapterPickerOpen);
}

function selectComicChapterFromPicker(chapterId) {
  selectComicChapter(chapterId);
  ui.marketplace.comic.chapterSearchQuery = "";
  setComicChapterPickerOpen(false);
}

async function scrollComicChapterPickerToActive() {
  await nextTick();

  const menu = comicChapterDropdownMenuRef.value;
  const activeItem = menu?.querySelector?.(".writing-chapter-dropdown-item.is-active");

  if (!menu || !activeItem) {
    return;
  }

  const targetTop = activeItem.offsetTop - (menu.clientHeight - activeItem.clientHeight) / 2;
  menu.scrollTop = Math.max(0, targetTop);
}

function touchComicChapter(chapter) {
  const project = activeComicProject.value;

  if (!project || !chapter) {
    return;
  }

  chapter.updatedAt = new Date().toISOString();

  if (chapter.status === "todo" && (String(chapter.prompt ?? "").trim() || String(chapter.content ?? "").trim())) {
    chapter.status = "inProgress";
  }

  touchComicProject(project);
}

function createComicChapter() {
  const project = activeComicProject.value;

  if (!project) {
    return;
  }

  const now = new Date().toISOString();
  const chapters = getComicChapters(project);
  const chapter = {
    id: createLocalId("comic_chapter"),
    index: chapters.length + 1,
    title: `分镜章节 ${chapters.length + 1}`,
    summary: "写下本章画面目标、分镜顺序、角色动作、对白密度和结尾画面。",
    prompt: "基于总介绍和目录生成本章漫画分镜。",
    content: "",
    status: "todo",
    updatedAt: now
  };

  project.chapters = [...chapters, chapter];
  ui.marketplace.comic.activeChapterId = chapter.id;
  ui.marketplace.comic.activeTab = "outline";
  touchComicProject(project);
}

function setComicChapterTitle(chapter, value) {
  if (!chapter) {
    return;
  }

  chapter.title = String(value ?? "");
  touchComicChapter(chapter);
}

function setComicChapterSummary(chapter, value) {
  if (!chapter) {
    return;
  }

  chapter.summary = String(value ?? "");
  touchComicChapter(chapter);
}

function setComicChapterPrompt(chapter, value) {
  if (!chapter) {
    return;
  }

  chapter.prompt = String(value ?? "");
  touchComicChapter(chapter);
}

function setComicChapterContent(chapter, value) {
  if (!chapter) {
    return;
  }

  chapter.content = String(value ?? "");
  touchComicChapter(chapter);
}

function goComicChapter(chapterId) {
  selectComicChapter(chapterId);
  ui.marketplace.comic.chapterSearchQuery = "";
  setComicChapterPickerOpen(false);
  setComicTab("chapter");
}

function submitComicChapter() {
  const chapter = activeComicChapter.value;

  if (!chapter) {
    return;
  }

  chapter.status = "done";
  touchComicChapter(chapter);
  setStatus("漫画章节已提交。", "success");
}

function setComicExportFeedback(text, tone = "neutral") {
  ui.marketplace.comic.exportFeedback = String(text ?? "").trim();
  ui.marketplace.comic.exportFeedbackTone = tone;
}

function openComicExportDialog() {
  if (!activeComicProject.value) {
    return;
  }

  ui.marketplace.comic.isExportDialogOpen = true;
  setComicExportFeedback("", "neutral");
}

function closeComicExportDialog() {
  if (ui.marketplace.comic.isExporting) {
    return;
  }

  ui.marketplace.comic.isExportDialogOpen = false;
  setComicExportFeedback("", "neutral");
}

async function selectComicExportDirectory() {
  if (!desktopApi?.selectComicProjectExportDirectory) {
    setComicExportFeedback("当前桌面桥接暂不支持选择输出目录。", "danger");
    return;
  }

  try {
    const directoryPath = await desktopApi.selectComicProjectExportDirectory();

    if (directoryPath) {
      ui.marketplace.comic.exportDirectory = directoryPath;
      setComicExportFeedback("", "neutral");
    }
  } catch (error) {
    console.error("Failed to select comic export directory", error);
    setComicExportFeedback(`选择目录失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function exportActiveComicProject() {
  const project = activeComicProject.value;

  if (!project || ui.marketplace.comic.isExporting) {
    return;
  }

  if (!String(ui.marketplace.comic.exportDirectory ?? "").trim()) {
    setComicExportFeedback("请先选择输出目录。", "warning");
    return;
  }

  if (!desktopApi?.exportComicProject) {
    setComicExportFeedback("当前桌面桥接暂不支持导出漫画项目。", "danger");
    return;
  }

  try {
    ui.marketplace.comic.isExporting = true;
    setComicExportFeedback("正在保存作品文件...", "neutral");

    const result = await desktopApi.exportComicProject({
      directoryPath: ui.marketplace.comic.exportDirectory,
      fileName: getComicExportFileName(project),
      format: "md",
      content: buildComicProjectExportContent(project)
    });

    ui.marketplace.comic.isExportDialogOpen = false;
    setComicExportFeedback("", "neutral");
    setStatus(`已导出漫画项目：${result.fileName ?? activeComicExportFileName.value}`, "success");
  } catch (error) {
    console.error("Failed to export comic project", error);
    setComicExportFeedback(`导出失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    ui.marketplace.comic.isExporting = false;
  }
}

function openWritingAppShelf() {
  activeFeature.value = FEATURE_MARKETPLACE;
  ui.marketplace.view = "writingShelf";
  if (!ui.marketplace.writing.activeBookId && writingBooks.value.length) {
    ui.marketplace.writing.activeBookId = writingBooks.value[0].id;
  }
}

function backWritingMarketplace() {
  ui.marketplace.view = "apps";
  ui.marketplace.writing.aiOutput = "";
  setWritingFeedback("", "neutral");
}

async function deleteWritingBookFromShelf(bookId) {
  if (!desktopApi?.deleteWritingBook) {
    setStatus("书稿仓储未就绪，暂时无法删除。", "danger");
    return;
  }

  const book = writingBooks.value.find((entry) => entry.id === bookId) ?? null;
  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除书籍",
    message: `确认删除「${book?.title ?? "当前书籍"}」吗？书稿目录会移入系统回收站。`,
    detail: "删除后会从书架移除，可在系统回收站中恢复本地书稿目录。",
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  clearWritingAutosaveTimer();

  if (writingQueuedSave?.bookId === bookId) {
    writingQueuedSave = null;
  }

  try {
    const savedBooks = await desktopApi.deleteWritingBook(bookId);
    applyWritingBooksFromStorage(savedBooks, {
      preferBookId: ui.marketplace.writing.activeBookId === bookId ? "" : ui.marketplace.writing.activeBookId
    });
    setStatus("书籍已移入系统回收站。", "success");
  } catch (error) {
    console.error("Failed to delete writing book", error);
    setStatus(`书籍删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function openWritingBook(bookId) {
  ui.marketplace.writing.activeBookId = bookId;
  selectPreferredWritingChapter(writingBooks.value.find((book) => book.id === bookId) ?? null);
  ui.marketplace.writing.activeTab = "intro";
  ui.marketplace.writing.aiTaskId = WRITING_AI_TASKS.intro[0].id;
  ui.marketplace.writing.aiOutput = "";
  ui.marketplace.writing.isAiDrawerOpen = false;
  ui.marketplace.writing.isPromptPreviewOpen = false;
  setWritingFeedback("", "neutral");
  ui.marketplace.view = "writingDetail";
}

function backWritingShelf() {
  ui.marketplace.view = "writingShelf";
  ui.marketplace.writing.aiOutput = "";
  setWritingFeedback("", "neutral");
}

async function createWritingBook() {
  const now = new Date().toISOString();
  const book = {
    id: createLocalId("writing_book"),
    title: `未命名故事 ${writingBooks.value.length + 1}`,
    author: "Song",
    length: "medium",
    genre: "小说 / 待定类型",
    status: "新建",
    updatedAt: now,
    coverTone: writingBooks.value.length % 2 === 0 ? "gold" : "teal",
    intro: "在这里写下故事的核心命题、世界观、人物关系和主要矛盾。",
    outlineGuide: "把故事拆成开始、失控、反转和收束四个阶段，每个阶段都要写清冲突升级和人物变化。",
    seriesPlan: "",
    parts: [],
    chapters: [
      {
        id: createLocalId("writing_chapter"),
        index: 1,
        title: "开场章节",
        summary: "写下本章冲突、信息增量、人物变化和结尾钩子。",
        content: "## 第一章\n\n",
        status: "inProgress",
        updatedAt: now
      }
    ]
  };

  ui.marketplace.writing.books = [book, ...writingBooks.value];
  workbench.writingBooks = ui.marketplace.writing.books;
  writingBookSaveVersions.set(book.id, 0);
  openWritingBook(book.id);
  setStatus("已创建一本新书，正在写入本地书稿目录。", "success");
  await persistWritingBookById(book.id, { silent: false });
}

async function handleWritingBookUpload(event) {
  const file = event.target?.files?.[0] ?? null;

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const title = file.name.replace(/\.[^.]+$/, "").trim() || "上传书稿";
    const book = {
      id: createLocalId("writing_book_upload"),
      title,
      author: "Song",
      length: "long",
      genre: "上传书稿",
      status: "导入",
      updatedAt: new Date().toISOString(),
      coverTone: "ink",
      intro: `从「${file.name}」导入。建议先让 AI 帮你整理故事简介、人物关系和世界观。`,
      outlineGuide: "待整理目录。可以在目录 Tab 里使用「章节规划」生成结构。",
      seriesPlan: "",
      chapters: [
        {
          id: createLocalId("writing_chapter_upload"),
          title: "导入正文",
          summary: "从上传书稿中导入的初始正文，可继续拆分和整理。",
          content: text.slice(0, 16000),
          status: text.trim() ? "inProgress" : "todo",
          updatedAt: new Date().toISOString()
        }
      ]
    };

    ui.marketplace.writing.books = [book, ...writingBooks.value];
    workbench.writingBooks = ui.marketplace.writing.books;
    writingBookSaveVersions.set(book.id, 0);
    ui.marketplace.writing.uploadFeedback = `已导入 ${file.name}`;
    openWritingBook(book.id);
    setStatus(`已导入「${title}」，正在写入本地书稿目录。`, "success");
    await persistWritingBookById(book.id, { silent: false });
  } catch (error) {
    console.error("Failed to upload writing book", error);
    ui.marketplace.writing.uploadFeedback = "导入失败";
    setStatus(`导入书稿失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    event.target.value = "";
  }
}

function setWritingTab(tabId) {
  if (tabId === "chapter") {
    selectPreferredWritingChapter(activeWritingBook.value);
  } else {
    ensureWritingChapterSelection(activeWritingBook.value);
    setWritingChapterPickerOpen(false);
  }

  if (ui.marketplace.writing.activeTab === tabId) {
    return;
  }

  ui.marketplace.writing.activeTab = tabId;
  ui.marketplace.writing.aiTaskId = (WRITING_AI_TASKS[tabId] ?? WRITING_AI_TASKS.intro)[0]?.id ?? "";
  ui.marketplace.writing.aiOutput = "";
  setWritingAiTaskPickerOpen(false);
  setWritingFeedback("", "neutral");
}

function getWritingTaskPromptSpec(tabId, taskId) {
  return getWritingTaskPromptSpecFromAssets(
    writingPromptAssets,
    tabId,
    taskId,
    WRITING_AI_TASKS[tabId] ?? WRITING_AI_TASKS.intro
  );
}

function parseWritingInstructionPartCount(instruction) {
  const match = String(instruction ?? "").match(
    /(?:分(?:为|成)|拆(?:为|成)|规划(?:为|成)|设计(?:为|成))?\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(幕|卷|部)/
  );

  if (!match) {
    return null;
  }

  const count = parseWritingChapterIndex(match[1]);

  if (!count) {
    return null;
  }

  return {
    count,
    partType: match[2] === "卷" ? "volume" : "act"
  };
}

function parseWritingInstructionChapterRange(instruction) {
  const text = String(instruction ?? "");
  const perPartMatch = text.match(
    /每\s*(?:一)?(?:幕|卷|部)\s*(?:大概|大约|约|左右|预计|规划)?\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(?:[-~－—–到至]\s*([0-9０-９一二三四五六七八九十百千万零〇两]+))?\s*章/
  );

  if (perPartMatch) {
    const first = parseWritingChapterIndex(perPartMatch[1]);
    const second = parseWritingChapterIndex(perPartMatch[2]);

    if (first) {
      return {
        min: Math.min(first, second ?? first),
        max: Math.max(first, second ?? first),
        source: "perPart"
      };
    }
  }

  const totalMatch = text.match(/(?:共|总共|总计|整体|全书|增加到|扩写到)?\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(?:章|章节)/);
  const total = parseWritingChapterIndex(totalMatch?.[1]);

  return total ? { min: total, max: total, source: "total" } : null;
}

function getWritingLongOutlineRequest({ book, tabId, task, instruction }) {
  if (!book || tabId !== "outline" || task?.id !== "structure") {
    return null;
  }

  const instructionText = String(instruction ?? "").trim();
  const partCountRequest = parseWritingInstructionPartCount(instructionText);
  const chapterRange = parseWritingInstructionChapterRange(instructionText);
  const hasExpansionIntent = WRITING_OUTLINE_EXPANSION_PATTERN.test(instructionText);

  if (!hasExpansionIntent && !partCountRequest && !chapterRange) {
    return null;
  }

  const existingPartCount = getWritingBookParts(book).length;
  const targetPartCount = Math.max(1, partCountRequest?.count ?? (existingPartCount || 1));
  const partType = partCountRequest?.partType ?? (getWritingBookParts(book)[0]?.type || "act");
  const minChaptersPerPart =
    chapterRange?.source === "perPart"
      ? chapterRange.min
      : chapterRange?.source === "total"
        ? Math.max(1, Math.floor(chapterRange.min / targetPartCount))
        : 24;
  const maxChaptersPerPart =
    chapterRange?.source === "perPart"
      ? chapterRange.max
      : chapterRange?.source === "total"
        ? Math.max(minChaptersPerPart, Math.ceil(chapterRange.max / targetPartCount))
        : Math.max(minChaptersPerPart, 30);
  const chaptersPerPart = Math.round((minChaptersPerPart + maxChaptersPerPart) / 2);
  const targetChapterCount = targetPartCount * chaptersPerPart;
  const shouldUseLongPlanner =
    targetChapterCount >= 80 ||
    targetPartCount > Math.max(1, existingPartCount) ||
    minChaptersPerPart >= 40 ||
    /几百章|上千章|千章|百章/.test(instructionText);

  if (!shouldUseLongPlanner) {
    return null;
  }

  return {
    instruction: instructionText,
    targetPartCount,
    partType,
    minChaptersPerPart,
    maxChaptersPerPart,
    chaptersPerPart,
    targetChapterCount,
    batchSize: WRITING_LONG_OUTLINE_BATCH_SIZE
  };
}

function shouldIgnoreExistingWritingOutline(instruction, taskId) {
  const text = String(instruction ?? "");
  return taskId === "structure" && (WRITING_OUTLINE_REWRITE_PATTERN.test(text) || WRITING_OUTLINE_EXPANSION_PATTERN.test(text));
}

function buildWritingLongOutlineTargetContent(request) {
  if (!request) {
    return "";
  }

  const partLabel = request.partType === "volume" ? "卷" : "幕";

  return [
    `目标结构：${request.targetPartCount} ${partLabel}`,
    `每${partLabel}章节范围：${request.minChaptersPerPart}-${request.maxChaptersPerPart} 章`,
    `本轮规划采用：每${partLabel} ${request.chaptersPerPart} 章，共 ${request.targetChapterCount} 章`,
    `分批粒度：每批 ${request.batchSize} 章，逐批生成、校验并落盘`
  ].join("\n");
}

function buildWritingLongOutlineSeedContent(book, maxChapters = 36) {
  const partsContent = getWritingBookParts(book)
    .map((part) => `${getWritingPartDisplayLabel(part)}：${part.description || "暂无描述"}`)
    .join("\n");
  const chapters = getWritingChapters(book);
  const visibleChapters =
    chapters.length <= maxChapters
      ? chapters
      : [...chapters.slice(0, Math.ceil(maxChapters / 2)), null, ...chapters.slice(-Math.floor(maxChapters / 2))];
  const chaptersContent = visibleChapters
    .map((chapter, index) => {
      if (!chapter) {
        return `... 已省略 ${Math.max(0, chapters.length - maxChapters)} 章 ...`;
      }

      const chapterIndex = chapters.findIndex((entry) => entry.id === chapter.id);
      return `${getWritingChapterDisplayTitle(chapter, chapterIndex >= 0 ? chapterIndex : index)}：${chapter.summary || "暂无简介"}`;
    })
    .join("\n");

  return [
    "现有目录只作为种子参考，不是最终章节数上限；如果作者要求扩写，必须重新设计覆盖目标篇幅的长篇结构。",
    partsContent ? `【现有幕/卷】\n${partsContent}` : "",
    chaptersContent ? `【现有章节种子】\n${chaptersContent}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildWritingChapterMemoryLine(book, chapter, index = 0) {
  const partLabel = getWritingChapterPartLabel(book, chapter);
  const statusLabel = getWritingChapterStatusLabel(chapter?.status);
  const sourceText = String(chapter?.summary || chapter?.content || "")
    .replace(/\s+/g, " ")
    .trim();
  const summary = truncateText(sourceText, 140) || "暂无摘要";

  return `${getWritingChapterDisplayTitle(chapter, index)}${partLabel ? ` / ${partLabel}` : ""} / ${statusLabel}：${summary}`;
}

function buildWritingStoryMemoryContext(book, currentChapter = null) {
  if (!book) {
    return "(空)";
  }

  const chapters = getWritingChapters(book).sort(
    (left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0)
  );
  const currentChapterIndex = currentChapter
    ? chapters.findIndex((chapter) => chapter.id === currentChapter.id)
    : -1;
  const currentOrder = currentChapterIndex >= 0 ? normalizeWritingChapterIndex(chapters[currentChapterIndex].index, currentChapterIndex) : 0;
  const recentChapters =
    currentOrder > 0
      ? chapters
          .filter((chapter, index) => normalizeWritingChapterIndex(chapter.index, index) < currentOrder)
          .slice(-6)
      : chapters.filter((chapter) => chapter.status === "done").slice(-6);
  const nextChapters =
    currentOrder > 0
      ? chapters
          .filter((chapter, index) => normalizeWritingChapterIndex(chapter.index, index) > currentOrder)
          .slice(0, 4)
      : chapters.slice(0, 4);
  const memoryKeywords = /(伏笔|未回收|秘密|悬念|钩子|误导|回收|规则|境界|能力|债务|承诺|禁忌)/;
  const memoryNotes = chapters
    .filter((chapter) => memoryKeywords.test(`${chapter.summary}\n${chapter.content}`))
    .slice(-8);
  const parts = getWritingBookParts(book)
    .map((part) => `${getWritingPartDisplayLabel(part)}：${truncateText(String(part.description ?? "").replace(/\s+/g, " ").trim(), 120) || "暂无描述"}`)
    .join("\n");

  return [
    parts ? `【幕/卷记忆】\n${parts}` : "",
    recentChapters.length
      ? `【最近已发生】\n${recentChapters.map((chapter, index) => buildWritingChapterMemoryLine(book, chapter, index)).join("\n")}`
      : "【最近已发生】暂无已完成章节，请以故事介绍和目录为准。",
    currentChapter
      ? `【当前章节职责】\n${buildWritingChapterMemoryLine(book, currentChapter, currentChapterIndex >= 0 ? currentChapterIndex : 0)}`
      : "",
    nextChapters.length
      ? `【后续承接】\n${nextChapters.map((chapter, index) => buildWritingChapterMemoryLine(book, chapter, index)).join("\n")}`
      : "",
    memoryNotes.length
      ? `【伏笔与规则提醒】\n${memoryNotes.map((chapter, index) => buildWritingChapterMemoryLine(book, chapter, index)).join("\n")}`
      : "【伏笔与规则提醒】暂无显式记录；如果本轮新增事实，输出时要把它写成可回收、可追踪的设定。"
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildWritingAssistantPrompt({ book, tabId, task, instruction }) {
  if (!book) {
    return "";
  }

  const lengthProfile = WRITING_LENGTH_PROFILES[book.length] ?? WRITING_LENGTH_PROFILES.long;
  const tabTitle = getWritingTabTitle(tabId);
  const content = getWritingBookContent(book, tabId);
  const currentChapter = activeWritingChapter.value ?? getPreferredWritingChapter(book);
  const taskSpec = getWritingTaskPromptSpec(tabId, task?.id);
  const longOutlineRequest = getWritingLongOutlineRequest({ book, tabId, task, instruction });
  const shouldIgnoreOutline = !longOutlineRequest && shouldIgnoreExistingWritingOutline(instruction, task?.id);
  const introContent = buildWritingIntroContent(book) || "(空)";
  const storyMemoryContent = buildWritingStoryMemoryContext(book, currentChapter);
  const outlineContent = longOutlineRequest
    ? buildWritingLongOutlineSeedContent(book)
    : shouldIgnoreOutline
      ? "(作者要求重改目录，本轮不代入已有章节目录。)"
      : buildWritingOutlineContent(book) || "(空)";
  const currentModuleContent = tabId === "outline" && (shouldIgnoreOutline || longOutlineRequest) ? outlineContent : content;
  const chapterContext =
    currentChapter
      ? [
          `标题：${getWritingChapterDisplayTitle(currentChapter, getWritingChapters(book).findIndex((chapter) => chapter.id === currentChapter.id))}`,
          `状态：${getWritingChapterStatusLabel(currentChapter.status)}`,
          `简介：${currentChapter.summary || "(空)"}`,
          "正文：",
          currentChapter.content || "(空)"
        ].join("\n")
      : "(空)";

  return buildWritingAssistantPromptFromAssets({
    appName: WRITING_APP_NAME,
    book,
    lengthProfile,
    tabTitle,
    task,
    taskSpec,
    instruction,
    promptAssets: writingPromptAssets,
    chapterOutputDefaults: tabId === "chapter" ? writingPromptAssets.chapterOutputDefaults : [],
    longOutlineContent: longOutlineRequest ? buildWritingLongOutlineTargetContent(longOutlineRequest) : "",
    storyMemoryContent,
    introContent,
    outlineContent,
    chapterContext,
    currentModuleContent
  });
}

function getWritingAssistantMaxOutputTokens(tabId, taskId) {
  if (tabId === "outline" && taskId === "structure") {
    return 6200;
  }

  if (tabId === "chapter") {
    return WRITING_CHAPTER_MAX_OUTPUT_TOKENS;
  }

  return 2600;
}

function createWritingOutlinePlannerJob(request, book = null) {
  const now = new Date().toISOString();
  const generatedChapterCount = book ? countWritingGeneratedTargetChapters(book, request) : 0;

  return {
    id: createLocalId("writing_outline_job"),
    status: "running",
    instruction: request.instruction,
    targetPartCount: request.targetPartCount,
    partType: request.partType,
    minChaptersPerPart: request.minChaptersPerPart,
    maxChaptersPerPart: request.maxChaptersPerPart,
    chaptersPerPart: request.chaptersPerPart,
    batchSize: request.batchSize,
    targetChapterCount: request.targetChapterCount,
    generatedChapterCount,
    currentPartIndex: 0,
    currentBatchStartIndex: 0,
    currentBatchEndIndex: 0,
    lastCompletedChapterIndex: book ? getLastCompletedWritingChapterIndex(book, request) : 0,
    retryAttempt: 0,
    maxRetryAttempts: 0,
    createdAt: now,
    updatedAt: now
  };
}

function updateWritingOutlinePlannerJob(book, updates = {}) {
  if (!book?.outlinePlannerJob) {
    return null;
  }

  book.outlinePlannerJob = {
    ...book.outlinePlannerJob,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  return book.outlinePlannerJob;
}

function cancelWritingOutlinePlanningJob() {
  ui.marketplace.writing.outlinePlannerCancelRequested = true;
  if (activeWritingModelRequestId && desktopApi?.cancelModelText) {
    desktopApi.cancelModelText(activeWritingModelRequestId).catch((error) => {
      console.warn("Failed to cancel writing model request", error);
    });
  }
  setWritingFeedback("正在停止分批规划，当前请求会尽快中断。", "warning");
}

function isWritingAssistantAbortError(error) {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? error ?? "");

  return (
    name === "AbortError" ||
    /abort|aborted|cancelled|canceled|operation was aborted|ERR_ABORTED/i.test(message)
  );
}

function createWritingAbortError() {
  const error = new Error("任务已停止");
  error.name = "AbortError";
  return error;
}

function getWritingErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "未知错误");
}

function isRetryableWritingAssistantError(error) {
  if (isWritingAssistantAbortError(error) || ui.marketplace.writing.outlinePlannerCancelRequested) {
    return false;
  }

  const message = getWritingErrorMessage(error);

  return /(?:HTTP\s*)?(?:408|429|500|502|503|504)|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network|timeout|socket|gateway|upstream|overloaded|rate limit|too many requests|服务错误|serivce_request_error|service_request_error|ccp http status|模型没有返回可用文本内容/i.test(
    message
  );
}

function getWritingRetryDelayMs(retryAttempt) {
  const attempt = Math.max(1, Number(retryAttempt) || 1);
  return Math.min(WRITING_MODEL_RETRY_MAX_DELAY_MS, WRITING_MODEL_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
}

async function waitWritingRetryDelay(delayMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < delayMs) {
    if (ui.marketplace.writing.outlinePlannerCancelRequested) {
      throw createWritingAbortError();
    }

    await new Promise((resolve) => setTimeout(resolve, Math.min(250, delayMs - (Date.now() - startedAt))));
  }
}

function isWritingOutlinePlannerRunning(job = activeWritingOutlinePlannerJob.value) {
  return job?.status === "running";
}

function getWritingLongOutlineRequestFromJob(job) {
  if (!job) {
    return null;
  }

  const targetPartCount = normalizePositiveInteger(job.targetPartCount, 1);
  const minChaptersPerPart = normalizePositiveInteger(job.minChaptersPerPart, 80);
  const maxChaptersPerPart = Math.max(minChaptersPerPart, normalizePositiveInteger(job.maxChaptersPerPart, 100));
  const chaptersPerPart = Math.min(maxChaptersPerPart, Math.max(minChaptersPerPart, normalizePositiveInteger(job.chaptersPerPart, Math.round((minChaptersPerPart + maxChaptersPerPart) / 2))));

  return {
    instruction: String(job.instruction ?? ""),
    targetPartCount,
    partType: normalizeWritingBookPartTypeForUi(job.partType),
    minChaptersPerPart,
    maxChaptersPerPart,
    chaptersPerPart,
    targetChapterCount: targetPartCount * chaptersPerPart,
    batchSize: Math.min(40, Math.max(5, normalizePositiveInteger(job.batchSize, WRITING_LONG_OUTLINE_BATCH_SIZE)))
  };
}

function isSameWritingLongOutlineRequest(left, right) {
  return Boolean(
    left &&
      right &&
      left.targetPartCount === right.targetPartCount &&
      left.partType === right.partType &&
      left.minChaptersPerPart === right.minChaptersPerPart &&
      left.maxChaptersPerPart === right.maxChaptersPerPart &&
      left.chaptersPerPart === right.chaptersPerPart &&
      left.targetChapterCount === right.targetChapterCount &&
      String(left.instruction ?? "") === String(right.instruction ?? "")
  );
}

function getNextMissingWritingChapterIndex(book, startIndex, endIndex) {
  const existingIndexes = new Set(getWritingChapters(book).map((chapter) => normalizeWritingChapterIndex(chapter.index, 0)));

  for (let index = startIndex; index <= endIndex; index += 1) {
    if (!existingIndexes.has(index)) {
      return index;
    }
  }

  return null;
}

function getLastCompletedWritingChapterIndex(book, request) {
  let lastCompletedIndex = 0;
  const existingIndexes = new Set(getWritingChapters(book).map((chapter) => normalizeWritingChapterIndex(chapter.index, 0)));

  for (let index = 1; index <= request.targetChapterCount; index += 1) {
    if (!existingIndexes.has(index)) {
      break;
    }

    lastCompletedIndex = index;
  }

  return lastCompletedIndex;
}

function canResumeWritingOutlinePlanner(book, job) {
  const isStaleRunningJob = job?.status === "running" && !ui.marketplace.writing.isAiRunning;

  if (!book || !job || (!["failed", "cancelled"].includes(job.status) && !isStaleRunningJob)) {
    return false;
  }

  const request = getWritingLongOutlineRequestFromJob(job);

  return Boolean(request && getNextMissingWritingChapterIndex(book, 1, request.targetChapterCount));
}

function getWritingOutlinePlannerRetryCopy(job = activeWritingOutlinePlannerJob.value) {
  if (!job?.retryAttempt || !job.maxRetryAttempts || job.status !== "running") {
    return "";
  }

  return `当前批次遇到临时错误，正在第 ${job.retryAttempt}/${job.maxRetryAttempts} 次重试。`;
}

function getWritingOutlinePlannerProgressPercent(job = activeWritingOutlinePlannerJob.value) {
  if (!job?.targetChapterCount) {
    return 0;
  }

  return Math.min(100, Math.round((Number(job.generatedChapterCount ?? 0) / job.targetChapterCount) * 100));
}

function getWritingOutlinePlannerProgressCopy(job = activeWritingOutlinePlannerJob.value) {
  if (!job) {
    return "";
  }

  if (job.status === "running" && !ui.marketplace.writing.isAiRunning && activeWritingBook.value) {
    const request = getWritingLongOutlineRequestFromJob(job);
    const nextMissingIndex = request ? getNextMissingWritingChapterIndex(activeWritingBook.value, 1, request.targetChapterCount) : null;

    return nextMissingIndex
      ? `上次规划停在第 ${nextMissingIndex} 章前；本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`
      : `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`;
  }

  if (job.status === "running" && !job.currentPartIndex) {
    return `正在生成幕/卷总规划；本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`;
  }

  if (job.status === "running") {
    const partLabel = job.partType === "volume" ? "卷" : "幕";
    return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章；当前请求第 ${job.currentPartIndex} ${partLabel}，第 ${job.currentBatchStartIndex}-${job.currentBatchEndIndex} 章。`;
  }

  if (["failed", "cancelled"].includes(job.status) && activeWritingBook.value) {
    const request = getWritingLongOutlineRequestFromJob(job);
    const nextMissingIndex = request ? getNextMissingWritingChapterIndex(activeWritingBook.value, 1, request.targetChapterCount) : null;

    if (nextMissingIndex) {
      return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章；可从第 ${nextMissingIndex} 章继续。`;
    }
  }

  return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。`;
}

function getWritingOutlinePlannerStatusLabel(job = activeWritingOutlinePlannerJob.value) {
  if (!job) {
    return "";
  }

  if (job.status === "running") {
    if (!ui.marketplace.writing.isAiRunning) {
      return "待继续";
    }

    if (!job.currentPartIndex) {
      return "总规划中";
    }

    return "分批规划中";
  }

  if (job.status === "completed") {
    return "规划完成";
  }

  if (job.status === "failed") {
    return "规划失败";
  }

  if (job.status === "cancelled") {
    return "已停止";
  }

  return "待规划";
}

function getWritingOutlinePlannerStatusClass(job = activeWritingOutlinePlannerJob.value) {
  if (job?.status === "completed") {
    return "is-success";
  }

  if (job?.status === "failed") {
    return "is-danger";
  }

  if (job?.status === "cancelled") {
    return "is-warning";
  }

  return job?.status === "running" ? (ui.marketplace.writing.isAiRunning ? "is-running" : "is-warning") : "";
}

function getWritingAiRunButtonLabel() {
  if (ui.marketplace.writing.isAiRunning) {
    return activeWritingOutlinePlannerJob.value?.status === "running" ? "规划中" : "生成中";
  }

  const resumeRequest = getWritingLongOutlineRequestFromJob(activeWritingOutlinePlannerJob.value);

  if (
    canResumeWritingOutlinePlanner(activeWritingBook.value, activeWritingOutlinePlannerJob.value) &&
    (!activeWritingLongOutlineRequest.value || isSameWritingLongOutlineRequest(activeWritingLongOutlineRequest.value, resumeRequest))
  ) {
    return "继续规划";
  }

  return activeWritingLongOutlineRequest.value ? "启动分批规划" : "生成建议";
}

function getWritingBusyTitle() {
  return activeWritingOutlinePlannerJob.value?.status === "running" ? "正在分批规划长篇目录" : "正在生成建议";
}

function getWritingBusyDescription() {
  const job = activeWritingOutlinePlannerJob.value;

  if (job?.status === "running") {
    const partLabel = job.partType === "volume" ? "卷" : "幕";

    if (!job.currentPartIndex) {
      return `正在生成幕/卷总规划；当前本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章。可以返回书架或切换到其他书籍，任务会继续在后台执行。`;
    }

    return `本地已落盘 ${job.generatedChapterCount}/${job.targetChapterCount} 章；当前在第 ${job.currentPartIndex} ${partLabel}，生成第 ${job.currentBatchStartIndex}-${job.currentBatchEndIndex} 章。可以返回书架或切换到其他书籍，任务会继续在后台执行。`;
  }

  return "任务已在后台执行，可以切换到其他页面，完成后会回到大师辅助输出区。";
}

function buildWritingPartsContext(book) {
  const parts = getWritingBookParts(book);

  if (!parts.length) {
    return "(空)";
  }

  return parts.map((part) => `${getWritingPartDisplayLabel(part)}\n${part.description || "暂无描述"}`).join("\n\n");
}

function ensureWritingLongOutlineParts(book, request) {
  const partLabel = request.partType === "volume" ? "卷" : "幕";
  const existingByIndex = new Map(getWritingBookParts(book).map((part) => [part.index, part]));

  book.parts = Array.from({ length: request.targetPartCount }, (_, index) => {
    const partIndex = index + 1;
    const existingPart = existingByIndex.get(partIndex);

    return normalizeWritingBookPart(
      existingPart ?? {
        id: createLocalId("writing_part"),
        type: request.partType,
        index: partIndex,
        title: `未命名${partLabel} ${partIndex}`,
        description: "待补充本幕/卷的整体故事设计、关键矛盾、阶段高潮和转折作用。"
      },
      index,
      book.id
    );
  });
}

function buildWritingRecentChapterContext(book, partIndex, beforeIndex, limit = 8) {
  const chapters = getWritingChapters(book)
    .filter((chapter) => (!partIndex || chapter.partIndex === partIndex) && normalizeWritingChapterIndex(chapter.index, 0) < beforeIndex)
    .sort((left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0))
    .slice(-limit);

  if (!chapters.length) {
    return "(本幕/卷还没有已生成章节)";
  }

  return chapters
    .map((chapter) => {
      const index = getWritingChapters(book).findIndex((entry) => entry.id === chapter.id);
      return `${getWritingChapterDisplayTitle(chapter, index)}：${chapter.summary || "暂无简介"}`;
    })
    .join("\n");
}

function buildWritingLongOutlineMasterPrompt(book, request) {
  const partLabel = request.partType === "volume" ? "卷" : "幕";

  return buildWritingLongOutlineMasterPromptFromAssets({
    appName: WRITING_APP_NAME,
    book,
    request,
    partLabel,
    targetContent: buildWritingLongOutlineTargetContent(request),
    introContent: buildWritingIntroContent(book) || "(空)",
    seedContent: buildWritingLongOutlineSeedContent(book, 36),
    promptAssets: writingPromptAssets
  });
}

function buildWritingLongOutlineBatchPrompt(book, request, part, batchStartIndex, batchEndIndex) {
  const partLabel = request.partType === "volume" ? "卷" : "幕";

  return buildWritingLongOutlineBatchPromptFromAssets({
    appName: WRITING_APP_NAME,
    book,
    request,
    part,
    partLabel,
    batchStartIndex,
    batchEndIndex,
    targetContent: buildWritingLongOutlineTargetContent(request),
    introContent: buildWritingIntroContent(book) || "(空)",
    partsContext: buildWritingPartsContext(book),
    partDisplayLabel: getWritingPartDisplayLabel(part),
    recentChapterContext: buildWritingRecentChapterContext(book, part.index, batchStartIndex),
    promptAssets: writingPromptAssets
  });
}

function normalizeWritingLongBatchPlans(plans, part, batchStartIndex, batchEndIndex) {
  const expectedCount = batchEndIndex - batchStartIndex + 1;
  const sortedPlans = plans
    .filter((plan) => normalizeWritingChapterIndex(plan.index, 0) >= batchStartIndex && normalizeWritingChapterIndex(plan.index, 0) <= batchEndIndex)
    .sort((left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0));
  const sourcePlans = sortedPlans.length >= expectedCount ? sortedPlans : plans.slice(0, expectedCount);

  if (sourcePlans.length < expectedCount) {
    return [];
  }

  return sourcePlans.slice(0, expectedCount).map((plan, offset) => ({
    ...plan,
    index: batchStartIndex + offset,
    partIndex: part.index,
    title: normalizeWritingChapterPlanTitle(plan.title),
    summary: normalizeWritingChapterPlanSummary(plan.summary)
  }));
}

function mergeWritingChapterPlanBatch(book, plans) {
  const existingChapters = getWritingChapters(book);
  const existingByTitle = new Map(
    existingChapters.map((chapter) => [normalizeWritingChapterTitleForMatch(chapter.title), chapter]).filter(([title]) => Boolean(title))
  );
  const existingByIndex = new Map(existingChapters.map((chapter) => [normalizeWritingChapterIndex(chapter.index, 0), chapter]));
  const planIndexes = new Set(plans.map((plan) => normalizeWritingChapterIndex(plan.index, 0)));
  const retainedChapters = existingChapters.filter((chapter) => !planIndexes.has(normalizeWritingChapterIndex(chapter.index, 0)));
  const batchChapters = plans.map((plan, index) => {
    const titleKey = normalizeWritingChapterTitleForMatch(plan.title);
    const indexMatchedChapter = existingByIndex.get(normalizeWritingChapterIndex(plan.index, index)) ?? null;
    const existingChapter =
      existingByTitle.get(titleKey) ?? (indexMatchedChapter && !String(indexMatchedChapter.content ?? "").trim() ? indexMatchedChapter : null);
    return buildWritingChapterFromPlan(plan, existingChapter, normalizeWritingChapterIndex(plan.index, index) - 1);
  });

  book.chapters = [...retainedChapters, ...batchChapters].sort(
    (left, right) => normalizeWritingChapterIndex(left.index, 0) - normalizeWritingChapterIndex(right.index, 0)
  );
}

function countWritingGeneratedTargetChapters(book, request) {
  return getWritingChapters(book).filter((chapter) => {
    const index = normalizeWritingChapterIndex(chapter.index, 0);
    return index >= 1 && index <= request.targetChapterCount;
  }).length;
}

function getWritingMasterSystemPrompt() {
  return (
    writingPromptAssets.masterSystem ||
    [
      `你是「${WRITING_APP_NAME}」里的大师级小说总编、故事架构师和文字教练。`,
      "输出必须可直接放进写作项目，不写寒暄，不解释你在做什么。"
    ].join("\n")
  );
}

async function invokeWritingAssistantModel(prompt, maxOutputTokens, temperature = 0.72, options = {}) {
  const maxRetries = Math.max(0, Number(options.maxRetries ?? 0) || 0);
  let retryAttempt = 0;

  while (retryAttempt <= maxRetries) {
    if (ui.marketplace.writing.outlinePlannerCancelRequested) {
      throw createWritingAbortError();
    }

    const requestId = createLocalId("writing_model_request");
    activeWritingModelRequestId = requestId;

    try {
      return await desktopApi.invokeModelText({
        requestId,
        temperature,
        maxOutputTokens,
        messages: [
          {
            role: "system",
            content: getWritingMasterSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });
    } catch (error) {
      if (retryAttempt >= maxRetries || !isRetryableWritingAssistantError(error)) {
        throw error;
      }

      retryAttempt += 1;
      const delayMs = getWritingRetryDelayMs(retryAttempt);

      if (typeof options.onRetry === "function") {
        await options.onRetry({
          error,
          retryAttempt,
          maxRetries,
          delayMs
        });
      }

      await waitWritingRetryDelay(delayMs);
    } finally {
      if (activeWritingModelRequestId === requestId) {
        activeWritingModelRequestId = "";
      }
    }
  }

  throw new Error("模型调用重试失败");
}

async function generateWritingLongOutlinePlan(book, request, options = {}) {
  if (!book || !desktopApi?.invokeModelText) {
    setWritingFeedback("AI 桥接未就绪。", "danger");
    return;
  }

  const existingJob = book.outlinePlannerJob ?? null;
  const shouldResume =
    Boolean(options.resume) ||
    (canResumeWritingOutlinePlanner(book, existingJob) && isSameWritingLongOutlineRequest(request, getWritingLongOutlineRequestFromJob(existingJob)));
  const job = shouldResume && existingJob
    ? {
        ...existingJob,
        status: "running",
        instruction: request.instruction,
        targetPartCount: request.targetPartCount,
        partType: request.partType,
        minChaptersPerPart: request.minChaptersPerPart,
        maxChaptersPerPart: request.maxChaptersPerPart,
        chaptersPerPart: request.chaptersPerPart,
        batchSize: request.batchSize,
        targetChapterCount: request.targetChapterCount,
        generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
        lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
        retryAttempt: 0,
        maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
        lastError: "",
        error: ""
      }
    : createWritingOutlinePlannerJob(request, book);
  const partLabel = request.partType === "volume" ? "卷" : "幕";

  try {
    ui.marketplace.writing.isAiRunning = true;
    ui.marketplace.writing.aiRunningBookId = book.id;
    ui.marketplace.writing.outlinePlannerCancelRequested = false;
    ui.marketplace.writing.aiOutput = "";
    book.outlinePlannerJob = job;
    setWritingAiTaskPickerOpen(false);
    setWritingFeedback(
      shouldResume
        ? `继续长篇分批规划：已落盘 ${job.generatedChapterCount}/${request.targetChapterCount} 章。`
        : `长篇分批规划启动：${request.targetPartCount} ${partLabel} / ${request.targetChapterCount} 章。`,
      "neutral"
    );
    setStatus(
      shouldResume
        ? `${WRITING_APP_NAME}正在继续分批规划长篇目录。`
        : `${WRITING_APP_NAME}正在后台分批规划长篇目录。`,
      "neutral"
    );
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });

    const shouldGenerateMasterPlan = !shouldResume || getWritingBookParts(book).length < request.targetPartCount;

    if (shouldGenerateMasterPlan) {
      const masterResult = await invokeWritingAssistantModel(
        buildWritingLongOutlineMasterPrompt(book, request),
        WRITING_LONG_OUTLINE_MASTER_MAX_TOKENS,
        0.66,
        {
          maxRetries: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
          onRetry: async ({ error, retryAttempt, maxRetries }) => {
            const message = getWritingErrorMessage(error);
            updateWritingOutlinePlannerJob(book, {
              status: "running",
              retryAttempt,
              maxRetryAttempts: maxRetries,
              lastRetryAt: new Date().toISOString(),
              lastError: message,
              error: ""
            });
            setWritingFeedback(`总体规划请求失败，正在第 ${retryAttempt}/${maxRetries} 次重试。`, "warning");
            ui.marketplace.writing.aiOutput = [
              `【长篇分批规划重试】总体规划 ${retryAttempt}/${maxRetries}`,
              "",
              message
            ].join("\n");
            touchWritingBook(book, { persist: false });
            await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
          }
        }
      );
      const masterPlan = parseWritingChapterJsonPayload(masterResult?.text ?? "", { allowPartsOnly: true });
      const plannedParts = masterPlan.parts.length
        ? masterPlan.parts.slice(0, request.targetPartCount)
        : Array.from({ length: request.targetPartCount }, (_, index) => ({
            id: createLocalId("writing_part"),
            type: request.partType,
            index: index + 1,
            title: `未命名${partLabel} ${index + 1}`,
            description: "待补充本幕/卷的整体故事设计、关键矛盾、阶段高潮和转折作用。"
          }));

      book.parts = plannedParts.map((part, index) =>
        normalizeWritingBookPart({ ...part, type: part.type ?? request.partType, index: part.index ?? index + 1 }, index, book.id)
      );
      ui.marketplace.writing.aiOutput = [`【总体规划已生成】`, buildWritingPartsContext(book)].join("\n\n");
    } else {
      ensureWritingLongOutlineParts(book, request);
      ui.marketplace.writing.aiOutput = [
        `【继续长篇分批规划】`,
        `已落盘 ${countWritingGeneratedTargetChapters(book, request)}/${request.targetChapterCount} 章`,
        "",
        buildWritingPartsContext(book)
      ].join("\n\n");
    }

    ensureWritingLongOutlineParts(book, request);
    updateWritingOutlinePlannerJob(book, {
      retryAttempt: 0,
      maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
      lastError: "",
      error: "",
      generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
      lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request)
    });
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });

    for (let partIndex = 1; partIndex <= request.targetPartCount; partIndex += 1) {
      const part = getWritingBookParts(book).find((entry) => entry.index === partIndex) ?? normalizeWritingBookPart(null, partIndex - 1, book.id);
      const partStartIndex = (partIndex - 1) * request.chaptersPerPart + 1;
      const partEndIndex = partIndex * request.chaptersPerPart;
      let batchStartIndex = getNextMissingWritingChapterIndex(book, partStartIndex, partEndIndex);

      while (batchStartIndex && batchStartIndex <= partEndIndex) {
        if (ui.marketplace.writing.outlinePlannerCancelRequested) {
          updateWritingOutlinePlannerJob(book, {
            status: "cancelled",
            generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
            lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
            retryAttempt: 0
          });
          setWritingFeedback("长篇分批规划已停止。", "warning");
          setStatus(`${WRITING_APP_NAME}分批规划已停止。`, "warning");
          touchWritingBook(book, { persist: false });
          await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
          return;
        }

        const batchEndIndex = Math.min(partEndIndex, batchStartIndex + request.batchSize - 1);
        updateWritingOutlinePlannerJob(book, {
          status: "running",
          currentPartIndex: partIndex,
          currentBatchStartIndex: batchStartIndex,
          currentBatchEndIndex: batchEndIndex,
          generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
          retryAttempt: 0,
          maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
          lastError: "",
          error: ""
        });
        setWritingFeedback(`正在规划第 ${partIndex} ${partLabel}：第 ${batchStartIndex}-${batchEndIndex} 章。`, "neutral");
        ui.marketplace.writing.aiOutput = [
          `【长篇分批规划进度】${book.outlinePlannerJob.generatedChapterCount}/${request.targetChapterCount} 章已落盘`,
          `当前请求：第 ${partIndex} ${partLabel}，第 ${batchStartIndex}-${batchEndIndex} 章`,
          "",
          "当前批次正在生成中，批次完成后会写入 chapters.json。"
        ].join("\n");
        touchWritingBook(book, { persist: false });
        await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });

        const batchResult = await invokeWritingAssistantModel(
          buildWritingLongOutlineBatchPrompt(book, request, part, batchStartIndex, batchEndIndex),
          WRITING_LONG_OUTLINE_BATCH_MAX_TOKENS,
          0.7,
          {
            maxRetries: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
            onRetry: async ({ error, retryAttempt, maxRetries }) => {
              const message = getWritingErrorMessage(error);
              updateWritingOutlinePlannerJob(book, {
                status: "running",
                currentPartIndex: partIndex,
                currentBatchStartIndex: batchStartIndex,
                currentBatchEndIndex: batchEndIndex,
                generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
                lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
                retryAttempt,
                maxRetryAttempts: maxRetries,
                lastRetryAt: new Date().toISOString(),
                lastError: message,
                error: ""
              });
              setWritingFeedback(`第 ${batchStartIndex}-${batchEndIndex} 章请求失败，正在第 ${retryAttempt}/${maxRetries} 次重试。`, "warning");
              ui.marketplace.writing.aiOutput = [
                `【长篇分批规划重试】第 ${batchStartIndex}-${batchEndIndex} 章`,
                `重试：${retryAttempt}/${maxRetries}`,
                `本地已落盘：${book.outlinePlannerJob.generatedChapterCount}/${request.targetChapterCount} 章`,
                "",
                message
              ].join("\n");
              touchWritingBook(book, { persist: false });
              await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
            }
          }
        );
        const batchPlan = parseWritingChaptersFromAssistantOutput(batchResult?.text ?? "");
        const normalizedPlans = normalizeWritingLongBatchPlans(batchPlan.chapters, part, batchStartIndex, batchEndIndex);

        if (!normalizedPlans.length) {
          throw new Error(`第 ${batchStartIndex}-${batchEndIndex} 章没有返回完整 chapters JSON`);
        }

        mergeWritingChapterPlanBatch(book, normalizedPlans);
        const generatedChapterCount = countWritingGeneratedTargetChapters(book, request);
        updateWritingOutlinePlannerJob(book, {
          generatedChapterCount,
          lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
          retryAttempt: 0,
          maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
          lastError: "",
          error: ""
        });
        ui.marketplace.writing.aiOutput = [
          `【长篇分批规划进度】${generatedChapterCount}/${request.targetChapterCount} 章`,
          `当前完成：第 ${partIndex} ${partLabel}，第 ${batchStartIndex}-${batchEndIndex} 章`,
          "",
          batchResult?.text ?? ""
        ].join("\n");
        touchWritingBook(book, { persist: false });
        await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
        batchStartIndex = getNextMissingWritingChapterIndex(book, partStartIndex, partEndIndex);
      }
    }

    updateWritingOutlinePlannerJob(book, {
      status: "completed",
      generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
      lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
      currentPartIndex: request.targetPartCount,
      currentBatchStartIndex: request.targetChapterCount,
      currentBatchEndIndex: request.targetChapterCount,
      retryAttempt: 0,
      maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
      lastError: "",
      error: ""
    });
    if (activeWritingBook.value?.id === book.id) {
      selectWritingChapter(getWritingChapters(book)[0]?.id ?? "");
    }
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true });
    setWritingFeedback(`长篇目录规划完成：${request.targetChapterCount} 章已写入本地。`, "success");
    setStatus(`${WRITING_APP_NAME}长篇目录已分批写入本地。`, "success");
  } catch (error) {
    console.error("Failed to generate long writing outline", error);
    const message = error instanceof Error ? error.message : "未知错误";
    const isCancelled = ui.marketplace.writing.outlinePlannerCancelRequested || isWritingAssistantAbortError(error);
    updateWritingOutlinePlannerJob(book, {
      status: isCancelled ? "cancelled" : "failed",
      generatedChapterCount: countWritingGeneratedTargetChapters(book, request),
      lastCompletedChapterIndex: getLastCompletedWritingChapterIndex(book, request),
      retryAttempt: 0,
      maxRetryAttempts: WRITING_MODEL_MAX_RETRY_ATTEMPTS,
      lastError: isCancelled ? "" : message,
      ...(isCancelled ? { error: "" } : { error: message })
    });
    touchWritingBook(book, { persist: false });
    await persistWritingBookById(book.id, { silent: true, keepLocal: true, mergeChapters: true }).catch(() => {});
    if (isCancelled) {
      setWritingFeedback("长篇分批规划已停止。", "warning");
      setStatus(`${WRITING_APP_NAME}分批规划已停止。`, "warning");
    } else {
      setWritingFeedback(`分批规划失败：${message}`, "danger");
      setStatus(`${WRITING_APP_NAME}分批规划失败：${message}`, "danger");
    }
  } finally {
    ui.marketplace.writing.isAiRunning = false;
    ui.marketplace.writing.aiRunningBookId = "";
    ui.marketplace.writing.outlinePlannerCancelRequested = false;
  }
}

async function generateWritingAssistantOutput() {
  const book = activeWritingBook.value;

  if (ui.marketplace.writing.isAiRunning) {
    return;
  }

  if (!book || !desktopApi?.invokeModelText) {
    setWritingFeedback("AI 桥接未就绪。", "danger");
    return;
  }

  const longOutlineRequest = activeWritingLongOutlineRequest.value;
  const resumeRequest = getWritingLongOutlineRequestFromJob(book.outlinePlannerJob);

  if (
    canResumeWritingOutlinePlanner(book, book.outlinePlannerJob) &&
    resumeRequest &&
    (!longOutlineRequest || isSameWritingLongOutlineRequest(longOutlineRequest, resumeRequest))
  ) {
    await generateWritingLongOutlinePlan(book, resumeRequest, { resume: true });
    return;
  }

  if (longOutlineRequest) {
    await generateWritingLongOutlinePlan(book, longOutlineRequest);
    return;
  }

  const prompt = activeWritingPromptPreview.value;

  try {
    ui.marketplace.writing.isAiRunning = true;
    ui.marketplace.writing.aiRunningBookId = book.id;
    ui.marketplace.writing.aiOutput = "";
    setWritingAiTaskPickerOpen(false);
    setWritingFeedback("正在召唤主编和故事架构师...", "neutral");
    setStatus(`${WRITING_APP_NAME}正在后台生成建议。`, "neutral");

    const result = await invokeWritingAssistantModel(
      prompt,
      getWritingAssistantMaxOutputTokens(ui.marketplace.writing.activeTab, activeWritingTask.value?.id),
      0.72
    );

    ui.marketplace.writing.aiOutput =
      ui.marketplace.writing.activeTab === "chapter"
        ? normalizeWritingChapterDraftOutput(result?.text ?? "")
        : String(result?.text ?? "").trim();
    setWritingFeedback(result?.profileLabel ? `已由 ${result.profileLabel} 生成。` : "AI 已生成建议。", "success");
    setStatus(`${WRITING_APP_NAME}已生成建议。`, "success");
  } catch (error) {
    console.error("Failed to generate writing assistant output", error);
    const message = error instanceof Error ? error.message : "未知错误";
    setWritingFeedback(`生成失败：${message}`, "danger");
    setStatus(`${WRITING_APP_NAME}生成失败：${message}`, "danger");
  } finally {
    ui.marketplace.writing.isAiRunning = false;
    ui.marketplace.writing.aiRunningBookId = "";
  }
}

async function resumeWritingOutlinePlanningJob() {
  const book = activeWritingBook.value;
  const request = getWritingLongOutlineRequestFromJob(book?.outlinePlannerJob);

  if (!book || !request || ui.marketplace.writing.isAiRunning) {
    return;
  }

  await generateWritingLongOutlinePlan(book, request, { resume: true });
}

function normalizeWritingChapterTitleForMatch(value) {
  return splitWritingChapterTitlePrefix(value)
    .title
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeWritingChapterPlanTitle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function normalizeWritingChapterPlanSummary(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, entryValue]) => `${key}：${String(entryValue ?? "").trim()}`)
      .filter((line) => !line.endsWith("："))
      .join("\n");
  }

  return String(value ?? "").trim();
}

function normalizeWritingChapterPlanEntry(entry, fallbackIndex = 0) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const rawTitle = normalizeWritingChapterPlanTitle(
    entry.title ?? entry.name ?? entry.chapterTitle ?? entry.chapter ?? entry.标题 ?? entry.章节标题
  );
  const titleParts = splitWritingChapterTitlePrefix(rawTitle);
  const chapterIndex = normalizeWritingChapterIndex(
    entry.index ?? entry.order ?? entry.chapterIndex ?? entry.chapterNo ?? entry.序号 ?? entry.章节序号 ?? titleParts.index,
    fallbackIndex
  );
  const partIndex =
    parseWritingChapterIndex(
      entry.partIndex ?? entry.part_index ?? entry.volumeIndex ?? entry.actIndex ?? entry.幕序号 ?? entry.卷序号 ?? entry.所属幕 ?? entry.所属卷
    ) ?? null;
  const title = titleParts.title;
  const summary = normalizeWritingChapterPlanSummary(
    entry.summary ??
      entry.brief ??
      entry.description ??
      entry.synopsis ??
      entry.goal ??
      entry.简介 ??
      entry.摘要 ??
      entry.梗概 ??
      entry.章节简介 ??
      entry.本章目标
  );

  if (!title) {
    return null;
  }

  return {
    index: chapterIndex,
    ...(partIndex ? { partIndex } : {}),
    title,
    summary: summary || "待补充章节目标、主要冲突、信息增量、伏笔/回收和结尾钩子。"
  };
}

function normalizeWritingPartPlanEntry(entry, fallbackIndex = 0) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const rawTitle = normalizeWritingChapterPlanTitle(entry.title ?? entry.name ?? entry.partTitle ?? entry.volumeTitle ?? entry.标题 ?? entry.卷名 ?? entry.幕名);
  const titleParts = splitWritingBookPartTitlePrefix(rawTitle);
  const partIndex = normalizeWritingChapterIndex(entry.index ?? entry.order ?? entry.partIndex ?? entry.序号 ?? titleParts.index, fallbackIndex);
  const partType = normalizeWritingBookPartTypeForUi(entry.type ?? entry.partType ?? entry.kind ?? titleParts.type);
  const title = titleParts.title || rawTitle;
  const description = normalizeWritingChapterPlanSummary(
    entry.description ?? entry.summary ?? entry.brief ?? entry.synopsis ?? entry.goal ?? entry.描述 ?? entry.简介 ?? entry.概述
  );

  if (!title) {
    return null;
  }

  return {
    id: createLocalId("writing_part"),
    type: partType,
    index: partIndex,
    title,
    description: description || "待补充本幕/卷的整体故事设计、关键矛盾、阶段高潮和转折作用。"
  };
}

function parseWritingChapterJsonPayload(value, options = {}) {
  const text = String(value ?? "").trim();
  const candidates = [];
  const fencedBlocks = Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)).map((match) => match[1]?.trim()).filter(Boolean);

  candidates.push(...fencedBlocks);

  const firstObjectIndex = text.indexOf("{");
  const lastObjectIndex = text.lastIndexOf("}");
  if (firstObjectIndex >= 0 && lastObjectIndex > firstObjectIndex) {
    candidates.push(text.slice(firstObjectIndex, lastObjectIndex + 1));
  }

  const firstArrayIndex = text.indexOf("[");
  const lastArrayIndex = text.lastIndexOf("]");
  if (firstArrayIndex >= 0 && lastArrayIndex > firstArrayIndex) {
    candidates.push(text.slice(firstArrayIndex, lastArrayIndex + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const chapters = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.chapters) ? parsed.chapters : [];
      const parts = Array.isArray(parsed?.parts)
        ? parsed.parts
        : Array.isArray(parsed?.volumes)
          ? parsed.volumes.map((part) => ({ ...part, type: part?.type ?? "volume" }))
          : Array.isArray(parsed?.acts)
            ? parsed.acts.map((part) => ({ ...part, type: part?.type ?? "act" }))
            : [];
      const normalizedParts = parts.map((entry, index) => normalizeWritingPartPlanEntry(entry, index)).filter(Boolean);
      const normalizedChapters = [];
      let currentPartIndex = normalizedParts.at(-1)?.index ?? null;

      chapters.forEach((entry, index) => {
        const rawTitle = normalizeWritingChapterPlanTitle(
          entry?.title ?? entry?.name ?? entry?.chapterTitle ?? entry?.chapter ?? entry?.标题 ?? entry?.章节标题
        );
        const partTitleParts = splitWritingBookPartTitlePrefix(rawTitle);

        if (partTitleParts.index && partTitleParts.type) {
          const partPlan = normalizeWritingPartPlanEntry(
            {
              ...entry,
              index: partTitleParts.index,
              type: partTitleParts.type,
              title: partTitleParts.title,
              description: entry?.description ?? entry?.summary
            },
            normalizedParts.length
          );

          if (partPlan) {
            normalizedParts.push(partPlan);
            currentPartIndex = partPlan.index;
          }

          return;
        }

        const chapterPlan = normalizeWritingChapterPlanEntry(entry, normalizedChapters.length || index);

        if (chapterPlan) {
          if (currentPartIndex && !chapterPlan.partIndex) {
            chapterPlan.partIndex = currentPartIndex;
          }

          normalizedChapters.push(chapterPlan);
        }
      });

      if (normalizedChapters.length || (options.allowPartsOnly && normalizedParts.length)) {
        return { parts: normalizedParts, chapters: normalizedChapters };
      }
    } catch {
      // Continue with markdown fallback.
    }
  }

  return { parts: [], chapters: [] };
}

function splitWritingChapterTitleAndSummary(value, fallbackIndex = 0) {
  const text = normalizeWritingChapterPlanTitle(value);
  const titleParts = splitWritingChapterTitlePrefix(text);
  const chapterIndex = normalizeWritingChapterIndex(titleParts.index, fallbackIndex);
  const titleText = titleParts.title || text;
  const separatorIndex = titleText.search(/[：:]/);

  if (separatorIndex > 0) {
    const title = normalizeWritingChapterPlanTitle(titleText.slice(0, separatorIndex));
    const summary = titleText.slice(separatorIndex + 1).trim();
    return { index: chapterIndex, title, summary };
  }

  return { index: chapterIndex, title: titleText, summary: "" };
}

function parseWritingChapterMarkdownPayload(value) {
  const parts = [];
  const chapters = [];
  let current = null;
  let currentPart = null;

  String(value ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((rawLine) => {
      const line = rawLine.replace(/^>\s*/, "").replace(/^#{1,6}\s*/, "").replace(/^\s*[-*+]\s*/, "").trim();
      const partMatch = line.match(/^(?:\*\*)?\s*(?:第\s*)?([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*(幕|卷)\s*[：:.\-、·]?\s*(.+?)(?:\*\*)?$/i);

      if (partMatch?.[3]) {
        const partType = partMatch[2] === "卷" ? "volume" : "act";
        const partIndex = normalizeWritingChapterIndex(partMatch[1], parts.length);
        currentPart = {
          id: createLocalId("writing_part"),
          type: partType,
          index: partIndex,
          title: normalizeWritingChapterPlanTitle(partMatch[3]),
          description: ""
        };
        parts.push(currentPart);
        current = null;
        return;
      }

      const titleMatch = line.match(
        /^(?:\*\*)?\s*(?:第\s*([0-9０-９一二三四五六七八九十百千万零〇两]+)\s*章|chapter\s*(\d+)|(\d+)[.、])\s*[：:.\-、]?\s*(.+?)(?:\*\*)?$/i
      );

      if (titleMatch?.[4]) {
        const chapterIndex = titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? chapters.length + 1;
        const titleLine = `第${chapterIndex}章 ${titleMatch[4]}`;
        const { index, title, summary } = splitWritingChapterTitleAndSummary(titleLine, chapters.length);

        if (title) {
          current = { index, ...(currentPart?.index ? { partIndex: currentPart.index } : {}), title, summary };
          chapters.push(current);
        }

        return;
      }

      if (!current) {
        if (currentPart) {
          const descriptionMatch = line.match(/^(?:简介|描述|概述|本幕目标|本卷目标|目标|主要冲突|阶段高潮|转折作用)\s*[：:]\s*(.+)$/);
          const descriptionText = descriptionMatch?.[1]?.trim() || line;

          if (descriptionText && !/^```/.test(descriptionText)) {
            currentPart.description = [currentPart.description, descriptionText].filter(Boolean).join("\n");
          }
        }

        return;
      }

      const summaryMatch = line.match(/^(?:简介|摘要|梗概|章节简介|本章目标|目标|主要冲突|信息增量|伏笔|结尾钩子)\s*[：:]\s*(.+)$/);
      const summaryText = summaryMatch?.[1]?.trim() || line;

      if (summaryText && !/^```/.test(summaryText)) {
        current.summary = [current.summary, summaryText].filter(Boolean).join("\n");
      }
    });

  const normalizedParts = parts
    .map((part, index) => normalizeWritingBookPart(part, index, "writing_book"))
    .filter((part) => part.title);
  const normalizedChapters = chapters
    .map((chapter, index) => ({
      index: normalizeWritingChapterIndex(chapter.index, index),
      ...(chapter.partIndex ? { partIndex: normalizeWritingChapterIndex(chapter.partIndex, 0) } : {}),
      title: normalizeWritingChapterPlanTitle(chapter.title),
      summary: normalizeWritingChapterPlanSummary(chapter.summary)
    }))
    .filter((chapter) => chapter.title);

  return { parts: normalizedParts, chapters: normalizedChapters };
}

function parseWritingChaptersFromAssistantOutput(value) {
  const jsonPlan = parseWritingChapterJsonPayload(value);
  return jsonPlan.chapters.length ? jsonPlan : parseWritingChapterMarkdownPayload(value);
}

function buildWritingChapterFromPlan(plan, existingChapter = null, fallbackIndex = 0) {
  const now = new Date().toISOString();
  const chapterIndex = normalizeWritingChapterIndex(plan.index ?? existingChapter?.index, fallbackIndex);
  const title = splitWritingChapterTitlePrefix(plan.title).title || `未命名章节 ${chapterIndex}`;

  return {
    id: existingChapter?.id ?? createLocalId("writing_chapter"),
    index: chapterIndex,
    ...(plan.partIndex ? { partIndex: normalizeWritingChapterIndex(plan.partIndex, 0) } : existingChapter?.partIndex ? { partIndex: existingChapter.partIndex } : {}),
    title,
    summary: plan.summary,
    content: existingChapter?.content ?? "",
    status: existingChapter?.status ?? "todo",
    updatedAt: now,
    ...(existingChapter?.fileName ? { fileName: existingChapter.fileName } : {})
  };
}

async function applyWritingChapterPlanOutput(book, output, mode = "append") {
  const outlinePlan = parseWritingChaptersFromAssistantOutput(output);
  const plans = outlinePlan.chapters;
  const currentTaskId = activeWritingTask.value?.id ?? "";

  if (!plans.length) {
    if (currentTaskId === "structure") {
      setWritingFeedback("未识别到可落盘的章节 JSON，请重新生成或让 AI 按提示词输出 chapters。", "warning");
      return true;
    }

    return false;
  }

  const existingChapters = getWritingChapters(book);
  const existingByTitle = new Map(
    existingChapters.map((chapter) => [normalizeWritingChapterTitleForMatch(chapter.title), chapter]).filter(([title]) => Boolean(title))
  );
  const existingTitleKeys = new Set(existingByTitle.keys());
  const nextChapters =
    mode === "replace"
      ? plans.map((plan, index) => buildWritingChapterFromPlan(plan, existingByTitle.get(normalizeWritingChapterTitleForMatch(plan.title)) ?? null, index))
      : [
          ...existingChapters,
          ...plans
            .filter((plan) => !existingTitleKeys.has(normalizeWritingChapterTitleForMatch(plan.title)))
            .map((plan, index) => buildWritingChapterFromPlan(plan, null, existingChapters.length + index))
        ];

  if (mode === "append" && nextChapters.length === existingChapters.length) {
    setWritingFeedback("生成目录里的章节已存在，没有新增章节。", "warning");
    return true;
  }

  const existingParts = getWritingBookParts(book);
  const existingPartsByIndex = new Map(existingParts.map((part) => [part.index, part]));

  if (mode === "replace") {
    book.parts = outlinePlan.parts.map((part, index) => ({
      ...normalizeWritingBookPart(part, index, book.id),
      id: existingPartsByIndex.get(part.index)?.id ?? part.id
    }));
  } else if (outlinePlan.parts.length) {
    const existingPartIndexes = new Set(existingParts.map((part) => part.index));
    book.parts = [
      ...existingParts,
      ...outlinePlan.parts
        .filter((part) => !existingPartIndexes.has(part.index))
        .map((part, index) => normalizeWritingBookPart(part, existingParts.length + index, book.id))
    ].sort((left, right) => left.index - right.index);
  }

  book.chapters = nextChapters;
  selectWritingChapter(nextChapters[0]?.id ?? "");
  touchWritingBook(book, { persist: false });
  await persistWritingBookById(book.id, { silent: true });
  setWritingFeedback(mode === "replace" ? `已替换为 ${plans.length} 个章节，并写入本地目录。` : `已追加 ${nextChapters.length - existingChapters.length} 个章节，并写入本地目录。`, "success");
  setStatus("书籍目录已写入本地 chapters.json。", "success");
  return true;
}

async function applyWritingAssistantOutput(mode = "append") {
  const book = activeWritingBook.value;
  const output =
    ui.marketplace.writing.activeTab === "chapter"
      ? normalizeWritingChapterDraftOutput(ui.marketplace.writing.aiOutput ?? "")
      : String(ui.marketplace.writing.aiOutput ?? "").trim();

  if (!output || !book) {
    setWritingFeedback("当前没有可写入的 AI 输出。", "warning");
    return;
  }

  if (ui.marketplace.writing.activeTab === "chapter") {
    if (activeWritingTask.value?.id === "review") {
      setWritingFeedback("章节质检结果仅用于审阅，不自动写入正文。", "warning");
      return;
    }

    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    const current = String(chapter?.content ?? "").trim();
    setWritingChapterContent(chapter, mode === "replace" ? output : [current, output].filter(Boolean).join("\n\n"));
  } else if (ui.marketplace.writing.activeTab === "outline") {
    if (await applyWritingChapterPlanOutput(book, output, mode)) {
      return;
    }

    const chapter = activeWritingChapter.value ?? ensureWritingChapterSelection(book);
    const current = String(chapter?.summary ?? "").trim();
    setWritingChapterSummary(chapter, mode === "replace" ? output : [current, output].filter(Boolean).join("\n\n"));
  } else {
    const targetKey = book.length === "short" ? "intro" : book.length === "long" ? "seriesPlan" : "outlineGuide";
    const current = getWritingIntroFieldValue(book, targetKey).trim();
    setWritingIntroField(book, targetKey, mode === "replace" ? output : [current, output].filter(Boolean).join("\n\n"));
  }

  setWritingFeedback(mode === "replace" ? "已用 AI 输出替换当前模块。" : "已把 AI 输出追加到当前模块。", "success");
}

const activeWeeklyRecord = computed(() =>
  workbench.weeklyProgress.find((record) => record.id === ui.weekly.activeRecordId) ?? null
);
const workflowLibraryCards = computed(() => [...workbench.workflowLibrary]);
const activeWorkflowCard = computed(
  () => workflowLibraryCards.value.find((entry) => entry.id === ui.workflow.activeCardId) ?? workflowLibraryCards.value[0] ?? null
);
const activeWorkflowRecords = computed(() => activeWorkflowCard.value?.records ?? []);
const activeWorkflowRecord = computed(
  () => activeWorkflowRecords.value.find((record) => record.id === ui.workflow.activeRecordId) ?? activeWorkflowRecords.value[0] ?? null
);
const activeWorkflowProtocol = computed(() => activeWorkflowRecord.value?.protocol ?? null);
const activeWorkflowSteps = computed(() => activeWorkflowRecord.value?.steps ?? []);
const activeWorkflowBodyStepOptions = computed(() =>
  activeWorkflowSteps.value
    .map((step, index) => {
      const bodySegment = findWorkflowCurlBodySegment(step?.curl ?? "");

      if (!bodySegment) {
        return null;
      }

      return {
        id: step.id,
        label: step.name || `请求 ${index + 1}`,
        method: step.method || extractCurlMethod(step.curl),
        body: bodySegment.value,
        step
      };
    })
    .filter(Boolean)
);
const activeWorkflowBodyStep = computed(
  () =>
    activeWorkflowBodyStepOptions.value.find((entry) => entry.id === ui.workflow.bodyStepId) ??
    activeWorkflowBodyStepOptions.value[0] ??
    null
);
const workflowBodyDraftChanged = computed(() => {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!activeBodyStep) {
    return false;
  }

  return normalizeWorkflowBodyDraftForCompare(ui.workflow.bodyDraftText) !== normalizeWorkflowBodyDraftForCompare(activeBodyStep.body);
});
const activeWorkflowEnvironments = computed(() => normalizeWorkflowEnvironments(activeWorkflowRecord.value));
const activeWorkflowEnvironment = computed(
  () =>
    activeWorkflowEnvironments.value.find((environment) => environment.id === activeWorkflowRecord.value?.activeEnvironmentId) ??
    activeWorkflowEnvironments.value.find((environment) => environment.id === "prod") ??
    activeWorkflowEnvironments.value[0] ??
    null
);
const activeWorkflowApiKeyInputType = computed(() => (ui.workflow.apiKeyVisible ? "text" : "password"));
const filteredWorkflowRecords = computed(() => {
  const query = String(ui.workflow.searchQuery ?? "").trim().toLowerCase();

  if (!query) {
    return activeWorkflowRecords.value;
  }

  return activeWorkflowRecords.value.filter((record) =>
    [
      record.name,
      record.summary,
      record.scenario,
      record.notes,
      record.tags?.join(" "),
      record.environments?.map((environment) => `${environment.label} ${environment.baseUrl}`).join(" "),
      record.steps?.map((step) => `${step.name} ${step.url} ${step.curl}`).join(" ")
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
});
const workflowDetailTitle = computed(() => {
  if (ui.workflow.view === "editor") {
    return ui.workflow.editingRecordId ? "编辑工作流" : "新建工作流";
  }

  if (ui.workflow.view === "run") {
    return activeWorkflowRecord.value?.name ?? "执行工作流";
  }

  return activeWorkflowCard.value?.title ?? "流程中心";
});
const workflowRunControlLabel = computed(() => {
  if (ui.workflow.isCancelling) {
    return "中断中";
  }

  return ui.workflow.isRunning ? "中断执行" : "执行工作流";
});
const workflowRunControlIcon = computed(() => {
  if (ui.workflow.isCancelling) {
    return "loading";
  }

  return ui.workflow.isRunning ? "stop" : "play";
});
const workflowRunStatusLabel = computed(() => {
  if (ui.workflow.isCancelling) {
    return "中断中";
  }

  if (!ui.workflow.runResult) {
    return "待执行";
  }

  if (ui.workflow.runResult.status === "cancelled") {
    return "已中断";
  }

  if (ui.workflow.isRunning) {
    return "执行中";
  }

  return ui.workflow.runResult.status === "success" ? "执行成功" : "执行失败";
});
const workflowRunStatusTone = computed(() => {
  if (ui.workflow.isCancelling) {
    return "is-cancelled";
  }

  if (!ui.workflow.runResult) {
    return "";
  }

  if (ui.workflow.runResult.status === "cancelled") {
    return "is-cancelled";
  }

  if (ui.workflow.isRunning) {
    return "is-warning";
  }

  return ui.workflow.runResult.status === "success" ? "is-success" : "is-danger";
});
const activeWorkflowMetrics = computed(() => ({
  recordCount: activeWorkflowCard.value?.records?.length ?? 0,
  stepCount: activeWorkflowRecord.value?.steps?.length ?? 0,
  environmentCount: activeWorkflowEnvironments.value.length,
  variableCount: activeWorkflowRecord.value?.sharedVariables?.length ?? 0,
  timeoutMs: getWorkflowTimeoutMs(activeWorkflowRecord.value?.protocol)
}));

const {
  activeCommandMessages,
  activeCommandSession,
  backToCommandList,
  beginNewCommandSession,
  commandAuthorizedServers,
  commandChatTitle,
  commandRunnableSkills,
  commandSelectedAgent,
  commandSettingsSummary,
  commandToolOptions,
  focusCommandInput,
  getCommandArtifactCallSecondary,
  getCommandArtifactCallTitle,
  getCommandArtifactInlineText,
  getCommandArtifactStepSecondary,
  getCommandArtifactSummary,
  handleAgentRunProgress,
  handleCommandAgentChange,
  handleCommandAttachmentSelect,
  handleCommandInputCompositionEnd,
  handleCommandInputCompositionStart,
  handleCommandInputEnterKeydown,
  handleCommandLoadMcpTools,
  handleCommandServerChange,
  handleCommandSessionDelete,
  handleCommandSubmit,
  normalizeCommandWorkshopConfig,
  normalizeCommandWorkshopSessions,
  openCommandSession,
  removeCommandAttachment,
  scrollCommandToBottom
} = createCommandWorkshopActions({
  activeFeature,
  commandWorkshopViewRef,
  desktopApi,
  enabledAgentProfiles,
  featureCommandWorkshopId: FEATURE_COMMAND_WORKSHOP,
  formatFailureKind,
  getAgentById,
  getAgentRunnableSkills,
  getAuthorizedMcpServersForAgent,
  getMcpServerById,
  getSkillById,
  nextTick,
  resolveBoundModelName,
  setStatus,
  showAlertDialog,
  showConfirmDialog,
  toPlainIpcData,
  ui,
  workbench
});

const runnerAgent = computed(() => getAgentById(ui.extensions.runner.agentId));
const runnerRunnableSkills = computed(() => getAgentRunnableSkills(ui.extensions.runner.agentId));
const runnerAuthorizedServers = computed(() => getAuthorizedMcpServersForAgent(ui.extensions.runner.agentId));
const runnerRecentLogs = computed(() => getRecentAgentRunLogs(ui.extensions.runner.agentId));
const runnerLatestResult = computed(() => ui.extensions.runner.result ?? runnerRecentLogs.value[0] ?? null);

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

function resetGordonDialog() {
  Object.assign(ui.dialog, createGordonDialogState());
}

function openGordonDialog(options = {}) {
  if (typeof ui.dialog.resolve === "function") {
    ui.dialog.resolve(false);
  }

  return new Promise((resolve) => {
    Object.assign(ui.dialog, {
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

    void nextTick(() => {
      if (ui.dialog.kind === "input" && gordonDialogInputRef.value instanceof HTMLInputElement) {
        gordonDialogInputRef.value.focus();
        gordonDialogInputRef.value.select();
      } else if (gordonDialogPrimaryRef.value instanceof HTMLElement) {
        gordonDialogPrimaryRef.value.focus();
      }
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
  const resolver = ui.dialog.resolve;
  const kind = ui.dialog.kind;
  const inputValue = ui.dialog.inputValue;
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
  if (ui.dialog.kind === "alert") {
    resolveGordonDialog(true);
  }
}

function handleGordonDialogKeydown(event) {
  if (!ui.dialog.open || event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  resolveGordonDialog(false);
}

function setStatus(text, tone = "neutral") {
  status.text = text;
  status.tone = tone;
}

function isWorkflowStepExpanded(stepId) {
  return ui.workflow.expandedStepIds.includes(stepId);
}

function toggleWorkflowStepExpanded(stepId) {
  if (isWorkflowStepExpanded(stepId)) {
    ui.workflow.expandedStepIds = ui.workflow.expandedStepIds.filter((id) => id !== stepId);
    return;
  }

  ui.workflow.expandedStepIds = [...ui.workflow.expandedStepIds, stepId];
}

function createLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function addWorkflowDraftStep() {
  ui.workflow.recordDraft.steps = [...(ui.workflow.recordDraft.steps ?? []), createWorkflowStepDraft()];
}

function removeWorkflowDraftStep(stepId) {
  const nextSteps = (ui.workflow.recordDraft.steps ?? []).filter((step) => step.id !== stepId);
  ui.workflow.recordDraft.steps = nextSteps.length ? nextSteps : [createWorkflowStepDraft()];
}

function addWorkflowStepOutput(step) {
  step.produces = [...(step.produces ?? []), createWorkflowOutputDraft()];
}

function removeWorkflowStepOutput(step, outputId) {
  step.produces = (step.produces ?? []).filter((output) => output.id !== outputId);
}

function addWorkflowDraftEnvironment() {
  const nextIndex = (ui.workflow.recordDraft.environments ?? []).length + 1;
  ui.workflow.recordDraft.environments = [
    ...(ui.workflow.recordDraft.environments ?? []),
    {
      id: createLocalId("env"),
      label: `ENV ${nextIndex}`,
      baseUrl: "",
      apiKey: ""
    }
  ];
}

function removeWorkflowDraftEnvironment(environmentId) {
  const nextEnvironments = (ui.workflow.recordDraft.environments ?? []).filter((environment) => environment.id !== environmentId);
  ui.workflow.recordDraft.environments = nextEnvironments.length ? nextEnvironments : createDefaultWorkflowEnvironments();

  if (!ui.workflow.recordDraft.environments.some((environment) => environment.id === ui.workflow.recordDraft.activeEnvironmentId)) {
    ui.workflow.recordDraft.activeEnvironmentId = ui.workflow.recordDraft.environments[0]?.id ?? "prod";
  }
}

function handleWorkflowRunProgress(payload) {
  if (!payload?.progressEventId || payload.progressEventId !== ui.workflow.activeProgressEventId) {
    return;
  }

  ui.workflow.runResult = toPlainIpcData(payload);

  if (["success", "failed", "cancelled"].includes(payload.status)) {
    ui.workflow.isCancelling = false;
  }
}

function setWorkflowBodyFeedback(text, tone = "neutral") {
  ui.workflow.bodyFeedbackText = String(text ?? "").trim();
  ui.workflow.bodyFeedbackTone = tone;
}

function syncWorkflowBodyDraftFromActiveStep({ force = false } = {}) {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!activeBodyStep) {
    ui.workflow.bodyStepId = null;
    ui.workflow.bodyDraftText = "";
    setWorkflowBodyFeedback("", "neutral");
    return;
  }

  if (!ui.workflow.bodyStepId || !activeWorkflowBodyStepOptions.value.some((entry) => entry.id === ui.workflow.bodyStepId)) {
    ui.workflow.bodyStepId = activeBodyStep.id;
  }

  if (!force && workflowBodyDraftChanged.value) {
    return;
  }

  ui.workflow.bodyDraftText = activeBodyStep.body;
  setWorkflowBodyFeedback("已读取模板里的请求 Body。", "neutral");
}

function handleWorkflowBodyStepSelect() {
  syncWorkflowBodyDraftFromActiveStep({ force: true });
}

function handleWorkflowBodyDraftInput() {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!activeBodyStep) {
    setWorkflowBodyFeedback("", "neutral");
    return;
  }

  setWorkflowBodyFeedback(
    workflowBodyDraftChanged.value ? "本次执行将使用当前 Body，不会自动写回模板。" : "当前 Body 与模板一致。",
    workflowBodyDraftChanged.value ? "warning" : "success"
  );
}

function repairWorkflowBodyDraft() {
  const result = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: true });
  ui.workflow.bodyDraftText = result.text;

  if (result.ok) {
    setWorkflowBodyFeedback("已修复并格式化为标准 JSON。", "success");
    return;
  }

  setWorkflowBodyFeedback(result.error, looksLikeWorkflowJsonBody(result.text) ? "warning" : "neutral");
}

function getWorkflowBodyTextForRun() {
  const result = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: false });

  if (!result.ok && looksLikeWorkflowJsonBody(result.text)) {
    throw new Error(result.error);
  }

  return result.text;
}

function applyWorkflowBodyDraftToRecord(record) {
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!record || !activeBodyStep || !workflowBodyDraftChanged.value) {
    return record;
  }

  const bodyText = getWorkflowBodyTextForRun();

  return {
    ...record,
    steps: (record.steps ?? []).map((step) => {
      if (step.id !== activeBodyStep.id) {
        return step;
      }

      const curl = replaceWorkflowCurlBody(step.curl, bodyText);

      return {
        ...step,
        method: extractCurlMethod(curl),
        url: extractCurlUrl(curl),
        curl
      };
    })
  };
}

function buildWorkflowRunRecord(record, progressEventId = "") {
  const runtimeRecord = applyWorkflowBodyDraftToRecord(record);
  const activeEnvironmentApiKey = String(activeWorkflowEnvironment.value?.apiKey ?? record?.apiKey ?? "").trim();

  return toPlainIpcData({
    ...runtimeRecord,
    progressEventId,
    activeEnvironmentId: activeWorkflowEnvironment.value?.id ?? record?.activeEnvironmentId,
    environments: activeWorkflowEnvironments.value,
    apiKey: activeEnvironmentApiKey
  });
}

async function persistActiveWorkflowRuntimeConfig(showStatus = false) {
  const card = activeWorkflowCard.value;
  const record = activeWorkflowRecord.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record) {
    return;
  }

  const now = new Date().toISOString();
  record.updatedAt = now;

  const nextCard = {
    ...card,
    updatedAt: now,
    records: (card.records ?? []).map((entry) => (entry.id === record.id ? { ...record } : entry))
  };

  try {
    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = record.id;

    if (showStatus) {
      setStatus("已保存工作流运行配置。", "success");
    }
  } catch (error) {
    console.error("Failed to persist workflow runtime config", error);
    setStatus(`保存运行配置失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function persistWorkflowBodyDraftToTemplate() {
  const card = activeWorkflowCard.value;
  const record = activeWorkflowRecord.value;
  const activeBodyStep = activeWorkflowBodyStep.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record || !activeBodyStep) {
    setStatus("工作流仓储未就绪，暂时无法写回 Body。", "danger");
    return;
  }

  const repairedBody = repairWorkflowBodyText(ui.workflow.bodyDraftText, { pretty: true });

  if (!repairedBody.ok && looksLikeWorkflowJsonBody(repairedBody.text)) {
    const message = repairedBody.error || "请求 Body 格式不正确";
    setWorkflowBodyFeedback(message, "warning");
    setStatus(message, "warning");
    return;
  }

  const now = new Date().toISOString();
  const nextRecord = {
    ...record,
    updatedAt: now,
    steps: (record.steps ?? []).map((step) => {
      if (step.id !== activeBodyStep.id) {
        return step;
      }

      const curl = replaceWorkflowCurlBody(step.curl, repairedBody.text);

      return {
        ...step,
        method: extractCurlMethod(curl),
        url: extractCurlUrl(curl),
        curl
      };
    })
  };
  const nextCard = {
    ...card,
    updatedAt: now,
    lastUsedAt: now,
    records: (card.records ?? []).map((entry) => (entry.id === record.id ? nextRecord : entry))
  };

  try {
    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = nextRecord.id;
    ui.workflow.bodyDraftText = repairedBody.text;
    setWorkflowBodyFeedback("已写回模板 curl。", "success");
    setStatus("已写回请求 Body 模板。", "success");
  } catch (error) {
    console.error("Failed to persist workflow body draft", error);
    setStatus(`写回请求 Body 失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function handleWorkflowApiKeyInput(event) {
  if (!activeWorkflowRecord.value || !(event.target instanceof HTMLInputElement)) {
    return;
  }

  const nextApiKey = event.target.value;
  const environments = normalizeWorkflowEnvironments(activeWorkflowRecord.value);
  const activeEnvironmentId =
    activeWorkflowEnvironment.value?.id ??
    activeWorkflowRecord.value.activeEnvironmentId ??
    environments.find((environment) => environment.id === "prod")?.id ??
    environments[0]?.id;

  activeWorkflowRecord.value.environments = environments.map((environment) =>
    environment.id === activeEnvironmentId ? { ...environment, apiKey: nextApiKey } : environment
  );

  if (activeEnvironmentId) {
    activeWorkflowRecord.value.activeEnvironmentId = activeEnvironmentId;
    activeWorkflowRecord.value.apiKey = nextApiKey;
  }
}

async function selectWorkflowEnvironment(environmentId) {
  if (!activeWorkflowRecord.value || activeWorkflowRecord.value.activeEnvironmentId === environmentId) {
    return;
  }

  activeWorkflowRecord.value.activeEnvironmentId = environmentId;
  activeWorkflowRecord.value.apiKey =
    normalizeWorkflowEnvironments(activeWorkflowRecord.value).find((environment) => environment.id === environmentId)?.apiKey ??
    activeWorkflowRecord.value.apiKey ??
    "";
  await persistActiveWorkflowRuntimeConfig();
}

function getFeatureCardClass(entry, index) {
  const classes = ["feature-card", "tilt-card", `feature-card-${entry.tier}`];

  if (entry.tier !== "flat") {
    classes.push(index % 2 === 1 ? "feature-card-align-right" : "feature-card-align-left");
  }

  if (entry.id === activeFeature.value) {
    classes.push("is-active");
  }

  return classes;
}

function resetTiltCard(card) {
  if (!(card instanceof HTMLElement)) {
    return;
  }

  card.style.setProperty("--rotate-x", "0deg");
  card.style.setProperty("--rotate-y", "0deg");
  card.style.setProperty("--lift", "0px");
}

function handleCardPointerMove(event) {
  const card = event.currentTarget;

  if (!(card instanceof HTMLElement)) {
    return;
  }

  const bounds = card.getBoundingClientRect();
  const offsetX = event.clientX - bounds.left;
  const offsetY = event.clientY - bounds.top;
  const rotateY = ((offsetX / bounds.width) - 0.5) * 10;
  const rotateX = (0.5 - (offsetY / bounds.height)) * 10;

  card.style.setProperty("--rotate-x", `${rotateX.toFixed(2)}deg`);
  card.style.setProperty("--rotate-y", `${rotateY.toFixed(2)}deg`);
  card.style.setProperty("--lift", "-4px");
}

function handleCardPointerLeave(event) {
  resetTiltCard(event.currentTarget);
}

function getExtensionInitials(value) {
  const compact = String(value ?? "").trim();

  if (!compact) {
    return "EX";
  }

  return compact
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.slice(0, 1).toUpperCase())
    .join("");
}

function isHomeSettingsFeature(featureId) {
  return featureId === FEATURE_MODEL_MANAGEMENT || featureId === FEATURE_EXTENSIONS_MANAGEMENT;
}

function closeHomeSettingsMenu() {
  if (homeSettingsMenuRef.value) {
    homeSettingsMenuRef.value.open = false;
  }
}

function resolveBoundModelName(modelProfileId) {
  if (!modelProfileId) {
    return "未绑定模型";
  }

  return workbench.modelSettings.profiles.find((profile) => profile.id === modelProfileId)?.displayName ?? "未绑定模型";
}

function resolveAgentName(agentId) {
  return getAgentById(agentId)?.name ?? "Gordon";
}

function getAgentById(agentId) {
  return workbench.agentProfiles.find((profile) => profile.id === agentId) ?? null;
}

function getSkillById(skillId) {
  return workbench.skillDefinitions.find((skill) => skill.id === skillId) ?? null;
}

function getMcpServerById(serverId) {
  return workbench.mcpServers.find((server) => server.id === serverId) ?? null;
}

function getAgentRunnableSkills(agentId) {
  const agent = getAgentById(agentId);

  if (!agent) {
    return [];
  }

  return workbench.skillDefinitions.filter((skill) => agent.allowedSkillIds.includes(skill.id) && skill.enabled);
}

function getAuthorizedMcpServersForAgent(agentId) {
  const agent = getAgentById(agentId);

  if (!agent) {
    return [];
  }

  return workbench.mcpServers.filter((server) => agent.allowedMcpServerIds.includes(server.id) && server.enabled);
}

function applyWorkbenchSnapshot(snapshot, modelSettings) {
  workbench.snapshot = snapshot;
  workbench.modelSettings = modelSettings;
  syncModelBalanceRuntimeFromProfiles(modelSettings?.profiles ?? []);
  workbench.weeklyProgress = [...(snapshot?.weeklyProgress ?? [])];
  workbench.workflowLibrary = [...(snapshot?.workflowLibrary ?? [])];
  applyWritingBooksFromStorage(snapshot?.writingBooks ?? []);
  applyComicProjectsFromStorage(snapshot?.comicProjects ?? []);
  workbench.skillDefinitions = [...(snapshot?.skillDefinitions ?? [])];
  workbench.mcpServers = [...(snapshot?.mcpServers ?? [])];
  workbench.agentProfiles = [...(snapshot?.agentProfiles ?? [])];
  workbench.agentRunLogs = [...(snapshot?.agentRunLogs ?? [])];
  workbench.commandSessions = normalizeCommandWorkshopSessions(snapshot?.commandWorkshopSessions ?? []);

  if (!ui.weekly.activeRecordId || !workbench.weeklyProgress.some((record) => record.id === ui.weekly.activeRecordId)) {
    ui.weekly.activeRecordId =
      workbench.weeklyProgress.find((record) => record.status === "active")?.id ?? workbench.weeklyProgress[0]?.id ?? null;
  }

  if (ui.weekly.view === "editor") {
    syncWeeklyEditorState();
  }

  syncWorkflowSelection();

  if (workbench.commandSessions.length) {
    const nextSession =
      workbench.commandSessions.find((session) => session.id === ui.command.activeSessionId) ?? workbench.commandSessions[0];

    ui.command.activeSessionId = nextSession?.id ?? null;
    ui.command.form = normalizeCommandWorkshopConfig(nextSession ?? ui.command.form);
  } else {
    ui.command.activeSessionId = null;
    ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);

    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP) {
      ui.command.view = "chat";
    }
  }
}

async function bootstrapWorkbench() {
  if (!desktopApi) {
    setStatus("桌面桥接未就绪，当前只显示静态壳层。", "warning");
    return;
  }

  try {
    const promptAssetsPromise = loadWritingPromptAssets(desktopApi).catch((error) => {
      console.warn("Failed to load writing prompt assets", error);
      return null;
    });
    const [snapshot, modelSettings, loadedWritingPromptAssets] = await Promise.all([
      desktopApi.bootstrap(),
      desktopApi.listModelSettings(),
      promptAssetsPromise
    ]);

    if (loadedWritingPromptAssets) {
      Object.assign(writingPromptAssets, loadedWritingPromptAssets);
    }

    applyWorkbenchSnapshot(snapshot, modelSettings);
    setStatus(loadedWritingPromptAssets ? "工作台已就绪。" : "工作台已就绪，写作提示词资产使用兜底配置。", loadedWritingPromptAssets ? "success" : "warning");
  } catch (error) {
    console.error("Failed to bootstrap workbench", error);
    setStatus(`工作台加载失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function refreshWorkbenchSnapshot() {
  if (!desktopApi) {
    return;
  }

  const [snapshot, modelSettings] = await Promise.all([desktopApi.bootstrap(), desktopApi.listModelSettings()]);
  applyWorkbenchSnapshot(snapshot, modelSettings);
}

function setActiveFeature(featureId) {
  activeFeature.value = featureId;
  closeHomeSettingsMenu();

  if (featureId === FEATURE_MODEL_MANAGEMENT) {
    ui.modelManagement.view = "list";
    ui.modelManagement.editor = createModelEditorState("openai");
  }

  if (featureId === FEATURE_TASKS) {
    closeWeeklyEditor();
  }

  if (featureId === FEATURE_MARKETPLACE && !ui.marketplace.view) {
    ui.marketplace.view = "apps";
  }

  if (featureId === FEATURE_WORKFLOW_LIBRARY) {
    ui.workflow.view = "library";
    syncWorkflowSelection();
  }

  if (featureId === FEATURE_COMMAND_WORKSHOP) {
    ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
    ui.command.view = workbench.commandSessions.length ? "list" : "chat";
    ui.command.composerView = "input";
  }

  if (featureId === FEATURE_EXTENSIONS_MANAGEMENT) {
    ui.extensions.view = "list";
    ui.extensions.editor = createExtensionEditorState("agent");
    ui.extensions.runner = createAgentRunnerState();
  }
}

function handleFeatureSelect(featureId) {
  setActiveFeature(featureId);
}

function syncWorkflowSelection() {
  if (!workbench.workflowLibrary.length) {
    ui.workflow.activeCardId = null;
    ui.workflow.activeRecordId = null;
    ui.workflow.copiedStepId = null;
    ui.workflow.expandedStepIds = [];
    return;
  }

  const nextCard =
    workbench.workflowLibrary.find((entry) => entry.id === ui.workflow.activeCardId) ?? workbench.workflowLibrary[0];
  ui.workflow.activeCardId = nextCard?.id ?? null;

  const nextRecord = nextCard?.records?.find((record) => record.id === ui.workflow.activeRecordId) ?? nextCard?.records?.[0] ?? null;
  ui.workflow.activeRecordId = nextRecord?.id ?? null;
  ui.workflow.copiedStepId = null;
  ui.workflow.expandedStepIds = [];
}

function openWorkflowCard(cardId) {
  activeFeature.value = FEATURE_WORKFLOW_LIBRARY;
  ui.workflow.view = "list";
  ui.workflow.activeCardId = cardId;
  const card = workbench.workflowLibrary.find((entry) => entry.id === cardId);
  ui.workflow.activeRecordId = card?.records?.[0]?.id ?? null;
  ui.workflow.copiedStepId = null;
  ui.workflow.searchQuery = "";
  ui.workflow.runResult = null;
  ui.workflow.expandedStepIds = [];
}

function handleWorkflowBack() {
  if (ui.workflow.view === "run" || ui.workflow.view === "editor") {
    ui.workflow.view = "list";
    ui.workflow.editingRecordId = null;
    ui.workflow.recordDraft = createWorkflowRecordDraft();
    return;
  }

  backToWorkflowLibrary();
}

function backToWorkflowLibrary() {
  ui.workflow.view = "library";
  ui.workflow.editingRecordId = null;
  ui.workflow.runResult = null;
  syncWorkflowSelection();
}

function openWorkflowRecord(recordId) {
  ui.workflow.activeRecordId = recordId;
  ui.workflow.copiedStepId = null;
  ui.workflow.apiKeyVisible = false;
  ui.workflow.runResult = null;
  ui.workflow.expandedStepIds = [];
  ui.workflow.view = "run";
}

function openWorkflowRecordEditor(record = null) {
  ui.workflow.editingRecordId = record?.id ?? null;
  ui.workflow.recordDraft = record ? createWorkflowRecordDraftFromRecord(record) : createWorkflowRecordDraft();
  ui.workflow.apiKeyVisible = false;
  ui.workflow.view = "editor";
}

async function saveWorkflowRecord() {
  const card = activeWorkflowCard.value;

  if (ui.workflow.isSavingRecord) {
    return;
  }

  if (!desktopApi?.upsertWorkflowLibraryItem || !card) {
    setStatus("工作流仓储未就绪，暂时无法保存 curl。", "danger");
    return;
  }

  try {
    ui.workflow.isSavingRecord = true;
    setStatus("正在保存工作流配置...", "neutral");
    const existingRecord = card.records?.find((record) => record.id === ui.workflow.editingRecordId) ?? null;
    const nextRecord = buildWorkflowRecordFromDraft(ui.workflow.recordDraft, existingRecord);
    const nextRecords = existingRecord
      ? (card.records ?? []).map((record) => (record.id === existingRecord.id ? nextRecord : record))
      : [nextRecord, ...(card.records ?? [])];
    const nextCard = {
      ...card,
      usageCount: Number(card.usageCount ?? 0) + (existingRecord ? 0 : 1),
      updatedAt: nextRecord.updatedAt,
      lastUsedAt: nextRecord.updatedAt,
      records: nextRecords
    };

    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = nextRecord.id;
    ui.workflow.copiedStepId = null;
    ui.workflow.editingRecordId = null;
    ui.workflow.recordDraft = createWorkflowRecordDraft();
    ui.workflow.view = "run";
    setStatus(`已保存「${nextRecord.name}」工作流。`, "success");
  } catch (error) {
    console.error("Failed to save workflow record", error);
    const message = error instanceof Error ? error.message : "未知错误";
    setStatus(`保存工作流失败：${message}`, "danger");
    void showAlertDialog({
      tone: "danger",
      title: "保存工作流失败",
      message,
      confirmText: "知道了"
    });
  } finally {
    ui.workflow.isSavingRecord = false;
  }
}

function createWorkflowDuplicateRecordName(name, records = []) {
  const baseName = String(name ?? "").trim() || "未命名工作流";
  const copyBaseName = `${baseName.replace(/\s+副本(?:\s+\d+)?$/, "").trim() || baseName} 副本`;
  const existingNames = new Set((records ?? []).map((record) => String(record?.name ?? "").trim()));

  if (!existingNames.has(copyBaseName)) {
    return copyBaseName;
  }

  let copyIndex = 2;
  let nextName = `${copyBaseName} ${copyIndex}`;

  while (existingNames.has(nextName)) {
    copyIndex += 1;
    nextName = `${copyBaseName} ${copyIndex}`;
  }

  return nextName;
}

async function duplicateWorkflowRecord(record) {
  const card = activeWorkflowCard.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card || !record) {
    setStatus("工作流仓储未就绪，暂时无法复制。", "danger");
    return;
  }

  try {
    const now = new Date().toISOString();
    const draft = createWorkflowRecordDraftFromRecord(record);
    draft.name = createWorkflowDuplicateRecordName(record.name, card.records ?? []);

    const nextRecord = buildWorkflowRecordFromDraft(draft);
    const nextCard = {
      ...card,
      usageCount: Number(card.usageCount ?? 0) + 1,
      updatedAt: now,
      lastUsedAt: now,
      records: [nextRecord, ...(card.records ?? [])]
    };

    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeCardId = nextCard.id;
    ui.workflow.activeRecordId = nextRecord.id;
    ui.workflow.runResult = null;
    setStatus(`已复制「${record.name}」。`, "success");
  } catch (error) {
    console.error("Failed to duplicate workflow record", error);
    setStatus(`复制工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function deleteWorkflowRecord(recordId) {
  const card = activeWorkflowCard.value;

  if (!desktopApi?.upsertWorkflowLibraryItem || !card) {
    setStatus("工作流仓储未就绪，暂时无法删除。", "danger");
    return;
  }

  const record = card.records?.find((entry) => entry.id === recordId) ?? null;
  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除工作流记录",
    message: `确认删除「${record?.name ?? "当前记录"}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  const nextCard = {
    ...card,
    updatedAt: new Date().toISOString(),
    records: (card.records ?? []).filter((record) => record.id !== recordId)
  };

  try {
    workbench.workflowLibrary = await desktopApi.upsertWorkflowLibraryItem(toPlainIpcData(nextCard));
    ui.workflow.activeRecordId = nextCard.records[0]?.id ?? null;
    ui.workflow.runResult = null;
    setStatus("已删除工作流。", "success");
  } catch (error) {
    console.error("Failed to delete workflow record", error);
    setStatus(`删除工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function runActiveWorkflowRecord() {
  if (ui.workflow.isRunning) {
    await cancelActiveWorkflowRun();
    return;
  }

  if (!desktopApi?.runWorkflowRecord || !activeWorkflowRecord.value) {
    setStatus("工作流执行桥接未就绪。", "danger");
    return;
  }

  const missingFields = getWorkflowRuntimeMissingFields(activeWorkflowRecord.value);

  if (missingFields.length) {
    setStatus(`请先补齐：${missingFields.join("、")}。`, "warning");
    void showAlertDialog({
      tone: "warning",
      title: "运行配置不完整",
      message: `当前工作流需要 ${missingFields.join("、")}，补齐后再执行。`,
      confirmText: "知道了"
    });
    return;
  }

  try {
    const progressEventId = createLocalId("workflow_progress");
    const runRecord = buildWorkflowRunRecord(activeWorkflowRecord.value, progressEventId);

    ui.workflow.isRunning = true;
    ui.workflow.isCancelling = false;
    ui.workflow.activeProgressEventId = progressEventId;
    ui.workflow.runResult = buildWorkflowInitialRunResult(runRecord, progressEventId);
    setStatus("工作流正在执行。", "neutral");

    const result = await desktopApi.runWorkflowRecord(runRecord);
    ui.workflow.runResult = result;
    const cancelled = result?.status === "cancelled";

    if (cancelled) {
      setStatus("工作流已中断。", "warning");
      return;
    }

    const succeeded = result?.status === "success";
    setStatus(succeeded ? "工作流执行成功。" : "工作流执行失败，请查看输出。", succeeded ? "success" : "danger");

    if (!succeeded) {
      void showAlertDialog({
        tone: "danger",
        title: "工作流执行失败",
        message: "当前工作流没有完整执行成功，请查看输出区里的步骤状态、stderr 或 exit code。",
        confirmText: "知道了"
      });
    }
  } catch (error) {
    console.error("Failed to run workflow record", error);
    setStatus(`执行工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    void showAlertDialog({
      tone: "danger",
      title: "工作流执行异常",
      message: error instanceof Error ? error.message : "未知错误",
      confirmText: "知道了"
    });
  } finally {
    ui.workflow.isRunning = false;
    ui.workflow.isCancelling = false;
    ui.workflow.activeProgressEventId = null;
  }
}

async function cancelActiveWorkflowRun() {
  if (!ui.workflow.isRunning || !ui.workflow.activeProgressEventId) {
    return;
  }

  if (!desktopApi?.cancelWorkflowRecordRun) {
    setStatus("工作流中断桥接未就绪。", "danger");
    return;
  }

  try {
    ui.workflow.isCancelling = true;
    setStatus("正在中断工作流。", "warning");

    const result = await desktopApi.cancelWorkflowRecordRun(ui.workflow.activeProgressEventId);

    if (!result?.cancelled) {
      ui.workflow.isCancelling = false;
      setStatus("当前没有找到可中断的工作流执行。", "warning");
    }
  } catch (error) {
    console.error("Failed to cancel workflow record run", error);
    ui.workflow.isCancelling = false;
    setStatus(`中断工作流失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleWorkflowCurlCopy(step) {
  try {
    await copyTextToClipboard(step?.curl ?? "");
    ui.workflow.copiedStepId = step?.id ?? null;
    setStatus(`已复制「${step?.name ?? "当前步骤"}」的 curl。`, "success");
  } catch (error) {
    console.error("Failed to copy workflow curl", error);
    setStatus(`复制 curl 失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function loadModelBalanceUsageHistory(profileId) {
  const normalizedProfileId = String(profileId ?? "").trim();

  if (!normalizedProfileId) {
    return;
  }

  if (!desktopApi?.listModelBalanceHistory) {
    modelBalanceRuntime.historyErrorByProfileId[normalizedProfileId] = "桌面桥接未就绪，暂时无法读取用量历史。";
    return;
  }

  modelBalanceRuntime.historyLoadingByProfileId[normalizedProfileId] = true;
  modelBalanceRuntime.historyErrorByProfileId[normalizedProfileId] = "";

  try {
    modelBalanceRuntime.historyByProfileId[normalizedProfileId] = await desktopApi.listModelBalanceHistory(normalizedProfileId);
  } catch (error) {
    console.error("Failed to load model balance usage history", error);
    modelBalanceRuntime.historyErrorByProfileId[normalizedProfileId] =
      error instanceof Error ? error.message : "用量历史读取失败。";
  } finally {
    modelBalanceRuntime.historyLoadingByProfileId[normalizedProfileId] = false;
  }
}

async function openModelUsageStats(profile) {
  if (!profile?.id) {
    return;
  }

  activeFeature.value = FEATURE_MODEL_MANAGEMENT;
  ui.modelManagement.usageProfileId = profile.id;
  ui.modelManagement.view = "usage";
  await loadModelBalanceUsageHistory(profile.id);
}

function openModelCreatePicker() {
  activeFeature.value = FEATURE_MODEL_MANAGEMENT;
  ui.modelManagement.view = "picker";
  ui.modelManagement.editor = createModelEditorState("openai");
}

function selectModelProvider(provider) {
  ui.modelManagement.editor = createModelEditorState(provider);
  ui.modelManagement.view = "editor";
}

function openModelEditor(profile) {
  activeFeature.value = FEATURE_MODEL_MANAGEMENT;
  ui.modelManagement.editor = createModelEditorState(profile.provider, profile);
  ui.modelManagement.view = "editor";
}

function backModelManagement() {
  ui.modelManagement.view = "list";
  ui.modelManagement.editor = createModelEditorState("openai");
  ui.modelManagement.usageProfileId = "";
}

function markModelEditorDirty() {
  if (ui.modelManagement.editor.saveState === "saved") {
    ui.modelManagement.editor.saveState = "idle";
  }
}

function selectPopularModel(model) {
  ui.modelManagement.editor.values.model = model;
  markModelEditorDirty();
}

function fillModelBalanceQueryTemplate() {
  ui.modelManagement.editor.values.balanceQueryCode = MODEL_BALANCE_QUERY_TEMPLATE;
  ui.modelManagement.editor.balanceQueryError = "";
  ui.modelManagement.editor.balanceQueryResult = null;
  ui.modelManagement.editor.lastBalanceQueryCode = "";
  markModelEditorDirty();
}

async function handleModelEditorBalanceQuery() {
  if (!desktopApi?.queryModelBalance) {
    setStatus("桌面桥接未就绪，暂无法执行余额查询。", "danger");
    return;
  }

  const payload = buildModelEditorPayload();

  if (!payload.apiKey) {
    setStatus("请先填写 API Key，再执行余额查询。", "warning");
    return;
  }

  if (!payload.balanceQueryCode) {
    setStatus("请先填写余额查询提取器代码。", "warning");
    return;
  }

  ui.modelManagement.editor.isBalanceQuerying = true;
  ui.modelManagement.editor.balanceQueryError = "";

  try {
    const balanceSnapshot = await desktopApi.queryModelBalance(toPlainIpcData({
      profile: payload,
      persistResult: false
    }));
    ui.modelManagement.editor.balanceQueryResult = balanceSnapshot;
    ui.modelManagement.editor.lastBalanceQueryCode = payload.balanceQueryCode;
    setStatus("余额查询成功。", "success");
  } catch (error) {
    console.error("Failed to query model balance in editor", error);
    ui.modelManagement.editor.balanceQueryError = error instanceof Error ? error.message : "未知错误";
    setStatus(`余额查询失败：${ui.modelManagement.editor.balanceQueryError}`, "danger");
  } finally {
    ui.modelManagement.editor.isBalanceQuerying = false;
  }
}

async function handleModelEditorSave() {
  if (ui.modelManagement.editor.isSaving) {
    return;
  }

  if (!desktopApi) {
    ui.modelManagement.editor.saveState = "idle";
    setStatus("桌面桥接未就绪，暂无法保存模型配置。", "danger");
    return;
  }

  const missingField = modelEditorFields.value.find(
    (field) => field.required && !String(ui.modelManagement.editor.values[field.key] ?? "").trim()
  );

  if (missingField) {
    ui.modelManagement.editor.saveState = "idle";
    setStatus(`请先填写 ${missingField.label}。`, "warning");
    return;
  }

  const payload = buildModelEditorPayload();

  try {
    ui.modelManagement.editor.isSaving = true;
    ui.modelManagement.editor.saveState = "saving";
    await desktopApi.upsertModelProfile(toPlainIpcData(payload));
    ui.modelManagement.editor.profileId = payload.id;
    ui.modelManagement.editor.mode = "edit";
    await refreshWorkbenchSnapshot();
    ui.modelManagement.editor.saveState = "saved";
    setStatus("模型配置已保存。", "success");
  } catch (error) {
    console.error("Failed to save model profile", error);
    ui.modelManagement.editor.saveState = "idle";
    setStatus(`模型配置保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    ui.modelManagement.editor.isSaving = false;
  }
}

async function handleModelBalanceRefresh(profile) {
  if (!desktopApi?.queryModelBalance) {
    setModelBalanceFeedback(profile?.id, "桥接未就绪，列表按钮未拿到查询能力。", "danger");
    setStatus("桌面桥接未就绪，暂无法执行余额查询。", "danger");
    return;
  }

  if (!hasModelBalanceQuery(profile)) {
    setModelBalanceFeedback(profile?.id, "当前模型没有配置余额查询代码。", "warning");
    setStatus("当前模型还没有配置余额查询提取器代码。", "warning");
    return;
  }

  const profilePayload = toPlainModelProfile(profile);
  setModelBalanceFeedback(profile.id, "已点击，准备发起余额查询...", "neutral");
  setStatus(`正在刷新 ${profile.displayName} 的余额...`, "neutral");
  setModelBalanceRefreshing(profile.id, true);
  await nextTick();

  try {
    setModelBalanceFeedback(profile.id, "请求已发出，等待接口返回...", "neutral");
    const balanceSnapshot = await desktopApi.queryModelBalance(toPlainIpcData({
      profile: profilePayload,
      persistResult: true,
      historySource: "manual"
    }));
    applyModelBalanceSnapshot(profile.id, balanceSnapshot);
    if (ui.modelManagement.view === "usage" && ui.modelManagement.usageProfileId === profile.id) {
      await loadModelBalanceUsageHistory(profile.id);
    }
    setModelBalanceFeedback(profile.id, "余额刷新成功。", "success");
    setStatus(`已刷新 ${profile.displayName} 的余额。`, "success");
  } catch (error) {
    console.error("Failed to refresh model balance", error);
    setModelBalanceFeedback(profile.id, error instanceof Error ? error.message : "余额刷新失败。", "danger");
    setStatus(`余额刷新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  } finally {
    setModelBalanceRefreshing(profile.id, false);
  }

  try {
    await refreshWorkbenchSnapshot();
  } catch (error) {
    console.error("Failed to sync refreshed model balance snapshot", error);
  }
}

async function handleModelStatusToggle(profileId) {
  if (!desktopApi) {
    return;
  }

  try {
    workbench.modelSettings = await desktopApi.toggleModelProfileStatus(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("模型状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle model profile status", error);
    setStatus(`模型状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleModelDelete(profileId) {
  if (!desktopApi) {
    return;
  }

  const profile = workbench.modelSettings.profiles.find((item) => item.id === profileId);

  if (!profile) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除模型配置",
    message: `确认删除「${profile.displayName}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  try {
    workbench.modelSettings = await desktopApi.deleteModelProfile(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("模型配置已删除。", "success");
  } catch (error) {
    console.error("Failed to delete model profile", error);
    setStatus(`模型配置删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

const {
  addWeeklyProject,
  addWeeklyReportTemplate,
  addWeeklyTask,
  closeWeeklyEditor,
  disposeWeeklyRuntime,
  handleWeeklyActiveReportGeneration,
  handleWeeklyDelete,
  handleWeeklyDraftSnapshotChange,
  handleWeeklyReportOutputCopy,
  handleWeeklyReportTemplateSelectionChange,
  handleWeeklySave,
  handleWeeklySelectedReportTemplateIdChange,
  isWeeklyProjectCollapsed,
  isWeeklyTaskRewriting,
  openLatestWeeklyRecord,
  openWeeklyRecord,
  optimizeWeeklyTaskTitle,
  removeWeeklyProject,
  removeWeeklySelectedReportTemplate,
  removeWeeklyTask,
  resetWeeklyReportCopyState,
  setWeeklyReportingMode,
  setWeeklyReportOutputMode,
  setWeeklyTaskStatus,
  syncWeeklyEditorState,
  toggleWeeklyProjectCollapsed,
  touchWeeklyTaskById
} = createWeeklyActions({
  activeFeature,
  activeWeeklyRecord,
  copyTextToClipboard,
  desktopApi,
  featureTasksId: FEATURE_TASKS,
  nextTick,
  setActiveFeature,
  setStatus,
  showConfirmDialog,
  showInputDialog,
  ui,
  weeklyTaskRewriteIds,
  workbench
});

function openExtensionEditor(kind, entry = null) {
  activeFeature.value = FEATURE_EXTENSIONS_MANAGEMENT;
  ui.extensions.listTab = getExtensionListTab(kind);
  ui.extensions.editor = createExtensionEditorState(kind, entry);
  ui.extensions.view = "editor";
}

function openAgentRunner(agentId) {
  activeFeature.value = FEATURE_EXTENSIONS_MANAGEMENT;
  ui.extensions.listTab = "agent";
  ui.extensions.runner = createAgentRunnerState(agentId);
  ui.extensions.view = "runner";
}

function closeExtensionPanels() {
  const currentTab = ui.extensions.listTab;
  ui.extensions.view = "list";
  ui.extensions.editor = createExtensionEditorState(currentTab === "skill" ? "skill" : currentTab === "mcp" ? "mcp" : "agent");
  ui.extensions.runner = createAgentRunnerState();
}

function resetRunnerState() {
  const agentId = ui.extensions.runner.agentId;
  ui.extensions.runner = createAgentRunnerState(agentId);
}

function getExtensionEditorTitle() {
  switch (ui.extensions.editor.kind) {
    case "agent":
      return ui.extensions.editor.mode === "edit" ? "编辑 Agent" : "新增 Agent";
    case "skill":
      return ui.extensions.editor.mode === "edit" ? "编辑 Skill" : "新增 Skill";
    case "skill-import":
      return "从 GitHub 加载 Skill";
    case "mcp":
      return ui.extensions.editor.mode === "edit" ? "编辑 MCP Server" : "新增 MCP Server";
    default:
      return "能力编辑器";
  }
}

async function handleExtensionEditorSave() {
  if (!desktopApi) {
    setStatus("桌面桥接未就绪，暂无法保存能力配置。", "danger");
    return;
  }

  try {
    if (ui.extensions.editor.kind === "agent") {
      const existing = workbench.agentProfiles.find((entry) => entry.id === ui.extensions.editor.entryId);
      await desktopApi.upsertAgentProfile({
        id: ui.extensions.editor.entryId ?? `agent_${Date.now()}`,
        name: ui.extensions.editor.values.name.trim(),
        description: ui.extensions.editor.values.description.trim(),
        mode: ui.extensions.editor.values.mode,
        modelProfileId: ui.extensions.editor.values.modelProfileId.trim() || null,
        systemPrompt: ui.extensions.editor.values.systemPrompt.trim(),
        allowedSkillIds: ui.extensions.editor.values.allowedSkillIds,
        allowedMcpServerIds: ui.extensions.editor.values.allowedMcpServerIds,
        enabled: existing?.enabled ?? true,
        updatedAt: new Date().toISOString()
      });
    } else if (ui.extensions.editor.kind === "skill") {
      const existing = workbench.skillDefinitions.find((entry) => entry.id === ui.extensions.editor.entryId);
      const handlerRef = ui.extensions.editor.values.handlerRef.trim();
      await desktopApi.upsertSkillDefinition({
        id: ui.extensions.editor.entryId ?? `skill_${Date.now()}`,
        name: ui.extensions.editor.values.name.trim(),
        description: ui.extensions.editor.values.description.trim(),
        tags: [],
        kind: handlerRef || existing?.kind === "workflow" ? "workflow" : "prompt",
        promptTemplate: ui.extensions.editor.values.promptTemplate.trim(),
        handlerRef,
        source: existing?.source ?? { type: "manual" },
        enabled: existing?.enabled ?? true,
        updatedAt: new Date().toISOString()
      });
    } else if (ui.extensions.editor.kind === "skill-import") {
      await desktopApi.importSkillDefinitionFromGithub({
        repo: ui.extensions.editor.values.repo.trim(),
        ref: ui.extensions.editor.values.ref.trim() || "main",
        path: ui.extensions.editor.values.path.trim()
      });
    } else {
      const existing = workbench.mcpServers.find((entry) => entry.id === ui.extensions.editor.entryId);

      if (ui.extensions.editor.values.transport === "stdio" && !ui.extensions.editor.values.command.trim()) {
        setStatus("stdio 模式需要填写启动命令。", "warning");
        return;
      }

      if (ui.extensions.editor.values.transport === "http" && !ui.extensions.editor.values.url.trim()) {
        setStatus("http 模式需要填写服务地址。", "warning");
        return;
      }

      await desktopApi.upsertMcpServer({
        id: ui.extensions.editor.entryId ?? `mcp_${Date.now()}`,
        name: ui.extensions.editor.values.name.trim(),
        description: ui.extensions.editor.values.description.trim(),
        transport: ui.extensions.editor.values.transport,
        command: ui.extensions.editor.values.transport === "stdio" ? ui.extensions.editor.values.command.trim() : "",
        url: ui.extensions.editor.values.transport === "http" ? ui.extensions.editor.values.url.trim() : "",
        env: parseEnvText(ui.extensions.editor.values.envText),
        toolAllowlist: normalizeTagList(ui.extensions.editor.values.toolAllowlist),
        enabled: existing?.enabled ?? true,
        updatedAt: new Date().toISOString()
      });
    }

    await refreshWorkbenchSnapshot();
    closeExtensionPanels();
    setStatus("能力配置已保存。", "success");
  } catch (error) {
    console.error("Failed to save extension", error);
    setStatus(`能力配置保存失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleAgentStatusToggle(profileId) {
  if (!desktopApi) {
    return;
  }

  try {
    await desktopApi.toggleAgentProfileStatus(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("Agent 状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle agent status", error);
    setStatus(`Agent 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleSkillStatusToggle(skillId) {
  if (!desktopApi) {
    return;
  }

  try {
    await desktopApi.toggleSkillDefinitionStatus(skillId);
    await refreshWorkbenchSnapshot();
    setStatus("Skill 状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle skill status", error);
    setStatus(`Skill 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleMcpStatusToggle(serverId) {
  if (!desktopApi) {
    return;
  }

  try {
    await desktopApi.toggleMcpServerStatus(serverId);
    await refreshWorkbenchSnapshot();
    setStatus("MCP 状态已更新。", "success");
  } catch (error) {
    console.error("Failed to toggle mcp status", error);
    setStatus(`MCP 状态更新失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleAgentDelete(profileId) {
  if (!desktopApi || isBuiltinWorkbenchItem(profileId)) {
    return;
  }

  const profile = getAgentById(profileId);

  if (!profile) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除 Agent",
    message: `确认删除 Agent「${profile.name}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  try {
    await desktopApi.deleteAgentProfile(profileId);
    await refreshWorkbenchSnapshot();
    setStatus("Agent 已删除。", "success");
  } catch (error) {
    console.error("Failed to delete agent", error);
    setStatus(`Agent 删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleSkillDelete(skillId) {
  if (!desktopApi || isBuiltinWorkbenchItem(skillId)) {
    return;
  }

  const skill = getSkillById(skillId);

  if (!skill) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除 Skill",
    message: `确认删除 Skill「${skill.name}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  try {
    await desktopApi.deleteSkillDefinition(skillId);
    await refreshWorkbenchSnapshot();
    setStatus("Skill 已删除。", "success");
  } catch (error) {
    console.error("Failed to delete skill", error);
    setStatus(`Skill 删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

async function handleMcpDelete(serverId) {
  if (!desktopApi || isBuiltinWorkbenchItem(serverId)) {
    return;
  }

  const server = getMcpServerById(serverId);

  if (!server) {
    return;
  }

  const confirmed = await showConfirmDialog({
    tone: "danger",
    title: "删除 MCP Server",
    message: `确认删除 MCP Server「${server.name}」吗？删除后无法恢复。`,
    confirmText: "删除",
    cancelText: "取消"
  });

  if (!confirmed) {
    return;
  }

  try {
    await desktopApi.deleteMcpServer(serverId);
    await refreshWorkbenchSnapshot();
    setStatus("MCP Server 已删除。", "success");
  } catch (error) {
    console.error("Failed to delete mcp server", error);
    setStatus(`MCP 删除失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function handleRunnerServerChange() {
  ui.extensions.runner.mcpToolName = "";
  ui.extensions.runner.availableMcpTools = [];
}

async function handleRunnerLoadMcpTools() {
  if (!desktopApi) {
    return;
  }

  if (!ui.extensions.runner.mcpServerId) {
    setStatus("请先选择一个工具服务，再读取工具。", "warning");
    return;
  }

  try {
    const tools = await desktopApi.listMcpServerTools(ui.extensions.runner.mcpServerId);
    ui.extensions.runner.availableMcpTools = tools;
    ui.extensions.runner.mcpToolName = tools[0]?.name ?? "";
    setStatus(`已读取 ${tools.length} 个工具。`, "success");
  } catch (error) {
    console.error("Failed to load runner tools", error);
    setStatus(`工具读取失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
  }
}

function getRecentAgentRunLogs(agentId, limit = 5) {
  if (!agentId) {
    return [];
  }

  return workbench.agentRunLogs.filter((log) => log.agentProfileId === agentId).slice(0, limit);
}

async function handleRunnerSubmit() {
  if (!desktopApi) {
    return;
  }

  const agent = getAgentById(ui.extensions.runner.agentId);

  if (!agent) {
    setStatus("当前 Agent 运行器未就绪，暂无法执行。", "danger");
    return;
  }

  let mcpArguments = undefined;

  if (ui.extensions.runner.mcpToolName && !ui.extensions.runner.mcpServerId) {
    setStatus("如果要调用工具，请先选择工具服务。", "warning");
    return;
  }

  if (ui.extensions.runner.mcpServerId && !ui.extensions.runner.mcpToolName && !ui.extensions.runner.autoSelectMcp) {
    setStatus("已选择工具服务，请再选择一个具体工具。", "warning");
    return;
  }

  if (ui.extensions.runner.mcpServerId && ui.extensions.runner.mcpToolName) {
    try {
      mcpArguments = JSON.parse(ui.extensions.runner.mcpArgumentsText);
    } catch (error) {
      setStatus(`工具参数 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
      return;
    }

    if (!mcpArguments || typeof mcpArguments !== "object" || Array.isArray(mcpArguments)) {
      setStatus("工具参数必须是一个 JSON 对象。", "danger");
      return;
    }
  }

  try {
    ui.extensions.runner.isRunning = true;
    setStatus(`正在运行 Agent「${agent.name}」...`, "neutral");
    const result = await desktopApi.runAgent({
      agentProfileId: agent.id,
      userInput: ui.extensions.runner.userInput.trim(),
      ...(ui.extensions.runner.skillId ? { skillId: ui.extensions.runner.skillId } : {}),
      ...(ui.extensions.runner.autoSelectMcp ? { autoSelectMcp: true } : {}),
      ...(ui.extensions.runner.mcpServerId ? { mcpServerId: ui.extensions.runner.mcpServerId } : {}),
      ...(ui.extensions.runner.mcpServerId && ui.extensions.runner.mcpToolName
        ? {
            mcpToolName: ui.extensions.runner.mcpToolName,
            mcpArguments
          }
        : {})
    });
    ui.extensions.runner.result = result;
    workbench.agentRunLogs = [result, ...workbench.agentRunLogs.filter((log) => log.id !== result.id)];
    ui.extensions.runner.isRunning = false;
    setStatus(`Agent 运行完成（${result.profileLabel}）。`, "success");
  } catch (error) {
    console.error("Failed to run agent", error);
    ui.extensions.runner.isRunning = false;
    setStatus(`Agent 运行失败：${error instanceof Error ? error.message : "未知错误"}`, "danger");
    void showAlertDialog({
      tone: "danger",
      title: "Agent 运行失败",
      message: error instanceof Error ? error.message : "未知错误",
      detail: "Runner 保留当前输入，可调整 Agent、Skill 或工具配置后再次运行。",
      confirmText: "知道了"
    });
  }
}

async function copyTextToClipboard(value) {
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

async function handleRichTextClick(event) {
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
}

function formatFailureKind(failureKind) {
  if (failureKind === "schema_mismatch") {
    return "Schema 不匹配";
  }

  if (failureKind === "tool_unavailable") {
    return "工具不可用";
  }

  if (failureKind === "tool_execution") {
    return "工具执行失败";
  }

  return "未知失败";
}

function disposeRobotRuntime() {
  robotRuntimeState.loadToken += 1;

  if (robotRuntimeState.resizeObserver) {
    robotRuntimeState.resizeObserver.disconnect();
    robotRuntimeState.resizeObserver = null;
  }

  if (robotRuntimeState.app) {
    robotRuntimeState.app.dispose();
    robotRuntimeState.app = null;
  }

  robotRuntimeState.canvas = null;
}

async function loadSplineApplication() {
  if (splineApplicationClass) {
    return splineApplicationClass;
  }

  if (!splineApplicationPromise) {
    splineApplicationPromise = import("@splinetool/runtime").then((module) => {
      splineApplicationClass = module.Application;
      return splineApplicationClass;
    });
  }

  return splineApplicationPromise;
}

async function syncRobotRuntime() {
  if (activeFeature.value !== FEATURE_HOME) {
    disposeRobotRuntime();
    return;
  }

  const canvas = robotCanvasRef.value;

  if (!(canvas instanceof HTMLCanvasElement)) {
    disposeRobotRuntime();
    return;
  }

  if (robotRuntimeState.canvas === canvas && robotRuntimeState.app) {
    return;
  }

  const token = robotRuntimeState.loadToken + 1;
  disposeRobotRuntime();

  let SplineApplication = null;

  try {
    SplineApplication = await loadSplineApplication();
  } catch (error) {
    console.error("Failed to load Gordon robot runtime", error);

    if (token === robotRuntimeState.loadToken) {
      setStatus("机器人运行时加载失败。", "danger");
    }

    return;
  }

  if (token !== robotRuntimeState.loadToken || activeFeature.value !== FEATURE_HOME) {
    return;
  }

  const app = new SplineApplication(canvas, {
    renderMode: "continuous"
  });

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    app.setSize(width, height);
  };

  robotRuntimeState.app = app;
  robotRuntimeState.canvas = canvas;
  robotRuntimeState.resizeObserver = new ResizeObserver(resize);
  robotRuntimeState.resizeObserver.observe(canvas);
  resize();

  try {
    await app.load(robotSceneUrl);

    if (token !== robotRuntimeState.loadToken) {
      app.dispose();
    }
  } catch (error) {
    console.error("Failed to load Gordon robot scene", error);

    if (token === robotRuntimeState.loadToken) {
      setStatus("机器人场景加载失败。", "danger");
    }
  }
}

watch(
  () => status.tone,
  (tone) => {
    document.body.classList.toggle("load-error", tone === "danger");
  },
  { immediate: true }
);

watch(
  activeFeature,
  async () => {
    await nextTick();
    await syncRobotRuntime();

    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP && ui.command.view === "chat") {
      scrollCommandToBottom();
    }
  },
  { immediate: false }
);

watch(
  () => ui.command.view,
  async (view) => {
    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP && view === "chat") {
      await nextTick();
      scrollCommandToBottom();
      focusCommandInput();
    }
  }
);

watch(
  () => ui.command.composerView,
  (view) => {
    if (view === "input") {
      focusCommandInput();
    }
  }
);

watch(
  activeCommandMessages,
  () => {
    if (activeFeature.value === FEATURE_COMMAND_WORKSHOP && ui.command.view === "chat") {
      scrollCommandToBottom();
    }
  },
  { deep: true }
);

watch(
  () => ui.weekly.draft?.selectedReportTemplateId,
  handleWeeklySelectedReportTemplateIdChange
);

watch(
  () => `${ui.workflow.view}:${ui.workflow.activeCardId ?? ""}:${ui.workflow.activeRecordId ?? ""}`,
  () => {
    if (ui.workflow.view === "run") {
      syncWorkflowBodyDraftFromActiveStep({ force: true });
    }
  }
);

watch(
  () => getWeeklyDraftSnapshot(ui.weekly.draft),
  (nextSnapshot) => {
    handleWeeklyDraftSnapshotChange(nextSnapshot);
  }
);

onMounted(async () => {
  window.addEventListener("keydown", handleGordonDialogKeydown);

  if (desktopApi?.onAgentRunProgress) {
    agentProgressListenerId = desktopApi.onAgentRunProgress(handleAgentRunProgress);
  }

  if (desktopApi?.onWorkflowRunProgress) {
    workflowProgressListenerId = desktopApi.onWorkflowRunProgress(handleWorkflowRunProgress);
  }

  await bootstrapWorkbench();
  ui.command.form = normalizeCommandWorkshopConfig(ui.command.form);
  await nextTick();
  await syncRobotRuntime();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGordonDialogKeydown);

  if (agentProgressListenerId && desktopApi?.offAgentRunProgress) {
    desktopApi.offAgentRunProgress(agentProgressListenerId);
    agentProgressListenerId = null;
  }

  if (workflowProgressListenerId && desktopApi?.offWorkflowRunProgress) {
    desktopApi.offWorkflowRunProgress(workflowProgressListenerId);
    workflowProgressListenerId = null;
  }

  disposeWeeklyRuntime();
  clearComicAutosaveTimer();
  clearWritingAutosaveTimer();
  disposeRobotRuntime();
  document.body.classList.remove("load-error");
});
</script>

<template>
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
</template>

<script setup>
import GIcon from "../../components/GIcon.vue";
import WritingAiDrawer from "../writing/WritingAiDrawer.vue";
import {
  COMIC_APP_NAME,
  COMIC_APP_TABS,
  MARKETPLACE_APP_COUNT
} from "./marketplaceConfig.js";
import {
  WRITING_APP_NAME,
  WRITING_APP_TABS,
  WRITING_BOOK_EXPORT_FORMATS
} from "../writing/writingConfig.js";

const props = defineProps({
  context: { type: Object, required: true }
});

const {
  activeComicChapter,
  activeComicChapterIndex,
  activeComicChapters,
  activeComicExportFileName,
  activeComicProject,
  activeComicTabMeta,
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingDoneChapterCount,
  activeWritingIntroSections,
  activeWritingLengthProfile,
  activeWritingLongOutlineRequest,
  activeWritingOutlinePlannerJob,
  activeWritingPromptPreview,
  activeWritingTabMeta,
  activeWritingTask,
  activeWritingTaskOptions,
  applyWritingAssistantOutput,
  backComicMarketplace,
  backComicShelf,
  backWritingMarketplace,
  backWritingShelf,
  buildWritingLongOutlineTargetContent,
  canExportActiveComicProject,
  canExportActiveWritingBook,
  canResumeWritingOutlinePlanner,
  cancelWritingOutlinePlanningJob,
  closeComicExportDialog,
  closeWritingExportDialog,
  comicChapterDropdownMenuRef,
  comicProjects,
  createComicChapter,
  createComicProject,
  createWritingBook,
  createWritingChapter,
  deleteComicProjectFromShelf,
  deleteWritingBookFromShelf,
  exportActiveComicProject,
  exportActiveWritingBook,
  filteredComicChapterEntries,
  filteredWritingChapterEntries,
  formatWritingBookUpdatedAt,
  generateWritingAssistantOutput,
  getComicChapterDisplayTitle,
  getComicChapterStatusClass,
  getComicChapterStatusLabel,
  getComicProjectFormatLabel,
  getComicProjectPaletteLabel,
  getWritingAiFeedbackClass,
  getWritingAiRunButtonLabel,
  getWritingBookCompleteness,
  getWritingBookWordCount,
  getWritingBusyDescription,
  getWritingBusyTitle,
  getWritingChapterDisplayTitle,
  getWritingChapterPartLabel,
  getWritingChapterStatusClass,
  getWritingChapterStatusLabel,
  getWritingChapterWordCount,
  getWritingIntroFieldValue,
  getWritingLengthLabel,
  getWritingOutlinePlannerProgressCopy,
  getWritingOutlinePlannerProgressPercent,
  getWritingOutlinePlannerRetryCopy,
  getWritingOutlinePlannerStatusClass,
  getWritingOutlinePlannerStatusLabel,
  getWritingTabWordCount,
  goComicChapter,
  goWritingChapter,
  handleWritingBookUpload,
  isActiveWritingBookAiRunning,
  isWritingChapterSubmitConfirmed,
  isWritingOutlinePlannerRunning,
  openComicAppShelf,
  openComicExportDialog,
  openComicProject,
  openWritingAppShelf,
  openWritingBook,
  openWritingExportDialog,
  resumeWritingOutlinePlanningJob,
  selectComicChapter,
  selectComicChapterFromPicker,
  selectComicExportDirectory,
  selectWritingAiTask,
  selectWritingChapter,
  selectWritingChapterFromPicker,
  selectWritingExportDirectory,
  setComicChapterContent,
  setComicChapterPickerOpen,
  setComicChapterPrompt,
  setComicChapterSummary,
  setComicChapterTitle,
  setComicProjectEpisodePlan,
  setComicProjectFormat,
  setComicProjectGenre,
  setComicProjectPageCount,
  setComicProjectPalette,
  setComicProjectSummary,
  setComicProjectTitle,
  setComicProjectVisualStyle,
  setComicTab,
  setWritingAiDrawerOpen,
  setWritingChapterContent,
  setWritingChapterPickerOpen,
  setWritingChapterSummary,
  setWritingExportFormat,
  setWritingIntroField,
  setWritingTab,
  submitComicChapter,
  submitWritingChapter,
  toggleComicChapterPicker,
  toggleComicProfileRail,
  toggleWritingAiTaskPicker,
  toggleWritingChapterPicker,
  toggleWritingProfileRail,
  toggleWritingPromptPreview,
  truncateText,
  ui,
  writingBooks,
  writingChapterDropdownMenuRef
} = props.context;
</script>

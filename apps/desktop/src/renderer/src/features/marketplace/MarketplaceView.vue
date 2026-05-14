<template>
<div
  class="workspace-stage workspace-stage-scroll"
  :class="{ 'workspace-stage-flush': ui.marketplace.view === 'writingDetail' || ui.marketplace.view === 'comicDetail' || ui.marketplace.view === 'videoDetail' || ui.marketplace.view === 'fortune' || ui.marketplace.view === 'music' }"
>
  <div
    class="marketplace-shell"
    :class="{
      'marketplace-shell-detail': ui.marketplace.view === 'writingDetail' || ui.marketplace.view === 'comicDetail' || ui.marketplace.view === 'videoDetail' || ui.marketplace.view === 'fortune' || ui.marketplace.view === 'music',
      'marketplace-shell-shelf': ui.marketplace.view === 'writingShelf' || ui.marketplace.view === 'comicShelf' || ui.marketplace.view === 'videoShelf'
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
            <span class="pill pill-neutral">故事大纲</span>
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
          </div>
        </article>

        <article
          class="marketplace-app-card video-app-card"
          role="button"
          tabindex="0"
          :aria-label="`${VIDEO_APP_NAME} 视频生成应用`"
          @click="openVideoAppShelf"
          @keydown.enter.prevent="openVideoAppShelf"
          @keydown.space.prevent="openVideoAppShelf"
        >
          <div class="video-app-mark" aria-hidden="true">
            <span>影</span>
          </div>
          <div class="marketplace-app-copy">
            <p class="feature-kicker">Video Studio</p>
            <p class="marketplace-app-title">{{ VIDEO_APP_NAME }}</p>
            <p class="models-copy">视频生成工作台，沉淀概念、分镜、镜头提示词和生成结果。</p>
          </div>
          <div class="marketplace-app-meta">
            <span class="pill">视频生成</span>
            <span class="pill pill-neutral">镜头规划</span>
          </div>
        </article>

        <article
          class="marketplace-app-card music-app-card"
          role="button"
          tabindex="0"
          :aria-label="`${MUSIC_APP_NAME} 音乐创作应用`"
          @click="openMusicApp"
          @keydown.enter.prevent="openMusicApp"
          @keydown.space.prevent="openMusicApp"
        >
          <div class="music-app-mark" aria-hidden="true">
            <span>音</span>
          </div>
          <div class="marketplace-app-copy">
            <p class="feature-kicker">Music Studio</p>
            <p class="marketplace-app-title">{{ MUSIC_APP_NAME }}</p>
            <p class="models-copy">音乐创作工作台，沉淀歌词、曲风、编曲方向和生成提示词。</p>
          </div>
          <div class="marketplace-app-meta">
            <span class="pill">音乐创作</span>
            <span class="pill pill-neutral">歌词 / 纯音</span>
          </div>
        </article>

        <article
          class="marketplace-app-card fortune-app-card"
          role="button"
          tabindex="0"
          :aria-label="`${FORTUNE_APP_NAME} 占卜运势应用`"
          @click="openFortuneApp"
          @keydown.enter.prevent="openFortuneApp"
          @keydown.space.prevent="openFortuneApp"
        >
          <div class="fortune-app-mark" aria-hidden="true">
            <span>灵</span>
          </div>
          <div class="marketplace-app-copy">
            <p class="feature-kicker">Fortune Studio</p>
            <p class="marketplace-app-title">{{ FORTUNE_APP_NAME }}</p>
            <p class="models-copy">占卜与运势工作台，围绕问题、时段和关注面生成可复盘的趋势解读。</p>
          </div>
          <div class="marketplace-app-meta">
            <span class="pill">占卜运势</span>
            <span class="pill pill-neutral">趋势参考</span>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="ui.marketplace.view === 'music'">
      <section class="writing-detail-shell fortune-detail-shell music-detail-shell">
        <header class="writing-detail-head fortune-detail-head music-detail-head">
          <button type="button" class="model-icon-button weekly-back-button" aria-label="返回应用广场" title="返回应用广场" @click="backMusicMarketplace">
            <GIcon name="return" />
          </button>

          <div class="writing-detail-title">
            <p class="fortune-title-text music-title-text">{{ MUSIC_APP_NAME }}</p>
          </div>

          <div class="model-section-actions">
            <span class="pill">{{ activeMusicModeMeta.label }}</span>
            <span class="pill pill-neutral">创作草案</span>
          </div>
        </header>

        <section class="fortune-workbench music-workbench">
          <aside class="fortune-rail music-rail">
            <div class="music-mark-large" aria-hidden="true">
              <span>音</span>
            </div>

            <div class="fortune-mode-list music-mode-list" role="tablist" aria-label="瑶琴映月创作类型">
              <button
                v-for="mode in MUSIC_CREATION_MODES"
                :key="mode.id"
                type="button"
                class="fortune-mode-button music-mode-button"
                :class="{ 'is-active': ui.marketplace.music.activeMode === mode.id }"
                :aria-selected="ui.marketplace.music.activeMode === mode.id ? 'true' : 'false'"
                @click="setMusicMode(mode.id)"
              >
                <span>{{ mode.kicker }}</span>
                <strong>{{ mode.label }}</strong>
              </button>
            </div>
          </aside>

          <main class="fortune-main-stage music-main-stage">
            <article class="writing-editor-card fortune-input-card music-input-card">
              <div class="writing-editor-head">
                <div>
                  <p class="feature-kicker">{{ activeMusicModeMeta.kicker }}</p>
                  <p class="model-section-title">{{ activeMusicModeMeta.label }}</p>
                </div>
                <button
                  type="button"
                  class="model-action fortune-run-button music-run-button"
                  :disabled="ui.marketplace.music.isGenerating"
                  @click="generateMusicDraft"
                >
                  <GIcon
                    :name="ui.marketplace.music.isGenerating ? 'loading' : 'sparkles'"
                    :spin="ui.marketplace.music.isGenerating"
                    :size="15"
                  />
                  {{ ui.marketplace.music.isGenerating ? "谱写中" : "生成草案" }}
                </button>
              </div>

              <div class="fortune-form-grid music-form-grid">
                <div class="field field-full">
                  <span class="field-label">主题 / 需求</span>
                  <FieldAiOptimizer
                    :actions="fieldAiActions"
                    :state="ui.marketplace.fieldAi"
                    :field-id="`music-theme-${ui.marketplace.music.activeMode}`"
                    :app-name="MUSIC_APP_NAME"
                    label="主题 / 需求"
                    :value="ui.marketplace.music.theme"
                    :context="buildMusicFieldAiContext('主题 / 需求')"
                    :disabled="ui.marketplace.music.isGenerating"
                    :set-value="setMusicTheme"
                  >
                    <textarea
                      :value="ui.marketplace.music.theme"
                      class="field-textarea fortune-question-textarea music-theme-textarea"
                      :placeholder="activeMusicModeMeta.placeholder"
                      :disabled="ui.marketplace.music.isGenerating"
                      @input="setMusicTheme($event.target.value)"
                    ></textarea>
                  </FieldAiOptimizer>
                </div>

                <label class="field">
                  <span class="field-label">曲风 / 情绪 / 场景</span>
                  <input
                    :value="ui.marketplace.music.style"
                    class="field-input"
                    placeholder="例如 City Pop、国风电子、民谣、Lo-fi、温柔、热烈"
                    :disabled="ui.marketplace.music.isGenerating"
                    @input="setMusicStyle($event.target.value)"
                  />
                </label>

                <div class="field">
                  <span class="field-label">参考歌词 / 素材</span>
                  <FieldAiOptimizer
                    :actions="fieldAiActions"
                    :state="ui.marketplace.fieldAi"
                    :field-id="`music-reference-${ui.marketplace.music.activeMode}`"
                    :app-name="MUSIC_APP_NAME"
                    label="参考歌词 / 素材"
                    :value="ui.marketplace.music.reference"
                    :context="buildMusicFieldAiContext('参考歌词 / 素材')"
                    :disabled="ui.marketplace.music.isGenerating"
                    :set-value="setMusicReference"
                  >
                    <textarea
                      :value="ui.marketplace.music.reference"
                      class="field-textarea fortune-context-textarea music-reference-textarea"
                      placeholder="可选，贴已有歌词、旋律描述、参考歌气质或使用场景。"
                      :disabled="ui.marketplace.music.isGenerating"
                      @input="setMusicReference($event.target.value)"
                    ></textarea>
                  </FieldAiOptimizer>
                </div>
              </div>
            </article>

            <article class="writing-editor-card fortune-output-card music-output-card">
              <div class="writing-editor-head">
                <div>
                  <p class="feature-kicker">Draft</p>
                  <p class="model-section-title">音乐草案</p>
                </div>
                <button
                  type="button"
                  class="model-action-secondary fortune-clear-button music-clear-button"
                  :disabled="ui.marketplace.music.isGenerating || !ui.marketplace.music.output"
                  @click="clearMusicOutput"
                >
                  清空
                </button>
              </div>

              <div class="fortune-output-body music-output-body">
                <pre v-if="ui.marketplace.music.output">{{ ui.marketplace.music.output }}</pre>
                <div v-else class="fortune-output-empty music-output-empty">
                  <strong>{{ activeMusicModeMeta.focus }}</strong>
                  <span>填写主题后生成草案，结果会落在这里。</span>
                </div>
              </div>

              <p
                v-if="ui.marketplace.music.feedback"
                class="writing-export-feedback fortune-feedback music-feedback"
                :class="getMusicFeedbackClass()"
                role="status"
              >
                {{ ui.marketplace.music.feedback }}
              </p>
            </article>
          </main>
        </section>
      </section>
    </template>

    <template v-else-if="ui.marketplace.view === 'fortune'">
      <section class="writing-detail-shell fortune-detail-shell">
        <header class="writing-detail-head fortune-detail-head">
          <button type="button" class="model-icon-button weekly-back-button" aria-label="返回应用广场" title="返回应用广场" @click="backFortuneMarketplace">
            <GIcon name="return" />
          </button>

          <div class="writing-detail-title">
            <p class="fortune-title-text">{{ FORTUNE_APP_NAME }}</p>
          </div>

          <div class="model-section-actions">
            <span class="pill">{{ activeFortuneModeMeta.label }}</span>
            <span class="pill pill-neutral">灵感参考</span>
          </div>
        </header>

        <section class="fortune-workbench">
          <aside class="fortune-rail">
            <div class="fortune-mark-large" aria-hidden="true">
              <span>灵</span>
            </div>

            <div class="fortune-mode-list" role="tablist" aria-label="灵犀照命解读类型">
              <button
                v-for="mode in FORTUNE_READING_MODES"
                :key="mode.id"
                type="button"
                class="fortune-mode-button"
                :class="{ 'is-active': ui.marketplace.fortune.activeMode === mode.id }"
                :aria-selected="ui.marketplace.fortune.activeMode === mode.id ? 'true' : 'false'"
                @click="setFortuneMode(mode.id)"
              >
                <span>{{ mode.kicker }}</span>
                <strong>{{ mode.label }}</strong>
              </button>
            </div>
          </aside>

          <main class="fortune-main-stage">
            <article class="writing-editor-card fortune-input-card">
              <div class="writing-editor-head">
                <div>
                  <p class="feature-kicker">{{ activeFortuneModeMeta.kicker }}</p>
                  <p class="model-section-title">{{ activeFortuneModeMeta.label }}</p>
                </div>
                <button
                  type="button"
                  class="model-action fortune-run-button"
                  :disabled="ui.marketplace.fortune.isGenerating"
                  @click="generateFortuneReading"
                >
                  <GIcon
                    :name="ui.marketplace.fortune.isGenerating ? 'loading' : 'sparkles'"
                    :spin="ui.marketplace.fortune.isGenerating"
                    :size="15"
                  />
                  {{ ui.marketplace.fortune.isGenerating ? "解读中" : "生成解读" }}
                </button>
              </div>

              <div class="fortune-form-grid">
                <div class="field field-full">
                  <span class="field-label">关注问题</span>
                  <FieldAiOptimizer
                    :actions="fieldAiActions"
                    :state="ui.marketplace.fieldAi"
                    :field-id="`fortune-question-${ui.marketplace.fortune.activeMode}`"
                    :app-name="FORTUNE_APP_NAME"
                    label="关注问题"
                    :value="ui.marketplace.fortune.question"
                    :context="buildFortuneFieldAiContext('关注问题')"
                    :disabled="ui.marketplace.fortune.isGenerating"
                    :set-value="setFortuneQuestion"
                  >
                    <textarea
                      :value="ui.marketplace.fortune.question"
                      class="field-textarea fortune-question-textarea"
                      :placeholder="activeFortuneModeMeta.placeholder"
                      :disabled="ui.marketplace.fortune.isGenerating"
                      @input="setFortuneQuestion($event.target.value)"
                    ></textarea>
                  </FieldAiOptimizer>
                </div>

                <label class="field">
                  <span class="field-label">出生 / 时间信息</span>
                  <input
                    :value="ui.marketplace.fortune.birthInfo"
                    class="field-input"
                    placeholder="可选，例如生日、时辰、当前时间或抽牌时间"
                    :disabled="ui.marketplace.fortune.isGenerating"
                    @input="setFortuneBirthInfo($event.target.value)"
                  />
                </label>

                <div class="field">
                  <span class="field-label">补充背景</span>
                  <FieldAiOptimizer
                    :actions="fieldAiActions"
                    :state="ui.marketplace.fieldAi"
                    :field-id="`fortune-context-${ui.marketplace.fortune.activeMode}`"
                    :app-name="FORTUNE_APP_NAME"
                    label="补充背景"
                    :value="ui.marketplace.fortune.context"
                    :context="buildFortuneFieldAiContext('补充背景')"
                    :disabled="ui.marketplace.fortune.isGenerating"
                    :set-value="setFortuneContext"
                  >
                    <textarea
                      :value="ui.marketplace.fortune.context"
                      class="field-textarea fortune-context-textarea"
                      placeholder="可选，写下当前处境、选项、对象关系或近期事件。"
                      :disabled="ui.marketplace.fortune.isGenerating"
                      @input="setFortuneContext($event.target.value)"
                    ></textarea>
                  </FieldAiOptimizer>
                </div>
              </div>
            </article>

            <article class="writing-editor-card fortune-output-card">
              <div class="writing-editor-head">
                <div>
                  <p class="feature-kicker">Reading</p>
                  <p class="model-section-title">解读结果</p>
                </div>
                <button
                  type="button"
                  class="model-action-secondary fortune-clear-button"
                  :disabled="ui.marketplace.fortune.isGenerating || !ui.marketplace.fortune.output"
                  @click="clearFortuneReading"
                >
                  清空
                </button>
              </div>

              <div class="fortune-output-body">
                <pre v-if="ui.marketplace.fortune.output">{{ ui.marketplace.fortune.output }}</pre>
                <div v-else class="fortune-output-empty">
                  <strong>{{ activeFortuneModeMeta.focus }}</strong>
                  <span>填写问题后生成解读，结果会落在这里。</span>
                </div>
              </div>

              <p
                v-if="ui.marketplace.fortune.feedback"
                class="writing-export-feedback fortune-feedback"
                :class="getFortuneFeedbackClass()"
                role="status"
              >
                {{ ui.marketplace.fortune.feedback }}
              </p>
            </article>
          </main>
        </section>
      </section>
    </template>

    <template v-else-if="ui.marketplace.view === 'videoShelf'">
      <section class="workflow-library-detail-head writing-shelf-head video-shelf-head">
        <div class="workflow-library-detail-head-side">
          <button type="button" class="model-icon-button weekly-back-button" aria-label="返回应用广场" title="返回应用广场" @click="backVideoMarketplace">
            <GIcon name="return" />
          </button>
        </div>

        <div class="workflow-library-detail-head-center">
          <p class="workflow-library-detail-title">{{ VIDEO_APP_NAME }}</p>
        </div>

        <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
          <span class="status-pill">{{ videoProjects.length }} 个项目</span>
          <button type="button" class="model-icon-button" aria-label="新建视频项目" title="新建视频项目" @click="createVideoProject">
            <GIcon name="add" />
          </button>
        </div>
      </section>

      <section class="writing-shelf-grid video-project-grid" :class="{ 'is-empty': !videoProjects.length }">
        <p v-if="!videoProjects.length" class="writing-shelf-empty" role="status">暂无视频项目</p>
        <article
          v-for="project in videoProjects"
          :key="project.id"
          class="writing-book-card video-project-card"
          :class="`is-${project.coverTone}`"
          role="button"
          tabindex="0"
          :aria-label="`打开${project.title}`"
          @click="openVideoProject(project.id)"
          @keydown.enter.prevent="openVideoProject(project.id)"
          @keydown.space.prevent="openVideoProject(project.id)"
        >
          <button
            type="button"
            class="shelf-card-delete"
            aria-label="删除视频项目"
            @click.stop="deleteVideoProjectFromShelf(project.id)"
            @keydown.enter.stop
            @keydown.space.stop
          >
            <GIcon name="delete" :size="12" />
          </button>
          <div class="video-project-cover" aria-hidden="true">
            <span>{{ project.title.slice(0, 1) || "影" }}</span>
          </div>
          <div class="writing-book-card-main">
            <div>
              <p class="writing-book-title">{{ project.title }}</p>
              <p class="writing-book-meta">{{ getVideoProjectModeLabel(project.mode) }} / {{ project.genre }}</p>
            </div>
            <p class="models-copy">{{ truncateText(project.summary || project.visualStyle, 98) }}</p>
            <div class="writing-book-card-foot">
              <span class="pill">{{ project.status }}</span>
              <span class="pill pill-neutral">{{ getVideoProjectAspectRatioLabel(project.aspectRatio) }}</span>
              <span class="pill pill-neutral">{{ getVideoTotalDuration(project) }} 秒</span>
            </div>
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
            </div>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="ui.marketplace.view === 'videoDetail' && activeVideoProject">
      <section class="writing-detail-shell video-detail-shell">
        <header class="writing-detail-head video-detail-head">
          <button type="button" class="model-icon-button weekly-back-button" aria-label="返回项目架" title="返回项目架" @click="backVideoShelf">
            <GIcon name="return" />
          </button>

          <div class="writing-tab-bar writing-detail-head-tabs" role="tablist" aria-label="视频项目详情模块">
            <button
              v-for="tab in VIDEO_APP_TABS"
              :key="tab.id"
              type="button"
              class="writing-tab"
              :class="{ 'is-active': ui.marketplace.video.activeTab === tab.id }"
              :aria-label="tab.label"
              :aria-selected="ui.marketplace.video.activeTab === tab.id ? 'true' : 'false'"
              :title="tab.label"
              @click="setVideoTab(tab.id)"
            >
              <span>{{ tab.kicker }}</span>
            </button>
          </div>

          <div class="model-section-actions">
            <span class="pill">{{ getVideoProjectModeLabel(activeVideoProject.mode) }}</span>
            <span class="pill pill-neutral">{{ getVideoProjectAspectRatioLabel(activeVideoProject.aspectRatio) }}</span>
          </div>
        </header>

        <section
          class="writing-detail-layout video-detail-layout"
          :class="{ 'is-profile-collapsed': ui.marketplace.video.isProfileCollapsed }"
        >
          <aside class="writing-detail-rail video-detail-rail" :aria-expanded="ui.marketplace.video.isProfileCollapsed ? 'false' : 'true'">
            <button
              type="button"
              class="model-icon-button writing-profile-toggle"
              :aria-label="ui.marketplace.video.isProfileCollapsed ? '展开项目信息' : '折叠项目信息'"
              :title="ui.marketplace.video.isProfileCollapsed ? '展开项目信息' : '折叠项目信息'"
              @click="toggleVideoProfileRail"
            >
              <GIcon :name="ui.marketplace.video.isProfileCollapsed ? 'chevronRight' : 'chevronLeft'" />
            </button>

            <div v-if="!ui.marketplace.video.isProfileCollapsed" class="writing-rail-content video-rail-content">
              <div class="video-project-profile">
                <div class="video-project-cover video-project-cover-large" :class="`is-${activeVideoProject.coverTone}`" aria-hidden="true">
                  <span>{{ activeVideoProject.title.slice(0, 1) || "影" }}</span>
                </div>

                <label class="field writing-rail-title-field">
                  <span class="field-label">项目名称</span>
                  <input
                    :value="activeVideoProject.title"
                    class="field-input writing-rail-title-input"
                    aria-label="视频项目名"
                    @input="setVideoProjectTitle($event.target.value)"
                  />
                </label>

                <label class="field">
                  <span class="field-label">模式</span>
                  <GCompactSelect
                    :model-value="activeVideoProject.mode"
                    class="writing-mini-select"
                    aria-label="视频生成模式"
                    :options="videoProjectModeOptions"
                    @update:model-value="setVideoProjectMode"
                  />
                </label>

                <label class="field">
                  <span class="field-label">画幅</span>
                  <GCompactSelect
                    :model-value="activeVideoProject.aspectRatio"
                    class="writing-mini-select"
                    aria-label="视频画幅"
                    :options="videoProjectAspectRatioOptions"
                    @update:model-value="setVideoProjectAspectRatio"
                  />
                </label>

                <label class="field">
                  <span class="field-label">类型</span>
                  <input
                    :value="activeVideoProject.genre"
                    class="field-input writing-mini-input"
                    @input="setVideoProjectGenre($event.target.value)"
                  />
                </label>

                <label class="field">
                  <span class="field-label">默认时长</span>
                  <input
                    :value="activeVideoProject.durationSeconds"
                    class="field-input writing-mini-input"
                    type="number"
                    min="1"
                    max="600"
                    @input="setVideoProjectDurationSeconds($event.target.value)"
                  />
                </label>
              </div>

              <div class="comic-rail-footer">
                <div class="writing-stat-list">
                  <span class="pill pill-neutral">更新 {{ formatWritingBookUpdatedAt(activeVideoProject.updatedAt) }}</span>
                  <span class="pill pill-neutral">{{ activeVideoShots.length }} 镜头</span>
                  <span class="pill pill-neutral">{{ getVideoTotalDuration(activeVideoProject) }} 秒</span>
                </div>
              </div>
            </div>

            <div v-if="!ui.marketplace.video.isProfileCollapsed" class="writing-profile-actions">
              <button
                type="button"
                class="writing-mini-text-button"
                :disabled="ui.marketplace.video.isExporting"
                :title="`导出 ${activeVideoExportFileName}`"
                @click="openVideoExportDialog"
              >
                项目导出
              </button>
            </div>
          </aside>

          <main class="writing-main-stage video-main-stage">
            <section class="writing-editor-grid video-editor-grid">
              <div class="video-editor-surface">
                <div v-if="ui.marketplace.video.activeTab === 'concept'" class="writing-intro-stack">
                  <div class="field writing-intro-field">
                    <span class="field-label">主题与用途</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`video-project-summary-${activeVideoProject.id}`"
                      :app-name="VIDEO_APP_NAME"
                      label="主题与用途"
                      :value="activeVideoProject.summary"
                      :context="buildVideoProjectFieldAiContext('主题与用途')"
                      :set-value="setVideoProjectSummary"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-intro-textarea"
                        :value="activeVideoProject.summary"
                        placeholder="视频主题、主体、受众、发布场景、情绪目标和核心画面。"
                        @input="setVideoProjectSummary($event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>

                  <div class="field writing-intro-field">
                    <span class="field-label">视觉与运动风格</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`video-project-visual-${activeVideoProject.id}`"
                      :app-name="VIDEO_APP_NAME"
                      label="视觉与运动风格"
                      :value="activeVideoProject.visualStyle"
                      :context="buildVideoProjectFieldAiContext('视觉与运动风格')"
                      :set-value="setVideoProjectVisualStyle"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-intro-textarea is-large"
                        :value="activeVideoProject.visualStyle"
                        placeholder="光线、色彩、材质、镜头运动、速度、稳定性、人物/主体约束。"
                        @input="setVideoProjectVisualStyle($event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>

                  <div class="field writing-intro-field">
                    <span class="field-label">分镜总规划</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`video-project-storyboard-${activeVideoProject.id}`"
                      :app-name="VIDEO_APP_NAME"
                      label="分镜总规划"
                      :value="activeVideoProject.storyboardPlan"
                      :context="buildVideoProjectFieldAiContext('分镜总规划')"
                      :set-value="setVideoProjectStoryboardPlan"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-intro-textarea is-large"
                        :value="activeVideoProject.storyboardPlan"
                        placeholder="按镜头写下开场、推进、高潮和收束，明确每个镜头的主体、运动、景别和转场。"
                        @input="setVideoProjectStoryboardPlan($event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>
                </div>

                <div v-else-if="ui.marketplace.video.activeTab === 'storyboard'" class="writing-outline-board">
                  <div class="writing-chapter-list-panel">
                    <div class="writing-chapter-panel-head">
                      <div>
                        <p class="feature-kicker">Shot List</p>
                        <p class="writing-panel-title">{{ activeVideoShots.length }} 个镜头</p>
                      </div>
                      <button type="button" class="model-icon-button" aria-label="新增视频镜头" title="新增视频镜头" @click="createVideoShot">
                        <GIcon name="add" />
                      </button>
                    </div>

                    <div class="writing-chapter-list">
                      <button
                        v-for="(shot, index) in activeVideoShots"
                        :key="shot.id"
                        type="button"
                        class="writing-chapter-list-item"
                        :class="{
                          'is-active': activeVideoShot?.id === shot.id,
                          'is-done': shot.status === 'done',
                          'is-progress': shot.status === 'inProgress'
                        }"
                        @click="selectVideoShot(shot.id)"
                      >
                        <span class="writing-chapter-list-title-row">
                          <span class="writing-chapter-list-title">{{ getVideoShotDisplayTitle(shot, index) }}</span>
                        </span>
                        <span class="writing-chapter-list-meta">
                          <span class="status-pill" :class="getVideoShotStatusClass(shot.status)">
                            {{ getVideoShotStatusLabel(shot.status) }}
                          </span>
                          <span>{{ shot.durationSeconds }} 秒</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div v-if="activeVideoShot" class="writing-chapter-summary-panel">
                    <div class="writing-chapter-summary-head">
                      <div>
                        <p class="feature-kicker">Shot Brief</p>
                        <p class="writing-panel-title">镜头说明</p>
                      </div>
                      <span class="status-pill" :class="getVideoShotStatusClass(activeVideoShot.status)">
                        {{ getVideoShotStatusLabel(activeVideoShot.status) }}
                      </span>
                    </div>

                    <label class="field">
                      <span class="field-label">镜头标题</span>
                      <input
                        :value="activeVideoShot.title"
                        class="field-input"
                        @input="setVideoShotTitle(activeVideoShot, $event.target.value)"
                      />
                    </label>

                    <label class="field">
                      <span class="field-label">时长</span>
                      <input
                        :value="activeVideoShot.durationSeconds"
                        class="field-input"
                        type="number"
                        min="1"
                        max="600"
                        @input="setVideoShotDurationSeconds(activeVideoShot, $event.target.value)"
                      />
                    </label>

                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`video-shot-summary-${activeVideoShot.id}`"
                      :app-name="VIDEO_APP_NAME"
                      label="镜头说明"
                      :value="activeVideoShot.summary"
                      :context="buildVideoShotFieldAiContext(activeVideoShot, '镜头说明')"
                      :set-value="(value) => setVideoShotSummary(activeVideoShot, value)"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-chapter-summary-textarea"
                        :value="activeVideoShot.summary"
                        placeholder="主体、动作、镜头运动、景别、光线、情绪和转场。"
                        @input="setVideoShotSummary(activeVideoShot, $event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>

                    <div class="model-section-actions writing-chapter-summary-actions">
                      <button type="button" class="model-action-secondary" @click="goVideoShot(activeVideoShot.id)">
                        进入生成
                      </button>
                    </div>
                  </div>
                </div>

                <div v-else class="writing-chapter-workbench">
                  <div v-if="activeVideoShot" class="writing-chapter-commandbar">
                    <div class="writing-chapter-picker-row">
                      <div class="writing-chapter-picker">
                        <span class="field-label">当前镜头</span>
                        <div class="writing-chapter-dropdown" :class="{ 'is-open': ui.marketplace.video.isShotPickerOpen }">
                          <button
                            type="button"
                            class="writing-chapter-dropdown-trigger"
                            :aria-expanded="ui.marketplace.video.isShotPickerOpen ? 'true' : 'false'"
                            aria-haspopup="listbox"
                            @click="toggleVideoShotPicker"
                          >
                            <span>{{ getVideoShotDisplayTitle(activeVideoShot, activeVideoShotIndex) }}</span>
                            <GIcon name="chevronDown" />
                          </button>

                          <div
                            v-if="ui.marketplace.video.isShotPickerOpen"
                            ref="videoShotDropdownMenuRef"
                            class="writing-chapter-dropdown-menu"
                            role="listbox"
                          >
                            <button
                              v-for="entry in filteredVideoShotEntries"
                              :key="entry.shot.id"
                              type="button"
                              class="writing-chapter-dropdown-item"
                              :class="{ 'is-active': activeVideoShot?.id === entry.shot.id }"
                              role="option"
                              :aria-selected="activeVideoShot?.id === entry.shot.id ? 'true' : 'false'"
                              @click="selectVideoShotFromPicker(entry.shot.id)"
                            >
                              <span>{{ entry.title }}</span>
                              <small>
                                {{ getVideoShotStatusLabel(entry.shot.status) }} / {{ entry.shot.durationSeconds }} 秒
                              </small>
                            </button>
                            <p v-if="!filteredVideoShotEntries.length" class="writing-chapter-dropdown-empty">没有匹配镜头</p>
                          </div>
                        </div>
                      </div>

                      <label class="field writing-chapter-search-field">
                        <span class="field-label">搜索</span>
                        <input
                          v-model="ui.marketplace.video.shotSearchQuery"
                          class="field-input writing-chapter-search-input"
                          placeholder="镜头名"
                          @focus="setVideoShotPickerOpen(true)"
                        />
                      </label>
                    </div>

                    <span class="status-pill writing-chapter-status-pill" :class="getVideoShotStatusClass(activeVideoShot.status)">
                      {{ getVideoShotStatusLabel(activeVideoShot.status) }}
                    </span>

                    <button type="button" class="model-action writing-chapter-submit" @click="submitVideoShot">
                      提交
                    </button>
                  </div>

                  <div v-if="activeVideoShot" class="writing-chapter-brief-strip">
                    <strong>{{ getVideoShotDisplayTitle(activeVideoShot, activeVideoShotIndex) }}</strong>
                    <p>{{ activeVideoShot.summary || "这个镜头还没有说明。" }}</p>
                  </div>

                  <div v-if="activeVideoShot" class="field writing-intro-field">
                    <span class="field-label">参考素材 / 首帧说明</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`video-shot-reference-${activeVideoShot.id}`"
                      :app-name="VIDEO_APP_NAME"
                      label="参考素材 / 首帧说明"
                      :value="activeVideoShot.reference"
                      :context="buildVideoShotFieldAiContext(activeVideoShot, '参考素材 / 首帧说明')"
                      :set-value="(value) => setVideoShotReference(activeVideoShot, value)"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea video-reference-textarea"
                        :value="activeVideoShot.reference"
                        placeholder="可写素材路径、首帧图描述、参考图说明或连续性约束。"
                        @input="setVideoShotReference(activeVideoShot, $event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>

                  <div v-if="activeVideoShot" class="field writing-intro-field">
                    <span class="field-label">正向提示词</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`video-shot-prompt-${activeVideoShot.id}`"
                      :app-name="VIDEO_APP_NAME"
                      label="正向提示词"
                      :value="activeVideoShot.prompt"
                      :context="buildVideoShotFieldAiContext(activeVideoShot, '正向提示词')"
                      :set-value="(value) => setVideoShotPrompt(activeVideoShot, value)"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea video-prompt-textarea"
                        :value="activeVideoShot.prompt"
                        placeholder="主体、动作、镜头运动、光线、风格、画幅、时长和稳定性要求。"
                        @input="setVideoShotPrompt(activeVideoShot, $event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>

                  <div v-if="activeVideoShot" class="field writing-intro-field">
                    <span class="field-label">反向提示词</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`video-shot-negative-${activeVideoShot.id}`"
                      :app-name="VIDEO_APP_NAME"
                      label="反向提示词"
                      :value="activeVideoShot.negativePrompt"
                      :context="buildVideoShotFieldAiContext(activeVideoShot, '反向提示词')"
                      :set-value="(value) => setVideoShotNegativePrompt(activeVideoShot, value)"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea video-negative-textarea"
                        :value="activeVideoShot.negativePrompt"
                        placeholder="低清晰度、畸形、闪烁、水印、字幕、画面断裂、镜头失控等。"
                        @input="setVideoShotNegativePrompt(activeVideoShot, $event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>

                  <FieldAiOptimizer
                    v-if="activeVideoShot"
                    :actions="fieldAiActions"
                    :state="ui.marketplace.fieldAi"
                    :field-id="`video-shot-output-${activeVideoShot.id}`"
                    :app-name="VIDEO_APP_NAME"
                    label="生成结果"
                    :value="activeVideoShot.output"
                    :context="buildVideoShotFieldAiContext(activeVideoShot, '生成结果')"
                    :set-value="(value) => setVideoShotOutput(activeVideoShot, value)"
                  >
                    <textarea
                      class="field-textarea writing-editor-textarea writing-chapter-draft-textarea"
                      :value="activeVideoShot.output"
                      placeholder="这里沉淀生成结果、视频链接、参数记录或复跑笔记。"
                      @input="setVideoShotOutput(activeVideoShot, $event.target.value)"
                    ></textarea>
                  </FieldAiOptimizer>
                </div>
              </div>
            </section>
          </main>
        </section>
      </section>
    </template>

    <template v-else-if="ui.marketplace.view === 'comicDetail' && activeComicProject">
      <section class="writing-detail-shell comic-detail-shell">
        <header class="writing-detail-head comic-detail-head">
          <button type="button" class="model-icon-button weekly-back-button" aria-label="返回项目架" title="返回项目架" @click="backComicShelf">
            <GIcon name="return" />
          </button>

          <div class="writing-tab-bar writing-detail-head-tabs" role="tablist" aria-label="漫画项目详情模块">
            <button
              v-for="tab in COMIC_APP_TABS"
              :key="tab.id"
              type="button"
              class="writing-tab"
              :class="{ 'is-active': ui.marketplace.comic.activeTab === tab.id }"
              :aria-label="tab.label"
              :aria-selected="ui.marketplace.comic.activeTab === tab.id ? 'true' : 'false'"
              :title="tab.label"
              @click="setComicTab(tab.id)"
            >
              <span>{{ tab.kicker }}</span>
            </button>
          </div>

          <div class="model-section-actions">
            <span class="pill">{{ getComicProjectFormatLabel(activeComicProject.format) }}</span>
            <span class="pill pill-neutral">{{ getComicProjectPaletteLabel(activeComicProject.palette) }}</span>
            <button
              type="button"
              class="model-icon-button writing-ai-float-trigger"
              :aria-label="ui.marketplace.comic.isAiDrawerOpen ? '收起灵绘小筑' : '打开灵绘小筑'"
              :title="ui.marketplace.comic.isAiDrawerOpen ? '收起灵绘小筑' : '打开灵绘小筑'"
              @click="setComicAiDrawerOpen(!ui.marketplace.comic.isAiDrawerOpen)"
            >
              <GIcon name="sparkles" />
            </button>
          </div>
        </header>

        <section
          class="writing-detail-layout comic-detail-layout"
          :class="{
            'is-profile-collapsed': ui.marketplace.comic.isProfileCollapsed,
            'is-ai-open': ui.marketplace.comic.isAiDrawerOpen
          }"
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

                <label class="field writing-rail-title-field">
                  <span class="field-label">作品名称</span>
                  <input
                    :value="activeComicProject.title"
                    class="field-input writing-rail-title-input"
                    aria-label="漫画项目名"
                    @focus="rememberComicProjectTitleBaseline"
                    @input="setComicProjectTitle($event.target.value)"
                  />
                </label>

                <label class="field">
                  <span class="field-label">形态</span>
                  <GCompactSelect
                    :model-value="activeComicProject.format"
                    class="writing-mini-select"
                    aria-label="漫画项目形态"
                    :options="comicProjectFormatOptions"
                    @update:model-value="setComicProjectFormat"
                  />
                </label>

                <label class="field">
                  <span class="field-label">画面</span>
                  <GCompactSelect
                    :model-value="activeComicProject.palette"
                    class="writing-mini-select"
                    aria-label="漫画画面类型"
                    :options="comicProjectPaletteOptions"
                    @update:model-value="setComicProjectPalette"
                  />
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
                  <span class="pill pill-neutral">{{ activeComicProject.pageCount }} 页</span>
                  <span class="pill pill-neutral">{{ activeComicChapters.length }} 章</span>
                </div>
              </div>
            </div>

            <div v-if="!ui.marketplace.comic.isProfileCollapsed" class="writing-profile-actions">
              <span class="pill pill-neutral writing-profile-update-pill">更新 {{ formatWritingBookUpdatedAt(activeComicProject.updatedAt) }}</span>
              <button
                type="button"
                class="writing-mini-text-button"
                :disabled="ui.marketplace.comic.isExporting"
                :title="`导出 ${activeComicExportFileName}`"
                @click="openComicExportDialog"
              >
                导出
              </button>
            </div>
          </aside>

          <main class="writing-main-stage comic-main-stage">
            <section class="writing-editor-grid comic-editor-grid">
              <article class="comic-editor-surface">
                <div
                  v-if="ui.marketplace.comic.activeTab === 'intro'"
                  class="writing-intro-stack"
                  :class="{ 'comic-asset-stack': ui.marketplace.comic.introMode === 'assets' }"
                >
                  <div class="comic-intro-mode-actions comic-intro-mode-actions-inline">
                    <button
                      type="button"
                      class="model-action-secondary comic-intro-mode-button"
                      :class="{ 'is-active': ui.marketplace.comic.introMode !== 'assets' }"
                      @click="setComicIntroMode('settings')"
                    >
                      项目设定
                    </button>
                    <button
                      type="button"
                      class="model-action-secondary comic-intro-mode-button"
                      :class="{ 'is-active': ui.marketplace.comic.introMode === 'assets' }"
                      @click="setComicIntroMode('assets')"
                    >
                      素材库
                    </button>
                  </div>

                  <template v-if="ui.marketplace.comic.introMode !== 'assets'">
                  <div class="field writing-intro-field">
                    <span class="field-label">故事与画面目标</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`comic-project-summary-${activeComicProject.id}`"
                      :app-name="COMIC_APP_NAME"
                      label="故事与画面目标"
                      :value="activeComicProject.summary"
                      :context="buildComicProjectFieldAiContext('故事与画面目标')"
                      :set-value="setComicProjectSummary"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-intro-textarea"
                        :value="activeComicProject.summary"
                        placeholder="主角、世界观、冲突、核心画面和这组漫画要留下的情绪。"
                        @input="setComicProjectSummary($event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>

                  <div class="field writing-intro-field">
                    <span class="field-label">画风与镜头</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`comic-project-visual-${activeComicProject.id}`"
                      :app-name="COMIC_APP_NAME"
                      label="画风与镜头"
                      :value="activeComicProject.visualStyle"
                      :context="buildComicProjectFieldAiContext('画风与镜头')"
                      :set-value="setComicProjectVisualStyle"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-intro-textarea is-large"
                        :value="activeComicProject.visualStyle"
                        placeholder="线条、色彩、构图、角色造型、分镜节奏和参考风格。"
                        @input="setComicProjectVisualStyle($event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>

                  <div class="field writing-intro-field">
                    <span class="field-label">{{ activeComicProject.format === 'serial' ? '连载总规划' : '海报构图规划' }}</span>
                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`comic-project-plan-${activeComicProject.id}`"
                      :app-name="COMIC_APP_NAME"
                      :label="activeComicProject.format === 'serial' ? '连载总规划' : '海报构图规划'"
                      :value="activeComicProject.episodePlan"
                      :context="buildComicProjectFieldAiContext(activeComicProject.format === 'serial' ? '连载总规划' : '海报构图规划')"
                      :set-value="setComicProjectEpisodePlan"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-intro-textarea is-large"
                        :value="activeComicProject.episodePlan"
                        :placeholder="activeComicProject.format === 'serial' ? '按篇章写下主要剧情、角色成长、每话节奏和结尾钩子。' : '写下主体、背景、人物站位、文字区域和最终出图比例。'"
                        @input="setComicProjectEpisodePlan($event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>
                  </div>
                  </template>

                  <div v-else class="comic-asset-library" :class="{ 'is-list-collapsed': ui.marketplace.comic.isAssetRailCollapsed }">
                    <section class="comic-asset-list-panel" :class="{ 'is-collapsed': ui.marketplace.comic.isAssetRailCollapsed }">
                      <div class="comic-asset-panel-head">
                        <div v-if="!ui.marketplace.comic.isAssetRailCollapsed">
                          <p class="feature-kicker">Asset Library</p>
                          <p class="writing-panel-title">{{ activeComicAssets.length }} 个素材</p>
                        </div>
                        <button
                          type="button"
                          class="model-icon-button comic-asset-rail-toggle"
                          :aria-label="ui.marketplace.comic.isAssetRailCollapsed ? '展开素材列表' : '折叠素材列表'"
                          :title="ui.marketplace.comic.isAssetRailCollapsed ? '展开素材列表' : '折叠素材列表'"
                          @click="toggleComicAssetRail"
                        >
                          <GIcon :name="ui.marketplace.comic.isAssetRailCollapsed ? 'chevronRight' : 'chevronLeft'" :size="14" />
                        </button>
                      </div>

                      <div v-if="!ui.marketplace.comic.isAssetRailCollapsed" class="comic-asset-create-row">
                        <button
                          v-for="option in comicAssetTypeOptions"
                          :key="option.value"
                          type="button"
                          class="comic-asset-create-button"
                          @click="createComicAsset(option.value)"
                        >
                          <GIcon name="add" :size="12" />
                          {{ option.label }}
                        </button>
                      </div>

                      <div v-if="!ui.marketplace.comic.isAssetRailCollapsed" class="comic-asset-list" :class="{ 'is-empty': !activeComicAssets.length }">
                        <button
                          v-for="asset in activeComicAssets"
                          :key="asset.id"
                          type="button"
                          class="comic-asset-list-item"
                          :class="{ 'is-active': activeComicAsset?.id === asset.id }"
                          @click="selectComicAsset(asset.id)"
                        >
                          <span class="comic-asset-list-main">
                            <strong>{{ asset.name }}</strong>
                            <small>{{ getComicAssetTypeLabel(asset.type) }} / {{ getComicAssetViewCountLabel(asset) }}</small>
                          </span>
                          <span v-if="getComicAssetPreviewViews(asset).length" class="comic-asset-list-thumbs" aria-hidden="true">
                            <img
                              v-for="view in getComicAssetPreviewViews(asset)"
                              :key="view.id"
                              :src="view.src"
                              :alt="view.label"
                            />
                          </span>
                        </button>
                        <p v-if="!activeComicAssets.length" class="comic-asset-empty-text">暂无素材</p>
                      </div>
                      <div v-else class="comic-asset-collapsed-count" aria-hidden="true">
                        {{ activeComicAssets.length }}
                      </div>
                    </section>

                    <section v-if="activeComicAsset" class="comic-asset-detail-panel">
                      <div class="comic-asset-detail-head">
                        <div>
                          <p class="feature-kicker">{{ getComicAssetTypeLabel(activeComicAsset.type) }}</p>
                          <p class="writing-panel-title">{{ activeComicAsset.name }}</p>
                        </div>
                        <button
                          type="button"
                          class="model-icon-button comic-asset-delete-button"
                          aria-label="删除素材"
                          title="删除素材"
                          @click="deleteComicAsset(activeComicAsset.id)"
                        >
                          <GIcon name="delete" :size="14" />
                        </button>
                      </div>

                      <div class="comic-asset-form-grid">
                        <label class="field">
                          <span class="field-label">唯一命名</span>
                          <input
                            :value="activeComicAsset.name"
                            class="field-input"
                            @focus="rememberComicAssetNameBaseline(activeComicAsset.id)"
                            @input="setComicAssetName(activeComicAsset.id, $event.target.value)"
                          />
                        </label>

                        <label class="field">
                          <span class="field-label">类型</span>
                          <GCompactSelect
                            :model-value="activeComicAsset.type"
                            class="writing-mini-select"
                            aria-label="素材类型"
                            :options="comicAssetTypeOptions"
                            @update:model-value="(value) => setComicAssetType(activeComicAsset.id, value)"
                          />
                        </label>

                        <label class="field field-full">
                          <span class="field-label">描述</span>
                          <textarea
                            :value="activeComicAsset.description"
                            class="field-textarea writing-editor-textarea comic-asset-description-textarea"
                            @input="setComicAssetDescription(activeComicAsset.id, $event.target.value)"
                          ></textarea>
                        </label>

                        <label class="field field-full">
                          <span class="field-label">素材提示词</span>
                          <textarea
                            :value="activeComicAsset.prompt"
                            class="field-textarea writing-editor-textarea comic-asset-prompt-textarea"
                            @input="setComicAssetPrompt(activeComicAsset.id, $event.target.value)"
                          ></textarea>
                        </label>
                      </div>

                      <div class="comic-asset-views-head">
                        <span class="field-label">视图图片</span>
                        <button type="button" class="comic-asset-create-button" @click="addComicAssetView(activeComicAsset.id)">
                          <GIcon name="add" :size="12" />
                          添加视图
                        </button>
                      </div>

                      <div class="comic-asset-view-list">
                        <article
                          v-for="view in activeComicAsset.views"
                          :key="view.id"
                          class="comic-asset-view-card"
                        >
                          <div class="comic-asset-view-head">
                            <GCompactSelect
                              :model-value="view.kind"
                              class="writing-mini-select"
                              aria-label="素材视图类型"
                              :options="comicAssetViewKindOptions"
                              @update:model-value="(value) => setComicAssetViewField(activeComicAsset.id, view.id, 'kind', value)"
                            />
                            <input
                              :value="view.label"
                              class="field-input"
                              :placeholder="getComicAssetViewKindLabel(view.kind)"
                              @input="setComicAssetViewField(activeComicAsset.id, view.id, 'label', $event.target.value)"
                            />
                            <button
                              type="button"
                              class="model-icon-button comic-asset-view-delete"
                              aria-label="删除视图"
                              title="删除视图"
                              @click="removeComicAssetView(activeComicAsset.id, view.id)"
                            >
                              <GIcon name="delete" :size="13" />
                            </button>
                          </div>

                          <label class="field">
                            <span class="field-label">图片源</span>
                            <input
                              :value="view.src"
                              class="field-input"
                              placeholder="URL / data URL / base64"
                              @input="setComicAssetViewField(activeComicAsset.id, view.id, 'src', $event.target.value)"
                            />
                          </label>

                          <div v-if="view.src" class="comic-asset-view-preview">
                            <img :src="view.src" :alt="view.label || getComicAssetViewKindLabel(view.kind)" />
                          </div>

                          <label class="field">
                            <span class="field-label">视图提示词</span>
                            <textarea
                              :value="view.prompt"
                              class="field-textarea writing-editor-textarea comic-asset-view-prompt"
                              @input="setComicAssetViewField(activeComicAsset.id, view.id, 'prompt', $event.target.value)"
                            ></textarea>
                          </label>
                        </article>
                      </div>
                    </section>

                    <section v-else class="comic-asset-detail-empty">
                      <GIcon name="image" :size="22" />
                      <strong>创建素材后管理引用</strong>
                    </section>
                  </div>
                </div>

                <div v-else-if="ui.marketplace.comic.activeTab === 'outline'" class="writing-outline-board">
                  <div class="writing-chapter-list-panel">
                    <div class="writing-chapter-panel-head">
                      <div>
                        <p class="feature-kicker">Chapter List</p>
                        <p class="writing-panel-title">{{ activeComicChapters.length }} 个章节</p>
                      </div>
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

                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`comic-chapter-summary-${activeComicChapter.id}`"
                      :app-name="COMIC_APP_NAME"
                      label="分镜简介"
                      :value="activeComicChapter.summary"
                      :context="buildComicChapterFieldAiContext(activeComicChapter, '分镜简介')"
                      :set-value="(value) => setComicChapterSummary(activeComicChapter, value)"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-chapter-summary-textarea"
                        :value="activeComicChapter.summary"
                        placeholder="写下本章画面目标、分镜顺序、角色动作、对白密度和结尾画面。"
                        @input="setComicChapterSummary(activeComicChapter, $event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>

                    <div class="model-section-actions writing-chapter-summary-actions">
                      <button type="button" class="model-action-secondary" @click="goComicChapter(activeComicChapter.id)">
                        进入生成
                      </button>
                    </div>
                  </div>
                </div>

                <div v-else class="writing-chapter-workbench comic-chapter-workbench">
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

                    <span class="status-pill">{{ activeComicChapterImageCountLabel }}</span>

                    <span class="status-pill writing-chapter-status-pill" :class="getComicChapterStatusClass(activeComicChapter.status)">
                      {{ getComicChapterStatusLabel(activeComicChapter.status) }}
                    </span>

                    <button type="button" class="model-action writing-chapter-submit" @click="submitComicChapter">
                      提交
                    </button>
                  </div>

                  <div v-if="activeComicChapter" class="comic-chapter-visual-workspace">
                    <section
                      class="comic-chapter-image-stage"
                      :class="{ 'is-empty': !activeComicChapterImages.length }"
                      aria-label="当前章节图片展示"
                    >

                      <div v-if="activeComicChapterImages.length" class="comic-chapter-image-list">
                        <figure
                          v-for="(image, index) in activeComicChapterImages"
                          :key="image.id || `${image.src}-${index}`"
                          class="comic-chapter-image-item"
                          :class="{ 'is-active': activeComicChapterImage?.id === image.id }"
                          role="button"
                          tabindex="0"
                          :aria-pressed="activeComicChapterImage?.id === image.id ? 'true' : 'false'"
                          @click="selectComicChapterImage(image.id)"
                          @keydown.enter.prevent="selectComicChapterImage(image.id)"
                          @keydown.space.prevent="selectComicChapterImage(image.id)"
                        >
                          <div class="comic-chapter-image-frame">
                            <img :src="image.src" :alt="image.alt || `漫画章节图片 ${index + 1}`" />
                          </div>
                          <figcaption>
                            <span>{{ image.alt || `画面 ${index + 1}` }}</span>
                            <small>{{ getComicChapterDisplayTitle(activeComicChapter, activeComicChapterIndex) }}</small>
                          </figcaption>
                        </figure>
                      </div>

                      <div v-else class="comic-chapter-image-empty">
                        <div class="comic-chapter-image-empty-mark" aria-hidden="true">
                          <GIcon name="image" />
                        </div>
                        <strong>暂无章节图片</strong>
                        <p>通过右侧灵绘小筑生成图片并写入当前章节后，会在这里展示漫画画面。</p>
                      </div>
                    </section>

                    <aside class="comic-chapter-inspector" aria-label="当前章节图片信息">
                      <details class="comic-inspector-fold comic-asset-ref-fold" open>
                        <summary>
                          <span>引用素材 <small>{{ activeComicChapterAssets.length }} 个</small></span>
                          <GIcon name="chevronDown" />
                        </summary>
                        <div class="comic-asset-ref-list" :class="{ 'is-empty': !activeComicAssets.length }">
                          <button
                            v-for="asset in activeComicAssets"
                            :key="asset.id"
                            type="button"
                            class="comic-asset-ref-chip"
                            :class="{ 'is-active': isComicChapterAssetReferenced(activeComicChapter, asset.id) }"
                            @click="toggleComicChapterAssetRef(activeComicChapter, asset.id)"
                          >
                            <span class="comic-asset-ref-copy">
                              <strong>{{ asset.name }}</strong>
                              <small>{{ getComicAssetTypeLabel(asset.type) }} / {{ getComicAssetViewCountLabel(asset) }}</small>
                            </span>
                            <span v-if="getComicAssetPreviewViews(asset, 2).length" class="comic-asset-ref-thumbs" aria-hidden="true">
                              <img
                                v-for="view in getComicAssetPreviewViews(asset, 2)"
                                :key="view.id"
                                :src="view.src"
                                :alt="view.label"
                              />
                            </span>
                          </button>
                          <p v-if="!activeComicAssets.length" class="comic-asset-empty-text">素材库暂无素材</p>
                        </div>
                      </details>

                      <template v-if="activeComicChapterImage">
                        <section class="comic-selected-image-panel">
                          <div>
                            <p class="feature-kicker">Selected Image</p>
                            <h3>{{ activeComicChapterImage.alt || `画面 ${activeComicChapterImageIndex + 1}` }}</h3>
                          </div>
                          <span class="status-pill">{{ activeComicChapterImageIndex + 1 }} / {{ activeComicChapterImages.length }}</span>
                        </section>

                        <details class="comic-inspector-fold" open>
                          <summary>
                            <span>图片参数</span>
                            <GIcon name="chevronDown" />
                          </summary>
                          <dl class="comic-image-param-list">
                            <div>
                              <dt>图片 ID</dt>
                              <dd :title="activeComicChapterImage.id">{{ activeComicChapterImage.id }}</dd>
                            </div>
                            <div>
                              <dt>尺寸</dt>
                              <dd>{{ getComicImageParamValue(activeComicChapterImage.size) }}</dd>
                            </div>
                            <div>
                              <dt>质量</dt>
                              <dd>{{ getComicImageParamValue(activeComicChapterImage.quality) }}</dd>
                            </div>
                            <div>
                              <dt>生成时间</dt>
                              <dd>{{ formatComicImageCreatedAt(activeComicChapterImage.createdAt) }}</dd>
                            </div>
                            <div>
                              <dt>章节状态</dt>
                              <dd>{{ getComicChapterStatusLabel(activeComicChapter.status) }}</dd>
                            </div>
                            <div>
                              <dt>引用素材</dt>
                              <dd>{{ activeComicChapterAssets.length }} 个</dd>
                            </div>
                          </dl>
                        </details>

                        <details class="comic-inspector-fold" open>
                          <summary>
                            <span>生图提示词</span>
                            <GIcon name="chevronDown" />
                          </summary>
                          <div class="field writing-intro-field comic-inspector-field">
                            <FieldAiOptimizer
                              :actions="fieldAiActions"
                              :state="ui.marketplace.fieldAi"
                              :field-id="`comic-chapter-image-prompt-${activeComicChapter.id}-${activeComicChapterImage.id}`"
                              :app-name="COMIC_APP_NAME"
                              label="生图提示词"
                              :value="activeComicChapterImage.prompt"
                              :context="buildComicChapterImageFieldAiContext(activeComicChapter, activeComicChapterImage, '生图提示词')"
                              :set-value="(value) => setComicChapterImagePrompt(activeComicChapter, activeComicChapterImage.id, value)"
                            >
                              <textarea
                                class="field-textarea writing-editor-textarea comic-prompt-textarea"
                                :value="activeComicChapterImage.prompt"
                                placeholder="写下这张图的角色、构图、景别、动作、场景、光线、色彩和一致性约束。"
                                @input="setComicChapterImagePrompt(activeComicChapter, activeComicChapterImage.id, $event.target.value)"
                              ></textarea>
                            </FieldAiOptimizer>
                          </div>
                        </details>
                      </template>

                      <section v-else class="comic-selected-image-panel is-empty">
                        <div>
                          <p class="feature-kicker">Selected Image</p>
                          <h3>暂无选中图片</h3>
                        </div>
                        <p>生成并写入图片后，右侧会按选中图片显示参数和生图提示词。</p>
                      </section>
                    </aside>
                  </div>
                </div>
              </article>

              <ComicAiDrawer
                v-if="ui.marketplace.comic.isAiDrawerOpen"
                :state="ui.marketplace.comic"
                :active-comic-ai-task="activeComicAiTask"
                :active-comic-ai-task-options="activeComicAiTaskOptions"
                :active-comic-ai-prompt-preview="activeComicAiPromptPreview"
                :comic-ai-image-size-options="comicAiImageSizeOptions"
                :comic-ai-quality-options="comicAiQualityOptions"
                :toggle-comic-ai-task-picker="toggleComicAiTaskPicker"
                :select-comic-ai-task="selectComicAiTask"
                :toggle-comic-ai-prompt-preview="toggleComicAiPromptPreview"
                :set-comic-ai-instruction="setComicAiInstruction"
                :set-comic-ai-output="setComicAiOutput"
                :set-comic-ai-image-count="setComicAiImageCount"
                :set-comic-ai-image-size="setComicAiImageSize"
                :set-comic-ai-image-quality="setComicAiImageQuality"
                :generate-comic-ai-output="generateComicAiOutput"
                :get-comic-ai-run-button-label="getComicAiRunButtonLabel"
                :get-comic-ai-feedback-class="getComicAiFeedbackClass"
                :apply-comic-ai-output="applyComicAiOutput"
              />
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

          <div class="writing-tab-bar writing-detail-head-tabs" role="tablist" aria-label="书籍详情模块">
            <button
              v-for="tab in WRITING_APP_TABS"
              :key="tab.id"
              type="button"
              class="writing-tab"
              :class="{ 'is-active': ui.marketplace.writing.activeTab === tab.id }"
              :aria-label="tab.label"
              :aria-selected="ui.marketplace.writing.activeTab === tab.id ? 'true' : 'false'"
              :disabled="isActiveWritingBookAiRunning"
              :title="tab.label"
              @click="setWritingTab(tab.id)"
            >
              <span>{{ tab.kicker }}</span>
            </button>
          </div>

          <div class="model-section-actions">
            <span class="pill">{{ activeWritingLengthProfile.label }}</span>
            <span class="pill pill-neutral">{{ getWritingTabWordCount() }} 字</span>
            <button
              type="button"
              class="model-icon-button writing-ai-float-trigger"
              :aria-label="ui.marketplace.writing.isAiDrawerOpen ? '收起添香小筑' : '打开添香小筑'"
              :title="ui.marketplace.writing.isAiDrawerOpen ? '收起添香小筑' : '打开添香小筑'"
              @click="setWritingAiDrawerOpen(!ui.marketplace.writing.isAiDrawerOpen)"
            >
              <GIcon name="sparkles" />
            </button>
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
                <label class="field writing-rail-title-field">
                  <span class="field-label">书名</span>
                  <input
                    :value="activeWritingBook.title"
                    class="field-input writing-rail-title-input"
                    aria-label="书名"
                    :disabled="isActiveWritingBookAiRunning"
                    @focus="rememberWritingBookTitleBaseline"
                    @input="setWritingBookTitle($event.target.value)"
                  />
                </label>
                <label class="field">
                  <span class="field-label">篇幅</span>
                  <GCompactSelect
                    :model-value="activeWritingBook.length"
                    class="writing-mini-select"
                    aria-label="书籍篇幅"
                    :options="writingLengthOptions"
                    @update:model-value="setWritingBookLength"
                  />
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
                <span class="pill pill-neutral">总字数 {{ getWritingBookWordCount(activeWritingBook) }}</span>
              </div>
            </div>

            <div v-if="!ui.marketplace.writing.isProfileCollapsed" class="writing-profile-actions">
              <span class="pill pill-neutral writing-profile-update-pill">更新 {{ formatWritingBookUpdatedAt(activeWritingBook.updatedAt) }}</span>
              <button
                type="button"
                class="writing-mini-text-button"
                :disabled="isActiveWritingBookAiRunning"
                @click="openWritingExportDialog"
              >
                导出
              </button>
            </div>
          </aside>

          <main class="writing-main-stage">
            <section class="writing-editor-grid">
              <div class="writing-editor-surface">
                <div v-if="ui.marketplace.writing.activeTab === 'intro'" class="writing-intro-stack">
                  <section
                    v-for="section in activeWritingIntroSections"
                    :key="section.key"
                    class="writing-intro-card"
                    :class="{ 'is-collapsed': isWritingIntroSectionCollapsed(section.key) }"
                  >
                    <div class="writing-intro-card-head">
                      <button
                        type="button"
                        class="writing-intro-toggle"
                        :aria-expanded="String(!isWritingIntroSectionCollapsed(section.key))"
                        :aria-label="isWritingIntroSectionCollapsed(section.key) ? `展开${section.label}` : `折叠${section.label}`"
                        :title="isWritingIntroSectionCollapsed(section.key) ? '展开' : '折叠'"
                        @click="toggleWritingIntroSectionCollapsed(section.key)"
                      >
                        <GIcon :name="isWritingIntroSectionCollapsed(section.key) ? 'chevronRight' : 'chevronDown'" />
                      </button>
                      <div class="writing-intro-card-title">
                        <span class="field-label">{{ section.label }}</span>
                      </div>
                      <span class="status-pill">{{ getWritingIntroFieldWordCount(activeWritingBook, section.key) }} 字</span>
                    </div>

                    <div v-if="!isWritingIntroSectionCollapsed(section.key)" class="writing-intro-card-body">
                      <FieldAiOptimizer
                        :actions="fieldAiActions"
                        :state="ui.marketplace.fieldAi"
                        :field-id="`writing-intro-${activeWritingBook.id}-${section.key}`"
                        :app-name="WRITING_APP_NAME"
                        :label="section.label"
                        :value="getWritingIntroFieldValue(activeWritingBook, section.key)"
                        :context="buildWritingBookFieldAiContext(section.label)"
                        :disabled="isActiveWritingBookAiRunning"
                        :set-value="(value) => setWritingIntroField(activeWritingBook, section.key, value)"
                      >
                        <textarea
                          class="field-textarea writing-editor-textarea writing-intro-textarea"
                          :class="{ 'is-large': section.key !== 'intro' }"
                          :value="getWritingIntroFieldValue(activeWritingBook, section.key)"
                          :placeholder="section.placeholder"
                          @input="setWritingIntroField(activeWritingBook, section.key, $event.target.value)"
                        ></textarea>
                      </FieldAiOptimizer>
                    </div>
                  </section>

                  <section
                    v-for="section in activeWritingExtraIntroSections"
                    :key="section.id"
                    class="writing-intro-card writing-intro-card-extra"
                    :class="{ 'is-collapsed': isWritingIntroSectionCollapsed(section.id, 'extra') }"
                  >
                    <div class="writing-intro-card-head writing-intro-extra-head">
                      <button
                        type="button"
                        class="writing-intro-toggle"
                        :aria-expanded="String(!isWritingIntroSectionCollapsed(section.id, 'extra'))"
                        :aria-label="isWritingIntroSectionCollapsed(section.id, 'extra') ? `展开${section.title || '补充设定'}` : `折叠${section.title || '补充设定'}`"
                        :title="isWritingIntroSectionCollapsed(section.id, 'extra') ? '展开' : '折叠'"
                        @click="toggleWritingIntroSectionCollapsed(section.id, 'extra')"
                      >
                        <GIcon :name="isWritingIntroSectionCollapsed(section.id, 'extra') ? 'chevronRight' : 'chevronDown'" />
                      </button>
                      <input
                        class="field-input writing-intro-title-input"
                        :value="section.title"
                        placeholder="设定条目标题"
                        @focus="rememberWritingExtraIntroSectionTitleBaseline(section.id)"
                        @input="setWritingExtraIntroSectionTitle(section.id, $event.target.value)"
                      />
                      <span class="status-pill">{{ getWritingExtraIntroSectionWordCount(section) }} 字</span>
                      <button
                        type="button"
                        class="model-icon-button model-icon-button-danger writing-intro-delete"
                        aria-label="删除设定条目"
                        title="删除设定条目"
                        @click="removeWritingExtraIntroSection(section.id)"
                      >
                        <GIcon name="delete" />
                      </button>
                    </div>

                    <div v-if="!isWritingIntroSectionCollapsed(section.id, 'extra')" class="writing-intro-card-body">
                      <FieldAiOptimizer
                        :actions="fieldAiActions"
                        :state="ui.marketplace.fieldAi"
                        :field-id="`writing-extra-intro-${activeWritingBook.id}-${section.id}`"
                        :app-name="WRITING_APP_NAME"
                        :label="section.title || '补充设定'"
                        :value="section.content"
                        :context="buildWritingExtraFieldAiContext(section)"
                        :disabled="isActiveWritingBookAiRunning"
                        :set-value="(value) => setWritingExtraIntroSectionContent(section.id, value)"
                      >
                        <textarea
                          class="field-textarea writing-editor-textarea writing-intro-textarea is-large"
                          :value="section.content"
                          placeholder="写下人物关系、怪物体系、战斗体系、修炼规则、组织结构或题材专属设定。"
                          @input="setWritingExtraIntroSectionContent(section.id, $event.target.value)"
                        ></textarea>
                      </FieldAiOptimizer>
                    </div>
                  </section>

                  <button type="button" class="writing-intro-add-button" @click="addWritingExtraIntroSection">
                    <GIcon name="add" />
                    新增设定
                  </button>
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

                    <FieldAiOptimizer
                      :actions="fieldAiActions"
                      :state="ui.marketplace.fieldAi"
                      :field-id="`writing-chapter-summary-${activeWritingChapter.id}`"
                      :app-name="WRITING_APP_NAME"
                      label="章节简介"
                      :value="activeWritingChapter.summary"
                      :context="buildWritingChapterFieldAiContext(activeWritingChapter, '章节简介')"
                      :disabled="isActiveWritingBookAiRunning"
                      :set-value="(value) => setWritingChapterSummary(activeWritingChapter, value)"
                    >
                      <textarea
                        class="field-textarea writing-editor-textarea writing-chapter-summary-textarea"
                        :value="activeWritingChapter.summary"
                        placeholder="写下本章目标、主要冲突、信息增量、人物变化和结尾钩子。"
                        @input="setWritingChapterSummary(activeWritingChapter, $event.target.value)"
                      ></textarea>
                    </FieldAiOptimizer>

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

                  <FieldAiOptimizer
                    v-if="activeWritingChapter"
                    :actions="fieldAiActions"
                    :state="ui.marketplace.fieldAi"
                    :field-id="`writing-chapter-content-${activeWritingChapter.id}`"
                    :app-name="WRITING_APP_NAME"
                    label="章节正文"
                    :value="activeWritingChapter.content"
                    :context="buildWritingChapterFieldAiContext(activeWritingChapter, '章节正文')"
                    :disabled="isActiveWritingBookAiRunning"
                    :set-value="(value) => setWritingChapterContent(activeWritingChapter, value)"
                  >
                    <textarea
                      class="field-textarea writing-editor-textarea writing-chapter-draft-textarea"
                      :value="activeWritingChapter.content"
                      placeholder="从这一章的第一个场景开始写。"
                      @input="setWritingChapterContent(activeWritingChapter, $event.target.value)"
                    ></textarea>
                  </FieldAiOptimizer>
                </div>
              </div>

              <WritingAiDrawer
                v-if="ui.marketplace.writing.isAiDrawerOpen"
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
            <div class="writing-ai-busy-card has-stop">
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
                type="button"
                class="writing-ai-busy-stop"
                aria-label="停止任务"
                title="停止任务"
                @click="cancelWritingAssistantRun"
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
    v-if="ui.marketplace.video.isExportDialogOpen"
    class="gordon-dialog-backdrop writing-export-backdrop"
    @click.self="closeVideoExportDialog"
  >
    <section class="gordon-dialog writing-export-dialog" role="dialog" aria-modal="true" aria-label="视频项目导出">
      <div class="gordon-dialog-head">
        <div class="gordon-dialog-mark writing-export-mark video-export-mark" aria-hidden="true">影</div>

        <div>
          <p class="gordon-dialog-kicker">Export</p>
          <h2 class="gordon-dialog-title">项目导出</h2>
        </div>
      </div>

      <p class="gordon-dialog-message">
        导出当前视频项目的项目设定、分镜规划、镜头提示词和生成结果，文件名固定为 {{ activeVideoExportFileName }}。
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
              :disabled="ui.marketplace.video.isExporting"
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
              :value="ui.marketplace.video.exportDirectory || '尚未选择目录'"
              readonly
            />
            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-secondary"
              :disabled="ui.marketplace.video.isExporting"
              @click="selectVideoExportDirectory"
            >
              选择目录
            </button>
          </div>
        </div>

        <div class="writing-export-summary">
          <span>镜头数量：{{ activeVideoShots.length }}</span>
          <span>导出文件：{{ activeVideoExportFileName }}</span>
        </div>
      </div>

      <p
        v-if="ui.marketplace.video.exportFeedback"
        class="writing-export-feedback"
        :class="`is-${ui.marketplace.video.exportFeedbackTone}`"
      >
        {{ ui.marketplace.video.exportFeedback }}
      </p>

      <div class="gordon-dialog-actions">
        <button
          type="button"
          class="gordon-dialog-button gordon-dialog-button-secondary"
          :disabled="ui.marketplace.video.isExporting"
          @click="closeVideoExportDialog"
        >
          取消
        </button>

        <button
          type="button"
          class="gordon-dialog-button gordon-dialog-button-primary"
          :disabled="!canExportActiveVideoProject"
          @click="exportActiveVideoProject"
        >
          {{ ui.marketplace.video.isExporting ? "保存中" : "确认" }}
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
</template>

<script setup>
import ComicAiDrawer from "./ComicAiDrawer.vue";
import FieldAiOptimizer from "./FieldAiOptimizer.vue";
import GCompactSelect from "../../components/GCompactSelect.vue";
import GIcon from "../../components/GIcon.vue";
import WritingAiDrawer from "../writing/WritingAiDrawer.vue";
import {
  COMIC_APP_NAME,
  COMIC_APP_TABS,
  COMIC_PROJECT_FORMAT_META,
  COMIC_PROJECT_PALETTE_META,
  COMIC_ASSET_TYPE_META,
  COMIC_ASSET_VIEW_KIND_META,
  FORTUNE_APP_NAME,
  FORTUNE_READING_MODES,
  MARKETPLACE_APP_COUNT,
  MUSIC_APP_NAME,
  MUSIC_CREATION_MODES,
  VIDEO_APP_NAME,
  VIDEO_APP_TABS,
  VIDEO_PROJECT_ASPECT_RATIO_META,
  VIDEO_PROJECT_MODE_META
} from "./marketplaceConfig.js";
import {
  WRITING_APP_NAME,
  WRITING_APP_TABS,
  WRITING_BOOK_EXPORT_FORMATS,
  WRITING_LENGTH_PROFILES
} from "../writing/writingConfig.js";

const props = defineProps({
  context: { type: Object, required: true }
});

const { comicActions, comicAiActions, fieldAiActions, fortuneActions, musicActions, refs, truncateText, ui, videoActions, writingActions, writingAiActions } =
  props.context;
const { comicChapterDropdownMenuRef, videoShotDropdownMenuRef, writingChapterDropdownMenuRef } = refs;

const {
  activeComicAsset,
  activeComicAssets,
  activeComicChapter,
  activeComicChapterAssets,
  activeComicChapterImage,
  activeComicChapterImageCountLabel,
  activeComicChapterImageIndex,
  activeComicChapterImages,
  activeComicChapterIndex,
  activeComicChapters,
  activeComicExportFileName,
  activeComicProject,
  backComicMarketplace,
  backComicShelf,
  canExportActiveComicProject,
  closeComicExportDialog,
  comicProjects,
  addComicAssetView,
  createComicAsset,
  createComicProject,
  deleteComicAsset,
  deleteComicProjectFromShelf,
  exportActiveComicProject,
  filteredComicChapterEntries,
  getComicAssetFilledViewCount,
  getComicAssetTypeLabel,
  getComicAssetViewKindLabel,
  getComicChapterDisplayTitle,
  getComicChapterReferencedAssets,
  getComicChapterStatusClass,
  getComicChapterStatusLabel,
  getComicProjectFormatLabel,
  getComicProjectPaletteLabel,
  goComicChapter,
  isComicChapterAssetReferenced,
  openComicAppShelf,
  openComicExportDialog,
  openComicProject,
  rememberComicAssetNameBaseline,
  rememberComicProjectTitleBaseline,
  removeComicAssetView,
  selectComicAsset,
  selectComicChapter,
  selectComicChapterImage,
  selectComicChapterFromPicker,
  selectComicExportDirectory,
  setComicAssetDescription,
  setComicAssetName,
  setComicAssetPrompt,
  setComicAssetType,
  setComicAssetViewField,
  setComicChapterImagePrompt,
  setComicChapterPickerOpen,
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
  setComicIntroMode,
  setComicTab,
  submitComicChapter,
  toggleComicAssetRail,
  toggleComicChapterAssetRef,
  toggleComicChapterPicker,
  toggleComicProfileRail
} = comicActions;

const {
  activeComicAiPromptPreview,
  activeComicAiTask,
  activeComicAiTaskOptions,
  applyComicAiOutput,
  comicAiImageSizeOptions,
  comicAiQualityOptions,
  generateComicAiOutput,
  getComicAiFeedbackClass,
  getComicAiRunButtonLabel,
  selectComicAiTask,
  setComicAiDrawerOpen,
  setComicAiImageCount,
  setComicAiImageQuality,
  setComicAiImageSize,
  setComicAiInstruction,
  setComicAiOutput,
  toggleComicAiPromptPreview,
  toggleComicAiTaskPicker
} = comicAiActions;

const comicAssetTypeOptions = Object.entries(COMIC_ASSET_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const comicAssetViewKindOptions = Object.entries(COMIC_ASSET_VIEW_KIND_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const comicProjectFormatOptions = Object.entries(COMIC_PROJECT_FORMAT_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const comicProjectPaletteOptions = Object.entries(COMIC_PROJECT_PALETTE_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const videoProjectModeOptions = Object.entries(VIDEO_PROJECT_MODE_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const videoProjectAspectRatioOptions = Object.entries(VIDEO_PROJECT_ASPECT_RATIO_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const writingLengthOptions = Object.entries(WRITING_LENGTH_PROFILES).map(([value, meta]) => ({
  value,
  label: meta.label
}));

const {
  activeVideoExportFileName,
  activeVideoProject,
  activeVideoShot,
  activeVideoShotIndex,
  activeVideoShots,
  backVideoMarketplace,
  backVideoShelf,
  canExportActiveVideoProject,
  closeVideoExportDialog,
  createVideoProject,
  createVideoShot,
  deleteVideoProjectFromShelf,
  exportActiveVideoProject,
  filteredVideoShotEntries,
  getVideoProjectAspectRatioLabel,
  getVideoProjectModeLabel,
  getVideoShotDisplayTitle,
  getVideoShotStatusClass,
  getVideoShotStatusLabel,
  getVideoTotalDuration,
  goVideoShot,
  openVideoAppShelf,
  openVideoExportDialog,
  openVideoProject,
  selectVideoExportDirectory,
  selectVideoShot,
  selectVideoShotFromPicker,
  setVideoProjectAspectRatio,
  setVideoProjectDurationSeconds,
  setVideoProjectGenre,
  setVideoProjectMode,
  setVideoProjectStoryboardPlan,
  setVideoProjectSummary,
  setVideoProjectTitle,
  setVideoProjectVisualStyle,
  setVideoShotDurationSeconds,
  setVideoShotNegativePrompt,
  setVideoShotOutput,
  setVideoShotPickerOpen,
  setVideoShotPrompt,
  setVideoShotReference,
  setVideoShotSummary,
  setVideoShotTitle,
  setVideoTab,
  submitVideoShot,
  toggleVideoProfileRail,
  toggleVideoShotPicker,
  videoProjects
} = videoActions;

const {
  activeFortuneModeMeta,
  backFortuneMarketplace,
  clearFortuneReading,
  generateFortuneReading,
  getFortuneFeedbackClass,
  openFortuneApp,
  setFortuneBirthInfo,
  setFortuneContext,
  setFortuneMode,
  setFortuneQuestion
} = fortuneActions;

const {
  activeMusicModeMeta,
  backMusicMarketplace,
  clearMusicOutput,
  generateMusicDraft,
  getMusicFeedbackClass,
  openMusicApp,
  setMusicMode,
  setMusicReference,
  setMusicStyle,
  setMusicTheme
} = musicActions;

const {
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingDoneChapterCount,
  activeWritingExportFileName,
  activeWritingExtraIntroSections,
  activeWritingIntroSections,
  activeWritingLengthProfile,
  activeWritingOutlinePlannerJob,
  activeWritingTask,
  activeWritingTaskOptions,
  backWritingMarketplace,
  backWritingShelf,
  canExportActiveWritingBook,
  closeWritingExportDialog,
  addWritingExtraIntroSection,
  createWritingBook,
  createWritingChapter,
  deleteWritingBookFromShelf,
  exportActiveWritingBook,
  filteredWritingChapterEntries,
  formatWritingBookUpdatedAt,
  getWritingAiFeedbackClass,
  getWritingBookWordCount,
  getWritingChapterDisplayTitle,
  getWritingChapterPartLabel,
  getWritingChapterStatusClass,
  getWritingChapterStatusLabel,
  getWritingChapterWordCount,
  getWritingExtraIntroSectionWordCount,
  getWritingIntroFieldWordCount,
  getWritingIntroFieldValue,
  getWritingLengthLabel,
  getWritingTabWordCount,
  goWritingChapter,
  handleWritingBookUpload,
  isActiveWritingBookAiRunning,
  isWritingIntroSectionCollapsed,
  isWritingChapterSubmitConfirmed,
  openWritingAppShelf,
  openWritingBook,
  openWritingExportDialog,
  rememberWritingBookTitleBaseline,
  rememberWritingExtraIntroSectionTitleBaseline,
  selectWritingAiTask,
  selectWritingChapter,
  selectWritingChapterFromPicker,
  selectWritingExportDirectory,
  setWritingAiDrawerOpen,
  setWritingBookGenre,
  setWritingBookLength,
  setWritingBookTitle,
  setWritingChapterContent,
  setWritingChapterPickerOpen,
  setWritingChapterSummary,
  setWritingChapterTitle,
  setWritingExtraIntroSectionContent,
  setWritingExtraIntroSectionTitle,
  setWritingExportFormat,
  setWritingIntroField,
  setWritingTab,
  submitWritingChapter,
  removeWritingExtraIntroSection,
  toggleWritingAiTaskPicker,
  toggleWritingChapterPicker,
  toggleWritingIntroSectionCollapsed,
  toggleWritingProfileRail,
  toggleWritingPromptPreview,
  writingBooks
} = writingActions;

const {
  activeWritingLongOutlineRequest,
  activeWritingPromptPreview,
  applyWritingAssistantOutput,
  buildWritingLongOutlineTargetContent,
  canResumeWritingOutlinePlanner,
  cancelWritingAssistantRun,
  generateWritingAssistantOutput,
  getWritingAiRunButtonLabel,
  getWritingBusyDescription,
  getWritingBusyTitle,
  getWritingOutlinePlannerProgressCopy,
  getWritingOutlinePlannerProgressPercent,
  getWritingOutlinePlannerRetryCopy,
  getWritingOutlinePlannerStatusClass,
  getWritingOutlinePlannerStatusLabel,
  isWritingOutlinePlannerRunning,
  resumeWritingOutlinePlanningJob
} = writingAiActions;

function compactFieldAiContext(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function getComicAssetPreviewViews(asset, limit = 3) {
  return (Array.isArray(asset?.views) ? asset.views : []).filter((view) => String(view?.src ?? "").trim()).slice(0, limit);
}

function getComicAssetViewCountLabel(asset) {
  const filledCount = getComicAssetFilledViewCount(asset);
  const totalCount = Array.isArray(asset?.views) ? asset.views.length : 0;
  return `${filledCount}/${totalCount} 图`;
}

function getComicImageParamValue(value) {
  return String(value ?? "").trim() || "未记录";
}

function formatComicImageCreatedAt(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "未记录";
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    return text.slice(0, 16).replace("T", " ");
  }

  return text;
}

function buildMusicFieldAiContext(fieldLabel) {
  return compactFieldAiContext([
    `创作类型：${activeMusicModeMeta.value?.label ?? ""}`,
    `创作重点：${activeMusicModeMeta.value?.focus ?? ""}`,
    fieldLabel === "主题 / 需求" ? `曲风 / 情绪 / 场景：${ui.marketplace.music.style}` : `主题 / 需求：${ui.marketplace.music.theme}`,
    `参考歌词 / 素材：${ui.marketplace.music.reference}`
  ]);
}

function buildFortuneFieldAiContext(fieldLabel) {
  return compactFieldAiContext([
    `解读类型：${activeFortuneModeMeta.value?.label ?? ""}`,
    `解读重点：${activeFortuneModeMeta.value?.focus ?? ""}`,
    fieldLabel === "关注问题" ? `出生 / 时间信息：${ui.marketplace.fortune.birthInfo}` : `关注问题：${ui.marketplace.fortune.question}`,
    `补充背景：${ui.marketplace.fortune.context}`
  ]);
}

function buildVideoProjectFieldAiContext(fieldLabel) {
  return compactFieldAiContext([
    `项目：${activeVideoProject.value?.title ?? ""}`,
    `类型：${activeVideoProject.value?.genre ?? ""}`,
    `模式：${getVideoProjectModeLabel(activeVideoProject.value?.mode)}`,
    `画幅：${getVideoProjectAspectRatioLabel(activeVideoProject.value?.aspectRatio)}`,
    fieldLabel === "主题与用途" ? "" : `主题与用途：${activeVideoProject.value?.summary ?? ""}`,
    fieldLabel === "视觉与运动风格" ? "" : `视觉与运动风格：${activeVideoProject.value?.visualStyle ?? ""}`,
    fieldLabel === "分镜总规划" ? "" : `分镜总规划：${activeVideoProject.value?.storyboardPlan ?? ""}`
  ]);
}

function buildVideoShotFieldAiContext(shot, fieldLabel) {
  return compactFieldAiContext([
    `项目：${activeVideoProject.value?.title ?? ""}`,
    `项目设定：${activeVideoProject.value?.summary ?? ""}`,
    `视觉风格：${activeVideoProject.value?.visualStyle ?? ""}`,
    `镜头：${shot ? getVideoShotDisplayTitle(shot, activeVideoShotIndex.value) : ""}`,
    fieldLabel === "镜头说明" ? "" : `镜头说明：${shot?.summary ?? ""}`,
    fieldLabel === "参考素材 / 首帧说明" ? "" : `参考素材：${shot?.reference ?? ""}`,
    fieldLabel === "正向提示词" ? "" : `正向提示词：${shot?.prompt ?? ""}`,
    fieldLabel === "反向提示词" ? "" : `反向提示词：${shot?.negativePrompt ?? ""}`
  ]);
}

function buildComicProjectFieldAiContext(fieldLabel) {
  return compactFieldAiContext([
    `项目：${activeComicProject.value?.title ?? ""}`,
    `类型：${activeComicProject.value?.genre ?? ""}`,
    `形态：${getComicProjectFormatLabel(activeComicProject.value?.format)}`,
    `画面：${getComicProjectPaletteLabel(activeComicProject.value?.palette)}`,
    `素材库：${activeComicAssets.value.length} 个素材`,
    fieldLabel === "故事与画面目标" ? "" : `故事与画面目标：${activeComicProject.value?.summary ?? ""}`,
    fieldLabel === "画风与镜头" ? "" : `画风与镜头：${activeComicProject.value?.visualStyle ?? ""}`,
    fieldLabel.includes("规划") ? "" : `规划：${activeComicProject.value?.episodePlan ?? ""}`
  ]);
}

function buildComicChapterFieldAiContext(chapter, fieldLabel) {
  const referencedAssets = getComicChapterReferencedAssets(chapter)
    .map((asset) => `${getComicAssetTypeLabel(asset.type)}「${asset.name}」`)
    .join("、");

  return compactFieldAiContext([
    `项目：${activeComicProject.value?.title ?? ""}`,
    `总介绍：${activeComicProject.value?.summary ?? ""}`,
    `画风与镜头：${activeComicProject.value?.visualStyle ?? ""}`,
    `章节：${chapter ? getComicChapterDisplayTitle(chapter, activeComicChapterIndex.value) : ""}`,
    `引用素材：${referencedAssets || "暂无"}`,
    fieldLabel === "分镜简介" ? "" : `分镜简介：${chapter?.summary ?? ""}`,
    fieldLabel === "生成提示词" ? "" : `生成提示词：${chapter?.prompt ?? ""}`
  ]);
}

function buildComicChapterImageFieldAiContext(chapter, image, fieldLabel) {
  return compactFieldAiContext([
    buildComicChapterFieldAiContext(chapter, fieldLabel),
    `当前图片：${image?.alt || "未命名画面"}`,
    `图片序号：${activeComicChapterImageIndex.value + 1} / ${activeComicChapterImages.value.length}`,
    `图片尺寸：${getComicImageParamValue(image?.size)}`,
    `图片质量：${getComicImageParamValue(image?.quality)}`,
    fieldLabel === "生图提示词" ? "" : `生图提示词：${image?.prompt ?? ""}`
  ]);
}

function buildWritingBookFieldAiContext(fieldLabel) {
  return compactFieldAiContext([
    `书名：${activeWritingBook.value?.title ?? ""}`,
    `类型：${activeWritingBook.value?.genre ?? ""}`,
    `篇幅：${getWritingLengthLabel(activeWritingBook.value?.length)}`,
    fieldLabel === "简短介绍" ? "" : `简短介绍：${getWritingIntroFieldValue(activeWritingBook.value, "intro")}`,
    fieldLabel === "大纲指导" ? "" : `大纲指导：${getWritingIntroFieldValue(activeWritingBook.value, "outlineGuide")}`,
    fieldLabel === "详细大纲指导" ? "" : `详细大纲指导：${getWritingIntroFieldValue(activeWritingBook.value, "seriesPlan")}`
  ]);
}

function buildWritingExtraFieldAiContext(section) {
  return compactFieldAiContext([
    buildWritingBookFieldAiContext(section?.title || "补充设定"),
    `当前设定条目：${section?.title || "补充设定"}`
  ]);
}

function buildWritingChapterFieldAiContext(chapter, fieldLabel) {
  return compactFieldAiContext([
    `书名：${activeWritingBook.value?.title ?? ""}`,
    `类型：${activeWritingBook.value?.genre ?? ""}`,
    `故事介绍：${getWritingIntroFieldValue(activeWritingBook.value, "intro")}`,
    `大纲指导：${getWritingIntroFieldValue(activeWritingBook.value, "outlineGuide")}`,
    `章节：${chapter ? getWritingChapterDisplayTitle(chapter, activeWritingChapterIndex.value) : ""}`,
    fieldLabel === "章节简介" ? "" : `章节简介：${chapter?.summary ?? ""}`
  ]);
}
</script>

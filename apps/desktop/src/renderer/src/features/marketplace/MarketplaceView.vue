<template>
<div
  class="workspace-stage workspace-stage-scroll"
  :class="{ 'workspace-stage-flush': ui.marketplace.view === 'writingDetail' || ui.marketplace.view === 'comicDetail' || ui.marketplace.view === 'videoDetail' || ui.marketplace.view === 'musicDetail' || ui.marketplace.view === 'fortune' }"
>
  <div
    class="marketplace-shell"
    :class="{
      'marketplace-shell-detail': ui.marketplace.view === 'writingDetail' || ui.marketplace.view === 'comicDetail' || ui.marketplace.view === 'videoDetail' || ui.marketplace.view === 'musicDetail' || ui.marketplace.view === 'fortune',
      'marketplace-shell-shelf': ui.marketplace.view === 'writingShelf' || ui.marketplace.view === 'comicShelf' || ui.marketplace.view === 'videoShelf' || ui.marketplace.view === 'musicShelf'
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

    <template v-else-if="ui.marketplace.view === 'musicShelf'">
      <section class="workflow-library-detail-head writing-shelf-head music-shelf-head">
        <div class="workflow-library-detail-head-side">
          <button type="button" class="model-icon-button weekly-back-button" aria-label="返回应用广场" title="返回应用广场" @click="backMusicMarketplace">
            <GIcon name="return" />
          </button>
        </div>

        <div class="workflow-library-detail-head-center">
          <p class="workflow-library-detail-title">{{ MUSIC_APP_NAME }}</p>
        </div>

        <div class="workflow-library-detail-head-side workflow-library-detail-head-side-end">
          <span class="status-pill">{{ musicProjects.length }} 张专辑</span>
          <button type="button" class="model-icon-button" aria-label="新建音乐专辑" title="新建音乐专辑" @click="createMusicProject">
            <GIcon name="add" />
          </button>
        </div>
      </section>

      <section class="writing-shelf-grid music-project-grid" :class="{ 'is-empty': !musicProjects.length }">
        <p v-if="!musicProjects.length" class="writing-shelf-empty" role="status">暂无音乐专辑</p>
        <article
          v-for="project in musicProjects"
          :key="project.id"
          class="writing-book-card music-project-card"
          :class="`is-${project.coverTone}`"
          role="button"
          tabindex="0"
          :aria-label="`打开${project.title}`"
          @click="openMusicProject(project.id)"
          @keydown.enter.prevent="openMusicProject(project.id)"
          @keydown.space.prevent="openMusicProject(project.id)"
        >
          <button
            type="button"
            class="shelf-card-delete"
            aria-label="删除音乐专辑"
            @click.stop="deleteMusicProjectFromWorkbench(project.id)"
            @keydown.enter.stop
            @keydown.space.stop
          >
            <GIcon name="delete" :size="12" />
          </button>
          <div class="music-album-cover music-project-cover" :class="`is-${project.coverTone}`" aria-hidden="true">
            <img v-if="project.coverUrl" :src="project.coverUrl" :alt="`${project.title} 封面`" />
            <span v-else>{{ project.title.slice(0, 1) || "音" }}</span>
          </div>
          <div class="writing-book-card-main">
            <div>
              <p class="writing-book-title">{{ project.title }}</p>
              <p class="writing-book-meta">{{ project.artist }} / {{ project.genre }}</p>
            </div>
            <p class="models-copy">{{ truncateText(project.summary || project.mood, 98) }}</p>
            <div class="writing-book-card-foot">
              <span class="pill">{{ project.status }}</span>
              <span class="pill pill-neutral">{{ project.tracks.length }} 首</span>
              <span class="pill pill-neutral">{{ getMusicProjectFinishedCount(project) }} 成品</span>
            </div>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="ui.marketplace.view === 'musicDetail' && activeMusicProject">
      <section class="writing-detail-shell music-detail-shell">
        <header class="writing-detail-head music-detail-head">
          <button type="button" class="model-icon-button weekly-back-button" aria-label="返回专辑列表" title="返回专辑列表" @click="backMusicShelf">
            <GIcon name="return" />
          </button>

          <div class="writing-tab-bar writing-detail-head-tabs" role="tablist" aria-label="音乐专辑详情模块">
            <button
              v-for="tab in MUSIC_APP_TABS"
              :key="tab.id"
              type="button"
              class="writing-tab"
              :class="{ 'is-active': ui.marketplace.music.activeTab === tab.id }"
              :aria-label="tab.label"
              :aria-selected="ui.marketplace.music.activeTab === tab.id ? 'true' : 'false'"
              :title="tab.label"
              @click="setMusicTab(tab.id)"
            >
              <span>{{ tab.kicker }}</span>
            </button>
          </div>

          <div class="model-section-actions">
            <span class="pill">{{ activeMusicProject.status }}</span>
            <span class="pill pill-neutral">{{ activeMusicTracks.length }} 首</span>
            <span class="pill pill-neutral">{{ activeMusicFinishedCount }} 成品</span>
            <button
              type="button"
              class="model-icon-button writing-ai-float-trigger"
              :aria-label="ui.marketplace.music.isAiDrawerOpen ? '收起瑶音小筑' : '打开瑶音小筑'"
              :title="ui.marketplace.music.isAiDrawerOpen ? '收起瑶音小筑' : '打开瑶音小筑'"
              @click="setMusicAiDrawerOpen(!ui.marketplace.music.isAiDrawerOpen)"
            >
              <GIcon name="sparkles" />
            </button>
          </div>
        </header>

        <section
          class="writing-detail-layout music-detail-layout"
          :class="{
            'is-profile-collapsed': ui.marketplace.music.isProfileCollapsed,
            'is-ai-open': ui.marketplace.music.isAiDrawerOpen
          }"
        >
          <aside class="writing-detail-rail music-detail-rail" :aria-expanded="ui.marketplace.music.isProfileCollapsed ? 'false' : 'true'">
            <button
              type="button"
              class="model-icon-button writing-profile-toggle"
              :aria-label="ui.marketplace.music.isProfileCollapsed ? '展开专辑信息' : '折叠专辑信息'"
              :title="ui.marketplace.music.isProfileCollapsed ? '展开专辑信息' : '折叠专辑信息'"
              @click="toggleMusicProfileRail"
            >
              <GIcon :name="ui.marketplace.music.isProfileCollapsed ? 'chevronRight' : 'chevronLeft'" />
            </button>

            <div v-if="!ui.marketplace.music.isProfileCollapsed" class="writing-rail-content music-rail-content">
              <div class="music-project-profile">
                <div class="writing-cover-control">
                  <div class="music-album-cover music-project-cover-large" :class="`is-${activeMusicProject.coverTone}`">
                    <img v-if="activeMusicProject.coverUrl" :src="activeMusicProject.coverUrl" :alt="`${activeMusicProject.title} 封面`" />
                    <span v-else>{{ activeMusicProject.title.slice(0, 1) || "音" }}</span>
                  </div>
                  <button
                    type="button"
                    class="model-icon-button writing-cover-edit-button"
                    aria-label="上传或生成封面"
                    title="上传或生成封面"
                    @click="openApplicationCoverDialog('music', 'upload')"
                  >
                    <GIcon name="image" :size="14" />
                  </button>
                </div>

                <label class="field writing-rail-title-field">
                  <span class="field-label">专辑名称</span>
                  <input
                    :value="activeMusicProject.title"
                    class="field-input writing-rail-title-input"
                    aria-label="音乐专辑名"
                    @input="setMusicProjectTitle($event.target.value)"
                  />
                </label>

                <label class="field">
                  <span class="field-label">制作人</span>
                  <input
                    :value="activeMusicProject.artist"
                    class="field-input writing-mini-input"
                    @input="setMusicProjectArtist($event.target.value)"
                  />
                </label>

                <label class="field">
                  <span class="field-label">风格</span>
                  <input
                    :value="activeMusicProject.genre"
                    class="field-input writing-mini-input"
                    @input="setMusicProjectGenre($event.target.value)"
                  />
                </label>

                <label class="field">
                  <span class="field-label">情绪</span>
                  <input
                    :value="activeMusicProject.mood"
                    class="field-input writing-mini-input"
                    @input="setMusicProjectMood($event.target.value)"
                  />
                </label>

                <label class="field">
                  <span class="field-label">状态</span>
                  <input
                    :value="activeMusicProject.status"
                    class="field-input writing-mini-input"
                    @input="setMusicProjectStatus($event.target.value)"
                  />
                </label>

                <div class="field">
                  <span class="field-label">专辑方向</span>
                  <FieldAiOptimizer
                    :actions="fieldAiActions"
                    :state="ui.marketplace.fieldAi"
                    :field-id="`music-project-summary-${activeMusicProject.id}`"
                    :app-name="MUSIC_APP_NAME"
                    label="专辑方向"
                    :value="activeMusicProject.summary"
                    :context="`专辑：${activeMusicProject.title}\n风格：${activeMusicProject.genre}\n情绪：${activeMusicProject.mood}`"
                    :set-value="setMusicProjectSummary"
                  >
                    <textarea
                      :value="activeMusicProject.summary"
                      class="field-textarea music-project-summary-textarea"
                      placeholder="专辑主题、听感、曲目边界和使用场景。"
                      @input="setMusicProjectSummary($event.target.value)"
                    ></textarea>
                  </FieldAiOptimizer>
                </div>
              </div>

              <div class="comic-rail-footer">
                <div class="writing-stat-list">
                  <span class="pill pill-neutral">{{ getMusicProjectDraftCount(activeMusicProject) }} 草稿</span>
                  <span class="pill pill-neutral">{{ getMusicTotalDuration(activeMusicProject) }} 秒</span>
                </div>
              </div>
            </div>

            <div v-if="!ui.marketplace.music.isProfileCollapsed" class="writing-profile-actions">
              <span class="pill pill-neutral writing-profile-update-pill">更新 {{ formatWritingBookUpdatedAt(activeMusicProject.updatedAt) }}</span>
              <button
                type="button"
                class="writing-mini-text-button"
                :disabled="ui.marketplace.music.isExporting"
                :title="`导出 ${activeMusicExportFileName}`"
                @click="openMusicExportDialog"
              >
                导出
              </button>
            </div>
          </aside>

          <main class="writing-main-stage music-main-stage">
            <section class="music-editor-surface">
              <div class="music-track-toolbar">
                <div class="music-track-toolbar-copy">
                  <span class="status-pill">{{ activeMusicTabMeta.label }}</span>
                  <span>{{ filteredMusicTrackEntries.length }} / {{ activeMusicTracks.length }} 首</span>
                </div>
                <button type="button" class="model-action-secondary music-new-track-button" @click="createMusicTrack()">
                  <GIcon name="add" :size="14" />
                  新曲目
                </button>
              </div>

              <div class="music-editor-grid">
                <section class="music-track-list-panel">
                  <div class="music-track-list" :class="{ 'is-empty': !filteredMusicTrackEntries.length }">
                    <p v-if="!filteredMusicTrackEntries.length" class="music-empty-copy">当前筛选下暂无曲目</p>
                    <button
                      v-for="entry in filteredMusicTrackEntries"
                      :key="entry.track.id"
                      type="button"
                      class="music-track-item"
                      :class="{ 'is-active': activeMusicTrack?.id === entry.track.id }"
                      @click="selectMusicTrack(entry.track.id)"
                    >
                      <span class="music-track-index">{{ entry.track.index }}</span>
                      <span class="music-track-main">
                        <strong>{{ entry.track.title }}</strong>
                        <small>{{ getMusicTrackKindLabel(entry.track.kind) }} · {{ entry.track.style || "未写曲风" }}</small>
                      </span>
                      <span class="status-pill" :class="getMusicTrackStatusClass(entry.track.status)">
                        {{ getMusicTrackStatusLabel(entry.track.status) }}
                      </span>
                    </button>
                  </div>
                </section>

                <section v-if="activeMusicTrack" class="music-track-editor">
                  <div class="music-player-panel">
                    <div class="music-player-cover" :class="`is-${activeMusicProject.coverTone}`">
                      <img v-if="activeMusicTrack.coverUrl" :src="activeMusicTrack.coverUrl" :alt="activeMusicTrack.title" />
                      <span v-else>{{ activeMusicTrackIndex + 1 }}</span>
                    </div>
                    <div class="music-player-meta">
                      <p class="feature-kicker">Now Editing</p>
                      <p class="model-section-title">{{ getMusicTrackDisplayTitle(activeMusicTrack, activeMusicTrackIndex) }}</p>
                      <p>{{ getMusicProviderLabel(activeMusicTrack.provider) }} · {{ activeMusicTrack.durationSeconds || 0 }}s · {{ activeMusicTrack.taskId || "无任务" }}</p>
                    </div>
                    <audio v-if="activeMusicTrack.audioUrl" class="music-audio-player" :src="activeMusicTrack.audioUrl" controls></audio>
                    <div v-else class="music-audio-empty">
                      <GIcon name="music" :size="18" />
                      <span>音频生成后会出现在这里</span>
                    </div>
                  </div>

                  <div class="music-editor-fields">
                    <label class="field field-mini">
                      <span class="field-label">曲名</span>
                      <input
                        :value="activeMusicTrack.title"
                        class="field-input"
                        placeholder="曲目名称"
                        @input="setMusicTrackField(activeMusicTrack, 'title', $event.target.value)"
                      />
                    </label>

                    <label class="field field-mini">
                      <span class="field-label">类型</span>
                      <GCompactSelect
                        :model-value="activeMusicTrack.kind"
                        :options="musicTrackKindOptions"
                        aria-label="曲目类型"
                        @change="setMusicTrackField(activeMusicTrack, 'kind', $event)"
                      />
                    </label>

                    <label class="field field-mini">
                      <span class="field-label">状态</span>
                      <GCompactSelect
                        :model-value="activeMusicTrack.status"
                        :options="musicTrackStatusOptions"
                        aria-label="曲目状态"
                        @change="setMusicTrackField(activeMusicTrack, 'status', $event)"
                      />
                    </label>

                    <label class="field field-mini">
                      <span class="field-label">时长</span>
                      <input
                        :value="activeMusicTrack.durationSeconds"
                        class="field-input"
                        type="number"
                        min="0"
                        max="3600"
                        @input="setMusicTrackField(activeMusicTrack, 'durationSeconds', $event.target.value)"
                      />
                    </label>

                    <div class="field field-full">
                      <span class="field-label">生成提示词</span>
                      <FieldAiOptimizer
                        :actions="fieldAiActions"
                        :state="ui.marketplace.fieldAi"
                        :field-id="`music-track-prompt-${activeMusicTrack.id}`"
                        :app-name="MUSIC_APP_NAME"
                        label="生成提示词"
                        :value="activeMusicTrack.prompt"
                        :context="buildMusicFieldAiContext('生成提示词')"
                        :disabled="ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                        :set-value="(value) => setMusicTrackField(activeMusicTrack, 'prompt', value)"
                      >
                        <textarea
                          :value="activeMusicTrack.prompt"
                          class="field-textarea music-prompt-textarea"
                          :placeholder="activeMusicModeMeta.placeholder"
                          :disabled="ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                          @input="setMusicTrackField(activeMusicTrack, 'prompt', $event.target.value)"
                        ></textarea>
                      </FieldAiOptimizer>
                    </div>

                    <label class="field field-mini field-full">
                      <span class="field-label">曲风 / 情绪 / 场景</span>
                      <input
                        :value="activeMusicTrack.style"
                        class="field-input"
                        placeholder="例如国风电子、City Pop、Lo-fi、温柔、热烈"
                        :disabled="ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                        @input="setMusicTrackField(activeMusicTrack, 'style', $event.target.value)"
                      />
                    </label>

                    <div class="field field-full">
                      <span class="field-label">歌词 / 素材</span>
                      <FieldAiOptimizer
                        :actions="fieldAiActions"
                        :state="ui.marketplace.fieldAi"
                        :field-id="`music-track-lyrics-${activeMusicTrack.id}`"
                        :app-name="MUSIC_APP_NAME"
                        label="歌词 / 素材"
                        :value="activeMusicTrack.lyrics"
                        :context="buildMusicFieldAiContext('歌词 / 素材')"
                        :disabled="ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                        :set-value="(value) => setMusicTrackField(activeMusicTrack, 'lyrics', value)"
                      >
                        <textarea
                          :value="activeMusicTrack.lyrics"
                          class="field-textarea music-lyrics-textarea"
                          placeholder="可选，贴歌词、段落结构、旋律描述或参考文本。"
                          :disabled="ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                          @input="setMusicTrackField(activeMusicTrack, 'lyrics', $event.target.value)"
                        ></textarea>
                      </FieldAiOptimizer>
                    </div>

                    <label class="field field-mini field-full">
                      <span class="field-label">负向限制</span>
                      <input
                        :value="activeMusicTrack.negativePrompt"
                        class="field-input"
                        placeholder="杂音、刺耳、跑调、水印、过度压缩"
                        @input="setMusicTrackField(activeMusicTrack, 'negativePrompt', $event.target.value)"
                      />
                    </label>

                    <label class="field field-mini">
                      <span class="field-label">Provider</span>
                      <GCompactSelect
                        :model-value="ui.marketplace.music.generationProvider || 'default'"
                        :options="musicGenerationProviderOptions"
                        aria-label="音乐生成供应商"
                        @change="setMusicGenerationProvider($event)"
                      />
                    </label>

                    <label class="field field-mini">
                      <span class="field-label">模型</span>
                      <input
                        :value="activeMusicTrack.model"
                        class="field-input"
                        placeholder="可选"
                        @input="setMusicTrackField(activeMusicTrack, 'model', $event.target.value)"
                      />
                    </label>

                    <label class="field field-mini">
                      <span class="field-label">任务 ID</span>
                      <input
                        :value="activeMusicTrack.taskId"
                        class="field-input"
                        placeholder="生成后自动回填"
                        @input="setMusicTrackField(activeMusicTrack, 'taskId', $event.target.value)"
                      />
                    </label>

                    <label class="field field-mini">
                      <span class="field-label">回调地址</span>
                      <input
                        :value="ui.marketplace.music.callbackUrl"
                        class="field-input"
                        placeholder="Suno 可选"
                        @input="setMusicCallbackUrl($event.target.value)"
                      />
                    </label>

                    <label class="field field-mini field-full">
                      <span class="field-label">音频地址</span>
                      <input
                        :value="activeMusicTrack.audioUrl"
                        class="field-input"
                        placeholder="也可以粘贴外部音频 URL"
                        @input="setMusicTrackField(activeMusicTrack, 'audioUrl', $event.target.value)"
                      />
                    </label>

                    <div class="music-generation-actions">
                      <button
                        type="button"
                        class="model-action music-run-button"
                        :disabled="ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                        @click="generateMusicDraft"
                      >
                        <GIcon :name="ui.marketplace.music.isGenerating ? 'loading' : 'sparkles'" :spin="ui.marketplace.music.isGenerating" :size="15" />
                        {{ ui.marketplace.music.isGenerating ? "谱写中" : "生成草案" }}
                      </button>
                      <button
                        type="button"
                        class="model-action music-run-button"
                        :disabled="ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                        @click="callMusicGeneration"
                      >
                        <GIcon :name="ui.marketplace.music.isCallingTool ? 'loading' : 'music'" :spin="ui.marketplace.music.isCallingTool" :size="15" />
                        {{ ui.marketplace.music.isCallingTool ? "生成中" : "生成音乐" }}
                      </button>
                      <button
                        type="button"
                        class="model-action-secondary music-clear-button"
                        :disabled="ui.marketplace.music.isCallingTool || !activeMusicTrack.taskId"
                        @click="queryMusicGeneration"
                      >
                        查询结果
                      </button>
                      <button
                        type="button"
                        class="model-action-secondary music-clear-button"
                        @click="markMusicTrackStatus(activeMusicTrack.status === 'finished' ? 'draft' : 'finished')"
                      >
                        {{ activeMusicTrack.status === "finished" ? "转草稿" : "标成品" }}
                      </button>
                    </div>

                    <div class="field field-full music-notes-field">
                      <div class="music-notes-label-row">
                        <span class="field-label">制作草案</span>
                        <button
                          type="button"
                          class="writing-mini-text-button music-inline-clear-button"
                          :disabled="ui.marketplace.music.isGenerating || !activeMusicTrack.notes"
                          @click="clearMusicOutput"
                        >
                          清空
                        </button>
                      </div>
                      <textarea
                        :value="activeMusicTrack.notes"
                        class="field-textarea music-notes-textarea"
                        placeholder="AI 生成的歌词草案、编曲说明、复听记录会落在这里。"
                        @input="setMusicTrackField(activeMusicTrack, 'notes', $event.target.value)"
                      ></textarea>
                    </div>
                  </div>
                </section>

                <section v-else class="music-track-editor music-track-editor-empty">
                  <button type="button" class="music-create-track-hero" @click="createMusicTrack()">
                    <GIcon name="add" :size="18" />
                    <strong>新建第一首曲目</strong>
                  </button>
                </section>
              </div>

              <p
                v-if="ui.marketplace.music.feedback"
                class="writing-export-feedback music-feedback"
                :class="getMusicFeedbackClass()"
                role="status"
              >
                {{ ui.marketplace.music.feedback }}
              </p>
            </section>
          </main>

          <aside v-if="ui.marketplace.music.isAiDrawerOpen" class="writing-ai-card writing-ai-drawer music-ai-drawer">
            <div class="writing-ai-head">
              <div>
                <p class="feature-kicker">AI Copilot</p>
                <p class="model-section-title">瑶音小筑</p>
              </div>
            </div>

            <div class="field writing-ai-task-field">
              <span class="field-label">创作动作</span>
              <div class="writing-ai-task-dropdown" :class="{ 'is-open': ui.marketplace.music.isAiTaskPickerOpen }">
                <button
                  type="button"
                  class="writing-ai-task-dropdown-trigger"
                  :aria-expanded="ui.marketplace.music.isAiTaskPickerOpen ? 'true' : 'false'"
                  aria-haspopup="listbox"
                  @click="toggleMusicAiTaskPicker"
                >
                  <span>{{ activeMusicModeMeta.label }}</span>
                  <GIcon name="chevronDown" />
                </button>
                <p class="writing-ai-task-target">{{ activeMusicModeMeta.focus }}</p>

                <div v-if="ui.marketplace.music.isAiTaskPickerOpen" class="writing-ai-task-dropdown-menu" role="listbox">
                  <button
                    v-for="mode in MUSIC_CREATION_MODES"
                    :key="mode.id"
                    type="button"
                    class="writing-ai-task-dropdown-item"
                    :class="{ 'is-active': ui.marketplace.music.activeMode === mode.id }"
                    role="option"
                    :aria-selected="ui.marketplace.music.activeMode === mode.id ? 'true' : 'false'"
                    @click="setMusicMode(mode.id)"
                  >
                    <span>{{ mode.label }}</span>
                    <small>{{ mode.focus }}</small>
                    <em>{{ mode.kicker }}</em>
                  </button>
                </div>
              </div>
            </div>

            <GordonAgentProgress
              :progress="getMarketplaceAgentProgress('music')"
              :items="getMarketplaceAgentProgressItems(getMarketplaceAgentProgress('music'))"
              :progress-class="getMarketplaceAgentProgressClass('music')"
              :progress-time="getMarketplaceAgentProgressTime('music')"
              fallback-status="正在处理音乐任务"
              :cancel-handler="cancelMarketplaceAgentRun"
            />

            <div class="music-ai-tool-row">
              <button
                type="button"
                class="model-action-secondary"
                :disabled="!activeMusicTrack || ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                @click="callMusicGeneration"
              >
                <GIcon :name="ui.marketplace.music.isCallingTool ? 'loading' : 'music'" :spin="ui.marketplace.music.isCallingTool" :size="14" />
                生成音乐
              </button>
              <button
                type="button"
                class="model-action-secondary"
                :disabled="!activeMusicTrack?.taskId || ui.marketplace.music.isCallingTool"
                @click="queryMusicGeneration"
              >
                查询结果
              </button>
            </div>

            <div class="writing-ai-output music-ai-output">
              <AiAssistantActionBar
                label="当前曲目"
                :status-class="getMusicFeedbackClass()"
                :status-message="musicAiOutputStatusMessage"
                :quick-disabled="!activeMusicTrack || ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                :quick-icon="ui.marketplace.music.isGenerating ? 'loading' : 'sparkles'"
                :quick-spin="ui.marketplace.music.isGenerating"
                :quick-label="ui.marketplace.music.isGenerating ? '谱写中' : '快速模式'"
                :agent-disabled="!activeMusicTrack || ui.marketplace.music.isGenerating || ui.marketplace.music.isCallingTool"
                :on-quick-run="generateMusicDraft"
                :on-agent-run="() => runMarketplaceAgentTask('music')"
              />
              <div class="music-ai-current">
                <span class="status-pill">{{ activeMusicTrack ? getMusicTrackStatusLabel(activeMusicTrack.status) : "未选择" }}</span>
                <p>
                  {{ activeMusicTrack ? `${getMusicTrackDisplayTitle(activeMusicTrack, activeMusicTrackIndex)} · ${activeMusicTrack.style || "未写曲风"}` : "先在右侧新建或选择一首曲目。" }}
                </p>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </template>

    <template v-else-if="ui.marketplace.view === 'fortune'">
      <FortuneWorkbench :context="context" />
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
          <div class="video-project-cover" :class="[`is-${project.coverTone}`, { 'has-cover-image': project.coverUrl }]" aria-hidden="true">
            <img v-if="project.coverUrl" :src="project.coverUrl" :alt="`${project.title} 封面`" />
            <span v-else>{{ project.title.slice(0, 1) || "影" }}</span>
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
          <div class="comic-project-cover" :class="`is-${project.coverTone}`" aria-hidden="true">
            <img v-if="project.coverUrl" :src="project.coverUrl" :alt="`${project.title} 封面`" />
            <span v-else>{{ project.title.slice(0, 1) || "漫" }}</span>
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
            <img v-if="book.coverUrl" :src="book.coverUrl" :alt="`${book.title} 封面`" />
            <span v-else>{{ book.title.slice(0, 1) }}</span>
          </div>
          <div class="writing-book-card-main">
            <div>
              <p class="writing-book-title">{{ book.title }}</p>
              <p class="writing-book-meta">{{ getWritingLengthLabel(book.length) }} / {{ book.genre }}</p>
            </div>
            <p class="models-copy">{{ truncateText(book.intro, 98) }}</p>
            <div class="writing-book-card-foot">
              <span class="pill">{{ book.status }}</span>
              <span class="pill pill-neutral writing-word-count-pill">{{ getWritingBookWordCount(book) }} 字</span>
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
                <div class="writing-cover-control">
                  <div class="video-project-cover video-project-cover-large" :class="[`is-${activeVideoProject.coverTone}`, { 'has-cover-image': activeVideoProject.coverUrl }]">
                    <img v-if="activeVideoProject.coverUrl" :src="activeVideoProject.coverUrl" :alt="`${activeVideoProject.title} 封面`" />
                    <span v-else>{{ activeVideoProject.title.slice(0, 1) || "影" }}</span>
                  </div>
                  <button
                    type="button"
                    class="model-icon-button writing-cover-edit-button"
                    aria-label="上传或生成封面"
                    title="上传或生成封面"
                    @click="openApplicationCoverDialog('video', 'upload')"
                  >
                    <GIcon name="image" :size="14" />
                  </button>
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

                    <button
                      type="button"
                      class="model-action writing-chapter-submit"
                      :disabled="ui.marketplace.video.isGenerating"
                      @click="submitVideoShot"
                    >
                      <GIcon
                        :name="ui.marketplace.video.isGenerating ? 'loading' : activeVideoShot.taskId ? 'refresh' : 'play'"
                        :spin="ui.marketplace.video.isGenerating"
                        :size="14"
                      />
                      {{ ui.marketplace.video.isGenerating ? "处理中" : activeVideoShot.taskId ? "查询结果" : "生成视频" }}
                    </button>
                  </div>

                  <div v-if="activeVideoShot" class="writing-chapter-brief-strip">
                    <strong>{{ getVideoShotDisplayTitle(activeVideoShot, activeVideoShotIndex) }}</strong>
                    <p>{{ activeVideoShot.summary || "这个镜头还没有说明。" }}</p>
                  </div>

                  <AiAssistantActionBar
                    v-if="activeVideoShot"
                    label="生成模式"
                    bar-class="video-agent-mode-strip"
                    :status-class="getVideoFeedbackClass()"
                    :status-message="videoAiOutputStatusMessage"
                    :quick-disabled="ui.marketplace.video.isGenerating"
                    :quick-icon="ui.marketplace.video.isGenerating ? 'loading' : 'sparkles'"
                    :quick-spin="ui.marketplace.video.isGenerating"
                    :quick-label="ui.marketplace.video.isGenerating ? '生成中' : '快速模式'"
                    :agent-disabled="ui.marketplace.video.isGenerating"
                    :on-quick-run="generateVideoQuickMode"
                    :on-agent-run="() => runMarketplaceAgentTask('video')"
                  />

                  <GordonAgentProgress
                    class="marketplace-agent-progress-inline"
                    :progress="getMarketplaceAgentProgress('video')"
                    :items="getMarketplaceAgentProgressItems(getMarketplaceAgentProgress('video'))"
                    :progress-class="getMarketplaceAgentProgressClass('video')"
                    :progress-time="getMarketplaceAgentProgressTime('video')"
                    fallback-status="正在处理视频任务"
                    :cancel-handler="cancelMarketplaceAgentRun"
                  />

                  <p
                    v-if="ui.marketplace.video.feedback"
                    class="writing-export-feedback video-feedback"
                    :class="getVideoFeedbackClass()"
                    role="status"
                  >
                    {{ ui.marketplace.video.feedback }}
                  </p>

                  <div v-if="activeVideoShot?.videoUrl" class="video-shot-result-preview">
                    <video :src="activeVideoShot.videoUrl" controls playsinline></video>
                    <a :href="activeVideoShot.videoUrl" target="_blank" rel="noreferrer">打开视频</a>
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
          <div
            v-if="activeComicAsset && activeComicAssetPreviewView"
            ref="comicAssetPreviewOverlayRef"
            class="comic-asset-preview-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="放大素材图"
            @click="closeComicAssetPreviewView"
          >
            <div
              class="comic-asset-preview-dialog"
              :class="comicAssetPreviewImageClass"
              :style="comicAssetPreviewImageStyle"
              @click.stop
            >
              <img
                ref="comicAssetPreviewImageRef"
                :src="activeComicAssetPreviewView.src"
                :alt="activeComicAssetPreviewView.label || getComicAssetViewKindLabel(activeComicAssetPreviewView.kind)"
                :class="comicAssetPreviewImageClass"
                @load="handleComicAssetPreviewImageLoad"
              />
              <button
                type="button"
                class="model-icon-button comic-asset-preview-close"
                aria-label="关闭放大预览"
                title="关闭放大预览"
                @click.stop="closeComicAssetPreviewView"
              >
                <GIcon name="close" :size="13" />
              </button>
            </div>
          </div>

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

            <div
              class="comic-rail-mode-tabs"
              role="tablist"
              aria-label="漫画项目设定与素材库"
            >
              <button
                type="button"
                class="comic-rail-mode-tab"
                :class="{ 'is-active': ui.marketplace.comic.introMode !== 'assets' }"
                :aria-selected="ui.marketplace.comic.introMode !== 'assets' ? 'true' : 'false'"
                aria-label="项目设定"
                title="项目设定"
                @click.stop.prevent="setComicIntroMode('settings')"
              >
                <GIcon name="home" :size="14" />
              </button>
              <button
                type="button"
                class="comic-rail-mode-tab"
                :class="{ 'is-active': ui.marketplace.comic.introMode === 'assets' }"
                :aria-selected="ui.marketplace.comic.introMode === 'assets' ? 'true' : 'false'"
                aria-label="素材库"
                title="素材库"
                @click.stop.prevent="setComicIntroMode('assets')"
              >
                <GIcon name="image" :size="14" />
              </button>
            </div>

            <div v-if="!ui.marketplace.comic.isProfileCollapsed" class="writing-rail-content comic-rail-content">
              <div class="comic-project-profile">
                <div class="writing-cover-control">
                  <div class="comic-project-cover comic-project-cover-large" :class="`is-${activeComicProject.coverTone}`">
                    <img v-if="activeComicProject.coverUrl" :src="activeComicProject.coverUrl" :alt="`${activeComicProject.title} 封面`" />
                    <span v-else>{{ activeComicProject.title.slice(0, 1) || "漫" }}</span>
                  </div>
                  <button
                    type="button"
                    class="model-icon-button writing-cover-edit-button"
                    aria-label="上传或生成封面"
                    title="上传或生成封面"
                    @click="openApplicationCoverDialog('comic', 'upload')"
                  >
                    <GIcon name="image" :size="14" />
                  </button>
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
                        class="field-textarea writing-editor-textarea writing-intro-textarea comic-project-overview-textarea"
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
                        class="field-textarea writing-editor-textarea writing-intro-textarea comic-project-overview-textarea is-large"
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
                        class="field-textarea writing-editor-textarea writing-intro-textarea comic-project-overview-textarea is-large"
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

                      <div v-if="!ui.marketplace.comic.isAssetRailCollapsed" class="comic-asset-toolbar">
                        <div class="comic-asset-filter-tabs" role="tablist" aria-label="素材分类筛选">
                          <button
                            v-for="option in comicAssetFilterOptions"
                            :key="option.value"
                            type="button"
                            class="comic-asset-filter-tab"
                            :class="{ 'is-active': ui.marketplace.comic.assetTypeFilter === option.value }"
                            :aria-selected="ui.marketplace.comic.assetTypeFilter === option.value ? 'true' : 'false'"
                            @click="setComicAssetTypeFilter(option.value)"
                          >
                            {{ option.label }}
                          </button>
                        </div>
                        <button
                          type="button"
                          class="comic-asset-create-button comic-asset-create-icon"
                          aria-label="添加素材"
                          title="添加素材"
                          @click="createComicAsset(ui.marketplace.comic.assetTypeFilter)"
                        >
                          <GIcon name="add" :size="14" />
                        </button>
                      </div>

                      <div v-if="!ui.marketplace.comic.isAssetRailCollapsed" class="comic-asset-list" :class="{ 'is-empty': !filteredComicAssets.length }">
                        <button
                          v-for="asset in filteredComicAssets"
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
                        <p v-if="!filteredComicAssets.length" class="comic-asset-empty-text">
                          {{ activeComicAssets.length ? "当前分类暂无素材" : "暂无素材" }}
                        </p>
                      </div>
                      <div v-else class="comic-asset-collapsed-count" aria-hidden="true">
                        {{ activeComicAssets.length }}
                      </div>
                    </section>

                    <section v-if="activeComicAsset && activeComicAssetMatchesTypeFilter" ref="comicAssetDetailPanelRef" class="comic-asset-detail-panel">
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
                              class="comic-asset-view-generate"
                              :class="{ 'is-running': ui.marketplace.comic.generatingAssetViewId === view.id }"
                              :disabled="Boolean(ui.marketplace.comic.generatingAssetViewId)"
                              :aria-label="ui.marketplace.comic.generatingAssetViewId === view.id ? '正在生成素材图' : '根据提示词生成素材图'"
                              :title="ui.marketplace.comic.generatingAssetViewId === view.id ? '正在生成素材图' : '根据提示词生成素材图'"
                              @click="generateComicAssetViewImage(activeComicAsset.id, view.id)"
                            >
                              <GIcon
                                :name="ui.marketplace.comic.generatingAssetViewId === view.id ? 'loading' : 'sparkles'"
                                :size="13"
                                :spin="ui.marketplace.comic.generatingAssetViewId === view.id"
                              />
                              <span>生成素材</span>
                            </button>
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
                            <div class="comic-asset-view-tools" aria-label="素材图操作">
                              <button
                                type="button"
                                class="model-icon-button comic-asset-view-tool"
                                aria-label="放大素材图"
                                title="放大素材图"
                                @click.stop="previewComicAssetView(view.id)"
                              >
                                <GIcon name="maximize" :size="13" />
                              </button>
                              <button
                                type="button"
                                class="model-icon-button comic-asset-view-tool"
                                aria-label="下载素材图"
                                title="下载素材图"
                                @click.stop="downloadComicAssetViewImage(activeComicAsset.id, view.id)"
                              >
                                <GIcon name="download" :size="13" />
                              </button>
                            </div>
                          </div>

                          <label class="field comic-asset-reference-editor">
                            <span class="field-label">视图提示词</span>
                            <div
                              v-if="getComicAssetViewResolvedReferences(view).length"
                              class="comic-asset-reference-chips"
                              aria-label="已引用素材"
                            >
                              <span
                                v-for="reference in getComicAssetViewResolvedReferences(view)"
                                :key="reference.id"
                                class="comic-asset-reference-chip"
                              >
                                <img :src="reference.src" :alt="reference.label" />
                                <span>{{ reference.label }}</span>
                              </span>
                            </div>
                            <textarea
                              :value="view.prompt"
                              class="field-textarea writing-editor-textarea comic-asset-view-prompt"
                              @focus="updateComicAssetReferencePickerFromInput(view.id, $event)"
                              @click="updateComicAssetReferencePickerFromInput(view.id, $event)"
                              @keyup="updateComicAssetReferencePickerFromInput(view.id, $event)"
                              @blur="closeComicAssetReferencePickerSoon(view.id)"
                              @input="setComicAssetViewPromptFromInput(activeComicAsset.id, view.id, $event)"
                            ></textarea>
                            <div
                              v-if="activeComicAssetReferencePickerViewId === view.id && getComicAssetViewReferencePickerOptions(view.id).length"
                              class="comic-asset-reference-picker"
                            >
                              <button
                                v-for="option in getComicAssetViewReferencePickerOptions(view.id)"
                                :key="option.id"
                                type="button"
                                class="comic-asset-reference-option"
                                :class="{ 'is-current': option.isCurrentAsset }"
                                @mousedown.prevent="insertComicAssetViewReference(activeComicAsset.id, view, option, $event)"
                              >
                                <img :src="option.src" :alt="option.label" />
                                <span>
                                  <strong>{{ option.assetName }}</strong>
                                  <small>{{ option.viewLabel }}</small>
                                </span>
                              </button>
                            </div>
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
                      <button
                        type="button"
                        class="model-icon-button comic-chapter-head-add"
                        aria-label="新增漫画章节"
                        title="新增漫画章节"
                        @click="createComicChapter"
                      >
                        <GIcon name="add" :size="15" />
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
                          <span>正文 {{ chapter.content.length }} 字</span>
                          <span>图片 {{ getComicChapterImages(chapter).length }} 张</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div v-if="activeComicChapter" class="writing-chapter-summary-panel comic-outline-detail-panel">
                    <div class="writing-chapter-summary-head">
                      <div>
                        <p class="feature-kicker">Chapter Source</p>
                        <input
                          v-if="editingComicChapterTitleId === activeComicChapter.id"
                          :value="activeComicChapter.title"
                          class="comic-inline-title-input"
                          aria-label="编辑章节标题"
                          @input="setComicChapterTitle(activeComicChapter, $event.target.value)"
                          @blur="finishComicChapterTitleEdit"
                          @keydown.enter.prevent="finishComicChapterTitleEdit"
                          @keydown.esc.prevent="finishComicChapterTitleEdit"
                        />
                        <button
                          v-else
                          type="button"
                          class="comic-inline-title-button"
                          title="编辑章节标题"
                          @click="startComicChapterTitleEdit(activeComicChapter)"
                        >
                          <span>{{ getComicChapterDisplayTitle(activeComicChapter, activeComicChapterIndex) }}</span>
                          <GIcon name="edit" :size="13" />
                        </button>
                      </div>
                      <span class="status-pill" :class="getComicChapterStatusClass(activeComicChapter.status)">
                        {{ getComicChapterStatusLabel(activeComicChapter.status) }}
                      </span>
                    </div>

                    <details class="comic-inspector-fold comic-outline-fold" :open="ui.marketplace.comic.isOutlineChapterSummaryOpen">
                      <summary @click.prevent="toggleComicOutlineChapterSummary">
                        <GIcon name="chevronDown" />
                        <span>章节内容简介</span>
                        <small>{{ activeComicChapter.summary.length }} 字</small>
                      </summary>
                      <div class="comic-outline-fold-body">
                        <FieldAiOptimizer
                          :actions="fieldAiActions"
                          :state="ui.marketplace.fieldAi"
                          :field-id="`comic-chapter-summary-${activeComicChapter.id}`"
                          :app-name="COMIC_APP_NAME"
                          label="章节内容简介"
                          :value="activeComicChapter.summary"
                          :context="buildComicChapterFieldAiContext(activeComicChapter, '章节内容简介')"
                          :set-value="(value) => setComicChapterSummary(activeComicChapter, value)"
                        >
                          <textarea
                            class="field-textarea writing-editor-textarea comic-outline-textarea"
                            :value="activeComicChapter.summary"
                            placeholder="本章发生什么、角色目标是什么、冲突如何变化、结尾留下什么钩子。"
                            @input="setComicChapterSummary(activeComicChapter, $event.target.value)"
                          ></textarea>
                        </FieldAiOptimizer>
                      </div>
                    </details>

                    <details class="comic-inspector-fold comic-outline-fold" :open="ui.marketplace.comic.isOutlineChapterContentOpen">
                      <summary @click.prevent="toggleComicOutlineChapterContent">
                        <GIcon name="chevronDown" />
                        <span>章节正文</span>
                        <small>{{ activeComicChapter.content.length }} 字</small>
                      </summary>
                      <div class="comic-outline-fold-body">
                        <FieldAiOptimizer
                          :actions="fieldAiActions"
                          :state="ui.marketplace.fieldAi"
                          :field-id="`comic-chapter-content-${activeComicChapter.id}`"
                          :app-name="COMIC_APP_NAME"
                          label="章节正文"
                          :value="activeComicChapter.content"
                          :context="buildComicChapterFieldAiContext(activeComicChapter, '章节正文')"
                          :set-value="(value) => setComicChapterContent(activeComicChapter, value)"
                        >
                          <textarea
                            class="field-textarea writing-editor-textarea comic-outline-textarea"
                            :value="activeComicChapter.content"
                            placeholder="可选。这里可以粘贴小说章节、剧情正文或本章故事草稿；后续可基于它拆分分镜和图片提示词。"
                            @input="setComicChapterContent(activeComicChapter, $event.target.value)"
                          ></textarea>
                        </FieldAiOptimizer>
                      </div>
                    </details>

                    <details class="comic-inspector-fold comic-outline-fold" :open="ui.marketplace.comic.isOutlineChapterPromptOpen">
                      <summary @click.prevent="toggleComicOutlineChapterPrompt">
                        <GIcon name="chevronDown" />
                        <span>分镜与出图提示</span>
                        <small>{{ activeComicChapter.prompt.length }} 字</small>
                      </summary>
                      <div class="comic-outline-fold-body">
                        <FieldAiOptimizer
                          :actions="fieldAiActions"
                          :state="ui.marketplace.fieldAi"
                          :field-id="`comic-chapter-prompt-${activeComicChapter.id}`"
                          :app-name="COMIC_APP_NAME"
                          label="分镜与出图提示"
                          :value="activeComicChapter.prompt"
                          :context="buildComicChapterFieldAiContext(activeComicChapter, '分镜与出图提示')"
                          :set-value="(value) => setComicChapterPrompt(activeComicChapter, value)"
                        >
                          <textarea
                            class="field-textarea writing-editor-textarea comic-outline-textarea"
                            :value="activeComicChapter.prompt"
                            placeholder="基于章节简介/正文拆出画面数量、每张图或每格的动作节点、景别、构图、角色与场景一致性约束。"
                            @input="setComicChapterPrompt(activeComicChapter, $event.target.value)"
                          ></textarea>
                        </FieldAiOptimizer>
                      </div>
                    </details>

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
                                {{ getComicChapterStatusLabel(entry.chapter.status) }} / 正文 {{ entry.chapter.content.length }} 字 / 图片 {{ getComicChapterImages(entry.chapter).length }} 张
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

                  <div v-if="activeComicChapter" class="comic-storyboard-workspace">
                    <aside class="comic-storyboard-rail" aria-label="章节分镜轨道">
                      <div class="comic-storyboard-rail-head">
                        <div>
                          <p class="feature-kicker">Storyboard</p>
                          <p class="writing-panel-title">{{ activeComicStoryboards.length }} 条分镜</p>
                        </div>
                        <button
                          type="button"
                          class="model-icon-button"
                          aria-label="新增分镜"
                          title="新增分镜"
                          @click="createComicStoryboard('scene')"
                        >
                          <GIcon name="add" />
                        </button>
                      </div>

                      <div class="comic-storyboard-list">
                        <button
                          v-for="(storyboard, index) in activeComicStoryboards"
                          :key="storyboard.id"
                          type="button"
                          class="comic-storyboard-card"
                          :class="{ 'is-active': activeComicStoryboard?.id === storyboard.id }"
                          :aria-label="`选择分镜 ${index + 1}：${storyboard.title || storyboard.beat || storyboard.prompt || '未填写画面'}`"
                          :title="storyboard.title || storyboard.beat || storyboard.prompt || `分镜 ${index + 1}`"
                          @click="selectComicStoryboard(storyboard.id)"
                        >
                          <span class="comic-storyboard-order">{{ index + 1 }}</span>
                        </button>

                        <section v-if="!activeComicStoryboards.length" class="comic-storyboard-empty">
                          <GIcon name="image" />
                          <strong>暂无分镜</strong>
                          <button type="button" class="model-action-secondary" @click="createComicStoryboard('scene')">
                            添加分镜
                          </button>
                        </section>
                      </div>
                    </aside>

                    <section
                      class="comic-storyboard-stage"
                      :class="{ 'is-empty': !activeComicStoryboardImages.length }"
                      aria-label="当前分镜图片展示"
                    >
                      <div class="comic-storyboard-stage-head">
                        <div class="comic-storyboard-stage-copy">
                          <p class="feature-kicker">Canvas</p>
                          <h3>
                            {{
                              activeComicStoryboard
                                ? activeComicStoryboard.title || `分镜 ${activeComicStoryboardIndex + 1}`
                                : "未选择分镜"
                            }}
                          </h3>
                        </div>
                        <button
                          type="button"
                          class="model-action comic-storyboard-generate-button"
                          :class="{ 'is-running': ui.marketplace.comic.isAiRunning && activeComicAiTask?.id === 'chapterImage' }"
                          :disabled="ui.marketplace.comic.isAiRunning || !activeComicStoryboard"
                          :aria-label="ui.marketplace.comic.isAiRunning && activeComicAiTask?.id === 'chapterImage' ? '正在生成单张漫画' : '生成单张漫画'"
                          :title="activeComicStoryboard ? '生成单张漫画' : '请先选择分镜'"
                          @click="generateCurrentComicStoryboardImage"
                        >
                          <GIcon
                            :name="ui.marketplace.comic.isAiRunning && activeComicAiTask?.id === 'chapterImage' ? 'loading' : 'sparkles'"
                            :spin="ui.marketplace.comic.isAiRunning && activeComicAiTask?.id === 'chapterImage'"
                            :size="13"
                          />
                          <span>{{ ui.marketplace.comic.isAiRunning && activeComicAiTask?.id === 'chapterImage' ? "生成中" : "生成单张" }}</span>
                        </button>
                      </div>

                      <div v-if="activeComicStoryboardImages.length" class="comic-chapter-image-list comic-storyboard-image-list">
                        <figure
                          v-for="(image, index) in activeComicStoryboardImages"
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
                            <img :src="image.src" :alt="image.alt || `分镜图片 ${index + 1}`" />
                          </div>
                          <figcaption>
                            <span>{{ image.alt || `画面 ${index + 1}` }}</span>
                            <small>分镜 {{ activeComicStoryboardIndex + 1 }}</small>
                          </figcaption>
                        </figure>
                      </div>

                      <div v-else class="comic-chapter-image-empty">
                        <div class="comic-chapter-image-empty-mark" aria-hidden="true">
                          <GIcon name="image" />
                        </div>
                        <strong>{{ activeComicStoryboard ? "当前分镜暂无图片" : "暂无分镜" }}</strong>
                      </div>
                    </section>

                    <aside class="comic-chapter-inspector comic-storyboard-inspector" aria-label="当前分镜信息">
                      <section v-if="activeComicStoryboard" class="comic-storyboard-editor">
                        <div class="comic-storyboard-editor-head">
                          <div>
                            <p class="feature-kicker">Shot Editor</p>
                            <h3>分镜 {{ activeComicStoryboardIndex + 1 }}</h3>
                            <p class="comic-storyboard-editor-subtitle">
                              {{ activeComicStoryboard.title || "未命名分镜" }} / {{ getComicStoryboardKindLabel(activeComicStoryboard.kind) }}
                            </p>
                          </div>
                          <button
                            type="button"
                            class="model-icon-button is-danger"
                            aria-label="删除当前分镜"
                            title="删除当前分镜"
                            @click="deleteComicStoryboard(activeComicStoryboard.id)"
                          >
                            <GIcon name="delete" />
                          </button>
                        </div>

                        <div class="comic-storyboard-editor-summary">
                          <span>{{ getComicStoryboardImages(activeComicChapter, activeComicStoryboard).length }} 张图</span>
                          <span>{{ activeComicStoryboard.dialogue ? "有对白" : "无对白" }}</span>
                          <span>{{ activeComicStoryboard.camera ? "有镜头" : "无镜头" }}</span>
                        </div>

                        <div class="comic-storyboard-editor-grid">
                          <label class="field">
                            <span class="field-label">标题</span>
                            <input
                              :value="activeComicStoryboard.title"
                              class="field-input comic-storyboard-title-input"
                              @input="setComicStoryboardField(activeComicStoryboard, 'title', $event.target.value)"
                            />
                          </label>

                          <label class="field">
                            <span class="field-label">类型</span>
                            <GCompactSelect
                              :model-value="activeComicStoryboard.kind"
                              class="writing-mini-select"
                              aria-label="分镜类型"
                              :options="comicStoryboardKindOptions"
                              @update:model-value="(value) => setComicStoryboardField(activeComicStoryboard, 'kind', value)"
                            />
                          </label>
                        </div>

                        <label class="field comic-storyboard-editor-field">
                          <span class="field-label">画面内容</span>
                          <textarea
                            :value="activeComicStoryboard.beat"
                            class="field-textarea writing-editor-textarea comic-storyboard-textarea"
                            placeholder="这一格/这一张图中发生的动作、情绪、场景变化。"
                            @input="setComicStoryboardField(activeComicStoryboard, 'beat', $event.target.value)"
                          ></textarea>
                        </label>

                        <label class="field comic-storyboard-editor-field">
                          <span class="field-label">对白 / 旁白</span>
                          <textarea
                            :value="activeComicStoryboard.dialogue"
                            class="field-textarea writing-editor-textarea comic-storyboard-textarea"
                            placeholder="角色对白、旁白或需要留白的文字区域。"
                            @input="setComicStoryboardField(activeComicStoryboard, 'dialogue', $event.target.value)"
                          ></textarea>
                        </label>

                        <label class="field comic-storyboard-editor-field">
                          <span class="field-label">镜头 / 构图</span>
                          <textarea
                            :value="activeComicStoryboard.camera"
                            class="field-textarea writing-editor-textarea comic-storyboard-textarea"
                            placeholder="远景、中景、近景、俯拍、运动方向、画面重心。"
                            @input="setComicStoryboardField(activeComicStoryboard, 'camera', $event.target.value)"
                          ></textarea>
                        </label>

                        <div class="field writing-intro-field comic-storyboard-editor-field">
                          <FieldAiOptimizer
                            :actions="fieldAiActions"
                            :state="ui.marketplace.fieldAi"
                            :field-id="`comic-storyboard-prompt-${activeComicChapter.id}-${activeComicStoryboard.id}`"
                            :app-name="COMIC_APP_NAME"
                            label="分镜生图提示词"
                            :value="activeComicStoryboard.prompt"
                            :context="buildComicStoryboardFieldAiContext(activeComicChapter, activeComicStoryboard, '分镜生图提示词')"
                            :set-value="(value) => setComicStoryboardField(activeComicStoryboard, 'prompt', value)"
                          >
                            <textarea
                              class="field-textarea writing-editor-textarea comic-prompt-textarea"
                              :value="activeComicStoryboard.prompt"
                              placeholder="角色、动作、景别、构图、场景、光线、色彩和一致性约束。"
                              @input="setComicStoryboardField(activeComicStoryboard, 'prompt', $event.target.value)"
                            ></textarea>
                          </FieldAiOptimizer>
                        </div>
                      </section>

                      <details class="comic-inspector-fold comic-chapter-source-fold" :open="ui.marketplace.comic.isChapterStoryInputOpen">
                        <summary @click.prevent="toggleComicChapterStoryInput">
                          <span>故事输入 <small>{{ activeComicChapter.content.length || activeComicChapter.summary.length }} 字</small></span>
                          <GIcon name="chevronDown" />
                        </summary>
                        <div class="comic-chapter-source-body">
                          <FieldAiOptimizer
                            :actions="fieldAiActions"
                            :state="ui.marketplace.fieldAi"
                            :field-id="`comic-generate-summary-${activeComicChapter.id}`"
                            :app-name="COMIC_APP_NAME"
                            label="章节内容简介"
                            :value="activeComicChapter.summary"
                            :context="buildComicChapterFieldAiContext(activeComicChapter, '章节内容简介')"
                            :set-value="(value) => setComicChapterSummary(activeComicChapter, value)"
                          >
                            <textarea
                              class="field-textarea writing-editor-textarea comic-compact-textarea"
                              :value="activeComicChapter.summary"
                              placeholder="本章故事事件、角色目标、冲突变化和结尾钩子。"
                              @input="setComicChapterSummary(activeComicChapter, $event.target.value)"
                            ></textarea>
                          </FieldAiOptimizer>

                          <FieldAiOptimizer
                            :actions="fieldAiActions"
                            :state="ui.marketplace.fieldAi"
                            :field-id="`comic-generate-content-${activeComicChapter.id}`"
                            :app-name="COMIC_APP_NAME"
                            label="章节正文"
                            :value="activeComicChapter.content"
                            :context="buildComicChapterFieldAiContext(activeComicChapter, '章节正文')"
                            :set-value="(value) => setComicChapterContent(activeComicChapter, value)"
                          >
                            <textarea
                              class="field-textarea writing-editor-textarea comic-chapter-source-textarea"
                              :value="activeComicChapter.content"
                              placeholder="可选。粘贴小说正文、剧情草稿或本章故事内容，用作拆分分镜和出图提示词的依据。"
                              @input="setComicChapterContent(activeComicChapter, $event.target.value)"
                            ></textarea>
                          </FieldAiOptimizer>

                          <FieldAiOptimizer
                            :actions="fieldAiActions"
                            :state="ui.marketplace.fieldAi"
                            :field-id="`comic-generate-prompt-${activeComicChapter.id}`"
                            :app-name="COMIC_APP_NAME"
                            label="分镜与出图提示"
                            :value="activeComicChapter.prompt"
                            :context="buildComicChapterFieldAiContext(activeComicChapter, '分镜与出图提示')"
                            :set-value="(value) => setComicChapterPrompt(activeComicChapter, value)"
                          >
                            <textarea
                              class="field-textarea writing-editor-textarea comic-chapter-storyboard-textarea"
                              :value="activeComicChapter.prompt"
                              placeholder="分镜拆解、图片数量建议、每张图/每格画面节点、镜头和一致性约束。"
                              @input="setComicChapterPrompt(activeComicChapter, $event.target.value)"
                            ></textarea>
                          </FieldAiOptimizer>
                        </div>
                      </details>

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
                          <span class="status-pill">{{ activeComicChapterImageIndex + 1 }} / {{ activeComicStoryboardImages.length }}</span>
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
                              <dt>当前分镜</dt>
                              <dd>{{ activeComicStoryboard?.title || "未关联" }}</dd>
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
                :set-comic-ai-storyboard-count="setComicAiStoryboardCount"
                :set-comic-ai-image-size="setComicAiImageSize"
                :set-comic-ai-image-quality="setComicAiImageQuality"
                :generate-comic-ai-output="generateComicAiOutput"
                :get-marketplace-agent-progress="getMarketplaceAgentProgress"
                :get-marketplace-agent-progress-items="getMarketplaceAgentProgressItems"
                :get-comic-ai-run-button-label="getComicAiRunButtonLabel"
                :get-comic-ai-feedback-class="getComicAiFeedbackClass"
                :apply-comic-ai-output="applyComicAiOutput"
                :cancel-marketplace-agent-run="cancelMarketplaceAgentRun"
                :run-marketplace-agent-task="runMarketplaceAgentTask"
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
            <span class="pill pill-neutral writing-word-count-pill">{{ getWritingTabWordCount() }} 字</span>
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
                <div class="writing-cover-control">
                  <div class="writing-book-cover writing-book-cover-large" :class="`is-${activeWritingBook.coverTone}`">
                    <img v-if="activeWritingBook.coverUrl" :src="activeWritingBook.coverUrl" :alt="`${activeWritingBook.title} 封面`" />
                    <span v-else>{{ activeWritingBook.title.slice(0, 1) || "书" }}</span>
                  </div>
                  <button
                    type="button"
                    class="model-icon-button writing-cover-edit-button"
                    aria-label="上传或生成封面"
                    title="上传或生成封面"
                    :disabled="isActiveWritingBookAiRunning"
                    @click="openApplicationCoverDialog('writing', 'upload')"
                  >
                    <GIcon name="image" :size="14" />
                  </button>
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
                  <GCompactSelect
                    :model-value="activeWritingBook.genreProfile.primaryGenre"
                    class="writing-mini-select"
                    aria-label="类型"
                    :options="writingGenreProfileOptions"
                    @update:model-value="setWritingGenreProfileField('primaryGenre', $event)"
                  />
                </label>
                <label class="field">
                  <span class="field-label">内容</span>
                  <input
                    :value="activeWritingBook.genre"
                    class="field-input writing-mini-input"
                    aria-label="内容"
                    @input="setWritingBookGenre($event.target.value)"
                  />
                </label>
              </div>

              <div class="writing-stat-list">
                <span class="pill pill-neutral writing-word-count-pill">总字数 {{ getWritingBookWordCount(activeWritingBook) }}</span>
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
                    class="writing-intro-card writing-narrative-state-card"
                    :class="{ 'is-collapsed': isWritingIntroSectionCollapsed('narrative-state', 'system') }"
                  >
                    <div class="writing-intro-card-head">
                      <button
                        type="button"
                        class="writing-intro-toggle"
                        :aria-expanded="String(!isWritingIntroSectionCollapsed('narrative-state', 'system'))"
                        :aria-label="isWritingIntroSectionCollapsed('narrative-state', 'system') ? '展开 Narrative State' : '折叠 Narrative State'"
                        :title="isWritingIntroSectionCollapsed('narrative-state', 'system') ? '展开' : '折叠'"
                        @click="toggleWritingIntroSectionCollapsed('narrative-state', 'system')"
                      >
                        <GIcon :name="isWritingIntroSectionCollapsed('narrative-state', 'system') ? 'chevronRight' : 'chevronDown'" />
                      </button>
                      <div class="writing-intro-card-title">
                        <span class="field-label">Narrative State</span>
                      </div>
                      <div class="writing-narrative-state-metrics" aria-label="叙事状态统计">
                        <span
                          v-for="item in getWritingNarrativeStateSummary(activeWritingBook)"
                          :key="item.label"
                          class="status-pill writing-narrative-state-pill"
                        >
                          {{ item.label }} {{ item.value }}
                        </span>
                      </div>
                    </div>

                    <div v-if="!isWritingIntroSectionCollapsed('narrative-state', 'system')" class="writing-narrative-state-preview">
                      <article
                        v-for="node in getWritingNarrativeStatePreview(activeWritingBook)"
                        :key="node.id"
                        class="writing-narrative-state-node"
                        :class="`is-risk-${node.riskLevel}`"
                      >
                        <span>{{ node.kindLabel }}</span>
                        <strong>{{ node.label }}</strong>
                        <p>{{ node.summary || node.status }}</p>
                        <small v-if="node.evidenceLabel || node.impact" class="writing-narrative-state-evidence">
                          {{ [node.evidenceLabel, node.impact ? `影响：${node.impact}` : ""].filter(Boolean).join(" / ") }}
                        </small>
                      </article>
                      <p v-if="!getWritingNarrativeStatePreview(activeWritingBook).length" class="writing-narrative-state-empty">
                        暂无状态节点
                      </p>
                    </div>
                  </section>

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
                      <span class="status-pill writing-word-count-pill">{{ getWritingIntroFieldWordCount(activeWritingBook, section.key) }} 字</span>
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
                      <span class="status-pill writing-word-count-pill">{{ getWritingExtraIntroSectionWordCount(section) }} 字</span>
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

                <div v-else class="writing-chapter-workbench writing-chapter-draft-workbench">
                  <div v-if="activeWritingChapter" class="writing-chapter-commandbar">
                    <div class="writing-chapter-picker-row">
                      <div class="writing-chapter-picker">
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
                        <input
                          v-model="ui.marketplace.writing.chapterSearchQuery"
                          class="field-input writing-chapter-search-input"
                          placeholder="章节名"
                          @focus="setWritingChapterPickerOpen(true)"
                        />
                      </label>

                      <div class="writing-chapter-info-wrap">
                        <button
                          type="button"
                          class="writing-chapter-info-button"
                          aria-label="当前章节介绍"
                          aria-describedby="writing-chapter-summary-popover"
                        >
                          <GIcon name="circleAlert" :size="16" />
                        </button>

                        <div id="writing-chapter-summary-popover" class="writing-chapter-summary-popover" role="tooltip">
                          <strong>{{ getWritingChapterDisplayTitle(activeWritingChapter, activeWritingChapterIndex) }}</strong>
                          <p>{{ activeWritingChapter.summary || "这个章节还没有简介。" }}</p>
                        </div>
                      </div>
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
                :active-writing-phase-options="activeWritingPhaseOptions"
                :active-writing-phase-id="activeWritingPhaseId"
                :active-writing-prompt-preview="activeWritingPromptPreview"
                :active-writing-long-outline-request="activeWritingLongOutlineRequest"
                :active-writing-outline-planner-job="activeWritingOutlinePlannerJob"
                :active-writing-book="activeWritingBook"
                :toggle-writing-ai-task-picker="toggleWritingAiTaskPicker"
                :select-writing-ai-task="selectWritingAiTask"
                :select-writing-ai-phase="selectWritingAiPhase"
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
                :get-writing-agent-progress-items="getWritingAgentProgressItems"
                :format-local-date-time="formatLocalDateTime"
                :generate-writing-assistant-output="generateWritingAssistantOutput"
                :cancel-writing-assistant-run="cancelWritingAssistantRun"
                :run-writing-agent-task="runWritingAgentTask"
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
    v-if="ui.marketplace.music.isExportDialogOpen"
    class="gordon-dialog-backdrop writing-export-backdrop"
    @click.self="closeMusicExportDialog"
  >
    <section class="gordon-dialog writing-export-dialog" role="dialog" aria-modal="true" aria-label="音乐专辑导出">
      <div class="gordon-dialog-head">
        <div class="gordon-dialog-mark writing-export-mark music-export-mark" aria-hidden="true">音</div>

        <div>
          <p class="gordon-dialog-kicker">Export</p>
          <h2 class="gordon-dialog-title">专辑导出</h2>
        </div>
      </div>

      <p class="gordon-dialog-message">
        导出当前音乐专辑的专辑方向、曲目设定、歌词素材、生成提示词、任务 ID 和音频地址，文件名固定为 {{ activeMusicExportFileName }}。
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
              :disabled="ui.marketplace.music.isExporting"
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
              :value="ui.marketplace.music.exportDirectory || '尚未选择目录'"
              readonly
            />
            <button
              type="button"
              class="gordon-dialog-button gordon-dialog-button-secondary"
              :disabled="ui.marketplace.music.isExporting"
              @click="selectMusicExportDirectory"
            >
              选择目录
            </button>
          </div>
        </div>

        <div class="writing-export-summary">
          <span>曲目数量：{{ activeMusicTracks.length }}</span>
          <span>导出文件：{{ activeMusicExportFileName }}</span>
        </div>
      </div>

      <p
        v-if="ui.marketplace.music.exportFeedback"
        class="writing-export-feedback"
        :class="`is-${ui.marketplace.music.exportFeedbackTone}`"
      >
        {{ ui.marketplace.music.exportFeedback }}
      </p>

      <div class="gordon-dialog-actions">
        <button
          type="button"
          class="gordon-dialog-button gordon-dialog-button-secondary"
          :disabled="ui.marketplace.music.isExporting"
          @click="closeMusicExportDialog"
        >
          取消
        </button>

        <button
          type="button"
          class="gordon-dialog-button gordon-dialog-button-primary"
          :disabled="!canExportActiveMusicProject"
          @click="exportActiveMusicProject"
        >
          {{ ui.marketplace.music.isExporting ? "保存中" : "确认" }}
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

<ApplicationCoverDialog
  :actions="applicationCoverActions"
  :field-ai-state="ui.marketplace.fieldAi"
  :item="activeApplicationCoverItem"
  :meta="activeApplicationCoverMeta"
  :state="ui.marketplace.cover"
/>

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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import ApplicationCoverDialog from "./ApplicationCoverDialog.vue";
import ComicAiDrawer from "./ComicAiDrawer.vue";
import AiAssistantActionBar from "./AiAssistantActionBar.vue";
import FieldAiOptimizer from "./FieldAiOptimizer.vue";
import FortuneWorkbench from "./FortuneWorkbench.vue";
import GordonAgentProgress from "./GordonAgentProgress.vue";
import GCompactSelect from "../../components/GCompactSelect.vue";
import GIcon from "../../components/GIcon.vue";
import WritingAiDrawer from "../writing/WritingAiDrawer.vue";
import {
  COMIC_APP_NAME,
  COMIC_APP_TABS,
  COMIC_ASSET_FILTER_OPTIONS,
  COMIC_PROJECT_FORMAT_META,
  COMIC_PROJECT_PALETTE_META,
  COMIC_ASSET_TYPE_META,
  COMIC_ASSET_VIEW_KIND_META,
  COMIC_STORYBOARD_KIND_META,
  FORTUNE_APP_NAME,
  MARKETPLACE_APP_COUNT,
  MUSIC_APP_NAME,
  MUSIC_APP_TABS,
  MUSIC_CREATION_MODES,
  MUSIC_PROVIDER_META,
  MUSIC_TRACK_KIND_META,
  MUSIC_TRACK_STATUS_META,
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

const { applicationCoverActions, comicActions, comicAiActions, fieldAiActions, formatLocalDateTime, fortuneActions, marketplaceAgentActions, musicActions, refs, truncateText, ui, videoActions, writingActions, writingAiActions } =
  props.context;
const { comicChapterDropdownMenuRef, videoShotDropdownMenuRef, writingChapterDropdownMenuRef } = refs;
const editingComicChapterTitleId = ref("");
const comicChapterTitleEditBaseline = ref("");
const comicAssetDetailPanelRef = ref(null);
const comicAssetPreviewOverlayRef = ref(null);
const comicAssetPreviewImageRef = ref(null);
const comicAssetPreviewImageSize = ref({
  width: 720,
  height: 405,
  maxWidth: 720,
  maxHeight: 405,
  ratioType: "landscape"
});
const activeComicAssetReferencePickerViewId = ref("");

const {
  activeComicAsset,
  activeComicAssetMatchesTypeFilter,
  activeComicAssets,
  filteredComicAssets,
  activeComicChapter,
  activeComicChapterAssets,
  activeComicChapterImage,
  activeComicChapterImageCountLabel,
  activeComicChapterImageIndex,
  activeComicChapterImages,
  activeComicChapterIndex,
  activeComicChapters,
  activeComicExportFileName,
  activeComicAssetPreviewView,
  activeComicProject,
  activeComicStoryboard,
  activeComicStoryboardImages,
  activeComicStoryboardIndex,
  activeComicStoryboards,
  backComicMarketplace,
  backComicShelf,
  canExportActiveComicProject,
  closeComicAssetPreviewView,
  closeComicExportDialog,
  comicProjects,
  addComicAssetView,
  createComicAsset,
  createComicChapter,
  createComicProject,
  createComicStoryboard,
  deleteComicAsset,
  downloadComicAssetViewImage,
  deleteComicProjectFromShelf,
  deleteComicStoryboard,
  exportActiveComicProject,
  filteredComicChapterEntries,
  getComicAssetFilledViewCount,
  getComicAssetTypeLabel,
  getComicAssetReferenceOptions,
  getComicAssetViewKindLabel,
  getComicAssetViewReferenceOptions,
  getComicChapterDisplayTitle,
  getComicChapterImages,
  getComicChapterReferencedAssets,
  getComicChapterStatusClass,
  getComicChapterStatusLabel,
  getComicStoryboardImages,
  getComicStoryboardKindLabel,
  getComicProjectFormatLabel,
  getComicProjectPaletteLabel,
  generateComicAssetViewImage,
  goComicChapter,
  isComicChapterAssetReferenced,
  openComicAppShelf,
  openComicExportDialog,
  openComicProject,
  previewComicAssetView,
  rememberComicAssetNameBaseline,
  rememberComicProjectTitleBaseline,
  removeComicAssetView,
  selectComicAsset,
  selectComicChapter,
  selectComicChapterImage,
  selectComicChapterFromPicker,
  selectComicStoryboard,
  selectComicExportDirectory,
  setComicAssetDescription,
  setComicAssetName,
  setComicAssetType,
  setComicAssetViewField,
  setComicChapterContent,
  setComicChapterImagePrompt,
  setComicChapterPickerOpen,
  setComicChapterPrompt,
  setComicChapterSummary,
  setComicChapterTitle,
  setComicStoryboardField,
  setComicProjectEpisodePlan,
  setComicProjectFormat,
  setComicProjectGenre,
  setComicProjectPageCount,
  setComicProjectPalette,
  setComicProjectSummary,
  setComicProjectTitle,
  setComicProjectVisualStyle,
  setComicAssetTypeFilter,
  setComicIntroMode,
  setComicTab,
  submitComicChapter,
  toggleComicAssetRail,
  toggleComicChapterAssetRef,
  toggleComicChapterStoryInput,
  toggleComicOutlineChapterContent,
  toggleComicOutlineChapterPrompt,
  toggleComicOutlineChapterSummary,
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
  generateCurrentComicStoryboardImage,
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
  setComicAiStoryboardCount,
  toggleComicAiPromptPreview,
  toggleComicAiTaskPicker
} = comicAiActions;

const comicAssetTypeOptions = Object.entries(COMIC_ASSET_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const comicAssetFilterOptions = COMIC_ASSET_FILTER_OPTIONS;
const comicAssetViewKindOptions = Object.entries(COMIC_ASSET_VIEW_KIND_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const comicStoryboardKindOptions = Object.entries(COMIC_STORYBOARD_KIND_META).map(([value, meta]) => ({
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
const videoAiOutputStatusMessage = computed(() =>
  String(ui.marketplace.video.feedback ?? "").trim() || (ui.marketplace.video.isGenerating ? "正在执行快速模式" : "暂无执行状态")
);
const musicTrackKindOptions = Object.entries(MUSIC_TRACK_KIND_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const musicTrackStatusOptions = Object.entries(MUSIC_TRACK_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const musicAiOutputStatusMessage = computed(() =>
  String(ui.marketplace.music.feedback ?? "").trim() || (ui.marketplace.music.isGenerating ? "正在执行快速模式" : "暂无执行状态")
);
const musicGenerationProviderOptions = [
  { value: "default", label: "默认供应商" },
  { value: "mureka", label: MUSIC_PROVIDER_META.mureka.label },
  { value: "suno", label: MUSIC_PROVIDER_META.suno.label }
];
const writingLengthOptions = Object.entries(WRITING_LENGTH_PROFILES).map(([value, meta]) => ({
  value,
  label: meta.label
}));
const {
  activeCoverItem: activeApplicationCoverItem,
  activeCoverMeta: activeApplicationCoverMeta,
  openApplicationCoverDialog
} = applicationCoverActions;

async function startComicChapterTitleEdit(chapter) {
  editingComicChapterTitleId.value = chapter?.id ?? "";
  comicChapterTitleEditBaseline.value = chapter?.title ?? "";
  await nextTick();
  const input = document.querySelector(".comic-inline-title-input");
  input?.focus?.();
  input?.select?.();
}

function finishComicChapterTitleEdit() {
  const chapter = activeComicChapter.value;

  if (chapter?.id === editingComicChapterTitleId.value && !String(chapter.title ?? "").trim()) {
    setComicChapterTitle(chapter, comicChapterTitleEditBaseline.value || getComicChapterDisplayTitle(chapter, activeComicChapterIndex.value));
  }

  editingComicChapterTitleId.value = "";
  comicChapterTitleEditBaseline.value = "";
}

function setComicAssetViewPromptFromInput(assetId, viewId, event) {
  const value = event?.target?.value ?? "";

  setComicAssetViewField(assetId, viewId, "prompt", value);
  updateComicAssetReferencePickerFromInput(viewId, event);
}

function shouldShowComicAssetReferencePicker(value, cursorPosition = String(value ?? "").length) {
  const text = String(value ?? "");
  const beforeCursor = text.slice(0, Math.max(0, cursorPosition));

  return /@([^\s@，,。；;：:\n\r]*)$/u.test(beforeCursor);
}

function updateComicAssetReferencePickerFromInput(viewId, event) {
  const textarea = event?.target ?? null;
  const value = textarea?.value ?? "";
  const cursorPosition = typeof textarea?.selectionStart === "number" ? textarea.selectionStart : String(value).length;

  activeComicAssetReferencePickerViewId.value = shouldShowComicAssetReferencePicker(value, cursorPosition) ? viewId : "";
}

function getComicAssetViewReferencePickerOptions(viewId) {
  return getComicAssetReferenceOptions(activeComicAsset.value?.id).filter((option) => option.viewId !== viewId);
}

function getComicAssetViewResolvedReferences(view) {
  return getComicAssetViewReferenceOptions(activeComicAsset.value?.id, view);
}

function insertComicAssetViewReference(assetId, view, option, event) {
  const textarea = event?.currentTarget?.closest?.(".comic-asset-reference-editor")?.querySelector?.("textarea");
  const marker = option?.insertText || (option?.label ? `@${option.label}` : "");

  if (!view || !marker) {
    return;
  }

  const currentPrompt = String(view.prompt ?? "");
  const selectionStart = typeof textarea?.selectionStart === "number" ? textarea.selectionStart : currentPrompt.length;
  const selectionEnd = typeof textarea?.selectionEnd === "number" ? textarea.selectionEnd : selectionStart;
  const beforeCursor = currentPrompt.slice(0, selectionStart);
  const afterCursor = currentPrompt.slice(selectionEnd);
  const activeMentionMatch = /@([^\s@，,。；;：:\n\r]*)$/u.exec(beforeCursor);
  const insertValue = `${marker} `;
  const nextPrompt = activeMentionMatch
    ? `${beforeCursor.slice(0, activeMentionMatch.index)}${insertValue}${afterCursor}`
    : `${currentPrompt}${currentPrompt && !/\s$/u.test(currentPrompt) ? " " : ""}${insertValue}`;

  setComicAssetViewField(assetId, view.id, "prompt", nextPrompt);
  activeComicAssetReferencePickerViewId.value = view.id;

  void nextTick(() => {
    if (!textarea) {
      return;
    }

    const nextCursor = activeMentionMatch ? activeMentionMatch.index + insertValue.length : nextPrompt.length;
    textarea.focus?.();
    textarea.setSelectionRange?.(nextCursor, nextCursor);
  });
}

function closeComicAssetReferencePickerSoon(viewId) {
  window.setTimeout(() => {
    if (activeComicAssetReferencePickerViewId.value === viewId) {
      activeComicAssetReferencePickerViewId.value = "";
    }
  }, 120);
}

const comicAssetPreviewImageClass = computed(() => `is-${comicAssetPreviewImageSize.value.ratioType}`);
const comicAssetPreviewImageStyle = computed(() => ({
  "--comic-asset-preview-image-width": `${comicAssetPreviewImageSize.value.width}px`,
  "--comic-asset-preview-image-height": `${comicAssetPreviewImageSize.value.height}px`,
  "--comic-asset-preview-image-max-width": `${comicAssetPreviewImageSize.value.maxWidth}px`,
  "--comic-asset-preview-image-max-height": `${comicAssetPreviewImageSize.value.maxHeight}px`
}));

function getComicAssetPreviewBounds() {
  const overlay = comicAssetPreviewOverlayRef.value;
  const overlayRect = overlay?.getBoundingClientRect?.();
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 1180;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 760;
  const sourceWidth = overlayRect?.width || viewportWidth;
  const sourceHeight = overlayRect?.height || viewportHeight;
  const edgePadding = Math.max(28, Math.min(52, Math.round(Math.min(sourceWidth, sourceHeight) * 0.07)));
  const width = Math.max(280, Math.floor(sourceWidth - edgePadding * 2));
  const height = Math.max(260, Math.floor(sourceHeight - edgePadding * 2));

  return { width, height };
}

function getComicAssetPreviewRatioType(width, height) {
  if (!width || !height) {
    return "landscape";
  }

  const ratio = width / height;

  if (ratio > 1.22) {
    return "landscape";
  }

  if (ratio < 0.82) {
    return "portrait";
  }

  return "square";
}

function getDefaultComicAssetPreviewImageSize() {
  const bounds = getComicAssetPreviewBounds();
  const ratio = 16 / 9;
  const width = Math.min(bounds.width, Math.round(bounds.height * ratio));
  const height = Math.min(bounds.height, Math.round(width / ratio));

  return {
    width,
    height,
    maxWidth: width,
    maxHeight: height,
    ratioType: "landscape"
  };
}

function fitComicAssetPreviewImageSize(naturalWidth, naturalHeight, bounds) {
  const ratioType = getComicAssetPreviewRatioType(naturalWidth, naturalHeight);
  const rawRatio = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 16 / 9;
  const ratio = Math.min(Math.max(rawRatio, 0.5), 2.4);
  let width = Math.min(bounds.width, Math.round(bounds.height * ratio));
  let height = Math.round(width / ratio);

  if (height > bounds.height) {
    height = bounds.height;
    width = Math.round(height * ratio);
  }

  if (ratioType === "square") {
    const side = Math.min(bounds.width, bounds.height);
    width = side;
    height = side;
  }

  return {
    width,
    height,
    maxWidth: width,
    maxHeight: height,
    ratioType
  };
}

function updateComicAssetPreviewImageSize(image) {
  const naturalWidth = image?.naturalWidth ?? 0;
  const naturalHeight = image?.naturalHeight ?? 0;
  const bounds = getComicAssetPreviewBounds();
  comicAssetPreviewImageSize.value = fitComicAssetPreviewImageSize(naturalWidth, naturalHeight, bounds);
}

async function handleComicAssetPreviewImageLoad(event) {
  await nextTick();
  updateComicAssetPreviewImageSize(event.target);
}

async function refreshComicAssetPreviewImageSize() {
  await nextTick();
  const image = comicAssetPreviewImageRef.value;

  if (image?.complete && image.naturalWidth && image.naturalHeight) {
    updateComicAssetPreviewImageSize(image);
  }
}

function handleComicAssetPreviewResize() {
  if (!activeComicAssetPreviewView.value) {
    return;
  }

  void refreshComicAssetPreviewImageSize();
}

watch(
  () => activeComicAssetPreviewView.value?.src,
  async (src) => {
    if (!src) {
      return;
    }

    comicAssetPreviewImageSize.value = getDefaultComicAssetPreviewImageSize();
    await refreshComicAssetPreviewImageSize();
  },
  { flush: "post" }
);

onMounted(() => {
  window.addEventListener("resize", handleComicAssetPreviewResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleComicAssetPreviewResize);
});

const {
  cancelMarketplaceAgentRun,
  getMarketplaceAgentProgress,
  getMarketplaceAgentProgressItems,
  runMarketplaceAgentTask
} = marketplaceAgentActions;

const {
  activeVideoExportFileName,
  activeVideoTabMeta,
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
  generateVideoQuickMode,
  getVideoFeedbackClass,
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
  activeFortuneMethodLabels,
  activeFortuneModeMeta,
  openFortuneApp
} = fortuneActions;

const {
  activeMusicDraftCount,
  activeMusicExportFileName,
  activeMusicFinishedCount,
  activeMusicModeMeta,
  activeMusicProject,
  activeMusicTabMeta,
  activeMusicTrack,
  activeMusicTrackIndex,
  activeMusicTracks,
  backMusicMarketplace,
  backMusicShelf,
  callMusicGeneration,
  canExportActiveMusicProject,
  clearMusicOutput,
  closeMusicExportDialog,
  createMusicProject,
  createMusicTrack,
  deleteMusicProjectFromWorkbench,
  exportActiveMusicProject,
  filteredMusicTrackEntries,
  generateMusicDraft,
  getMusicFeedbackClass,
  getMusicProviderLabel,
  getMusicProjectDraftCount,
  getMusicProjectFinishedCount,
  getMusicTotalDuration,
  getMusicTrackDisplayTitle,
  getMusicTrackKindLabel,
  getMusicTrackStatusClass,
  getMusicTrackStatusLabel,
  markMusicTrackStatus,
  musicProjects,
  openMusicApp,
  openMusicExportDialog,
  openMusicProject,
  queryMusicGeneration,
  selectMusicExportDirectory,
  selectMusicProject,
  selectMusicTrack,
  setMusicCallbackUrl,
  setMusicGenerationProvider,
  setMusicAiDrawerOpen,
  setMusicMode,
  setMusicProjectArtist,
  setMusicProjectGenre,
  setMusicProjectMood,
  setMusicProjectStatus,
  setMusicProjectSummary,
  setMusicProjectTitle,
  setMusicReference,
  setMusicStyle,
  setMusicTheme,
  setMusicTrackField,
  setMusicTrackFilter,
  setMusicTab,
  toggleMusicAiTaskPicker,
  toggleMusicProfileRail
} = musicActions;

const {
  activeWritingBook,
  activeWritingChapter,
  activeWritingChapterIndex,
  activeWritingChapters,
  activeWritingDoneChapterCount,
  activeWritingExportFileName,
  activeWritingExtraIntroSections,
  activeWritingPhaseId,
  activeWritingPhaseOptions,
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
  getWritingNarrativeStateSummary,
  getWritingNarrativeStatePreview,
  getWritingTabWordCount,
  writingGenreProfileOptions,
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
  selectWritingAiPhase,
  selectWritingChapter,
  selectWritingChapterFromPicker,
  selectWritingExportDirectory,
  setWritingAiDrawerOpen,
  setWritingBookGenre,
  setWritingGenreProfileField,
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
  getWritingAgentProgressItems,
  getWritingAiRunButtonLabel,
  getWritingBusyDescription,
  getWritingBusyTitle,
  getWritingOutlinePlannerProgressCopy,
  getWritingOutlinePlannerProgressPercent,
  getWritingOutlinePlannerRetryCopy,
  getWritingOutlinePlannerStatusClass,
  getWritingOutlinePlannerStatusLabel,
  isWritingOutlinePlannerRunning,
  resumeWritingOutlinePlanningJob,
  runWritingAgentTask
} = writingAiActions;

function compactFieldAiContext(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function getMarketplaceAgentProgressClass(appId) {
  const progress = getMarketplaceAgentProgress(appId);

  if (!progress) {
    return "";
  }

  if (progress.phase === "completed") {
    return "is-completed";
  }

  if (progress.tone === "warning") {
    return "is-warning";
  }

  if (progress.phase === "failed") {
    return "is-error";
  }

  return "";
}

function getMarketplaceAgentProgressTime(appId) {
  const progress = getMarketplaceAgentProgress(appId);
  const value = progress?.updatedAt ?? progress?.createdAt ?? "";

  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
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
    `专辑：${activeMusicProject.value?.title ?? ""}`,
    `专辑方向：${activeMusicProject.value?.summary ?? ""}`,
    `曲目：${activeMusicTrack.value?.title ?? ""}`,
    `创作类型：${activeMusicModeMeta.value?.label ?? ""}`,
    `创作重点：${activeMusicModeMeta.value?.focus ?? ""}`,
    fieldLabel === "主题 / 需求" || fieldLabel === "生成提示词"
      ? `曲风 / 情绪 / 场景：${activeMusicTrack.value?.style || ui.marketplace.music.style}`
      : `主题 / 需求：${activeMusicTrack.value?.prompt || ui.marketplace.music.theme}`,
    `参考歌词 / 素材：${activeMusicTrack.value?.lyrics || ui.marketplace.music.reference}`
  ]);
}

function buildFortuneFieldAiContext(fieldLabel) {
  return compactFieldAiContext([
    `解读类型：${activeFortuneModeMeta.value?.label ?? ""}`,
    `解读重点：${activeFortuneModeMeta.value?.focus ?? ""}`,
    `采用框架：${activeFortuneMethodLabels.value?.join(" / ") ?? ""}`,
    fieldLabel === "关注问题" ? "" : `关注问题：${ui.marketplace.fortune.question}`,
    fieldLabel === "面相 / 手相线索" ? "" : `面相 / 手相线索：${ui.marketplace.fortune.appearanceInfo}`,
    fieldLabel === "空间 / 风水线索" ? "" : `空间 / 风水线索：${ui.marketplace.fortune.spaceInfo}`,
    `基础资料：${ui.marketplace.fortune.profileInfo}`,
    `出生 / 时间信息：${ui.marketplace.fortune.birthInfo}`,
    `姓名 / 数字线索：${ui.marketplace.fortune.nameInfo}`,
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
    fieldLabel === "章节内容简介" ? "" : `章节内容简介：${chapter?.summary ?? ""}`,
    fieldLabel === "章节正文" ? "" : `章节正文/故事内容：${chapter?.content ?? ""}`,
    fieldLabel === "分镜与出图提示" || fieldLabel === "生图提示词" ? "" : `分镜与出图提示：${chapter?.prompt ?? ""}`
  ]);
}

function buildComicChapterImageFieldAiContext(chapter, image, fieldLabel) {
  return compactFieldAiContext([
    buildComicChapterFieldAiContext(chapter, fieldLabel),
    activeComicStoryboard.value ? buildComicStoryboardFieldAiContext(chapter, activeComicStoryboard.value, fieldLabel) : "",
    `当前图片：${image?.alt || "未命名画面"}`,
    `图片序号：${activeComicChapterImageIndex.value + 1} / ${activeComicChapterImages.value.length}`,
    `图片尺寸：${getComicImageParamValue(image?.size)}`,
    `图片质量：${getComicImageParamValue(image?.quality)}`,
    fieldLabel === "生图提示词" ? "" : `生图提示词：${image?.prompt ?? ""}`
  ]);
}

function buildComicStoryboardFieldAiContext(chapter, storyboard, fieldLabel) {
  const imageCount = getComicStoryboardImages(chapter, storyboard).length;

  return compactFieldAiContext([
    buildComicChapterFieldAiContext(chapter, fieldLabel),
    `当前分镜：${storyboard?.title || "未命名分镜"}`,
    `分镜序号：${activeComicStoryboardIndex.value + 1} / ${activeComicStoryboards.value.length}`,
    `分镜类型：${getComicStoryboardKindLabel(storyboard?.kind)}`,
    `已生成图片：${imageCount} 张`,
    fieldLabel === "画面内容" ? "" : `画面内容：${storyboard?.beat ?? ""}`,
    fieldLabel === "对白 / 旁白" ? "" : `对白/旁白：${storyboard?.dialogue ?? ""}`,
    fieldLabel === "镜头 / 构图" ? "" : `镜头/构图：${storyboard?.camera ?? ""}`,
    fieldLabel === "分镜生图提示词" ? "" : `分镜生图提示词：${storyboard?.prompt ?? ""}`
  ]);
}

function buildWritingBookFieldAiContext(fieldLabel) {
  return compactFieldAiContext([
    `书名：${activeWritingBook.value?.title ?? ""}`,
    `类型：${activeWritingBook.value?.genre ?? ""}`,
    `篇幅：${getWritingLengthLabel(activeWritingBook.value?.length)}`,
    fieldLabel === "简短介绍" ? "" : `简短介绍：${getWritingIntroFieldValue(activeWritingBook.value, "intro")}`,
    fieldLabel === "大纲指导" ? "" : `大纲指导：${getWritingIntroFieldValue(activeWritingBook.value, "outlineGuide")}`
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

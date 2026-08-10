<template>
  <div
    class="workspace-stage anime-home-stage"
    :style="{ '--anime-home-image': `url(${SABER_HOME_BACKGROUND.url})` }"
  >
    <div class="anime-home-image" aria-hidden="true"></div>
    <div class="anime-home-soft-light" aria-hidden="true"></div>

    <section class="anime-home-copy" aria-label="Gordon home">
      <p class="anime-home-kicker">Saber Atelier</p>
      <h1>GORDON</h1>
      <p>Make something wonderful.</p>
      <span class="anime-home-status">Ready</span>
    </section>

    <div class="anime-home-ribbon" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
</template>

<script setup>
import { SABER_HOME_BACKGROUND } from "./saberThemeAssets.js";
</script>

import { createApp } from "vue";

import App from "./App.vue";
import "../styles.css";

const platformName = navigator.userAgentData?.platform || navigator.platform || "";

if (/mac/i.test(platformName)) {
  document.documentElement.classList.add("is-macos-shell");
}

createApp(App).mount("#app");

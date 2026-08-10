import { createApp } from "vue";

import App from "./App.vue";
import "../styles.css";
import "../saber-theme.css";
import "../saber-atelier.css";

const platformName = navigator.userAgentData?.platform || navigator.platform || "";

document.documentElement.classList.add("gordon-saber-theme");

if (/mac/i.test(platformName)) {
  document.documentElement.classList.add("is-macos-shell");
}

createApp(App).mount("#app");

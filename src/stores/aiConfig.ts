import { defineStore } from "pinia";
import { ref, watch } from "vue";

const LS_KEY = "xbs_ai_config";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 页面抓取代理地址。本地开发默认用 Vite proxy；生产环境需填 Cloudflare Worker URL */
  proxyUrl: string;
}

const PUBLIC_PROXY = "https://raspy-wind-b18e.igodu-love.workers.dev/";
export const DEV_PROXY = "/api/fetch-page";
export { PUBLIC_PROXY };

function loadFromStorage(): AiConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AiConfig;
  } catch {
    // ignore
  }
  return {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
    proxyUrl: import.meta.env.DEV ? "/api/fetch-page" : PUBLIC_PROXY,
  };
}

export const useAiConfigStore = defineStore("aiConfig", () => {
  const config = ref<AiConfig>(loadFromStorage());

  watch(
    config,
    (val) => {
      localStorage.setItem(LS_KEY, JSON.stringify(val));
    },
    { deep: true },
  );

  function save(c: AiConfig) {
    config.value = { ...c };
  }

  return { config, save };
});

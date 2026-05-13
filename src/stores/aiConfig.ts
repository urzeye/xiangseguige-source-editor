import { defineStore } from "pinia";
import { ref, watch } from "vue";

const LS_KEY = "xbs_ai_config";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function loadFromStorage(): AiConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AiConfig;
  } catch {
    // ignore
  }
  return { baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o" };
}

export const useAiConfigStore = defineStore("aiConfig", () => {
  const config = ref<AiConfig>(loadFromStorage());

  watch(
    config,
    (val) => {
      localStorage.setItem(LS_KEY, JSON.stringify(val));
    },
    { deep: true }
  );

  function save(c: AiConfig) {
    config.value = { ...c };
  }

  return { config, save };
});

// Curated from https://ai-gateway.vercel.sh/v1/models and Vercel model pages.
// Reviewed 2026-11-11. Runtime pricing is fetched separately; never trust client prices.
export const MODEL_CHOICES = [
  {
    id: "openai/gpt-6-luna",
    name: "GPT-6 Luna",
    provider: "OpenAI",
    tier: "Small",
  },
  {
    id: "openai/gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    provider: "OpenAI",
    tier: "Mid",
  },
  {
    id: "anthropic/claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    provider: "Anthropic",
    tier: "Small",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    tier: "Mid",
  },
  {
    id: "google/gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    provider: "Google",
    tier: "Small",
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google",
    tier: "Mid",
  },
  {
    id: "google/gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    provider: "Google",
    tier: "Mid",
    disabled: true,
  },
  {
    id: "meta/muse-ember",
    name: "Muse Ember",
    provider: "Meta",
    tier: "Small",
  },
  {
    id: "mistral/ministral-14b",
    name: "Ministral 14B",
    provider: "Mistral",
    tier: "Small",
  },
  {
    id: "mistral/mistral-medium-3.5",
    name: "Mistral Medium 3.5",
    provider: "Mistral",
    tier: "Mid",
  },
  {
    id: "deepseek/deepseek-v4.1-flash-1017",
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    tier: "Small",
  },
  {
    id: "alibaba/qwen3.8-flash",
    name: "Qwen 3.8 Flash",
    provider: "Alibaba",
    tier: "Small",
  },
  {
    id: "amazon/nova-2-lite",
    name: "Nova 2 Lite",
    provider: "Amazon",
    tier: "Small",
  },
  {
    id: "minimax/minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    provider: "MiniMax",
    tier: "Small",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  provider: string;
  tier: "Small" | "Mid";
  // Disabled models stay listed (so saved rooms, labels and prices keep
  // working) but are hidden from selectors and can't be picked for new work.
  disabled?: boolean;
}[];
// "Small"/"Mid" describe the product/cost tier, not undisclosed parameter counts.
export type ModelId = (typeof MODEL_CHOICES)[number]["id"];
export type ModelPrice = { id: string; input: number; output: number };
export const isModelDisabled = (m: (typeof MODEL_CHOICES)[number]) =>
  "disabled" in m && m.disabled === true;
export const ENABLED_MODEL_CHOICES = MODEL_CHOICES.filter(
  (m) => !isModelDisabled(m),
);
export const enabledModelIds = ENABLED_MODEL_CHOICES.map((m) => m.id);
export const modelInfo = (id: string) =>
  MODEL_CHOICES.find((m) => m.id === id) ?? MODEL_CHOICES[0];

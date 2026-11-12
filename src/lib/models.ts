export const MODEL_CHOICES = [
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 mini', provider: 'OpenAI', color: 'green' },
  { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 nano', provider: 'OpenAI', color: 'green' },
  { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5', provider: 'Anthropic', color: 'orange' },
  { id: 'google/gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', provider: 'Google', color: 'blue' },
  { id: 'meta/llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Meta', color: 'blue' },
  { id: 'mistral/mistral-small', name: 'Mistral Small', provider: 'Mistral', color: 'orange' },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', color: 'blue' },
  { id: 'alibaba/qwen3.8-flash', name: 'Qwen 3.8 Flash', provider: 'Alibaba', color: 'purple' },
  { id: 'amazon/nova-micro', name: 'Nova Micro', provider: 'Amazon', color: 'orange' },
] as const;
export type ModelId = typeof MODEL_CHOICES[number]['id'];
export type ModelPrice = { id: string; input: number; output: number };
export const modelInfo = (id: string) => MODEL_CHOICES.find(m => m.id === id) ?? MODEL_CHOICES[0];

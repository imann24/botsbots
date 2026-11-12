# Model catalog

Reviewed November 11, 2026 against the [live Gateway catalog](https://ai-gateway.vercel.sh/v1/models) and [Vercel's model directory](https://vercel.com/ai-gateway/models).

| Provider | Small / economical | Mid tier |
|---|---|---|
| OpenAI | GPT-6 Luna | GPT-6.1 Terra |
| Anthropic | Claude Haiku 5.5 | Claude Sonnet 5.5 |
| Google | Gemini 3.5 Flash Lite | Gemini 3.8 Flash |
| Meta | Muse Ember | — |
| Mistral | Ministral 14B | Mistral Medium 3.5 |
| DeepSeek | V4.1 Flash (1017 revision) | — |
| Alibaba | Qwen 3.8 Flash | — |
| Amazon | Nova 2 Lite | — |
| MiniMax | M3.1 Flash | — |

Small/mid labels describe relative product and spending tiers, not parameter counts. Providers do not consistently disclose sizes. Grok, flagship tiers, batch-only models, image/audio generation, and premium fast routes are excluded.

Defaults: GPT-6 Luna, Claude Haiku 5.5, Gemini 3.5 Flash Lite. These replace older GPT-4.1 / Gemini 3.1 defaults. Meta's Ember replaces Llama 3.3; Nova 2 Lite replaces Nova Micro; Ministral 14B replaces the old Mistral Small alias; DeepSeek uses the October V4.1 revision.

The server refreshes current pricing every five minutes and refuses to start a model call without a valid current price. The UI shows input/output dollars per million tokens. The curated allowlist lives in `src/lib/models.ts`; adding a new model requires an intentional code change. Existing rooms retain their configured model IDs until explicitly edited.

import type { ComponentProps, CSSProperties } from "react";
import { Cpu } from "lucide-react";
import { MODEL_CHOICES } from "@/lib/models";

const providers: Record<string, { name: string; asset: string }> = {
  openai: { name: "OpenAI", asset: "openai" },
  anthropic: { name: "Anthropic", asset: "anthropic" },
  google: { name: "Google", asset: "google" },
  meta: { name: "Meta", asset: "meta" },
  mistral: { name: "Mistral", asset: "mistral" },
  deepseek: { name: "DeepSeek", asset: "deepseek" },
  alibaba: { name: "Alibaba", asset: "alibabacloud" },
  amazon: { name: "Amazon", asset: "amazon" },
  minimax: { name: "MiniMax", asset: "minimax" },
};

export function ProviderIcon({ model }: { model: string }) {
  const provider = providers[model.split("/")[0]];
  const name = provider?.name ?? "Model provider";
  return (
    <span className="provider-icon" role="img" aria-label={name} title={name}>
      {provider ? (
        <span
          className="provider-mark"
          style={
            {
              "--provider-mark": `url(/providers/${provider.asset}.svg)`,
            } as CSSProperties
          }
        />
      ) : (
        <Cpu size={12} aria-hidden="true" />
      )}
    </span>
  );
}

export function ModelLabel({ model }: { model: string }) {
  const info = MODEL_CHOICES.find((choice) => choice.id === model);
  return (
    <span className="model-label">
      <ProviderIcon model={model} />
      <span>{info?.name ?? model}</span>
    </span>
  );
}

// Keep the native select's keyboard, touch and screen-reader behavior. The
// selected provider sits inside the field, clear of both its text and arrow.
export function ModelSelect({
  value,
  showTier = false,
  ...props
}: Omit<ComponentProps<"select">, "value" | "children" | "multiple"> & {
  value: string;
  showTier?: boolean;
}) {
  return (
    <span className="model-select">
      <ProviderIcon model={value} />
      <select {...props} value={value}>
        {MODEL_CHOICES.map((model) => (
          <option key={model.id} value={model.id}>
            {model.provider} · {model.name}
            {showTier ? ` · ${model.tier}` : ""}
          </option>
        ))}
      </select>
    </span>
  );
}

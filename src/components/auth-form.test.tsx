import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthForm } from "./auth-form";
import { ModelLabel, ModelSelect } from "./model-identity";
import {
  ENABLED_MODEL_CHOICES,
  MODEL_CHOICES,
  isModelDisabled,
} from "@/lib/models";

describe("disabled models and authentication showcase", () => {
  it("advertises enabled models and an accurate available-model count", () => {
    const html = renderToStaticMarkup(<AuthForm />);
    expect(html).toContain(`${ENABLED_MODEL_CHOICES.length} models available`);
    expect(html).toContain("Gemini 3.8 Flash");
    for (const model of MODEL_CHOICES.filter(isModelDisabled)) {
      expect(html).not.toContain(model.name);
    }
  });

  it("keeps disabled models readable in saved rooms while excluding new selections", () => {
    const disabled = MODEL_CHOICES.find(isModelDisabled)!;
    expect(disabled).toBeDefined();
    expect(renderToStaticMarkup(<ModelLabel model={disabled.id} />)).toContain(
      disabled.name,
    );
    expect(
      renderToStaticMarkup(<ModelSelect value={ENABLED_MODEL_CHOICES[0].id} />),
    ).not.toContain(disabled.id);
    expect(renderToStaticMarkup(<ModelSelect value={disabled.id} />)).toContain(
      disabled.id,
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthForm } from "./auth-form";
import { ModelLabel, ModelSelect } from "./model-identity";
import {
  ENABLED_MODEL_CHOICES,
  MODEL_CHOICES,
  isModelDisabled,
} from "@/lib/models";

// Exercise retired-model behavior without requiring an unavailable production model.
vi.mock("@/lib/models", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/models")>();
  return {
    ...original,
    MODEL_CHOICES: [
      ...original.MODEL_CHOICES,
      {
        id: "test/retired-model",
        name: "Retired test model",
        provider: "Test",
        tier: "Small",
        disabled: true,
      },
    ],
  };
});

describe("disabled models and authentication showcase", () => {
  it("offers Google sign-in independently of required email fields", () => {
    const html = renderToStaticMarkup(<AuthForm />);
    expect(html).toContain("Continue with Google");
    expect(html.indexOf("Continue with Google")).toBeLessThan(
      html.indexOf("<form"),
    );
    expect(html).toContain('type="button" class="button full auth-google"');
  });

  it("renders a recoverable callback error without losing sign-in options", () => {
    const html = renderToStaticMarkup(
      <AuthForm initialError="Google sign-in was cancelled. Try again or sign in with email." />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Google sign-in was cancelled.");
    expect(html).toContain("Continue with Google");
    expect(html).toContain('type="email"');
  });
  it.each(["google/gemini-4-hydrogen", "google/gemini-3.8-flash"])(
    "makes %s available for new selections",
    (id) => {
      expect(ENABLED_MODEL_CHOICES.some((model) => model.id === id)).toBe(true);
      expect(
        renderToStaticMarkup(
          <ModelSelect value={ENABLED_MODEL_CHOICES[0].id} />,
        ),
      ).toContain(id);
    },
  );

  it("advertises enabled models and an accurate available-model count", () => {
    const html = renderToStaticMarkup(<AuthForm />);
    expect(html).toContain(`${ENABLED_MODEL_CHOICES.length} models available`);
    expect(html).toContain("Gemini 4 Hydrogen");
    expect(html).toContain("The explorer");
    // Still available in the app, but intentionally not advertised here.
    expect(html).not.toContain("Gemini 3.8 Flash");
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

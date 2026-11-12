import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { test } from "vitest";
import { parseEnv } from "node:util";
import { quoteValue, updateEnv } from "./bootstrap-env.mjs";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const { processEnv, resetEnv } = nextRequire("@next/env");

test("secret values survive the installed Next.js environment loader", () => {
  for (const value of [
    "test-key",
    "hash#value with spaces",
    "literal$VALUE${OTHER}",
    "single'quote",
    "both'and\"quotes",
    "back\\slash\\n",
    "trailing\\",
    "back\\$dollar",
  ]) {
    resetEnv();
    const files = [
      {
        path: ".env.local",
        contents: `BOOTSTRAP_TEST_VALUE=${quoteValue(value)}\n`,
      },
    ];
    processEnv(files, process.cwd(), console, true);
    assert.equal(files[0].env.BOOTSTRAP_TEST_VALUE, value);
  }
  resetEnv();
});

test("updates preserve unrelated values, comments, and unchanged secrets", () => {
  const source =
    "# keep this comment\nAI_GATEWAY_API_KEY='existing$REFERENCE'\nCUSTOM='line one\nline two'\nDAILY_BUDGET_USD=10\n";
  const result = updateEnv(source, { DAILY_BUDGET_USD: "5", SITE_URL: "" });
  assert.ok(
    result.startsWith(source.slice(0, source.indexOf("DAILY_BUDGET_USD"))),
  );
  assert.equal(parseEnv(result).DAILY_BUDGET_USD, "5");
  assert.equal(parseEnv(result).SITE_URL, "");
});

test("replaces multiline and duplicate assignments without interpreting replacement tokens", () => {
  const source =
    "AI_GATEWAY_API_KEY='old\nmultiline'\nexport AI_GATEWAY_API_KEY=duplicate\nOTHER=keep\n";
  const result = updateEnv(source, { AI_GATEWAY_API_KEY: "new$&value" });
  assert.equal(result.match(/^AI_GATEWAY_API_KEY=/gm).length, 1);
  assert.equal(parseEnv(result).OTHER, "keep");
  assert.ok(!result.includes("multiline"));
  assert.ok(!result.includes("duplicate"));
  assert.ok(result.includes("new\\$&value"));
});

test("rejects line injection and refuses non-interactive secret entry", () => {
  assert.throws(() => quoteValue("key\nINJECTED=value"));
  assert.throws(() => quoteValue("key\rvalue"));
  assert.throws(() => quoteValue("key\0value"));
  const run = spawnSync(process.execPath, ["scripts/bootstrap-env.mjs"], {
    encoding: "utf8",
    input: "should-not-be-used\n",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /interactive terminal/);
  assert.ok(!run.stdout.includes("should-not-be-used"));
});

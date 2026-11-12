import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { updateEnv } from "./bootstrap-env.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function syncLocalEnv({ root = projectRoot, env = process.env } = {}) {
  const raw = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "json"],
    {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  };
  const path = join(root, ".env.local");
  const source = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    if (!value) throw new Error(`Supabase status is missing ${key}`);
  }
  if (existsSync(path)) chmodSync(path, 0o600);
  writeFileSync(path, updateEnv(source, values), { mode: 0o600 });
  console.log(
    "Local Supabase connection saved to .env.local. Existing Gateway key preserved.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    syncLocalEnv();
  } catch (error) {
    console.error(
      error.code
        ? `Local Supabase setup failed (${error.code}).`
        : error.message,
    );
    process.exitCode = 1;
  }
}

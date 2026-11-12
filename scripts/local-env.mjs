import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const raw = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const status = JSON.parse(raw.slice(raw.indexOf("{")));
const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
};
let env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
for (const [key, value] of Object.entries(values)) {
  if (!value) throw new Error(`Supabase status is missing ${key}`);
  const line = `${key}=${value}`;
  env = new RegExp(`^${key}=.*$`, "m").test(env)
    ? env.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : env.trimEnd() + "\n" + line + "\n";
}
writeFileSync(".env.local", env, { mode: 0o600 });
console.log(
  "Local Supabase connection saved to .env.local. Existing Gateway key preserved.",
);

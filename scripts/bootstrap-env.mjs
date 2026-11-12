import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { parseEnv } from "node:util";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fields = [
  { key: "AI_GATEWAY_API_KEY", secret: true, required: true },
  { key: "NEXT_PUBLIC_SUPABASE_URL", url: true, required: true },
  {
    key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    secret: true,
    required: true,
  },
  { key: "SUPABASE_SECRET_KEY", secret: true, required: true },
  { key: "DAILY_BUDGET_USD", budget: true },
  { key: "SITE_URL", url: true },
];

// Next.js expands dollar references even inside quoted values.
export function quoteValue(value) {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Use a single-line value without control characters.");
  }
  const escaped = value.replaceAll("$", "\\$");
  for (const quote of ["'", '"', "\u0060"]) {
    if (!value.includes(quote)) {
      if (quote === '"' && /\\[nr]/.test(value)) continue;
      return `${quote}${escaped}${quote}`;
    }
  }
  throw new Error("The value contains an unsupported combination of quotes.");
}

export function updateEnv(source, updates) {
  let result = source;
  for (const [key, value] of Object.entries(updates)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key))
      throw new Error("Invalid variable name.");
    // Match a complete assignment, including quoted multiline existing values.
    const assignment = new RegExp(
      `^[\\t ]*(?:export[\\t ]+)?${key}[\\t ]*=[\\t ]*(?:'[^']*'|"[^"]*"|\x60[^\x60]*\x60|[^\\r\\n]*)[^\\r\\n]*`,
      "gm",
    );
    const line = `${key}=${quoteValue(value)}`;
    let found = false;
    result = result.replace(assignment, () => {
      if (found) return ""; // Remove duplicate definitions of edited keys.
      found = true;
      return line;
    });
    if (!found)
      result += `${result && !result.endsWith("\n") ? "\n" : ""}${line}\n`;
  }
  return result;
}

function readExisting(path) {
  try {
    if (!lstatSync(path).isFile()) {
      throw new Error(".env.local must be a regular file, not a symlink.");
    }
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function validate(field, value) {
  quoteValue(value);
  if (field.required && !value) throw new Error("A value is required.");
  if (field.url && value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Enter an absolute http:// or https:// URL.");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Enter an absolute http:// or https:// URL.");
    }
  }
  if (
    field.budget &&
    (!value || !Number.isFinite(Number(value)) || Number(value) <= 0)
  ) {
    throw new Error("Enter a daily budget greater than zero.");
  }
}

export async function bootstrap({ root = projectRoot } = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Run pnpm env:setup in an interactive terminal; piped input is disabled.",
    );
  }
  const path = join(root, ".env.local");
  const source = readExisting(path);
  const current = parseEnv(source);
  const defaults = parseEnv(readFileSync(join(root, ".env.example"), "utf8"));
  const updates = {};
  let hidden = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!hidden) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output,
    terminal: true,
    historySize: 0,
  });
  rl.on("SIGINT", () => rl.close());

  const ask = (label, secret) =>
    new Promise((resolve, reject) => {
      hidden = secret;
      const onClose = () => {
        process.stdout.write("\n");
        reject(new Error("Setup cancelled. .env.local was not changed."));
      };
      rl.once("close", onClose);
      // Write the label separately so readline can suppress all secret echo.
      if (secret) process.stdout.write(label);
      rl.question(secret ? "" : label, (answer) => {
        rl.off("close", onClose);
        if (secret) process.stdout.write("\n");
        hidden = false;
        resolve(answer.trim());
      });
    });

  console.log("Configure .env.local. Secret/key input is hidden.");
  console.log(
    "Press Enter to keep an existing value or use the shown default. Ctrl+C cancels.",
  );
  console.log("For local Supabase, run pnpm db:start first.");
  try {
    for (const field of fields) {
      const existing = Object.hasOwn(current, field.key);
      const fallback = existing
        ? current[field.key]
        : (defaults[field.key] ?? "");
      const hint = field.secret
        ? fallback
          ? " [set; Enter keeps current, hidden]"
          : " [hidden]"
        : fallback
          ? ` [${fallback}]`
          : " [optional; Enter skips]";
      while (true) {
        const answer = await ask(`${field.key}${hint}: `, !!field.secret);
        // Keep the original assignment verbatim, including variable references.
        if (!answer && existing && (fallback || !field.required)) break;
        const value = answer || fallback;
        try {
          validate(field, value);
          updates[field.key] = value;
          break;
        } catch (error) {
          console.log(error.message);
        }
      }
    }
  } finally {
    rl.close();
  }

  // Stage in a private directory and rename only after every prompt succeeds.
  const temp = mkdtempSync(join(root, ".env.local-"));
  try {
    const staged = join(temp, "env");
    writeFileSync(staged, updateEnv(source, updates), { mode: 0o600 });
    renameSync(staged, path);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  console.log(
    "Saved .env.local with owner-only permissions (0600). Restart pnpm dev to load changes.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  bootstrap().catch((error) => {
    // Filesystem errors may include paths, but never log supplied values.
    console.error(error.code ? `Setup failed (${error.code}).` : error.message);
    process.exitCode = 1;
  });
}

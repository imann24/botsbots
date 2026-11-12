import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { updateEnv } from "./bootstrap-env.mjs";
import { syncLocalEnv } from "./local-env.mjs";
import { runningContainers } from "./docker.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Only read the scalar port/enabled settings; leave the TOML itself untouched.
export function configuredPorts(config) {
  const sections = new Map();
  let section = "";
  for (const line of config.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([\w.]+)\]\s*(?:#.*)?$/);
    if (header) {
      section = header[1];
      sections.set(section, { enabled: true, ports: [] });
    }
    const enabled = line.match(/^\s*enabled\s*=\s*(true|false)\s*(?:#.*)?$/);
    if (enabled) sections.get(section).enabled = enabled[1] === "true";
    const port = line.match(
      /^\s*(port|shadow_port|inspector_port|smtp_port|pop3_port|vector_port)\s*=\s*(\d+)\s*(?:#.*)?$/,
    );
    if (port && section) {
      sections.get(section).ports.push({
        key: `SUPABASE_${section.replaceAll(".", "_")}_${port[1]}`.toUpperCase(),
        port: Number(port[2]),
      });
    }
  }
  return [...sections.values()]
    .filter((s) => s.enabled)
    .flatMap((s) => s.ports);
}

async function canBind(port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (["EADDRINUSE", "EACCES"].includes(error.code)) resolve(false);
      else if (
        host === "::" &&
        ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)
      )
        resolve(true);
      else reject(error);
    });
    server.listen(
      { port, host, ipv6Only: host === "::", exclusive: true },
      () => {
        server.close(() => resolve(true));
      },
    );
  });
}

export async function portAvailable(port) {
  return (await canBind(port, "0.0.0.0")) && (await canBind(port, "::"));
}

export async function allocatePorts(
  fields,
  overrides,
  occupied,
  available = portAvailable,
) {
  const requested = fields.map(({ key, port }) => ({
    key,
    port: Number(overrides[key] ?? port),
  }));
  for (const { key, port } of requested) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`${key} must be a port between 1 and 65535.`);
    }
  }
  const preferred = new Set(requested.map(({ port }) => port));
  const assigned = new Set(occupied);
  const result = {};
  for (const field of requested) {
    let port = field.port;
    for (let attempt = 0; ; attempt++) {
      if (attempt >= 65535)
        throw new Error("No available local Supabase ports found.");
      if (
        !assigned.has(port) &&
        (attempt === 0 || !preferred.has(port)) &&
        (await available(port))
      )
        break;
      port = port === 65535 ? 1024 : port + 1;
    }
    assigned.add(port);
    result[field.key] = String(port);
  }
  return result;
}

export function dockerPorts(containers, projectId) {
  const occupied = new Set();
  let running = false;
  for (const container of containers) {
    const own = (container.Labels ?? "")
      .split(",")
      .includes(`com.supabase.cli.project=${projectId}`);
    if (own) running = true;
    for (const match of (container.Ports ?? "").matchAll(/:(\d+)->/g)) {
      occupied.add(Number(match[1]));
    }
  }
  return { occupied, running };
}

export async function startDb({ root = projectRoot, args = [] } = {}) {
  // Help must not allocate ports or write configuration.
  if (args.includes("--help") || args.includes("-h")) {
    return (
      spawnSync("pnpm", ["exec", "supabase", "start", ...args], {
        cwd: root,
        stdio: "inherit",
      }).status ?? 1
    );
  }
  const config = readFileSync(join(root, "supabase/config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId)
    throw new Error("Missing project_id in supabase/config.toml.");
  const containers = runningContainers(root);
  const { occupied, running } = dockerPorts(containers, projectId);
  const envPath = join(root, "supabase/.env");
  const source = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const overrides = { ...parseEnv(source), ...process.env };
  let ports = {};
  if (!running) {
    ports = await allocatePorts(configuredPorts(config), overrides, occupied);
    const updated = updateEnv(source, ports);
    if (updated !== source) {
      if (existsSync(envPath)) chmodSync(envPath, 0o600);
      writeFileSync(envPath, updated, { mode: 0o600 });
    }
    console.log("Local Supabase ports:");
    for (const [key, port] of Object.entries(ports))
      console.log(`  ${key}=${port}`);
  } else {
    console.log("Reusing the existing BotsBots stack and its ports.");
  }
  // Passing overrides also wins over any exported stale port settings.
  const started = spawnSync("pnpm", ["exec", "supabase", "start", ...args], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...ports },
  });
  if (started.error) throw started.error;
  if (started.status !== 0) return started.status ?? 1;
  syncLocalEnv({ root, env: { ...process.env, ...ports }, checkDocker: false });
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startDb({ args: process.argv.slice(2) })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

import { afterEach, expect, test, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "node:util";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));
import { execFileSync, spawnSync } from "node:child_process";
import { syncLocalEnv } from "./local-env.mjs";
import { runningContainers } from "./docker.mjs";
import {
  allocatePorts,
  configuredPorts,
  dockerPorts,
  startDb,
} from "./start-db.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "botsbots-start-db-"));
  roots.push(root);
  mkdirSync(join(root, "supabase"));
  // No port probing is needed for these workflow tests.
  writeFileSync(
    join(root, "supabase/config.toml"),
    'project_id = "botsbots"\n',
  );
  writeFileSync(
    join(root, ".env.local"),
    "# keep\nAI_GATEWAY_API_KEY='dummy-existing-secret'\n",
  );
  return root;
}

test("reads every configured port while excluding disabled services and commented ports", () => {
  const ports = configuredPorts(readFileSync("supabase/config.toml", "utf8"));
  expect(ports.map(({ key }) => key)).toEqual([
    "SUPABASE_API_PORT",
    "SUPABASE_DB_PORT",
    "SUPABASE_DB_SHADOW_PORT",
    "SUPABASE_STUDIO_PORT",
    "SUPABASE_LOCAL_SMTP_PORT",
    "SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT",
    "SUPABASE_ANALYTICS_PORT",
  ]);
  expect(ports.find(({ key }) => key === "SUPABASE_API_PORT").port).toBe(54321);
});

test("skips Docker and host conflicts, reserves other service preferences, and reuses saved ports", async () => {
  const fields = [
    { key: "SUPABASE_API_PORT", port: 54321 },
    { key: "SUPABASE_DB_PORT", port: 54322 },
  ];
  const available = vi.fn(async (port) => port !== 54323);
  const result = await allocatePorts(fields, {}, new Set([54321]), available);
  expect(result).toEqual({
    SUPABASE_API_PORT: "54324",
    SUPABASE_DB_PORT: "54322",
  });
  expect(
    await allocatePorts(fields, result, new Set(), async () => true),
  ).toEqual(result);
  await expect(
    allocatePorts(fields, { SUPABASE_API_PORT: "invalid" }, new Set()),
  ).rejects.toThrow(/must be a port/);
});

test("recognizes only this project's running stack and includes IPv4/IPv6 Docker ports", () => {
  const other = {
    Labels: "com.supabase.cli.project=other",
    Ports: "0.0.0.0:54321->8000/tcp, [::]:54321->8000/tcp",
  };
  expect(dockerPorts([other], "botsbots")).toEqual({
    running: false,
    occupied: new Set([54321]),
  });
  expect(
    dockerPorts(
      [other, { Labels: "com.supabase.cli.project=botsbots", Ports: "" }],
      "botsbots",
    ).running,
  ).toBe(true);
});

test("successful startup updates env from actual status and preserves the Gateway secret", async () => {
  const root = fixture();
  execFileSync.mockReturnValueOnce("").mockReturnValueOnce(
    JSON.stringify({
      API_URL: "http://127.0.0.1:54331",
      PUBLISHABLE_KEY: "dummy-public",
      SECRET_KEY: "dummy-private",
    }),
  );
  spawnSync.mockReturnValue({ status: 0 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  expect(await startDb({ root })).toBe(0);
  const env = parseEnv(readFileSync(join(root, ".env.local"), "utf8"));
  expect(env.AI_GATEWAY_API_KEY).toBe("dummy-existing-secret");
  expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54331");
  expect(env.SUPABASE_SECRET_KEY).toBe("dummy-private");
  expect(statSync(join(root, ".env.local")).mode & 0o777).toBe(0o600);
});

test("running stack keeps port overrides and failed startup never updates app credentials", async () => {
  const root = fixture();
  writeFileSync(join(root, "supabase/.env"), "SUPABASE_API_PORT=54331\n");
  execFileSync.mockReturnValueOnce(
    JSON.stringify({
      Labels: "com.supabase.cli.project=botsbots",
      Ports: "0.0.0.0:54331->8000/tcp",
    }),
  );
  spawnSync.mockReturnValue({ status: 1 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  expect(await startDb({ root })).toBe(1);
  expect(readFileSync(join(root, "supabase/.env"), "utf8")).toBe(
    "SUPABASE_API_PORT=54331\n",
  );
  expect(
    parseEnv(readFileSync(join(root, ".env.local"), "utf8"))
      .NEXT_PUBLIC_SUPABASE_URL,
  ).toBeUndefined();
  expect(execFileSync).toHaveBeenCalledTimes(1);
});

test("Docker failure and help do not change local configuration", async () => {
  const root = fixture();
  execFileSync.mockImplementationOnce(() => {
    throw new Error("Docker unavailable");
  });
  await expect(startDb({ root })).rejects.toThrow(/Cannot reach Docker/);
  expect(spawnSync).not.toHaveBeenCalled();
  spawnSync.mockReturnValue({ status: 0 });
  expect(await startDb({ root, args: ["--help"] })).toBe(0);
  expect(execFileSync).toHaveBeenCalledTimes(1);
});

test.each([
  [{ code: "ENOENT" }, /Docker CLI is missing/],
  [
    { stderr: Buffer.from("permission denied while trying to connect") },
    /without sudo/,
  ],
  [
    { stderr: Buffer.from("Cannot connect to the Docker daemon") },
    /systemctl start docker/,
  ],
])("explains Docker failures on Linux: %j", (failure, message) => {
  execFileSync.mockImplementationOnce(() => {
    throw failure;
  });
  expect(() => runningContainers(fixture())).toThrow(message);
});

test("standalone setup checks Docker and preserves credentials when the stack is stopped", () => {
  const root = fixture();
  const original = readFileSync(join(root, ".env.local"), "utf8");
  execFileSync.mockReturnValueOnce("").mockImplementationOnce(() => {
    throw new Error("stack is stopped");
  });
  expect(() => syncLocalEnv({ root })).toThrow(/pnpm db:start/);
  expect(readFileSync(join(root, ".env.local"), "utf8")).toBe(original);
});

test("standalone setup reads the running Linux stack and supports legacy keys", () => {
  const root = fixture();
  execFileSync.mockReturnValueOnce("").mockReturnValueOnce(
    JSON.stringify({
      API_URL: "http://127.0.0.1:54321",
      ANON_KEY: "dummy-public",
      SERVICE_ROLE_KEY: "dummy-private",
    }),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  syncLocalEnv({ root });
  const env = parseEnv(readFileSync(join(root, ".env.local"), "utf8"));
  expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("dummy-public");
  expect(env.SUPABASE_SECRET_KEY).toBe("dummy-private");
  expect(env.AI_GATEWAY_API_KEY).toBe("dummy-existing-secret");
});

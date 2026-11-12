import { execFileSync } from "node:child_process";

export function runningContainers(root) {
  let raw;
  try {
    raw = execFileSync("docker", ["ps", "--format", "{{json .}}"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = String(error.stderr ?? "");
    if (error.code === "ENOENT") {
      throw new Error(
        "Docker CLI is missing. Install Docker Engine on Linux or Docker Desktop/OrbStack on macOS, then rerun the command.",
      );
    }
    if (/permission denied/i.test(detail)) {
      throw new Error(
        "Cannot reach Docker: permission denied. On Linux, configure Docker socket access for your user (or use rootless Docker), then log out and back in. Verify `docker ps` works without sudo before rerunning the command.",
      );
    }
    throw new Error(
      "Cannot reach Docker. On Linux, start Docker Engine (sudo systemctl start docker), or start Docker Desktop/OrbStack on macOS. Check `docker context show` and DOCKER_HOST, and verify `docker ps` works before rerunning the command.",
    );
  }
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

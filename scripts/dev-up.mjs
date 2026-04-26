import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";

const rootDir = process.cwd();
const backendDir = path.join(rootDir, "tts-server");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const pythonCommand = process.platform === "win32" ? "python" : "python3";

const urls = {
  backend: "http://localhost:8000",
  health: "http://localhost:8000/api/health",
};

const children = [];
let shuttingDown = false;

function checkPortOnHost(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;

    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(500);
    socket.once("connect", () => done(false));
    socket.once("timeout", () => done(true));
    socket.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "ECONNREFUSED") {
        done(true);
        return;
      }
      if (host === "::1") {
        done(true);
        return;
      }
      done(false);
    });
  });
}

async function checkPortAvailable(port) {
  const [ipv4Available, ipv6Available] = await Promise.all([
    checkPortOnHost(port, "0.0.0.0"),
    checkPortOnHost(port, "::"),
  ]);
  return ipv4Available && ipv6Available;
}

async function findFreePort(startPort, endPort = startPort + 50) {
  for (let port = startPort; port <= endPort; port += 1) {
    // Keep the search narrow so dev-up still fails fast if the range is exhausted.
    // We only need a nearby free port for local development.
    if (await checkPortAvailable(port)) return port;
  }
  return null;
}

async function isHealthy(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function pipeOutput(label, stream) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    console.log(`[${label}] ${line}`);
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 1500).unref();
}

function startProcess({ label, command, args, cwd }) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);
  pipeOutput(label, child.stdout);
  pipeOutput(label, child.stderr);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[${label}] exited with ${detail}`);
    shutdown(code ?? 1);
  });

  child.on("error", (error) => {
    if (shuttingDown) return;
    console.error(`[${label}] failed to start: ${error.message}`);
    shutdown(1);
  });

  return child;
}

console.log("Starting local development stack");
console.log(`Backend URL: ${urls.backend}`);
console.log("Frontend URL: will be selected automatically starting at http://localhost:3000");
console.log(`Health check URL: ${urls.health}`);
console.log("Processes will stop together if one crashes.");

const backendPortAvailable = await checkPortAvailable(8000);
const backendAlreadyRunning = !backendPortAvailable && (await isHealthy(urls.health));

if (!backendPortAvailable && !backendAlreadyRunning) {
  console.error("Cannot start the backend because port 8000 is already in use by another process.");
  console.error("Stop the existing service on port 8000 or set up a free backend port before retrying.");
  process.exit(1);
}

if (!backendAlreadyRunning) {
  startProcess({
    label: "backend",
    command: pythonCommand,
    args: ["server.py"],
    cwd: backendDir,
  });
} else {
  console.log("Reusing the backend already running on port 8000.");
}

const frontendPort = (await findFreePort(3000)) ?? null;
if (!frontendPort) {
  console.error("Cannot find a free frontend port starting from 3000.");
  process.exit(1);
}

const frontendUrl = `http://localhost:${frontendPort}`;
console.log(`Frontend will use: ${frontendUrl}`);

startProcess({
  label: "frontend",
  command: process.execPath,
  args: [
    "scripts/run-with-log.mjs",
    "dev.log",
    process.execPath,
    nextBin,
    "dev",
    "--turbopack",
    "-p",
    String(frontendPort),
  ],
  cwd: rootDir,
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

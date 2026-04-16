import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";

const rootDir = process.cwd();
const backendDir = path.join(rootDir, "tts-server");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const pythonCommand = process.platform === "win32" ? "python" : "python3";

const urls = {
  backend: "http://localhost:8000",
  frontend: "http://localhost:3000",
  health: "http://localhost:8000/api/health",
};

const children = [];
let shuttingDown = false;

function checkPortAvailable(port, host = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
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
console.log(`Frontend URL: ${urls.frontend}`);
console.log(`Health check URL: ${urls.health}`);
console.log("Processes will stop together if one crashes.");

startProcess({
  label: "backend",
  command: pythonCommand,
  args: ["server.py"],
  cwd: backendDir,
});

startProcess({
  label: "frontend",
  command: npmCommand,
  args: ["run", "dev"],
  cwd: rootDir,
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const [backendPortAvailable, frontendPortAvailable] = await Promise.all([
  checkPortAvailable(8000),
  checkPortAvailable(3000),
]);

if (!backendPortAvailable || !frontendPortAvailable) {
  console.error("Cannot start local development stack because required ports are already in use.");
  if (!backendPortAvailable) console.error("Port 8000 is already in use. Stop the existing backend before retrying.");
  if (!frontendPortAvailable) console.error("Port 3000 is already in use. Stop the existing frontend before retrying.");
  process.exit(1);
}

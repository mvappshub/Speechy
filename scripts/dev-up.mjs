import { spawn } from "node:child_process";
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

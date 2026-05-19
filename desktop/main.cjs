const { app, BrowserWindow, dialog, shell } = require("electron");
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const process = require("node:process");

const isWindows = process.platform === "win32";
const managedChildren = [];
let mainWindow = null;
let shuttingDown = false;
let shutdownPromise = null;
let appCanQuitOnWindowClose = false;

function projectRoot() {
  return app.getAppPath();
}

function backendDir() {
  return path.join(projectRoot(), "tts-server");
}

function frontendDir() {
  return path.join(projectRoot(), ".next", "standalone");
}

function frontendServerPath() {
  return path.join(frontendDir(), "server.js");
}

function preloadPath() {
  return path.join(projectRoot(), "desktop", "preload.cjs");
}

function logDir() {
  const baseDir = app.isPackaged ? app.getPath("userData") : projectRoot();
  const target = path.join(baseDir, "desktop-logs");
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function writeMainLog(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(path.join(logDir(), "main.log"), `[${timestamp}] ${message}\n`);
}

function writableServerRoot() {
  const target = path.join(app.getPath("userData"), "tts-server-data");
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function showLoadingMessage(title, detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  writeMainLog(`loading-screen: ${title}`);
  const html = `<!doctype html>
  <html lang="cs">
    <body style="margin:0;background:#101418;color:#f5f7fa;font-family:Segoe UI,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
      <main style="max-width:640px;padding:32px 36px;border:1px solid rgba(255,255,255,0.08);border-radius:20px;background:linear-gradient(180deg,#18212b 0%,#121820 100%);box-shadow:0 18px 80px rgba(0,0,0,0.35);">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8fb3d9;margin-bottom:16px;">Speechy Desktop</div>
        <h1 style="margin:0 0 12px;font-size:30px;line-height:1.15;">${escapeHtml(title)}</h1>
        <p style="margin:0;color:#ced7e2;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(detail)}</p>
      </main>
    </body>
  </html>`;
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasLocalListener(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let settled = false;

    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;

    const done = (value) => {
      if (settled) return;
      settled = true;
      if (!server.listening) {
        resolve(value);
        return;
      }
      server.close(() => resolve(value));
    };

    server.unref();
    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error) {
        if (error.code === "EADDRINUSE" || error.code === "EACCES") {
          done(false);
          return;
        }
      }
      done(false);
    });
    server.once("listening", () => done(true));

    try {
      server.listen({ host: "127.0.0.1", port, exclusive: true });
    } catch {
      done(false);
    }
  });
}

async function checkPortAvailable(port) {
  if (await hasLocalListener(port)) return false;
  return canBindPort(port);
}

async function findFreePort(startPort, endPort = startPort + 50) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await checkPortAvailable(port)) return port;
  }
  return null;
}

async function waitForUrl(url, label, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch {
      // Startup polling intentionally swallows transient connection errors.
    }
    await sleep(500);
  }
  throw new Error(`${label} did not become ready at ${url} within ${Math.round(timeoutMs / 1000)}s.`);
}

function createChildLogger(name) {
  fs.mkdirSync(logDir(), { recursive: true });
  return {
    stdout: fs.createWriteStream(path.join(logDir(), `${name}.stdout.log`), { flags: "a" }),
    stderr: fs.createWriteStream(path.join(logDir(), `${name}.stderr.log`), { flags: "a" }),
  };
}

function startManagedProcess({ name, command, args, cwd, env }) {
  writeMainLog(`starting ${name}: ${command} ${args.join(" ")}`);
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const logs = createChildLogger(name);

  child.stdout.on("data", (chunk) => logs.stdout.write(chunk));
  child.stderr.on("data", (chunk) => logs.stderr.write(chunk));

  child.on("exit", (code, signal) => {
    writeMainLog(`${name} exited with ${signal ? `signal ${signal}` : `code ${code ?? 0}`}`);
    logs.stdout.end();
    logs.stderr.end();
    if (shuttingDown) return;
    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    const message = `${name} exited unexpectedly with ${detail}.\n\nLogs: ${logDir()}`;
    dialog.showErrorBox("Speechy startup failed", message);
    shutdownAndQuit(1);
  });

  child.on("error", (error) => {
    writeMainLog(`${name} start error: ${error.message}`);
    logs.stdout.end();
    logs.stderr.end();
    if (shuttingDown) return;
    const message = `${name} failed to start: ${error.message}\n\nLogs: ${logDir()}`;
    dialog.showErrorBox("Speechy startup failed", message);
    shutdownAndQuit(1);
  });

  managedChildren.push(child);
  return child;
}

function probeCommand(candidate) {
  return new Promise((resolve) => {
    execFile(
      candidate.command,
      [...candidate.args, ...candidate.probeArgs],
      {
        windowsHide: true,
        timeout: 8000,
        env: {
          ...process.env,
          ...candidate.env,
        },
      },
      (error) => {
        resolve(error ? null : candidate);
      },
    );
  });
}

async function resolvePythonLaunch() {
  const candidates = [
    process.env.SPEECHY_PYTHON
      ? {
          command: process.env.SPEECHY_PYTHON,
          args: [],
          probeArgs: ["-c", "import sys; print(sys.executable)"],
        }
      : null,
    { command: "python", args: [], probeArgs: ["-c", "import sys; print(sys.executable)"] },
    isWindows
      ? { command: "py", args: ["-3"], probeArgs: ["-c", "import sys; print(sys.executable)"] }
      : { command: "python3", args: [], probeArgs: ["-c", "import sys; print(sys.executable)"] },
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = await probeCommand(candidate);
    if (resolved) return resolved;
  }

  throw new Error("Python 3 with backend dependencies was not found. Set SPEECHY_PYTHON if needed.");
}

async function resolveNodeLaunch() {
  const candidates = [
    process.env.SPEECHY_NODE
      ? {
          command: process.env.SPEECHY_NODE,
          args: [],
          probeArgs: ["-e", "console.log(process.version)"],
          env: {},
        }
      : null,
    {
      command: "node",
      args: [],
      probeArgs: ["-e", "console.log(process.version)"],
      env: {},
    },
    {
      command: process.execPath,
      args: [],
      probeArgs: ["-e", "console.log(process.version)"],
      env: { ELECTRON_RUN_AS_NODE: "1" },
    },
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = await probeCommand(candidate);
    if (resolved) return resolved;
  }

  throw new Error("Node.js runtime for the frontend was not found.");
}

async function startDesktopStack() {
  await showLoadingMessage("Spouštím desktop aplikaci", "Připravuji lokální backend a produkční frontend.");

  const backendPort = await findFreePort(8000, 8050);
  if (!backendPort) {
    throw new Error("Nenašel jsem volný port pro TTS backend v rozsahu 8000-8050.");
  }

  const frontendPort = await findFreePort(3000, 3050);
  if (!frontendPort) {
    throw new Error("Nenašel jsem volný port pro frontend v rozsahu 3000-3050.");
  }

  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  writeMainLog(`selected ports frontend=${frontendPort} backend=${backendPort}`);
  const writableRoot = writableServerRoot();
  const python = await resolvePythonLaunch();
  const node = await resolveNodeLaunch();

  await showLoadingMessage("Spouštím TTS backend", `Backend poběží na ${backendUrl}.`);
  startManagedProcess({
    name: "backend",
    command: python.command,
    args: [...python.args, "server.py"],
    cwd: backendDir(),
    env: {
      ...process.env,
      TTS_SERVER_PORT: String(backendPort),
      TTS_SERVER_RELOAD: "0",
      TTS_SERVER_STORAGE_DIR: path.join(writableRoot, "projects"),
      TTS_SERVER_MODEL_CACHE_DIR: path.join(writableRoot, "model-cache"),
      TTS_SERVER_VOICES_DIR: path.join(writableRoot, "voices"),
    },
  });
  await waitForUrl(`${backendUrl}/api/health`, "TTS backend", 120000);

  await showLoadingMessage("Spouštím frontend", `Frontend poběží na ${frontendUrl}.`);
  startManagedProcess({
    name: "frontend",
    command: node.command,
    args: [...node.args, frontendServerPath()],
    cwd: frontendDir(),
    env: {
      ...process.env,
      ...node.env,
      NODE_ENV: "production",
      PORT: String(frontendPort),
      HOSTNAME: "127.0.0.1",
      NEXT_PUBLIC_TTS_API_BASE_URL: backendUrl,
    },
  });
  await waitForUrl(frontendUrl, "Frontend", 60000);

  return { backendUrl, frontendUrl };
}

function createMainWindow(backendUrl) {
  const window = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0f141a",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--speechy-tts-api-base-url=${backendUrl}`],
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return window;
}

function terminateChildProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.killed || child.exitCode !== null) {
      resolve();
      return;
    }

    if (isWindows) {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("close", () => resolve());
      killer.once("error", () => resolve());
      return;
    }

    child.kill("SIGTERM");
    const forceTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Process is already gone.
      }
    }, 1500);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
  });
}

function shutdownAndQuit(code = 0) {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  shutdownPromise = Promise.all(managedChildren.map((child) => terminateChildProcess(child))).finally(() => {
    app.exit(code);
  });
  return shutdownPromise;
}

async function bootstrap() {
  app.setAppUserModelId("cz.speechy.desktop");
  writeMainLog("bootstrap start");
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: "#0f141a",
  });
  await showLoadingMessage("Spouštím Speechy", "Tahle verze sama startuje backend i frontend.");

  try {
    const runtime = await startDesktopStack();
    const readyWindow = createMainWindow(runtime.backendUrl);
    const loadingWindow = mainWindow;
    mainWindow = readyWindow;
    const readyToShow = new Promise((resolve) => {
      readyWindow.once("ready-to-show", resolve);
    });
    await readyWindow.loadURL(runtime.frontendUrl);
    await Promise.race([readyToShow, sleep(1500)]);
    readyWindow.show();
    appCanQuitOnWindowClose = true;
    writeMainLog("main window shown");
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeMainLog(`bootstrap error: ${message}`);
    dialog.showErrorBox("Speechy startup failed", `${message}\n\nLogs: ${logDir()}`);
    await shutdownAndQuit(1);
  }
}

app.on("window-all-closed", () => {
  writeMainLog(`window-all-closed: appCanQuitOnWindowClose=${appCanQuitOnWindowClose}`);
  if (!appCanQuitOnWindowClose) return;
  shutdownAndQuit(0);
});

app.on("before-quit", () => {
  writeMainLog("before-quit");
  shuttingDown = true;
});

process.on("uncaughtException", (error) => {
  writeMainLog(`uncaughtException: ${error.stack || error.message}`);
  dialog.showErrorBox("Speechy crashed", `${error.message}\n\nLogs: ${logDir()}`);
  shutdownAndQuit(1);
});

process.on("unhandledRejection", (error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  writeMainLog(`unhandledRejection: ${message}`);
  dialog.showErrorBox("Speechy crashed", `${message}\n\nLogs: ${logDir()}`);
  shutdownAndQuit(1);
});

app.whenReady().then(bootstrap);

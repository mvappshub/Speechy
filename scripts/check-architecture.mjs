import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const limits = [
  ["src/app/page.tsx", 20],
  ["tts-server/server.py", 20],
  ["src/features/reader/application/useReaderController.ts", 230],
  ["src/features/reader/application/useLongFormPlaybackSession.ts", 420],
  ["tts-server/infrastructure/project_store.py", 250],
  ["tts-server/presentation/http.py", 280],
];

for (const [file, maxLines] of limits) {
  const full = path.join(root, file);
  const lines = fs.readFileSync(full, "utf8").split(/\r?\n/).length;
  if (lines > maxLines) {
    console.error(`${file} exceeds hotspot limit (${lines} > ${maxLines})`);
    process.exit(1);
  }
}

const tsFiles = walk(path.join(root, "src/features/reader")).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
for (const file of tsFiles) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const layer = rel.split("/")[3];
  const source = fs.readFileSync(file, "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  for (const imp of imports) {
    if (!imp.startsWith("../") && !imp.startsWith("./") && !imp.startsWith("@/features/reader/")) continue;
    const normalized = resolveLayerImport(rel, imp);
    if (!normalized) continue;
    if (layer === "domain" && normalized !== "domain") fail(rel, imp, "domain can import only domain");
    if (layer === "infrastructure" && !["domain", "infrastructure"].includes(normalized)) fail(rel, imp, "infrastructure may import only domain/infrastructure");
    if (layer === "application" && !["domain", "infrastructure", "application"].includes(normalized)) fail(rel, imp, "application may import only domain/infrastructure/application");
    if (layer === "ui" && !["ui", "application", "domain"].includes(normalized)) fail(rel, imp, "ui may import only ui/application/domain");
  }
}

const pyFiles = walk(path.join(root, "tts-server")).filter((file) => file.endsWith(".py"));
for (const file of pyFiles) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const parts = rel.split("/");
  const layer = parts[1];
  if (!["application", "domain", "infrastructure", "presentation"].includes(layer)) continue;
  const source = fs.readFileSync(file, "utf8");
  const imports = [...source.matchAll(/^(?:from|import)\s+([a-zA-Z_][\w\.]*)/gm)].map((match) => match[1]);
  for (const imp of imports) {
    const normalized = imp.split(".")[0];
    if (!["application", "domain", "infrastructure", "presentation"].includes(normalized)) continue;
    if (layer === "domain" && normalized !== "domain") fail(rel, imp, "backend domain cannot import outer layers");
    if (layer === "infrastructure" && !["domain", "infrastructure"].includes(normalized)) fail(rel, imp, "backend infrastructure may import only domain/infrastructure");
    if (layer === "application" && !["domain", "infrastructure", "application"].includes(normalized)) fail(rel, imp, "backend application may import only domain/infrastructure/application");
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function resolveLayerImport(fromFile, specifier) {
  if (specifier.startsWith("@/features/reader/")) {
    return specifier.split("/")[3] ?? null;
  }
  const fromDir = path.dirname(path.join(root, fromFile));
  const resolved = path.normalize(path.join(fromDir, specifier));
  const marker = `${path.sep}reader${path.sep}`;
  const index = resolved.lastIndexOf(marker);
  if (index === -1) return null;
  return resolved.slice(index + marker.length).split(path.sep)[0] ?? null;
}

function fail(file, specifier, message) {
  console.error(`${file}: invalid import '${specifier}' (${message})`);
  process.exit(1);
}

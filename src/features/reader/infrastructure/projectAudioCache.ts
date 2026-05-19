import type { ProjectSnapshot } from "../domain/types";
import { requestBlob } from "./ttsHttpClient";

const projectBlockAudioCache = new Map<string, Blob>();
let activeAudioCacheProjectId: string | null = null;

export async function fetchProjectBlockAudioBlob(
  projectId: string,
  blockIndex: number,
  blockCacheKey?: string,
) {
  ensureActiveProjectAudioCache(projectId);
  const cacheKey = `${projectId}:${blockIndex}:${blockCacheKey ?? "unknown"}`;
  const cached = projectBlockAudioCache.get(cacheKey);
  if (cached) return cached;

  const start = performance.now();
  const blob = await requestBlob(
    `/api/projects/${projectId}/blocks/${blockIndex}/audio`,
    "Unable to fetch project block audio.",
    { cache: "no-store" },
  );
  const duration = performance.now() - start;
  if (duration > 1000) {
    console.log(`[ttsApi] fetchProjectBlockAudioBlob took ${duration.toFixed(0)}ms`);
  }

  projectBlockAudioCache.set(cacheKey, blob);
  return blob;
}

export function clearProjectBlockAudioCache(projectId?: string | null) {
  if (!projectId || projectId === activeAudioCacheProjectId) {
    projectBlockAudioCache.clear();
    activeAudioCacheProjectId = projectId ?? null;
    return;
  }

  for (const key of projectBlockAudioCache.keys()) {
    if (key.startsWith(`${projectId}:`)) {
      projectBlockAudioCache.delete(key);
    }
  }
}

export function preloadProjectBlockAudio(project: ProjectSnapshot) {
  ensureActiveProjectAudioCache(project.id);
  for (const block of project.blocks) {
    if (!block.audio_ready) continue;
    void fetchProjectBlockAudioBlob(project.id, block.index, block.cache_key).catch(() => {});
  }
}

function ensureActiveProjectAudioCache(projectId: string) {
  if (activeAudioCacheProjectId === projectId) return;
  projectBlockAudioCache.clear();
  activeAudioCacheProjectId = projectId;
}

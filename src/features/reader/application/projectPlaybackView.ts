import type { PlaybackChunk } from "../domain/chunking";
import type { ProjectSnapshot } from "../domain/types";

export function getProjectPlaybackError(project: ProjectSnapshot) {
  return project.blocks.find((block) => block.error)?.error ?? "Generování projektu selhalo.";
}

export function buildPlaybackChunksFromProject(
  project: ProjectSnapshot | null,
  fallbackChunks: PlaybackChunk[],
): PlaybackChunk[] {
  if (!project) return fallbackChunks;
  return project.blocks.map((block) => ({
    index: block.index,
    text: block.text,
    start: block.index,
    end: block.index + 1,
  }));
}

export function resolveProjectDownloadUrl(
  project: ProjectSnapshot | null,
  getProjectDownloadUrl: (projectId: string) => string,
) {
  if (!project?.download_ready) return null;
  return getProjectDownloadUrl(project.id);
}

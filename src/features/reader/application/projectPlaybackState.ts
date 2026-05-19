import type { ProjectSnapshot } from "../domain/types";

export function getProjectAudioCacheSignature(project: ProjectSnapshot) {
  return project.blocks.map((block) => `${block.index}:${block.cache_key}`).join("|");
}

type AppliedProjectRuntimeInput = {
  currentProjectId: string | null;
  currentAudioCacheSignature: string | null;
  currentQueueLength: number;
  project: ProjectSnapshot;
};

export function deriveAppliedProjectRuntime({
  currentProjectId,
  currentAudioCacheSignature,
  currentQueueLength,
  project,
}: AppliedProjectRuntimeInput) {
  const audioCacheSignature = getProjectAudioCacheSignature(project);
  return {
    audioCacheSignature,
    nextQueueLength: Math.max(currentQueueLength, project.blocks.length),
    shouldClearProjectAudioCache:
      currentProjectId !== project.id || currentAudioCacheSignature !== audioCacheSignature,
  };
}

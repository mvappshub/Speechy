import type { ProjectSnapshot } from "../domain/types";

type AttemptDesiredPlaybackOrStartPollingArgs = {
  projectId: string;
  source: string;
  tryPlayDesiredChunk: () => Promise<boolean>;
  startPolling: (projectId: string, source: string) => void;
};

export async function attemptDesiredPlaybackOrStartPolling({
  projectId,
  source,
  tryPlayDesiredChunk,
  startPolling,
}: AttemptDesiredPlaybackOrStartPollingArgs) {
  const started = await tryPlayDesiredChunk();
  if (!started) {
    startPolling(projectId, source);
  }
  return started;
}

export function shouldStartProjectRender(project: ProjectSnapshot) {
  return project.progress.total === 0 || project.progress.done < project.progress.total;
}

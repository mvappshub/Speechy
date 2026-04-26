import { LoaderCircle } from "lucide-react";
import type { PlaybackState } from "../domain/types";
import type { ReaderWorkflowStage } from "../domain/workflow";

export function PlaybackControls({
  playbackState,
  workflowStage,
  statusLabel,
  downloadUrl,
  canPlay,
  onPlay,
  onPause,
  onResume,
  onStop,
}: {
  playbackState: PlaybackState;
  workflowStage: ReaderWorkflowStage;
  statusLabel?: string | null;
  downloadUrl: string | null;
  canPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 pt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
      {workflowStage === "assigning" && playbackState === "idle" ? (
        <button onClick={onPlay} disabled={!canPlay} className="frameless-action frameless-action--strong frameless-focus">
          <span>▶</span>
          <span>Přehrát</span>
        </button>
      ) : null}
      {playbackState === "loading" ? (
        <button disabled className="frameless-action frameless-action--strong frameless-focus animate-pulse">
          <span>…</span>
          <span>{statusLabel ?? "Připravuji přehrávání"}</span>
        </button>
      ) : null}
      {playbackState !== "loading" && statusLabel ? (
        <div className="inline-flex items-center gap-2 text-gray-400">
          <LoaderCircle className="h-3 w-3 animate-spin" />
          <span>{statusLabel}</span>
        </div>
      ) : null}
      {playbackState === "playing" ? (
        <button
          onClick={onPause}
          className="frameless-action frameless-action--strong frameless-focus"
        >
          <span>❚❚</span>
          <span>Pozastavit</span>
        </button>
      ) : null}
      {playbackState === "paused" ? (
        <button
          onClick={onResume}
          className="frameless-action frameless-action--strong frameless-focus"
        >
          <span>▶</span>
          <span>Pokračovat</span>
        </button>
      ) : null}
      {playbackState !== "idle" ? (
        <button
          onClick={onStop}
          className="frameless-action frameless-focus"
        >
          <span>■</span>
          <span>Zastavit</span>
        </button>
      ) : null}
      {downloadUrl && playbackState !== "loading" ? (
        <a
          href={downloadUrl}
          className="frameless-action frameless-focus"
        >
          <span>↓</span>
          <span>Stáhnout WAV</span>
        </a>
      ) : null}
    </div>
  );
}

import type { PlaybackState, ReaderProgress } from "../domain/types";

export function PlaybackControls({
  playbackState,
  progress,
  loadingLabel,
  disabled,
  downloadUrl,
  onPlay,
  onPause,
  onResume,
  onStop,
}: {
  playbackState: PlaybackState;
  progress: ReaderProgress | null;
  loadingLabel?: string | null;
  disabled: boolean;
  downloadUrl: string | null;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 pt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
      {playbackState === "idle" ? (
        <button
          onClick={onPlay}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-inherit transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
          title={disabled ? "Nejdřív rozděl text do bloků a zvol hlasy." : undefined}
        >
          <span>▶</span>
          <span>Přehrát</span>
        </button>
      ) : null}
      {playbackState === "loading" ? (
        <button
          disabled
          className="inline-flex items-center gap-1 text-inherit opacity-70"
        >
          <span>…</span>
          <span>{loadingLabel ?? (progress ? `Generuji ${progress.done}/${progress.total}` : "Generuji")}</span>
        </button>
      ) : null}
      {playbackState === "playing" ? (
        <button
          onClick={onPause}
          className="inline-flex items-center gap-1 text-inherit transition-colors hover:text-black"
        >
          <span>❚❚</span>
          <span>Pozastavit</span>
        </button>
      ) : null}
      {playbackState === "paused" ? (
        <button
          onClick={onResume}
          className="inline-flex items-center gap-1 text-inherit transition-colors hover:text-black"
        >
          <span>▶</span>
          <span>Pokračovat</span>
        </button>
      ) : null}
      {playbackState !== "idle" ? (
        <button
          onClick={onStop}
          className="inline-flex items-center gap-1 text-inherit transition-colors hover:text-red-500"
        >
          <span>■</span>
          <span>Zastavit</span>
        </button>
      ) : null}
      {downloadUrl && playbackState !== "loading" ? (
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-1 text-inherit transition-colors hover:text-black"
        >
          <span>↓</span>
          <span>Stáhnout WAV</span>
        </a>
      ) : null}
    </div>
  );
}

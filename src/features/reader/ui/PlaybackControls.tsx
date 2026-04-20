import type { PlaybackState, ReaderProgress } from "../domain/types";

export function PlaybackControls({
  playbackState,
  progress,
  loadingLabel,
  downloadUrl,
  onPause,
  onResume,
  onStop,
}: {
  playbackState: PlaybackState;
  progress: ReaderProgress | null;
  loadingLabel?: string | null;
  downloadUrl: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 pt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
      {playbackState === "loading" ? (
        <button
          disabled
          className="inline-flex items-center gap-1 bg-black px-3 py-2 text-white opacity-70"
        >
          <span>…</span>
          <span>{loadingLabel ?? (progress ? `Generuji ${progress.done}/${progress.total}` : "Generuji")}</span>
        </button>
      ) : null}
      {playbackState === "playing" ? (
        <button
          onClick={onPause}
          className="inline-flex items-center gap-1 bg-black px-3 py-2 text-white transition-opacity hover:opacity-85"
        >
          <span>❚❚</span>
          <span>Pozastavit</span>
        </button>
      ) : null}
      {playbackState === "paused" ? (
        <button
          onClick={onResume}
          className="inline-flex items-center gap-1 bg-black px-3 py-2 text-white transition-opacity hover:opacity-85"
        >
          <span>▶</span>
          <span>Pokračovat</span>
        </button>
      ) : null}
      {playbackState !== "idle" ? (
        <button
          onClick={onStop}
          className="inline-flex items-center gap-1 bg-black px-3 py-2 text-white transition-opacity hover:opacity-85"
        >
          <span>■</span>
          <span>Zastavit</span>
        </button>
      ) : null}
      {downloadUrl && playbackState !== "loading" ? (
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-1 bg-black px-3 py-2 text-white transition-opacity hover:opacity-85"
        >
          <span>↓</span>
          <span>Stáhnout WAV</span>
        </a>
      ) : null}
    </div>
  );
}

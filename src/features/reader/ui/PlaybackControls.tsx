import type { PlaybackState, ReaderProgress } from "../domain/types";

export function PlaybackControls({
  playbackState,
  progress,
  disabled,
  downloadUrl,
  onPlay,
  onPause,
  onResume,
  onStop,
}: {
  playbackState: PlaybackState;
  progress: ReaderProgress | null;
  disabled: boolean;
  downloadUrl: string | null;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
      {playbackState === "idle" ? (
        <button
          onClick={onPlay}
          disabled={disabled}
          className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>▶</span>
          <span>Přehrát</span>
        </button>
      ) : null}
      {playbackState === "loading" ? (
        <button
          disabled
          className="inline-flex items-center gap-2 border border-gray-300 bg-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-500"
        >
          <span>…</span>
          <span>{progress ? `Generuji ${progress.done}/${progress.total}` : "Generuji"}</span>
        </button>
      ) : null}
      {playbackState === "playing" ? (
        <button
          onClick={onPause}
          className="inline-flex items-center gap-2 border border-black bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-black"
        >
          <span>❚❚</span>
          <span>Pozastavit</span>
        </button>
      ) : null}
      {playbackState === "paused" ? (
        <button
          onClick={onResume}
          className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white"
        >
          <span>▶</span>
          <span>Pokračovat</span>
        </button>
      ) : null}
      {playbackState !== "idle" ? (
        <button
          onClick={onStop}
          className="inline-flex items-center gap-2 border border-gray-300 bg-transparent px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-500"
        >
          <span>■</span>
          <span>Zastavit</span>
        </button>
      ) : null}
      {downloadUrl && playbackState !== "loading" ? (
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-black"
        >
          <span>↓</span>
          <span>Stáhnout WAV</span>
        </a>
      ) : null}
    </div>
  );
}

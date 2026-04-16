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
    <div className="space-y-3 pt-12">
      {playbackState === "idle" && (
        <button
          onClick={onPlay}
          disabled={disabled}
          className="flex w-full items-center justify-between border border-black bg-black px-6 py-5 text-white transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em]">Přehrát</span>
          <span>▶</span>
        </button>
      )}
      {playbackState === "loading" && (
        <button
          disabled
          className="flex w-full items-center justify-between border border-gray-300 bg-gray-100 px-6 py-5 text-gray-500"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em]">
            {progress ? `Generuji audio ${progress.done}/${progress.total}` : "Generuji audio"}
          </span>
          <span>…</span>
        </button>
      )}
      {playbackState === "playing" && (
        <button
          onClick={onPause}
          className="flex w-full items-center justify-between border border-black bg-white px-6 py-5 text-black"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em]">Pozastavit</span>
          <span>❚❚</span>
        </button>
      )}
      {playbackState === "paused" && (
        <button
          onClick={onResume}
          className="flex w-full items-center justify-between border border-black bg-black px-6 py-5 text-white"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em]">Pokračovat</span>
          <span>▶</span>
        </button>
      )}
      {playbackState !== "idle" && (
        <button
          onClick={onStop}
          className="flex w-full items-center justify-between border border-gray-300 bg-transparent px-6 py-4 text-gray-500"
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Zastavit</span>
          <span>■</span>
        </button>
      )}
      {downloadUrl && playbackState !== "loading" && (
        <a
          href={downloadUrl}
          className="flex w-full items-center justify-between border border-gray-300 bg-white px-6 py-4 text-black"
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Stáhnout WAV</span>
          <span>↓</span>
        </a>
      )}
    </div>
  );
}

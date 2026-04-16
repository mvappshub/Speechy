import type { PlaybackChunk } from "@/lib/chunking";

export function PlaybackView({
  chunks,
  currentChunkIndex,
  textScale,
  onChunkClick,
}: {
  chunks: PlaybackChunk[];
  currentChunkIndex: number;
  textScale: number;
  onChunkClick: (chunk: PlaybackChunk) => void;
}) {
  return (
    <div
      style={{ fontSize: `calc(clamp(2rem, 6vw, 6.25rem) * ${textScale})`, lineHeight: 0.92 }}
      className="absolute inset-0 h-full w-full overflow-y-auto pb-24 font-mono font-light tracking-tighter"
    >
      <div className="min-w-0 w-full max-w-[72ch]">
        {chunks.map((chunk) => {
          const state =
            chunk.index === currentChunkIndex
              ? "active"
              : chunk.index < currentChunkIndex
                ? "past"
                : "future";

          return (
            <button
              type="button"
              key={`${chunk.index}-${chunk.start}`}
              onClick={() => void onChunkClick(chunk)}
              className={`mb-3 block w-full text-left transition-colors duration-200 ${
                state === "active"
                  ? "bg-black px-2 py-1 text-white"
                  : state === "past"
                    ? "text-gray-400"
                    : "text-black"
              }`}
            >
              {chunk.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

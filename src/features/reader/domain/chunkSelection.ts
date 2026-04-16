import type { PlaybackChunk } from "@/lib/chunking";

export function clampChunkIndex(index: number, chunkCount: number) {
  if (chunkCount <= 0) return 0;
  return Math.min(Math.max(index, 0), chunkCount - 1);
}

export function findChunkIndexAtCursor(chunks: PlaybackChunk[], cursor: number) {
  return chunks.findIndex((chunk) => cursor >= chunk.start && cursor <= chunk.end);
}

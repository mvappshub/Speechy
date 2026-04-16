import type { TimelineBlock } from "./types";

export function estimatePlaybackTime(text: string, speed: number) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (!wordCount) return "0 s";

  const minutesFloat = wordCount / (200 * speed);
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
}

export function buildReaderJobKey(input: {
  text: string;
  voice: string;
  speed: number;
}) {
  return JSON.stringify(input);
}

export function findActiveTimelineBlockIndex(timeline: TimelineBlock[], currentTimeSeconds: number) {
  if (!timeline.length) return -1;
  const currentMs = Math.max(0, Math.floor(currentTimeSeconds * 1000));
  const activeIndex = timeline.findIndex(
    (block) => currentMs >= block.start_ms && currentMs < block.end_ms,
  );
  if (activeIndex >= 0) return activeIndex;
  return currentMs >= timeline[timeline.length - 1]!.end_ms ? timeline.length - 1 : 0;
}

export function seekTimeForTimelineBlock(timeline: TimelineBlock[], blockIndex: number) {
  if (!timeline.length) return 0;
  const block = timeline[blockIndex] ?? timeline[timeline.length - 1]!;
  return block.start_ms / 1000;
}

export function getTimelineBlockState(
  blockIndex: number,
  activeBlockIndex: number,
): "past" | "active" | "future" {
  if (blockIndex === activeBlockIndex) return "active";
  return blockIndex < activeBlockIndex ? "past" : "future";
}

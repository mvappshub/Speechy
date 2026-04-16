export type PlaybackState = "idle" | "loading" | "playing" | "paused";
export type ServerStatus = "checking" | "online" | "offline";
export type JobStatus = "queued" | "running" | "done" | "error";

export type Voice = {
  name: string;
  path: string;
  size: number;
  is_default: boolean;
};

export type Health = {
  model: string;
  mode?: string;
  defaults?: {
    language?: string;
    speed?: number;
  };
};

export type TimelineBlock = {
  index: number;
  text: string;
  start_ms: number;
  end_ms: number;
};

export type RenderStatus = {
  id: string;
  status: JobStatus;
  progress: {
    done: number;
    total: number;
  };
  audio_ready: boolean;
  download_ready: boolean;
  timeline: TimelineBlock[];
  error?: string | null;
};

export type ReaderProgress = {
  current: number;
  total: number;
  done: number;
  status: JobStatus;
};

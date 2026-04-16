export type PlaybackState = "idle" | "loading" | "playing" | "paused";
export type ServerStatus = "checking" | "online" | "offline";
export type JobStatus = "queued" | "running" | "done" | "error";
export type RenderBlockJobStatus = "queued" | "running" | "done" | "error";

export type Voice = {
  name: string;
  path: string;
  size: number;
  is_default: boolean;
  has_transcript?: boolean;
};

export type ProjectSummary = {
  id: string;
  title: string;
  preview: string;
  created_at: number;
  updated_at: number;
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

export type RenderBlockStatus = {
  index: number;
  text: string;
  status: RenderBlockJobStatus;
  audio_ready: boolean;
  start_ms: number | null;
  end_ms: number | null;
  error?: string | null;
};

export type ProjectBlockStatus = RenderBlockStatus & {
  voice: string;
  cache_key: string;
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
  blocks: RenderBlockStatus[];
  error?: string | null;
};

export type ProjectStatus = "ready" | "running";

export type ProjectSnapshot = {
  id: string;
  title: string;
  text: string;
  language: string;
  selected_voice: string;
  settings: {
    speed?: number;
  };
  created_at: number;
  updated_at: number;
  download_ready: boolean;
  status: ProjectStatus;
  progress: {
    done: number;
    total: number;
  };
  blocks: ProjectBlockStatus[];
};

export type ReaderProgress = {
  current: number;
  total: number;
  done: number;
  status: JobStatus;
};

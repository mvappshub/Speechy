import type { Health, JobStatus, ProjectSummary, ReaderProgress, ServerStatus, Voice } from "../domain/types";

export type ReaderAction =
  | { type: "settings/loaded"; payload: { text: string; speed: number; volume: number; textScale: number; selectedVoice: string; currentProjectId: string | null } }
  | { type: "text/set"; payload: string }
  | { type: "speed/set"; payload: number }
  | { type: "volume/set"; payload: number }
  | { type: "textScale/set"; payload: number }
  | { type: "voice/set"; payload: string }
  | { type: "blockMode/set"; payload: boolean }
  | { type: "blockVoices/set"; payload: string[] }
  | { type: "blockVoice/set"; payload: { index: number; voice: string } }
  | { type: "project/current"; payload: string | null }
  | { type: "projects/set"; payload: ProjectSummary[] }
  | { type: "voices/set"; payload: Voice[] }
  | { type: "server/status"; payload: { status: ServerStatus; health: Health | null } }
  | { type: "playback/state"; payload: import("../domain/types").PlaybackState }
  | { type: "chunk/select"; payload: number }
  | { type: "progress/set"; payload: ReaderProgress | null }
  | { type: "error/set"; payload: string | null }
  | { type: "uploading/set"; payload: boolean };

type ReaderSettingsPayload = Extract<ReaderAction, { type: "settings/loaded" }>["payload"];

export const readerActions = {
  loadSettings: (payload: ReaderSettingsPayload) =>
    ({ type: "settings/loaded", payload }) as const,
  setText: (payload: string) => ({ type: "text/set", payload }) as const,
  setSpeed: (payload: number) => ({ type: "speed/set", payload }) as const,
  setVolume: (payload: number) => ({ type: "volume/set", payload }) as const,
  setTextScale: (payload: number) => ({ type: "textScale/set", payload }) as const,
  setVoice: (payload: string) => ({ type: "voice/set", payload }) as const,
  setBlockMode: (payload: boolean) => ({ type: "blockMode/set", payload }) as const,
  setBlockVoices: (payload: string[]) => ({ type: "blockVoices/set", payload }) as const,
  setBlockVoice: (index: number, voice: string) => ({ type: "blockVoice/set", payload: { index, voice } }) as const,
  setCurrentProject: (payload: string | null) => ({ type: "project/current", payload }) as const,
  setProjects: (payload: ProjectSummary[]) => ({ type: "projects/set", payload }) as const,
  setVoices: (payload: Voice[]) => ({ type: "voices/set", payload }) as const,
  setServerStatus: (status: ServerStatus, health: Health | null) =>
    ({ type: "server/status", payload: { status, health } }) as const,
  setPlaybackState: (payload: import("../domain/types").PlaybackState) =>
    ({ type: "playback/state", payload }) as const,
  selectChunk: (payload: number) => ({ type: "chunk/select", payload }) as const,
  setProgress: (payload: ReaderProgress | null) => ({ type: "progress/set", payload }) as const,
  setError: (payload: string | null) => ({ type: "error/set", payload }) as const,
  setUploading: (payload: boolean) => ({ type: "uploading/set", payload }) as const,
};

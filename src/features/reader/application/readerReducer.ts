import { clampChunkIndex } from "../domain/chunkSelection";
import type { Health, PlaybackState, ProjectSummary, ReaderProgress, ServerStatus, Voice } from "../domain/types";
import type { ReaderAction } from "./readerActions";

export type ReaderState = {
  text: string;
  playbackState: PlaybackState;
  serverStatus: ServerStatus;
  health: Health | null;
  error: string | null;
  speed: number;
  volume: number;
  textScale: number;
  selectedVoice: string;
  blockVoices: string[];
  currentProjectId: string | null;
  projects: ProjectSummary[];
  voices: Voice[];
  uploading: boolean;
  selectedChunk: number;
  progress: ReaderProgress | null;
};

export const initialReaderState: ReaderState = {
  text: "Ahoj. Napiš cokoliv a já to přečtu pomocí OmniVoice.",
  playbackState: "idle",
  serverStatus: "checking",
  health: null,
  error: null,
  speed: 1,
  volume: 1,
  textScale: 0.35,
  selectedVoice: "speaker.wav",
  blockVoices: [],
  currentProjectId: null,
  projects: [],
  voices: [],
  uploading: false,
  selectedChunk: 0,
  progress: null,
};

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case "settings/loaded":
      return { ...state, ...action.payload };
    case "text/set":
      return { ...state, text: action.payload };
    case "speed/set":
      return { ...state, speed: action.payload };
    case "volume/set":
      return { ...state, volume: action.payload };
    case "textScale/set":
      return { ...state, textScale: action.payload };
    case "voice/set":
      return { ...state, selectedVoice: action.payload };
    case "blockVoices/set":
      return { ...state, blockVoices: action.payload };
    case "blockVoice/set":
      return {
        ...state,
        blockVoices: state.blockVoices.map((voice, index) =>
          index === action.payload.index ? action.payload.voice : voice,
        ),
      };
    case "project/current":
      return { ...state, currentProjectId: action.payload };
    case "projects/set":
      return { ...state, projects: action.payload };
    case "voices/set":
      return { ...state, voices: action.payload };
    case "server/status":
      return { ...state, serverStatus: action.payload.status, health: action.payload.health };
    case "playback/state":
      return { ...state, playbackState: action.payload };
    case "chunk/select":
      return { ...state, selectedChunk: Math.max(action.payload, 0) };
    case "progress/set":
      return { ...state, progress: action.payload };
    case "error/set":
      return { ...state, error: action.payload };
    case "uploading/set":
      return { ...state, uploading: action.payload };
    default:
      return state;
  }
}

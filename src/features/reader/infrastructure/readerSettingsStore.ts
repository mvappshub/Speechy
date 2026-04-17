const KEY = "ttsCzechState";

export function loadReaderSettings() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      text?: string;
      speed?: number;
      volume?: number;
      textScale?: number;
      selectedVoice?: string;
      currentProjectId?: string | null;
    };
  } catch {
    return null;
  }
}

export function saveReaderSettings(settings: {
  text: string;
  speed: number;
  volume: number;
  textScale: number;
  selectedVoice: string;
  currentProjectId: string | null;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}

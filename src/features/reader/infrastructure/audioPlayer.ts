type AudioEvents = {
  onEnded: () => void;
  onError: () => void;
  onTimeUpdate: (currentTime: number) => void;
};

declare global {
  interface Window {
    __readerAudioDebug?: {
      state: "idle" | "loaded" | "playing" | "paused" | "error";
      currentTime: number;
      src: string | null;
    };
  }
}

export function createAudioPlayer() {
  let audio: HTMLAudioElement | null = null;
  let hasActiveSource = false;

  function ensureAudio() {
    if (!audio) {
      audio = new Audio();
    }
    return audio;
  }

  function updateDebugState(state: "idle" | "loaded" | "playing" | "paused" | "error") {
    if (typeof window === "undefined") return;
    window.__readerAudioDebug = {
      state,
      currentTime: audio?.currentTime ?? 0,
      src: audio?.src ?? null,
    };
  }

  function bindEvents(events: AudioEvents) {
    if (!audio) return;
    audio.onended = () => {
      hasActiveSource = false;
      updateDebugState("idle");
      events.onEnded();
    };
    audio.onerror = () => {
      hasActiveSource = false;
      updateDebugState("error");
      events.onError();
    };
    audio.ontimeupdate = () => {
      updateDebugState(audio?.paused ? "paused" : "playing");
      events.onTimeUpdate(audio?.currentTime ?? 0);
    };
  }

  function clearAudio() {
    if (!audio) return;
    hasActiveSource = false;
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audio.ontimeupdate = null;
    audio.src = "";
    updateDebugState("idle");
  }

  return {
    async load(url: string, volume: number, events: AudioEvents) {
      const element = ensureAudio();
      clearAudio();
      element.src = url;
      element.preload = "auto";
      element.volume = volume;
      hasActiveSource = true;
      bindEvents(events);
      updateDebugState("loaded");

      if (element.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return;

      await new Promise<void>((resolve, reject) => {
        if (!audio) {
          resolve();
          return;
        }

        const onReady = () => {
          if (!audio) return;
          audio.removeEventListener("canplaythrough", onReady);
          audio.removeEventListener("error", onFailure);
          resolve();
        };
        const onFailure = () => {
          if (!audio) return;
          audio.removeEventListener("canplaythrough", onReady);
          audio.removeEventListener("error", onFailure);
          reject(new Error("Audio could not be loaded."));
        };

        audio.addEventListener("canplaythrough", onReady, { once: true });
        audio.addEventListener("error", onFailure, { once: true });
      });
    },
    async play() {
      if (audio) {
        await audio.play();
        updateDebugState("playing");
      }
    },
    pause() {
      audio?.pause();
      updateDebugState("paused");
    },
    async resume() {
      if (audio) {
        await audio.play();
        updateDebugState("playing");
      }
    },
    stop() {
      clearAudio();
    },
    seek(timeInSeconds: number) {
      if (audio) audio.currentTime = timeInSeconds;
    },
    setVolume(volume: number) {
      if (audio) audio.volume = volume;
    },
    hasActiveAudio() {
      return hasActiveSource;
    },
  };
}

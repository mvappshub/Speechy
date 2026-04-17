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
  let loadVersion = 0;

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
    audio.removeAttribute("src");
    audio.load();
    updateDebugState("idle");
  }

  return {
    async load(url: string, volume: number, events: AudioEvents) {
      const element = ensureAudio();
      clearAudio();
      const currentLoadVersion = ++loadVersion;
      element.preload = "auto";
      element.volume = volume;
      bindEvents(events);
      updateDebugState("loaded");

      if (element.src === url && element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        hasActiveSource = true;
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          element.removeEventListener("loadeddata", onReady);
          element.removeEventListener("canplay", onReady);
          element.removeEventListener("error", onFailure);
        };

        const onReady = () => {
          if (currentLoadVersion !== loadVersion) {
            cleanup();
            resolve();
            return;
          }
          cleanup();
          hasActiveSource = true;
          resolve();
        };

        const onFailure = () => {
          if (currentLoadVersion !== loadVersion) {
            cleanup();
            resolve();
            return;
          }
          cleanup();
          reject(new Error("Audio could not be loaded."));
        };

        element.addEventListener("loadeddata", onReady, { once: true });
        element.addEventListener("canplay", onReady, { once: true });
        element.addEventListener("error", onFailure, { once: true });

        element.src = url;
        element.load();
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

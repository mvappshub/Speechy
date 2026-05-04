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

  function updateDebugState(state: "idle" | "loaded" | "playing" | "paused" | "error") {
    if (typeof window === "undefined") return;
    window.__readerAudioDebug = {
      state,
      currentTime: audio?.currentTime ?? 0,
      src: audio?.src ?? null,
    };
  }

  function releaseAudioElement(element: HTMLAudioElement | null) {
    if (!element) return;
    element.pause();
    element.onended = null;
    element.onerror = null;
    element.ontimeupdate = null;
    element.removeAttribute("src");
    element.load();
  }

  function bindEvents(element: HTMLAudioElement, events: AudioEvents, version: number) {
    element.onended = () => {
      if (version !== loadVersion || audio !== element) return;
      hasActiveSource = false;
      updateDebugState("idle");
      events.onEnded();
    };
    element.onerror = () => {
      if (version !== loadVersion || audio !== element) return;
      hasActiveSource = false;
      updateDebugState("error");
      events.onError();
    };
    element.ontimeupdate = () => {
      if (version !== loadVersion || audio !== element) return;
      updateDebugState(element.paused ? "paused" : "playing");
      events.onTimeUpdate(element.currentTime ?? 0);
    };
  }

  function getAudioElement() {
    if (!audio) {
      audio = new Audio();
    }
    return audio;
  }

  function clearAudio() {
    loadVersion += 1;
    hasActiveSource = false;
    releaseAudioElement(audio);
    updateDebugState("idle");
  }

  return {
    async load(url: string, volume: number, events: AudioEvents) {
      clearAudio();
      const version = loadVersion;
      const element = getAudioElement();
      element.preload = "auto";
      element.volume = volume;
      bindEvents(element, events, version);
      updateDebugState("idle");

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          element.removeEventListener("loadeddata", onReady);
          element.removeEventListener("canplay", onReady);
          element.removeEventListener("error", onFailure);
        };

        const onReady = () => {
          cleanup();
          if (loadVersion !== version || audio !== element) return;
          hasActiveSource = true;
          updateDebugState("loaded");
          resolve();
        };

        const onFailure = () => {
          cleanup();
          if (loadVersion !== version || audio !== element) return;
          hasActiveSource = false;
          updateDebugState("error");
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
      const currentAudio = audio;
      const version = loadVersion;
      if (currentAudio) {
        await currentAudio.play();
        if (audio === currentAudio && version === loadVersion) {
          updateDebugState("playing");
        }
      }
    },
    pause() {
      audio?.pause();
      updateDebugState("paused");
    },
    async resume() {
      const currentAudio = audio;
      const version = loadVersion;
      if (currentAudio) {
        await currentAudio.play();
        if (audio === currentAudio && version === loadVersion) {
          updateDebugState("playing");
        }
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

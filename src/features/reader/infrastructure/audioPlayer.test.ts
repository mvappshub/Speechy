import test from "node:test";
import assert from "node:assert/strict";

import { createAudioPlayer } from "./audioPlayer";

class FakeAudio {
  static instances: FakeAudio[] = [];

  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  paused = true;
  preload = "";
  volume = 1;
  currentTime = 0;
  src: string;
  readyState = 4;
  private listeners = new Map<string, Set<() => void>>();

  constructor(src = "") {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  removeAttribute(name: string) {
    if (name === "src") {
      this.src = "";
    }
  }

  load() {
    if (!this.src) return undefined;
    queueMicrotask(() => {
      this.listeners.get("loadeddata")?.forEach((listener) => listener());
      this.listeners.get("canplay")?.forEach((listener) => listener());
    });
    return undefined;
  }

  async play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }

  emitEnded() {
    this.onended?.();
  }
}

test("audio player clears active audio after playback ends", async () => {
  const OriginalAudio = globalThis.Audio;
  const OriginalHtmlMediaElement = globalThis.HTMLMediaElement;

  Object.assign(globalThis, {
    Audio: FakeAudio,
    HTMLMediaElement: { HAVE_ENOUGH_DATA: 4 },
  });

  try {
    const player = createAudioPlayer();
    let endedCalls = 0;

    await player.load("blob:test", 0.8, {
      onEnded: () => {
        endedCalls += 1;
      },
      onError: () => {},
      onTimeUpdate: () => {},
    });

    assert.equal(player.hasActiveAudio(), true);

    FakeAudio.instances[0]?.emitEnded();

    assert.equal(endedCalls, 1);
    assert.equal(player.hasActiveAudio(), false);
  } finally {
    Object.assign(globalThis, {
      Audio: OriginalAudio,
      HTMLMediaElement: OriginalHtmlMediaElement,
    });
    FakeAudio.instances = [];
  }
});

test("audio player reuses the audio element across loads", async () => {
  const OriginalAudio = globalThis.Audio;
  const OriginalHtmlMediaElement = globalThis.HTMLMediaElement;

  Object.assign(globalThis, {
    Audio: FakeAudio,
    HTMLMediaElement: { HAVE_ENOUGH_DATA: 4 },
  });

  try {
    const player = createAudioPlayer();

    await player.load("blob:first", 1, {
      onEnded: () => {},
      onError: () => {},
      onTimeUpdate: () => {},
    });

    const firstInstance = FakeAudio.instances[0];
    await player.load("blob:second", 1, {
      onEnded: () => {},
      onError: () => {},
      onTimeUpdate: () => {},
    });

    assert.equal(FakeAudio.instances.length, 1);
    assert.equal(FakeAudio.instances[0], firstInstance);
    assert.equal(FakeAudio.instances[0]?.src, "blob:second");
  } finally {
    Object.assign(globalThis, {
      Audio: OriginalAudio,
      HTMLMediaElement: OriginalHtmlMediaElement,
    });
    FakeAudio.instances = [];
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchRenderBlockAudioBlob,
  fetchRenderAudioBlob,
  fetchRenderStatus,
  getRenderDownloadUrl,
  getTtsApiBaseUrl,
  startRender,
} from "./ttsApi";

test("getTtsApiBaseUrl prefers NEXT_PUBLIC_TTS_API_BASE_URL without trailing slash", () => {
  const previous = process.env.NEXT_PUBLIC_TTS_API_BASE_URL;
  process.env.NEXT_PUBLIC_TTS_API_BASE_URL = "https://tts.example.com/";

  assert.equal(getTtsApiBaseUrl(), "https://tts.example.com");

  process.env.NEXT_PUBLIC_TTS_API_BASE_URL = previous;
});

test("getTtsApiBaseUrl falls back to localhost when env is not set", () => {
  const previous = process.env.NEXT_PUBLIC_TTS_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_TTS_API_BASE_URL;

  assert.equal(getTtsApiBaseUrl(), "http://localhost:8000");

  process.env.NEXT_PUBLIC_TTS_API_BASE_URL = previous;
});

test("startRender posts the render payload", async () => {
  const originalFetch = global.fetch;
  let request: { url: string; body?: string } | null = null;

  global.fetch = async (input, init) => {
    request = { url: String(input), body: String(init?.body ?? "") };
    return new Response(JSON.stringify({ id: "job-1", status: "queued" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await startRender({ text: "Ahoj", voice: "speaker.wav" });

  assert.deepEqual(result, { id: "job-1", status: "queued" });
  assert.equal(request?.url, "http://localhost:8000/api/render");
  assert.match(request?.body ?? "", /"language":"cs"/);

  global.fetch = originalFetch;
});

test("fetchRenderStatus returns render progress", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "job-1",
        status: "done",
        progress: { done: 2, total: 2 },
        audio_ready: true,
        download_ready: true,
        timeline: [],
        blocks: [],
        error: null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  const result = await fetchRenderStatus("job-1");

  assert.equal(result.status, "done");
  assert.deepEqual(result.progress, { done: 2, total: 2 });

  global.fetch = originalFetch;
});

test("fetchRenderAudioBlob loads the final wav", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => new Response(new Blob(["audio"], { type: "audio/wav" }), { status: 200 });

  const blob = await fetchRenderAudioBlob("job-1");

  assert.equal(blob.type, "audio/wav");

  global.fetch = originalFetch;
});

test("fetchRenderBlockAudioBlob loads a block wav", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => new Response(new Blob(["audio"], { type: "audio/wav" }), { status: 200 });

  const blob = await fetchRenderBlockAudioBlob("job-1", 3);

  assert.equal(blob.type, "audio/wav");

  global.fetch = originalFetch;
});

test("getRenderDownloadUrl points to the render download route", () => {
  assert.equal(getRenderDownloadUrl("job-1"), "http://localhost:8000/api/render/job-1/download");
});

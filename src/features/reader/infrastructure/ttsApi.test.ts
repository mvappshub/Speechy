import test from "node:test";
import assert from "node:assert/strict";

import {
  clearProjectBlockAudioCache,
  fetchProject,
  fetchProjectBlockAudioBlob,
  fetchProjects,
  getProjectDownloadUrl,
  fetchRenderBlockAudioBlob,
  fetchRenderAudioBlob,
  fetchRenderStatus,
  startProjectRender,
  getRenderDownloadUrl,
  getTtsApiBaseUrl,
  fetchVoices,
  preloadProjectBlockAudio,
  syncProject,
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

test("fetchProjects loads recent saved projects", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () =>
    new Response(JSON.stringify([{ id: "project-1", title: "Ahoj", preview: "Ahoj", created_at: 1, updated_at: 2 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const projects = await fetchProjects();

  assert.equal(projects[0]?.id, "project-1");

  global.fetch = originalFetch;
});

test("fetchVoices loads available backend voices", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        default_voice: "speaker.wav",
        voices: [
          {
            name: "speaker.wav",
            path: "C:/voices/speaker.wav",
            size: 123,
            is_default: true,
            has_transcript: true,
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  const payload = await fetchVoices();

  assert.equal(payload.default_voice, "speaker.wav");
  assert.equal(payload.voices[0]?.name, "speaker.wav");

  global.fetch = originalFetch;
});

test("fetchVoices reports backend connection failures", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => {
    throw new Error("Failed to fetch");
  };

  await assert.rejects(fetchVoices(), /Nepodařilo se spojit s TTS backendem/);

  global.fetch = originalFetch;
});

test("syncProject posts the current project state", async () => {
  const originalFetch = global.fetch;
  let request: { url: string; body?: string } | null = null;

  global.fetch = async (input, init) => {
    request = { url: String(input), body: String(init?.body ?? "") };
    return new Response(
      JSON.stringify({
        id: "project-1",
        title: "Ahoj",
        text: "Ahoj",
        language: "cs",
        selected_voice: "speaker.wav",
        settings: { speed: 1 },
        created_at: 1,
        updated_at: 2,
        download_ready: false,
        status: "ready",
        progress: { done: 0, total: 1 },
        blocks: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const project = await syncProject({ projectId: "project-1", text: "Ahoj", voice: "speaker.wav", speed: 1 });

  assert.equal(project.id, "project-1");
  assert.equal(request?.url, "http://localhost:8000/api/projects/sync");
  assert.match(request?.body ?? "", /"project_id":"project-1"/);

  global.fetch = originalFetch;
});

test("fetchProject returns the persisted project payload", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "project-1",
        title: "Ahoj",
        text: "Ahoj",
        language: "cs",
        selected_voice: "speaker.wav",
        settings: { speed: 1 },
        created_at: 1,
        updated_at: 2,
        download_ready: true,
        status: "ready",
        progress: { done: 1, total: 1 },
        blocks: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const project = await fetchProject("project-1");

  assert.equal(project.download_ready, true);

  global.fetch = originalFetch;
});

test("startProjectRender triggers project rendering only when needed", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        status: "queued",
        job_id: "job-1",
        project: {
          id: "project-1",
          title: "Ahoj",
          text: "Ahoj",
          language: "cs",
          selected_voice: "speaker.wav",
          settings: { speed: 1 },
          created_at: 1,
          updated_at: 2,
          download_ready: false,
          status: "running",
          progress: { done: 0, total: 1 },
          blocks: [],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const response = await startProjectRender("project-1");

  assert.equal(response.job_id, "job-1");
  assert.equal(response.project.status, "running");

  global.fetch = originalFetch;
});

test("fetchProjectBlockAudioBlob reuses cached project audio", async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;
  clearProjectBlockAudioCache(null);

  global.fetch = async () => {
    fetchCount += 1;
    return new Response(new Blob(["audio"], { type: "audio/wav" }), { status: 200 });
  };

  const blob = await fetchProjectBlockAudioBlob("project-cache-test", 0, "block-cache-a");
  const cachedBlob = await fetchProjectBlockAudioBlob("project-cache-test", 0, "block-cache-a");

  assert.equal(blob.type, "audio/wav");
  assert.equal(cachedBlob, blob);
  assert.equal(fetchCount, 1);

  global.fetch = originalFetch;
  clearProjectBlockAudioCache(null);
});

test("fetchProjectBlockAudioBlob refreshes audio when the block cache key changes", async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;
  clearProjectBlockAudioCache(null);

  global.fetch = async () => {
    fetchCount += 1;
    return new Response(new Blob([`audio-${fetchCount}`], { type: "audio/wav" }), { status: 200 });
  };

  const firstBlob = await fetchProjectBlockAudioBlob("project-cache-version-test", 0, "block-cache-a");
  const updatedBlob = await fetchProjectBlockAudioBlob("project-cache-version-test", 0, "block-cache-b");

  assert.notEqual(updatedBlob, firstBlob);
  assert.equal(fetchCount, 2);

  global.fetch = originalFetch;
  clearProjectBlockAudioCache(null);
});

test("preloadProjectBlockAudio fetches ready blocks and reuses them for playback", async () => {
  const originalFetch = global.fetch;
  const requestedUrls: string[] = [];
  clearProjectBlockAudioCache(null);

  global.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(new Blob(["audio"], { type: "audio/wav" }), { status: 200 });
  };

  preloadProjectBlockAudio({
    id: "project-preload-test",
    title: "Ahoj",
    text: "Ahoj",
    language: "cs",
    pinned: false,
    selected_voice: "speaker.wav",
    settings: { speed: 1 },
    created_at: 1,
    updated_at: 2,
    download_ready: false,
    status: "ready",
    progress: { done: 2, total: 3 },
    blocks: [
      {
        index: 0,
        text: "A",
        status: "done",
        audio_ready: true,
        start_ms: 0,
        end_ms: 100,
        voice: "speaker.wav",
        cache_key: "cache-a",
      },
      {
        index: 1,
        text: "B",
        status: "queued",
        audio_ready: false,
        start_ms: null,
        end_ms: null,
        voice: "speaker.wav",
        cache_key: "cache-b",
      },
      {
        index: 2,
        text: "C",
        status: "done",
        audio_ready: true,
        start_ms: 100,
        end_ms: 200,
        voice: "speaker.wav",
        cache_key: "cache-c",
      },
    ],
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await fetchProjectBlockAudioBlob("project-preload-test", 0, "cache-a");

  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0] ?? "", /blocks\/0\/audio/);
  assert.match(requestedUrls[1] ?? "", /blocks\/2\/audio/);

  global.fetch = originalFetch;
  clearProjectBlockAudioCache(null);
});

test("project audio cache is scoped to the active project", async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;
  clearProjectBlockAudioCache(null);

  global.fetch = async () => {
    fetchCount += 1;
    return new Response(new Blob([`audio-${fetchCount}`], { type: "audio/wav" }), { status: 200 });
  };

  await fetchProjectBlockAudioBlob("project-a", 0, "cache-a");
  await fetchProjectBlockAudioBlob("project-b", 0, "cache-a");
  await fetchProjectBlockAudioBlob("project-a", 0, "cache-a");

  assert.equal(fetchCount, 3);

  global.fetch = originalFetch;
  clearProjectBlockAudioCache(null);
});

test("getRenderDownloadUrl points to the render download route", () => {
  assert.equal(getRenderDownloadUrl("job-1"), "http://localhost:8000/api/render/job-1/download");
});

test("getProjectDownloadUrl points to the persisted project download route", () => {
  assert.equal(getProjectDownloadUrl("project-1"), "http://localhost:8000/api/projects/project-1/download");
});

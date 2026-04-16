import type { Health, ProjectSnapshot, ProjectSummary, RenderStatus, Voice } from "../domain/types";

const DEFAULT_TTS_API_BASE_URL = "http://localhost:8000";

export function getTtsApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_TTS_API_BASE_URL?.trim();
  if (!configuredBaseUrl) return DEFAULT_TTS_API_BASE_URL;
  return configuredBaseUrl.replace(/\/+$/, "");
}

const API = getTtsApiBaseUrl();

export async function fetchHealth() {
  const response = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error("Server unavailable");
  return (await response.json()) as Health;
}

export async function fetchVoices() {
  const response = await fetch(`${API}/api/voices`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load voices");
  const payload = await response.json();
  return payload as { default_voice: string; voices: Voice[] };
}

export async function fetchProjects() {
  const response = await fetch(`${API}/api/projects`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load projects");
  return (await response.json()) as ProjectSummary[];
}

export async function fetchProject(projectId: string) {
  const response = await fetch(`${API}/api/projects/${projectId}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load project.");
  return (await response.json()) as ProjectSnapshot;
}

export async function syncProject(input: {
  projectId?: string | null;
  text: string;
  voice: string;
  blockVoices?: string[];
  language?: string;
  speed?: number;
}) {
  const response = await fetch(`${API}/api/projects/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: input.projectId ?? null,
      text: input.text,
      voice: input.voice,
      block_voices: input.blockVoices ?? [],
      language: input.language ?? "cs",
      speed: input.speed ?? 1,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Project sync failed." }));
    throw new Error(err.detail || "Project sync failed.");
  }
  return (await response.json()) as ProjectSnapshot;
}

export async function startProjectRender(projectId: string) {
  const response = await fetch(`${API}/api/projects/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Project render failed." }));
    throw new Error(err.detail || "Project render failed.");
  }
  return (await response.json()) as {
    status: "queued" | "ready";
    job_id: string | null;
    project: ProjectSnapshot;
  };
}

export async function uploadVoice(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API}/api/voices`, { method: "POST", body: form });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Voice upload failed." }));
    throw new Error(err.detail || "Voice upload failed.");
  }
  return await response.json();
}

export async function startRender(input: {
  text: string;
  voice: string;
  language?: string;
  speed?: number;
}) {
  const response = await fetch(`${API}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      voice: input.voice,
      language: input.language ?? "cs",
      speed: input.speed ?? 1,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Render failed." }));
    throw new Error(err.detail || "Render failed.");
  }

  return (await response.json()) as { id: string; status: string };
}

export async function fetchRenderStatus(jobId: string) {
  const response = await fetch(`${API}/api/render/${jobId}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to fetch render status.");
  return (await response.json()) as RenderStatus;
}

export async function fetchRenderBlockAudioBlob(jobId: string, blockIndex: number) {
  const response = await fetch(`${API}/api/render/${jobId}/blocks/${blockIndex}/audio`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to fetch block audio.");
  return await response.blob();
}

export async function fetchProjectBlockAudioBlob(projectId: string, blockIndex: number) {
  const response = await fetch(`${API}/api/projects/${projectId}/blocks/${blockIndex}/audio`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to fetch project block audio.");
  return await response.blob();
}

export async function fetchRenderAudioBlob(jobId: string) {
  const response = await fetch(`${API}/api/render/${jobId}/audio`);
  if (!response.ok) throw new Error("Unable to fetch final audio.");
  return await response.blob();
}

export function getRenderDownloadUrl(jobId: string) {
  return `${API}/api/render/${jobId}/download`;
}

export function getProjectDownloadUrl(projectId: string) {
  return `${API}/api/projects/${projectId}/download`;
}

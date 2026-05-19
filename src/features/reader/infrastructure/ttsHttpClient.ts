const DEFAULT_TTS_API_BASE_URL = "http://localhost:8000";

declare global {
  interface Window {
    speechyDesktop?: {
      ttsApiBaseUrl?: string | null;
      isDesktop?: boolean;
    };
  }
}

type RequestOptions = RequestInit & {
  errorDetail?: boolean;
};

function getDesktopTtsApiBaseUrl() {
  if (typeof window === "undefined") return null;
  const configuredBaseUrl = window.speechyDesktop?.ttsApiBaseUrl?.trim();
  if (!configuredBaseUrl || configuredBaseUrl === "undefined" || configuredBaseUrl === "null") {
    return null;
  }
  return configuredBaseUrl.replace(/\/+$/, "");
}

export function getTtsApiBaseUrl() {
  const desktopBaseUrl = getDesktopTtsApiBaseUrl();
  if (desktopBaseUrl) return desktopBaseUrl;
  const configuredBaseUrl = process.env.NEXT_PUBLIC_TTS_API_BASE_URL?.trim();
  if (!configuredBaseUrl || configuredBaseUrl === "undefined" || configuredBaseUrl === "null") {
    return DEFAULT_TTS_API_BASE_URL;
  }
  return configuredBaseUrl.replace(/\/+$/, "");
}

export function getTtsApiUrl(path: string) {
  return `${getTtsApiBaseUrl()}${path}`;
}

function toApiError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    if (error.message === "Failed to fetch") {
      return new Error("Nepodařilo se spojit s TTS backendem.");
    }
    return error;
  }
  return new Error(fallback);
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail) return detail;
  }
  return fallback;
}

export async function requestJson<T>(path: string, fallback: string, options: RequestOptions = {}) {
  const { errorDetail, ...init } = options;
  try {
    const response = await fetch(getTtsApiUrl(path), init);
    if (!response.ok) {
      throw new Error(errorDetail ? await readErrorMessage(response, fallback) : fallback);
    }
    return (await response.json()) as T;
  } catch (error) {
    throw toApiError(error, fallback);
  }
}

export async function requestBlob(path: string, fallback: string, options: RequestOptions = {}) {
  const { errorDetail, ...init } = options;
  try {
    const response = await fetch(getTtsApiUrl(path), init);
    if (!response.ok) {
      throw new Error(errorDetail ? await readErrorMessage(response, fallback) : fallback);
    }
    return await response.blob();
  } catch (error) {
    throw toApiError(error, fallback);
  }
}

export async function requestVoid(path: string, fallback: string, options: RequestOptions = {}) {
  const { errorDetail, ...init } = options;
  try {
    const response = await fetch(getTtsApiUrl(path), init);
    if (!response.ok) {
      throw new Error(errorDetail ? await readErrorMessage(response, fallback) : fallback);
    }
  } catch (error) {
    throw toApiError(error, fallback);
  }
}

"use client";
import useSWR, { type SWRConfiguration } from "swr";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body:
        opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError("You appear to be offline. Check your connection and try again.", 0, "network");
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiClientError(
      (data.error as string) || "Something went wrong. Please try again.",
      res.status,
      (data.code as string) || "error",
      data,
    );
  }
  return data as T;
}

/** Upload with progress events (fetch has no upload progress). */
export function uploadWithProgress<T>(url: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else
        reject(
          new ApiClientError(
            (data.error as string) || "Upload failed. Please try again.",
            xhr.status,
            (data.code as string) || "error",
            data,
          ),
        );
    };
    xhr.onerror = () => reject(new ApiClientError("Upload failed — check your connection.", 0, "network"));
    xhr.send(form);
  });
}

export function useApi<T>(url: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(url, (u: string) => apiFetch<T>(u), { revalidateOnFocus: false, ...config });
}

export function errorMessage(e: unknown) {
  if (e instanceof ApiClientError) return e.message;
  return "Something went wrong. Please try again.";
}

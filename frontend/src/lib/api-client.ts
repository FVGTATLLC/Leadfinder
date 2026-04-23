import { getSession } from "next-auth/react";

/**
 * Determine the base URL for API calls.
 *
 * - Browser (client-side): Use relative path "/api/v1" so that requests are
 *   proxied through Vercel rewrites (or Next.js rewrites in local dev).
 *   This avoids CORS issues entirely.
 * - Server-side (SSR / API routes): Use the full backend URL from the
 *   NEXT_PUBLIC_API_URL environment variable, since server-to-server calls
 *   don't have CORS restrictions and need the absolute URL.
 */
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side: use relative path, proxied via Vercel/Next.js rewrites
    return "/api/v1";
  }
  // Server-side: use the full backend URL
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
}

const BASE_URL = getBaseUrl();

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
}

class ApiClientError extends Error {
  statusCode: number;
  detail: string;

  constructor(statusCode: number, detail: string) {
    super(detail);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const accessToken = (session as unknown as Record<string, unknown>)?.accessToken as
    | string
    | undefined;

  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, skipAuth = false, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (!skipAuth) {
    const authHeaders = await getAuthHeaders();
    Object.assign(headers, authHeaders);
  }

  const config: RequestInit = {
    ...rest,
    headers,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    let detail = "An unexpected error occurred";
    try {
      const errorData = await response.json();
      detail = errorData.detail || errorData.message || detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new ApiClientError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function apiGet<T>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return request<T>(endpoint, { ...options, method: "GET" });
}

export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return request<T>(endpoint, { ...options, method: "POST", body });
}

export async function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return request<T>(endpoint, { ...options, method: "PATCH", body });
}

export async function apiDelete<T>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return request<T>(endpoint, { ...options, method: "DELETE" });
}

export { ApiClientError };

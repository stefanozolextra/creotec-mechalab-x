import { getAuthToken } from "../utils/auth";

const DEFAULT_API_BASE_URL = "http://localhost:4000";

// NOTE: The backend API must run from server/index.js.
// server/package.json currently points "start" to server.js (empty file).
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

export const API_BASE_URL = (rawApiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

export class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data: unknown = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
    body?: unknown;
};

const getErrorMessage = (fallback: string, data: unknown): string => {
    if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
        return data.error;
    }
    return fallback;
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();
    return text || null;
};

const buildUrl = (path: string): string => {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};

export const requestJson = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const { body, headers: incomingHeaders, ...rest } = options;
    const headers = new Headers(incomingHeaders);

    if (body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const authToken = getAuthToken();
    if (authToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${authToken}`);
    }

    let response: Response;
    try {
        response = await fetch(buildUrl(path), {
            ...rest,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Network request failed.";
        throw new ApiError(message, 0);
    }

    const data = await parseResponseBody(response);

    if (!response.ok) {
        const fallback = `Request failed with status ${response.status}`;
        throw new ApiError(getErrorMessage(fallback, data), response.status, data);
    }

    return data as T;
};

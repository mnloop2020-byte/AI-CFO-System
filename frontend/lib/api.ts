import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is required.");
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers);
  await addAuthentication(headers);

  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  let requestBody: BodyInit | undefined;

  if (options.body !== undefined) {
    if (isFormData) {
      requestBody = options.body as FormData;
    } else if (typeof options.body === "string") {
      requestBody = options.body;
    } else {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(options.body);
    }
  }

  const response = await fetch(`${API_URL}${normalizedPath}`, {
    ...options,
    headers,
    body: requestBody,
    cache: options.cache ?? "no-store",
  });

  const responseText = await response.text();

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;

    if (responseText) {
      try {
        const errorBody = JSON.parse(responseText) as {
          detail?: unknown;
        };

        if (typeof errorBody.detail === "string") {
          message = errorBody.detail;
        } else if (errorBody.detail) {
          message = JSON.stringify(errorBody.detail);
        }
      } catch {
        message = responseText;
      }
    }

    redirectToMfaIfRequired(response.status, message);
    throw new ApiError(message, response.status);
  }

  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function redirectToMfaIfRequired(status: number, message: string) {
  if (
    status === 403 &&
    message === "Multi-factor authentication is required." &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/login/mfa"
  ) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login/mfa?next=${encodeURIComponent(next)}`);
  }
}

async function addAuthentication(headers: Headers) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError("Authentication is required.", 401);
  }

  headers.set("Authorization", `Bearer ${session.access_token}`);
}

async function apiBlobRequest(
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers);
  await addAuthentication(headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${normalizedPath}`, {
    ...options,
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();
    let message = `API request failed with status ${response.status}`;

    if (responseText) {
      try {
        const errorBody = JSON.parse(responseText) as {
          detail?: unknown;
        };

        if (typeof errorBody.detail === "string") {
          message = errorBody.detail;
        } else if (errorBody.detail) {
          message = JSON.stringify(errorBody.detail);
        }
      } catch {
        message = responseText;
      }
    }

    redirectToMfaIfRequired(response.status, message);
    throw new ApiError(message, response.status);
  }

  return response.blob();
}

export const api = {
  get<T>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: "GET",
    });
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ) {
    return apiRequest<T>(path, {
      ...options,
      method: "POST",
      body,
    });
  },

  postBlob(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ) {
    return apiBlobRequest(path, body, options);
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ) {
    return apiRequest<T>(path, {
      ...options,
      method: "PATCH",
      body,
    });
  },

  delete<T>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: "DELETE",
    });
  },
};

/**
 * Standardized API client wrapper for fetching data securely from the backend.
 * Provides timeout control, JSON parsing, error normalization, and base URL resolution.
 */

interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Auto-prepend /api if the user forgot it, ensuring all routes map correctly to our backend
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = path.startsWith('/api') ? path : `/api${path}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() };
      }

      if (response.status === 404) throw new ApiError(404, `Endpoint not found: ${url}`, errorData);
      if (response.status === 401) throw new ApiError(401, `Unauthorized access to ${url}`, errorData);
      if (response.status === 500) throw new ApiError(500, `Server Error at ${url}`, errorData);

      throw new ApiError(response.status, `HTTP Error ${response.status}`, errorData);
    }

    // Handles empty responses gracefully (e.g., 204 No Content)
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ({} as T);

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Normalize AbortError into our ApiError for UI state
    if (error.name === 'AbortError') {
      throw new ApiError(408, `Request timed out after ${timeoutMs / 1000} seconds: ${endpoint}`);
    }
    
    throw error;
  }
}

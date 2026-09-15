export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = "ApiError"; }
}

export async function decodeResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      const details = body.errors ?? body.detail;
      if (typeof details === "string") message = details;
      else if (Array.isArray(details)) message = details.map(d => {
        const field = d.field ?? d.loc?.filter((v: string) => v !== "body").join(".");
        return `${field ? `${field}: ` : ""}${d.message ?? d.msg ?? "Invalid value"}`;
      }).join("; ");
    } catch { /* HTML and empty errors retain their HTTP status. */ }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

/** One transport; never automatically retry a potentially side-effecting request. */
export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return decodeResponse<T>(await fetch(url, { ...options, headers }));
}

import { QueryClient } from "@tanstack/react-query";

let browserQueryClient: QueryClient | undefined = undefined;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retries disabled — 401 is handled by the API interceptor in lib/api.ts
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client per request
    return makeQueryClient();
  }
  // Browser: reuse singleton to prevent recreation on React suspense
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

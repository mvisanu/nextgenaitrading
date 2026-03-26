/**
 * Next.js middleware entry point.
 *
 * Next.js requires this file to be named `middleware.ts` and to export a
 * function named `middleware` (or a default export). The actual logic lives in
 * `proxy.ts`; this file re-exports it under the required name so the file can
 * be independently unit-tested as `proxy.ts` while Next.js picks up this file
 * for route protection.
 */
export { proxy as middleware, config } from "./proxy";

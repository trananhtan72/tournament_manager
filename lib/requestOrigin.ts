import { headers } from "next/headers";

/** The current request's origin (e.g. "https://example.com"), for building an absolute link from a Server Action, which has no `window.location` of its own. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

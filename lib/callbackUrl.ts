/**
 * Only allow same-site relative paths as a post-auth redirect target, so a
 * crafted callbackUrl query param can't be used to redirect off-site.
 */
export function safeCallbackUrl(
  value: string | string[] | undefined,
  fallback: string,
): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

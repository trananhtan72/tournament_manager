import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js's dev server blocks cross-origin requests to dev assets/endpoints
  // (HMR, Server Actions, RSC payloads) by default, trusting only localhost.
  // Testing from a phone/tablet over the LAN hits the dev server by its
  // network IP instead, which needs to be explicitly allowlisted here or the
  // page loads but never hydrates (no error shown — everything just looks
  // unresponsive).
  allowedDevOrigins: ["192.168.0.105"],
};

export default nextConfig;

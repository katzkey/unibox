import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external dev origins (ngrok, localtunnel, etc.) so HMR and Server Actions
  // work when accessing the dev server through a tunnel. Without this, HMR
  // WebSocket connections fail and client hydration can break.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.loca.lt",
  ],
};

export default nextConfig;

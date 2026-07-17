/**
 * Next.js configuration for BALTHASAR (T3 Stack).
 *
 * - reactStrictMode: catch side-effect bugs in dev
 * - standalone: produce self-contained output for Docker (server.js + deps)
 * - experimental.taint: enable React's experimental taint API for leak prevention
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    taint: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

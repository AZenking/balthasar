/**
 * Next.js configuration for BALTHASAR (T3 Stack).
 * - reactStrictMode: catch side-effect bugs in dev
 * - experimental.taint: enable React's experimental taint API for leaking prevention
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    taint: true,
  },
};

export default nextConfig;

/**
 * Next.js configuration for BALTHASAR (T3 Stack).
 *
 * - reactStrictMode: catch side-effect bugs in dev
 * - standalone: produce self-contained output for Docker (server.js + deps)
 * - experimental.taint: enable React's experimental taint API for leak prevention
 * - bundle-analyzer: triggered via ANALYZE=true env (spec 025-perf-code-optimization)
 */
/* global process */
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    taint: true,
  },
};

export default withBundleAnalyzer(nextConfig);

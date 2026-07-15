import { ImageResponse } from "next/og";
import { renderIcon } from "@/app/icon";

/**
 * Multi-size PWA icon endpoint.
 *
 * Why a dedicated route (not the `icon.tsx` convention)? Next's icon file
 * convention pins the output to its static `size` export (32×32) and
 * ignores runtime dimensions — fine for a favicon, but the PWA manifest
 * needs 192/512/maskable. A plain dynamic route handler gives full control
 * over `ImageResponse` width/height.
 *
 * Route shape:
 *   GET /pwa-icons/192          → 192×192, purpose: any
 *   GET /pwa-icons/512          → 512×512, purpose: any
 *   GET /pwa-icons/512?maskable=1 → 512×512, glyph shrunk to safe zone
 *
 * Referenced by `public/manifest.webmanifest`.
 */
export const runtime = "edge";

const ALLOWED_SIZES = new Set([192, 512]);

export function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  // `request.url` may be relative in the edge runtime; pass a base that is
  // ignored when the input is already absolute.
  const isMaskable = new URL(request.url, "http://localhost").searchParams.get(
    "maskable",
  ) === "1";

  return params.then((resolved) => {
    const requested = Number.parseInt(resolved.size, 10);
    // Only ever serve the two sizes the manifest declares. Anything else
    // (including NaN / negatives) falls back to 512 rather than 4xx, so a
    // stray manifest edit can't break installation.
    const size = ALLOWED_SIZES.has(requested) ? requested : 512;

    return renderIcon({
      size,
      // Maskable safe zone = central ~80% circle; 0.62 scale keeps the
      // glyph comfortably inside on circular/squircle OS masks.
      glyphScale: isMaskable ? 0.62 : 0.6,
    });
  });
}

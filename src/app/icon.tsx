import { ImageResponse } from "next/og";

/**
 * Favicon / `<link rel="icon">` generator (Next.js file convention).
 *
 * Renders the BALTHASAR mark from code via `next/og` (Satori) so the repo
 * carries zero binary icon assets: amber `#C79032` square + white lucide
 * `Wallet` stroke icon. This route is fixed at 32×32 by the Next icon
 * convention (the `size` export) and drives the browser-tab favicon.
 *
 * For the multi-size icons the PWA manifest needs (192 / 512 / maskable),
 * see `src/app/pwa-icons/[size]/route.ts`, which is a plain route handler
 * with full control over output dimensions.
 *
 * `apple-icon.tsx` is the separate 180×180 Apple-touch variant.
 */
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Shared icon JSX factory. Kept here so `icon.tsx`, `apple-icon.tsx`, and
 * `pwa-icons/[size]/route.ts` render an identical mark.
 *
 * `glyphScale` is the fraction of the canvas the Wallet glyph occupies;
 * maskable variants use a smaller scale to stay inside the safe zone.
 *
 * Lucide `Wallet` paths inlined (verbatim, lucide-react v1.23.0, ISC)
 * rather than importing the React component — Satori renders raw SVG and
 * we avoid pulling client deps into the edge route.
 */
export const WALLET_PATHS = [
  "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
  "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
];

export function renderIcon({
  size,
  glyphScale,
}: {
  size: number;
  glyphScale: number;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // No border-radius: PWA/maskable icons must be full-bleed squares;
          // the OS applies its own mask (circle/squircle).
          background: "#C79032",
        }}
      >
        <svg
          width={`${glyphScale * 100}%`}
          height={`${glyphScale * 100}%`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {WALLET_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

export default function Icon() {
  return renderIcon({ size: 32, glyphScale: 0.6 });
}

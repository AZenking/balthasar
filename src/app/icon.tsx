import { ImageResponse } from "next/og";

/**
 * Favicon / `<link rel="icon">` generator (Next.js file convention).
 *
 * Renders the BALTHASAR mark from code via `next/og` (Satori): a HeroUI-blue
 * square with the ivory B / household-ledger monogram. This route is fixed at 32×32 by the Next icon
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
 * Shared icon JSX factory. The same geometry lives in the SVG masters under
 * `public/pwa/`; keeping it inline here lets Next render a crisp favicon.
 *
 * `glyphScale` is the fraction of the canvas the Wallet glyph occupies;
 * maskable variants use a smaller scale to stay inside the safe zone.
 *
 * The mark combines a geometric B, two ledger-page edges, and one transaction
 * dot. Broad counters and a two-colour palette keep it readable at 32 px.
 */
export const BALTHASAR_B_PATH =
  "M174 96h112c77 0 124 36 124 99 0 35-17 62-51 78 40 15 63 47 63 89 0 68-49 102-130 102H174V96Zm68 64v84h40c42 0 65-14 65-42s-23-42-65-42h-40Zm0 144v96h49c44 0 68-16 68-48s-24-48-68-48h-49Z";

export const BALTHASAR_PAGES_PATH =
  "M86 144 156 96l18 30-54 36v258H86V144Zm40 32 48-32v38l-14 10v248h-34V176Z";

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
          // HeroUI default accent: oklch(62.04% 0.195 253.83).
          background: "#0485F7",
        }}
      >
        <svg
          width={`${glyphScale * 100}%`}
          height={`${glyphScale * 100}%`}
          viewBox="0 0 512 512"
          fill="none"
        >
          <path d={BALTHASAR_PAGES_PATH} fill="#FFF8EB" />
          <path d={BALTHASAR_B_PATH} fill="#FFF8EB" fillRule="evenodd" />
          <circle cx="324" cy="352" r="15" fill="#FFF8EB" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

export default function Icon() {
  return renderIcon({ size: 32, glyphScale: 0.8 });
}

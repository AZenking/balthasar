import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../../..");

describe("PWA manifest", () => {
  it("declares stable standalone navigation and static application icons", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "public/manifest.webmanifest"), "utf8")
    ) as {
      id?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      icons?: Array<{ src: string; sizes: string; purpose?: string }>;
    };

    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/pwa/icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/pwa/icon-512.png", sizes: "512x512" }),
        expect.objectContaining({
          src: "/pwa/icon-maskable-512.png",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ])
    );

    await Promise.all(
      ["icon-192.png", "icon-512.png", "icon-maskable-512.png"].map((file) =>
        access(path.join(root, "public/pwa", file))
      )
    );
  });
});

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../../..");

/**
 * PWA manifest 契约测试。
 *
 * 032-pwa-manifest-polish 改造(见 specs/032/research.md R1/R2/R5):
 * - R1: 主题色改中性深色 #2a2a2d(dark_theme_color 字段不存在,只能单一 background_color)
 * - R2: id 用 URL 形式(推荐 /?balthasar,裸字符串不合规)
 * - R5: 192 加独立 maskable 条目
 *
 * 既有契约(start_url/scope/display/图标存在性)回归保护不变。
 * shortcuts(C3)/screenshots(C4)断言在 Phase 4/5(US3/US4)再加。
 */
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

  // 032 R2: id MUST 是 URL 形式(裸字符串如 "balthasar" 不合规,会被当相对 URL
  // 解析成路径拼接)。/ 已合法稳定,本 feature 改 /?balthasar 让 id 可辨识。
  // query 后缀不影响路由(Next.js 忽略未知 query)。
  it("declares a stable URL-form id (032 US2 / R2)", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "public/manifest.webmanifest"), "utf8")
    ) as { id?: string };

    expect(manifest.id).toBe("/?balthasar");
    // 防御:绝不能用裸字符串(会被解析成 <start_url>balthasar)
    expect(manifest.id).not.toBe("balthasar");
  });

  // 032 R1: theme_color / background_color 都改中性深色 #2a2a2d(对齐
  // src/app/layout.tsx viewport 深色 themeColor + globals.css 深色 --background)。
  // 规范不支持 per-color-scheme,也**不存在** dark_theme_color 字段(W3C/App-Info
  // registry 均无),故只能选单一中性色,深色用户受益最大。
  it("declares dark-neutral theme/background colors (032 US1 / R1)", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "public/manifest.webmanifest"), "utf8")
    ) as {
      theme_color?: string;
      background_color?: string;
      dark_theme_color?: string;
    };

    expect(manifest.background_color).toBe("#2a2a2d");
    expect(manifest.theme_color).toBe("#2a2a2d");
    // 防御:dark_theme_color 字段不存在,声明了也会被浏览器忽略,不应出现
    expect(manifest.dark_theme_color).toBeUndefined();
  });

  // 032 R5: 192 也加独立 maskable 条目(Android 自适应图标小尺寸场景裁切更稳)。
  // 用分开条目(any 一条 + maskable 一条),不用 "any maskable" 单条目(R5 推荐分开)。
  it("declares a 192 maskable icon separate from any (032 US5 / R5)", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "public/manifest.webmanifest"), "utf8")
    ) as {
      icons?: Array<{ src: string; sizes: string; purpose?: string }>;
    };

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/pwa/icon-192-maskable.png",
          sizes: "192x192",
          purpose: "maskable",
        }),
      ]),
    );

    // 文件存在性
    await access(path.join(root, "public/pwa/icon-192-maskable.png"));
  });
});

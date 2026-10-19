import { describe, expect, test } from "bun:test";
import { pageSEO, PRODUCTION_ORIGIN } from "./seo";
import { sitemapXML, isSitemapRouteIncluded } from "./sitemap";
import type { AnyRoute } from "@tanstack/react-router";

describe("User-selected SEO boundaries", () => {
  test("canonical URLs use the actual Vercel production address", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://vibelinkke.vercel.app");
    expect(pageSEO("VibeLink", "Public page", "/auth", true).links[0].href).toBe("https://vibelinkke.vercel.app/auth");
    expect(sitemapXML(PRODUCTION_ORIGIN, [{ path: "/auth" }])).toContain("<loc>https://vibelinkke.vercel.app/auth</loc>");
  });
  test("private conversations are not indexable", () => {
    expect(pageSEO("Chat", "Private conversation", "/messages/example").meta.find((tag) => "name" in tag && tag.name === "robots")?.content).toBe("noindex, nofollow, noarchive");
  });
  test("authenticated descendants cannot opt into the sitemap", () => {
    const parent = { options: { staticData: { sitemap: "exclude-subtree" } } } as unknown as AnyRoute;
    const child = { options: { staticData: { sitemap: true } }, parentRoute: parent, isRoot: false } as unknown as AnyRoute;
    expect(isSitemapRouteIncluded(child)).toBe(false);
  });
});
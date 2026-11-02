import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { pageSEO, PRODUCTION_ORIGIN } from "./seo";
import { sitemapXML, isSitemapRouteIncluded } from "./sitemap";
import type { AnyRoute } from "@tanstack/react-router";

describe("User-selected SEO boundaries", () => {
  test("canonical URLs use the actual Vercel production address", () => {
    assert.equal(PRODUCTION_ORIGIN, "https://vibelinkke.vercel.app");
    assert.equal(pageSEO("Twiqo", "Public page", "/auth", true).links[0].href, "https://vibelinkke.vercel.app/auth");
    assert.ok(sitemapXML(PRODUCTION_ORIGIN, [{ path: "/auth" }]).includes("<loc>https://vibelinkke.vercel.app/auth</loc>"));
  });
  test("private conversations are not indexable", () => {
    assert.equal(pageSEO("Chat", "Private conversation", "/messages/example").meta.find((tag) => "name" in tag && tag.name === "robots")?.content, "noindex, nofollow, noarchive");
  });
  test("authenticated descendants cannot opt into the sitemap", () => {
    const parent = { options: { staticData: { sitemap: "exclude-subtree" } } } as unknown as AnyRoute;
    const child = { options: { staticData: { sitemap: true } }, parentRoute: parent, isRoot: false } as unknown as AnyRoute;
    assert.equal(isSitemapRouteIncluded(child), false);
  });
});
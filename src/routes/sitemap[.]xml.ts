import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import { sitemapStaticPaths, sitemapXML } from "@/lib/sitemap";
import { PRODUCTION_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const router = await getRouterInstance();
        const entries = sitemapStaticPaths(router).map((path) => ({ path }));
        if (!entries.length) return new Response("No discoverable pages", { status: 404, headers: { "Cache-Control": "no-store" } });
        return new Response(sitemapXML(PRODUCTION_ORIGIN, entries), {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
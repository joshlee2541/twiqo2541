export const PRODUCTION_ORIGIN = "https://vibelinkke.vercel.app";

export function pageSEO(title: string, description: string, path: string, indexable = false) {
  const url = new URL(path, PRODUCTION_ORIGIN).href;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: indexable ? "index, follow" : "noindex, nofollow, noarchive" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
# Project architecture
- Define page metadata with the browser-safe SEO helper and leaf route heads; private pages must use generic metadata and noindex so no user content enters search previews.
- Derive sitemap entries from required route-level staticData decisions and exclude the authenticated subtree; never query private records for discovery.
- Preserve the client authentication gate and data access policies when changing SEO; crawler directives are not authorization.
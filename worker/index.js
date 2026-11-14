// Cloudflare Worker: serves the built React app from static assets and
// forwards /api/* to the FastAPI backend on Azure, so the browser only ever
// talks to one origin (no CORS, no hard-coded API URL in the bundle).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Host", url.host);
      headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
      headers.delete("Origin"); // same-origin from the browser's view

      try {
        return await fetch(target, {
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
          redirect: "manual",
        });
      } catch (err) {
        return Response.json(
          { detail: "The API is not reachable right now. Please try again shortly." },
          { status: 502 },
        );
      }
    }

    // Everything else is the single-page app (unknown paths fall back to index.html).
    return env.ASSETS.fetch(request);
  },

  // Every 10 minutes: ping the API so the free Azure plan does not go to sleep
  // (a cold start takes ~30 s, which a first-time visitor would feel).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(new URL("/api/health", env.API_ORIGIN)).catch(() => {}));
  },
};

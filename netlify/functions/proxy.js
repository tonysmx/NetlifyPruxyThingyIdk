addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

const TARGET_HOST = "https://gametreexp.github.io";

async function handleRequest(request) {
  // 1. Handle CORS preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
        "Access-Control-Allow-Headers": "*",
      }
    });
  }

  const url = new URL(request.url);
  const proxiedUrl = `${TARGET_HOST}${url.pathname}${url.search}`;

  // 2. Remove Host header so GitHub Pages accepts proxy traffic
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("host");

  let response = await fetch(proxiedUrl, {
    method: request.method,
    headers: reqHeaders,
    redirect: "follow"
  });

  const newHeaders = new Headers(response.headers);

  // 3. Strip frame restrictions and enable full CORS for direct fetching
  newHeaders.delete("X-Frame-Options");
  newHeaders.delete("Content-Security-Policy");
  newHeaders.delete("Frame-Options");
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "*");

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    let html = await response.text();

    // Rewrite root-relative links (/assets, /css) to Worker origin
    html = html.replace(
      /(src|href|action)=["'](\/[^"']*)["']/gi,
      `$1="${url.origin}$2"`
    );

    // Rewrite absolute links to TARGET_HOST back to Worker origin
    const targetRegex = new RegExp(TARGET_HOST, "gi");
    html = html.replace(targetRegex, url.origin);

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

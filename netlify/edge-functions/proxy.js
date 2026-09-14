export default async (request, context) => {
  const TARGET_HOST = "https://gametreexp.github.io";

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

  // 2. Clear out the incoming Host header so GitHub Pages accepts the traffic
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("host");

  let response = await fetch(proxiedUrl, {
    method: request.method,
    headers: reqHeaders,
    redirect: "follow"
  });

  // If the target website tries to explicitly redirect you back to GitHub, stop it
  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (location && location.includes(TARGET_HOST)) {
      const newLocation = location.replace(TARGET_HOST, url.origin);
      const redirectHeaders = new Headers(response.headers);
      redirectHeaders.set("location", newLocation);
      return new Response(null, { status: response.status, headers: redirectHeaders });
    }
  }

  const newHeaders = new Headers(response.headers);

  // 3. Strip security frame policies so the content isn't blocked or watermarked
  newHeaders.delete("X-Frame-Options");
  newHeaders.delete("Content-Security-Policy");
  newHeaders.delete("Frame-Options");
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "*");

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    let html = await response.text();

    // Rewrite internal absolute links to keep them on your Netlify proxy domain
    html = html.replace(new RegExp(TARGET_HOST, "gi"), url.origin);

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
};

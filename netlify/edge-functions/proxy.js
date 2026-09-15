export const config = {
  path: "/*"
};

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

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("host");

  let response = await fetch(proxiedUrl, {
    method: request.method,
    headers: reqHeaders,
    redirect: "follow"
  });

  // Handle redirects back to target host
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
  newHeaders.delete("X-Frame-Options");
  newHeaders.delete("Content-Security-Policy");
  newHeaders.delete("Frame-Options");
  newHeaders.set("Access-Control-Allow-Origin", "*");

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    let html = await response.text();

    // Safely rewrite absolute links to keep navigation on Netlify
    html = html.replaceAll(TARGET_HOST, url.origin);

    // Anti-inspect and right-click block script
    const antiInspectScript = `
<script>
  (function() {
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
    document.addEventListener('keydown', function(e) {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && ['I','J','C','i','j','c'].includes(e.key)) || 
        (e.ctrlKey && ['u','U'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  })();
<\/script>`;

    // Append script cleanly at the end of the document
    html = html + antiInspectScript;

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

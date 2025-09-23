var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function isValidOrigin(request, allowedOrigins) {
  if (!allowedOrigins) return true;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const DEBUG = request.env?.DEBUG === "true";
  if (DEBUG) {
    console.log("Origin validation:", {
      origin,
      referer,
      userAgent: request.headers.get("user-agent"),
      method: request.method
    });
  }
  if (!origin || origin === "null") {
    const userAgent = request.headers.get("user-agent") || "";
    const isDirectBrowserAccess = userAgent.includes("Mozilla");
    if (isDirectBrowserAccess) {
      if (DEBUG) console.log("Allowing direct browser access without origin header");
      return true;
    }
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.hostname}`;
        return checkOriginAgainstAllowed(refererOrigin, allowedOrigins, DEBUG);
      } catch (error) {
        if (DEBUG) console.log("Failed to extract origin from referer:", error.message);
      }
    }
    if (DEBUG) console.log("No valid origin found, allowing for compatibility");
    return true;
  }
  return checkOriginAgainstAllowed(origin, allowedOrigins, DEBUG);
}
__name(isValidOrigin, "isValidOrigin");
function checkOriginAgainstAllowed(origin, allowedOrigins, DEBUG = false) {
  const allowedDomains = allowedOrigins.split(",").map((domain) => domain.trim());
  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch (error) {
    if (DEBUG) console.log("Invalid origin URL:", origin, error.message);
    return false;
  }
  const isAllowed = allowedDomains.some((allowed) => {
    if (allowed === "null" || allowed === "undefined") {
      return origin === "null" || !origin;
    }
    try {
      const allowedUrl = new URL(allowed);
      const hostnameMatch = originUrl.hostname === allowedUrl.hostname;
      const protocolMatch = originUrl.protocol === allowedUrl.protocol;
      if (DEBUG) {
        console.log("Checking allowed domain:", {
          allowed,
          origin,
          hostnameMatch,
          protocolMatch,
          result: hostnameMatch && protocolMatch
        });
      }
      return hostnameMatch && protocolMatch;
    } catch (error) {
      if (DEBUG) console.log("Invalid allowed domain URL:", allowed, error.message);
      return false;
    }
  });
  if (DEBUG) {
    console.log("Origin validation result:", isAllowed);
  }
  return isAllowed;
}
__name(checkOriginAgainstAllowed, "checkOriginAgainstAllowed");
function getFlexibleCorsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowedOrigins = env.ALLOWED_ORIGINS;
  const baseCorsHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, User-Agent, Cache-Control, Origin, Referer",
    "Access-Control-Max-Age": "86400"
  };
  if (origin && origin !== "null" && isValidOrigin(request, allowedOrigins)) {
    return {
      ...baseCorsHeaders,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };
  }
  if (!origin && referer && allowedOrigins) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.hostname}`;
      if (checkOriginAgainstAllowed(refererOrigin, allowedOrigins)) {
        return {
          ...baseCorsHeaders,
          "Access-Control-Allow-Origin": refererOrigin,
          "Access-Control-Allow-Credentials": "true",
          "Vary": "Origin"
        };
      }
    } catch (error) {
      console.log("Failed to process referer as origin:", error.message);
    }
  }
  const userAgent = request.headers.get("user-agent") || "";
  const isDirectBrowserAccess = userAgent.includes("Mozilla");
  if (isDirectBrowserAccess) {
    console.log("Providing CORS headers for direct browser access");
    return {
      ...baseCorsHeaders,
      "Access-Control-Allow-Origin": "*",
      // 对于直接访问，允许所有origin
      "Cache-Control": "public, max-age=300"
    };
  }
  return {
    ...baseCorsHeaders,
    "Access-Control-Allow-Origin": "*"
  };
}
__name(getFlexibleCorsHeaders, "getFlexibleCorsHeaders");
function isValidProxyTarget(hostname, env) {
  const allowedTargets = [
    "www.javbus.com",
    "javbus.com",
    "javdb.com",
    "www.javdb.com",
    "www.javlibrary.com",
    "javlibrary.com",
    "sukebei.nyaa.si",
    "btsow.com",
    "www.btsow.com",
    "magnetdl.com",
    "www.magnetdl.com",
    "torrentkitty.tv",
    "www.torrentkitty.tv",
    "jable.tv",
    "www.jable.tv",
    "javmost.com",
    "www.javmost.com",
    "jav.guru",
    "www.jav.guru",
    "av01.tv",
    "www.av01.tv",
    "missav.com",
    "www.missav.com",
    "javhd.porn",
    "www.javhd.porn",
    "javgg.net",
    "www.javgg.net",
    "javhihi.com",
    "www.javhihi.com",
    "sehuatang.org",
    "www.sehuatang.org",
    "t66y.com",
    "www.t66y.com"
  ];
  const extraTargets = env.EXTRA_PROXY_TARGETS?.split(",").map((t) => t.trim()) || [];
  const allAllowedTargets = [...allowedTargets, ...extraTargets];
  return allAllowedTargets.includes(hostname.toLowerCase());
}
__name(isValidProxyTarget, "isValidProxyTarget");
function logError(request, message) {
  const clientIp = request.headers.get("cf-connecting-ip");
  const userAgent = request.headers.get("user-agent");
  const origin = request.headers.get("origin") || request.headers.get("referer");
  console.error(
    `${message}, clientIp: ${clientIp}, origin: ${origin}, user-agent: ${userAgent}, url: ${request.url}`
  );
}
__name(logError, "logError");
function logDebug(request, message, env) {
  if (env.DEBUG === "true") {
    const clientIp = request.headers.get("cf-connecting-ip");
    const origin = request.headers.get("origin") || request.headers.get("referer");
    console.log(`DEBUG: ${message}, clientIp: ${clientIp}, origin: ${origin}, url: ${request.url}`);
  }
}
__name(logDebug, "logDebug");
function createNewRequest(request, url, proxyHostname, originHostname) {
  const newRequestHeaders = new Headers(request.headers);
  newRequestHeaders.set("Host", proxyHostname);
  const referer = newRequestHeaders.get("referer");
  if (referer && referer.includes(originHostname)) {
    const newReferer = referer.replace(
      `${originHostname}/proxy/${proxyHostname}`,
      proxyHostname
    );
    newRequestHeaders.set("referer", newReferer);
  }
  newRequestHeaders.delete("cf-connecting-ip");
  newRequestHeaders.delete("cf-ray");
  newRequestHeaders.delete("cf-ipcountry");
  return new Request(url.toString(), {
    method: request.method,
    headers: newRequestHeaders,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
    redirect: "follow"
  });
}
__name(createNewRequest, "createNewRequest");
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
__name(escapeRegex, "escapeRegex");
function setResponseHeaders(originalResponse, proxyHostname, originHostname, DEBUG, corsHeaders = {}) {
  const newResponseHeaders = new Headers(originalResponse.headers);
  const headersToReplace = [
    "location",
    "content-location",
    "content-base",
    "refresh"
  ];
  headersToReplace.forEach((headerName) => {
    const headerValue = newResponseHeaders.get(headerName);
    if (headerValue && headerValue.includes(proxyHostname)) {
      const newValue = headerValue.replace(
        new RegExp(`https?://${escapeRegex(proxyHostname)}`, "g"),
        `https://${originHostname}/proxy/${proxyHostname}`
      );
      newResponseHeaders.set(headerName, newValue);
    }
  });
  if (corsHeaders) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newResponseHeaders.set(key, value);
    });
  }
  if (DEBUG === "true") {
    newResponseHeaders.delete("content-security-policy");
    newResponseHeaders.delete("x-frame-options");
  }
  newResponseHeaders.set("X-Content-Type-Options", "nosniff");
  newResponseHeaders.set("X-Frame-Options", "SAMEORIGIN");
  return newResponseHeaders;
}
__name(setResponseHeaders, "setResponseHeaders");
async function replaceResponseText(originalResponse, proxyHostname, pathnameRegex, originHostname) {
  let text = await originalResponse.text();
  const httpsUrlRegex = new RegExp(`https://${escapeRegex(proxyHostname)}`, "g");
  text = text.replace(httpsUrlRegex, `https://${originHostname}/proxy/${proxyHostname}`);
  const httpUrlRegex = new RegExp(`http://${escapeRegex(proxyHostname)}`, "g");
  text = text.replace(httpUrlRegex, `https://${originHostname}/proxy/${proxyHostname}`);
  const protocolRelativeRegex = new RegExp(`//${escapeRegex(proxyHostname)}`, "g");
  text = text.replace(protocolRelativeRegex, `//${originHostname}/proxy/${proxyHostname}`);
  return text;
}
__name(replaceResponseText, "replaceResponseText");
async function handleProxyRequest(request, env, targetHostname = null) {
  logDebug(request, `Starting proxy request, targetHostname: ${targetHostname}`, env);
  const corsHeaders = getFlexibleCorsHeaders(request, env);
  const {
    PROXY_HOSTNAME,
    PROXY_PROTOCOL = "https",
    PATHNAME_REGEX,
    UA_WHITELIST_REGEX,
    UA_BLACKLIST_REGEX,
    URL302,
    IP_WHITELIST_REGEX,
    IP_BLACKLIST_REGEX,
    REGION_WHITELIST_REGEX,
    REGION_BLACKLIST_REGEX,
    DEBUG = "false"
  } = env;
  const url = new URL(request.url);
  const originHostname = url.hostname;
  const proxyHostname = targetHostname || PROXY_HOSTNAME;
  if (!proxyHostname) {
    logError(request, "Proxy hostname not configured");
    return new Response(JSON.stringify({
      error: "Proxy not configured"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  logDebug(request, `Using proxy hostname: ${proxyHostname}`, env);
  if (!isValidProxyTarget(proxyHostname, env)) {
    logError(request, `Invalid proxy target: ${proxyHostname}`);
    return new Response(JSON.stringify({
      error: "Invalid proxy target",
      target: proxyHostname,
      allowedTargets: env.DEBUG === "true" ? "Check server configuration" : void 0
    }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
  const clientIp = request.headers.get("cf-connecting-ip") || "";
  const country = request.headers.get("cf-ipcountry") || "";
  if (PATHNAME_REGEX && !new RegExp(PATHNAME_REGEX).test(url.pathname) || UA_WHITELIST_REGEX && !new RegExp(UA_WHITELIST_REGEX).test(userAgent) || UA_BLACKLIST_REGEX && new RegExp(UA_BLACKLIST_REGEX).test(userAgent) || IP_WHITELIST_REGEX && !new RegExp(IP_WHITELIST_REGEX).test(clientIp) || IP_BLACKLIST_REGEX && new RegExp(IP_BLACKLIST_REGEX).test(clientIp) || REGION_WHITELIST_REGEX && !new RegExp(REGION_WHITELIST_REGEX).test(country) || REGION_BLACKLIST_REGEX && new RegExp(REGION_BLACKLIST_REGEX).test(country)) {
    logError(request, "Access denied - validation failed");
    return URL302 ? Response.redirect(URL302, 302) : new Response(await generateErrorPage(), {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...corsHeaders
      }
    });
  }
  url.host = proxyHostname;
  url.protocol = PROXY_PROTOCOL;
  logDebug(request, `Target URL: ${url.toString()}`, env);
  const newRequest = createNewRequest(request, url, proxyHostname, originHostname);
  try {
    const originalResponse = await fetch(newRequest, {
      timeout: 3e4
      // 30秒超时
    });
    const newResponseHeaders = setResponseHeaders(
      originalResponse,
      proxyHostname,
      originHostname,
      DEBUG,
      corsHeaders
    );
    const contentType = newResponseHeaders.get("content-type") || "";
    let body;
    if (contentType.includes("text/") && originalResponse.body) {
      body = await replaceResponseText(
        originalResponse,
        proxyHostname,
        PATHNAME_REGEX,
        originHostname
      );
    } else {
      body = originalResponse.body;
    }
    return new Response(body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: newResponseHeaders
    });
  } catch (error) {
    logError(request, `Proxy request failed: ${error.message}`);
    return new Response(JSON.stringify({
      error: "Proxy request failed",
      message: DEBUG === "true" ? error.message : "Service temporarily unavailable",
      target: proxyHostname
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
}
__name(handleProxyRequest, "handleProxyRequest");
async function generateErrorPage() {
  return `<!DOCTYPE html>
<html>
<head>
<title>Access Denied</title>
<meta charset="utf-8">
<style>
html { color-scheme: light dark; }
body { 
  width: 35em; 
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif; 
  padding: 2rem;
  text-align: center;
  line-height: 1.6;
}
.status { 
  background: #fef2f2; 
  border: 1px solid #ef4444; 
  border-radius: 8px; 
  padding: 1.5rem; 
  margin: 1rem 0; 
}
h1 { color: #dc2626; margin: 0 0 1rem 0; }
.info { font-size: 0.9em; color: #666; margin-top: 2rem; }
</style>
</head>
<body>
<h1>\u{1F6AB} Access Denied</h1>
<div class="status">
  <p><strong>\u8BBF\u95EE\u88AB\u62D2\u7EDD</strong></p>
  <p>\u60A8\u7684\u8BF7\u6C42\u672A\u901A\u8FC7\u5B89\u5168\u9A8C\u8BC1\u3002</p>
  <p>\u8BF7\u786E\u4FDD\u4ECE\u6388\u6743\u7684\u6765\u6E90\u8BBF\u95EE\u6B64\u670D\u52A1\u3002</p>
</div>
<div class="info">
  <p>\u5982\u9700\u5E2E\u52A9\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002</p>
  <p><small>Error Code: ORIGIN_NOT_ALLOWED</small></p>
</div>
</body>
</html>`;
}
__name(generateErrorPage, "generateErrorPage");
async function handleHealthCheck(request, env) {
  const corsHeaders = getFlexibleCorsHeaders(request, env);
  const healthData = {
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "2.1.3",
    environment: env.ENVIRONMENT || "production",
    security: {
      originValidation: "flexible",
      corsSupport: true,
      directAccess: true,
      domainWhitelist: true
    },
    features: {
      proxy: !!env.PROXY_HOSTNAME,
      dynamicProxy: true,
      cors: true,
      pathRouting: !!env.PATHNAME_REGEX,
      geoBlocking: !!(env.REGION_WHITELIST_REGEX || env.REGION_BLACKLIST_REGEX),
      ipFiltering: !!(env.IP_WHITELIST_REGEX || env.IP_BLACKLIST_REGEX),
      userAgentFiltering: !!(env.UA_WHITELIST_REGEX || env.UA_BLACKLIST_REGEX)
    }
  };
  return new Response(JSON.stringify(healthData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(handleHealthCheck, "handleHealthCheck");
async function handleApiRoute(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/health" || path === "/_health") {
    return handleHealthCheck(request, env);
  }
  if (path === "/api/status") {
    const corsHeaders2 = getFlexibleCorsHeaders(request, env);
    const status = {
      proxyTarget: env.PROXY_HOSTNAME || "not configured",
      protocol: env.PROXY_PROTOCOL || "https",
      allowedOrigins: env.ALLOWED_ORIGINS || "flexible",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      debug: env.DEBUG === "true",
      security: "flexible",
      dynamicProxyEnabled: true,
      version: "2.1.3",
      cors: "enhanced"
    };
    return new Response(JSON.stringify(status, null, 2), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders2
      }
    });
  }
  const corsHeaders = getFlexibleCorsHeaders(request, env);
  return new Response("API endpoint not found", {
    status: 404,
    headers: corsHeaders
  });
}
__name(handleApiRoute, "handleApiRoute");
var index_default = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      logDebug(request, `Request received for path: ${url.pathname}`, env);
      if (request.method === "OPTIONS") {
        const corsHeaders = getFlexibleCorsHeaders(request, env);
        return new Response(null, {
          headers: corsHeaders,
          status: 204
        });
      }
      if (url.pathname.startsWith("/api/") || url.pathname === "/_health") {
        logDebug(request, `Handling API route: ${url.pathname}`, env);
        return await handleApiRoute(request, env);
      }
      if (url.pathname.startsWith("/proxy/")) {
        logDebug(request, `Handling dynamic proxy route: ${url.pathname}`, env);
        const pathParts = url.pathname.substring(7).split("/");
        const targetHostname = pathParts[0];
        if (!targetHostname) {
          const corsHeaders = getFlexibleCorsHeaders(request, env);
          logError(request, "Invalid proxy URL: missing hostname");
          return new Response(JSON.stringify({
            error: "Invalid proxy URL: missing hostname",
            expectedFormat: "/proxy/{hostname}/{path}"
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        if (!/^[a-zA-Z0-9.-]+$/.test(targetHostname)) {
          const corsHeaders = getFlexibleCorsHeaders(request, env);
          logError(request, `Invalid hostname format: ${targetHostname}`);
          return new Response(JSON.stringify({
            error: "Invalid hostname format",
            hostname: targetHostname
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        if (!isValidProxyTarget(targetHostname, env)) {
          const corsHeaders = getFlexibleCorsHeaders(request, env);
          logError(request, `Forbidden proxy target: ${targetHostname}`);
          return new Response(JSON.stringify({
            error: "Forbidden proxy target",
            hostname: targetHostname,
            message: "\u8BE5\u57DF\u540D\u4E0D\u5728\u4EE3\u7406\u767D\u540D\u5355\u4E2D"
          }), {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        let targetPath = "/";
        if (pathParts.length > 1) {
          const pathSegments = pathParts.slice(1).filter((segment) => segment);
          if (pathSegments.length > 0) {
            targetPath = "/" + pathSegments.join("/");
          }
        }
        if (url.search) {
          targetPath += url.search;
        }
        if (url.hash) {
          targetPath += url.hash;
        }
        logDebug(request, `Dynamic proxy - target: ${targetHostname}, path: ${targetPath}`, env);
        const newUrl = new URL(request.url);
        newUrl.pathname = targetPath;
        const modifiedRequest = new Request(newUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        return await handleProxyRequest(modifiedRequest, env, targetHostname);
      }
      logDebug(request, "Handling main proxy logic", env);
      return await handleProxyRequest(request, env);
    } catch (error) {
      logError(request, `Worker error: ${error.message}`);
      const errorResponse = {
        error: "Proxy service error",
        message: env.DEBUG === "true" ? error.message : "Internal server error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        code: "WORKER_ERROR",
        version: "2.1.3"
      };
      const corsHeaders = getFlexibleCorsHeaders(request, env);
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

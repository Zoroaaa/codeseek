// Enhanced Proxy Handler - Core Proxy Logic
// Handles all proxy-related functionality

import { CONFIG } from './config.js';
import { ContentInjector } from './injector.js';
import { getMainPageTemplate, getPasswordPageTemplate } from './templates.js';
import { getCookie, getHTMLResponse, getRedirect, getUnrestrictedCorsHeaders } from './utils.js';

export class ProxyHandler {
  constructor(env, cacheManager) {
    this.env = env;
    this.cacheManager = cacheManager;
    this.injector = new ContentInjector();
    this.password = env.PROXY_PASSWORD || CONFIG.DEFAULT_PASSWORD;
    this.showPasswordPage = env.SHOW_PASSWORD_PAGE !== 'false';
  }

  /**
   * Handle incoming proxy request
   */
  async handleRequest(request) {
    // Block unwanted crawlers
    const userAgent = request.headers.get('User-Agent');
    if (userAgent && userAgent.includes("Bytespider")) {
      return getHTMLResponse(CONFIG.CRAWLER_BLOCK_MESSAGE);
    }

    // Password authentication
    const siteCookie = request.headers.get('Cookie');
    if (this.password && !this.validatePassword(siteCookie)) {
      return this.handleWrongPassword();
    }

    const url = new URL(request.url);
    
    // Handle special endpoints
    if (request.url.endsWith("favicon.ico")) {
      return getRedirect("https://www.baidu.com/favicon.ico");
    }
    
    if (request.url.endsWith("robots.txt")) {
      return new Response(CONFIG.ROBOTS_TXT, {
        headers: { "Content-Type": "text/plain" }
      });
    }

    // Extract actual URL from proxy path
    const actualUrlStr = this.extractActualUrl(url);
    
    // Show main page if no URL provided
    if (actualUrlStr === "") {
      return getHTMLResponse(getMainPageTemplate());
    }

    // Validate and normalize URL
    const actualUrl = this.validateAndNormalizeUrl(actualUrlStr, siteCookie);
    if (typeof actualUrl === 'object' && actualUrl.redirect) {
      return actualUrl.response;
    }

    // Process proxy request
    return await this.processProxyRequest(request, actualUrl, siteCookie);
  }

  /**
   * Validate password from cookie
   */
  validatePassword(siteCookie) {
    if (!this.password) return true;
    
    if (!siteCookie) return false;
    
    const pwd = getCookie(CONFIG.PASSWORD_COOKIE_NAME, siteCookie);
    return pwd === this.password;
  }

  /**
   * Handle wrong password scenario
   */
  handleWrongPassword() {
    if (this.showPasswordPage) {
      return getHTMLResponse(getPasswordPageTemplate(CONFIG.PASSWORD_COOKIE_NAME));
    } else {
      return getHTMLResponse("<h1>403 Forbidden</h1><br>You do not have access to view this webpage.");
    }
  }

  /**
   * Extract actual URL from proxy path
   */
  extractActualUrl(url) {
    const pathIndex = url.pathname.indexOf(CONFIG.URL_SEPARATOR);
    if (pathIndex === -1) return "";
    
    return url.pathname.substring(pathIndex + CONFIG.URL_SEPARATOR.length) + 
           url.search + url.hash;
  }

  /**
   * Validate and normalize URL
   */
  validateAndNormalizeUrl(actualUrlStr, siteCookie) {
    try {
      let testUrl = actualUrlStr;
      if (!testUrl.startsWith("http")) {
        testUrl = "https://" + testUrl;
      }
      
      const urlObj = new URL(testUrl);
      if (!urlObj.host.includes(".")) {
        throw new Error("Invalid host");
      }
    } catch {
      // Try to use last visited site from cookie
      if (siteCookie) {
        const lastVisit = getCookie(CONFIG.LAST_VISIT_COOKIE_NAME, siteCookie);
        if (lastVisit) {
          return {
            redirect: true,
            response: getRedirect(`${globalThis.thisProxyServerUrlHttps}${lastVisit}/${actualUrlStr}`)
          };
        }
      }
      return {
        redirect: true,
        response: getHTMLResponse(`Invalid URL format: ${actualUrlStr}`)
      };
    }

    // Ensure URL has protocol
    if (!actualUrlStr.startsWith("http") && !actualUrlStr.includes("://")) {
      return {
        redirect: true,
        response: getRedirect(`${globalThis.thisProxyServerUrlHttps}https://${actualUrlStr}`)
      };
    }

    const actualUrl = new URL(actualUrlStr);
    
    // Redirect if URL was normalized
    if (actualUrlStr !== actualUrl.href) {
      return {
        redirect: true,
        response: getRedirect(`${globalThis.thisProxyServerUrlHttps}${actualUrl.href}`)
      };
    }

    return actualUrl;
  }

  /**
   * Process the actual proxy request
   */
  async processProxyRequest(request, actualUrl, siteCookie) {
    // Modify client headers
    const clientHeaders = this.modifyClientHeaders(request.headers, actualUrl);
    
    // Modify client body if needed
    const clientBody = await this.modifyClientBody(request, actualUrl);

    // Create modified request
    const modifiedRequest = new Request(actualUrl, {
      headers: clientHeaders,
      method: request.method,
      body: clientBody,
      redirect: "manual"
    });

    // Fetch response
    const response = await fetch(modifiedRequest);

    // Handle redirects
    if (response.status.toString().startsWith("3") && response.headers.get("Location")) {
      try {
        const redirectUrl = new URL(response.headers.get("Location"), actualUrl.href).href;
        return getRedirect(`${globalThis.thisProxyServerUrlHttps}${redirectUrl}`);
      } catch {
        return getHTMLResponse(
          `Redirect error: ${response.headers.get("Location")} from ${actualUrl.href}`
        );
      }
    }

    // Process response
    return await this.processResponse(response, actualUrl, siteCookie);
  }

  /**
   * Modify client request headers
   */
  modifyClientHeaders(headers, actualUrl) {
    const modifiedHeaders = new Headers();
    
    headers.forEach((value, key) => {
      let newValue = value;
      
      // Replace proxy URLs with actual URLs
      newValue = newValue.replaceAll(
        `${globalThis.thisProxyServerUrlHttps}http`, 
        "http"
      );
      newValue = newValue.replaceAll(
        globalThis.thisProxyServerUrlHttps, 
        `${actualUrl.protocol}//${actualUrl.hostname}/`
      );
      newValue = newValue.replaceAll(
        globalThis.thisProxyServerUrlHttps.slice(0, -1), 
        `${actualUrl.protocol}//${actualUrl.hostname}`
      );
      newValue = newValue.replaceAll(
        globalThis.thisProxyServerUrl_hostOnly, 
        actualUrl.host
      );
      
      modifiedHeaders.set(key, newValue);
    });

    return modifiedHeaders;
  }

  /**
   * Modify client request body if needed
   */
  async modifyClientBody(request, actualUrl) {
    if (!request.body) return null;

    try {
      const [body1, body2] = request.body.tee();
      const bodyText = await new Response(body1).text();

      if (bodyText.includes(globalThis.thisProxyServerUrlHttps) ||
          bodyText.includes(globalThis.thisProxyServerUrl_hostOnly)) {
        return bodyText
          .replaceAll(globalThis.thisProxyServerUrlHttps, actualUrl.href)
          .replaceAll(globalThis.thisProxyServerUrl_hostOnly, actualUrl.host);
      } else {
        return body2;
      }
    } catch (e) {
      return request.body;
    }
  }

  /**
   * Process the response from target server
   */
  async processResponse(response, actualUrl, siteCookie) {
    const contentType = response.headers.get("Content-Type") || '';
    const hasProxyHintCookie = getCookie(CONFIG.PROXY_HINT_COOKIE_NAME, siteCookie) !== "";
    
    let modifiedResponse;
    let isHTML = false;

    if (response.body && contentType.startsWith("text/")) {
      let body = await response.text();
      isHTML = contentType.includes("text/html") && body.includes("<html");

      // Replace location objects in JS/HTML
      if (contentType.includes("html") || contentType.includes("javascript")) {
        body = body.replaceAll("window.location", `window.${CONFIG.REPLACE_URL_OBJ}`);
        body = body.replaceAll("document.location", `document.${CONFIG.REPLACE_URL_OBJ}`);
      }

      // Handle HTML content injection
      if (isHTML) {
        body = await this.injector.injectHTML(body, actualUrl.href, hasProxyHintCookie);
      } else {
        // Replace URLs in non-HTML text content
        body = this.injector.replaceURLsInText(body);
      }

      modifiedResponse = new Response(body, response);
    } else {
      modifiedResponse = new Response(response.body, response);
    }

    // Process cookies
    this.processCookies(modifiedResponse, actualUrl, isHTML, hasProxyHintCookie);

    // Remove restrictive headers
    this.removeRestrictiveHeaders(modifiedResponse, hasProxyHintCookie);

    return modifiedResponse;
  }

  /**
   * Process response cookies
   */
  processCookies(response, actualUrl, isHTML, hasProxyHintCookie) {
    const headers = response.headers;
    const cookieHeaders = [];

    // Collect all Set-Cookie headers
    for (let [key, value] of headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        cookieHeaders.push({ headerName: key, headerValue: value });
      }
    }

    // Modify cookies
    cookieHeaders.forEach(cookieHeader => {
      let cookies = cookieHeader.headerValue.split(',').map(cookie => cookie.trim());

      for (let i = 0; i < cookies.length; i++) {
        let parts = cookies[i].split(';').map(part => part.trim());

        // Modify Path
        let pathIndex = parts.findIndex(part => part.toLowerCase().startsWith('path='));
        let originalPath = '/';
        if (pathIndex !== -1) {
          originalPath = parts[pathIndex].substring("path=".length);
        }
        
        let absolutePath = "/" + new URL(originalPath, actualUrl.href).href;

        if (pathIndex !== -1) {
          parts[pathIndex] = `Path=${absolutePath}`;
        } else {
          parts.push(`Path=${absolutePath}`);
        }

        // Modify Domain
        let domainIndex = parts.findIndex(part => part.toLowerCase().startsWith('domain='));
        if (domainIndex !== -1) {
          parts[domainIndex] = `domain=${globalThis.thisProxyServerUrl_hostOnly}`;
        } else {
          parts.push(`domain=${globalThis.thisProxyServerUrl_hostOnly}`);
        }

        cookies[i] = parts.join('; ');
      }

      headers.set(cookieHeader.headerName, cookies.join(', '));
    });

    // Add tracking cookies for HTML responses
    if (isHTML && response.status === 200) {
      const lastVisitCookie = `${CONFIG.LAST_VISIT_COOKIE_NAME}=${actualUrl.origin}; Path=/; Domain=${globalThis.thisProxyServerUrl_hostOnly}`;
      headers.append("Set-Cookie", lastVisitCookie);

      // Add proxy hint cookie if not already set
      if (!hasProxyHintCookie) {
        const expiryDate = new Date();
        expiryDate.setTime(expiryDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        const hintCookie = `${CONFIG.PROXY_HINT_COOKIE_NAME}=1; expires=${expiryDate.toUTCString()}; path=/`;
        headers.append("Set-Cookie", hintCookie);
      }
    }
  }

  /**
   * Remove restrictive security headers
   */
  removeRestrictiveHeaders(response, hasProxyHintCookie) {
    const headers = response.headers;
    
    // Set permissive CORS
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set("X-Frame-Options", "ALLOWALL");

    // Remove security policy headers
    const restrictiveHeaders = [
      "Content-Security-Policy", 
      "Permissions-Policy", 
      "Cross-Origin-Embedder-Policy", 
      "Cross-Origin-Resource-Policy"
    ];

    restrictiveHeaders.forEach(header => {
      headers.delete(header);
      headers.delete(header + "-Report-Only");
    });

    // Force no-cache for first-time visitors
    if (!hasProxyHintCookie) {
      headers.set("Cache-Control", "max-age=0");
    }

    // Add enhanced proxy headers
    Object.entries(getUnrestrictedCorsHeaders()).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
}
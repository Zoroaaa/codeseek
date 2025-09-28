// Content Injection Handler - Page and Script Injection Logic
// Handles HTML content injection and URL rewriting

import { CONFIG } from './config.js';

export class ContentInjector {
  constructor() {
    this.proxyHintInjection = this.generateProxyHintScript();
    this.httpRequestInjection = this.generateHttpRequestScript();
    this.htmlPathInject = this.generateHtmlPathScript();
  }

  /**
   * Inject scripts and modify HTML content
   * @param {string} body - HTML body content
   * @param {string} actualUrl - Actual URL being proxied
   * @param {boolean} hasProxyHintCookie - Whether proxy hint cookie exists
   * @returns {string} Modified HTML content
   */
  async injectHTML(body, actualUrl, hasProxyHintCookie) {
    try {
      // Handle BOM if present
      let hasBom = false;
      if (body.charCodeAt(0) === 0xFEFF) {
        body = body.substring(1);
        hasBom = true;
      }

      // Encode original body for injection
      const encodedBody = new TextEncoder().encode(body);
      const bodyArray = Array.from(encodedBody).join(',');

      // Generate injection script
      const injectionScript = `
<!DOCTYPE html>
<script>
(function () {
  // Proxy hint injection
  ${(!hasProxyHintCookie) ? this.proxyHintInjection : ""}
})();

(function () {
  // HTTP request hooks and path conversion - Must be before convert path functions
  ${this.httpRequestInjection}

  // HTML path conversion functions
  ${this.htmlPathInject}

  // Original body data
  const originalBodyBase64Encoded = "${bodyArray}";
  const bytes = new Uint8Array(originalBodyBase64Encoded.split(',').map(Number));

  if (window.${CONFIG.DEBUG_MODE}) {
    console.log('%c' + 'Debug code start', 'color: blue; font-size: 15px;');
    console.log('%c' + new TextDecoder().decode(bytes), 'color: green; font-size: 10px; padding:5px;');
    console.log('%c' + 'Debug code end', 'color: blue; font-size: 15px;');
  }

  // Execute HTML injection
  ${CONFIG.HTML_INJECT_FUNC_NAME}(new TextDecoder().decode(bytes));
})();
</script>
`;

      return (hasBom ? "\uFEFF" : "") + injectionScript;
    } catch (error) {
      console.error('HTML injection error:', error);
      return body; // Return original content on error
    }
  }

  /**
   * Replace URLs in non-HTML text content
   * @param {string} content - Text content
   * @returns {string} Modified content with replaced URLs
   */
  replaceURLsInText(content) {
    try {
      // Regex to match URLs not already in src/href attributes
      const urlRegex = new RegExp(`(?<!src="|href=")(https?:\\/\\/[^\\s'"]+)`, 'g');
      
      return content.replaceAll(urlRegex, (match) => {
        if (match.startsWith("http")) {
          return `${globalThis.thisProxyServerUrlHttps}${match}`;
        } else {
          return `${globalThis.thisProxyServerUrl_hostOnly}/${match}`;
        }
      });
    } catch (error) {
      console.error('URL replacement error:', error);
      return content;
    }
  }

  /**
   * Generate proxy hint injection script
   * @returns {string} Proxy hint script
   */
  generateProxyHintScript() {
    return `
function toEntities(str) {
  return str.split("").map(ch => \`&#\${ch.charCodeAt(0)};\`).join("");
}

// Proxy warning hint injection
setTimeout(() => {
  var hint = \`Warning: You are currently using a web proxy, so do not log in to any website. Click to close this hint.
警告：您当前正在使用网络代理，请勿登录任何网站。点击关闭此提示。\`;

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    document.body.insertAdjacentHTML(
      'afterbegin', 
      \`<div style="position:fixed;left:0px;top:0px;width:100%;margin:0px;padding:0px;display:block;z-index:99999999999999999999999;user-select:none;cursor:pointer;" id="__PROXY_HINT_DIV__" onclick="document.getElementById('__PROXY_HINT_DIV__').remove();">
        <span style="position:relative;display:block;width:calc(100% - 20px);min-height:30px;font-size:14px;color:yellow;background:rgb(180,0,0);text-align:center;border-radius:5px;padding-left:10px;padding-right:10px;padding-top:1px;padding-bottom:1px;">
          \${toEntities(hint)}
          <br>
          <a href="https://github.com/1234567Yang/cf-proxy-ex/" style="color:rgb(250,250,180);">Enhanced Proxy Worker</a>
        </span>
      </div>\`
    );
  } else {
    alert(hint + " Enhanced Proxy Worker");
  }
}, ${CONFIG.PROXY_HINT_DELAY});
`;
  }

  /**
   * Generate HTTP request injection script
   * @returns {string} HTTP request hook script
   */
  generateHttpRequestScript() {
    return `
// Proxy server information
var nowURL = new URL(window.location.href);
var proxy_host = nowURL.host;
var proxy_protocol = nowURL.protocol;
var proxy_host_with_schema = proxy_protocol + "//" + proxy_host + "/";
var original_website_url_str = window.location.href.substring(proxy_host_with_schema.length);
var original_website_url = new URL(original_website_url_str);
var original_website_host = original_website_url_str.substring(original_website_url_str.indexOf("://") + "://".length);
original_website_host = original_website_host.split('/')[0];
var original_website_host_with_schema = original_website_url_str.substring(0, original_website_url_str.indexOf("://")) + "://" + original_website_host + "/";

// URL conversion utilities
function changeURL(relativePath) {
  if (relativePath == null) return null;
  
  try {
    if (relativePath.startsWith("data:") || relativePath.startsWith("mailto:") || 
        relativePath.startsWith("javascript:") || relativePath.startsWith("chrome") || 
        relativePath.startsWith("edge")) {
      return relativePath;
    }
  } catch {
    console.log("Change URL Error:", relativePath, typeof relativePath);
    return relativePath;
  }

  var pathAfterAdd = "";
  if (relativePath.startsWith("blob:")) {
    pathAfterAdd = "blob:";
    relativePath = relativePath.substring("blob:".length);
  }

  try {
    // Remove proxy URLs from relative path
    if (relativePath.startsWith(proxy_host_with_schema)) {
      relativePath = relativePath.substring(proxy_host_with_schema.length);
    }
    if (relativePath.startsWith(proxy_host + "/")) {
      relativePath = relativePath.substring(proxy_host.length + 1);
    }
    if (relativePath.startsWith(proxy_host)) {
      relativePath = relativePath.substring(proxy_host.length);
    }
  } catch {
    // Ignore errors
  }

  try {
    var absolutePath = new URL(relativePath, original_website_url_str).href;
    
    // Replace current location references
    absolutePath = absolutePath.replaceAll(window.location.href, original_website_url_str);
    absolutePath = absolutePath.replaceAll(encodeURI(window.location.href), encodeURI(original_website_url_str));
    absolutePath = absolutePath.replaceAll(encodeURIComponent(window.location.href), encodeURIComponent(original_website_url_str));
    
    // Replace proxy host references
    absolutePath = absolutePath.replaceAll(proxy_host, original_website_host);
    absolutePath = absolutePath.replaceAll(encodeURI(proxy_host), encodeURI(original_website_host));
    absolutePath = absolutePath.replaceAll(encodeURIComponent(proxy_host), encodeURIComponent(original_website_host));
    
    absolutePath = proxy_host_with_schema + absolutePath;
    absolutePath = pathAfterAdd + absolutePath;
    
    return absolutePath;
  } catch (e) {
    console.log("Exception occurred: " + e.message + " " + original_website_url_str + " " + relativePath);
    return relativePath;
  }
}

function getOriginalUrl(url) {
  if (url == null) return null;
  if (url.startsWith(proxy_host_with_schema)) {
    return url.substring(proxy_host_with_schema.length);
  }
  return url;
}

// Network request injection
function networkInject() {
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalFetch = window.fetch;
  
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    console.log("XHR Original:", url);
    url = changeURL(url);
    console.log("XHR Rewritten:", url);
    return originalOpen.apply(this, arguments);
  };

  window.fetch = function(input, init) {
    var url;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = input;
    }

    url = changeURL(url);
    console.log("Fetch Rewritten:", url);
    
    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else {
      const newRequest = new Request(url, input);
      return originalFetch(newRequest, init);
    }
  };
  
  console.log("Network request methods injected");
}

// Window.open injection
function windowOpenInject() {
  const originalOpen = window.open;
  window.open = function (url, name, specs) {
    let modifiedUrl = changeURL(url);
    return originalOpen.call(window, modifiedUrl, name, specs);
  };
  console.log("Window.open injected");
}

// DOM appendChild injection
function appendChildInject() {
  const originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function(child) {
    try {
      if (child.src) child.src = changeURL(child.src);
      if (child.href) child.href = changeURL(child.href);
    } catch {
      // Ignore errors
    }
    return originalAppendChild.call(this, child);
  };
  console.log("appendChild injected");
}

// Element property injection
function elementPropertyInject() {
  const originalSetAttribute = HTMLElement.prototype.setAttribute;
  HTMLElement.prototype.setAttribute = function (name, value) {
    if (name === "src" || name === "href") {
      value = changeURL(value);
    }
    originalSetAttribute.call(this, name, value);
  };

  const originalGetAttribute = HTMLElement.prototype.getAttribute;
  HTMLElement.prototype.getAttribute = function (name) {
    const val = originalGetAttribute.call(this, name);
    if (name === "href" || name === "src") {
      return getOriginalUrl(val);
    }
    return val;
  };

  // Handle anchor href property
  const descriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href');
  Object.defineProperty(HTMLAnchorElement.prototype, 'href', {
    get: function () {
      const real = descriptor.get.call(this);
      return getOriginalUrl(real);
    },
    set: function (val) {
      descriptor.set.call(this, changeURL(val));
    },
    configurable: true
  });

  console.log("Element properties injected");
}

// Location object proxy
class ProxyLocation {
  constructor(originalLocation) {
    this.originalLocation = originalLocation;
  }

  reload(forcedReload) {
    this.originalLocation.reload(forcedReload);
  }

  replace(url) {
    this.originalLocation.replace(changeURL(url));
  }

  assign(url) {
    this.originalLocation.assign(changeURL(url));
  }

  get href() {
    return original_website_url_str;
  }

  set href(url) {
    this.originalLocation.href = changeURL(url);
  }

  get protocol() {
    return original_website_url.protocol;
  }

  set protocol(value) {
    original_website_url.protocol = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get host() {
    return original_website_url.host;
  }

  set host(value) {
    original_website_url.host = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get hostname() {
    return original_website_url.hostname;
  }

  set hostname(value) {
    original_website_url.hostname = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get port() {
    return original_website_url.port;
  }

  set port(value) {
    original_website_url.port = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get pathname() {
    return original_website_url.pathname;
  }

  set pathname(value) {
    original_website_url.pathname = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get search() {
    return original_website_url.search;
  }

  set search(value) {
    original_website_url.search = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get hash() {
    return original_website_url.hash;
  }

  set hash(value) {
    original_website_url.hash = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get origin() {
    return original_website_url.origin;
  }

  toString() {
    return this.originalLocation.href;
  }
}

// Document location injection
function documentLocationInject() {
  Object.defineProperty(document, 'URL', {
    get: function () {
      return original_website_url_str;
    },
    set: function (url) {
      document.URL = changeURL(url);
    }
  });

  Object.defineProperty(document, '${CONFIG.REPLACE_URL_OBJ}', {
    get: function () {
      return new ProxyLocation(window.location);
    },  
    set: function (url) {
      window.location.href = changeURL(url);
    }
  });
  console.log("Document location injected");
}

// Window location injection
function windowLocationInject() {
  Object.defineProperty(window, '${CONFIG.REPLACE_URL_OBJ}', {
    get: function () {
      return new ProxyLocation(window.location);
    },
    set: function (url) {
      window.location.href = changeURL(url);
    }
  });
  console.log("Window location injected");
}

// History API injection
function historyInject() {
  const originalPushState = History.prototype.pushState;
  const originalReplaceState = History.prototype.replaceState;

  History.prototype.pushState = function (state, title, url) {
    if (!url) return;
    
    if (url.startsWith("/" + original_website_url.href)) {
      url = url.substring(("/" + original_website_url.href).length);
    }
    if (url.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1))) {
      url = url.substring(("/" + original_website_url.href).length - 1);
    }

    var u = changeURL(url);
    return originalPushState.apply(this, [state, title, u]);
  };

  History.prototype.replaceState = function (state, title, url) {
    if (!url) return;

    let url_str = url.toString();

    if (url_str.startsWith("/" + original_website_url.href)) {
      url_str = url_str.substring(("/" + original_website_url.href).length);
    }
    if (url_str.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1))) {
      url_str = url_str.substring(("/" + original_website_url.href).length - 1);
    }

    if (url_str.startsWith("/" + original_website_url.href.replace("://", ":/"))) {
      url_str = url_str.substring(("/" + original_website_url.href.replace("://", ":/")).length);
    }
    if (url_str.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1).replace("://", ":/"))) {
      url_str = url_str.substring(("/" + original_website_url.href).replace("://", ":/").length - 1);
    }

    var u = changeURL(url_str);
    return originalReplaceState.apply(this, [state, title, u]);
  };

  console.log("History API injected");
}

// DOM observer for dynamic content
function obsPage() {
  var proxyObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      traverseAndConvert(mutation);
    });
  });
  
  var config = { attributes: true, childList: true, subtree: true };
  proxyObserver.observe(document.body, config);
  console.log("DOM observer started");
}

function traverseAndConvert(node) {
  if (node instanceof HTMLElement) {
    removeIntegrityAttributesFromElement(node);
    convertToAbs(node);
    node.querySelectorAll('*').forEach(function(child) {
      removeIntegrityAttributesFromElement(child);
      convertToAbs(child);
    });
  }
}

function convertToAbs(element) {
  if (!(element instanceof HTMLElement)) return;
  
  if (element.hasAttribute("href")) {
    const relativePath = element.getAttribute("href");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("href", absolutePath);
    } catch (e) {
      console.log("Exception converting href:", e.message);
    }
  }

  if (element.hasAttribute("src")) {
    const relativePath = element.getAttribute("src");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("src", absolutePath);
    } catch (e) {
      console.log("Exception converting src:", e.message);
    }
  }

  if (element.tagName === "FORM" && element.hasAttribute("action")) {
    const relativePath = element.getAttribute("action");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("action", absolutePath);
    } catch (e) {
      console.log("Exception converting action:", e.message);
    }
  }

  if (element.tagName === "SOURCE" && element.hasAttribute("srcset")) {
    const relativePath = element.getAttribute("srcset");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("srcset", absolutePath);
    } catch (e) {
      console.log("Exception converting srcset:", e.message);
    }
  }

  if ((element.tagName === "VIDEO" || element.tagName === "AUDIO") && element.hasAttribute("poster")) {
    const relativePath = element.getAttribute("poster");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("poster", absolutePath);
    } catch (e) {
      console.log("Exception converting poster:", e.message);
    }
  }

  if (element.tagName === "OBJECT" && element.hasAttribute("data")) {
    const relativePath = element.getAttribute("data");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("data", absolutePath);
    } catch (e) {
      console.log("Exception converting data:", e.message);
    }
  }
}

function removeIntegrityAttributesFromElement(element) {
  if (element.hasAttribute('integrity')) {
    element.removeAttribute('integrity');
  }
}

function loopAndConvertToAbs() {
  for (var ele of document.querySelectorAll('*')) {
    removeIntegrityAttributesFromElement(ele);
    convertToAbs(ele);
  }
  console.log("Converted all existing elements");
}

function convertScripts() {
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    convertToAbs(scripts[i]);
  }
  setTimeout(convertScripts, 3000);
}

// Execute all injections
networkInject();
windowOpenInject();
elementPropertyInject();
appendChildInject();
documentLocationInject();
windowLocationInject();
historyInject();

// Setup load event handlers
window.addEventListener('load', () => {
  loopAndConvertToAbs();
  console.log("Converting script paths");
  obsPage();
  convertScripts();
});
console.log("Window load event handler added");

// Setup error event handlers
window.addEventListener('error', event => {
  var element = event.target || event.srcElement;
  if (element.tagName === 'SCRIPT') {
    console.log("Found problematic script:", element);
    if (element.alreadyChanged) {
      console.log("Script already injected, ignoring...");
      return;
    }

    removeIntegrityAttributesFromElement(element);
    convertToAbs(element);

    var newScript = document.createElement("script");
    newScript.src = element.src;
    newScript.async = element.async;
    newScript.defer = element.defer;
    newScript.alreadyChanged = true;

    document.head.appendChild(newScript);
    console.log("New script added:", newScript);
  }
}, true);
console.log("Error event handler added");
`;
  }

  /**
   * Generate HTML path injection script
   * @returns {string} HTML path injection script
   */
  generateHtmlPathScript() {
    return `
function ${CONFIG.HTML_INJECT_FUNC_NAME}(htmlString) {
  // Parse and modify HTML string
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(htmlString, 'text/html');
  
  // Process all elements
  const allElements = tempDoc.querySelectorAll('*');
  allElements.forEach(element => {
    convertToAbs(element);
    removeIntegrityAttributesFromElement(element);

    if (element.tagName === 'SCRIPT') {
      if (element.textContent && !element.src) {
        element.textContent = replaceContentPaths(element.textContent);
      }
    }
  
    if (element.tagName === 'STYLE') {
      if (element.textContent) {
        element.textContent = replaceContentPaths(element.textContent);
      }
    }
  });

  // Get modified HTML
  const modifiedHtml = tempDoc.documentElement.outerHTML;
  
  // Replace document content
  document.open();
  document.write('<!DOCTYPE html>' + modifiedHtml);
  document.close();
}

function replaceContentPaths(content) {
  // Replace URLs in content
  let regex = new RegExp(\`(?<!src="|href=")(https?:\\\\/\\\\/[^\\s'"]+)\`, 'g');
  
  content = content.replaceAll(regex, (match) => {
    if (match.startsWith("http")) {
      return proxy_host_with_schema + match;
    } else {
      return proxy_host + "/" + match;
    }
  });

  return content;
}
`;
  }
}
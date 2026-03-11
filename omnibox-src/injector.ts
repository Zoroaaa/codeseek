// 内容注入处理器 - 页面与脚本注入逻辑
// 处理 OmniBox 的 HTML 内容注入和 URL 重写

import { CONFIG } from './config.js';

export class ContentInjector {
  private proxyHintInjection: string;
  private httpRequestInjection: string;
  private htmlPathInject: string;

  constructor() {
    this.proxyHintInjection = this.generateProxyHintScript();
    this.httpRequestInjection = this.generateHttpRequestScript();
    this.htmlPathInject = this.generateHtmlPathScript();
  }

  async injectHTML(body: string, actualUrl: string, hasProxyHintCookie: boolean): Promise<string> {
    try {
      let hasBom = false;
      if (body.charCodeAt(0) === 0xFEFF) {
        body = body.substring(1);
        hasBom = true;
      }

      const encoder = new TextEncoder();
      const encodedBytes = encoder.encode(body);
      const byteArrayStr = Array.from(encodedBytes).join(',');

      const injectionScript = `
<!DOCTYPE html>
<script>
(function () {
  // OmniBox proxy hint injection
  ${(!hasProxyHintCookie) ? this.proxyHintInjection : ''}
})();

(function () {
  // HTTP request hooks and path conversion - Must be before convert path functions
  ${this.httpRequestInjection}

  // HTML path conversion functions
  ${this.htmlPathInject}

  // Original body data (byte array encoded for reliability)
  const originalBodyByteArray = "${byteArrayStr}";
  const bytes = new Uint8Array(originalBodyByteArray.split(',').map(Number));
  const decodedBody = new TextDecoder().decode(bytes);

  if (window.${CONFIG.DEBUG_MODE}) {
    console.log('%c' + 'Debug code start', 'color: blue; font-size: 15px;');
    console.log('%c' + decodedBody, 'color: green; font-size: 10px; padding:5px;');
    console.log('%c' + 'Debug code end', 'color: blue; font-size: 15px;');
  }

  // Execute HTML injection
  ${CONFIG.HTML_INJECT_FUNC_NAME}(decodedBody);
})();
</script>
`;

      return (hasBom ? '\uFEFF' : '') + injectionScript;
    } catch (error) {
      console.error('HTML injection error:', error);
      return body;
    }
  }

  replaceURLsInText(content: string): string {
    try {
      const proxyHttps = (globalThis as any).thisProxyServerUrlHttps;
      if (!proxyHttps) return content;

      // 处理绝对 URL (https:// 或 http://)
      const urlRegex = /(https?:\/\/[^\s'"]+)/g;
      content = content.replaceAll(urlRegex, (match, p1, offset, string) => {
        const before = string.substring(Math.max(0, offset - 10), offset);
        if (before.includes('src="') || before.includes('href="') ||
            before.includes('src=\'') || before.includes('href=\'')) {
          return match;
        }
        let url = match;
        while (url.length > 0) {
          const last = url[url.length - 1];
          if (last === ',' || last === '.' || last === ';' || last === ':' || last === '!' || last === '?') {
            url = url.slice(0, -1);
          } else if (last === ')' && !url.includes('(')) {
            url = url.slice(0, -1);
          } else {
            break;
          }
        }
        return `${proxyHttps}${url}`;
      });

      // 处理 CSS 中的协议相对 URL: url(//example.com/...)
      // 注意：只处理 url() 函数内的协议相对 URL
      const cssProtoRelativeRegex = /url\(\s*(['"])?(\/\/[^'")\s]+)\1\s*\)/gi;
      content = content.replaceAll(cssProtoRelativeRegex, (match, quote, urlPath) => {
        // 将协议相对 URL 转换为 https 绝对 URL，然后代理
        const absoluteUrl = `https:${urlPath}`;
        return `url(${quote || ''}${proxyHttps}${absoluteUrl}${quote || ''})`;
      });

      return content;
    } catch (error) {
      console.error('URL replacement error:', error);
      return content;
    }
  }

  private generateProxyHintScript(): string {
    return `
(function() {
  var hintDismissed = false;
  
  function createHint() {
    if (hintDismissed || document.getElementById('__omnibox_hint__')) return;
    
    var hintContainer = document.createElement('div');
    hintContainer.id = '__omnibox_hint__';
    hintContainer.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'right: 0',
      'z-index: 2147483647',
      'display: flex',
      'justify-content: center',
      'padding: 12px 16px',
      'pointer-events: none',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'animation: omniboxSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    ].join(';');
    
    var hintCard = document.createElement('div');
    hintCard.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 12px',
      'background: linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 100%)',
      'backdrop-filter: blur(12px)',
      'padding: 14px 20px',
      'border-radius: 12px',
      'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      'pointer-events: auto',
      'max-width: 600px',
      'width: 100%'
    ].join(';');
    
    var iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'font-size: 1.25rem; flex-shrink: 0;';
    iconSpan.textContent = '🛡️';
    
    var contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'flex: 1; min-width: 0;';
    
    var titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'color: #fff; font-weight: 600; font-size: 0.95rem; margin-bottom: 2px;';
    titleDiv.textContent = 'OmniBox 代理提示';
    
    var messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'color: rgba(255, 255, 255, 0.85); font-size: 0.85rem; line-height: 1.4;';
    messageDiv.textContent = '您正在使用代理服务，请勿登录重要账户或输入敏感信息';
    
    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(messageDiv);
    
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = [
      'background: rgba(255, 255, 255, 0.15)',
      'border: 1px solid rgba(255, 255, 255, 0.2)',
      'border-radius: 8px',
      'color: #fff',
      'padding: 8px 16px',
      'font-size: 0.85rem',
      'font-weight: 500',
      'cursor: pointer',
      'transition: all 0.2s ease',
      'white-space: nowrap',
      'flex-shrink: 0'
    ].join(';');
    closeBtn.textContent = '我知道了';
    closeBtn.onmouseover = function() {
      this.style.background = 'rgba(255, 255, 255, 0.25)';
    };
    closeBtn.onmouseout = function() {
      this.style.background = 'rgba(255, 255, 255, 0.15)';
    };
    closeBtn.onclick = function(e) {
      e.stopPropagation();
      hintDismissed = true;
      hintContainer.style.animation = 'omniboxSlideOut 0.3s ease forwards';
      setTimeout(function() {
        if (hintContainer.parentNode) {
          hintContainer.parentNode.removeChild(hintContainer);
        }
      }, 300);
    };
    
    hintCard.appendChild(iconSpan);
    hintCard.appendChild(contentDiv);
    hintCard.appendChild(closeBtn);
    hintContainer.appendChild(hintCard);
    
    document.body.appendChild(hintContainer);
  }
  
  function addStyles() {
    if (document.getElementById('__omnibox_hint_styles__')) return;
    
    var style = document.createElement('style');
    style.id = '__omnibox_hint_styles__';
    style.textContent = [
      '@keyframes omniboxSlideIn {',
      '  from { opacity: 0; transform: translateY(-20px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '@keyframes omniboxSlideOut {',
      '  from { opacity: 1; transform: translateY(0); }',
      '  to { opacity: 0; transform: translateY(-20px); }',
      '}'
    ].join('\\n');
    document.head.appendChild(style);
  }
  
  function init() {
    addStyles();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(createHint, 500);
      });
    } else {
      setTimeout(createHint, 500);
    }
  }
  
  init();
})();
`;
  }

  private generateHttpRequestScript(): string {
    return `
// OmniBox proxy server information
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

  var relativePath_str = "";
  if (relativePath instanceof URL) {
    relativePath_str = relativePath.href;
  } else {
    relativePath_str = relativePath.toString();
  }

  try {
    if (relativePath_str.startsWith("data:") || relativePath_str.startsWith("mailto:") || 
        relativePath_str.startsWith("javascript:") || relativePath_str.startsWith("chrome") || 
        relativePath_str.startsWith("edge")) {
      return relativePath_str;
    }
  } catch {
    if (window.DEBUG_OMNIBOX_MODE) console.log("Change URL Error:", relativePath_str, typeof relativePath_str);
    return relativePath_str;
  }

  var pathAfterAdd = "";
  if (relativePath_str.startsWith("blob:")) {
    pathAfterAdd = "blob:";
    relativePath_str = relativePath_str.substring("blob:".length);
  }

  try {
    if (relativePath_str.startsWith(proxy_host_with_schema)) {
      relativePath_str = relativePath_str.substring(proxy_host_with_schema.length);
    }
    if (relativePath_str.startsWith(proxy_host + "/")) {
      relativePath_str = relativePath_str.substring(proxy_host.length + 1);
    }
    if (relativePath_str.startsWith(proxy_host)) {
      relativePath_str = relativePath_str.substring(proxy_host.length);
    }
  } catch {
    // Ignore errors
  }

  try {
    var absolutePath = new URL(relativePath_str, original_website_url_str).href;
    
    absolutePath = absolutePath.replaceAll(window.location.href, original_website_url_str);
    absolutePath = absolutePath.replaceAll(encodeURI(window.location.href), encodeURI(original_website_url_str));
    absolutePath = absolutePath.replaceAll(encodeURIComponent(window.location.href), encodeURIComponent(original_website_url_str));
    
    absolutePath = absolutePath.replaceAll(proxy_host, original_website_host);
    absolutePath = absolutePath.replaceAll(encodeURI(proxy_host), encodeURI(original_website_host));
    absolutePath = absolutePath.replaceAll(encodeURIComponent(proxy_host), encodeURIComponent(original_website_host));
    
    absolutePath = proxy_host_with_schema + absolutePath;
    absolutePath = pathAfterAdd + absolutePath;
    
    return absolutePath;
  } catch (e) {
    if (window.DEBUG_OMNIBOX_MODE) console.log("Exception occurred: " + e.message + " " + original_website_url_str + " " + relativePath_str);
    return relativePath_str;
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
    if (window.DEBUG_OMNIBOX_MODE) console.log("XHR Original:", url);
    url = changeURL(url);
    if (window.DEBUG_OMNIBOX_MODE) console.log("XHR Rewritten:", url);
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
    if (window.DEBUG_OMNIBOX_MODE) console.log("Fetch Rewritten:", url);
    
    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else {
      const newRequest = new Request(url, input);
      return originalFetch(newRequest, init);
    }
  };
  
  if (window.DEBUG_OMNIBOX_MODE) console.log("Network request methods injected");
}

// Window.open injection
function windowOpenInject() {
  const originalOpen = window.open;
  window.open = function (url, name, specs) {
    let modifiedUrl = changeURL(url);
    return originalOpen.call(window, modifiedUrl, name, specs);
  };
  if (window.DEBUG_OMNIBOX_MODE) console.log("Window.open injected");
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
  if (window.DEBUG_OMNIBOX_MODE) console.log("appendChild injected");
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

  if (window.DEBUG_OMNIBOX_MODE) console.log("Element properties (get/set attribute) injected");

  var setList = [
    [HTMLAnchorElement, "href"],
    [HTMLScriptElement, "src"],
    [HTMLImageElement, "src"],
    [HTMLLinkElement, "href"],
    [HTMLIFrameElement, "src"],
    [HTMLVideoElement, "src"],
    [HTMLAudioElement, "src"],
    [HTMLSourceElement, "src"],
    [HTMLObjectElement, "data"],
    [HTMLFormElement, "action"],
  ];

  for (var i = 0; i < setList.length; i++) {
    var whichElement = setList[i][0];
    var whichProperty = setList[i][1];
    
    if (!whichElement || !whichElement.prototype) continue;
    var descriptor = Object.getOwnPropertyDescriptor(whichElement.prototype, whichProperty);
    if (!descriptor) continue;

    (function(desc, elem) {
      Object.defineProperty(elem.prototype, whichProperty, {
        get: function () {
          var real = desc.get.call(this);
          return getOriginalUrl(real);
        },
        set: function (val) {
          desc.set.call(this, changeURL(val));
        },
        configurable: true,
      });
    })(descriptor, whichElement);

    if (window.DEBUG_OMNIBOX_MODE) console.log("Hooked " + whichElement.name + " " + whichProperty);
  }

  if (window.DEBUG_OMNIBOX_MODE) console.log("Element properties (src/href) injected");
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
    // 返回原始站点 URL，与 get href() 保持一致，避免字符串拼接泄露代理域名
    return original_website_url_str;
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
  if (window.DEBUG_OMNIBOX_MODE) console.log("Document location injected");
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
  if (window.DEBUG_OMNIBOX_MODE) console.log("Window location injected");
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

  if (window.DEBUG_OMNIBOX_MODE) console.log("History API injected");
}

// DOM observer for dynamic content with performance optimization
function obsPage() {
  // Debounce timer for performance optimization
  var debounceTimer = null;
  var pendingMutations = [];
  
  var proxyObserver = new MutationObserver(function(mutations) {
    // Collect mutations and process with debounce
    pendingMutations = pendingMutations.concat(mutations);
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(function() {
      // Process all pending mutations at once
      pendingMutations.forEach(function(mutation) {
        // Handle attribute changes on the target element
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          traverseAndConvert(mutation.target);
        }
        // Handle newly added nodes
        mutation.addedNodes.forEach(function(node) {
          traverseAndConvert(node);
        });
      });
      pendingMutations = [];
      debounceTimer = null;
    }, 100); // 100ms debounce
  });
  
  // Optimized config: only observe relevant attributes
  var config = { 
    attributes: true, 
    childList: true, 
    subtree: true,
    attributeFilter: ['src', 'href', 'action', 'srcset', 'poster', 'data']
  };
  proxyObserver.observe(document.body, config);
  if (window.DEBUG_OMNIBOX_MODE) console.log("DOM observer started with debounce optimization");
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
      if (window.DEBUG_OMNIBOX_MODE) console.log("Exception converting href:", e.message);
    }
  }

  if (element.hasAttribute("src")) {
    const relativePath = element.getAttribute("src");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("src", absolutePath);
    } catch (e) {
      if (window.DEBUG_OMNIBOX_MODE) console.log("Exception converting src:", e.message);
    }
  }

  if (element.tagName === "FORM" && element.hasAttribute("action")) {
    const relativePath = element.getAttribute("action");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("action", absolutePath);
    } catch (e) {
      if (window.DEBUG_OMNIBOX_MODE) console.log("Exception converting action:", e.message);
    }
  }

  if (element.tagName === "SOURCE" && element.hasAttribute("srcset")) {
    const relativePath = element.getAttribute("srcset");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("srcset", absolutePath);
    } catch (e) {
      if (window.DEBUG_OMNIBOX_MODE) console.log("Exception converting srcset:", e.message);
    }
  }

  if ((element.tagName === "VIDEO" || element.tagName === "AUDIO") && element.hasAttribute("poster")) {
    const relativePath = element.getAttribute("poster");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("poster", absolutePath);
    } catch (e) {
      if (window.DEBUG_OMNIBOX_MODE) console.log("Exception converting poster:", e.message);
    }
  }

  if (element.tagName === "OBJECT" && element.hasAttribute("data")) {
    const relativePath = element.getAttribute("data");
    try {
      const absolutePath = changeURL(relativePath);
      element.setAttribute("data", absolutePath);
    } catch (e) {
      if (window.DEBUG_OMNIBOX_MODE) console.log("Exception converting data:", e.message);
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
  if (window.DEBUG_OMNIBOX_MODE) console.log("Converted all existing elements");
}

// 用 MutationObserver 监听 script 插入，替代无限递归的 setTimeout 轮询，避免内存泄漏
function watchNewScripts() {
  var scriptWatcher = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          var el = node;
          if (el.tagName === 'SCRIPT') {
            convertToAbs(el);
          }
          // 也检查新插入节点内的 script 子元素
          if (el.querySelectorAll) {
            el.querySelectorAll('script').forEach(function(s) { convertToAbs(s); });
          }
        }
      });
    });
  });
  scriptWatcher.observe(document.documentElement, { childList: true, subtree: true });
  if (window.DEBUG_OMNIBOX_MODE) console.log("Script watcher started");
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
  if (window.DEBUG_OMNIBOX_MODE) console.log("Converting script paths");
  obsPage();
  watchNewScripts();
});
if (window.DEBUG_OMNIBOX_MODE) console.log("Window load event handler added");

// Setup error event handlers
window.addEventListener('error', event => {
  var element = event.target || event.srcElement;
  if (element.tagName === 'SCRIPT') {
    if (window.DEBUG_OMNIBOX_MODE) console.log("Found problematic script:", element);
    if (element.alreadyChanged) {
      if (window.DEBUG_OMNIBOX_MODE) console.log("Script already injected, ignoring...");
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
    if (window.DEBUG_OMNIBOX_MODE) console.log("New script added:", newScript);
  }
}, true);
if (window.DEBUG_OMNIBOX_MODE) console.log("Error event handler added");
`;
  }

  private generateHtmlPathScript(): string {
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
  // Replace URLs in content using compatible regex without lookbehind
  let regex = /(https?:\\/\\/[^\\s'"]+)/g;
  
  content = content.replaceAll(regex, (match, p1, offset, string) => {
    // Check if URL is already inside src=" or href=" attribute
    const before = string.substring(Math.max(0, offset - 10), offset);
    if (before.includes('src="') || before.includes('href="')) {
      return match;
    }
    return proxy_host_with_schema + match;
  });

  return content;
}
`;
  }
}

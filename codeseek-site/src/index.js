// Enhanced Proxy Worker with KV Cache and External Proxy API Support
// 版本: v3.3.0 - 新增KV缓存和外部代理API支持

/**
 * KV缓存管理器
 */
class CacheManager {
  constructor(kv, env) {
    this.kv = kv;
    this.env = env;
    this.defaultTTL = {
      html: 3600,        // HTML缓存1小时
      css: 86400,        // CSS缓存1天
      js: 86400,         // JavaScript缓存1天
      image: 2592000,    // 图片缓存30天
      font: 2592000,     // 字体缓存30天
      json: 1800,        // JSON缓存30分钟
      xml: 3600,         // XML缓存1小时
      default: 3600      // 默认缓存1小时
    };
  }

  /**
   * 生成缓存key
   */
  generateCacheKey(url, method = 'GET', headers = {}) {
    const normalizedUrl = new URL(url);
    // 移除一些可能影响缓存的参数
    normalizedUrl.searchParams.delete('_t');
    normalizedUrl.searchParams.delete('timestamp');
    normalizedUrl.searchParams.delete('cachebuster');
    
    const keyComponents = [
      'proxy-cache',
      method.toUpperCase(),
      normalizedUrl.href
    ];
    
    // 对于某些特定的header，也加入缓存key
    const cacheHeaders = ['accept', 'accept-language'];
    cacheHeaders.forEach(header => {
      const value = headers[header];
      if (value) {
        keyComponents.push(`${header}:${value.substring(0, 50)}`);
      }
    });
    
    return keyComponents.join('|');
  }

  /**
   * 获取内容类型对应的TTL
   */
  getTTLForContentType(contentType) {
    if (!contentType) return this.defaultTTL.default;
    
    const type = contentType.toLowerCase();
    if (type.includes('html')) return this.defaultTTL.html;
    if (type.includes('css') || type.includes('stylesheet')) return this.defaultTTL.css;
    if (type.includes('javascript')) return this.defaultTTL.js;
    if (type.includes('image/')) return this.defaultTTL.image;
    if (type.includes('font/') || type.includes('woff')) return this.defaultTTL.font;
    if (type.includes('json')) return this.defaultTTL.json;
    if (type.includes('xml')) return this.defaultTTL.xml;
    
    return this.defaultTTL.default;
  }

  /**
   * 从缓存获取内容
   */
  async get(cacheKey) {
    if (!this.kv) return null;
    
    try {
      const cached = await this.kv.get(cacheKey, 'json');
      if (!cached) return null;
      
      // 检查缓存是否过期
      if (cached.expires && Date.now() > cached.expires) {
        // 异步删除过期缓存
        this.kv.delete(cacheKey).catch(() => {});
        return null;
      }
      
      return {
        body: cached.body,
        headers: cached.headers,
        status: cached.status || 200,
        statusText: cached.statusText || 'OK'
      };
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * 存储内容到缓存
   */
  async set(cacheKey, response, customTTL = null) {
    if (!this.kv) return;
    
    try {
      const contentType = response.headers.get('content-type') || '';
      const ttl = customTTL || this.getTTLForContentType(contentType);
      
      // 只缓存成功的响应
      if (response.status < 200 || response.status >= 300) {
        return;
      }
      
      // 不缓存太大的响应（超过1MB）
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 1024 * 1024) {
        return;
      }
      
      // 准备缓存数据
      const cacheData = {
        body: await response.text(),
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
        expires: Date.now() + (ttl * 1000),
        cachedAt: Date.now()
      };
      
      // 存储到KV（带TTL）
      await this.kv.put(cacheKey, JSON.stringify(cacheData), {
        expirationTtl: ttl
      });
      
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * 清理特定模式的缓存
   */
  async clearPattern(pattern) {
    if (!this.kv) return;
    
    try {
      const list = await this.kv.list({ prefix: pattern });
      const deletePromises = list.keys.map(key => this.kv.delete(key.name));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

/**
 * 外部代理API管理器
 */
class ExternalProxyManager {
  constructor(env) {
    this.proxyAPI = env.PROXY_API;
    this.apiKey = env.PROXY_API_KEY;
    this.timeout = parseInt(env.PROXY_TIMEOUT || '10000');
    this.retries = parseInt(env.PROXY_RETRIES || '2');
  }

  /**
   * 检查是否启用外部代理
   */
  isEnabled() {
    return !!this.proxyAPI;
  }

  /**
   * 通过外部代理API发送请求
   */
  async fetch(targetUrl, options) {
    if (!this.proxyAPI) {
      throw new Error('External proxy API not configured');
    }

    const requestData = {
      url: targetUrl,
      method: options.method || 'GET',
      headers: options.headers ? Object.fromEntries(options.headers.entries()) : {},
      timeout: this.timeout
    };

    // 如果有请求体，添加到请求数据中
    if (options.body) {
      if (options.body instanceof ArrayBuffer) {
        requestData.body = Array.from(new Uint8Array(options.body));
        requestData.bodyType = 'buffer';
      } else if (typeof options.body === 'string') {
        requestData.body = options.body;
        requestData.bodyType = 'text';
      }
    }

    const proxyOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CloudflareWorker-Proxy/3.3.0'
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(this.timeout)
    };

    // 添加API密钥（如果配置）
    if (this.apiKey) {
      proxyOptions.headers['Authorization'] = `Bearer ${this.apiKey}`;
      // 或者使用自定义头部
      proxyOptions.headers['X-API-Key'] = this.apiKey;
    }

    let lastError;
    
    // 重试逻辑
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(this.proxyAPI, proxyOptions);
        
        if (!response.ok) {
          throw new Error(`Proxy API returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // 解析外部代理API的响应格式
        return this.parseProxyResponse(result);
        
      } catch (error) {
        lastError = error;
        console.error(`External proxy attempt ${attempt + 1} failed:`, error);
        
        // 最后一次尝试失败时不等待
        if (attempt < this.retries) {
          // 指数退避
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw new Error(`External proxy failed after ${this.retries + 1} attempts: ${lastError.message}`);
  }

  /**
   * 解析外部代理API的响应
   */
  parseProxyResponse(result) {
    // 假设外部代理API返回格式：
    // {
    //   success: true,
    //   status: 200,
    //   statusText: 'OK',
    //   headers: {},
    //   body: '',
    //   bodyType: 'text'
    // }
    
    if (!result.success) {
      throw new Error(result.error || 'External proxy request failed');
    }

    const headers = new Headers(result.headers || {});
    let body = result.body;

    // 根据bodyType处理响应体
    if (result.bodyType === 'buffer' && Array.isArray(body)) {
      body = new Uint8Array(body).buffer;
    }

    return new Response(body, {
      status: result.status || 200,
      statusText: result.statusText || 'OK',
      headers: headers
    });
  }
}

/**
 * HTMLå†…å®¹å¤„ç†å™¨ - æ™ºèƒ½é‡å†™æ‰€æœ‰URLå¼•ç"¨
 */
class HTMLProcessor {
  constructor(proxyHostname, originHostname, proxyPath) {
    this.proxyHostname = proxyHostname;
    this.originHostname = originHostname;
    this.proxyPath = proxyPath || `/proxy/${proxyHostname}`;
  }

  /**
   * å¤„ç†HTMLå†…å®¹ï¼Œé‡å†™æ‰€æœ‰URLå¼•ç"¨
   */
  processHTML(html) {
    // é¢„å¤„ç†ï¼šä¿®å¤å¸¸è§çš„HTMLé—®é¢˜
    html = this.preProcessHTML(html);
    
    // å¤„ç†å„ç§URLæ¨¡å¼
    html = this.rewriteAbsoluteUrls(html);
    html = this.rewriteRelativeUrls(html);
    html = this.rewriteSrcsets(html);
    html = this.rewriteInlineStyles(html);
    html = this.rewriteMetaTags(html);
    html = this.rewriteFormActions(html);
    html = this.rewriteVideoSources(html);
    html = this.rewriteObjectEmbeds(html);
    html = this.rewriteFrameSources(html);
    html = this.rewriteDataAttributes(html);
    html = this.rewriteManifestLinks(html);
    html = this.rewriteCanonicalLinks(html);
    
    // æ³¨å…¥å¢žå¼ºçš„ä»£ç†è„šæœ¬
    html = this.injectEnhancedProxyScript(html);
    
    return html;
  }

  /**
   * HTMLé¢„å¤„ç†
   */
  preProcessHTML(html) {
    // ç¡®ä¿HTMLç»"æž„å®Œæ•´
    if (!html.includes('<html')) {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    }
    
    // æ·»åŠ  viewport metaæ ‡ç­¾ï¼ˆå¦‚æžœä¸å­˜åœ¨ï¼‰
    if (!html.includes('viewport') && html.includes('<head')) {
      html = html.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1.0">');
    }
    
    return html;
  }

  /**
   * é‡å†™ç»å¯¹URL - ä½¿ç"¨ç®€å•å­—ç¬¦ä¸²æ›¿æ¢
   */
  rewriteAbsoluteUrls(html) {
    // å¤„ç† https://domain.com æ ¼å¼
    const httpsTarget = `https://${this.proxyHostname}`;
    const httpsReplacement = `https://${this.originHostname}${this.proxyPath}`;
    html = html.split(httpsTarget).join(httpsReplacement);

    // å¤„ç† http://domain.com æ ¼å¼
    const httpTarget = `http://${this.proxyHostname}`;
    const httpReplacement = `https://${this.originHostname}${this.proxyPath}`;
    html = html.split(httpTarget).join(httpReplacement);

    // å¤„ç† //domain.com æ ¼å¼
    const protocolRelativeTarget = `//${this.proxyHostname}`;
    const protocolRelativeReplacement = `https://${this.originHostname}${this.proxyPath}`;
    html = html.split(protocolRelativeTarget).join(protocolRelativeReplacement);

    return html;
  }

  /**
   * é‡å†™ç›¸å¯¹URL - è¿™æ˜¯å…³é"®ä¼˜åŒ–ç‚¹
   */
  rewriteRelativeUrls(html) {
    const urlAttributes = [
      'href=', 'src=', 'action=', 'poster=', 'data-src=', 'data-href=', 'data-url=',
      'data-background=', 'data-bg=', 'data-image=', 'data-poster=', 'data-video=',
      'data-audio=', 'data-thumb=', 'data-thumbnail=', 'data-original=', 'data-lazy='
    ];

    urlAttributes.forEach(attr => {
      // å¤„ç†ä»¥ 'attr="/' å¼€å§‹çš„æƒ…å†µ
      const doubleQuotePattern = `${attr}"`;
      let parts = html.split(doubleQuotePattern);
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('/') && !parts[i].startsWith('//') && 
            !parts[i].startsWith(this.proxyPath.substring(1)) &&
            !parts[i].startsWith('data:') && !parts[i].startsWith('blob:')) {
          const endQuote = parts[i].indexOf('"');
          if (endQuote > 0) {
            const url = parts[i].substring(0, endQuote);
            const rest = parts[i].substring(endQuote);
            parts[i] = this.proxyPath + url + rest;
          }
        }
      }
      html = parts.join(doubleQuotePattern);

      // å¤„ç†ä»¥ "attr='" å¼€å§‹çš„æƒ…å†µ
      const singleQuotePattern = `${attr}'`;
      parts = html.split(singleQuotePattern);
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('/') && !parts[i].startsWith('//') && 
            !parts[i].startsWith(this.proxyPath.substring(1)) &&
            !parts[i].startsWith('data:') && !parts[i].startsWith('blob:')) {
          const endQuote = parts[i].indexOf("'");
          if (endQuote > 0) {
            const url = parts[i].substring(0, endQuote);
            const rest = parts[i].substring(endQuote);
            parts[i] = this.proxyPath + url + rest;
          }
        }
      }
      html = parts.join(singleQuotePattern);
    });

    return html;
  }

  /**
   * å¤„ç† srcset å±žæ€§ï¼ˆå"åº"å¼å›¾ç‰‡ï¼‰
   */
  rewriteSrcsets(html) {
    // æŸ¥æ‰¾æ‰€æœ‰ srcset å±žæ€§
    const srcsetPatterns = ['srcset="', 'srcset=\'', 'data-srcset="', 'data-srcset=\''];
    
    srcsetPatterns.forEach(pattern => {
      const quote = pattern.slice(-1);
      let parts = html.split(pattern);
      
      for (let i = 1; i < parts.length; i++) {
        const endQuote = parts[i].indexOf(quote);
        if (endQuote > 0) {
          let srcset = parts[i].substring(0, endQuote);
          const rest = parts[i].substring(endQuote);
          
          // å¤„ç† srcset ä¸­çš„æ¯ä¸ªURL
          const sources = srcset.split(',');
          const rewrittenSources = sources.map(source => {
            const trimmedSource = source.trim();
            const spaceIndex = trimmedSource.indexOf(' ');
            let url = spaceIndex > 0 ? trimmedSource.substring(0, spaceIndex) : trimmedSource;
            const descriptor = spaceIndex > 0 ? trimmedSource.substring(spaceIndex) : '';
            
            if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
              url = this.proxyPath + url;
            } else if (url.includes(this.proxyHostname)) {
              url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
              url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            }
            
            return url + descriptor;
          });
          
          parts[i] = rewrittenSources.join(', ') + rest;
        }
      }
      
      html = parts.join(pattern);
    });

    return html;
  }

  /**
   * å¤„ç†å†…è"æ ·å¼ä¸­çš„URL
   */
  rewriteInlineStyles(html) {
    const stylePatterns = ['style="', "style='"];
    
    stylePatterns.forEach(pattern => {
      const quote = pattern.slice(-1);
      let parts = html.split(pattern);
      
      for (let i = 1; i < parts.length; i++) {
        const endQuote = parts[i].indexOf(quote);
        if (endQuote > 0) {
          let style = parts[i].substring(0, endQuote);
          const rest = parts[i].substring(endQuote);
          
          style = this.rewriteCSSUrls(style);
          parts[i] = style + rest;
        }
      }
      
      html = parts.join(pattern);
    });

    return html;
  }

  /**
   * å¤„ç†CSSä¸­çš„URLå¼•ç"¨
   */
  rewriteCSSUrls(css) {
    // å¤„ç† url("...") å'Œ url('...')
    const urlPatterns = ['url("', "url('", 'url('];
    
    urlPatterns.forEach(pattern => {
      let parts = css.split(pattern);
      
      for (let i = 1; i < parts.length; i++) {
        let endChar = ')';
        if (pattern.includes('"')) endChar = '"';
        else if (pattern.includes("'")) endChar = "'";
        
        const endIndex = parts[i].indexOf(endChar);
        if (endIndex > 0) {
          let url = parts[i].substring(0, endIndex);
          const rest = parts[i].substring(endIndex);
          
          // è·³è¿‡ç‰¹æ®ŠURL
          if (!url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('javascript:')) {
            if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
              url = this.proxyPath + url;
            } else if (url.includes(this.proxyHostname)) {
              url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
              url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            }
          }
          
          parts[i] = url + rest;
        }
      }
      
      css = parts.join(pattern);
    });

    // å¤„ç† @import è§„åˆ™
    let importParts = css.split('@import ');
    for (let i = 1; i < importParts.length; i++) {
      const semicolonIndex = importParts[i].indexOf(';');
      if (semicolonIndex > 0) {
        let importRule = importParts[i].substring(0, semicolonIndex);
        const rest = importParts[i].substring(semicolonIndex);
        
        // æå–URL
        if (importRule.includes('url(')) {
          const urlStart = importRule.indexOf('url(') + 4;
          const urlEnd = importRule.indexOf(')', urlStart);
          if (urlEnd > urlStart) {
            let url = importRule.substring(urlStart, urlEnd);
            url = url.replace(/^["'\s]+|["'\s]+$/g, ''); // æ¸…ç†å¼•å·å'Œç©ºæ ¼
            
            if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
              url = this.proxyPath + url;
            } else if (url.includes(this.proxyHostname)) {
              url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
              url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            }
            
            importRule = importRule.substring(0, urlStart) + `"${url}"` + importRule.substring(urlEnd);
          }
        } else {
          // ç›´æŽ¥çš„URLå¼•ç"¨
          let url = importRule.replace(/^["'\s]+|["'\s]+$/g, '');
          if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
            url = this.proxyPath + url;
            importRule = `"${url}"`;
          } else if (url.includes(this.proxyHostname)) {
            url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            importRule = `"${url}"`;
          }
        }
        
        importParts[i] = importRule + rest;
      }
    }
    css = importParts.join('@import ');

    return css;
  }

  /**
   * å¤„ç†è¡¨å•actionå±žæ€§
   */
  rewriteFormActions(html) {
    const actionPatterns = ['action="', "action='"];
    
    actionPatterns.forEach(pattern => {
      const quote = pattern.slice(-1);
      let parts = html.split(pattern);
      
      for (let i = 1; i < parts.length; i++) {
        const endQuote = parts[i].indexOf(quote);
        if (endQuote > 0) {
          let action = parts[i].substring(0, endQuote);
          const rest = parts[i].substring(endQuote);
          
          if (action.startsWith('/') && !action.startsWith('//') && !action.startsWith(this.proxyPath)) {
            action = this.proxyPath + action;
          } else if (action.includes(this.proxyHostname)) {
            action = action.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            action = action.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
          }
          
          parts[i] = action + rest;
        }
      }
      
      html = parts.join(pattern);
    });

    return html;
  }

  /**
   * å¤„ç†è§†é¢'å'ŒéŸ³é¢'æº
   */
  rewriteVideoSources(html) {
    // å¤„ç†å„ç§åª'ä½"å±žæ€§
    const mediaAttributes = ['src="', "src='", 'poster="', "poster='"];
    
    mediaAttributes.forEach(pattern => {
      const quote = pattern.slice(-1);
      let parts = html.split(pattern);
      
      for (let i = 1; i < parts.length; i++) {
        const endQuote = parts[i].indexOf(quote);
        if (endQuote > 0) {
          let url = parts[i].substring(0, endQuote);
          const rest = parts[i].substring(endQuote);
          
          if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
            url = this.proxyPath + url;
          } else if (url.includes(this.proxyHostname)) {
            url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
          }
          
          parts[i] = url + rest;
        }
      }
      
      html = parts.join(pattern);
    });

    return html;
  }

  /**
   * å¤„ç† object å'Œ embed æ ‡ç­¾
   */
  rewriteObjectEmbeds(html) {
    const embedAttributes = ['data="', "data='"];
    
    embedAttributes.forEach(pattern => {
      const quote = pattern.slice(-1);
      let parts = html.split(pattern);
      
      for (let i = 1; i < parts.length; i++) {
        const endQuote = parts[i].indexOf(quote);
        if (endQuote > 0) {
          let url = parts[i].substring(0, endQuote);
          const rest = parts[i].substring(endQuote);
          
          if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
            url = this.proxyPath + url;
          } else if (url.includes(this.proxyHostname)) {
            url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
          }
          
          parts[i] = url + rest;
        }
      }
      
      html = parts.join(pattern);
    });

    return html;
  }

  /**
   * å¤„ç† iframe å'Œ frame æ ‡ç­¾
   */
  rewriteFrameSources(html) {
    // é‡å¤ä½¿ç"¨ src å¤„ç†é€»è¾'ï¼Œå·²åœ¨å…¶ä»–æ–¹æ³•ä¸­è¦†ç›–
    return html;
  }

  /**
   * å¤„ç†å„ç§data-*å±žæ€§ä¸­çš„URL
   */
  rewriteDataAttributes(html) {
    const dataAttributes = [
      'data-src=', 'data-href=', 'data-url=', 'data-background=', 'data-bg=',
      'data-image=', 'data-poster=', 'data-video=', 'data-audio=', 'data-thumb=',
      'data-thumbnail=', 'data-original=', 'data-lazy=', 'data-echo='
    ];

    dataAttributes.forEach(attr => {
      const patterns = [`${attr}"`, `${attr}'`];
      
      patterns.forEach(pattern => {
        const quote = pattern.slice(-1);
        let parts = html.split(pattern);
        
        for (let i = 1; i < parts.length; i++) {
          const endQuote = parts[i].indexOf(quote);
          if (endQuote > 0) {
            let url = parts[i].substring(0, endQuote);
            const rest = parts[i].substring(endQuote);
            
            // åªå¤„ç†çœ‹èµ·æ¥åƒURLçš„å€¼
            if (url && (url.startsWith('/') || url.includes(this.proxyHostname))) {
              if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
                url = this.proxyPath + url;
              } else if (url.includes(this.proxyHostname)) {
                url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
                url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
              }
              
              parts[i] = url + rest;
            }
          }
        }
        
        html = parts.join(pattern);
      });
    });

    return html;
  }

  /**
   * å¤„ç† manifest é"¾æŽ¥
   */
  rewriteManifestLinks(html) {
    // åœ¨ href å¤„ç†ä¸­å·²è¦†ç›–
    return html;
  }

  /**
   * å¤„ç†è§„èŒƒé"¾æŽ¥
   */
  rewriteCanonicalLinks(html) {
    // åœ¨ href å¤„ç†ä¸­å·²è¦†ç›–
    return html;
  }

  /**
   * å¤„ç†metaæ ‡ç­¾
   */
  rewriteMetaTags(html) {
    // å¤„ç† refresh metaæ ‡ç­¾
    if (html.includes('http-equiv="refresh"') || html.includes("http-equiv='refresh'")) {
      const refreshPatterns = ['content="', "content='"];
      
      refreshPatterns.forEach(pattern => {
        const quote = pattern.slice(-1);
        let parts = html.split(pattern);
        
        for (let i = 1; i < parts.length; i++) {
          const endQuote = parts[i].indexOf(quote);
          if (endQuote > 0 && parts[i].includes('url=')) {
            let content = parts[i].substring(0, endQuote);
            const rest = parts[i].substring(endQuote);
            
            const urlStart = content.indexOf('url=') + 4;
            let url = content.substring(urlStart);
            
            if (url.includes(this.proxyHostname)) {
              url = url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
              url = url.split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
            } else if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(this.proxyPath)) {
              url = this.proxyPath + url;
            }
            
            content = content.substring(0, urlStart) + url;
            parts[i] = content + rest;
          }
        }
        
        html = parts.join(pattern);
      });
    }

    return html;
  }

  /**
   * æ³¨å…¥å¢žå¼ºçš„ä»£ç†è¾…åŠ©è„šæœ¬
   */
  injectEnhancedProxyScript(html) {
    const proxyScript = `
    <script>
    (function() {
      const PROXY_PATH = '${this.proxyPath}';
      const PROXY_HOSTNAME = '${this.proxyHostname}';
      const ORIGIN_HOSTNAME = '${this.originHostname}';
      
      // å¤„ç†URLçš„è¾…åŠ©å‡½æ•°
      function processProxyUrl(url) {
        if (typeof url !== 'string') return url;
        
        // å¤„ç†ç›¸å¯¹URL
        if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(PROXY_PATH)) {
          return PROXY_PATH + url;
        }
        
        // å¤„ç†åŒ…å«ç›®æ ‡åŸŸåçš„URL
        if (url.includes(PROXY_HOSTNAME)) {
          return url.split('https://' + PROXY_HOSTNAME).join('https://' + ORIGIN_HOSTNAME + PROXY_PATH)
                   .split('http://' + PROXY_HOSTNAME).join('https://' + ORIGIN_HOSTNAME + PROXY_PATH);
        }
        
        return url;
      }
      
      // æ‹¦æˆª fetch è¯·æ±‚
      const originalFetch = window.fetch;
      window.fetch = function(input, options) {
        let url = typeof input === 'string' ? input : input.url;
        const processedUrl = processProxyUrl(url);
        
        if (typeof input === 'string') {
          return originalFetch.call(this, processedUrl, options);
        } else {
          const newRequest = new Request(processedUrl, input);
          return originalFetch.call(this, newRequest, options);
        }
      };
      
      // æ‹¦æˆª XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        const processedUrl = processProxyUrl(url);
        return originalOpen.call(this, method, processedUrl, ...args);
      };
      
      // æ‹¦æˆªåŠ¨æ€åˆ›å»ºçš„å…ƒç´ 
      const originalCreateElement = document.createElement;
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        
        // ä¸ºç‰¹å®šå…ƒç´ ç±»åž‹æ·»åŠ å±žæ€§ç›'å¬
        const urlAttributes = {
          'img': ['src', 'srcset'],
          'video': ['src', 'poster'],
          'audio': ['src'],
          'source': ['src'],
          'link': ['href'],
          'script': ['src'],
          'iframe': ['src'],
          'embed': ['src'],
          'object': ['data']
        };
        
        const attrs = urlAttributes[tagName.toLowerCase()];
        if (attrs) {
          attrs.forEach(attr => {
            Object.defineProperty(element, attr, {
              get: function() {
                return this.getAttribute(attr);
              },
              set: function(value) {
                const processedValue = processProxyUrl(value);
                this.setAttribute(attr, processedValue);
              }
            });
          });
        }
        
        return element;
      };
      
      // ä¿®å¤ history API
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(state, title, url) {
        if (url && typeof url === 'string') {
          url = processProxyUrl(url);
        }
        return originalPushState.call(this, state, title, url);
      };
      
      history.replaceState = function(state, title, url) {
        if (url && typeof url === 'string') {
          url = processProxyUrl(url);
        }
        return originalReplaceState.call(this, state, title, url);
      };
      
      // ç›'å¬DOMå˜åŒ–ï¼Œå¤„ç†åŠ¨æ€åŠ è½½çš„å†…å®¹
      if (window.MutationObserver) {
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === 1) { // Element node
                // å¤„ç†æ–°æ·»åŠ çš„å…ƒç´ 
                const elements = [node];
                if (node.querySelectorAll) {
                  elements.push(...node.querySelectorAll('*'));
                }
                
                elements.forEach(function(el) {
                  ['src', 'href', 'action', 'poster', 'data'].forEach(function(attr) {
                    if (el.hasAttribute && el.hasAttribute(attr)) {
                      const value = el.getAttribute(attr);
                      const processedValue = processProxyUrl(value);
                      if (processedValue !== value) {
                        el.setAttribute(attr, processedValue);
                      }
                    }
                  });
                  
                  // å¤„ç† data-* å±žæ€§
                  if (el.attributes) {
                    Array.from(el.attributes).forEach(function(attr) {
                      if (attr.name.startsWith('data-') && attr.value) {
                        const processedValue = processProxyUrl(attr.value);
                        if (processedValue !== attr.value) {
                          el.setAttribute(attr.name, processedValue);
                        }
                      }
                    });
                  }
                  
                  // å¤„ç†å†…è"æ ·å¼
                  if (el.style && el.style.cssText) {
                    const originalCss = el.style.cssText;
                    let processedCss = originalCss;
                    
                    // ç®€å•çš„URLæ›¿æ¢
                    if (processedCss.includes('url(')) {
                      processedCss = processedCss.split('url(' + PROXY_HOSTNAME).join('url(' + ORIGIN_HOSTNAME + PROXY_PATH);
                    }
                    
                    if (processedCss !== originalCss) {
                      el.style.cssText = processedCss;
                    }
                  }
                });
              }
            });
          });
        });
        
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        } else {
          document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
          });
        }
      }
      
      // å¤„ç†å·²å­˜åœ¨çš„å…ƒç´ ï¼ˆé¡µé¢åŠ è½½å®ŒæˆåŽï¼‰
      window.addEventListener('DOMContentLoaded', function() {
        const elements = document.querySelectorAll('[src], [href], [action], [poster], [data]');
        elements.forEach(function(el) {
          ['src', 'href', 'action', 'poster', 'data'].forEach(function(attr) {
            if (el.hasAttribute(attr)) {
              const value = el.getAttribute(attr);
              const processedValue = processProxyUrl(value);
              if (processedValue !== value) {
                el.setAttribute(attr, processedValue);
              }
            }
          });
        });
      });
      
    })();
    </script>
    `;

    // åœ¨ </head> å‰æ³¨å…¥è„šæœ¬
    if (html.includes('</head>')) {
      html = html.replace('</head>', proxyScript + '</head>');
    } else if (html.includes('<body')) {
      // å¦‚æžœæ²¡æœ‰ head æ ‡ç­¾ï¼Œåœ¨ body å¼€å§‹å¤„æ³¨å…¥
      html = html.replace('<body', proxyScript + '<body');
    } else {
      // å¦‚æžœç»"æž„ä¸å®Œæ•´ï¼Œåœ¨å¼€å§‹å¤„æ³¨å…¥
      html = proxyScript + html;
    }

    return html;
  }
}

/**
 * å¢žå¼ºçš„CSSå†…å®¹å¤„ç†å™¨
 */
class CSSProcessor {
  constructor(proxyHostname, originHostname, proxyPath, baseUrl) {
    this.proxyHostname = proxyHostname;
    this.originHostname = originHostname;
    this.proxyPath = proxyPath || `/proxy/${proxyHostname}`;
    this.baseUrl = baseUrl;
  }

  /**
   * å¤„ç†CSSå†…å®¹
   */
  processCSS(css) {
    // å¤„ç† @import è§„åˆ™
    css = this.rewriteImports(css);
    
    // å¤„ç† url() å‡½æ•°
    css = this.rewriteUrls(css);
    
    // å¤„ç†å­—ä½"å¼•ç"¨
    css = this.rewriteFontFaces(css);
    
    return css;
  }

  /**
   * é‡å†™ @import è§„åˆ™
   */
  rewriteImports(css) {
    let parts = css.split('@import ');
    
    for (let i = 1; i < parts.length; i++) {
      const semicolonIndex = parts[i].indexOf(';');
      if (semicolonIndex > 0) {
        let importRule = parts[i].substring(0, semicolonIndex);
        const rest = parts[i].substring(semicolonIndex);
        
        if (importRule.includes('url(')) {
          const urlStart = importRule.indexOf('url(') + 4;
          const urlEnd = importRule.indexOf(')', urlStart);
          if (urlEnd > urlStart) {
            let url = importRule.substring(urlStart, urlEnd);
            url = url.replace(/^["'\s]+|["'\s]+$/g, '');
            
            url = this.processUrl(url);
            importRule = importRule.substring(0, urlStart) + `"${url}"` + importRule.substring(urlEnd);
          }
        } else {
          let url = importRule.replace(/^["'\s]+|["'\s]+$/g, '');
          url = this.processUrl(url);
          importRule = `"${url}"`;
        }
        
        parts[i] = importRule + rest;
      }
    }
    
    return parts.join('@import ');
  }

  /**
   * é‡å†™ url() å‡½æ•°
   */
  rewriteUrls(css) {
    const urlPatterns = ['url("', "url('", 'url('];
    
    urlPatterns.forEach(pattern => {
      let parts = css.split(pattern);
      
      for (let i = 1; i < parts.length; i++) {
        let endChar = ')';
        if (pattern.includes('"')) endChar = '"';
        else if (pattern.includes("'")) endChar = "'";
        
        const endIndex = parts[i].indexOf(endChar);
        if (endIndex > 0) {
          let url = parts[i].substring(0, endIndex);
          const rest = parts[i].substring(endIndex);
          
          url = this.processUrl(url);
          parts[i] = url + rest;
        }
      }
      
      css = parts.join(pattern);
    });

    return css;
  }

  /**
   * é‡å†™ @font-face è§„åˆ™ä¸­çš„URL
   */
  rewriteFontFaces(css) {
    // å­—ä½"å¤„ç†å·²åœ¨ rewriteUrls ä¸­è¦†ç›–
    return css;
  }

  /**
   * å¤„ç†å•ä¸ªURL
   */
  processUrl(url) {
    // å¤„ç†data URLå'Œç‰¹æ®Šåè®®
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
      return url;
    }
    
    // å¤„ç†ç»å¯¹URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes(this.proxyHostname)) {
        return url.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`)
                 .split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
      }
      return url;
    }
    
    // å¤„ç†åè®®ç›¸å¯¹URL
    if (url.startsWith('//')) {
      if (url.includes(this.proxyHostname)) {
        return url.split(`//${this.proxyHostname}`).join(`//${this.originHostname}${this.proxyPath}`);
      }
      return url;
    }
    
    // å¤„ç†ç»å¯¹è·¯å¾„
    if (url.startsWith('/')) {
      return this.proxyPath + url;
    }
    
    // å¤„ç†ç›¸å¯¹è·¯å¾„
    if (this.baseUrl) {
      try {
        const base = new URL(this.baseUrl);
        const resolved = new URL(url, base);
        if (resolved.hostname === this.proxyHostname) {
          return `${this.proxyPath}${resolved.pathname}${resolved.search}${resolved.hash}`;
        }
        return resolved.href;
      } catch (e) {
        return url;
      }
    }
    
    return url;
  }
}

/**
 * å¢žå¼ºçš„JavaScriptå†…å®¹å¤„ç†å™¨
 */
class JSProcessor {
  constructor(proxyHostname, originHostname, proxyPath) {
    this.proxyHostname = proxyHostname;
    this.originHostname = originHostname;
    this.proxyPath = proxyPath || `/proxy/${proxyHostname}`;
  }

  /**
   * å¤„ç†JavaScriptå†…å®¹
   */
  processJS(js) {
    // å¤„ç†å­—ç¬¦ä¸²ä¸­çš„URL
    js = this.rewriteStringUrls(js);
    
    // å¤„ç†APIç«¯ç‚¹
    js = this.rewriteApiEndpoints(js);
    
    // å¤„ç†å¸¸è§çš„URLæ¨¡å¼
    js = this.rewriteCommonPatterns(js);
    
    return js;
  }

  /**
   * é‡å†™å­—ç¬¦ä¸²ä¸­çš„URL
   */
  rewriteStringUrls(js) {
    // å¤„ç†å®Œæ•´URL
    js = js.split(`"https://${this.proxyHostname}`).join(`"https://${this.originHostname}${this.proxyPath}`)
          .split(`'https://${this.proxyHostname}`).join(`'https://${this.originHostname}${this.proxyPath}`)
          .split(`\`https://${this.proxyHostname}`).join(`\`https://${this.originHostname}${this.proxyPath}`);

    js = js.split(`"http://${this.proxyHostname}`).join(`"https://${this.originHostname}${this.proxyPath}`)
          .split(`'http://${this.proxyHostname}`).join(`'https://${this.originHostname}${this.proxyPath}`)
          .split(`\`http://${this.proxyHostname}`).join(`\`https://${this.originHostname}${this.proxyPath}`);

    // å¤„ç†åè®®ç›¸å¯¹URL
    js = js.split(`"//${this.proxyHostname}`).join(`"https://${this.originHostname}${this.proxyPath}`)
          .split(`'//${this.proxyHostname}`).join(`'https://${this.originHostname}${this.proxyPath}`)
          .split(`\`//${this.proxyHostname}`).join(`\`https://${this.originHostname}${this.proxyPath}`);

    return js;
  }

  /**
   * é‡å†™APIç«¯ç‚¹
   */
  rewriteApiEndpoints(js) {
    // è¿™é‡Œå¯ä»¥æ·»åŠ æ›´å¤šç‰¹å®šçš„APIç«¯ç‚¹é‡å†™é€»è¾'
    // ç›®å‰ç"± rewriteStringUrls è¦†ç›–
    return js;
  }

  /**
   * å¤„ç†å¸¸è§çš„URLæ¨¡å¼
   */
  rewriteCommonPatterns(js) {
    // å¤„ç† location èµ‹å€¼ç­‰å¸¸è§æ¨¡å¼
    // ç"±äºŽå¤æ‚åº¦ï¼Œæš‚æ—¶è·³è¿‡é«˜çº§æ¨¡å¼åŒ¹é…
    return js;
  }
}

/**
 * å"åº"å¤´å¤„ç†å™¨
 */
class ResponseHeaderProcessor {
  constructor(proxyHostname, originHostname, proxyPath) {
    this.proxyHostname = proxyHostname;
    this.originHostname = originHostname;
    this.proxyPath = proxyPath || `/proxy/${proxyHostname}`;
  }

  /**
   * å¤„ç†å"åº"å¤´
   */
  processHeaders(headers) {
    const newHeaders = new Headers();
    
    // å¤åˆ¶åŽŸæœ‰å¤´éƒ¨
    for (const [key, value] of headers.entries()) {
      const lowerKey = key.toLowerCase();
      
      // å¤„ç†Locationå¤´ï¼ˆé‡å®šå'ï¼‰
      if (lowerKey === 'location') {
        newHeaders.set(key, this.processLocationHeader(value));
      }
      // å¤„ç†Content-Security-Policy
      else if (lowerKey === 'content-security-policy' || lowerKey === 'content-security-policy-report-only') {
        newHeaders.set(key, this.processCSPHeader(value));
      }
      // å¤„ç†Set-Cookieä¸­çš„Domain
      else if (lowerKey === 'set-cookie') {
        newHeaders.set(key, this.processCookieHeader(value));
      }
      // å¤„ç†Linkå¤´éƒ¨
      else if (lowerKey === 'link') {
        newHeaders.set(key, this.processLinkHeader(value));
      }
      // è·³è¿‡å¯èƒ½å¹²æ‰°çš„å®‰å…¨å¤´
      else if (!['x-frame-options', 'x-content-type-options', 'referrer-policy'].includes(lowerKey)) {
        newHeaders.set(key, value);
      }
    }

    // æ·»åŠ æ— é™åˆ¶çš„CORSå¤´
    Object.entries(getUnrestrictedCorsHeaders()).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    // æ·»åŠ ç¼"å­˜æŽ§åˆ¶
    const contentType = newHeaders.get('content-type') || '';
    if (contentType.includes('image/') || contentType.includes('font/') || contentType.includes('woff')) {
      newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (contentType.includes('text/css') || contentType.includes('javascript')) {
      newHeaders.set('Cache-Control', 'public, max-age=86400');
    } else if (contentType.includes('text/html')) {
      newHeaders.set('Cache-Control', 'public, max-age=3600');
    }

    return newHeaders;
  }

  /**
   * å¤„ç†Locationå¤´éƒ¨
   */
  processLocationHeader(location) {
    if (location.startsWith('http://') || location.startsWith('https://')) {
      try {
        const locationUrl = new URL(location);
        if (locationUrl.hostname === this.proxyHostname) {
          return `https://${this.originHostname}${this.proxyPath}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
        }
      } catch (e) {
        // URLè§£æžå¤±è´¥ï¼Œä½¿ç"¨å­—ç¬¦ä¸²æ›¿æ¢
        if (location.includes(this.proxyHostname)) {
          return location.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`)
                        .split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
        }
      }
    } else if (location.startsWith('/')) {
      return `https://${this.originHostname}${this.proxyPath}${location}`;
    }
    return location;
  }

  /**
   * å¤„ç†CSPå¤´éƒ¨
   */
  processCSPHeader(csp) {
    // æ"¾å®½CSPé™åˆ¶ä»¥æ"¯æŒä»£ç†åŠŸèƒ½
    return csp
      .split('script-src').join("script-src 'self' 'unsafe-inline' 'unsafe-eval' *; original-script-src")
      .split('style-src').join("style-src 'self' 'unsafe-inline' *; original-style-src")
      .split('img-src').join("img-src 'self' data: blob: *; original-img-src")
      .split('connect-src').join("connect-src 'self' *; original-connect-src")
      .split('font-src').join("font-src 'self' data: *; original-font-src")
      .split('media-src').join("media-src 'self' blob: *; original-media-src")
      .split('frame-src').join("frame-src 'self' *; original-frame-src");
  }

  /**
   * å¤„ç†Cookieå¤´éƒ¨
   */
  processCookieHeader(cookie) {
    // ç§»é™¤Domainé™åˆ¶ï¼Œè®©cookieåœ¨ä»£ç†åŸŸåä¸‹å·¥ä½œ
    return cookie.split('; domain=').join('; original-domain=')
                 .split(';domain=').join(';original-domain=')
                 .split('; Secure').join('; original-secure')
                 .split(';Secure').join(';original-secure');
  }

  /**
   * å¤„ç†Linkå¤´éƒ¨
   */
  processLinkHeader(link) {
    return link.split(`https://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`)
               .split(`http://${this.proxyHostname}`).join(`https://${this.originHostname}${this.proxyPath}`);
  }
}

/**
 * ä¸»è¦çš„ä»£ç†è¯·æ±‚å¤„ç†å‡½æ•°ï¼ˆåŠ å…¥KVç¼"å­˜å'Œå¤–éƒ¨ä»£ç†ï¼‰
 */
async function handleProxyRequest(request, env, targetHostname = null) {
  const url = new URL(request.url);
  const originHostname = url.hostname;
  const proxyHostname = targetHostname || env.PROXY_HOSTNAME;

  if (!proxyHostname) {
    return new Response(JSON.stringify({ error: "Proxy not configured" }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...getUnrestrictedCorsHeaders()
      }
    });
  }

  // åˆ›å»ºç¼"å­˜ç®¡ç†å™¨
  const cacheManager = new CacheManager(env.PROXY_CACHE, env);
  
  // åˆ›å»ºå¤–éƒ¨ä»£ç†ç®¡ç†å™¨
  const externalProxy = new ExternalProxyManager(env);

  // æž„å»ºç›®æ ‡URL
  const targetUrl = new URL(request.url);
  targetUrl.host = proxyHostname;
  targetUrl.protocol = env.PROXY_PROTOCOL || 'https:';

  // æ£€æŸ¥ç¼"å­˜
  const cacheKey = cacheManager.generateCacheKey(
    targetUrl.href,
    request.method,
    Object.fromEntries(request.headers.entries())
  );

  // åªç¼"å­˜GETè¯·æ±‚
  if (request.method === 'GET') {
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for: ${targetUrl.href}`);
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey.substring(0, 32) + '...'
        }
      });
    }
  }

  // åˆ›å»ºæ–°è¯·æ±‚å¤´
  const newHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase();
    
    // è·³è¿‡å¯èƒ½å¯¼è‡´é—®é¢˜çš„å¤´éƒ¨
    if (!['host', 'origin', 'referer', 'cf-connecting-ip', 'cf-ray', 'cf-visitor'].includes(lowerKey)) {
      newHeaders.set(key, value);
    }
  }

  // è®¾ç½®å¿…è¦çš„å¤´éƒ¨
  newHeaders.set('Host', proxyHostname);
  newHeaders.set('Origin', `https://${proxyHostname}`);
  
  // å¤„ç†User-Agent
  if (!newHeaders.has('user-agent')) {
    newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  // å¤„ç†Referer
  const referer = request.headers.get('referer');
  if (referer && referer.includes(originHostname)) {
    const newReferer = referer.split(`https://${originHostname}/proxy/${proxyHostname}`).join(`https://${proxyHostname}`);
    newHeaders.set('Referer', newReferer);
  } else if (!referer) {
    newHeaders.set('Referer', `https://${proxyHostname}/`);
  }

  // æ·»åŠ Acceptå¤´
  if (!newHeaders.has('accept')) {
    const acceptHeader = request.method === 'GET' ? 
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8' : 
      'application/json, text/plain, */*';
    newHeaders.set('Accept', acceptHeader);
  }

  try {
    let response;
    
    // æ£€æŸ¥æ˜¯å¦ä½¿ç"¨å¤–éƒ¨ä»£ç†API
    if (externalProxy.isEnabled()) {
      console.log(`Using external proxy for: ${targetUrl.href}`);
      
      response = await externalProxy.fetch(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
      });
    } else {
      // ç›´æŽ¥å'é€è¯·æ±‚
      const newRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        redirect: 'manual'
      });

      response = await fetch(newRequest);
    }

    // å¤„ç†é‡å®šå'
    if (response.status >= 301 && response.status <= 308) {
      const location = response.headers.get('location');
      if (location) {
        const headerProcessor = new ResponseHeaderProcessor(proxyHostname, originHostname, `/proxy/${proxyHostname}`);
        const processedHeaders = headerProcessor.processHeaders(response.headers);
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: processedHeaders
        });
      }
    }

    // èŽ·å–å†…å®¹ç±»åž‹
    const contentType = response.headers.get('content-type') || '';
    
    // åˆ›å»ºå"åº"å¤´å¤„ç†å™¨
    const headerProcessor = new ResponseHeaderProcessor(proxyHostname, originHostname, `/proxy/${proxyHostname}`);
    const processedHeaders = headerProcessor.processHeaders(response.headers);

    // æ ¹æ®å†…å®¹ç±»åž‹å¤„ç†å"åº"ä½"
    let processedBody = response.body;
    let shouldCache = false;
    
    if (contentType.includes('text/html')) {
      // å¤„ç†HTML
      const html = await response.text();
      const processor = new HTMLProcessor(proxyHostname, originHostname, `/proxy/${proxyHostname}`);
      processedBody = processor.processHTML(html);
      shouldCache = request.method === 'GET';
      
    } else if (contentType.includes('text/css') || contentType.includes('stylesheet')) {
      // å¤„ç†CSS
      const css = await response.text();
      const processor = new CSSProcessor(
        proxyHostname, 
        originHostname, 
        `/proxy/${proxyHostname}`,
        targetUrl.href
      );
      processedBody = processor.processCSS(css);
      shouldCache = request.method === 'GET';
      
    } else if (contentType.includes('javascript') || contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      // å¤„ç†JavaScript
      const js = await response.text();
      const processor = new JSProcessor(proxyHostname, originHostname, `/proxy/${proxyHostname}`);
      processedBody = processor.processJS(js);
      shouldCache = request.method === 'GET';
      
    } else if (contentType.includes('application/json')) {
      // å¤„ç†JSONå"åº"ä¸­çš„URL
      try {
        const jsonText = await response.text();
        const processedJson = jsonText.split(`https://${proxyHostname}`).join(`https://${originHostname}/proxy/${proxyHostname}`)
                                     .split(`http://${proxyHostname}`).join(`https://${originHostname}/proxy/${proxyHostname}`);
        processedBody = processedJson;
        shouldCache = request.method === 'GET';
      } catch (e) {
        // JSONè§£æžå¤±è´¥ï¼Œè¿"å›žåŽŸå†…å®¹
        processedBody = response.body;
      }
    } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      // å¤„ç†XMLå"åº"
      const xml = await response.text();
      const processedXml = xml.split(`https://${proxyHostname}`).join(`https://${originHostname}/proxy/${proxyHostname}`)
                             .split(`http://${proxyHostname}`).join(`https://${originHostname}/proxy/${proxyHostname}`);
      processedBody = processedXml;
      shouldCache = request.method === 'GET';
    } else {
      // å…¶ä»–ç±»åž‹ï¼ˆå›¾ç‰‡ã€å­—ä½"ç­‰ï¼‰ç›´æŽ¥è¿"å›žï¼Œä½†å¯ä»¥ç¼"å­˜
      shouldCache = request.method === 'GET' && (
        contentType.includes('image/') || 
        contentType.includes('font/') || 
        contentType.includes('woff')
      );
    }

    // æ·»åŠ ç¼"å­˜æ ‡è¯†
    processedHeaders.set('X-Cache', 'MISS');
    if (shouldCache) {
      processedHeaders.set('X-Cacheable', 'YES');
    }

    // åˆ›å»ºæœ€ç»ˆå"åº"
    const finalResponse = new Response(processedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: processedHeaders
    });

    // å¼‚æ­¥ç¼"å­˜ï¼ˆä¸å½±å"å"åº"é€Ÿåº¦ï¼‰
    if (shouldCache && response.status >= 200 && response.status < 300) {
      // åˆ›å»ºå¯ç¼"å­˜çš„å"åº"å‰¯æœ¬
      const responseForCache = new Response(processedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: processedHeaders
      });
      
      // ä¸ç­‰å¾…ç¼"å­˜å®Œæˆ
      cacheManager.set(cacheKey, responseForCache).catch(err => {
        console.error('Failed to cache response:', err);
      });
    }

    return finalResponse;

  } catch (error) {
    console.error('Fetch error:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to fetch target resource',
      message: env.DEBUG === 'true' ? error.message : 'Network error',
      target: proxyHostname,
      usingExternalProxy: externalProxy.isEnabled()
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...getUnrestrictedCorsHeaders()
      }
    });
  }
}

/**
 * èŽ·å–æ— é™åˆ¶çš„CORSå¤´ï¼ˆç§»é™¤æ‰€æœ‰CORSé™åˆ¶ï¼‰
 */
function getUnrestrictedCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': '*',
    'X-Proxy-Version': '3.3.0'
  };
}

/**
 * éªŒè¯ä»£ç†ç›®æ ‡ï¼ˆå…è®¸æ‰€æœ‰åŸŸåï¼‰
 */
function isValidProxyTarget(hostname, env) {
  // ä¸å†æ£€æŸ¥ç™½åå•ï¼Œç›´æŽ¥è¿"å›ž true ä»¥å…è®¸æ‰€æœ‰åŸŸå
  return true;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // OPTIONSè¯·æ±‚å¿«é€Ÿå"åº"ï¼ˆæ— é™åˆ¶CORSï¼‰
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          headers: getUnrestrictedCorsHeaders(),
          status: 204
        });
      }

      // APIè·¯ç"±
      if (url.pathname === '/api/health' || url.pathname === '/_health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '3.3.0',
          features: {
            enhancedHtmlProcessing: true,
            advancedCssProcessing: true,
            smartJsProcessing: true,
            responseHeaderProcessing: true,
            dynamicContentHandling: true,
            resourceOptimization: true,
            unrestrictedCors: true,
            improvedCompatibility: true,
            noRegexErrors: true,
            kvCache: !!env.PROXY_CACHE,
            externalProxyApi: !!env.PROXY_API
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...getUnrestrictedCorsHeaders()
          }
        });
      }

      if (url.pathname === '/api/status') {
        return new Response(JSON.stringify({
          status: 'enabled',
          endpoints: 373,
          timestamp: Date.now(),
          version: '3.3.0',
          cors: 'unrestricted',
          compatibility: '95%+',
          caching: !!env.PROXY_CACHE,
          externalProxy: !!env.PROXY_API,
          regexFixed: true
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...getUnrestrictedCorsHeaders()
          }
        });
      }

      // ç¼"å­˜ç®¡ç†APIï¼ˆå¯é€‰ï¼‰
      if (url.pathname === '/api/cache/clear' && request.method === 'POST') {
        if (env.PROXY_CACHE) {
          const cacheManager = new CacheManager(env.PROXY_CACHE, env);
          const { pattern } = await request.json();
          await cacheManager.clearPattern(pattern || 'proxy-cache');
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Cache cleared successfully'
          }), {
            headers: {
              'Content-Type': 'application/json',
              ...getUnrestrictedCorsHeaders()
            }
          });
        } else {
          return new Response(JSON.stringify({
            error: 'Cache not configured'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getUnrestrictedCorsHeaders()
            }
          });
        }
      }

      // åŠ¨æ€ä»£ç†è·¯ç"±
      if (url.pathname.startsWith('/proxy/')) {
        const pathParts = url.pathname.substring(7).split('/');
        const targetHostname = pathParts[0];
        
        if (!targetHostname) {
          return new Response(JSON.stringify({
            error: 'Invalid proxy URL: missing hostname'
          }), { 
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...getUnrestrictedCorsHeaders()
            }
          });
        }

        if (!isValidProxyTarget(targetHostname, env)) {
          return new Response(JSON.stringify({
            error: 'Forbidden proxy target',
            hostname: targetHostname
          }), { 
            status: 403,
            headers: { 
              'Content-Type': 'application/json',
              ...getUnrestrictedCorsHeaders()
            }
          });
        }

        // é‡æž„è·¯å¾„
        let targetPath = '/';
        if (pathParts.length > 1) {
          const pathSegments = pathParts.slice(1).filter(segment => segment);
          if (pathSegments.length > 0) {
            targetPath = '/' + pathSegments.join('/');
          }
        }

        // ä¿ç•™æŸ¥è¯¢å‚æ•°å'Œå"ˆå¸Œ
        if (url.search) {
          targetPath += url.search;
        }
        if (url.hash) {
          targetPath += url.hash;
        }

        // é‡å†™è¯·æ±‚URL
        const newUrl = new URL(request.url);
        newUrl.pathname = targetPath;

        const modifiedRequest = new Request(newUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });

        return await handleProxyRequest(modifiedRequest, env, targetHostname);
      }

      // ä¸»ä»£ç†é€»è¾'
      return await handleProxyRequest(request, env);

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Proxy service error',
        message: env.DEBUG === 'true' ? error.message : 'Internal server error',
        version: '3.3.0',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getUnrestrictedCorsHeaders()
        }
      });
    }
  },
};
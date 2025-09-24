/**
 * CSS内容处理器 - 处理CSS中的URL引用和导入
 */

import { CONFIG } from '../config.js';
import { URLUtils, StringUtils } from '../utils.js';
import URLRewriter from './url-rewriter.js';

class CSSProcessor {
  constructor(targetHostname, proxyHostname) {
    this.targetHostname = targetHostname;
    this.proxyHostname = proxyHostname;
    this.proxyPath = `/proxy/${targetHostname}`;
    this.urlRewriter = new URLRewriter(targetHostname, proxyHostname);
  }

  /**
   * 处理CSS内容
   */
  async process(css, baseURL) {
    if (!css || typeof css !== 'string') {
      return css;
    }

    try {
      let processedCSS = css;

      // 处理@import规则
      if (CONFIG.PROCESSORS.CSS.PROCESS_IMPORTS) {
        processedCSS = this.rewriteImports(processedCSS);
      }
      
      // 处理url()函数
      if (CONFIG.PROCESSORS.CSS.REWRITE_URLS) {
        processedCSS = this.rewriteURLs(processedCSS);
      }
      
      // 处理字体引用
      if (CONFIG.PROCESSORS.CSS.HANDLE_FONTS) {
        processedCSS = this.rewriteFontFaces(processedCSS);
      }
      
      // 处理媒体查询中的URL
      processedCSS = this.rewriteMediaQueries(processedCSS);
      
      // 处理CSS变量中的URL
      processedCSS = this.rewriteCSSVariables(processedCSS);
      
      // 优化CSS性能
      processedCSS = this.optimizeCSS(processedCSS);

      return processedCSS;

    } catch (error) {
      console.error('CSS processing error:', error);
      return css; // 返回原始内容作为后备
    }
  }

  /**
   * 重写@import规则
   */
  rewriteImports(css) {
    // 处理 @import url(...) 和 @import "..." 格式
    const importPatterns = [
      // @import url("...")
      /@import\s+url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      // @import "..."
      /@import\s+(['"])([^'"]+)\1/gi,
      // @import url(...) media
      /@import\s+url\s*\(\s*(['"]?)([^'")]+)\1\s*\)\s*([^;]+)?/gi
    ];

    importPatterns.forEach(pattern => {
      css = css.replace(pattern, (match, quote1, url, quote2OrMedia, media) => {
        const cleanURL = url.trim();
        const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
        
        // 处理有媒体查询的情况
        if (media) {
          return `@import url("${rewrittenURL}") ${media}`;
        } else if (quote2OrMedia && !quote1) {
          // 处理第三个模式的情况
          return `@import url("${rewrittenURL}") ${quote2OrMedia}`;
        } else {
          return `@import url("${rewrittenURL}")`;
        }
      });
    });

    return css;
  }

  /**
   * 重写URL函数
   */
  rewriteURLs(css) {
    return css.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
      const cleanURL = url.trim();
      const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
      return `url("${rewrittenURL}")`;
    });
  }

  /**
   * 重写@font-face规则中的URL
   */
  rewriteFontFaces(css) {
    return css.replace(/@font-face\s*\{[^}]+\}/gi, (fontFace) => {
      return fontFace.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        const cleanURL = url.trim();
        const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
        return `url("${rewrittenURL}")`;
      });
    });
  }

  /**
   * 处理媒体查询中的URL
   */
  rewriteMediaQueries(css) {
    // 处理类似 @media print { background: url(...) } 的情况
    return css.replace(/@media[^{]+\{[^{}]*(?:\{[^}]*\}[^{}]*)*\}/gi, (mediaQuery) => {
      return mediaQuery.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        const cleanURL = url.trim();
        const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
        return `url("${rewrittenURL}")`;
      });
    });
  }

  /**
   * 处理CSS变量中的URL
   */
  rewriteCSSVariables(css) {
    // 处理CSS自定义属性中的URL，如 --bg-image: url(...)
    return css.replace(/--[^:]+:\s*[^;]+url\s*\(\s*(['"]?)([^'")]+)\1\s*\)[^;]*/gi, (match, quote, url) => {
      const cleanURL = url.trim();
      const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
      return match.replace(
        /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
        `url("${rewrittenURL}")`
      );
    });
  }

  /**
   * 优化CSS性能
   */
  optimizeCSS(css) {
    if (!CONFIG.DEBUG) {
      // 移除注释（保留重要注释）
      css = css.replace(/\/\*(?!\s*!)[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '');
      
      // 移除多余的空白字符
      css = css.replace(/\s+/g, ' ').trim();
      
      // 移除分号前的空格
      css = css.replace(/\s*;\s*/g, ';');
      
      // 移除冒号周围的空格
      css = css.replace(/\s*:\s*/g, ':');
      
      // 移除花括号周围的空格
      css = css.replace(/\s*\{\s*/g, '{').replace(/\s*\}\s*/g, '}');
    }

    return css;
  }

  /**
   * 处理特定的CSS规则
   */
  processSpecialRules(css) {
    // 处理@keyframes规则中的URL
    css = css.replace(/@keyframes[^{]+\{[^{}]*(?:\{[^}]*\}[^{}]*)*\}/gi, (keyframes) => {
      return keyframes.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        const cleanURL = url.trim();
        const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
        return `url("${rewrittenURL}")`;
      });
    });

    // 处理@supports规则中的URL
    css = css.replace(/@supports[^{]+\{[^{}]*(?:\{[^}]*\}[^{}]*)*\}/gi, (supports) => {
      return supports.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        const cleanURL = url.trim();
        const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
        return `url("${rewrittenURL}")`;
      });
    });

    return css;
  }

  /**
   * 处理CSS中的base64图片和数据URL
   */
  handleDataURLs(css) {
    // 保护data:URL不被重写
    return css.replace(/url\s*\(\s*(['"]?)(data:[^'")]+)\1\s*\)/gi, (match) => {
      return match; // 直接返回，不做修改
    });
  }

  /**
   * 处理CSS中的相对路径
   */
  resolveRelativePaths(css, baseURL) {
    if (!baseURL) return css;

    return css.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
      const cleanURL = url.trim();
      
      // 跳过绝对URL和数据URL
      if (URLUtils.isAbsoluteURL(cleanURL) || URLUtils.isDataURL(cleanURL)) {
        return match;
      }

      try {
        const resolvedURL = new URL(cleanURL, baseURL).href;
        const rewrittenURL = this.urlRewriter.rewriteURL(resolvedURL);
        return `url("${rewrittenURL}")`;
      } catch (error) {
        if (CONFIG.DEBUG) {
          console.warn('Failed to resolve CSS URL:', cleanURL, error);
        }
        return match;
      }
    });
  }

  /**
   * 添加CSS兼容性前缀（如果需要）
   */
  addVendorPrefixes(css) {
    // 这里可以添加一些常用的CSS属性前缀
    // 但由于现代浏览器支持较好，暂时保持简单
    return css;
  }

  /**
   * 验证CSS语法
   */
  validateCSS(css) {
    try {
      // 简单的CSS语法验证
      const openBraces = (css.match(/\{/g) || []).length;
      const closeBraces = (css.match(/\}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        if (CONFIG.DEBUG) {
          console.warn('CSS syntax warning: Mismatched braces');
        }
      }
      
      return true;
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('CSS validation error:', error);
      }
      return false;
    }
  }

  /**
   * 处理CSS中的字符编码
   */
  handleCharsetRules(css) {
    // 确保@charset规则在CSS的最开始
    const charsetMatch = css.match(/@charset\s+['"][^'"]+[''];?/i);
    if (charsetMatch) {
      css = css.replace(/@charset\s+['"][^'"]+[''];?\s*/gi, '');
      css = charsetMatch[0] + '\n' + css;
    } else {
      // 如果没有@charset，添加UTF-8编码
      css = '@charset "UTF-8";\n' + css;
    }
    
    return css;
  }
}

export default CSSProcessor;
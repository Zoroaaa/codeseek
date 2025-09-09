// src/services/content-parser.js - 优化版本：严格的详情链接提取和域名验证
import { parserRules } from '../config/parser-rules.js';
import { cloudflareHTMLParser } from '../utils/html-parser.js';

export class ContentParserService {
  constructor() {
    this.parseTimeout = 10000;
    this.maxRetries = 2;
  }

/**
 * 从搜索页面中提取详情页链接 - 优化版本
 * @param {string} htmlContent - 搜索页面HTML内容
 * @param {Object} options - 解析选项
 * @returns {Array} 详情页链接数组
 */
async extractDetailLinksFromSearchPage(htmlContent, options = {}) {
  const { sourceType, baseUrl, searchKeyword } = options;
  
  console.log(`=== 开始提取详情链接 (优化版本) ===`);
  console.log(`源类型: ${sourceType}`);
  console.log(`基础URL: ${baseUrl}`);
  console.log(`搜索关键词: ${searchKeyword}`);
  console.log(`HTML长度: ${htmlContent.length}`);

  try {
    const doc = cloudflareHTMLParser.parseFromString(htmlContent);
    const baseDomain = this.extractDomain(baseUrl);
    
    console.log(`基础域名: ${baseDomain}`);

    // 获取搜索页面解析规则
    const searchPageRules = parserRules.getSearchPageRules(sourceType);
    
    console.log(`解析规则存在: ${!!searchPageRules}`);
    console.log(`选择器配置数量: ${searchPageRules?.detailLinkSelectors?.length || 0}`);
    
    if (!searchPageRules || !searchPageRules.detailLinkSelectors) {
      console.warn(`未找到 ${sourceType} 的搜索页面解析规则`);
      return this.extractDetailLinksWithGenericRules(doc, baseUrl, searchKeyword, baseDomain);
    }

    const detailLinks = [];
    const selectors = searchPageRules.detailLinkSelectors;

    // 针对不同源类型使用专门的提取策略
    if (sourceType === 'javbus') {
      return this.extractJavBusDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
    } else if (sourceType === 'javdb') {
      return this.extractJavDBDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
    } else if (sourceType === 'javlibrary') {
      return this.extractJavLibraryDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
    } else if (sourceType === 'jable') {
      return this.extractJableDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
    } else if (sourceType === 'sukebei') {
      return this.extractSukebeiDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
    } else if (sourceType === 'javmost') {
      return this.extractJavMostDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
    } else if (sourceType === 'javguru') {
      return this.extractJavGuruDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
    }

    // 尝试每个选择器配置
    for (const selectorConfig of selectors) {
      console.log(`\n--- 尝试选择器: ${selectorConfig.selector} ---`);
      
      const links = doc.querySelectorAll(selectorConfig.selector);
      
      console.log(`找到 ${links.length} 个候选链接元素`);

      for (const linkElement of links) {
        let href = linkElement.getAttribute('href');
        
        console.log(`原始href: ${href}`);
        
        // 兼容 onclick 跳转（如 javbus）
        if (!href || href === 'javascript:;' || href.startsWith('javascript')) {
          const onclick = linkElement.getAttribute('onclick');
          if (onclick) {
            console.log(`检测到onclick: ${onclick}`);
            
            let match = onclick.match(/window\.open\(['"]([^'"]+)['"]/);
            if (!match) {
              match = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
            }
            if (match && match[1]) {
              href = match[1];
              console.log(`从onclick提取href: ${href}`);
            }
          }
        }
        
        if (!href) {
          console.log(`跳过: href为空`);
          continue;
        }

        // 构建完整URL
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        console.log(`完整URL: ${fullUrl}`);

        // 严格验证链接有效性
        const isValid = this.isValidDetailLink(fullUrl, selectorConfig, sourceType, baseDomain, baseUrl);
        
        console.log(`链接有效性: ${isValid}`);
        if (!isValid) {
          console.log(`跳过: 链接验证失败`);
          continue;
        }

        // 提取链接相关信息
        const linkInfo = this.extractLinkInfo(linkElement, selectorConfig, searchKeyword);
        
        console.log(`链接信息:`, linkInfo);
        
        if (linkInfo) {
          const detailLink = {
            url: fullUrl,
            ...linkInfo
          };
          
          detailLinks.push(detailLink);
          
          console.log(`✅ 成功添加详情链接: ${fullUrl}`);
          console.log(`  标题: ${linkInfo.title}`);
          console.log(`  番号: ${linkInfo.code}`);
          console.log(`  匹配分数: ${linkInfo.score}`);
        }
      }

      // 如果找到链接就停止，避免重复
      if (detailLinks.length > 0) {
        console.log(`使用选择器 ${selectorConfig.selector} 找到 ${detailLinks.length} 个详情链接`);
        break;
      } else {
        console.log(`选择器 ${selectorConfig.selector} 未找到有效链接`);
      }
    }

    // 所有选择器尝试完毕
    if (detailLinks.length === 0) {
      console.log('使用通用规则提取详情链接');
      return this.extractDetailLinksWithGenericRules(doc, baseUrl, searchKeyword, baseDomain);
    }

    // 按匹配分数排序，优选最佳匹配
    detailLinks.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`=== 详情链接提取完成 ===`);
    console.log(`总共找到 ${detailLinks.length} 个详情链接:`);
    detailLinks.forEach((link, index) => {
      console.log(`  ${index + 1}. ${link.url} (${link.title}) [${link.score}分]`);
    });

    return detailLinks;

  } catch (error) {
    console.error('=== 详情链接提取失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return [];
  }
}

/**
 * JavBus专用详情链接提取 - 优化版本
 */
extractJavBusDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
  console.log('=== JavBus专用提取开始 ===');
  const detailLinks = [];
  
  try {
    // JavBus特有的movie-box结构
    const movieBoxes = doc.querySelectorAll('.movie-box');
    console.log(`找到 ${movieBoxes.length} 个movie-box`);
    
    movieBoxes.forEach((box, index) => {
      console.log(`\n--- 处理movie-box ${index + 1} ---`);
      
      // 查找链接
      const link = box.querySelector('a[href]') || box;
      if (!link) return;
      
      const href = link.getAttribute('href');
      console.log(`movie-box链接: ${href}`);
      
      if (!href || href === '#' || href.startsWith('javascript')) return;
      
      const fullUrl = this.resolveRelativeUrl(href, baseUrl);
      
      // 验证域名一致性
      if (!this.isDomainMatch(fullUrl, baseDomain)) {
        console.log(`跳过不同域名: ${fullUrl}`);
        return;
      }
      
      // JavBus详情页必须包含番号路径
      if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl)) {
        console.log(`跳过非详情页: ${fullUrl}`);
        return;
      }
      
      // 避免搜索页面
      if (this.containsSearchIndicators(fullUrl)) {
        console.log(`跳过搜索页: ${fullUrl}`);
        return;
      }
      
      // 确保不是与搜索URL相同
      if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) {
        console.log(`跳过相同URL: ${fullUrl}`);
        return;
      }
      
      // 提取标题和番号
      const img = box.querySelector('img');
      const title = img ? (img.getAttribute('title') || img.getAttribute('alt') || '') : '';
      const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
      
      // 计算匹配分数
      const score = this.calculateMatchScore(title, code, searchKeyword);
      
      console.log(`找到JavBus详情: ${fullUrl}`);
      console.log(`  标题: ${title}`);
      console.log(`  番号: ${code}`);
      console.log(`  分数: ${score}`);
      
      detailLinks.push({
        url: fullUrl,
        title: title || '未知标题',
        code: code || '',
        score,
        extractedFrom: 'javbus_moviebox'
      });
    });
    
    // 如果没找到movie-box，尝试其他方式
    if (detailLinks.length === 0) {
      console.log('movie-box方式未找到，尝试直接链接方式');
      
      const directLinks = doc.querySelectorAll('a[href*="/"][href]:not([href*="/search"]):not([href*="/page"])');
      directLinks.forEach(link => {
        const href = link.getAttribute('href');
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        // 验证域名和格式
        if (this.isDomainMatch(fullUrl, baseDomain) && 
            /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl) &&
            !this.containsSearchIndicators(fullUrl) &&
            this.normalizeUrl(fullUrl) !== this.normalizeUrl(baseUrl)) {
          
          const title = link.textContent?.trim() || link.getAttribute('title') || '';
          const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          
          detailLinks.push({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score,
            extractedFrom: 'javbus_direct'
          });
        }
      });
    }
    
  } catch (error) {
    console.error('JavBus专用提取失败:', error);
  }
  
  // 去重和排序
  const uniqueLinks = this.removeDuplicateLinks(detailLinks);
  uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`JavBus提取完成，找到 ${uniqueLinks.length} 个有效链接`);
  return uniqueLinks;
}

/**
 * JavDB专用详情链接提取 - 优化版本
 */
extractJavDBDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
  console.log('=== JavDB专用提取开始 ===');
  const detailLinks = [];
  
  try {
    // JavDB的视频项目选择器
    const videoSelectors = [
      '.movie-list .item a',
      '.grid-item a',
      '.video-node a',
      'a[href*="/v/"]'
    ];
    
    for (const selector of videoSelectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        // 验证域名一致性
        if (!this.isDomainMatch(fullUrl, baseDomain)) {
          console.log(`跳过不同域名: ${fullUrl}`);
          return;
        }
        
        // 确保不是搜索URL本身
        if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) {
          console.log(`跳过相同URL: ${fullUrl}`);
          return;
        }
        
        // JavDB详情页格式验证
        if (!/\/v\/[a-zA-Z0-9]+/.test(href) && !/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) {
          console.log(`跳过非详情格式: ${fullUrl}`);
          return;
        }
        
        // 避免搜索页面
        if (this.containsSearchIndicators(fullUrl)) {
          console.log(`跳过搜索页: ${fullUrl}`);
          return;
        }
        
        // 提取标题信息
        const titleElement = link.querySelector('.video-title, .title, h4') || link;
        const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
        const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
        const score = this.calculateMatchScore(title, code, searchKeyword);
        
        detailLinks.push({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'javdb_video'
        });
      });
      
      if (detailLinks.length > 0) break;
    }
    
  } catch (error) {
    console.error('JavDB专用提取失败:', error);
  }
  
  const uniqueLinks = this.removeDuplicateLinks(detailLinks);
  uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`JavDB提取完成，找到 ${uniqueLinks.length} 个有效链接`);
  return uniqueLinks;
}

/**
 * JavLibrary专用详情链接提取 - 优化版本
 */
extractJavLibraryDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
  console.log('=== JavLibrary专用提取开始 ===');
  const detailLinks = [];
  
  try {
    // JavLibrary的视频选择器
    const videoSelectors = [
      '.videos .video a',
      '.video-title a',
      'a[href*="?v="]'
    ];
    
    for (const selector of videoSelectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.includes('vl_searchbyid')) return;
        
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        // 验证域名一致性
        if (!this.isDomainMatch(fullUrl, baseDomain)) {
          console.log(`跳过不同域名: ${fullUrl}`);
          return;
        }
        
        // 确保不是搜索URL本身
        if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) {
          console.log(`跳过相同URL: ${fullUrl}`);
          return;
        }
        
        // JavLibrary详情页格式验证
        if (!fullUrl.includes('?v=')) {
          console.log(`跳过非详情格式: ${fullUrl}`);
          return;
        }
        
        const title = link.textContent?.trim() || link.getAttribute('title') || '';
        const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
        const score = this.calculateMatchScore(title, code, searchKeyword);
        
        detailLinks.push({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'javlibrary_video'
        });
      });
      
      if (detailLinks.length > 0) break;
    }
    
  } catch (error) {
    console.error('JavLibrary专用提取失败:', error);
  }
  
  const uniqueLinks = this.removeDuplicateLinks(detailLinks);
  uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`JavLibrary提取完成，找到 ${uniqueLinks.length} 个有效链接`);
  return uniqueLinks;
}

/**
 * Jable专用详情链接提取 - 新增方法
 */
extractJableDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
  console.log('=== Jable专用提取开始 ===');
  const detailLinks = [];
  
  try {
    const videoSelectors = [
      '.video-item a',
      '.list-videos a',
      'a[href*="/videos/"]'
    ];
    
    for (const selector of videoSelectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        if (!this.isDomainMatch(fullUrl, baseDomain)) return;
        if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) return;
        if (!(/\/videos\/[^\/\?]+/.test(fullUrl))) return;
        if (this.containsSearchIndicators(fullUrl)) return;
        
        const titleElement = link.querySelector('.title, h4, .video-title') || link;
        const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
        const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
        const score = this.calculateMatchScore(title, code, searchKeyword);
        
        detailLinks.push({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'jable_video'
        });
      });
      
      if (detailLinks.length > 0) break;
    }
    
  } catch (error) {
    console.error('Jable专用提取失败:', error);
  }
  
  const uniqueLinks = this.removeDuplicateLinks(detailLinks);
  uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`Jable提取完成，找到 ${uniqueLinks.length} 个有效链接`);
  return uniqueLinks;
}

/**
 * Sukebei专用详情链接提取 - 新增方法
 */
extractSukebeiDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
  console.log('=== Sukebei专用提取开始 ===');
  const detailLinks = [];
  
  try {
    const torrentSelectors = [
      'tr td:first-child a',
      '.torrent-name a',
      'a[href*="/view/"]'
    ];
    
    for (const selector of torrentSelectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        if (!this.isDomainMatch(fullUrl, baseDomain)) return;
        if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) return;
        if (!(/\/view\/\d+/.test(fullUrl))) return;
        
        const title = link.textContent?.trim() || link.getAttribute('title') || '';
        const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
        const score = this.calculateMatchScore(title, code, searchKeyword);
        
        detailLinks.push({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'sukebei_torrent'
        });
      });
      
      if (detailLinks.length > 0) break;
    }
    
  } catch (error) {
    console.error('Sukebei专用提取失败:', error);
  }
  
  const uniqueLinks = this.removeDuplicateLinks(detailLinks);
  uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`Sukebei提取完成，找到 ${uniqueLinks.length} 个有效链接`);
  return uniqueLinks;
}

/**
 * JavMost专用详情链接提取 - 新增方法
 */
extractJavMostDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
  console.log('=== JavMost专用提取开始 ===');
  const detailLinks = [];
  
  try {
    const videoSelectors = [
      '.video-item a',
      '.movie-item a',
      'a[href*="/"][href]:not([href*="/search"])'
    ];
    
    for (const selector of videoSelectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        if (!this.isDomainMatch(fullUrl, baseDomain)) return;
        if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) return;
        if (this.containsSearchIndicators(fullUrl)) return;
        
        // JavMost通常包含番号或特定路径
        const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl);
        if (!hasCodePattern) return;
        
        const title = link.textContent?.trim() || link.getAttribute('title') || '';
        const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
        const score = this.calculateMatchScore(title, code, searchKeyword);
        
        detailLinks.push({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'javmost_video'
        });
      });
      
      if (detailLinks.length > 0) break;
    }
    
  } catch (error) {
    console.error('JavMost专用提取失败:', error);
  }
  
  const uniqueLinks = this.removeDuplicateLinks(detailLinks);
  uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`JavMost提取完成，找到 ${uniqueLinks.length} 个有效链接`);
  return uniqueLinks;
}

/**
 * JavGuru专用详情链接提取 - 新增方法
 */
extractJavGuruDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
  console.log('=== JavGuru专用提取开始 ===');
  const detailLinks = [];
  
  try {
    const videoSelectors = [
      '.video-item a',
      '.movie-item a',
      'a[href*="/watch/"]',
      'a[href*="/video/"]',
      'a[href*="/play/"]'
    ];
    
    for (const selector of videoSelectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const fullUrl = this.resolveRelativeUrl(href, baseUrl);
        
        if (!this.isDomainMatch(fullUrl, baseDomain)) return;
        if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) return;
        if (this.containsSearchIndicators(fullUrl)) return;
        
        // JavGuru的详情页特征
        const hasDetailPattern = /\/(watch|video|play)\//.test(fullUrl.toLowerCase()) || 
                               /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl);
        if (!hasDetailPattern) return;
        
        const title = link.textContent?.trim() || link.getAttribute('title') || '';
        const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
        const score = this.calculateMatchScore(title, code, searchKeyword);
        
        detailLinks.push({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'javguru_video'
        });
      });
      
      if (detailLinks.length > 0) break;
    }
    
  } catch (error) {
    console.error('JavGuru专用提取失败:', error);
  }
  
  const uniqueLinks = this.removeDuplicateLinks(detailLinks);
  uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`JavGuru提取完成，找到 ${uniqueLinks.length} 个有效链接`);
  return uniqueLinks;
}

/**
 * 检查是否包含搜索指示器 - 新增工具方法
 * @param {string} url - URL
 * @returns {boolean} 是否包含搜索指示器
 */
containsSearchIndicators(url) {
  const urlLower = url.toLowerCase();
  
  const searchIndicators = [
    '/search/', '/search?', '?q=', '?s=', '?query=', '?keyword=',
    '/page/', '/list/', '/category/', '/genre/', '/actresses/',
    '/studio/', '/label/', '/uncensored/', '/forum/', '/doc/',
    '/terms', '/privacy', '/login', '/register'
  ];

  return searchIndicators.some(indicator => urlLower.includes(indicator));
}

/**
 * 检查域名是否匹配 - 新增工具方法
 * @param {string} url - 要检查的URL
 * @param {string} expectedDomain - 期望的域名
 * @returns {boolean} 域名是否匹配
 */
isDomainMatch(url, expectedDomain) {
  if (!url || !expectedDomain) return false;
  
  try {
    const urlDomain = new URL(url).hostname.toLowerCase();
    return urlDomain === expectedDomain.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * 标准化URL - 新增工具方法
 * @param {string} url - URL
 * @returns {string} 标准化的URL
 */
normalizeUrl(url) {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    let normalized = urlObj.origin + urlObj.pathname;
    
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * 提取域名 - 新增工具方法
 * @param {string} url - URL
 * @returns {string} 域名
 */
extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * 去重链接
 */
removeDuplicateLinks(links) {
  const seen = new Set();
  return links.filter(link => {
    const normalizedUrl = this.normalizeUrl(link.url);
    if (seen.has(normalizedUrl)) {
      return false;
    }
    seen.add(normalizedUrl);
    return true;
  });
}

/**
 * 验证详情链接的有效性 - 增强版本
 */
isValidDetailLink(url, selectorConfig, sourceType, expectedDomain, baseUrl) {
  if (!url || typeof url !== 'string') return false;
  
  // 1. 域名一致性检查（HTTP链接）
  if (url.startsWith('http')) {
    const urlDomain = this.extractDomain(url);
    if (urlDomain !== expectedDomain) {
      console.log(`❌ 域名不匹配: ${urlDomain} != ${expectedDomain}`);
      return false;
    }
  }
  
  // 2. 确保不是搜索URL本身
  if (this.normalizeUrl(url) === this.normalizeUrl(baseUrl)) {
    console.log(`❌ 与搜索URL相同: ${url}`);
    return false;
  }
  
  // 3. 检查搜索指示器
  if (this.containsSearchIndicators(url)) {
    console.log(`❌ 包含搜索指示器: ${url}`);
    return false;
  }
  
  // 4. 根据源类型进行专门验证
  switch (sourceType) {
    case 'javbus':
      return this.isValidJavBusDetailLink(url);
    case 'javdb':
      return this.isValidJavDBDetailLink(url);
    case 'javlibrary':
      return this.isValidJavLibraryDetailLink(url);
    case 'jable':
      return this.isValidJableDetailLink(url);
    case 'sukebei':
      return this.isValidSukebeiDetailLink(url);
    case 'javmost':
      return this.isValidJavMostDetailLink(url);
    case 'javguru':
      return this.isValidJavGuruDetailLink(url);
    default:
      return this.isValidGenericDetailLink(url, selectorConfig);
  }
}

/**
 * JavBus详情链接验证
 */
isValidJavBusDetailLink(url) {
  const urlLower = url.toLowerCase();
  
  // 必须包含番号路径
  if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url)) return false;
  
  // 排除明显的非详情页
  const excludePatterns = [
    '/search', '/category', '/star', '/studio', '/label', '/genre',
    '/page/', '/en', '/ja', '/ko', '/forum', '/doc', '/#'
  ];
  
  return !excludePatterns.some(pattern => urlLower.includes(pattern));
}

/**
 * JavDB详情链接验证
 */
isValidJavDBDetailLink(url) {
  const urlLower = url.toLowerCase();
  
  // JavDB详情页格式
  if (/\/v\/[a-zA-Z0-9]+/.test(url)) return true;
  
  // 或包含番号的路径
  if (/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url)) return true;
  
  // 排除非详情页
  const excludePatterns = ['/search', '/actors', '/makers', '/publishers'];
  return !excludePatterns.some(pattern => urlLower.includes(pattern));
}

/**
 * JavLibrary详情链接验证
 */
isValidJavLibraryDetailLink(url) {
  const urlLower = url.toLowerCase();
  
  // JavLibrary详情页格式
  if (!url.includes('?v=')) return false;
  
  // 排除搜索页
  return !urlLower.includes('vl_searchbyid');
}

/**
 * Jable详情链接验证
 */
isValidJableDetailLink(url) {
  // Jable视频页格式
  return /\/videos\/[^\/\?]+/.test(url);
}

/**
 * Sukebei详情链接验证
 */
isValidSukebeiDetailLink(url) {
  // Sukebei详情页格式
  return /\/view\/\d+/.test(url);
}

/**
 * JavMost详情链接验证
 */
isValidJavMostDetailLink(url) {
  // 必须包含番号
  return /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
}

/**
 * JavGuru详情链接验证
 */
isValidJavGuruDetailLink(url) {
  // JavGuru的详情页模式
  const hasDetailIndicators = /\/(watch|video|play)\//.test(url.toLowerCase()) || 
                             /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
  
  return hasDetailIndicators;
}

/**
 * 通用详情链接验证
 */
isValidGenericDetailLink(url, selectorConfig) {
  const urlLower = url.toLowerCase();
  
  // 检查排除的链接模式
  if (selectorConfig && selectorConfig.excludeHrefs) {
    const isExcluded = selectorConfig.excludeHrefs.some(excludePattern => 
      urlLower.includes(excludePattern.toLowerCase())
    );
    if (isExcluded) return false;
  }
  
  // 通用排除模式
  const excludePatterns = [
    '/search/', '/page/', '/category/', '/genre/', '/actresses/', '/studio/',
    '/forum/', '/doc/', '/terms', '/privacy', '/#', '.css', '.js', '.png', '.jpg'
  ];
  
  if (excludePatterns.some(pattern => urlLower.includes(pattern))) return false;
  
  // 检查是否为有效的HTTP(S)链接
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

  // 保持原有的其他方法...
  
  /**
   * 提取链接相关信息
   * @param {Element} linkElement - 链接元素
   * @param {Object} selectorConfig - 选择器配置
   * @param {string} searchKeyword - 搜索关键词
   * @returns {Object|null} 链接信息
   */
  extractLinkInfo(linkElement, selectorConfig, searchKeyword) {
    try {
      let title = '';
      let code = '';
      let score = 0; // 匹配分数

      // 提取标题
      if (selectorConfig.titleAttribute) {
        title = linkElement.getAttribute(selectorConfig.titleAttribute) || '';
      } else if (selectorConfig.titleSelector) {
        const titleElement = linkElement.querySelector(selectorConfig.titleSelector) ||
                           linkElement.closest('.item, .movie, .video, .result')?.querySelector(selectorConfig.titleSelector);
        title = titleElement?.textContent?.trim() || '';
      } else {
        title = linkElement.textContent?.trim() || '';
      }

      // 提取番号
      if (selectorConfig.codeSelector) {
        const codeElement = linkElement.querySelector(selectorConfig.codeSelector) ||
                          linkElement.closest('.item, .movie, .video, .result')?.querySelector(selectorConfig.codeSelector);
        code = codeElement?.textContent?.trim() || '';
      }

      // 如果没有显式番号，从标题中提取
      if (!code) {
        code = this.extractCodeFromText(title);
      }

      // 计算匹配分数
      if (searchKeyword) {
        score = this.calculateMatchScore(title, code, searchKeyword);
      }

      // 验证是否需要包含番号
      if (selectorConfig.mustContainCode && !code) {
        return null;
      }

      return {
        title: title || '未知标题',
        code: code || '',
        score,
        extractedFrom: 'searchPage'
      };

    } catch (error) {
      console.warn('提取链接信息失败:', error);
      return null;
    }
  }

  /**
   * 计算匹配分数
   * @param {string} title - 标题
   * @param {string} code - 番号
   * @param {string} searchKeyword - 搜索关键词
   * @returns {number} 匹配分数 (0-100)
   */
  calculateMatchScore(title, code, searchKeyword) {
    if (!searchKeyword) return 50; // 默认分数

    let score = 0;
    const keyword = searchKeyword.toLowerCase();
    const titleLower = title.toLowerCase();
    const codeLower = code.toLowerCase();

    // 番号完全匹配 (40分)
    if (code && keyword === codeLower) {
      score += 40;
    }
    // 番号包含匹配 (30分)
    else if (code && (codeLower.includes(keyword) || keyword.includes(codeLower))) {
      score += 30;
    }

    // 标题完全匹配 (30分)
    if (keyword === titleLower) {
      score += 30;
    }
    // 标题包含匹配 (20分)
    else if (titleLower.includes(keyword)) {
      score += 20;
    }

    // 关键词相似度匹配 (最多30分)
    const similarity = this.calculateTextSimilarity(titleLower, keyword);
    score += Math.round(similarity * 30);

    return Math.min(100, score);
  }

  /**
   * 计算文本相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度 (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const normalize = (str) => str.toLowerCase().replace(/[^\w\d]/g, '');
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1;
    
    // 简单的词汇重叠计算
    const words1 = norm1.split(/\s+/).filter(w => w.length > 2);
    const words2 = norm2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * 使用通用规则提取详情链接 - 优化版本
   * @param {Document} doc - DOM文档
   * @param {string} baseUrl - 基础URL
   * @param {string} searchKeyword - 搜索关键词
   * @param {string} baseDomain - 基础域名
   * @returns {Array} 详情链接数组
   */
  extractDetailLinksWithGenericRules(doc, baseUrl, searchKeyword, baseDomain) {
    console.log('=== 使用通用规则提取详情链接 ===');
    const detailLinks = [];
    
    try {
      // 通用选择器列表 - 更严格的顺序
      const genericSelectors = [
        // 优先查找包含番号的链接
        'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"])',
        // 然后查找带标题的链接
        'a[href*="/"][title]:not([href*="/search"])',
        // 最后查找容器内的链接
        '.item a, .movie a, .video a, .result a'
      ];

      for (const selector of genericSelectors) {
        console.log(`尝试通用选择器: ${selector}`);
        const links = doc.querySelectorAll(selector);
        console.log(`找到 ${links.length} 个候选链接`);
        
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href) continue;

          const fullUrl = this.resolveRelativeUrl(href, baseUrl);
          
          // 域名验证
          if (!this.isDomainMatch(fullUrl, baseDomain)) {
            console.log(`跳过不同域名: ${fullUrl}`);
            continue;
          }
          
          // 确保不是搜索URL本身
          if (this.normalizeUrl(fullUrl) === this.normalizeUrl(baseUrl)) {
            console.log(`跳过相同URL: ${fullUrl}`);
            continue;
          }
          
          // 简单验证
          if (!this.isGenericDetailLink(fullUrl)) {
            console.log(`跳过非详情链接: ${fullUrl}`);
            continue;
          }

          const title = link.getAttribute('title') || link.textContent?.trim() || '';
          const code = this.extractCodeFromText(title) || this.extractCodeFromText(fullUrl);
          
          // 如果有搜索关键词，只保留相关的链接
          if (searchKeyword) {
            const score = this.calculateMatchScore(title, code, searchKeyword);
            if (score < 20) {
              console.log(`跳过低分链接: ${fullUrl} (${score}分)`);
              continue; // 分数太低，跳过
            }
          }

          detailLinks.push({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score: searchKeyword ? this.calculateMatchScore(title, code, searchKeyword) : 50,
            extractedFrom: 'generic'
          });
        }

        if (detailLinks.length > 0) break; // 找到就停止
      }

      // 按分数排序
      detailLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
      
    } catch (error) {
      console.error('通用规则提取详情链接失败:', error);
    }

    console.log(`通用规则提取完成，找到 ${detailLinks.length} 个链接`);
    return detailLinks;
  }

  /**
   * 检查是否为通用详情链接
   * @param {string} url - URL
   * @returns {boolean} 是否为详情链接
   */
  isGenericDetailLink(url) {
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    
    // 排除明显的非详情页链接
    const excludePatterns = [
      '/search', '/category', '/tag', '/list', '/page', '?page',
      '/login', '/register', '/user', '/profile', '/settings',
      '/en', '/ja', '/ko', '/forum', '/doc', '/terms', '/privacy',
      '.css', '.js', '.png', '.jpg', '.gif', '.ico', '/#'
    ];
    
    if (excludePatterns.some(pattern => urlLower.includes(pattern))) {
      return false;
    }
    
    // 必须包含番号或特定详情页模式
    const detailPatterns = [
      /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,  // 直接番号路径
      /\/v\/[a-zA-Z0-9]+/,               // JavDB格式
      /\?v=[a-zA-Z0-9]+/,                // JavLibrary格式
      /\/videos\/[^\/]+/,                // Jable格式
      /\/view\/\d+/,                     // Sukebei格式
      /\/(watch|play|video|movie)\//     // 通用视频页面
    ];
    
    return detailPatterns.some(pattern => pattern.test(url));
  }

  /**
   * 从文本中提取番号
   * @param {string} text - 文本
   * @returns {string} 番号
   */
  extractCodeFromText(text) {
    if (!text) return '';
    
    // 常见番号格式正则表达式
    const patterns = [
      /([A-Z]{2,6}-?\d{3,6})/i,  // ABC-123, ABCD123
      /([A-Z]+\d{3,6})/i,        // ABC123
      /(\d{3,6}[A-Z]{2,6})/i     // 123ABC
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return '';
  }

  /**
   * 解析相对URL为绝对URL
   * @param {string} relativeUrl - 相对URL
   * @param {string} baseUrl - 基础URL
   * @returns {string} 绝对URL
   */
  resolveRelativeUrl(relativeUrl, baseUrl) {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;

    try {
      const base = new URL(baseUrl);
      const resolved = new URL(relativeUrl, base);
      return resolved.href;
    } catch (error) {
      console.warn('URL解析失败:', error.message);
      return relativeUrl;
    }
  }

  // === 以下是原有的详情页面解析方法，保持不变 ===

  /**
   * 解析详情页面内容
   * @param {string} htmlContent - HTML内容
   * @param {Object} options - 解析选项
   * @returns {Object} 解析后的详情信息
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { sourceType, originalUrl, originalTitle } = options;
    
    console.log(`开始解析详情页面内容，源类型: ${sourceType}`);

    try {
      // 使用专用的Cloudflare Workers HTML解析器
      const doc = cloudflareHTMLParser.parseFromString(htmlContent);

      // 获取详情页面解析规则
      const detailPageRules = parserRules.getDetailPageRules(sourceType);
      if (!detailPageRules) {
        console.warn(`未找到 ${sourceType} 的详情页面解析规则，使用通用规则`);
        return this.parseWithGenericRules(doc, originalUrl, originalTitle);
      }

      console.log(`使用 ${sourceType} 专用详情页解析规则`);

      // 应用解析规则
      const detailInfo = {
        sourceType,
        originalUrl,
        
        // 基本信息
        title: this.extractByRule(doc, detailPageRules.title),
        originalTitle: this.extractByRule(doc, detailPageRules.originalTitle),
        code: this.extractByRule(doc, detailPageRules.code),
        
        // 媒体信息
        coverImage: this.extractImageByRule(doc, detailPageRules.coverImage, originalUrl),
        screenshots: this.extractMultipleImagesByRule(doc, detailPageRules.screenshots, originalUrl),
        
        // 演员信息
        actresses: this.extractActressesByRule(doc, detailPageRules.actresses),
        director: this.extractByRule(doc, detailPageRules.director),
        studio: this.extractByRule(doc, detailPageRules.studio),
        label: this.extractByRule(doc, detailPageRules.label),
        series: this.extractByRule(doc, detailPageRules.series),
        
        // 发布信息
        releaseDate: this.extractByRule(doc, detailPageRules.releaseDate),
        duration: this.extractByRule(doc, detailPageRules.duration),
        
        // 技术信息
        quality: this.extractByRule(doc, detailPageRules.quality),
        fileSize: this.extractByRule(doc, detailPageRules.fileSize),
        resolution: this.extractByRule(doc, detailPageRules.resolution),
        
        // 下载信息
        downloadLinks: this.extractDownloadLinksByRule(doc, detailPageRules.downloadLinks, originalUrl),
        magnetLinks: this.extractMagnetLinksByRule(doc, detailPageRules.magnetLinks),
        
        // 其他信息
        description: this.extractByRule(doc, detailPageRules.description),
        tags: this.extractTagsByRule(doc, detailPageRules.tags),
        rating: this.extractRatingByRule(doc, detailPageRules.rating)
      };

      // 数据清理和验证
      const cleanedInfo = this.cleanAndValidateData(detailInfo);
      
      console.log(`详情页面解析完成，提取到 ${Object.keys(cleanedInfo).length} 个字段`);
      return cleanedInfo;

    } catch (error) {
      console.error('详情页面解析失败:', error);
      
      // 降级到通用解析
      try {
        const doc = cloudflareHTMLParser.parseFromString(htmlContent);
        return this.parseWithGenericRules(doc, originalUrl, originalTitle);
      } catch (fallbackError) {
        console.error('通用解析也失败:', fallbackError);
        throw new Error(`页面解析失败: ${error.message}`);
      }
    }
  }

  // 保持原有的其他解析方法...
  
  /**
   * 根据规则提取内容
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {string} 提取的内容
   */
  extractByRule(doc, rule) {
    if (!rule || !rule.selector) return '';

    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return '';

      let text = '';
      
      if (rule.attribute) {
        text = element.getAttribute(rule.attribute) || '';
      } else {
        text = element.textContent || element.innerText || '';
      }

      // 应用文本处理规则
      if (rule.transform) {
        text = this.applyTextTransform(text, rule.transform);
      }

      return text.trim();

    } catch (error) {
      console.warn(`提取失败 [${rule.selector}]:`, error.message);
      return '';
    }
  }

  /**
   * 提取图片URL
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {string} 图片URL
   */
  extractImageByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return '';

    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return '';

      let imageUrl = '';
      
      if (rule.attribute) {
        imageUrl = element.getAttribute(rule.attribute) || '';
      } else {
        imageUrl = element.getAttribute('src') || element.getAttribute('data-src') || '';
      }

      // 处理相对URL
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = this.resolveRelativeUrl(imageUrl, baseUrl);
      }

      return imageUrl;

    } catch (error) {
      console.warn(`图片提取失败 [${rule.selector}]:`, error.message);
      return '';
    }
  }

  /**
   * 提取多个图片URL
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {Array} 图片URL数组
   */
  extractMultipleImagesByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const imageUrls = [];

      elements.forEach(element => {
        let imageUrl = '';
        
        if (rule.attribute) {
          imageUrl = element.getAttribute(rule.attribute) || '';
        } else {
          imageUrl = element.getAttribute('src') || element.getAttribute('data-src') || '';
        }

        if (imageUrl) {
          if (!imageUrl.startsWith('http')) {
            imageUrl = this.resolveRelativeUrl(imageUrl, baseUrl);
          }
          imageUrls.push(imageUrl);
        }
      });

      return imageUrls;

    } catch (error) {
      console.warn(`多图片提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取演员信息
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 演员信息数组
   */
  extractActressesByRule(doc, rule) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const actresses = [];

      elements.forEach(element => {
        const name = element.textContent?.trim() || '';
        if (name) {
          const actress = { name };
          
          // 提取演员链接
          const link = element.getAttribute('href') || 
                      element.querySelector('a')?.getAttribute('href') || '';
          if (link) {
            actress.profileUrl = link;
          }

          // 提取演员头像
          const avatar = element.querySelector('img')?.getAttribute('src') || '';
          if (avatar) {
            actress.avatar = avatar;
          }

          actresses.push(actress);
        }
      });

      return actresses;

    } catch (error) {
      console.warn(`演员信息提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取下载链接
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {Array} 下载链接数组
   */
  extractDownloadLinksByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const downloadLinks = [];

      elements.forEach(element => {
        const url = element.getAttribute('href') || '';
        const name = element.textContent?.trim() || '下载链接';
        
        if (url) {
          const link = {
            name,
            url: this.resolveRelativeUrl(url, baseUrl),
            type: this.detectLinkType(url, name)
          };

          // 提取文件大小信息
          const sizeText = element.querySelector('.size, .filesize')?.textContent || '';
          if (sizeText) {
            link.size = sizeText.trim();
          }

          // 提取质量信息
          const qualityText = element.querySelector('.quality, .resolution')?.textContent || '';
          if (qualityText) {
            link.quality = qualityText.trim();
          }

          downloadLinks.push(link);
        }
      });

      return downloadLinks;

    } catch (error) {
      console.warn(`下载链接提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取磁力链接
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 磁力链接数组
   */
  extractMagnetLinksByRule(doc, rule) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const magnetLinks = [];

      elements.forEach(element => {
        const magnet = element.getAttribute('href') || element.textContent || '';
        
        if (magnet.startsWith('magnet:?xt=urn:btih:')) {
          const name = element.getAttribute('title') || 
                      element.querySelector('.name, .title')?.textContent?.trim() || 
                      '磁力链接';

          const link = { name, magnet };

          // 提取文件大小
          const sizeElement = element.querySelector('.size, .filesize') || 
                             element.parentElement?.querySelector('.size, .filesize');
          if (sizeElement) {
            link.size = sizeElement.textContent?.trim() || '';
          }

          // 提取种子信息
          const seedersElement = element.querySelector('.seeders, .seeds') ||
                                element.parentElement?.querySelector('.seeders, .seeds');
          if (seedersElement) {
            link.seeders = parseInt(seedersElement.textContent) || 0;
          }

          const leechersElement = element.querySelector('.leechers, .peers') ||
                                 element.parentElement?.querySelector('.leechers, .peers');
          if (leechersElement) {
            link.leechers = parseInt(leechersElement.textContent) || 0;
          }

          magnetLinks.push(link);
        }
      });

      return magnetLinks;

    } catch (error) {
      console.warn(`磁力链接提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取标签
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 标签数组
   */
  extractTagsByRule(doc, rule) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const tags = [];

      elements.forEach(element => {
        const tag = element.textContent?.trim() || '';
        if (tag && !tags.includes(tag)) {
          // 检查是否在排除列表中
          if (rule.excludeTexts && rule.excludeTexts.includes(tag)) {
            return;
          }
          tags.push(tag);
        }
      });

      return tags;

    } catch (error) {
      console.warn(`标签提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取评分
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {number} 评分
   */
  extractRatingByRule(doc, rule) {
    if (!rule || !rule.selector) return 0;

    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return 0;

      let ratingText = element.textContent?.trim() || '';
      
      if (rule.attribute) {
        ratingText = element.getAttribute(rule.attribute) || '';
      }

      // 解析评分数字
      const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
      if (ratingMatch) {
        return parseFloat(ratingMatch[1]);
      }

      return 0;

    } catch (error) {
      console.warn(`评分提取失败 [${rule.selector}]:`, error.message);
      return 0;
    }
  }

  /**
   * 应用文本转换
   * @param {string} text - 原始文本
   * @param {Array} transforms - 转换规则
   * @returns {string} 转换后的文本
   */
  applyTextTransform(text, transforms) {
    if (!Array.isArray(transforms)) return text;

    let result = text;

    transforms.forEach(transform => {
      switch (transform.type) {
        case 'replace':
          if (transform.pattern && transform.replacement !== undefined) {
            const regex = new RegExp(transform.pattern, transform.flags || 'g');
            result = result.replace(regex, transform.replacement);
          }
          break;
          
        case 'trim':
          result = result.trim();
          break;
          
        case 'uppercase':
          result = result.toUpperCase();
          break;
          
        case 'lowercase':
          result = result.toLowerCase();
          break;
          
        case 'extract':
          if (transform.pattern) {
            const regex = new RegExp(transform.pattern, transform.flags || '');
            const match = result.match(regex);
            if (match && match[transform.group || 1]) {
              result = match[transform.group || 1];
            }
          }
          break;
      }
    });

    return result;
  }

  /**
   * 检测链接类型
   * @param {string} url - 链接URL
   * @param {string} name - 链接名称
   * @returns {string} 链接类型
   */
  detectLinkType(url, name) {
    const urlLower = url.toLowerCase();
    const nameLower = name.toLowerCase();

    if (urlLower.includes('magnet:') || nameLower.includes('磁力')) {
      return 'magnet';
    }
    
    if (urlLower.includes('.torrent') || nameLower.includes('种子')) {
      return 'torrent';
    }
    
    if (urlLower.includes('ed2k:') || nameLower.includes('电驴')) {
      return 'ed2k';
    }
    
    if (urlLower.includes('ftp://') || nameLower.includes('ftp')) {
      return 'ftp';
    }
    
    if (urlLower.includes('pan.baidu.com') || nameLower.includes('百度网盘')) {
      return 'baidu_pan';
    }
    
    if (urlLower.includes('drive.google.com') || nameLower.includes('google drive')) {
      return 'google_drive';
    }

    return 'http';
  }

  /**
   * 通用解析规则（作为后备方案）
   * @param {Document} doc - DOM文档
   * @param {string} originalUrl - 原始URL
   * @param {string} originalTitle - 原始标题
   * @returns {Object} 解析结果
   */
  parseWithGenericRules(doc, originalUrl, originalTitle) {
    console.log('使用通用解析规则');

    try {
      const result = {
        title: originalTitle,
        originalUrl,
        sourceType: 'generic'
      };

      // 尝试从页面标题提取信息
      const pageTitle = doc.querySelector('title')?.textContent?.trim() || '';
      if (pageTitle && pageTitle !== originalTitle) {
        result.title = pageTitle;
      }

      // 尝试提取番号
      const codeMatch = (pageTitle || originalTitle).match(/([A-Z]{2,6}-?\d{3,6})/i);
      if (codeMatch) {
        result.code = codeMatch[1].toUpperCase();
      }

      // 尝试提取封面图片
      const possibleCoverSelectors = [
        'img[class*="cover"]',
        'img[class*="poster"]',
        'img[class*="thumb"]',
        '.cover img',
        '.poster img',
        '.thumbnail img',
        'img[src*="cover"]',
        'img[src*="poster"]'
      ];

      for (const selector of possibleCoverSelectors) {
        const img = doc.querySelector(selector);
        if (img) {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src) {
            result.coverImage = this.resolveRelativeUrl(src, originalUrl);
            break;
          }
        }
      }

      // 尝试提取描述
      const possibleDescSelectors = [
        '.description',
        '.summary',
        '.synopsis',
        '[class*="desc"]',
        '[class*="summary"]'
      ];

      for (const selector of possibleDescSelectors) {
        const desc = doc.querySelector(selector);
        if (desc) {
          result.description = desc.textContent?.trim() || '';
          if (result.description.length > 50) break;
        }
      }

      // 尝试提取磁力链接
      const magnetLinks = [];
      const magnetElements = doc.querySelectorAll('a[href^="magnet:"]');
      magnetElements.forEach(element => {
        const magnet = element.getAttribute('href');
        const name = element.textContent?.trim() || '磁力链接';
        if (magnet) {
          magnetLinks.push({ name, magnet });
        }
      });
      result.magnetLinks = magnetLinks;

      // 尝试提取下载链接
      const downloadLinks = [];
      const downloadElements = doc.querySelectorAll('a[href*="download"], a[class*="download"], .download a');
      downloadElements.forEach(element => {
        const url = element.getAttribute('href');
        const name = element.textContent?.trim() || '下载链接';
        if (url && !url.startsWith('magnet:')) {
          downloadLinks.push({
            name,
            url: this.resolveRelativeUrl(url, originalUrl),
            type: this.detectLinkType(url, name)
          });
        }
      });
      result.downloadLinks = downloadLinks;

      console.log('通用解析完成');
      return result;

    } catch (error) {
      console.error('通用解析失败:', error);
      return {
        title: originalTitle,
        originalUrl,
        sourceType: 'generic',
        extractionError: error.message
      };
    }
  }

  /**
   * 清理和验证数据
   * @param {Object} data - 原始数据
   * @returns {Object} 清理后的数据
   */
  cleanAndValidateData(data) {
    const cleaned = {};

    Object.keys(data).forEach(key => {
      const value = data[key];
      
      if (value === null || value === undefined) {
        return;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          cleaned[key] = trimmed;
        }
      } else if (Array.isArray(value)) {
        const filtered = value.filter(item => 
          item !== null && 
          item !== undefined && 
          (typeof item !== 'string' || item.trim())
        );
        if (filtered.length > 0) {
          cleaned[key] = filtered;
        }
      } else {
        cleaned[key] = value;
      }
    });

    return cleaned;
  }
}

// 创建单例实例
export const contentParser = new ContentParserService();
export default contentParser;
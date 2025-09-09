// src/services/search-link-extractor.js - 搜索页面详情链接提取服务
import { parserRules } from '../config/parser-rules.js';
import { cloudflareHTMLParser } from '../utils/html-parser.js';
import { extractionValidator } from './extraction-validator.js';
import { CONFIG } from '../constants.js';

export class SearchLinkExtractorService {
  constructor() {
    this.parseTimeout = CONFIG.DETAIL_EXTRACTION.PARSE_TIMEOUT; // 从配置引用
    this.maxRetries = CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS; // 从配置引用
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
      const baseDomain = extractionValidator.extractDomain(baseUrl);
      
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
      switch (sourceType) {
        case 'javbus':
          return this.extractJavBusDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case 'javdb':
          return this.extractJavDBDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case 'javlibrary':
          return this.extractJavLibraryDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case 'jable':
          return this.extractJableDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case 'sukebei':
          return this.extractSukebeiDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case 'javmost':
          return this.extractJavMostDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case 'javguru':
          return this.extractJavGuruDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case 'javgg':
          return this.extractJavGGDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        default:
          return this.extractWithConfiguredRules(doc, baseUrl, searchKeyword, baseDomain, selectors);
      }

    } catch (error) {
      console.error('=== 详情链接提取失败 ===');
      console.error('错误信息:', error.message);
      console.error('错误堆栈:', error.stack);
      return [];
    }
  }

  /**
   * 使用配置的规则提取详情链接
   */
  async extractWithConfiguredRules(doc, baseUrl, searchKeyword, baseDomain, selectors) {
    const detailLinks = [];

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
        const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
        
        console.log(`完整URL: ${fullUrl}`);

        // 增强版链接有效性验证
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
        
        const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
        
        // 验证域名一致性 - 支持子域名
        if (!extractionValidator.isDomainOrSubdomainMatch(fullUrl, baseDomain)) {
          console.log(`跳过不同域名: ${fullUrl}`);
          return;
        }
        
        // JavBus详情页必须包含番号路径
        if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl)) {
          console.log(`跳过非详情页: ${fullUrl}`);
          return;
        }
        
        // 避免搜索页面
        if (extractionValidator.containsSearchIndicators(fullUrl)) {
          console.log(`跳过搜索页: ${fullUrl}`);
          return;
        }
        
        // 确保不是与搜索URL相同
        if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
          console.log(`跳过相同URL: ${fullUrl}`);
          return;
        }
        
        // 提取标题和番号
        const img = box.querySelector('img');
        const title = img ? (img.getAttribute('title') || img.getAttribute('alt') || '') : '';
        const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
        
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
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          // 验证域名和格式
          if (extractionValidator.isDomainOrSubdomainMatch(fullUrl, baseDomain) && 
              /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl) &&
              !extractionValidator.containsSearchIndicators(fullUrl) &&
              extractionValidator.normalizeUrl(fullUrl) !== extractionValidator.normalizeUrl(baseUrl)) {
            
            const title = link.textContent?.trim() || link.getAttribute('title') || '';
            const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
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
          
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          // 验证域名一致性 - 支持子域名
          if (!extractionValidator.isDomainOrSubdomainMatch(fullUrl, baseDomain)) {
            console.log(`跳过不同域名: ${fullUrl}`);
            return;
          }
          
          // 确保不是搜索URL本身
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
            console.log(`跳过相同URL: ${fullUrl}`);
            return;
          }
          
          // JavDB详情页格式验证
          if (!/\/v\/[a-zA-Z0-9]+/.test(href) && !/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) {
            console.log(`跳过非详情格式: ${fullUrl}`);
            return;
          }
          
          // 避免搜索页面
          if (extractionValidator.containsSearchIndicators(fullUrl)) {
            console.log(`跳过搜索页: ${fullUrl}`);
            return;
          }
          
          // 提取标题信息
          const titleElement = link.querySelector('.video-title, .title, h4') || link;
          const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
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
          
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          // 验证域名一致性 - 支持子域名
          if (!extractionValidator.isDomainOrSubdomainMatch(fullUrl, baseDomain)) {
            console.log(`跳过不同域名: ${fullUrl}`);
            return;
          }
          
          // 确保不是搜索URL本身
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
            console.log(`跳过相同URL: ${fullUrl}`);
            return;
          }
          
          // JavLibrary详情页格式验证
          if (!fullUrl.includes('?v=')) {
            console.log(`跳过非详情格式: ${fullUrl}`);
            return;
          }
          
          const title = link.textContent?.trim() || link.getAttribute('title') || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
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
   * Jable专用详情链接提取 - 增强版本
   */
  extractJableDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    console.log('=== Jable专用提取开始 ===');
    const detailLinks = [];
    
    try {
      const videoSelectors = [
        '.video-item a[href*="/videos/"]',
        '.list-videos a[href*="/videos/"]',
        'a[href*="/videos/"]:not([href*="/search"])'
      ];
      
      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;
          
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          // Jable严格域名检查 - 必须是jable.tv域名
          const linkDomain = extractionValidator.extractDomain(fullUrl);
          if (linkDomain !== 'jable.tv') {
            console.log(`跳过非Jable域名: ${linkDomain}`);
            return;
          }
          
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (!(/\/videos\/[^\/\?]+/.test(fullUrl))) return;
          if (extractionValidator.containsSearchIndicators(fullUrl)) return;
          
          const titleElement = link.querySelector('.title, h4, .video-title') || link;
          const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
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
   * JavGG专用详情链接提取 - 新增方法
   */
  extractJavGGDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    console.log('=== JavGG专用提取开始 ===');
    const detailLinks = [];
    
    try {
      // JavGG的视频项目选择器
      const videoSelectors = [
        '.video-item a[href*="/jav/"]',
        '.movie-item a[href*="/jav/"]',
        'a[href*="/jav/"]:not([href*="/search"])'
      ];
      
      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;
          
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          // 验证域名一致性
          if (!extractionValidator.isDomainMatch(fullUrl, baseDomain)) {
            console.log(`跳过不同域名: ${fullUrl}`);
            return;
          }
          
          // 确保不是搜索URL本身
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
            console.log(`跳过相同URL: ${fullUrl}`);
            return;
          }
          
          // JavGG详情页格式验证
          if (!/\/jav\/[A-Z]{2,6}-?\d{3,6}[^\/]*\/?/i.test(fullUrl)) {
            console.log(`跳过非详情格式: ${fullUrl}`);
            return;
          }
          
          // 避免搜索页面
          if (extractionValidator.containsSearchIndicators(fullUrl)) {
            console.log(`跳过搜索页: ${fullUrl}`);
            return;
          }
          
          // 提取标题信息
          const titleElement = link.querySelector('.title, h3, .video-title') || link;
          const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          
          console.log(`找到JavGG详情: ${fullUrl}`);
          console.log(`  标题: ${title}`);
          console.log(`  番号: ${code}`);
          console.log(`  分数: ${score}`);
          
          detailLinks.push({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score,
            extractedFrom: 'javgg_video'
          });
        });
        
        if (detailLinks.length > 0) break;
      }
      
    } catch (error) {
      console.error('JavGG专用提取失败:', error);
    }
    
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    console.log(`JavGG提取完成，找到 ${uniqueLinks.length} 个有效链接`);
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
          
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          if (!extractionValidator.isDomainOrSubdomainMatch(fullUrl, baseDomain)) return;
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (!(/\/view\/\d+/.test(fullUrl))) return;
          
          const title = link.textContent?.trim() || link.getAttribute('title') || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
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
   * JavMost专用详情链接提取 - 支持子域名
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
          
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          // JavMost支持子域名检查
          const linkDomain = extractionValidator.extractDomain(fullUrl);
          if (!extractionValidator.isDomainOrSubdomain(linkDomain, 'javmost.com')) {
            console.log(`跳过非JavMost域名: ${linkDomain}`);
            return;
          }
          
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (extractionValidator.containsSearchIndicators(fullUrl)) return;
          
          // JavMost通常包含番号或特定路径
          const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(fullUrl);
          if (!hasCodePattern) return;
          
          const title = link.textContent?.trim() || link.getAttribute('title') || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
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
          
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          if (!extractionValidator.isDomainOrSubdomainMatch(fullUrl, baseDomain)) return;
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (extractionValidator.containsSearchIndicators(fullUrl)) return;
          
          // JavGuru的详情页特征
          const hasDetailPattern = /\/(watch|video|play)\//.test(fullUrl.toLowerCase()) || 
                                 /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl);
          if (!hasDetailPattern) return;
          
          const title = link.textContent?.trim() || link.getAttribute('title') || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
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
   * 使用通用规则提取详情链接 - 优化版本
   */
  extractDetailLinksWithGenericRules(doc, baseUrl, searchKeyword, baseDomain) {
    console.log('=== 使用通用规则提取详情链接 ===');
    const detailLinks = [];
    const maxGenericLinks = CONFIG.DETAIL_EXTRACTION.MAX_GENERIC_LINKS_PER_PAGE; // 从配置引用
    
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
        
        let processedCount = 0;
        for (const link of links) {
          // 限制处理数量以提高性能
          if (processedCount >= maxGenericLinks) {
            console.log(`已达到通用链接处理限制 (${maxGenericLinks})，停止处理`);
            break;
          }
          
          const href = link.getAttribute('href');
          if (!href) continue;

          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          
          // 域名验证 - 支持子域名
          if (!extractionValidator.isDomainOrSubdomainMatch(fullUrl, baseDomain)) {
            console.log(`跳过不同域名: ${fullUrl}`);
            continue;
          }
          
          // 确保不是搜索URL本身
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
            console.log(`跳过相同URL: ${fullUrl}`);
            continue;
          }
          
          // 简单验证
          if (!this.isGenericDetailLink(fullUrl)) {
            console.log(`跳过非详情链接: ${fullUrl}`);
            continue;
          }

          const title = link.getAttribute('title') || link.textContent?.trim() || '';
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          
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
          
          processedCount++;
        }

        if (detailLinks.length > 0) break; // 找到就停止
      }

      // 按分数排序
      detailLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
      
    } catch (error) {
      console.error('通用规则提取详情链接失败:', error);
    }

    console.log(`通用规则提取完成，找到 ${detailLinks.length} 个链接 (限制: ${maxGenericLinks})`);
    return detailLinks;
  }

  /**
   * 检查是否为通用详情链接
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
      /\/jav\/[^\/]+/,                   // JavGG格式
      /\/view\/\d+/,                     // Sukebei格式
      /\/(watch|play|video|movie)\//     // 通用视频页面
    ];
    
    return detailPatterns.some(pattern => pattern.test(url));
  }

  /**
   * 增强版链接有效性验证
   */
  isValidDetailLink(url, selectorConfig, sourceType, expectedDomain, baseUrl) {
    if (!url || typeof url !== 'string') return false;
    
    // 1. 域名一致性检查（HTTP链接）
    if (url.startsWith('http')) {
      const urlDomain = extractionValidator.extractDomain(url);
      
      // 检查域名模式匹配（支持子域名）
      if (selectorConfig.allowedDomainPatterns && selectorConfig.allowedDomainPatterns.length > 0) {
        const domainMatches = selectorConfig.allowedDomainPatterns.some(pattern => 
          pattern.test && pattern.test(urlDomain)
        );
        if (!domainMatches) {
          console.log(`⌧ 域名不匹配模式: ${urlDomain}`);
          return false;
        }
      } else if (selectorConfig.strictDomainCheck !== false) {
        // 标准域名检查 - 支持子域名
        if (!extractionValidator.isDomainOrSubdomain(urlDomain, expectedDomain)) {
          console.log(`⌧ 域名不匹配: ${urlDomain} != ${expectedDomain}`);
          return false;
        }
      }
    }
    
    // 2. 确保不是搜索URL本身
    if (extractionValidator.normalizeUrl(url) === extractionValidator.normalizeUrl(baseUrl)) {
      console.log(`⌧ 与搜索URL相同: ${url}`);
      return false;
    }
    
    // 3. 检查搜索指示器
    if (extractionValidator.containsSearchIndicators(url)) {
      console.log(`⌧ 包含搜索指示器: ${url}`);
      return false;
    }
    
    // 4. 根据源类型进行专门验证
    return extractionValidator.isValidDetailPageUrl(url, sourceType, expectedDomain);
  }

  /**
   * 提取链接相关信息
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
        code = extractionValidator.extractCodeFromText(title);
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
   * 去重链接
   */
  removeDuplicateLinks(links) {
    const seen = new Set();
    return links.filter(link => {
      const normalizedUrl = extractionValidator.normalizeUrl(link.url);
      if (seen.has(normalizedUrl)) {
        return false;
      }
      seen.add(normalizedUrl);
      return true;
    });
  }
}

// 创建单例实例
export const searchLinkExtractor = new SearchLinkExtractorService();
export default searchLinkExtractor;
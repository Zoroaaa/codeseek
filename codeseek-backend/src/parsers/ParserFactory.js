// src/parsers/ParserFactory.js - 解析器工厂类

import { BaseParser } from './BaseParser.js';
import { JavBusParser } from './JavBusParser.js';
import { JavDBParser } from './JavDBParser.js';
import { JableParser } from './JableParser.js';
import { JavGGParser } from './JavGGParser.js';
import { JavMostParser } from './JavMostParser.js';
import { SukebeiParser } from './SukebeiParser.js';
import { JavGuruParser } from './JavGuruParser.js';
import { GenericParser } from './GenericParser.js';

/**
 * 解析器工厂类
 * 负责创建和管理不同站点的解析器实例
 */
export class ParserFactory {
  constructor() {
    this.parsers = new Map();
    this.supportedSites = new Map();
    this.initializeParsers();
  }

  /**
   * 初始化所有支持的解析器
   */
  initializeParsers() {
    // 注册所有站点解析器
    this.registerParser('javbus', JavBusParser);
    this.registerParser('javdb', JavDBParser);
    this.registerParser('jable', JableParser);
    this.registerParser('javgg', JavGGParser);
    this.registerParser('javmost', JavMostParser);
    this.registerParser('sukebei', SukebeiParser);
    this.registerParser('javguru', JavGuruParser);
    this.registerParser('generic', GenericParser);

    console.log(`解析器工厂初始化完成，支持 ${this.supportedSites.size} 个站点`);
  }

  /**
   * 注册解析器类
   * @param {string} sourceType - 站点类型
   * @param {Class} ParserClass - 解析器类
   */
  registerParser(sourceType, ParserClass) {
    if (!sourceType || !ParserClass) {
      throw new Error('站点类型和解析器类都不能为空');
    }

    // 验证解析器类是否继承自BaseParser
    if (!this.isValidParserClass(ParserClass)) {
      throw new Error(`${ParserClass.name} 必须继承自 BaseParser`);
    }

    this.supportedSites.set(sourceType, ParserClass);
    console.log(`注册解析器: ${sourceType} -> ${ParserClass.name}`);
  }

  /**
   * 验证解析器类是否有效
   * @param {Class} ParserClass - 解析器类
   * @returns {boolean} 是否有效
   */
  isValidParserClass(ParserClass) {
    try {
      const instance = new ParserClass();
      return instance instanceof BaseParser;
    } catch (error) {
      console.warn(`解析器类验证失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取解析器实例
   * @param {string} sourceType - 站点类型
   * @returns {BaseParser} 解析器实例
   */
  getParser(sourceType) {
    const normalizedType = this.normalizeSourceType(sourceType);
    
    // 检查缓存
    if (this.parsers.has(normalizedType)) {
      return this.parsers.get(normalizedType);
    }

    // 创建新的解析器实例
    const parser = this.createParser(normalizedType);
    if (parser) {
      this.parsers.set(normalizedType, parser);
      console.log(`创建解析器实例: ${normalizedType}`);
    }

    return parser;
  }

  /**
   * 创建解析器实例
   * @param {string} sourceType - 站点类型
   * @returns {BaseParser|null} 解析器实例
   */
  createParser(sourceType) {
    const ParserClass = this.supportedSites.get(sourceType);
    
    if (!ParserClass) {
      console.warn(`不支持的站点类型: ${sourceType}，使用通用解析器`);
      return this.createParser('generic');
    }

    try {
      const parser = new ParserClass();
      console.log(`成功创建 ${sourceType} 解析器`);
      return parser;
    } catch (error) {
      console.error(`创建 ${sourceType} 解析器失败:`, error);
      
      // 如果不是通用解析器，尝试使用通用解析器
      if (sourceType !== 'generic') {
        console.log(`回退到通用解析器`);
        return this.createParser('generic');
      }
      
      return null;
    }
  }

  /**
   * 标准化站点类型
   * @param {string} sourceType - 原始站点类型
   * @returns {string} 标准化的站点类型
   */
  normalizeSourceType(sourceType) {
    if (!sourceType || typeof sourceType !== 'string') {
      return 'generic';
    }

    return sourceType.toLowerCase().trim();
  }

  /**
   * 从URL检测站点类型
   * @param {string} url - URL
   * @returns {string} 检测到的站点类型
   */
  detectSourceTypeFromUrl(url) {
    if (!url || typeof url !== 'string') {
      return 'generic';
    }

    const urlLower = url.toLowerCase();
    
    // URL模式匹配
    const patterns = {
      'javbus': /javbus\.com/,
      'javdb': /javdb\.com/,
      'jable': /jable\.tv/,
      'javgg': /javgg\.net/,
      'javmost': /javmost\.com/,
      'sukebei': /sukebei\.nyaa\.si/,
      'javguru': /jav\.guru/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(urlLower)) {
        return type;
      }
    }

    return 'generic';
  }

  /**
   * 获取支持的站点类型列表
   * @returns {Array} 站点类型数组
   */
  getSupportedSites() {
    return Array.from(this.supportedSites.keys());
  }

  /**
   * 获取所有解析器的信息
   * @returns {Array} 解析器信息数组
   */
  getAllParsersInfo() {
    const parsersInfo = [];
    
    for (const [sourceType, ParserClass] of this.supportedSites.entries()) {
      try {
        const parser = new ParserClass();
        parsersInfo.push({
          sourceType,
          className: ParserClass.name,
          siteInfo: parser.getSiteInfo(),
          isActive: this.parsers.has(sourceType)
        });
      } catch (error) {
        parsersInfo.push({
          sourceType,
          className: ParserClass.name,
          error: error.message,
          isActive: false
        });
      }
    }
    
    return parsersInfo;
  }

  /**
   * 重新加载解析器
   * @param {string} sourceType - 站点类型
   * @returns {boolean} 是否重载成功
   */
  reloadParser(sourceType) {
    const normalizedType = this.normalizeSourceType(sourceType);
    
    // 删除缓存的实例
    if (this.parsers.has(normalizedType)) {
      this.parsers.delete(normalizedType);
      console.log(`清除缓存的解析器: ${normalizedType}`);
    }
    
    // 重新创建
    const parser = this.getParser(normalizedType);
    return parser !== null;
  }

  /**
   * 清除所有缓存的解析器实例
   */
  clearCache() {
    const count = this.parsers.size;
    this.parsers.clear();
    console.log(`清除了 ${count} 个缓存的解析器实例`);
  }

  /**
   * 获取解析器统计信息
   * @returns {Object} 统计信息
   */
  getStatistics() {
    return {
      supportedSites: this.supportedSites.size,
      cachedParsers: this.parsers.size,
      supportedSitesList: this.getSupportedSites(),
      cachedParsersList: Array.from(this.parsers.keys())
    };
  }

  /**
   * 验证解析器是否正常工作
   * @param {string} sourceType - 站点类型
   * @returns {Object} 验证结果
   */
  async validateParser(sourceType) {
    const result = {
      sourceType,
      isValid: false,
      errors: [],
      features: []
    };

    try {
      const parser = this.getParser(sourceType);
      
      if (!parser) {
        result.errors.push('无法创建解析器实例');
        return result;
      }

      // 检查必需的方法是否存在
      const requiredMethods = ['extractDetailLinks', 'parseDetailPage'];
      for (const method of requiredMethods) {
        if (typeof parser[method] !== 'function') {
          result.errors.push(`缺少必需的方法: ${method}`);
        }
      }

      // 获取支持的功能
      if (typeof parser.getSupportedFeatures === 'function') {
        result.features = parser.getSupportedFeatures();
      }

      // 检查站点信息
      if (typeof parser.getSiteInfo === 'function') {
        const siteInfo = parser.getSiteInfo();
        result.siteInfo = siteInfo;
      }

      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push(`解析器验证失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 批量验证所有解析器
   * @returns {Array} 验证结果数组
   */
  async validateAllParsers() {
    const results = [];
    
    for (const sourceType of this.getSupportedSites()) {
      const result = await this.validateParser(sourceType);
      results.push(result);
    }
    
    return results;
  }
}

// 创建单例实例
export const parserFactory = new ParserFactory();

export default parserFactory;
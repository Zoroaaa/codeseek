/**
 * 配置管理器 - 统一管理所有配置项
 */
export const CONFIG = {
  // 版本信息
  VERSION: '4.0.0',
  
  // 环境配置
  ENVIRONMENT: 'production',
  DEBUG: false,
  
  // 代理配置
  ALLOW_DIRECT_ACCESS: true,
  ENABLE_FAILOVER: true,
  FAILOVER_TIMEOUT: 5000,
  MAX_REDIRECTS: 10,
  REQUEST_TIMEOUT: 30000,
  
  // 允许的代理目标 - 扩展列表
  ALLOWED_TARGETS: [
    // 现有的目标
    'www.javbus.com', 'javbus.com',
    'javdb.com', 'www.javdb.com',
    'www.javlibrary.com', 'javlibrary.com',
    'sukebei.nyaa.si', 'btsow.com', 'www.btsow.com',
    'magnetdl.com', 'www.magnetdl.com',
    'torrentkitty.tv', 'www.torrentkitty.tv',
    'jable.tv', 'www.jable.tv',
    'javmost.com', 'www.javmost.com',
    'jav.guru', 'www.jav.guru',
    'av01.tv', 'www.av01.tv',
    'missav.com', 'www.missav.com',
    'javhd.porn', 'www.javhd.porn',
    'javgg.net', 'www.javgg.net',
    'javhihi.com', 'www.javhihi.com',
    'sehuatang.org', 'www.sehuatang.org',
    't66y.com', 'www.t66y.com',
    
    // 新增的通用目标
    'thepiratebay.org', 'www.thepiratebay.org',
    '1337x.to', 'www.1337x.to',
    'rarbg.to', 'www.rarbg.to',
    'yts.mx', 'www.yts.mx',
    'eztv.re', 'www.eztv.re',
    'limetor.pro', 'www.limetor.pro',
    'torrentgalaxy.to', 'www.torrentgalaxy.to',
    'zooqle.com', 'www.zooqle.com',
    'torlock.com', 'www.torlock.com',
    'kickasstorrents.to', 'www.kickasstorrents.to'
  ],
  
  // 缓存配置
  CACHE_SETTINGS: {
    HTML: 5 * 60 * 1000,        // 5分钟
    CSS: 60 * 60 * 1000,        // 1小时
    JS: 60 * 60 * 1000,         // 1小时
    IMAGE: 24 * 60 * 60 * 1000, // 24小时
    FONT: 7 * 24 * 60 * 60 * 1000, // 7天
    API: 60 * 1000,             // 1分钟
    OTHER: 30 * 60 * 1000,      // 30分钟
    MAX_SIZE: 10 * 1024 * 1024  // 10MB
  },
  
  // 安全配置
  SECURITY: {
    BLOCK_MALICIOUS_SCRIPTS: true,
    SANITIZE_HTML: true,
    BLOCK_ADS: true,
    MAX_CONTENT_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_PROTOCOLS: ['http:', 'https:', 'magnet:', 'thunder:', 'ed2k:']
  },
  
  // 处理器配置
  PROCESSORS: {
    HTML: {
      INJECT_PROXY_SCRIPT: true,
      REWRITE_URLS: true,
      PROCESS_FORMS: true,
      HANDLE_WEBSOCKETS: true
    },
    CSS: {
      REWRITE_URLS: true,
      PROCESS_IMPORTS: true,
      HANDLE_FONTS: true
    },
    JS: {
      REWRITE_URLS: true,
      HANDLE_APIS: true,
      PROCESS_MODULES: true
    }
  },
  
  // 特殊处理模式
  SPECIAL_HANDLING: {
    MAGNET_LINKS: true,
    DOWNLOAD_LINKS: true,
    TORRENT_FILES: true,
    ED2K_LINKS: true,
    THUNDER_LINKS: true
  },
  
  // 用户代理
  USER_AGENTS: {
    CHROME: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    FIREFOX: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    SAFARI: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    MOBILE: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  },
  
  // CORS配置
  CORS: {
    ALLOW_ORIGIN: '*',
    ALLOW_METHODS: '*',
    ALLOW_HEADERS: '*',
    ALLOW_CREDENTIALS: 'true',
    MAX_AGE: '86400',
    EXPOSE_HEADERS: '*'
  },
  
  // 备用域名
  BACKUP_DOMAINS: [],
  EXTRA_PROXY_TARGETS: [],
  
  /**
   * 初始化配置
   */
  init(env) {
    if (!env) return;
    
    // 从环境变量加载配置
    this.ENVIRONMENT = env.ENVIRONMENT || this.ENVIRONMENT;
    this.DEBUG = env.DEBUG === 'true';
    this.ALLOW_DIRECT_ACCESS = env.ALLOW_DIRECT_ACCESS !== 'false';
    this.ENABLE_FAILOVER = env.ENABLE_FAILOVER !== 'false';
    this.FAILOVER_TIMEOUT = parseInt(env.FAILOVER_TIMEOUT) || this.FAILOVER_TIMEOUT;
    this.MAX_REDIRECTS = parseInt(env.MAX_REDIRECTS) || this.MAX_REDIRECTS;
    
    // 处理额外的代理目标
    if (env.EXTRA_PROXY_TARGETS) {
      this.EXTRA_PROXY_TARGETS = env.EXTRA_PROXY_TARGETS
        .split(',')
        .map(t => t.trim())
        .filter(t => t);
      this.ALLOWED_TARGETS = [...this.ALLOWED_TARGETS, ...this.EXTRA_PROXY_TARGETS];
    }
    
    // 处理备用域名
    if (env.BACKUP_DOMAINS) {
      this.BACKUP_DOMAINS = env.BACKUP_DOMAINS
        .split(',')
        .map(d => d.trim())
        .filter(d => d);
    }
    
    // 日志初始化信息
    if (this.DEBUG) {
      console.log('CONFIG initialized:', {
        version: this.VERSION,
        environment: this.ENVIRONMENT,
        allowedTargets: this.ALLOWED_TARGETS.length,
        backupDomains: this.BACKUP_DOMAINS.length
      });
    }
  },
  
  /**
   * 检查是否为有效的代理目标
   */
  isValidProxyTarget(hostname) {
    if (!hostname) return false;
    
    const cleanHostname = hostname.toLowerCase().replace(/^www\./, '');
    const withWww = 'www.' + cleanHostname;
    
    return this.ALLOWED_TARGETS.some(target => {
      const cleanTarget = target.toLowerCase().replace(/^www\./, '');
      return cleanTarget === cleanHostname || target === withWww;
    });
  },
  
  /**
   * 获取缓存TTL
   */
  getCacheTTL(contentType) {
    if (!contentType) return this.CACHE_SETTINGS.OTHER;
    
    const type = contentType.toLowerCase();
    
    if (type.includes('text/html')) return this.CACHE_SETTINGS.HTML;
    if (type.includes('text/css') || type.includes('stylesheet')) return this.CACHE_SETTINGS.CSS;
    if (type.includes('javascript')) return this.CACHE_SETTINGS.JS;
    if (type.includes('image/')) return this.CACHE_SETTINGS.IMAGE;
    if (type.includes('font/') || type.includes('woff')) return this.CACHE_SETTINGS.FONT;
    if (type.includes('application/json')) return this.CACHE_SETTINGS.API;
    
    return this.CACHE_SETTINGS.OTHER;
  },
  
  /**
   * 获取随机用户代理
   */
  getRandomUserAgent() {
    const agents = Object.values(this.USER_AGENTS);
    return agents[Math.floor(Math.random() * agents.length)];
  }
};
/**
 * 路由管理器 - 支持中间件和路径匹配
 * 修复版本：解决请求对象包装问题
 */
export class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }

  /**
   * 添加中间件
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * 添加路由
   */
  addRoute(method, path, handler) {
    this.routes.push({
      method: method.toUpperCase(),
      path: this.pathToRegex(path),
      handler,
      originalPath: path
    });
  }

  /**
   * HTTP方法快捷方式
   */
  get(path, handler) { this.addRoute('GET', path, handler); }
  post(path, handler) { this.addRoute('POST', path, handler); }
  put(path, handler) { this.addRoute('PUT', path, handler); }
  delete(path, handler) { this.addRoute('DELETE', path, handler); }
  patch(path, handler) { this.addRoute('PATCH', path, handler); }
  all(path, handler) { this.addRoute('*', path, handler); }

  /**
   * 将路径转换为正则表达式
   */
  pathToRegex(path) {
    // 处理参数路径，如 /proxy/:hostname/*
    const paramRegex = path
      .replace(/\*/g, '(.*)')
      .replace(/:([^/]+)/g, '([^/]+)')
      .replace(/\//g, '\\/');
    
    return new RegExp(`^${paramRegex}$`);
  }

  /**
   * 提取路径参数
   */
  extractParams(path, originalPath, url) {
    const params = {};
    const pathSegments = originalPath.split('/');
    const urlSegments = new URL(url).pathname.split('/');

    pathSegments.forEach((segment, index) => {
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1);
        params[paramName] = decodeURIComponent(urlSegments[index] || '');
      } else if (segment === '*') {
        params.wildcard = urlSegments.slice(index).join('/');
      }
    });

    return params;
  }

  /**
   * 处理请求
   */
  async handle(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const pathname = url.pathname;

    // 寻找匹配的路由
    for (const route of this.routes) {
      if ((route.method === '*' || route.method === method) && 
          route.path.test(pathname)) {
        
        // 提取路径参数
        const params = this.extractParams(route.path, route.originalPath, request.url);
        
        // 创建增强的请求对象 - 修复版本
        const enhancedRequest = this.enhanceRequest(request, params, env, ctx);
        
        try {
          // 执行中间件
          for (const middleware of this.middlewares) {
            const middlewareResult = await middleware(enhancedRequest, env, ctx);
            if (middlewareResult instanceof Response) {
              return middlewareResult;
            }
          }

          // 执行路由处理器
          return await route.handler(enhancedRequest, env, ctx);
          
        } catch (error) {
          console.error(`Route handler error for ${pathname}:`, error);
          
          return new Response(JSON.stringify({
            error: 'Route processing error',
            path: pathname,
            message: error.message,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
    }

    // 404 - 未找到路由
    return new Response(JSON.stringify({
      error: 'Not Found',
      path: pathname,
      method: method,
      timestamp: new Date().toISOString()
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /**
   * 增强请求对象 - 修复版本：使用Proxy保持原始Request对象的完整性
   */
  enhanceRequest(request, params, env, ctx) {
    // 使用Proxy来保持原始Request对象的所有方法和属性
    const enhancedRequest = new Proxy(request, {
      get(target, prop, receiver) {
        // 添加自定义属性
        switch (prop) {
          case 'params':
            return params;
          case 'env':
            return env;
          case 'ctx':
            return ctx;
          case 'parsedUrl':
            return new URL(target.url);
          case '_originalRequest':
            return target;
          case 'corsHeaders':
            // 初始化CORS头（防止中间件未运行时出错）
            return target._corsHeaders || {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': '*',
              'Access-Control-Allow-Headers': '*',
              'Access-Control-Max-Age': '86400'
            };
          case 'rateLimitHeaders':
            return target._rateLimitHeaders;
          case 'cacheKey':
            return target._cacheKey;
          case 'proxyTarget':
            return target._proxyTarget;
          case 'startTime':
            return target._startTime;
          default:
            // 对于所有其他属性和方法，使用原始对象
            const value = Reflect.get(target, prop, receiver);
            // 如果是函数，绑定到原始对象
            return typeof value === 'function' ? value.bind(target) : value;
        }
      },
      
      set(target, prop, value, receiver) {
        // 允许设置自定义属性
        switch (prop) {
          case 'corsHeaders':
            target._corsHeaders = value;
            return true;
          case 'rateLimitHeaders':
            target._rateLimitHeaders = value;
            return true;
          case 'cacheKey':
            target._cacheKey = value;
            return true;
          case 'proxyTarget':
            target._proxyTarget = value;
            return true;
          case 'startTime':
            target._startTime = value;
            return true;
          default:
            // 对于其他属性，尝试设置到原始对象
            return Reflect.set(target, prop, value, receiver);
        }
      },
      
      has(target, prop) {
        // 检查自定义属性
        const customProps = ['params', 'env', 'ctx', 'parsedUrl', '_originalRequest', 
                            'corsHeaders', 'rateLimitHeaders', 'cacheKey', 'proxyTarget', 'startTime'];
        if (customProps.includes(prop)) {
          return true;
        }
        return Reflect.has(target, prop);
      },
      
      ownKeys(target) {
        const customProps = ['params', 'env', 'ctx', 'parsedUrl'];
        const originalKeys = Reflect.ownKeys(target);
        return [...new Set([...originalKeys, ...customProps])];
      },
      
      getOwnPropertyDescriptor(target, prop) {
        const customProps = ['params', 'env', 'ctx', 'parsedUrl'];
        if (customProps.includes(prop)) {
          return {
            enumerable: true,
            configurable: true,
            writable: true
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
    });
    
    return enhancedRequest;
  }

  /**
   * 获取路由统计信息
   */
  getRouteStats() {
    return {
      totalRoutes: this.routes.length,
      totalMiddlewares: this.middlewares.length,
      routesByMethod: this.routes.reduce((acc, route) => {
        acc[route.method] = (acc[route.method] || 0) + 1;
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 清理路由（如果需要动态管理路由）
   */
  clearRoutes() {
    this.routes = [];
  }

  /**
   * 清理中间件
   */
  clearMiddlewares() {
    this.middlewares = [];
  }

  /**
   * 重置路由器
   */
  reset() {
    this.clearRoutes();
    this.clearMiddlewares();
  }
}
// src/handlers/static.js - 静态资源处理器
class StaticHandler {
  /**
   * Favicon处理
   */
  static async favicon(request, env, ctx) {
    // 返回一个简单的透明favicon
    const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#4CAF50" stroke="#2E7D32" stroke-width="2"/>
      <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">P</text>
    </svg>`;
    
    return new Response(faviconSVG, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
        ...request.corsHeaders
      }
    });
  }

  /**
   * Robots.txt处理
   */
  static async robots(request, env, ctx) {
    const robotsTxt = `User-agent: *
Allow: /

# Proxy service for educational purposes
# Version: ${CONFIG.VERSION}
# Contact: See GitHub repository

Sitemap: ${new URL(request.url).origin}/sitemap.xml`;

    return new Response(robotsTxt, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
        ...request.corsHeaders
      }
    });
  }

  /**
   * 站点地图处理
   */
  static async sitemap(request, env, ctx) {
    const baseURL = new URL(request.url).origin;
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseURL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseURL}/api/health</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseURL}/api/status</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
        ...request.corsHeaders
      }
    });
  }

  /**
   * 默认首页
   */
  static async index(request, env, ctx) {
    const baseURL = new URL(request.url).origin;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Proxy Service v${CONFIG.VERSION}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; margin: 0; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 0.5rem; }
    .status { background: #e8f5e8; border: 1px solid #4CAF50; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    .feature { background: #f9f9f9; padding: 0.5rem 1rem; margin: 0.5rem 0; border-left: 4px solid #2196F3; }
    .endpoint { font-family: monospace; background: #333; color: #fff; padding: 0.5rem; border-radius: 4px; display: inline-block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .card { background: #f9f9f9; padding: 1rem; border-radius: 4px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Enhanced Proxy Service v${CONFIG.VERSION}</h1>
    
    <div class="status">
      <strong>✅ Service Active</strong> - Proxy service is running and ready to handle requests.
    </div>
    
    <h2>🔗 Usage</h2>
    <p>Use the proxy by accessing: <code class="endpoint">${baseURL}/proxy/HOSTNAME/PATH</code></p>
    <p><strong>Example:</strong> <code class="endpoint">${baseURL}/proxy/example.com/page.html</code></p>
    
    <h2>✨ Features</h2>
    <div class="grid">
      <div class="card">
        <h3>🌐 Smart URL Rewriting</h3>
        <p>Automatically rewrites all URLs in HTML, CSS, and JavaScript content</p>
      </div>
      <div class="card">
        <h3>🔄 Redirect Handling</h3>
        <p>Intelligent redirect processing with loop detection (max ${CONFIG.MAX_REDIRECTS})</p>
      </div>
      <div class="card">
        <h3>🧲 Magnet Link Support</h3>
        <p>Preserves magnet:, thunder:, and ed2k: links without modification</p>
      </div>
      <div class="card">
        <h3>💾 Smart Caching</h3>
        <p>Resource-type based caching for optimal performance</p>
      </div>
      <div class="card">
        <h3>🛡️ Security Filtering</h3>
        <p>Malicious content blocking and security header management</p>
      </div>
      <div class="card">
        <h3>📱 Full Compatibility</h3>
        <p>Supports forms, WebSockets, and responsive design</p>
      </div>
    </div>
    
    <h2>🔧 API Endpoints</h2>
    <div class="feature">
      <code class="endpoint">GET ${baseURL}/api/health</code> - Health check and feature list
    </div>
    <div class="feature">
      <code class="endpoint">GET ${baseURL}/api/status</code> - Service status and statistics
    </div>
    <div class="feature">
      <code class="endpoint">GET ${baseURL}/api/cache/stats</code> - Cache performance metrics
    </div>
    <div class="feature">
      <code class="endpoint">POST ${baseURL}/api/cache/clear</code> - Clear proxy cache
    </div>
    
    <h2>📊 Configuration</h2>
    <ul>
      <li><strong>Allowed Targets:</strong> ${CONFIG.ALLOWED_TARGETS.length} domains</li>
      <li><strong>Max Redirects:</strong> ${CONFIG.MAX_REDIRECTS}</li>
      <li><strong>Request Timeout:</strong> ${CONFIG.REQUEST_TIMEOUT / 1000}s</li>
      <li><strong>Failover:</strong> ${CONFIG.ENABLE_FAILOVER ? 'Enabled' : 'Disabled'}</li>
      <li><strong>Debug Mode:</strong> ${CONFIG.DEBUG ? 'Enabled' : 'Disabled'}</li>
    </ul>
    
    <footer style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #666; text-align: center;">
      <p>Enhanced Proxy Service v${CONFIG.VERSION} | Built with ❤️ for better web access</p>
    </footer>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...request.corsHeaders
      }
    });
  }
}

export default StaticHandler;
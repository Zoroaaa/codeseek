// 主页面模板
import { commonStyles, mainPageStyles } from '../styles/common.js';

export function getMainPageTemplate() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Proxy Worker v2.0.0</title>
  <style>
    ${commonStyles}
    ${mainPageStyles}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Enhanced Proxy Worker</h1>
      <p class="subtitle">安全、快速、现代化的网络代理服务</p>
      <div class="version-badge">v2.0.0</div>
    </div>

    <div class="proxy-card">
      <div class="usage-section">
        <h2 class="usage-title">使用方法</h2>
        <p>在当前网站URL后面添加要访问的网站地址：</p>
        <div class="usage-example">https://当前网址/github.com</div>
        <div class="usage-example">https://当前网址/https://github.com</div>
      </div>

      <form class="proxy-form" onsubmit="redirectToProxy(event)">
        <div class="form-group">
          <label class="form-label" for="targetUrl">输入目标网址</label>
          <input 
            type="text" 
            id="targetUrl" 
            class="form-input"
            placeholder="例如：github.com 或 https://github.com"
            autocomplete="off"
          >
        </div>
        <button type="submit" class="btn">开始访问</button>
      </form>

      <div class="features-grid">
        <div class="feature-item">
          <span class="feature-icon">🌐</span>
          <div class="feature-title">完整代理</div>
          <div class="feature-desc">支持完整的网页内容代理，包括JavaScript和CSS资源处理</div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">⚡</span>
          <div class="feature-title">智能缓存</div>
          <div class="feature-desc">KV缓存支持，提升访问速度和用户体验</div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">🔄</span>
          <div class="feature-title">URL重写</div>
          <div class="feature-desc">智能URL重写系统，确保所有链接正常工作</div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">📊</span>
          <div class="feature-title">健康监控</div>
          <div class="feature-desc">内置健康检查API和状态监控功能</div>
        </div>
      </div>

      <div class="warning-box">
        <div class="warning-title">安全提醒</div>
        <p>为了您的账户安全，<strong>请勿通过代理服务登录任何重要账户</strong>。代理服务仅供浏览和学习使用。</p>
      </div>
    </div>

    <div class="footer">
      <p>如遇到访问问题，请尝试清理浏览器缓存和Cookie</p>
    </div>
  </div>

  <script>
    function redirectToProxy(event) {
      event.preventDefault();
      const targetUrl = document.getElementById('targetUrl').value.trim();
      
      if (!targetUrl) {
        alert('请输入要访问的网址');
        return;
      }
      
      const currentOrigin = window.location.origin;
      const proxyUrl = currentOrigin + '/' + targetUrl;
      
      // 在新标签页打开
      window.open(proxyUrl, '_blank');
    }

    // 添加一些交互效果
    document.addEventListener('DOMContentLoaded', function() {
      const input = document.getElementById('targetUrl');
      
      // 自动聚焦到输入框
      input.focus();
      
      // 回车键快速提交
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          document.querySelector('.btn').click();
        }
      });
      
      // 添加输入验证提示
      input.addEventListener('input', function() {
        const value = this.value.trim();
        if (value && !value.includes('.')) {
          this.style.borderLeft = '4px solid #f59e0b';
        } else {
          this.style.borderLeft = '4px solid #10b981';
        }
      });
    });
  </script>
</body>
</html>
  `;
}
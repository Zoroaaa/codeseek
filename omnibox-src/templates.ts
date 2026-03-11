// HTML 模板模块 - 所有页面模板集中管理
// OmniBox 增强优化的现代化设计模板

import { CONFIG } from './config.js';

const commonStyles = `
/* OmniBox common styles - 深色/浅色主题设计 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a25;
  --bg-card: rgba(26, 26, 37, 0.8);
  --accent-primary: #6366f1;
  --accent-secondary: #8b5cf6;
  --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  --accent-glow: rgba(99, 102, 241, 0.4);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border-color: rgba(99, 102, 241, 0.2);
  --border-glow: rgba(139, 92, 246, 0.3);
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 40px rgba(99, 102, 241, 0.15);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
  --noise-opacity: 0.03;
  --gradient-opacity-1: 0.15;
  --gradient-opacity-2: 0.1;
  --gradient-opacity-3: 0.08;
}

[data-theme="light"] {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f1f5f9;
  --bg-card: rgba(255, 255, 255, 0.9);
  --accent-primary: #6366f1;
  --accent-secondary: #8b5cf6;
  --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  --accent-glow: rgba(99, 102, 241, 0.2);
  --text-primary: #1e293b;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --border-color: rgba(99, 102, 241, 0.25);
  --border-glow: rgba(139, 92, 246, 0.2);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.12);
  --shadow-glow: 0 0 40px rgba(99, 102, 241, 0.08);
  --noise-opacity: 0.02;
  --gradient-opacity-1: 0.08;
  --gradient-opacity-2: 0.05;
  --gradient-opacity-3: 0.04;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  min-height: 100vh;
  color: var(--text-primary);
  line-height: 1.6;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow-x: hidden;
  transition: background-color var(--transition-normal), color var(--transition-normal);
}

body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, var(--gradient-opacity-1)), transparent),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, var(--gradient-opacity-2)), transparent),
    radial-gradient(ellipse 40% 30% at 10% 60%, rgba(168, 85, 247, var(--gradient-opacity-3)), transparent);
  pointer-events: none;
  z-index: 0;
}

body::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: var(--noise-opacity);
  pointer-events: none;
  z-index: 0;
}

.theme-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--transition-normal);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.theme-toggle:hover {
  border-color: var(--accent-primary);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.theme-toggle-icon {
  font-size: 1.1rem;
  transition: transform var(--transition-normal);
}

.theme-toggle:hover .theme-toggle-icon {
  transform: rotate(15deg);
}

.container {
  max-width: 500px;
  width: 100%;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.glass-card {
  background: var(--bg-card);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  padding: 40px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
  position: relative;
  overflow: hidden;
  transition: all var(--transition-normal);
}

.glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

.form-group {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  margin-bottom: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.9rem;
  letter-spacing: 0.02em;
}

.form-input {
  width: 100%;
  padding: 16px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  font-size: 1rem;
  color: var(--text-primary);
  transition: all var(--transition-normal);
  font-family: 'JetBrains Mono', monospace;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow), var(--shadow-md);
  background: var(--bg-secondary);
}

.form-input::placeholder {
  color: var(--text-muted);
}

.btn {
  width: 100%;
  padding: 16px 24px;
  background: var(--accent-gradient);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  letter-spacing: 0.02em;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.4);
}

.btn:hover::before {
  left: 100%;
}

.btn:active {
  transform: translateY(0);
}

.btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 50%, var(--accent-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.header .subtitle {
  font-size: 1.1rem;
  color: var(--text-secondary);
  font-weight: 400;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-tertiary);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  margin-top: 12px;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  font-family: 'JetBrains Mono', monospace;
}

.version-badge::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--success);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Responsive design */
@media (max-width: 768px) {
  body {
    padding: 15px;
  }

  .glass-card {
    padding: 30px 20px;
    border-radius: var(--radius-lg);
  }

  .header h1 {
    font-size: 2rem;
  }

  .theme-toggle {
    top: 10px;
    right: 10px;
    padding: 8px 12px;
    font-size: 0.8rem;
  }
}
`;

const themeToggleScript = `
(function() {
  const THEME_KEY = 'omnibox-theme';

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateToggleIcon(theme);
  }

  function updateToggleIcon(theme) {
    const icon = document.querySelector('.theme-toggle-icon');
    const text = document.querySelector('.theme-toggle-text');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = theme === 'dark' ? '浅色' : '深色';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  setTheme(getTheme());

  window.addEventListener('DOMContentLoaded', function() {
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
      updateToggleIcon(document.documentElement.getAttribute('data-theme') || 'dark');
    }
  });
})();
`;

const mainPageStyles = `
.container {
  max-width: 900px;
  padding: 40px 20px;
}

body {
  align-items: flex-start;
  justify-content: center;
  padding-top: 40px;
}

.proxy-card {
  background: var(--bg-card);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  padding: 40px;
  border: 1px solid var(--border-color);
  margin-bottom: 30px;
  box-shadow: var(--shadow-lg), var(--shadow-glow);
  position: relative;
  overflow: hidden;
}

.proxy-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

.usage-section {
  margin-bottom: 40px;
}

.usage-title {
  font-size: 1.25rem;
  margin-bottom: 20px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.usage-title::before {
  content: '';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--accent-gradient);
  border-radius: var(--radius-sm);
  margin-right: 12px;
  font-size: 1rem;
}

.usage-example {
  background: var(--bg-tertiary);
  padding: 16px 20px;
  border-radius: var(--radius-md);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  margin: 12px 0;
  border-left: 3px solid var(--accent-primary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all var(--transition-normal);
}

.usage-example:hover {
  background: var(--bg-secondary);
  border-left-color: var(--accent-secondary);
}

.usage-example::before {
  content: '→';
  color: var(--accent-primary);
  font-weight: 600;
}

.proxy-form {
  background: var(--bg-tertiary);
  padding: 32px;
  border-radius: var(--radius-lg);
  margin: 32px 0;
  border: 1px solid var(--border-color);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin: 32px 0;
}

.feature-item {
  background: var(--bg-tertiary);
  padding: 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
}

.feature-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-gradient);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.feature-item:hover {
  transform: translateY(-4px);
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-md), 0 0 20px var(--accent-glow);
}

.feature-item:hover::before {
  opacity: 1;
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 12px;
  display: block;
  filter: grayscale(0.2);
}

.feature-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 1rem;
}

.feature-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.warning-box {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin: 24px 0;
  position: relative;
  overflow: hidden;
}

.warning-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, #ef4444, #dc2626);
}

.warning-title {
  color: #fca5a5;
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  font-size: 1rem;
}

.warning-title::before {
  content: '⚠';
  margin-right: 10px;
  font-size: 1.2rem;
}

.warning-box p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.7;
}

.footer {
  text-align: center;
  margin-top: 50px;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.footer a {
  color: var(--accent-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.footer a:hover {
  color: var(--accent-secondary);
}

.stats-bar {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 32px 0;
  padding: 20px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 4px;
}

@media (max-width: 768px) {
  .container {
    padding: 20px 15px;
  }

  .proxy-card {
    padding: 24px;
    border-radius: var(--radius-lg);
  }

  .header h1 {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .stats-bar {
    flex-direction: column;
    gap: 16px;
  }

  .proxy-form {
    padding: 20px;
  }

  .usage-example {
    font-size: 0.8rem;
    padding: 12px 16px;
    word-break: break-all;
    overflow-wrap: break-word;
    white-space: normal;
  }

  .form-input {
    font-size: 0.9rem;
    padding: 14px 16px;
  }

  .form-input::placeholder {
    font-size: 0.85rem;
  }
}
`;

const passwordPageStyles = `
.password-container {
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lock-icon {
  font-size: 3.5rem;
  margin-bottom: 24px;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.error-message {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: var(--radius-md);
  padding: 14px 18px;
  margin-bottom: 24px;
  color: #fca5a5;
  font-size: 0.9rem;
  display: none;
  align-items: center;
  gap: 10px;
}

.error-message::before {
  content: '✕';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: rgba(239, 68, 68, 0.2);
  border-radius: 50%;
  font-size: 0.75rem;
}

.password-hint {
  text-align: center;
  margin-top: 24px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.loading {
  opacity: 0.7;
  pointer-events: none;
}

.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border: 2px solid transparent;
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.password-strength {
  margin-top: 12px;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.password-strength-bar {
  height: 100%;
  width: 0;
  transition: all var(--transition-normal);
  border-radius: 2px;
}

.password-strength-bar.weak {
  width: 33%;
  background: var(--error);
}

.password-strength-bar.medium {
  width: 66%;
  background: var(--warning);
}

.password-strength-bar.strong {
  width: 100%;
  background: var(--success);
}
`;

export function getMainPageTemplate(): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniBox - 网络代理服务</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
  <meta name="description" content="OmniBox - 安全、快速、现代化的网络代理服务">
  <meta name="keywords" content="proxy, web proxy, cloudflare worker, omnibox, secure browsing, 网络代理">
  <style>
    ${commonStyles}
    ${mainPageStyles}
  </style>
</head>
<body>
  <button class="theme-toggle" type="button">
    <span class="theme-toggle-icon">☀️</span>
    <span class="theme-toggle-text">浅色</span>
  </button>
  <div class="container">
    <div class="header">
      <h1>OmniBox</h1>
      <p class="subtitle">全能网络代理服务</p>
      <div class="version-badge">v${CONFIG.VERSION}</div>
    </div>

    <div class="proxy-card">
      <div class="usage-section">
        <h2 class="usage-title">使用方法</h2>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">在当前网址后添加目标网站地址即可开始代理访问：</p>
        <div class="usage-example">https://your-domain.com/github.com</div>
        <div class="usage-example">https://your-domain.com/https://github.com</div>
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
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          >
        </div>
        <button type="submit" class="btn">开始代理访问</button>
      </form>

      <div class="stats-bar" id="statsBar">
        <div class="stat-item">
          <div class="stat-value" id="statTotalKeys">—</div>
          <div class="stat-label">缓存条目数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="statHitRate">—</div>
          <div class="stat-label">缓存命中率</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">全球</div>
          <div class="stat-label">CDN 节点覆盖</div>
        </div>
      </div>

      <div class="features-grid">
        <div class="feature-item">
          <span class="feature-icon">🌐</span>
          <div class="feature-title">完整代理</div>
          <div class="feature-desc">全面代理网站内容，包括 JavaScript、CSS 等所有资源文件</div>
        </div>

        <div class="feature-item">
          <span class="feature-icon">⚡</span>
          <div class="feature-title">智能缓存</div>
          <div class="feature-desc">支持 KV 缓存加速，提升访问速度和用户体验</div>
        </div>

        <div class="feature-item">
          <span class="feature-icon">🔄</span>
          <div class="feature-title">URL 重写</div>
          <div class="feature-desc">智能 URL 重写系统，确保所有链接正常工作</div>
        </div>

        <div class="feature-item">
          <span class="feature-icon">📊</span>
          <div class="feature-title">健康监控</div>
          <div class="feature-desc">内置健康检查 API 和状态监控功能</div>
        </div>
      </div>

      <div class="warning-box">
        <div class="warning-title">安全提示</div>
        <p>为了您的账户安全，<strong>请勿通过代理服务登录任何重要账户</strong>。代理服务仅供浏览和研究使用。</p>
      </div>
    </div>

    <div class="footer">
      <p>OmniBox Proxy Worker v${CONFIG.VERSION} · 由 Cloudflare Workers 强力驱动</p>
    </div>
  </div>

  <script>
    ${themeToggleScript}

    function redirectToProxy(event) {
      event.preventDefault();
      const targetUrl = document.getElementById('targetUrl').value.trim();

      if (!targetUrl) {
        showError('请输入网站地址');
        return;
      }

      if (!targetUrl.includes('.')) {
        showError('请输入有效的网站地址');
        return;
      }

      const currentOrigin = window.location.origin;
      const proxyUrl = currentOrigin + '/' + targetUrl;

      window.open(proxyUrl, '_blank');
    }

    function showError(message) {
      const existing = document.querySelector('.toast-error');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'toast-error';
      toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,rgba(239,68,68,0.95),rgba(220,38,38,0.95));color:#fff;padding:14px 24px;border-radius:12px;font-size:0.9rem;z-index:10000;box-shadow:0 8px 30px rgba(0,0,0,0.3);animation:slideDown 0.3s ease;';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), 3000);
    }

    document.addEventListener('DOMContentLoaded', function() {
      const input = document.getElementById('targetUrl');

      input.focus();

      // 不再手动监听 Enter 触发 .btn.click()，
      // input 在 form 内按 Enter 浏览器会自动触发 form 的 submit 事件，
      // 手动 .click() 会导致 submit 触发两次，打开两个相同页面。

      input.addEventListener('input', function() {
        const value = this.value.trim();
        if (value && !value.includes('.')) {
          this.style.borderColor = 'var(--warning)';
        } else if (value) {
          this.style.borderColor = 'var(--success)';
        } else {
          this.style.borderColor = 'var(--border-color)';
        }
      });
    });

    const style = document.createElement('style');
    style.textContent = '@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(style);

    // 动态拉取缓存统计数据，替换假数据
    async function loadCacheStats() {
      try {
        const res = await fetch('/api/cache/stats');
        if (!res.ok) return;
        const data = await res.json();
        const totalKeysEl = document.getElementById('statTotalKeys');
        const hitRateEl = document.getElementById('statHitRate');
        if (totalKeysEl) totalKeysEl.textContent = data.error ? '—' : String(data.totalKeys ?? '—');
        if (hitRateEl) hitRateEl.textContent = data.error ? '—' : (data.hitRate ?? '—');
      } catch (_) {
        // 接口不可用时保持 "—" 占位，不影响页面功能
      }
    }
    document.addEventListener('DOMContentLoaded', loadCacheStats);
  </script>
</body>
</html>
  `;
}

export function getPasswordPageTemplate(passwordCookieName: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>访问认证 - OmniBox</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
  <meta name="description" content="安全访问 OmniBox 代理服务">
  <style>
    ${commonStyles}
    ${passwordPageStyles}
  </style>
</head>
<body>
  <button class="theme-toggle" type="button">
    <span class="theme-toggle-icon">☀️</span>
    <span class="theme-toggle-text">浅色</span>
  </button>
  <div class="container">
    <div class="glass-card password-container">
      <div class="header">
        <div class="lock-icon">🔐</div>
        <h1>访问认证</h1>
        <p class="subtitle">请输入访问密码以继续使用 OmniBox 服务</p>
        <div class="version-badge">OmniBox v${CONFIG.VERSION}</div>
      </div>

      <form id="passwordForm" onsubmit="submitPassword(event)">
        <div id="errorMessage" class="error-message">
          密码错误，请重试
        </div>

        <div class="form-group">
          <label class="form-label" for="password">访问密码</label>
          <input
            type="password"
            id="password"
            name="password"
            class="form-input"
            placeholder="请输入访问密码"
            autocomplete="current-password"
            required
            autofocus
          >
        </div>

        <button type="submit" class="btn" id="submitBtn">
          <span id="submitText">验证并继续</span>
        </button>
      </form>

      <div class="password-hint">
        输入正确的访问密码即可使用代理服务
      </div>
    </div>
  </div>

  <script>
    ${themeToggleScript}

    let isSubmitting = false;

    async function submitPassword(event) {
      event.preventDefault();

      if (isSubmitting) return;

      const password = document.getElementById('password').value.trim();
      const submitBtn = document.getElementById('submitBtn');
      const submitText = document.getElementById('submitText');
      const errorMessage = document.getElementById('errorMessage');

      if (!password) {
        showError('请输入密码');
        return;
      }

      isSubmitting = true;
      submitBtn.classList.add('loading');
      submitText.textContent = '验证中...';
      errorMessage.style.display = 'none';

      try {
        // 客户端对密码做 SHA-256 哈希后再存入 Cookie，避免明文密码暴露
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashHex = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        const cookieDomain = window.location.hostname;
        const oneWeekLater = new Date();
        oneWeekLater.setTime(oneWeekLater.getTime() + (7 * 24 * 60 * 60 * 1000));

        document.cookie = "${passwordCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + cookieDomain;

        document.cookie = "${passwordCookieName}=" + hashHex +
          "; expires=" + oneWeekLater.toUTCString() +
          "; path=/; domain=" + cookieDomain + "; SameSite=Lax; Secure";

        setTimeout(() => {
          location.reload();
        }, 500);

      } catch (error) {
        console.error('Cookie setting failed:', error);
        showError('认证失败，请重试');
        resetSubmitButton();
      }
    }

    function showError(message) {
      const errorMessage = document.getElementById('errorMessage');
      errorMessage.textContent = message;
      errorMessage.style.display = 'flex';

      setTimeout(() => {
        errorMessage.style.display = 'none';
      }, 3000);
    }

    function resetSubmitButton() {
      isSubmitting = false;
      const submitBtn = document.getElementById('submitBtn');
      const submitText = document.getElementById('submitText');

      submitBtn.classList.remove('loading');
      submitText.textContent = '验证并继续';
    }

    document.getElementById('password').addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !isSubmitting) {
        submitPassword(e);
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'invalid_password') {
      setTimeout(() => {
        showError('密码错误，请重试');
      }, 100);
    }

    document.addEventListener('DOMContentLoaded', function() {
      document.getElementById('password').focus();
    });
  </script>
</body>
</html>
  `;
}

export function getErrorPageTemplate(errorTitle: string, errorMessage: string, statusCode: number = 500): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${errorTitle} - OmniBox</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
  <style>
    ${commonStyles}
    .error-icon {
      font-size: 4rem;
      margin-bottom: 24px;
      animation: shake 0.5s ease-in-out;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    .error-code {
      font-size: 6rem;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(135deg, var(--error), var(--warning));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }
    .error-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--text-primary);
    }
    .back-button {
      margin-top: 32px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }
    .back-button:hover {
      background: var(--accent-gradient);
      border-color: transparent;
    }
    .error-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .error-actions .btn {
      flex: 1;
    }
    .btn-secondary {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }
    .btn-secondary:hover {
      background: var(--bg-secondary);
      border-color: var(--accent-primary);
    }
  </style>
</head>
<body>
  <button class="theme-toggle" type="button">
    <span class="theme-toggle-icon">☀️</span>
    <span class="theme-toggle-text">浅色</span>
  </button>
  <div class="container">
    <div class="glass-card">
      <div class="header">
        <div class="error-icon">⚠️</div>
        <div class="error-code">${statusCode}</div>
        <h1 class="error-title">${errorTitle}</h1>
        <p class="subtitle">${errorMessage}</p>
        <div class="version-badge">OmniBox v${CONFIG.VERSION}</div>
      </div>

      <div class="error-actions">
        <button class="btn btn-secondary" onclick="window.history.back()">
          返回上页
        </button>
        <button class="btn" onclick="window.location.href='/'">
          返回首页
        </button>
      </div>
    </div>
  </div>

  <script>
    ${themeToggleScript}
  </script>
</body>
</html>
  `;
}

// 密码验证页面模板
import { commonStyles } from '../styles/common.js';

export function getPasswordPageTemplate(passwordCookieName) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>访问验证 - Enhanced Proxy</title>
  <style>
    ${commonStyles}
    
    .password-container {
      animation: fadeInUp 0.6s ease-out;
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
      font-size: 3rem;
      margin-bottom: 20px;
      opacity: 0.8;
    }
    
    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--border-radius);
      padding: 12px 16px;
      margin-bottom: 20px;
      color: #fca5a5;
      font-size: 0.9rem;
      display: none;
    }
    
    .password-hint {
      text-align: center;
      margin-top: 20px;
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
  </style>
</head>
<body>
  <div class="container">
    <div class="glass-card password-container">
      <div class="header">
        <div class="lock-icon">🔐</div>
        <h1>访问验证</h1>
        <p class="subtitle">请输入访问密码继续使用代理服务</p>
        <div class="version-badge">Enhanced Proxy v2.0.0</div>
      </div>
      
      <form id="passwordForm" onsubmit="submitPassword(event)">
        <div id="errorMessage" class="error-message">
          密码错误，请重新输入
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
        输入正确的访问密码以使用代理服务
      </div>
    </div>
  </div>

  <script>
    let isSubmitting = false;
    
    function submitPassword(event) {
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
      
      // 显示加载状态
      isSubmitting = true;
      submitBtn.classList.add('loading');
      submitText.textContent = '验证中...';
      errorMessage.style.display = 'none';
      
      try {
        const cookieDomain = window.location.hostname;
        const oneWeekLater = new Date();
        oneWeekLater.setTime(oneWeekLater.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        // 先清除旧cookie
        document.cookie = "${passwordCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + cookieDomain;
        
        // 设置新cookie
        document.cookie = "${passwordCookieName}=" + encodeURIComponent(password) + 
          "; expires=" + oneWeekLater.toUTCString() + 
          "; path=/; domain=" + cookieDomain + "; SameSite=Lax";
        
        // 短暂延迟后重新加载页面
        setTimeout(() => {
          location.reload();
        }, 500);
        
      } catch (error) {
        console.error('设置cookie失败:', error);
        showError('验证失败，请重试');
        resetSubmitButton();
      }
    }
    
    function showError(message) {
      const errorMessage = document.getElementById('errorMessage');
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      
      // 3秒后自动隐藏错误信息
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
    
    // 监听回车键
    document.getElementById('password').addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !isSubmitting) {
        submitPassword(e);
      }
    });
    
    // 检查URL参数中是否有错误信息
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'invalid_password') {
      setTimeout(() => {
        showError('密码错误，请重新输入');
      }, 100);
    }
    
    // 页面加载完成后自动聚焦到密码输入框
    document.addEventListener('DOMContentLoaded', function() {
      document.getElementById('password').focus();
    });
  </script>
</body>
</html>
  `;
}
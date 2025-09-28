// HTML Templates Module - All page templates in one place
// Enhanced and optimized templates with modern design

import { CONFIG } from './config.js';

// Common CSS styles used across templates
const commonStyles = `
/* Enhanced common styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --secondary-gradient: linear-gradient(45deg, #60a5fa, #3b82f6);
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
  --text-primary: #ffffff;
  --text-secondary: #e0e7ff;
  --text-muted: rgba(255, 255, 255, 0.7);
  --input-bg: rgba(255, 255, 255, 0.9);
  --input-text: #1f2937;
  --shadow-light: rgba(96, 165, 250, 0.3);
  --border-radius: 12px;
  --border-radius-large: 20px;
  --transition: all 0.3s ease;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: var(--primary-gradient);
  min-height: 100vh;
  color: var(--text-primary);
  line-height: 1.6;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  max-width: 500px;
  width: 100%;
  margin: 0 auto;
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(15px);
  border-radius: var(--border-radius-large);
  padding: 40px;
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.form-input {
  width: 100%;
  padding: 16px 20px;
  border: none;
  border-radius: var(--border-radius);
  background: var(--input-bg);
  font-size: 1rem;
  color: var(--input-text);
  transition: var(--transition);
  border: 2px solid transparent;
}

.form-input:focus {
  outline: none;
  box-shadow: 0 0 20px var(--shadow-light);
  transform: translateY(-2px);
  border-color: #60a5fa;
}

.form-input::placeholder {
  color: #6b7280;
}

.btn {
  width: 100%;
  padding: 16px;
  background: var(--secondary-gradient);
  border: none;
  border-radius: var(--border-radius);
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  border: 2px solid transparent;
  position: relative;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
}

.btn:active {
  transform: translateY(0);
}

.btn:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 2rem;
  font-weight: 300;
  margin-bottom: 10px;
  background: linear-gradient(45deg, #fff, #e0e7ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header .subtitle {
  font-size: 1rem;
  opacity: 0.85;
  font-weight: 300;
  color: var(--text-muted);
}

.version-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.15);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  margin-top: 8px;
  color: var(--text-muted);
}

/* Responsive design */
@media (max-width: 768px) {
  body {
    padding: 15px;
  }
  
  .glass-card {
    padding: 30px 20px;
  }
  
  .header h1 {
    font-size: 1.75rem;
  }
}
`;

// Main page specific styles
const mainPageStyles = `
.container {
  max-width: 800px;
  padding: 40px 20px;
}

body {
  align-items: flex-start;
  justify-content: center;
  padding-top: 40px;
}

.proxy-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 30px;
}

.usage-section {
  margin-bottom: 40px;
}

.usage-title {
  font-size: 1.3rem;
  margin-bottom: 20px;
  color: #e0e7ff;
  display: flex;
  align-items: center;
}

.usage-title::before {
  content: "📖";
  margin-right: 10px;
  font-size: 1.5rem;
}

.usage-example {
  background: rgba(0, 0, 0, 0.2);
  padding: 15px;
  border-radius: 10px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  margin: 10px 0;
  border-left: 4px solid #60a5fa;
}

.proxy-form {
  background: rgba(255, 255, 255, 0.05);
  padding: 30px;
  border-radius: 15px;
  margin: 30px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin: 30px 0;
}

.feature-item {
  background: rgba(255, 255, 255, 0.08);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.3s ease;
}

.feature-item:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 10px;
  display: block;
}

.feature-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #e0e7ff;
}

.feature-desc {
  font-size: 0.9rem;
  opacity: 0.8;
  line-height: 1.5;
}

.warning-box {
  background: linear-gradient(45deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
}

.warning-title {
  color: #fca5a5;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.warning-title::before {
  content: "⚠️";
  margin-right: 8px;
}

.footer {
  text-align: center;
  margin-top: 50px;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .container {
    padding: 20px 10px;
  }
  
  .proxy-card {
    padding: 25px;
  }
  
  .header h1 {
    font-size: 2rem;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
}
`;

// Password page specific styles
const passwordPageStyles = `
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
`;

/**
 * Generate main page template
 * @returns {string} Main page HTML
 */
export function getMainPageTemplate() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Proxy Worker ${CONFIG.VERSION}</title>
  <meta name="description" content="Secure, fast, modern web proxy service">
  <meta name="keywords" content="proxy, web proxy, cloudflare worker, secure browsing">
  <style>
    ${commonStyles}
    ${mainPageStyles}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Enhanced Proxy Worker</h1>
      <p class="subtitle">Secure, fast, modern web proxy service</p>
      <div class="version-badge">${CONFIG.VERSION}</div>
    </div>

    <div class="proxy-card">
      <div class="usage-section">
        <h2 class="usage-title">How to Use</h2>
        <p>Add the target website URL after the current site URL:</p>
        <div class="usage-example">https://current-site.com/github.com</div>
        <div class="usage-example">https://current-site.com/https://github.com</div>
      </div>

      <form class="proxy-form" onsubmit="redirectToProxy(event)">
        <div class="form-group">
          <label class="form-label" for="targetUrl">Enter Target URL</label>
          <input 
            type="text" 
            id="targetUrl" 
            class="form-input"
            placeholder="e.g., github.com or https://github.com"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          >
        </div>
        <button type="submit" class="btn">Start Browsing</button>
      </form>

      <div class="features-grid">
        <div class="feature-item">
          <span class="feature-icon">🌐</span>
          <div class="feature-title">Complete Proxy</div>
          <div class="feature-desc">Full website content proxy including JavaScript and CSS resource handling</div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">⚡</span>
          <div class="feature-title">Smart Caching</div>
          <div class="feature-desc">KV cache support for improved speed and user experience</div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">🔄</span>
          <div class="feature-title">URL Rewriting</div>
          <div class="feature-desc">Intelligent URL rewriting system ensuring all links work properly</div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">📊</span>
          <div class="feature-title">Health Monitoring</div>
          <div class="feature-desc">Built-in health check APIs and status monitoring features</div>
        </div>
      </div>

      <div class="warning-box">
        <div class="warning-title">Security Notice</div>
        <p>For your account security, <strong>do not log into any important accounts through the proxy service</strong>. The proxy service is for browsing and research only.</p>
      </div>
    </div>

    <div class="footer">
      <p>If you encounter access issues, try clearing browser cache and cookies</p>
    </div>
  </div>

  <script>
    function redirectToProxy(event) {
      event.preventDefault();
      const targetUrl = document.getElementById('targetUrl').value.trim();
      
      if (!targetUrl) {
        alert('Please enter a website URL');
        return;
      }
      
      // Basic URL validation
      if (!targetUrl.includes('.')) {
        alert('Please enter a valid website URL');
        return;
      }
      
      const currentOrigin = window.location.origin;
      const proxyUrl = currentOrigin + '/' + targetUrl;
      
      // Open in new tab
      window.open(proxyUrl, '_blank');
    }

    // Enhanced interaction
    document.addEventListener('DOMContentLoaded', function() {
      const input = document.getElementById('targetUrl');
      
      // Auto focus
      input.focus();
      
      // Enter key support
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          document.querySelector('.btn').click();
        }
      });
      
      // Input validation feedback
      input.addEventListener('input', function() {
        const value = this.value.trim();
        if (value && !value.includes('.')) {
          this.style.borderLeft = '4px solid #f59e0b';
        } else if (value) {
          this.style.borderLeft = '4px solid #10b981';
        } else {
          this.style.borderLeft = '';
        }
      });

      // Auto-complete suggestions
      const suggestions = ['github.com', 'stackoverflow.com', 'reddit.com', 'wikipedia.org'];
      input.addEventListener('focus', function() {
        // Could implement autocomplete here
      });
    });
  </script>
</body>
</html>
  `;
}

/**
 * Generate password authentication page template
 * @param {string} passwordCookieName - Name of password cookie
 * @returns {string} Password page HTML
 */
export function getPasswordPageTemplate(passwordCookieName) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Authentication - Enhanced Proxy</title>
  <meta name="description" content="Secure access to proxy service">
  <style>
    ${commonStyles}
    ${passwordPageStyles}
  </style>
</head>
<body>
  <div class="container">
    <div class="glass-card password-container">
      <div class="header">
        <div class="lock-icon">🔐</div>
        <h1>Access Authentication</h1>
        <p class="subtitle">Please enter the access password to continue using the proxy service</p>
        <div class="version-badge">Enhanced Proxy ${CONFIG.VERSION}</div>
      </div>
      
      <form id="passwordForm" onsubmit="submitPassword(event)">
        <div id="errorMessage" class="error-message">
          Incorrect password, please try again
        </div>
        
        <div class="form-group">
          <label class="form-label" for="password">Access Password</label>
          <input 
            type="password" 
            id="password" 
            name="password"
            class="form-input"
            placeholder="Enter access password"
            autocomplete="current-password"
            required
            autofocus
          >
        </div>
        
        <button type="submit" class="btn" id="submitBtn">
          <span id="submitText">Authenticate & Continue</span>
        </button>
      </form>
      
      <div class="password-hint">
        Enter the correct access password to use the proxy service
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
        showError('Please enter password');
        return;
      }
      
      // Show loading state
      isSubmitting = true;
      submitBtn.classList.add('loading');
      submitText.textContent = 'Authenticating...';
      errorMessage.style.display = 'none';
      
      try {
        const cookieDomain = window.location.hostname;
        const oneWeekLater = new Date();
        oneWeekLater.setTime(oneWeekLater.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        // Clear old cookie first
        document.cookie = "${passwordCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + cookieDomain;
        
        // Set new cookie
        document.cookie = "${passwordCookieName}=" + encodeURIComponent(password) + 
          "; expires=" + oneWeekLater.toUTCString() + 
          "; path=/; domain=" + cookieDomain + "; SameSite=Lax; Secure";
        
        // Brief delay then reload
        setTimeout(() => {
          location.reload();
        }, 500);
        
      } catch (error) {
        console.error('Cookie setting failed:', error);
        showError('Authentication failed, please try again');
        resetSubmitButton();
      }
    }
    
    function showError(message) {
      const errorMessage = document.getElementById('errorMessage');
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        errorMessage.style.display = 'none';
      }, 3000);
    }
    
    function resetSubmitButton() {
      isSubmitting = false;
      const submitBtn = document.getElementById('submitBtn');
      const submitText = document.getElementById('submitText');
      
      submitBtn.classList.remove('loading');
      submitText.textContent = 'Authenticate & Continue';
    }
    
    // Enter key listener
    document.getElementById('password').addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !isSubmitting) {
        submitPassword(e);
      }
    });
    
    // Check URL params for error
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'invalid_password') {
      setTimeout(() => {
        showError('Incorrect password, please try again');
      }, 100);
    }
    
    // Auto-focus password input
    document.addEventListener('DOMContentLoaded', function() {
      document.getElementById('password').focus();
    });
  </script>
</body>
</html>
  `;
}

/**
 * Generate error page template
 * @param {string} errorTitle - Error title
 * @param {string} errorMessage - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error page HTML
 */
export function getErrorPageTemplate(errorTitle, errorMessage, statusCode = 500) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${errorTitle} - Enhanced Proxy</title>
  <style>
    ${commonStyles}
    .error-icon {
      font-size: 4rem;
      margin-bottom: 20px;
      opacity: 0.6;
    }
    .error-code {
      font-size: 6rem;
      font-weight: 300;
      margin-bottom: 10px;
      opacity: 0.3;
    }
    .back-button {
      margin-top: 30px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="glass-card">
      <div class="header">
        <div class="error-icon">⚠️</div>
        <div class="error-code">${statusCode}</div>
        <h1>${errorTitle}</h1>
        <p class="subtitle">${errorMessage}</p>
        <div class="version-badge">Enhanced Proxy ${CONFIG.VERSION}</div>
      </div>
      
      <button class="btn back-button" onclick="window.history.back()">
        Go Back
      </button>
    </div>
  </div>
</body>
</html>
  `;
}
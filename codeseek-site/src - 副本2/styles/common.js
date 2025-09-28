// 通用样式导出模块
export const commonStyles = `
/* 通用样式 */
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

/* 响应式设计 */
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

// 主页面专用样式
export const mainPageStyles = `
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
// 验证工具函数
import { APP_CONSTANTS } from '../core/constants.js';

// 基础验证规则
export const validationRules = {
  // 验证用户名
  username: {
    required: true,
    minLength: APP_CONSTANTS.VALIDATION.USERNAME.MIN_LENGTH,
    maxLength: APP_CONSTANTS.VALIDATION.USERNAME.MAX_LENGTH,
    pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
    message: '用户名只能包含字母、数字、下划线或中文'
  },

  // 验证邮箱
  email: {
    required: true,
    pattern: APP_CONSTANTS.VALIDATION.EMAIL.PATTERN,
    message: '请输入有效的邮箱地址'
  },

  // 验证密码
  password: {
    required: true,
    minLength: APP_CONSTANTS.VALIDATION.PASSWORD.MIN_LENGTH,
    maxLength: APP_CONSTANTS.VALIDATION.PASSWORD.MAX_LENGTH,
    message: '密码长度应在6-50个字符之间'
  },

  // 验证搜索关键词
  searchKeyword: {
    required: true,
    minLength: APP_CONSTANTS.VALIDATION.SEARCH_QUERY.MIN_LENGTH,
    maxLength: APP_CONSTANTS.VALIDATION.SEARCH_QUERY.MAX_LENGTH,
    pattern: /^[^<>]*$/,
    message: '搜索关键词不能包含特殊字符'
  }
};

// 单字段验证
export function validateField(value, rules) {
  const errors = [];

  if (rules.required && (!value || value.toString().trim() === '')) {
    errors.push('此字段是必需的');
    return { valid: false, errors };
  }

  if (value) {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`至少需要${rules.minLength}个字符`);
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`最多${rules.maxLength}个字符`);
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(rules.message || '格式不正确');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 多字段验证
export function validateForm(data, rules) {
  const errors = {};
  let isValid = true;

  Object.keys(rules).forEach(field => {
    const fieldRules = rules[field];
    const value = data[field];
    const result = validateField(value, fieldRules);

    if (!result.valid) {
      errors[field] = result.errors;
      isValid = false;
    }
  });

  return {
    valid: isValid,
    errors
  };
}

// 验证用户名
export function validateUsername(username) {
  return validateField(username, validationRules.username);
}

// 验证邮箱
export function validateEmail(email) {
  return validateField(email, validationRules.email);
}

// 验证密码
export function validatePassword(password) {
  const basicResult = validateField(password, validationRules.password);
  
  if (!basicResult.valid) {
    return basicResult;
  }

  // 密码强度检查
  const strength = checkPasswordStrength(password);
  if (strength.score < 2) {
    return {
      valid: false,
      errors: ['密码强度太弱，' + strength.feedback.join('，')]
    };
  }

  return { valid: true, errors: [] };
}

// 验证搜索关键词
export function validateSearchKeyword(keyword) {
  return validateField(keyword, validationRules.searchKeyword);
}

// 验证URL
export function validateURL(url) {
  if (!url) return { valid: false, errors: ['URL不能为空'] };
  
  try {
    new URL(url);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: ['URL格式无效'] };
  }
}

// 密码强度检查
export function checkPasswordStrength(password) {
  if (!password) return { score: 0, feedback: [] };
  
  let score = 0;
  const feedback = [];
  
  // 长度检查
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('密码至少8个字符');
  }
  
  // 包含小写字母
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('需要包含小写字母');
  }
  
  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('需要包含大写字母');
  }
  
  // 包含数字
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('需要包含数字');
  }
  
  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('建议包含特殊字符');
  }
  
  // 避免常见模式
  if (!/(.)\1{2,}/.test(password)) {
    score += 1;
  } else {
    feedback.push('避免重复字符');
  }
  
  const strength = ['很弱', '弱', '一般', '强', '很强'][Math.min(Math.floor(score / 1.2), 4)];
  
  return {
    score,
    strength,
    feedback,
    isStrong: score >= 4
  };
}

// 生成安全密码
export function generateSecurePassword(length = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';
  
  // 确保每种类型至少有一个字符
  password += getRandomChar(lowercase);
  password += getRandomChar(uppercase);
  password += getRandomChar(numbers);
  password += getRandomChar(symbols);
  
  // 填充剩余长度
  for (let i = 4; i < length; i++) {
    password += getRandomChar(allChars);
  }
  
  // 打乱字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// 获取随机字符
function getRandomChar(chars) {
  return chars.charAt(Math.floor(Math.random() * chars.length));
}
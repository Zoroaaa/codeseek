import { Context } from 'hono';
import { Env, JwtPayload } from '../types';
import * as jose from 'jose';

export const success = <T>(data: T, message?: string) => ({
  success: true as const,
  data,
  message,
});

export const error = (code: string, message: string, details?: unknown) => ({
  success: false as const,
  error: { code, message, details },
});

export const generateId = (): string => {
  return crypto.randomUUID();
};

export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

export const generateToken = async (userId: string, username: string, secret: string, expiryDays: number = 30): Promise<string> => {
  const secretKey = new TextEncoder().encode(secret);
  const token = await new jose.SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiryDays}d`)
    .sign(secretKey);
  return token;
};

export const verifyToken = async (token: string, secret: string): Promise<JwtPayload | null> => {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
};

export const parseBody = async <T>(c: Context<{ Bindings: Env }>): Promise<T> => {
  return c.req.json<T>();
};

export const getClientIP = (c: Context<{ Bindings: Env }>): string => {
  return c.req.header('x-forwarded-for') || 
         c.req.header('x-real-ip') || 
         c.req.header('CF-Connecting-IP') ||
         'unknown';
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 6;
};

export const paginate = <T>(items: T[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedItems = items.slice(start, end);
  const totalPages = Math.ceil(items.length / pageSize);
  
  return {
    items: paginatedItems,
    total: items.length,
    page,
    pageSize,
    totalPages,
  };
};

export const logUserAction = async (
  env: Env, 
  userId: string | null, 
  action: string, 
  data: Record<string, unknown>,
  c: Context<{ Bindings: Env; Variables?: Record<string, unknown> }>
): Promise<void> => {
  if (env.ENABLE_ACTION_LOGGING !== 'true') return;
  
  try {
    const actionId = generateId();
    const ip = getClientIP(c);
    const userAgent = c.req.header('User-Agent') || '';
    
    await env.DB.prepare(`
      INSERT INTO user_actions (id, user_id, action, data, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      actionId,
      userId,
      action,
      JSON.stringify(data),
      ip,
      userAgent,
      Date.now()
    ).run();
  } catch (error) {
    console.error('记录用户行为失败:', error);
  }
};

export const validateInput = (
  data: Record<string, unknown>, 
  rules: Record<string, { 
    required?: boolean; 
    minLength?: number; 
    maxLength?: number; 
    pattern?: RegExp; 
    message?: string 
  }>
): string[] => {
  const errors: string[] = [];
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors.push(`${field}是必需的`);
      continue;
    }
    
    if (value && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field}至少需要${rule.minLength}个字符`);
      }
      
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field}最多${rule.maxLength}个字符`);
      }
      
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(rule.message || `${field}格式不正确`);
      }
    }
  }
  return errors;
};

export const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***@${domain}`;
};

export * from './security';

import { Context, Next } from 'hono';
import { Env, JwtPayload } from '../types';
import { verifyToken, error } from '../utils';

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export const authMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('UNAUTHORIZED', '未提供认证令牌'), 401);
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  
  if (!payload) {
    return c.json(error('UNAUTHORIZED', '无效或过期的令牌'), 401);
  }
  
  c.set('user', payload);
  await next();
};

export const adminMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const user = c.get('user');
  
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }
  
  await next();
};

export const superAdminMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const user = c.get('user');
  
  if (!user || user.role !== 'super_admin') {
    return c.json(error('FORBIDDEN', '需要超级管理员权限'), 403);
  }
  
  await next();
};

export const optionalAuthMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    if (payload) {
      c.set('user', payload);
    }
  }
  
  await next();
};

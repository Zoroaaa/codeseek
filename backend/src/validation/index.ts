/**
 * 请求参数验证模块
 * 功能：使用Zod进行请求参数schema验证
 * 作者：CodeSeek Team
 * 日期：2024
 */
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../types';

export const schemas = {
  auth: {
    login: z.object({
      identifier: z.string().min(1, '请输入用户名/邮箱').max(100),
      password: z.string().min(1, '请输入密码'),
    }),

    register: z.object({
      username: z.string()
        .min(3, '用户名至少3个字符')
        .max(20, '用户名最多20个字符')
        .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
      email: z.string().email('请输入有效的邮箱地址'),
      password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
    }),

    forgotPassword: z.object({
      email: z.string().email('请输入有效的邮箱地址'),
    }),

    resetPassword: z.object({
      email: z.string().email('请输入有效的邮箱地址'),
      code: z.string().length(6, '验证码必须是6位'),
      newPassword: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
    }),

    changePassword: z.object({
      currentPassword: z.string().min(1, '请输入当前密码'),
      newPassword: z.string().min(6, '新密码至少6个字符').max(100, '新密码最多100个字符'),
    }),

    deleteAccount: z.object({
      password: z.string().min(1, '请输入密码确认删除'),
    }),

    sendVerificationCode: z.object({
      email: z.string().email('请输入有效的邮箱地址'),
      verificationType: z.enum(['registration', 'password_reset', 'email_change_old', 'email_change_new', 'account_delete']),
      force: z.boolean().optional(),
    }),

    requestEmailChange: z.object({
      newEmail: z.string().email('请输入有效的新邮箱地址'),
      currentPassword: z.string().min(1, '请输入当前密码'),
    }),

    verifyEmailChangeCode: z.object({
      requestId: z.string().min(1, '请求ID不能为空'),
      emailType: z.enum(['old', 'new']),
      code: z.string().length(6, '验证码必须是6位'),
    }),
  },

  user: {
    updateSettings: z.object({
      settings: z.record(z.unknown()),
    }),

    addFavorite: z.object({
      title: z.string().min(1, '标题不能为空').max(100, '标题最多100个字符'),
      subtitle: z.string().max(200, '副标题最多200个字符').optional().nullable(),
      url: z.string().url('请输入有效的URL').max(500, 'URL最多500个字符'),
      icon: z.string().max(50, '图标最多50个字符').optional().nullable(),
      keyword: z.string().max(100, '关键词最多100个字符').optional().nullable(),
    }),

    syncFavorites: z.object({
      favorites: z.array(z.object({
        id: z.string().optional(),
        title: z.string().min(1),
        url: z.string().url(),
        subtitle: z.string().optional().nullable(),
        icon: z.string().optional().nullable(),
        keyword: z.string().optional().nullable(),
        createdAt: z.number().optional(),
      })).max(1000, '最多同步1000个收藏'),
    }),

    addSearchHistory: z.object({
      query: z.string().min(1, '搜索关键词不能为空').max(200, '关键词最多200个字符'),
      source: z.string().max(100).optional(),
      resultsCount: z.number().int().min(0).optional(),
    }),

    updateSourceConfig: z.object({
      isEnabled: z.boolean().optional(),
      customPriority: z.number().int().min(1).max(10).optional().nullable(),
      customName: z.string().max(100).optional().nullable(),
      customSubtitle: z.string().max(200).optional().nullable(),
      customIcon: z.string().max(50).optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }),
  },

  search: {
    search: z.object({
      keyword: z.string().min(1, '搜索关键词不能为空').max(200, '关键词最多200个字符'),
      sourceIds: z.array(z.string()).max(50, '最多选择50个搜索源').optional(),
      page: z.number().int().min(1).max(1000).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    }),
  },

  sources: {
    createMajorCategory: z.object({
      name: z.string().min(1, '大类名称不能为空').max(30, '大类名称最多30个字符'),
      description: z.string().max(500).optional(),
      icon: z.string().max(10).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色格式不正确').optional(),
      requiresKeyword: z.boolean().optional(),
    }),

    updateMajorCategory: z.object({
      name: z.string().min(1).max(30).optional(),
      description: z.string().max(500).optional().nullable(),
      icon: z.string().max(10).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      requiresKeyword: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }),

    createCategory: z.object({
      majorCategoryId: z.string().min(1, '大类ID不能为空'),
      name: z.string().min(1, '分类名称不能为空').max(50, '分类名称最多50个字符'),
      description: z.string().max(500).optional(),
      icon: z.string().max(10).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      defaultSearchable: z.boolean().optional(),
      defaultSiteType: z.enum(['search', 'browse', 'reference']).optional(),
      searchPriority: z.number().int().min(1).max(10).optional(),
    }),

    updateCategory: z.object({
      name: z.string().min(1).max(50).optional(),
      description: z.string().max(500).optional().nullable(),
      icon: z.string().max(10).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      defaultSearchable: z.boolean().optional(),
      defaultSiteType: z.enum(['search', 'browse', 'reference']).optional(),
      searchPriority: z.number().int().min(1).max(10).optional(),
    }),

    createSource: z.object({
      categoryId: z.string().min(1, '分类ID不能为空'),
      name: z.string().min(1, '搜索源名称不能为空').max(100),
      subtitle: z.string().max(200).optional().nullable(),
      description: z.string().max(1000).optional().nullable(),
      icon: z.string().max(10).optional(),
      urlTemplate: z.string()
        .min(1, 'URL模板不能为空')
        .max(500)
        .regex(/^https?:\/\/.+/, 'URL模板格式不正确'),
      homepageUrl: z.string().url('主页URL格式不正确').max(500).optional().nullable(),
      siteType: z.enum(['search', 'browse', 'reference']).optional(),
      searchable: z.boolean().optional(),
      requiresKeyword: z.boolean().optional(),
      searchPriority: z.number().int().min(1).max(10).optional(),
    }),

    updateSource: z.object({
      categoryId: z.string().optional(),
      name: z.string().min(1).max(100).optional(),
      subtitle: z.string().max(200).optional().nullable(),
      description: z.string().max(1000).optional().nullable(),
      icon: z.string().max(10).optional(),
      urlTemplate: z.string().regex(/^https?:\/\/.+/).max(500).optional(),
      homepageUrl: z.string().url().max(500).optional().nullable(),
      siteType: z.enum(['search', 'browse', 'reference']).optional(),
      searchable: z.boolean().optional(),
      requiresKeyword: z.boolean().optional(),
      searchPriority: z.number().int().min(1).max(10).optional(),
    }),

    batchUpdateUserConfigs: z.object({
      configs: z.array(z.object({
        sourceId: z.string().min(1),
        isEnabled: z.boolean().optional(),
        customPriority: z.number().int().min(1).max(10).optional().nullable(),
        customName: z.string().max(100).optional().nullable(),
        customSubtitle: z.string().max(200).optional().nullable(),
        customIcon: z.string().max(50).optional().nullable(),
        notes: z.string().max(500).optional().nullable(),
      })).min(1, '配置列表不能为空').max(100, '批量更新不能超过100个配置'),
    }),
  },

  community: {
    createTag: z.object({
      name: z.string().min(2, '标签名称至少2个字符').max(20, '标签名称最多20个字符'),
      description: z.string().max(200).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色格式不正确').optional(),
    }),

    updateTag: z.object({
      name: z.string().min(2).max(20).optional(),
      description: z.string().max(200).optional().nullable(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      isActive: z.boolean().optional(),
    }),

    createSharedSource: z.object({
      sourceName: z.string().min(2, '搜索源名称至少2个字符').max(100),
      sourceSubtitle: z.string().max(200).optional().nullable(),
      sourceIcon: z.string().max(10).optional(),
      sourceUrlTemplate: z.string()
        .min(1, 'URL模板不能为空')
        .max(500)
        .regex(/^https?:\/\/.+/, 'URL模板格式不正确'),
      sourceCategory: z.string().min(1, '分类不能为空'),
      description: z.string().max(2000).optional(),
      tags: z.array(z.string()).max(10, '最多10个标签').optional(),
    }),

    updateSharedSource: z.object({
      sourceName: z.string().min(2).max(100).optional(),
      sourceSubtitle: z.string().max(200).optional().nullable(),
      sourceIcon: z.string().max(10).optional(),
      description: z.string().max(2000).optional(),
      tags: z.array(z.string()).max(10).optional(),
      sourceCategory: z.string().optional(),
    }),

    createReview: z.object({
      sharedSourceId: z.string().min(1, '搜索源ID不能为空'),
      rating: z.number().int().min(1, '评分最低1分').max(5, '评分最高5分'),
      comment: z.string().max(1000, '评论最多1000个字符').optional(),
    }),

    reportSource: z.object({
      reason: z.string().min(1, '举报原因不能为空').max(100, '举报原因最多100个字符'),
      details: z.string().max(1000).optional(),
    }),
  },

  system: {
    recordAction: z.object({
      userId: z.string().optional(),
      action: z.string().min(1, '行为类型不能为空').max(50),
      data: z.record(z.unknown()).optional(),
    }),
  },

  pagination: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    pageSize: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
  }),
};

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: string[] };

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    const errors = result.error.errors.map(e => e.message);
    return { success: false, errors };
  } catch {
    return { success: false, errors: ['验证失败'] };
  }
}

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (c: Context<{ Bindings: Env; Variables: Record<string, unknown> }>, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);
      
      if (!result.success) {
        const errors = result.error.errors.map(e => e.message);
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: errors.join('; '),
            details: result.error.errors,
          },
        }, 400);
      }
      
      c.set('validatedBody', result.data);
      await next();
    } catch {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求体解析失败',
        },
      }, 400);
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (c: Context<{ Bindings: Env; Variables: Record<string, unknown> }>, next: () => Promise<void>) => {
    const query = c.req.query();
    const result = schema.safeParse(query);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => e.message);
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        },
      }, 400);
    }
    
    c.set('validatedQuery', result.data);
    await next();
  };
}

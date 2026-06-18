import { apiClient } from './client';
import type {
  CommunityTag,
  CommunityPost,
  CommunityComment,
  CreateTagRequest,
  UpdateTagRequest,
  CreatePostRequest,
  UpdatePostRequest,
  CreateCommentRequest,
  ReportRequest,
  CommunityUserStats,
  CommunityStats,
  PostsResponse,
  CommentsResponse,
  NotificationsResponse,
} from '@/types';

export const communityApi = {
  // ==================== 标签管理 ====================

  getTags: async (): Promise<{ success: boolean; data: CommunityTag[] }> => {
    const response = await apiClient.get<{ success: boolean; data: Array<{
      id: string;
      tag_name: string;
      tag_description: string | null;
      tag_color: string;
      is_active: number;
      created_at: number;
      created_by: string;
    }> }>('/community/tags');

    if (response.success && response.data) {
      return {
        success: true,
        data: response.data.map(t => ({
          id: t.id,
          tagName: t.tag_name,
          tagDescription: t.tag_description || undefined,
          tagColor: t.tag_color,
          isActive: t.is_active === 1,
          createdAt: t.created_at,
          createdBy: t.created_by,
        }))
      };
    }
    return { success: false, data: [] };
  },

  getTag: async (id: string): Promise<{ success: boolean; data: CommunityTag }> => {
    return apiClient.get(`/community/tags/${id}`);
  },

  createTag: async (data: CreateTagRequest): Promise<{ success: boolean; data: CommunityTag; message: string }> => {
    return apiClient.post('/community/tags', data);
  },

  updateTag: async (id: string, data: UpdateTagRequest): Promise<{ success: boolean; message: string }> => {
    return apiClient.put(`/community/tags/${id}`, data);
  },

  deleteTag: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/community/tags/${id}`);
  },

  // ==================== 帖子管理 ====================

  getPosts: async (params?: {
    page?: number;
    pageSize?: number;
    postType?: string;
    tags?: string;
    sort?: string;
    search?: string;
  }): Promise<{ success: boolean; data: PostsResponse }> => {
    const queryParams = new URLSearchParams();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    queryParams.append('page', String(page));
    queryParams.append('pageSize', String(pageSize));
    if (params?.postType) queryParams.append('postType', params.postType);
    if (params?.tags) queryParams.append('tags', params.tags);
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.search) queryParams.append('search', params.search);

    const response = await apiClient.get<{ success: boolean; data: {
      items: Array<{
        id: string;
        user_id: string;
        user_name: string;
        user_avatar: string | null;
        post_type: string;
        title: string;
        cover_image: string;
        content_data: string;
        caption: string | null;
        tags: string;
        view_count: number;
        like_count: number;
        comment_count: number;
        favorite_count: number;
        share_count: number;
        status: string;
        is_featured: number;
        created_at: number;
        updated_at: number;
        is_liked?: number;
        is_favorited?: number;
      }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    } }>(`/community/posts?${queryParams.toString()}`);

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          items: response.data.items.map(p => ({
            id: p.id,
            userId: p.user_id,
            userName: p.user_name,
            userAvatar: p.user_avatar || undefined,
            postType: p.post_type as 'jav' | 'anime' | 'movie',
            title: p.title,
            coverImage: p.cover_image,
            contentData: p.content_data,
            caption: p.caption || '',
            tags: JSON.parse(p.tags || '[]'),
            viewCount: p.view_count,
            likeCount: p.like_count,
            commentCount: p.comment_count,
            favoriteCount: p.favorite_count,
            shareCount: p.share_count,
            status: p.status as 'active' | 'pending' | 'rejected' | 'hidden',
            isFeatured: p.is_featured === 1,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            isLiked: p.is_liked === 1,
            isFavorited: p.is_favorited === 1,
          })),
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
          totalPages: response.data.totalPages,
        }
      };
    }
    return { success: false, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } };
  },

  getPost: async (id: string): Promise<{ success: boolean; data: CommunityPost }> => {
    const response = await apiClient.get<{ success: boolean; data: {
      id: string;
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      post_type: string;
      title: string;
      cover_image: string;
      content_data: string;
      caption: string | null;
      tags: string;
      view_count: number;
      like_count: number;
      comment_count: number;
      favorite_count: number;
      share_count: number;
      status: string;
      is_featured: number;
      created_at: number;
      updated_at: number;
      is_liked?: number;
      is_favorited?: number;
    } }>(`/community/posts/${id}`);

    if (response.success && response.data) {
      const p = response.data;
      return {
        success: true,
        data: {
          id: p.id,
          userId: p.user_id,
          userName: p.user_name,
          userAvatar: p.user_avatar || undefined,
          postType: p.post_type as 'jav' | 'anime' | 'movie',
          title: p.title,
          coverImage: p.cover_image,
          contentData: p.content_data,
          caption: p.caption || '',
          tags: JSON.parse(p.tags || '[]'),
          viewCount: p.view_count,
          likeCount: p.like_count,
          commentCount: p.comment_count,
          favoriteCount: p.favorite_count,
          shareCount: p.share_count,
          status: p.status as 'active' | 'pending' | 'rejected' | 'hidden',
          isFeatured: p.is_featured === 1,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          isLiked: p.is_liked === 1,
          isFavorited: p.is_favorited === 1,
        }
      };
    }
    return { success: false, data: {} as CommunityPost };
  },

  createPost: async (data: CreatePostRequest): Promise<{ success: boolean; data: CommunityPost; message: string }> => {
    return apiClient.post('/community/posts', data);
  },

  updatePost: async (id: string, data: UpdatePostRequest): Promise<{ success: boolean; message: string }> => {
    return apiClient.put(`/community/posts/${id}`, data);
  },

  deletePost: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/community/posts/${id}`);
  },

  // ==================== 互动功能 ====================

  toggleLike: async (postId: string): Promise<{ success: boolean; data: { liked: boolean } }> => {
    const response = await apiClient.post<{ success: boolean; data: { liked: boolean }; message: string }>(
      `/community/posts/${postId}/like`,
      {}
    );

    if (response.success && response.data) {
      return {
        success: true,
        data: { liked: response.data.liked },
      };
    }
    return { success: false, data: { liked: false } };
  },

  toggleFavorite: async (postId: string): Promise<{ success: boolean; data: { favorited: boolean } }> => {
    const response = await apiClient.post<{ success: boolean; data: { favorited: boolean }; message: string }>(
      `/community/posts/${postId}/favorite`,
      {}
    );

    if (response.success && response.data) {
      return {
        success: true,
        data: { favorited: response.data.favorited },
      };
    }
    return { success: false, data: { favorited: false } };
  },

  // ==================== 评论管理 ====================

  getComments: async (postId: string): Promise<{ success: boolean; data: CommentsResponse }> => {
    const response = await apiClient.get<{ success: boolean; data: Array<{
      id: string;
      post_id: string;
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      content: string;
      created_at: number;
      updated_at: number;
    }> }>(`/community/posts/${postId}/comments`);

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          items: response.data.map(c => ({
            id: c.id,
            postId: c.post_id,
            userId: c.user_id,
            userName: c.user_name,
            userAvatar: c.user_avatar || undefined,
            content: c.content,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          })),
          total: response.data.length,
        }
      };
    }
    return { success: false, data: { items: [], total: 0 } };
  },

  createComment: async (data: CreateCommentRequest): Promise<{ success: boolean; data: CommunityComment; message: string }> => {
    return apiClient.post('/community/comments', data);
  },

  deleteComment: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/community/comments/${id}`);
  },

  // ==================== 举报功能 ====================

  reportPost: async (postId: string, data: ReportRequest): Promise<{ success: boolean; data: { reportId: string }; message: string }> => {
    return apiClient.post(`/community/posts/${postId}/report`, data);
  },

  // ==================== 个人中心 ====================

  getMyPosts: async (params?: { page?: number; pageSize?: number; status?: string }): Promise<{ success: boolean; data: PostsResponse }> => {
    const queryParams = new URLSearchParams();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    queryParams.append('page', String(page));
    queryParams.append('pageSize', String(pageSize));
    if (params?.status) queryParams.append('status', params.status);

    const response = await apiClient.get<{ success: boolean; data: {
      items: Array<{
        id: string;
        user_id: string;
        user_name: string;
        user_avatar: string | null;
        post_type: string;
        title: string;
        cover_image: string;
        content_data: string;
        caption: string | null;
        tags: string;
        view_count: number;
        like_count: number;
        comment_count: number;
        favorite_count: number;
        share_count: number;
        status: string;
        is_featured: number;
        created_at: number;
        updated_at: number;
      }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    } }>(`/community/posts/my-posts?${queryParams.toString()}`);

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          items: response.data.items.map(p => ({
            id: p.id,
            userId: p.user_id,
            userName: p.user_name,
            userAvatar: p.user_avatar || undefined,
            postType: p.post_type as 'jav' | 'anime' | 'movie',
            title: p.title,
            coverImage: p.cover_image,
            contentData: p.content_data,
            caption: p.caption || '',
            tags: JSON.parse(p.tags || '[]'),
            viewCount: p.view_count,
            likeCount: p.like_count,
            commentCount: p.comment_count,
            favoriteCount: p.favorite_count,
            shareCount: p.share_count,
            status: p.status as 'active' | 'pending' | 'rejected' | 'hidden',
            isFeatured: p.is_featured === 1,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          })),
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
          totalPages: response.data.totalPages,
        }
      };
    }
    return { success: false, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } };
  },

  getMyFavorites: async (params?: { page?: number; pageSize?: number }): Promise<{ success: boolean; data: PostsResponse }> => {
    const queryParams = new URLSearchParams();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    queryParams.append('page', String(page));
    queryParams.append('pageSize', String(pageSize));

    const response = await apiClient.get<{ success: boolean; data: {
      items: Array<{
        id: string;
        user_id: string;
        user_name: string;
        user_avatar: string | null;
        post_type: string;
        title: string;
        cover_image: string;
        content_data: string;
        caption: string | null;
        tags: string;
        view_count: number;
        like_count: number;
        comment_count: number;
        favorite_count: number;
        share_count: number;
        status: string;
        is_featured: number;
        created_at: number;
        updated_at: number;
      }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    } }>(`/community/posts/my-favorites?${queryParams.toString()}`);

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          items: response.data.items.map(p => ({
            id: p.id,
            userId: p.user_id,
            userName: p.user_name,
            userAvatar: p.user_avatar || undefined,
            postType: p.post_type as 'jav' | 'anime' | 'movie',
            title: p.title,
            coverImage: p.cover_image,
            contentData: p.content_data,
            caption: p.caption || '',
            tags: JSON.parse(p.tags || '[]'),
            viewCount: p.view_count,
            likeCount: p.like_count,
            commentCount: p.comment_count,
            favoriteCount: p.favorite_count,
            shareCount: p.share_count,
            status: p.status as 'active' | 'pending' | 'rejected' | 'hidden',
            isFeatured: p.is_featured === 1,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          })),
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
          totalPages: response.data.totalPages,
        }
      };
    }
    return { success: false, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } };
  },

  // ==================== 统计数据 ====================

  getCommunityStats: async (): Promise<{ success: boolean; data: CommunityStats }> => {
    const response = await apiClient.get<{ success: boolean; data: {
      total_posts: number;
      total_users: number;
      total_comments: number;
      total_likes: number;
      average_engagement: number;
      posts_by_type: Array<{ type: string; count: number }>;
      recent_activity: Array<{
        id: string;
        type: string;
        title: string;
        created_at: number;
      }>;
    } }>('/community/stats');

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          totalPosts: response.data.total_posts,
          totalUsers: response.data.total_users,
          totalComments: response.data.total_comments,
          totalLikes: response.data.total_likes,
          averageEngagement: response.data.average_engagement,
          postsByType: response.data.posts_by_type,
          recentActivity: response.data.recent_activity.map(a => ({
            id: a.id,
            type: a.type,
            title: a.title,
            createdAt: a.created_at,
          })),
        }
      };
    }
    return { success: false, data: {} as CommunityStats };
  },

  getUserStats: async (): Promise<{ success: boolean; data: CommunityUserStats }> => {
    const response = await apiClient.get<{ success: boolean; data: {
      posts_count: number;
      likes_received: number;
      favorites_received: number;
      comments_count: number;
      recent_posts: Array<{
        id: string;
        user_id: string;
        user_name: string;
        user_avatar: string | null;
        post_type: string;
        title: string;
        cover_image: string;
        content_data: string;
        caption: string | null;
        tags: string;
        view_count: number;
        like_count: number;
        comment_count: number;
        favorite_count: number;
        share_count: number;
        status: string;
        is_featured: number;
        created_at: number;
        updated_at: number;
      }>;
    } }>('/community/user-stats');

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          postsCount: response.data.posts_count,
          likesReceived: response.data.likes_received,
          favoritesReceived: response.data.favorites_received,
          commentsCount: response.data.comments_count,
          recentPosts: response.data.recent_posts.map(p => ({
            id: p.id,
            userId: p.user_id,
            userName: p.user_name,
            userAvatar: p.user_avatar || undefined,
            postType: p.post_type as 'jav' | 'anime' | 'movie',
            title: p.title,
            coverImage: p.cover_image,
            contentData: p.content_data,
            caption: p.caption || '',
            tags: JSON.parse(p.tags || '[]'),
            viewCount: p.view_count,
            likeCount: p.like_count,
            commentCount: p.comment_count,
            favoriteCount: p.favorite_count,
            shareCount: p.share_count,
            status: p.status as 'active' | 'pending' | 'rejected' | 'hidden',
            isFeatured: p.is_featured === 1,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          })),
        }
      };
    }
    return { success: false, data: {} as CommunityUserStats };
  },

  // ==================== 通知管理 ====================

  getNotifications: async (params?: { page?: number; pageSize?: number }): Promise<{ success: boolean; data: NotificationsResponse }> => {
    const queryParams = new URLSearchParams();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    queryParams.append('page', String(page));
    queryParams.append('pageSize', String(pageSize));

    const response = await apiClient.get<{ success: boolean; data: {
      items: Array<{
        id: string;
        type: 'like' | 'comment' | 'favorite' | 'report_resolved';
        post_id: string;
        post_title: string;
        post_cover_image: string;
        actor_name: string | null;
        content: string;
        created_at: number;
        is_read: number;
      }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    } }>(`/community/notifications?${queryParams.toString()}`);

    if (response.success && response.data) {
      return {
        success: true,
        data: {
          items: response.data.items.map(n => ({
            id: n.id,
            type: n.type,
            postId: n.post_id,
            postTitle: n.post_title,
            postCoverImage: n.post_cover_image,
            actorName: n.actor_name || undefined,
            content: n.content,
            createdAt: n.created_at,
            isRead: n.is_read === 1,
          })),
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
          totalPages: response.data.totalPages,
        }
      };
    }
    return { success: false, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } };
  },
};

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Search,
  Heart,
  Download,
  Star,
  Eye,
  User,
  Tag,
  Share2,
  MessageSquare,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { Card, Button, Input, Badge, Modal, Loading, Tabs, EmptyState, Dropdown } from '@/components/ui';
import { communityApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import type { 
  SharedSource, 
  Tag as TagType,
  CreateSharedSourceRequest,
  CreateTagRequest,
  CommunityStats,
} from '@/types';

export const CommunityManager: React.FC = () => {
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState('browse');
  const [sharedSources, setSharedSources] = useState<SharedSource[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'rating'>('popular');
  
  const [shareModal, setShareModal] = useState(false);
  const [shareForm, setShareForm] = useState<CreateSharedSourceRequest>({
    sourceName: '',
    sourceSubtitle: '',
    sourceIcon: '',
    sourceUrlTemplate: '',
    sourceCategory: '',
    description: '',
    tags: [],
  });
  
  const [tagModal, setTagModal] = useState(false);
  const [tagForm, setTagForm] = useState<CreateTagRequest>({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  
  const [sourceDetailModal, setSourceDetailModal] = useState<{ isOpen: boolean; source: SharedSource | null }>({
    isOpen: false,
    source: null,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const sourcesRes = await communityApi.getSharedSources({ pageSize: 50, status: 'active', sort: sortBy });
      if (sourcesRes.success && sourcesRes.data) {
        setSharedSources(sourcesRes.data.items);
      }
      
      const tagsRes = await communityApi.getTags();
      if (tagsRes.success && tagsRes.data) {
        setTags(tagsRes.data);
      }
      
      const communityStatsRes = await communityApi.getCommunityStats();
      if (communityStatsRes.success && communityStatsRes.data) {
        setCommunityStats(communityStatsRes.data);
      }
    } catch (error) {
      toast.error('加载失败', '无法加载社区数据');
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShareSource = async () => {
    if (!shareForm.sourceName || !shareForm.sourceUrlTemplate || !shareForm.sourceCategory) {
      toast.error('请填写必填字段');
      return;
    }
    
    try {
      const response = await communityApi.createSharedSource(shareForm);
      if (response.success) {
        toast.success('分享成功', '等待审核通过后将会公开显示');
        setShareModal(false);
        setShareForm({
          sourceName: '',
          sourceSubtitle: '',
          sourceIcon: '',
          sourceUrlTemplate: '',
          sourceCategory: '',
          description: '',
          tags: [],
        });
        loadData();
      }
    } catch (error) {
      toast.error('分享失败', '请稍后重试');
    }
  };

  const handleCreateTag = async () => {
    if (!tagForm.name) {
      toast.error('请输入标签名称');
      return;
    }
    
    try {
      const response = await communityApi.createTag(tagForm);
      if (response.success) {
        toast.success('标签创建成功');
        setTagModal(false);
        setTagForm({ name: '', description: '', color: '#3B82F6' });
        loadData();
      }
    } catch (error) {
      toast.error('创建失败', '请稍后重试');
    }
  };

  const handleLikeSource = async (sourceId: string) => {
    try {
      const response = await communityApi.likeSharedSource(sourceId);
      if (response.success && response.data) {
        setSharedSources(prev => prev.map(s => 
          s.id === sourceId 
            ? { ...s, likeCount: response.data!.likeCount }
            : s
        ));
        toast.success(response.data.liked ? '已点赞' : '已取消点赞');
      }
    } catch (error) {
      toast.error('操作失败', '请稍后重试');
    }
  };

  const handleDownloadSource = async (sourceId: string) => {
    try {
      const response = await communityApi.downloadSharedSource(sourceId);
      if (response.success) {
        toast.success('导入成功', '搜索源已添加到您的列表');
        setSharedSources(prev => prev.map(s => 
          s.id === sourceId 
            ? { ...s, downloadCount: s.downloadCount + 1 }
            : s
        ));
      }
    } catch (error) {
      toast.error('导入失败', '请稍后重试');
    }
  };

  const filteredSources = sharedSources.filter(source => {
    const matchesSearch = source.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (source.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesTag = selectedTag === 'all' || source.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-warning-500 fill-warning-500' : 'text-surface-300'}`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" text="加载社区..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-500 to-accent-500 flex items-center justify-center shadow-lg shadow-success-500/25">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              社区分享
            </h2>
            <p className="text-surface-500 dark:text-surface-400">
              发现和分享优质搜索源
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={<Tag className="w-4 h-4" />}
            onClick={() => setTagModal(true)}
          >
            管理标签
          </Button>
          <Button
            variant="primary"
            leftIcon={<Share2 className="w-4 h-4" />}
            onClick={() => setShareModal(true)}
          >
            分享搜索源
          </Button>
        </div>
      </div>

      {communityStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">分享总数</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {communityStats.totalSources}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center shadow-md">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">总下载</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {communityStats.totalDownloads}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-md">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">参与用户</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {communityStats.totalUsers}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning-400 to-warning-600 flex items-center justify-center shadow-md">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">评价数</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {communityStats.totalReviews}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-error-400 to-error-600 flex items-center justify-center shadow-md">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">平均评分</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {communityStats.averageRating.toFixed(1)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'browse', label: '浏览', icon: <Globe className="w-4 h-4" /> },
          { id: 'my-shares', label: '我的分享', icon: <Share2 className="w-4 h-4" /> },
          { id: 'favorites', label: '收藏', icon: <Heart className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="搜索搜索源..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
              fullWidth
            />
          </div>
          <div className="flex gap-3">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">所有标签</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'popular' | 'recent' | 'rating')}
              className="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500"
            >
              <option value="popular">最受欢迎</option>
              <option value="recent">最新发布</option>
              <option value="rating">评分最高</option>
            </select>
          </div>
        </div>
      </Card>

      {filteredSources.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSources.map(source => (
            <Card key={source.id} className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {source.sourceIcon ? (
                    <img src={source.sourceIcon} alt="" className="w-12 h-12 rounded-xl shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-surface-200 to-surface-300 dark:from-surface-700 dark:to-surface-600 flex items-center justify-center">
                      <Globe className="w-6 h-6 text-surface-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                      {source.sourceName}
                    </h3>
                    {source.sourceSubtitle && (
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {source.sourceSubtitle}
                      </p>
                    )}
                  </div>
                </div>
                <Dropdown
                  trigger={
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  }
                  items={[
                    { label: '查看详情', onClick: () => setSourceDetailModal({ isOpen: true, source }) },
                    { label: '举报', onClick: () => toast.warning('举报功能开发中') },
                  ]}
                />
              </div>
              
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-4 line-clamp-2">
                {source.description || '暂无描述'}
              </p>
              
              <div className="flex flex-wrap gap-1 mb-4">
                {source.tags.slice(0, 3).map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? (
                    <Badge key={tagId} variant="outline" className="text-xs">
                      {tag.name}
                    </Badge>
                  ) : null;
                })}
                {source.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{source.tags.length - 3}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm text-surface-500 dark:text-surface-400 mb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {source.likeCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    {source.downloadCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {source.viewCount}
                  </span>
                </div>
                {renderStars(Math.round(source.ratingScore))}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-surface-200 dark:border-surface-700">
                <span className="text-xs text-surface-400">
                  by {source.authorName}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLikeSource(source.id)}
                    className="hover:bg-error-50 dark:hover:bg-error-900/20"
                  >
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDownloadSource(source.id)}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    导入
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Globe className="w-12 h-12" />}
          title="没有找到搜索源"
          description="尝试调整筛选条件或分享新的搜索源"
          action={
            <Button variant="primary" onClick={() => setShareModal(true)}>
              分享搜索源
            </Button>
          }
        />
      )}

      <Modal
        isOpen={shareModal}
        onClose={() => setShareModal(false)}
        title="分享搜索源"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="名称 *"
              value={shareForm.sourceName}
              onChange={(e) => setShareForm({ ...shareForm, sourceName: e.target.value })}
              placeholder="搜索源名称"
              fullWidth
            />
            <Input
              label="副标题"
              value={shareForm.sourceSubtitle}
              onChange={(e) => setShareForm({ ...shareForm, sourceSubtitle: e.target.value })}
              placeholder="简短描述"
              fullWidth
            />
          </div>
          
          <Input
            label="URL模板 *"
            value={shareForm.sourceUrlTemplate}
            onChange={(e) => setShareForm({ ...shareForm, sourceUrlTemplate: e.target.value })}
            placeholder="https://example.com/search?q={keyword}"
            fullWidth
          />
          
          <Input
            label="分类 *"
            value={shareForm.sourceCategory}
            onChange={(e) => setShareForm({ ...shareForm, sourceCategory: e.target.value })}
            placeholder="如：视频、音乐、软件等"
            fullWidth
          />
          
          <Input
            label="图标URL"
            value={shareForm.sourceIcon}
            onChange={(e) => setShareForm({ ...shareForm, sourceIcon: e.target.value })}
            placeholder="https://example.com/icon.png"
            fullWidth
          />
          
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              描述
            </label>
            <textarea
              value={shareForm.description}
              onChange={(e) => setShareForm({ ...shareForm, description: e.target.value })}
              placeholder="搜索源详细描述"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              标签
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    const newTags = shareForm.tags?.includes(tag.id)
                      ? shareForm.tags.filter(t => t !== tag.id)
                      : [...(shareForm.tags || []), tag.id];
                    setShareForm({ ...shareForm, tags: newTags });
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                    shareForm.tags?.includes(tag.id)
                      ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-md'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShareModal(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleShareSource}>
              提交分享
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={tagModal}
        onClose={() => setTagModal(false)}
        title="管理标签"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="新标签名称"
              value={tagForm.name}
              onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
              fullWidth
            />
            <input
              type="color"
              value={tagForm.color}
              onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
              className="w-12 h-10 rounded-lg border border-surface-300 dark:border-surface-600"
            />
            <Button variant="primary" onClick={handleCreateTag}>
              添加
            </Button>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-5 h-5 rounded-lg shadow-sm"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-surface-900 dark:text-surface-100">{tag.name}</span>
                  <Badge variant="outline">{tag.usageCount}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await communityApi.deleteTag(tag.id);
                      toast.success('删除成功');
                      loadData();
                    } catch (error) {
                      toast.error('删除失败');
                    }
                  }}
                  className="text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={sourceDetailModal.isOpen}
        onClose={() => setSourceDetailModal({ isOpen: false, source: null })}
        title="搜索源详情"
        size="lg"
      >
        {sourceDetailModal.source && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              {sourceDetailModal.source.sourceIcon ? (
                <img src={sourceDetailModal.source.sourceIcon} alt="" className="w-16 h-16 rounded-xl shadow-md" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-surface-200 to-surface-300 dark:from-surface-700 dark:to-surface-600 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-surface-500" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {sourceDetailModal.source.sourceName}
                </h3>
                {sourceDetailModal.source.sourceSubtitle && (
                  <p className="text-surface-500 dark:text-surface-400">
                    {sourceDetailModal.source.sourceSubtitle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {renderStars(Math.round(sourceDetailModal.source.ratingScore))}
                  <span className="text-sm text-surface-500">
                    ({sourceDetailModal.source.ratingCount} 评价)
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-surface-50 to-surface-100 dark:from-surface-800/50 dark:to-surface-800 rounded-xl">
              <p className="text-surface-700 dark:text-surface-300">
                {sourceDetailModal.source.description || '暂无描述'}
              </p>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-800/50 dark:to-surface-800 rounded-xl">
                <Eye className="w-6 h-6 mx-auto text-primary-500 mb-2" />
                <p className="text-lg font-bold text-surface-900 dark:text-surface-100">
                  {sourceDetailModal.source.viewCount}
                </p>
                <p className="text-xs text-surface-500">浏览</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-800/50 dark:to-surface-800 rounded-xl">
                <Download className="w-6 h-6 mx-auto text-success-500 mb-2" />
                <p className="text-lg font-bold text-surface-900 dark:text-surface-100">
                  {sourceDetailModal.source.downloadCount}
                </p>
                <p className="text-xs text-surface-500">下载</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-800/50 dark:to-surface-800 rounded-xl">
                <Heart className="w-6 h-6 mx-auto text-error-500 mb-2" />
                <p className="text-lg font-bold text-surface-900 dark:text-surface-100">
                  {sourceDetailModal.source.likeCount}
                </p>
                <p className="text-xs text-surface-500">点赞</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-800/50 dark:to-surface-800 rounded-xl">
                <User className="w-6 h-6 mx-auto text-accent-500 mb-2" />
                <p className="text-sm font-bold text-surface-900 dark:text-surface-100">
                  {sourceDetailModal.source.authorName}
                </p>
                <p className="text-xs text-surface-500">作者</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-surface-900 dark:text-surface-100 mb-2">标签</h4>
              <div className="flex flex-wrap gap-2">
                {sourceDetailModal.source.tags.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? (
                    <Badge key={tagId} style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                      {tag.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setSourceDetailModal({ isOpen: false, source: null })}>
                关闭
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleDownloadSource(sourceDetailModal.source!.id);
                  setSourceDetailModal({ isOpen: false, source: null });
                }}
                leftIcon={<Download className="w-4 h-4" />}
              >
                导入到我的列表
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  CheckCircle,
  XCircle,
  Globe,
  Tag,
  ChevronDown,
} from 'lucide-react';
import { Card, Button, Input, Badge, Modal, Loading, Dropdown, EmptyState } from '@/components/ui';
import { sourceApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import type { 
  SearchSource, 
  MajorCategory, 
  Category, 
  UserSourceConfig,
  SourceStats,
  CreateSourceRequest,
  UpdateSourceRequest,
} from '@/types';

export const SourceManager: React.FC = () => {
  const toast = useToast();
  
  const [sources, setSources] = useState<Array<SearchSource & { userConfig?: UserSourceConfig | null }>>([]);
  const [majorCategories, setMajorCategories] = useState<MajorCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<SourceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMajorCategory, setSelectedMajorCategory] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  
  const [editModal, setEditModal] = useState<{ isOpen: boolean; source: SearchSource | null }>({
    isOpen: false,
    source: null,
  });
  const [createModal, setCreateModal] = useState(false);
  
  const [formData, setFormData] = useState<CreateSourceRequest>({
    name: '',
    subtitle: '',
    description: '',
    icon: '',
    urlTemplate: '',
    homepageUrl: '',
    categoryId: '',
    siteType: 'search',
    searchable: true,
    requiresKeyword: true,
    searchPriority: 0,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const sourcesRes = await sourceApi.getSourcesWithUserConfig();
      if (sourcesRes.success && sourcesRes.data) {
        setSources(sourcesRes.data);
      }
      
      const majorCategoriesRes = await sourceApi.getMajorCategories();
      if (majorCategoriesRes.success && majorCategoriesRes.data) {
        setMajorCategories(majorCategoriesRes.data);
      }
      
      const categoriesRes = await sourceApi.getCategories();
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
      
      const statsRes = await sourceApi.getSourceStats();
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      toast.error('加载失败', '无法加载搜索源数据');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (source.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const category = categories.find(c => c.id === source.categoryId);
    const matchesMajorCategory = selectedMajorCategory === 'all' || 
      category?.majorCategoryId === selectedMajorCategory;
    
    const matchesCategory = selectedCategory === 'all' || source.categoryId === selectedCategory;
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && source.userConfig?.isEnabled !== false) ||
      (statusFilter === 'inactive' && source.userConfig?.isEnabled === false);
    
    return matchesSearch && matchesMajorCategory && matchesCategory && matchesStatus;
  });

  const handleToggleSource = async (sourceId: string, isEnabled: boolean) => {
    try {
      await sourceApi.updateUserSourceConfig(sourceId, { isEnabled });
      setSources(prev => prev.map(s => 
        s.id === sourceId 
          ? { ...s, userConfig: { ...s.userConfig, isEnabled } as UserSourceConfig }
          : s
      ));
      toast.success(isEnabled ? '已启用' : '已禁用');
    } catch (error) {
      toast.error('操作失败', '请稍后重试');
    }
  };

  const handleBatchToggle = async (isEnabled: boolean) => {
    if (selectedSources.size === 0) {
      toast.warning('请先选择搜索源');
      return;
    }
    
    try {
      const configs = Array.from(selectedSources).map(sourceId => ({
        sourceId,
        isEnabled,
      }));
      
      await sourceApi.batchUpdateUserSourceConfigs({ configs });
      
      setSources(prev => prev.map(s => 
        selectedSources.has(s.id)
          ? { ...s, userConfig: { ...s.userConfig, isEnabled } as UserSourceConfig }
          : s
      ));
      
      setSelectedSources(new Set());
      toast.success(`已${isEnabled ? '启用' : '禁用'} ${configs.length} 个搜索源`);
    } catch (error) {
      toast.error('批量操作失败', '请稍后重试');
    }
  };

  const handleCreateSource = async () => {
    if (!formData.name || !formData.urlTemplate || !formData.categoryId) {
      toast.error('请填写必填字段');
      return;
    }
    
    try {
      const response = await sourceApi.createSource(formData);
      if (response.success) {
        toast.success('创建成功');
        setCreateModal(false);
        setFormData({
          name: '',
          subtitle: '',
          description: '',
          icon: '',
          urlTemplate: '',
          homepageUrl: '',
          categoryId: '',
          siteType: 'search',
          searchable: true,
          requiresKeyword: true,
          searchPriority: 0,
        });
        loadData();
      }
    } catch (error) {
      toast.error('创建失败', '请稍后重试');
    }
  };

  const handleUpdateSource = async () => {
    if (!editModal.source) return;
    
    try {
      const updateData: UpdateSourceRequest = {
        name: formData.name,
        subtitle: formData.subtitle,
        description: formData.description,
        icon: formData.icon,
        urlTemplate: formData.urlTemplate,
        homepageUrl: formData.homepageUrl,
        categoryId: formData.categoryId,
        siteType: formData.siteType,
        searchable: formData.searchable,
        requiresKeyword: formData.requiresKeyword,
        searchPriority: formData.searchPriority,
      };
      
      await sourceApi.updateSource(editModal.source.id, updateData);
      toast.success('更新成功');
      setEditModal({ isOpen: false, source: null });
      loadData();
    } catch (error) {
      toast.error('更新失败', '请稍后重试');
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('确定要删除这个搜索源吗？此操作不可撤销。')) return;
    
    try {
      await sourceApi.deleteSource(sourceId);
      toast.success('删除成功');
      loadData();
    } catch (error) {
      toast.error('删除失败', '请稍后重试');
    }
  };

  const handleCheckStatus = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;
    
    try {
      const response = await sourceApi.checkSourceStatus(sourceId);
      if (response.success && response.data) {
        toast.success(
          response.data.available ? '状态正常' : '状态异常',
          `响应时间: ${response.data.responseTime}ms`
        );
      }
    } catch (error) {
      toast.error('检测失败', '请稍后重试');
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'opml') => {
    try {
      const data = await sourceApi.exportSources(format, selectedCategory !== 'all' ? selectedCategory : undefined);
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-sources-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-sources-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      toast.success('导出成功');
    } catch (error) {
      toast.error('导出失败', '请稍后重试');
    }
  };

  const handleSelectAll = () => {
    if (selectedSources.size === filteredSources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(filteredSources.map(s => s.id)));
    }
  };

  const handleSelectSource = (sourceId: string) => {
    const newSelected = new Set(selectedSources);
    if (newSelected.has(sourceId)) {
      newSelected.delete(sourceId);
    } else {
      newSelected.add(sourceId);
    }
    setSelectedSources(newSelected);
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || '未分类';
  };

  const getMajorCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    const majorCategory = majorCategories.find(m => m.id === category.majorCategoryId);
    return majorCategory?.name || '';
  };

  const filteredCategories = selectedMajorCategory === 'all'
    ? categories
    : categories.filter(c => c.majorCategoryId === selectedMajorCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" text="加载搜索源..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            搜索源管理
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            管理和配置您的搜索源
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Dropdown
            trigger={
              <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
                导出
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            }
            items={[
              { label: '导出为 JSON', onClick: () => handleExport('json') },
              { label: '导出为 CSV', onClick: () => handleExport('csv') },
              { label: '导出为 OPML', onClick: () => handleExport('opml') },
            ]}
          />
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModal(true)}
          >
            添加搜索源
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">总搜索源</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.totalSources}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">可搜索</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.searchableSources}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                <Tag className="w-5 h-5 text-accent-600 dark:text-accent-400" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">分类数</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.totalCategories}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                <Globe className="w-5 h-5 text-warning-600 dark:text-warning-400" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">大类数</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.totalMajorCategories}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-4">
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
              value={selectedMajorCategory}
              onChange={(e) => {
                setSelectedMajorCategory(e.target.value);
                setSelectedCategory('all');
              }}
              className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            >
              <option value="all">所有大类</option>
              {majorCategories.map(mc => (
                <option key={mc.id} value={mc.id}>{mc.name}</option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            >
              <option value="all">所有分类</option>
              {filteredCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            >
              <option value="all">全部状态</option>
              <option value="active">已启用</option>
              <option value="inactive">已禁用</option>
            </select>
          </div>
        </div>
      </Card>

      {selectedSources.size > 0 && (
        <Card className="p-4 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-primary-700 dark:text-primary-300">
              已选择 {selectedSources.size} 个搜索源
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchToggle(true)}
              >
                批量启用
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchToggle(false)}
              >
                批量禁用
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSources(new Set())}
              >
                取消选择
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-50 dark:bg-surface-800/50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedSources.size === filteredSources.length && filteredSources.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-surface-300 dark:border-surface-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-surface-500 dark:text-surface-400">
                  名称
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-surface-500 dark:text-surface-400">
                  分类
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-surface-500 dark:text-surface-400">
                  类型
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-surface-500 dark:text-surface-400">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-surface-500 dark:text-surface-400">
                  使用次数
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-surface-500 dark:text-surface-400">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {filteredSources.map(source => (
                <tr key={source.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSources.has(source.id)}
                      onChange={() => handleSelectSource(source.id)}
                      className="rounded border-surface-300 dark:border-surface-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {source.icon ? (
                        <img src={source.icon} alt="" className="w-8 h-8 rounded" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                          <Globe className="w-4 h-4 text-surface-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-surface-900 dark:text-surface-100">
                          {source.userConfig?.customName || source.name}
                        </p>
                        {source.subtitle && (
                          <p className="text-sm text-surface-500 dark:text-surface-400">
                            {source.userConfig?.customSubtitle || source.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-surface-900 dark:text-surface-100">
                        {getCategoryName(source.categoryId)}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {getMajorCategoryName(source.categoryId)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={source.siteType === 'search' ? 'primary' : source.siteType === 'browse' ? 'accent' : 'default'}>
                      {source.siteType === 'search' ? '搜索' : source.siteType === 'browse' ? '浏览' : '参考'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleSource(source.id, source.userConfig?.isEnabled === false)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                        source.userConfig?.isEnabled !== false
                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                          : 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'
                      }`}
                    >
                      {source.userConfig?.isEnabled !== false ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          启用
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          禁用
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">
                    {source.usageCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckStatus(source.id)}
                        title="检测状态"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData({
                            name: source.name,
                            subtitle: source.subtitle || '',
                            description: source.description || '',
                            icon: source.icon || '',
                            urlTemplate: source.urlTemplate,
                            homepageUrl: source.homepageUrl || '',
                            categoryId: source.categoryId,
                            siteType: source.siteType,
                            searchable: source.searchable,
                            requiresKeyword: source.requiresKeyword,
                            searchPriority: source.searchPriority,
                          });
                          setEditModal({ isOpen: true, source });
                        }}
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSource(source.id)}
                        title="删除"
                        className="text-error-500 hover:text-error-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredSources.length === 0 && (
            <EmptyState
              icon={<Database className="w-12 h-12" />}
              title="没有找到搜索源"
              description="尝试调整筛选条件或添加新的搜索源"
              action={
                <Button variant="primary" onClick={() => setCreateModal(true)}>
                  添加搜索源
                </Button>
              }
            />
          )}
        </div>
      </Card>

      <Modal
        isOpen={createModal || editModal.isOpen}
        onClose={() => {
          setCreateModal(false);
          setEditModal({ isOpen: false, source: null });
          setFormData({
            name: '',
            subtitle: '',
            description: '',
            icon: '',
            urlTemplate: '',
            homepageUrl: '',
            categoryId: '',
            siteType: 'search',
            searchable: true,
            requiresKeyword: true,
            searchPriority: 0,
          });
        }}
        title={editModal.isOpen ? '编辑搜索源' : '添加搜索源'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="名称 *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="搜索源名称"
              fullWidth
            />
            <Input
              label="副标题"
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder="简短描述"
              fullWidth
            />
          </div>
          
          <Input
            label="URL模板 *"
            value={formData.urlTemplate}
            onChange={(e) => setFormData({ ...formData, urlTemplate: e.target.value })}
            placeholder="https://example.com/search?q={keyword}"
            fullWidth
          />
          
          <Input
            label="主页URL"
            value={formData.homepageUrl}
            onChange={(e) => setFormData({ ...formData, homepageUrl: e.target.value })}
            placeholder="https://example.com"
            fullWidth
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                分类 *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
              >
                <option value="">选择分类</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                站点类型
              </label>
              <select
                value={formData.siteType}
                onChange={(e) => setFormData({ ...formData, siteType: e.target.value as 'search' | 'browse' | 'reference' })}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
              >
                <option value="search">搜索型</option>
                <option value="browse">浏览型</option>
                <option value="reference">参考型</option>
              </select>
            </div>
          </div>
          
          <Input
            label="图标URL"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="https://example.com/icon.png"
            fullWidth
          />
          
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="搜索源详细描述"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.searchable}
                onChange={(e) => setFormData({ ...formData, searchable: e.target.checked })}
                className="rounded border-surface-300 dark:border-surface-600"
              />
              <span className="text-sm text-surface-700 dark:text-surface-300">可搜索</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requiresKeyword}
                onChange={(e) => setFormData({ ...formData, requiresKeyword: e.target.checked })}
                className="rounded border-surface-300 dark:border-surface-600"
              />
              <span className="text-sm text-surface-700 dark:text-surface-300">需要关键词</span>
            </label>
            <Input
              label="优先级"
              type="number"
              value={formData.searchPriority}
              onChange={(e) => setFormData({ ...formData, searchPriority: parseInt(e.target.value) || 0 })}
              fullWidth
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreateModal(false);
                setEditModal({ isOpen: false, source: null });
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={editModal.isOpen ? handleUpdateSource : handleCreateSource}
            >
              {editModal.isOpen ? '保存更改' : '创建'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

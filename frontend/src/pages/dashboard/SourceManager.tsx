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
  Tag,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  FolderOpen,
  Shield,
} from 'lucide-react';
import { Card, Button, Input, Badge, Modal, Loading, Dropdown, EmptyState, SourceIcon } from '@/components/ui';
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

interface CategoryWithSources extends Category {
  sources: Array<SearchSource & { userConfig?: UserSourceConfig | null }>;
  enabledCount: number;
  totalCount: number;
  isAllEnabled: boolean;
  isAllDisabled: boolean;
}

interface MajorCategoryWithCategories extends MajorCategory {
  categories: CategoryWithSources[];
  enabledCount: number;
  totalCount: number;
  isAllEnabled: boolean;
  isAllDisabled: boolean;
}

export const SourceManager: React.FC = () => {
  const toast = useToast();
  
  const [sources, setSources] = useState<Array<SearchSource & { userConfig?: UserSourceConfig | null }>>([]);
  const [majorCategories, setMajorCategories] = useState<MajorCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<SourceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMajorCategories, setExpandedMajorCategories] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
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
        setExpandedMajorCategories(new Set(majorCategoriesRes.data.map(m => m.id)));
      }
      
      const categoriesRes = await sourceApi.getCategories();
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data);
        setExpandedCategories(new Set(categoriesRes.data.map(c => c.id)));
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMajorCategoriesWithCategories = (): MajorCategoryWithCategories[] => {
    return majorCategories.map(mc => {
      const majorCategoryCategories = categories.filter(c => c.majorCategoryId === mc.id);
      
      const categoriesWithSources: CategoryWithSources[] = majorCategoryCategories.map(cat => {
        const categorySources = sources.filter(s => s.categoryId === cat.id);
        const enabledCount = categorySources.filter(s => s.userConfig?.isEnabled !== false).length;
        
        return {
          ...cat,
          sources: categorySources,
          enabledCount,
          totalCount: categorySources.length,
          isAllEnabled: enabledCount === categorySources.length && categorySources.length > 0,
          isAllDisabled: enabledCount === 0 && categorySources.length > 0,
        };
      }).filter(c => c.sources.length > 0);
      
      const totalSources = categoriesWithSources.reduce((sum, c) => sum + c.totalCount, 0);
      const enabledSources = categoriesWithSources.reduce((sum, c) => sum + c.enabledCount, 0);
      
      return {
        ...mc,
        categories: categoriesWithSources,
        enabledCount: enabledSources,
        totalCount: totalSources,
        isAllEnabled: enabledSources === totalSources && totalSources > 0,
        isAllDisabled: enabledSources === 0 && totalSources > 0,
      };
    }).filter(mc => mc.categories.length > 0);
  };

  const filteredMajorCategories = getMajorCategoriesWithCategories().filter(mc => {
    if (!searchQuery) return true;
    return mc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           mc.categories.some(cat => 
             cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             cat.sources.some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
           );
  });

  const handleToggleMajorCategory = async (majorCategoryId: string, enable: boolean) => {
    const mc = getMajorCategoriesWithCategories().find(m => m.id === majorCategoryId);
    if (!mc) return;
    
    const allSources = mc.categories.flatMap(c => c.sources);
    
    try {
      const configs = allSources.map(source => ({
        sourceId: source.id,
        isEnabled: enable,
      }));
      
      await sourceApi.batchUpdateUserSourceConfigs({ configs });
      
      setSources(prev => prev.map(s => 
        allSources.some(as => as.id === s.id)
          ? { ...s, userConfig: { ...s.userConfig, isEnabled: enable } as UserSourceConfig }
          : s
      ));
      
      toast.success(`已${enable ? '启用' : '禁用'} ${mc.name} 下所有搜索源`);
    } catch (error) {
      toast.error('操作失败', '请稍后重试');
    }
  };

  const handleToggleCategory = async (categoryId: string, enable: boolean) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    
    const categorySources = sources.filter(s => s.categoryId === categoryId);
    
    try {
      const configs = categorySources.map(source => ({
        sourceId: source.id,
        isEnabled: enable,
      }));
      
      await sourceApi.batchUpdateUserSourceConfigs({ configs });
      
      setSources(prev => prev.map(s => 
        s.categoryId === categoryId
          ? { ...s, userConfig: { ...s.userConfig, isEnabled: enable } as UserSourceConfig }
          : s
      ));
      
      toast.success(`已${enable ? '启用' : '禁用'} ${cat.name} 下所有搜索源`);
    } catch (error) {
      toast.error('操作失败', '请稍后重试');
    }
  };

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
      const data = await sourceApi.exportSources(format);
      
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

  const toggleMajorCategoryExpand = (id: string) => {
    const newExpanded = new Set(expandedMajorCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMajorCategories(newExpanded);
  };

  const toggleCategoryExpand = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const getSiteTypeBadge = (siteType: string) => {
    const map: Record<string, { variant: 'primary' | 'accent' | 'default'; label: string }> = {
      search: { variant: 'primary', label: '搜索' },
      browse: { variant: 'accent', label: '浏览' },
      reference: { variant: 'default', label: '参考' },
    };
    return map[siteType] || map.search;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" text="加载搜索源..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              搜索源管理
            </h2>
            <p className="text-surface-500 dark:text-surface-400">
              按大类、分类管理搜索源的启用状态
            </p>
          </div>
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
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">总搜索源</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.totalSources}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center shadow-md">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">已启用</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {sources.filter(s => s.userConfig?.isEnabled !== false).length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-md">
                <Tag className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">分类数</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.totalCategories}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning-400 to-warning-600 flex items-center justify-center shadow-md">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">大类数</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.totalMajorCategories}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-5 border-surface-200/50 dark:border-surface-700/50 shadow-lg">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-surface-400" />
          <Input
            placeholder="搜索大类、分类或搜索源..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-5 h-5" />}
            fullWidth
          />
        </div>
      </Card>

      <div className="space-y-4">
        {filteredMajorCategories.map((majorCategory) => {
          const isMajorExpanded = expandedMajorCategories.has(majorCategory.id);
          const isSearchCategory = majorCategory.requiresKeyword;
          
          return (
            <Card key={majorCategory.id} className="overflow-hidden border-surface-200/50 dark:border-surface-700/50 shadow-lg">
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-surface-50 to-surface-100 dark:from-surface-800/50 dark:to-surface-800">
                <button
                  onClick={() => toggleMajorCategoryExpand(majorCategory.id)}
                  className="flex items-center gap-4 flex-1 text-left"
                >
                  <ChevronRight className={`w-5 h-5 text-surface-400 transition-transform duration-200 ${isMajorExpanded ? 'rotate-90' : ''}`} />
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md"
                    style={{ backgroundColor: majorCategory.color || '#3B82F6' }}
                  >
                    {majorCategory.icon ? (
                      <span className="text-2xl">{majorCategory.icon}</span>
                    ) : (
                      <Layers className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                      {majorCategory.name}
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {majorCategory.categories.length} 个分类 · {majorCategory.totalCount} 个搜索源
                    </p>
                  </div>
                </button>
                
                <div className="flex items-center gap-3">
                  {isSearchCategory ? (
                    <>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-700">
                        <span className="text-sm text-surface-600 dark:text-surface-300">
                          {majorCategory.enabledCount}/{majorCategory.totalCount} 启用
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleMajorCategory(majorCategory.id, !majorCategory.isAllEnabled)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          majorCategory.isAllEnabled
                            ? 'bg-gradient-to-r from-success-100 to-success-200 text-success-700 dark:from-success-900/30 dark:to-success-800/30 dark:text-success-400'
                            : majorCategory.isAllDisabled
                            ? 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                            : 'bg-gradient-to-r from-warning-100 to-warning-200 text-warning-700 dark:from-warning-900/30 dark:to-warning-800/30 dark:text-warning-400'
                        }`}
                      >
                        {majorCategory.isAllEnabled ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            全部启用
                          </>
                        ) : majorCategory.isAllDisabled ? (
                          <>
                            <XCircle className="w-4 h-4" />
                            全部禁用
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            部分启用
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-surface-100 dark:bg-surface-700">
                      浏览型 · 不参与搜索
                    </Badge>
                  )}
                </div>
              </div>
              
              {isMajorExpanded && (
                <div className="border-t border-surface-200 dark:border-surface-700">
                  {majorCategory.categories.map((category) => {
                    const isCategoryExpanded = expandedCategories.has(category.id);
                    
                    return (
                      <div key={category.id} className="border-b border-surface-100 dark:border-surface-800 last:border-b-0">
                        <div 
                          className="flex items-center justify-between px-5 py-3 pl-12 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
                          onClick={() => toggleCategoryExpand(category.id)}
                        >
                          <div className="flex items-center gap-3">
                            <ChevronRight className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
                              style={{ backgroundColor: category.color || '#6366f1' }}
                            >
                              {category.icon ? (
                                <span className="text-base">{category.icon}</span>
                              ) : (
                                <FolderOpen className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-surface-800 dark:text-surface-200">
                                {category.name}
                              </span>
                              <span className="text-sm text-surface-400 ml-2">
                                {category.totalCount} 个源
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            {isSearchCategory ? (
                              <>
                                <span className="text-xs text-surface-500 dark:text-surface-400">
                                  {category.enabledCount}/{category.totalCount} 启用
                                </span>
                                <button
                                  onClick={() => handleToggleCategory(category.id, !category.isAllEnabled)}
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                                    category.isAllEnabled
                                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                                      : category.isAllDisabled
                                      ? 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400'
                                      : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                                  }`}
                                >
                                  {category.isAllEnabled ? (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      全部启用
                                    </>
                                  ) : category.isAllDisabled ? (
                                    <>
                                      <XCircle className="w-3 h-3" />
                                      全部禁用
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      部分启用
                                    </>
                                  )}
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-surface-400 dark:text-surface-500">
                                不参与搜索
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {isCategoryExpanded && (
                          <div className="bg-surface-50/50 dark:bg-surface-900/30">
                            {category.sources.map((source) => {
                              const isEnabled = source.userConfig?.isEnabled !== false;
                              const siteType = getSiteTypeBadge(source.siteType);
                              
                              return (
                                <div 
                                  key={source.id}
                                  className={`flex items-center justify-between px-5 py-3 pl-16 hover:bg-surface-100/50 dark:hover:bg-surface-800/30 transition-colors ${
                                    !isEnabled ? 'opacity-60' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <SourceIcon
                                      icon={source.icon}
                                      name={source.name}
                                      size="sm"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                                          {source.userConfig?.customName || source.name}
                                        </p>
                                        <Badge variant={siteType.variant} className="text-xs">
                                          {siteType.label}
                                        </Badge>
                                        {source.isSystem && (
                                          <Badge variant="accent" className="flex items-center gap-1 text-xs">
                                            <Shield className="w-2.5 h-2.5" />
                                            系统
                                          </Badge>
                                        )}
                                      </div>
                                      {(source.userConfig?.customSubtitle || source.subtitle) && (
                                        <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                          {source.userConfig?.customSubtitle || source.subtitle}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 shrink-0 ml-4">
                                    {isSearchCategory ? (
                                      <button
                                        onClick={() => handleToggleSource(source.id, !isEnabled)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                                          isEnabled
                                            ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                                            : 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400'
                                        }`}
                                      >
                                        {isEnabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                        {isEnabled ? '启用' : '禁用'}
                                      </button>
                                    ) : (
                                      <span className="text-xs text-surface-400 dark:text-surface-500 px-2 py-1">
                                        不参与搜索
                                      </span>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCheckStatus(source.id)}
                                      title="检测状态"
                                      className="p-1 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </Button>
                                    {!source.isSystem && (
                                      <>
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
                                          className="p-1 hover:bg-accent-50 dark:hover:bg-accent-900/20"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteSource(source.id)}
                                          title="删除"
                                          className="p-1 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        
        {filteredMajorCategories.length === 0 && (
          <EmptyState
            icon={<Database className="w-12 h-12" />}
            title="没有找到搜索源"
            description="尝试调整搜索条件或添加新的搜索源"
            action={
              <Button variant="primary" onClick={() => setCreateModal(true)}>
                添加搜索源
              </Button>
            }
          />
        )}
      </div>

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
                onChange={(e) => {
                  const newCategoryId = e.target.value;
                  const selectedCategory = categories.find(c => c.id === newCategoryId);
                  const parentMajorCategory = selectedCategory 
                    ? majorCategories.find(mc => mc.id === selectedCategory.majorCategoryId)
                    : null;
                  
                  setFormData({ 
                    ...formData, 
                    categoryId: newCategoryId,
                    searchable: parentMajorCategory?.requiresKeyword ?? true,
                    requiresKeyword: parentMajorCategory?.requiresKeyword ?? true,
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
              >
                <option value="">选择分类</option>
                {majorCategories.map(mc => (
                  <optgroup key={mc.id} label={mc.name}>
                    {categories.filter(c => c.majorCategoryId === mc.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
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
            {(() => {
              const selectedCategory = categories.find(c => c.id === formData.categoryId);
              const parentMajorCategory = selectedCategory 
                ? majorCategories.find(mc => mc.id === selectedCategory.majorCategoryId)
                : null;
              const isSearchCategory = parentMajorCategory?.requiresKeyword ?? true;
              
              if (!isSearchCategory) {
                return (
                  <div className="col-span-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      该分类属于浏览型大类（无需关键词），搜索源不参与搜索功能
                    </p>
                  </div>
                );
              }
              
              return (
                <>
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
                </>
              );
            })()}
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

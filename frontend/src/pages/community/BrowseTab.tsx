import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Globe,
  Search,
  Heart,
  Download,
  Eye,
  User,
  MessageSquare,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import { Card, Button, Input, Modal, Loading, EmptyState, Dropdown, SourceIcon } from '@/components/ui';
import { communityApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores';
import type { SharedSource, Tag } from '@/types';
import { StarRating, Pagination } from './shared';

export const BrowseTab: React.FC<{ tags: Tag[]; onImport: (id: string) => Promise<void> }> = ({ tags, onImport }) => {
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();
  const [sources, setSources] = useState<SharedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'rating'>('popular');
  const [detailSource, setDetailSource] = useState<SharedSource | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{ open: boolean; sourceId: string }>({ open: false, sourceId: '' });
  const [reportReason, setReportReason] = useState('');

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 12, status: 'active', sort: sortBy };
      if (search) params.search = search;
      if (selectedTag !== 'all') params.tags = [selectedTag];
      const res = await communityApi.getSharedSources(params);
      if (res.success && res.data) { setSources(res.data.items); setTotalPages(res.data.totalPages); setTotal(res.data.total); }
    } catch { toast.error('加载失败'); } finally { setLoading(false); }
  }, [page, search, selectedTag, sortBy]);

  useEffect(() => { loadSources(); }, [loadSources]);

  const handleLike = async (sourceId: string) => {
    if (!isAuthenticated) { toast.warning('请先登录'); return; }
    try {
      const res = await communityApi.likeSharedSource(sourceId);
      if (res.success) {
        setLikedIds(prev => { const next = new Set(prev); res.data.liked ? next.add(sourceId) : next.delete(sourceId); return next; });
        setSources(prev => prev.map(s => s.id === sourceId ? { ...s, likeCount: s.likeCount + (res.data.liked ? 1 : -1) } : s));
        toast.success(res.data.liked ? '已点赞' : '已取消点赞');
      }
    } catch { toast.error('操作失败'); }
  };

  const openDetail = async (source: SharedSource) => {
    setDetailSource(source);
    try {
      const res = await communityApi.getReviews(source.id);
      if (res.success && res.data) setReviews(res.data.items);
    } catch {}
  };

  const submitReview = async () => {
    if (!detailSource || !isAuthenticated) return;
    setSubmittingReview(true);
    try {
      const res = await communityApi.createReview({ sharedSourceId: detailSource.id, rating: reviewForm.rating, comment: reviewForm.comment });
      if (res.success) { toast.success('评价已提交'); const res2 = await communityApi.getReviews(detailSource.id); if (res2.success) setReviews(res2.data.items); setReviewForm({ rating: 5, comment: '' }); }
    } catch { toast.error('提交失败'); } finally { setSubmittingReview(false); }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) { toast.error('请填写举报原因'); return; }
    try { await communityApi.reportSharedSource(reportModal.sourceId, { reason: reportReason }); toast.success('举报已提交'); setReportModal({ open: false, sourceId: '' }); setReportReason(''); } catch { toast.error('提交失败'); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loading size="lg" text="加载社区内容..." /></div>;

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input placeholder="搜索搜索源名称、描述..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} leftIcon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={selectedTag} onChange={e => { setSelectedTag(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm">
              <option value="all">所有标签</option>
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value as any); setPage(1); }} className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm">
              <option value="popular">最受欢迎</option>
              <option value="recent">最新发布</option>
              <option value="rating">评分最高</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadSources}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>

      {sources.length === 0 ? (
        <EmptyState icon={<Globe className="w-12 h-12" />} title="没有找到搜索源" description="尝试调整筛选条件" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map(source => (
            <Card key={source.id} className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <SourceIcon icon={source.sourceIcon} name={source.sourceName} size="lg" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100 truncate">{source.sourceName}</h3>
                    {source.sourceSubtitle && <p className="text-xs text-surface-500 truncate">{source.sourceSubtitle}</p>}
                    <div className="mt-1"><StarRating rating={Math.round(source.ratingScore)} /></div>
                  </div>
                </div>
                <Dropdown
                  trigger={<Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button>}
                  items={[
                    { label: '查看详情', onClick: () => openDetail(source) },
                    { label: '举报', onClick: () => setReportModal({ open: true, sourceId: source.id }) },
                  ]}
                />
              </div>

              <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-3 flex-1">{source.description || '暂无描述'}</p>

              <div className="flex flex-wrap gap-1 mb-3">
                <span className="px-1.5 py-0.5 text-xs bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 rounded">{source.sourceCategory}</span>
                {source.tags.slice(0, 2).map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? <span key={tagId} className="px-1.5 py-0.5 text-xs rounded border" style={{ borderColor: tag.color + '60', color: tag.color }}>{tag.name}</span> : null;
                })}
                {source.tags.length > 2 && <span className="px-1.5 py-0.5 text-xs bg-surface-100 dark:bg-surface-700 text-surface-500 rounded">+{source.tags.length - 2}</span>}
              </div>

              <div className="flex items-center justify-between text-xs text-surface-500 mb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{source.viewCount}</span>
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" />{source.downloadCount}</span>
                  <span className="flex items-center gap-1"><Heart className={clsx('w-3 h-3', likedIds.has(source.id) && 'fill-current text-red-500')} />{source.likeCount}</span>
                </div>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{source.ratingCount}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-200 dark:border-surface-700">
                <span className="text-xs text-surface-400">by {source.authorName || '匿名'}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleLike(source.id)} className={clsx('p-1.5 rounded-lg transition-all', likedIds.has(source.id) ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20')}>
                    <Heart className={clsx('w-4 h-4', likedIds.has(source.id) && 'fill-current')} />
                  </button>
                  <Button variant="primary" size="sm" onClick={() => onImport(source.id)} leftIcon={<Download className="w-3.5 h-3.5" />}>导入</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <Modal isOpen={!!detailSource} onClose={() => setDetailSource(null)} title="搜索源详情" size="lg">
        {detailSource && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <SourceIcon icon={detailSource.sourceIcon} name={detailSource.sourceName} size="xl" />
              <div>
                <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100">{detailSource.sourceName}</h3>
                {detailSource.sourceSubtitle && <p className="text-surface-500 text-sm">{detailSource.sourceSubtitle}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <StarRating rating={Math.round(detailSource.ratingScore)} />
                  <span className="text-sm text-surface-500">({detailSource.ratingCount} 评价)</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl text-sm text-surface-700 dark:text-surface-300">{detailSource.description || '暂无描述'}</div>

            <div className="grid grid-cols-4 gap-3">
              {[{ icon: Eye, label: '浏览', value: detailSource.viewCount, color: 'text-blue-500' }, { icon: Download, label: '导入', value: detailSource.downloadCount, color: 'text-green-500' }, { icon: Heart, label: '点赞', value: detailSource.likeCount, color: 'text-red-500' }, { icon: User, label: '作者', value: detailSource.authorName || '匿名', color: 'text-purple-500' }].map(item => (
                <div key={item.label} className="text-center p-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
                  <item.icon className={clsx('w-5 h-5 mx-auto mb-1', item.color)} />
                  <p className="text-sm font-bold text-surface-900 dark:text-surface-100 truncate">{item.value}</p>
                  <p className="text-xs text-surface-500">{item.label}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-3">用户评价 ({reviews.length})</h4>
              {reviews.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {reviews.map(r => (
                    <div key={r.id} className="p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-surface-900 dark:text-surface-100">{r.userName || '匿名用户'}</span>
                        <StarRating rating={r.rating} />
                      </div>
                      {r.comment && <p className="text-sm text-surface-600 dark:text-surface-400">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-surface-400">暂无评价</p>}

              {isAuthenticated && (
                <div className="mt-4 p-4 border border-surface-200 dark:border-surface-700 rounded-xl space-y-3">
                  <h5 className="font-medium text-sm text-surface-900 dark:text-surface-100">写评价</h5>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-surface-500">评分：</span>
                    <StarRating rating={reviewForm.rating} interactive onRate={r => setReviewForm(f => ({ ...f, rating: r }))} />
                  </div>
                  <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} placeholder="分享你的使用体验..." rows={2} className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm" />
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" onClick={submitReview} disabled={submittingReview}>提交评价</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDetailSource(null)}>关闭</Button>
              <Button variant="primary" onClick={() => { onImport(detailSource.id); setDetailSource(null); }} leftIcon={<Download className="w-4 h-4" />}>导入到我的列表</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={reportModal.open} onClose={() => setReportModal({ open: false, sourceId: '' })} title="举报搜索源">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">举报原因</label>
            <select value={reportReason} onChange={e => setReportReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
              <option value="">请选择原因</option>
              <option value="invalid_url">链接无效</option>
              <option value="spam">垃圾内容</option>
              <option value="misleading">误导性内容</option>
              <option value="illegal">违法内容</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReportModal({ open: false, sourceId: '' })}>取消</Button>
            <Button variant="primary" onClick={handleReport}>提交举报</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Magnet, Film, Calendar, Clock, User, Building2,
  Tag, Star, ExternalLink, Copy, Check, Loader2,
  AlertCircle, Search, ChevronDown, ChevronUp, X,
  Shield,
} from 'lucide-react';
import type { JavDetail, MagnetItem } from '@/types/jav';

interface JavDetailPanelProps {
  detail: JavDetail | null;
  status: 'idle' | 'loading' | 'success' | 'error' | 'not_found';
  onClose: () => void;
}

// ── 工具 ───────────────────────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title={label ?? '复制'}
      className="p-1 rounded text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs sm:text-sm">
      <Icon className="w-3.5 h-3.5 text-surface-400 mt-0.5 shrink-0" />
      <span className="text-surface-500 dark:text-surface-400 shrink-0">{label}：</span>
      <span className="text-surface-800 dark:text-surface-200 break-all">{value}</span>
    </div>
  );
}

// ── 磁力列表 ───────────────────────────────────────────────────────

const MagnetList: React.FC<{ magnets: MagnetItem[] }> = ({ magnets }) => {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? magnets : magnets.slice(0, 5);

  if (magnets.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center text-surface-400">
        <Magnet className="w-5 h-5 opacity-40" />
        <p className="text-xs">暂无磁力链接</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* 表头 */}
      <div className="grid grid-cols-[1fr_80px_88px_44px] gap-2 px-2 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wide border-b border-surface-100 dark:border-surface-800">
        <span>磁力名称</span>
        <span className="text-right">大小</span>
        <span className="text-right">分享日期</span>
        <span></span>
      </div>

      {displayed.map((m, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_80px_88px_44px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-all group"
        >
          {/* 名称 */}
          <div className="flex items-center gap-1.5 min-w-0">
            {m.isHD && (
              <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300 rounded">HD</span>
            )}
            <a
              href={m.magnet}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
              title={m.name}
            >
              {m.name}
            </a>
          </div>
          {/* 大小 */}
          <span className="text-xs text-right text-surface-600 dark:text-surface-400 tabular-nums">{m.size}</span>
          {/* 日期 */}
          <span className="text-xs text-right text-surface-400 tabular-nums">{m.date}</span>
          {/* 操作 */}
          <div className="flex justify-end">
            <CopyBtn text={m.magnet} label="复制磁力链接" />
          </div>
        </div>
      ))}

      {magnets.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-surface-400 hover:text-primary-500 hover:bg-surface-50 dark:hover:bg-surface-800/40 rounded-lg transition-all"
        >
          {showAll
            ? <><ChevronUp className="w-3.5 h-3.5" />收起（共 {magnets.length} 条）</>
            : <><ChevronDown className="w-3.5 h-3.5" />展开全部（共 {magnets.length} 条）</>}
        </button>
      )}
    </div>
  );
};

// ── 主组件 ─────────────────────────────────────────────────────────

export const JavDetailPanel: React.FC<JavDetailPanelProps> = ({ detail, status, onClose }) => {
  if (status === 'idle') return null;

  return (
    <div className="bg-white dark:bg-surface-900/90 rounded-2xl shadow-xl shadow-surface-900/5 border border-surface-200/60 dark:border-surface-700/60 mb-4 sm:mb-6 overflow-hidden animate-fade-in">

      {/* ── 顶部标题栏 ── */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-surface-100 dark:border-surface-800">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
            <Magnet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 dark:text-rose-400" />
          </div>
          <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">磁力提取</span>
          {detail && (
            <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full">
              {detail.code}
            </span>
          )}
          {status === 'success' && detail && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
              {detail.magnets.length} 条磁力
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── 加载中 ── */}
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-surface-400">
          <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
          <p className="text-sm">正在爬取 JavBus 详情页...</p>
          <p className="text-xs opacity-60">通常需要 3~8 秒</p>
        </div>
      )}

      {/* ── 未找到 ── */}
      {status === 'not_found' && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-surface-400">
          <Search className="w-8 h-8 opacity-40" />
          <p className="text-sm">JavBus 上未找到该番号</p>
          <p className="text-xs opacity-60">可能是番号格式有误或资源尚未收录</p>
        </div>
      )}

      {/* ── 出错 ── */}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-8 h-8 text-error-400" />
          <p className="text-sm text-surface-500">获取失败，请稍后重试</p>
        </div>
      )}

      {/* ── 成功 ── */}
      {status === 'success' && detail && (
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">

          {/* 上半部分：封面 + 基本信息 */}
          <div className="flex gap-4 sm:gap-5">
            {/* 封面 */}
            {detail.cover && (
              <a href={detail.detailUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img
                  src={detail.cover}
                  alt={detail.code}
                  className="w-28 sm:w-36 rounded-lg object-cover shadow-md hover:shadow-lg transition-shadow"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </a>
            )}

            {/* 信息 */}
            <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
              {/* 标题 */}
              <h3 className="text-sm sm:text-base font-semibold text-surface-900 dark:text-surface-100 leading-snug line-clamp-3">
                {detail.title}
              </h3>

              <div className="space-y-1">
                <InfoRow icon={Calendar} label="发行日期" value={detail.releaseDate} />
                <InfoRow icon={Clock}    label="时长"     value={detail.duration} />
                <InfoRow icon={User}     label="导演"     value={detail.director} />
                <InfoRow icon={Building2} label="制作商"  value={detail.maker} />
                <InfoRow icon={Building2} label="发行商"  value={detail.publisher} />
                <InfoRow icon={Film}     label="系列"     value={detail.series} />
              </div>

              {/* JavBus 链接 */}
              <a
                href={detail.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary-500 hover:underline mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                在 JavBus 查看原页面
              </a>
            </div>
          </div>

          {/* 类别标签 */}
          {detail.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-xs font-semibold text-surface-500 dark:text-surface-400">类别</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.tags.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-full border border-surface-200 dark:border-surface-700">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 演员 */}
          {detail.actresses.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-xs font-semibold text-surface-500 dark:text-surface-400">演员</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.actresses.map((a, i) => (
                  <span key={i} className="px-2.5 py-1 text-xs bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800 font-medium">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 磁力链接 */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Magnet className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                  磁力链接 ({detail.magnets.length})
                </span>
              </div>
              {detail.magnets.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-surface-400">
                  <Shield className="w-3 h-3" />
                  点击名称直接唤起下载
                </div>
              )}
            </div>
            <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl p-3">
              <MagnetList magnets={detail.magnets} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

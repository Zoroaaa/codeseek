import React from 'react';
import { AnimeSearchResultPanel, MovieSearchResultPanel, MangaSearchResultPanel, SearchResultsPanel } from '@/components/search';

/**
 * 查表式结果渲染配置
 *
 * 映射表键值对应 resultType 字段(由后端 searchFlow.enrichedData.resultType 返回)
 *
 * 注意: MangaSearchResultPanel 将在 Task 3.4 中创建
 * 创建后需要在此映射表中添加: manga: MangaSearchResultPanel
 */
export const RESULT_PANELS: Record<string, React.ComponentType<any>> = {
  anime: AnimeSearchResultPanel,
  movie: MovieSearchResultPanel,
  manga: MangaSearchResultPanel,
};

/**
 * 根据 resultType 获取对应的结果面板组件
 *
 * @param resultType - 搜索结果类型(如 'anime', 'movie', 'manga' 等)
 * @returns 对应的 React 组件,如果未匹配则返回默认的 SearchResultsPanel
 */
export function getResultPanel(resultType?: string): React.ComponentType<any> {
  return (resultType && RESULT_PANELS[resultType]) || SearchResultsPanel;
}
export interface JavItem {
  code: string;
  title: string;
  cover?: string;
  date?: string;
  actress?: string;
  source: string;
}

export interface JavRankings {
  popular: JavItem[];
  newRelease: JavItem[];
  mostWanted: JavItem[];
  suggestions: string[];
  fetchedAt: number;
  sources: string[];
}

export const JAV_CACHE_KEY = 'jav_rankings_cache';
export const JAV_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

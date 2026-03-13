export interface JavItem {
  code: string;
  title: string;
  cover?: string;
  date?: string;
  actress?: string;
  source: string;
}

export interface GenreRanking {
  genre: string;
  key: string;
  items: JavItem[];
}

export interface JavRankings {
  popular: JavItem[];      // 近期热门
  newRelease: JavItem[];   // 最新发行
  censored: JavItem[];     // 有码精选
  uncensored: JavItem[];   // 无码精选
  genres: GenreRanking[];  // 类别榜（动态）
  suggestions: string[];
  fetchedAt: number;
  sources: string[];
}

export const JAV_CACHE_KEY = 'jav_rankings_cache';
export const JAV_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
  popular: JavItem[];
  newRelease: JavItem[];
  mostWanted: JavItem[];
  topRated: JavItem[];
  uncensored: JavItem[];
  genres: GenreRanking[];
  suggestions: string[];
  fetchedAt: number;
  sources: string[];
}

export const JAV_CACHE_KEY = 'jav_rankings_cache';
export const JAV_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

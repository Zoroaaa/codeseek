/**
 * 数据存储管理服务
 *
 * 在用户搜索时将有效结果去重落库到 data_records / data_record_sources 表，
 * 逐步积累本地数据资产。不保存用户个人信息，仅保留数据本身。
 *
 * 集成点：
 *   - persistDataRecord: 搜索路由 saveEnrichedHistory 之后异步调用
 *   - enrichDataRecordFromDetail: JAV detail 路由返回前异步调用（补充磁力来源）
 */
import { generateId } from '@/utils';
import type { MagnetItem } from './jav-utils';

// ─── 类型：Provider 返回结构（局部定义，避免循环依赖） ────────────────

interface ActressItem {
  id: string;
  name: string;
  cover?: string;
  ruby?: string;
  romaji?: string;
  tags?: string[];
}

interface BgmItem {
  id: number;
  name: string;
  nameCN: string;
  cover: string;
  tags?: string[];
  studio?: string;
  rating?: number;
}

interface MovieItem {
  id: number;
  title: string;
  poster: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

interface MangaItem {
  id: string;
  title: string;
  cover: string;
  status?: string;
  tags?: string[];
}

interface NovelItem {
  id: string;
  title: string;
  cover: string;
  author?: string;
  publisher?: string;
  format?: string;
  year?: string;
  category?: string;
  source?: string;
}

interface JavDetail {
  code: string;
  title: string;
  cover?: string;
  releaseDate?: string;
  duration?: string;
  publisher?: string;
  director?: string;
  maker?: string;
  series?: string;
  tags: string[];
  actresses: string[];
  detailUrl: string;
}

// ─── 内部：来源写入辅助 ──────────────────────────────────────────────

interface SourceEntry {
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  sourceData: Record<string, unknown>;
}

async function insertSources(
  db: D1Database,
  recordId: string,
  sources: SourceEntry[]
): Promise<void> {
  if (!sources.length) return;
  const now = Date.now();
  // 逐条 INSERT OR IGNORE（触发器自动维护 source_count，仅新增时计数+1）
  await Promise.all(
    sources.map((s) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO data_record_sources
             (id, record_id, source_name, source_type, source_url, source_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId(),
          recordId,
          s.sourceName,
          s.sourceType,
          s.sourceUrl,
          JSON.stringify(s.sourceData),
          now
        )
        .run()
        .catch((e) => console.error('[data-storage] insertSource error:', e))
    )
  );
}

// ─── 内部：主记录 upsert ─────────────────────────────────────────────

interface RecordPayload {
  recordType: 'jav' | 'anime' | 'movie' | 'manga' | 'novel' | 'actress';
  dedupKey: string;
  title: string;
  cover?: string;
  code?: string;
  actors?: string;
  duration?: string;
  releaseDate?: string;
  publisher?: string;
  tags?: string[];
  rating?: string;
  contentData: Record<string, unknown>;
  detailCompleted: 0 | 1;
}

/**
 * 写入主记录：首写优先（INSERT OR IGNORE 保留 first_seen_at）。
 * 返回记录 id；若已存在则顺带节流更新 last_updated_at（5 分钟内不重复更新，减少写放大）。
 */
async function upsertRecord(db: D1Database, payload: RecordPayload): Promise<string | null> {
  const now = Date.now();
  const id = generateId();
  const tagsJson = JSON.stringify(payload.tags || []);

  await db
    .prepare(
      `INSERT OR IGNORE INTO data_records
         (id, record_type, dedup_key, title, cover, code, actors, duration,
          release_date, publisher, tags, rating, content_data, detail_completed,
          status, source_count, first_seen_at, last_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`
    )
    .bind(
      id,
      payload.recordType,
      payload.dedupKey,
      payload.title,
      payload.cover ?? null,
      payload.code ?? null,
      payload.actors ?? null,
      payload.duration ?? null,
      payload.releaseDate ?? null,
      payload.publisher ?? null,
      tagsJson,
      payload.rating ?? null,
      JSON.stringify(payload.contentData),
      payload.detailCompleted,
      now,
      now
    )
    .run()
    .catch((e) => console.error('[data-storage] upsertRecord error:', e));

  // 查询实际记录 id（可能是刚插入的，也可能是已存在的）
  const row = await db
    .prepare('SELECT id FROM data_records WHERE record_type = ? AND dedup_key = ?')
    .bind(payload.recordType, payload.dedupKey)
    .first<{ id: string }>()
    .catch((e) => {
      console.error('[data-storage] lookupRecord error:', e);
      return null;
    });

  if (!row) return null;

  // 节流更新 last_updated_at：仅当距上次更新超过 5 分钟时刷新，避免热点资源每次搜索都写
  const throttleMs = 5 * 60 * 1000;
  await db
    .prepare('UPDATE data_records SET last_updated_at = ? WHERE id = ? AND last_updated_at < ?')
    .bind(now, row.id, now - throttleMs)
    .run()
    .catch((e) => console.error('[data-storage] touchRecord error:', e));

  return row.id;
}

// ─── JAV 磁力 → 来源条目 ─────────────────────────────────────────────

function magnetsToSources(magnets: MagnetItem[], detailUrl?: string): SourceEntry[] {
  const sources: SourceEntry[] = [];
  if (detailUrl) {
    sources.push({
      sourceName: 'JavBus',
      sourceType: 'detail',
      sourceUrl: detailUrl,
      sourceData: {},
    });
  }
  for (const m of magnets) {
    if (!m.magnet) continue;
    sources.push({
      sourceName: 'JavBus',
      sourceType: 'magnet',
      sourceUrl: m.magnet,
      sourceData: { name: m.name, size: m.size, date: m.date, isHD: m.isHD },
    });
  }
  return sources;
}

// ═════════════════════════════════════════════════════════════════════
// 公开 API
// ═════════════════════════════════════════════════════════════════════

/**
 * 主入口：从搜索结果提取并落库。
 * 列表型结果仅采首条基础元数据（detail_completed=0）；
 * JAV 番号搜索返回完整详情，首采即 detail_completed=1 并写入磁力来源。
 *
 * 容错：任何异常只 console.error，不抛出（搜索路由用 waitUntil 异步调用）。
 */
export async function persistDataRecord(
  db: D1Database,
  result: Record<string, unknown>
): Promise<void> {
  try {
    const resultType = result.resultType as string | undefined;
    if (!resultType) return;

    let payload: RecordPayload | null = null;
    let sources: SourceEntry[] = [];

    switch (resultType) {
      case 'jav': {
        // JAV 番号搜索：result.detail 存在则为完整详情
        const detail = result.detail as JavDetail | undefined;
        if (detail && detail.code && detail.title) {
          const magnets = (result.magnets as MagnetItem[] | undefined) || [];
          payload = {
            recordType: 'jav',
            dedupKey: `jav:${detail.code}`,
            title: detail.title,
            cover: detail.cover,
            code: detail.code,
            actors: detail.actresses?.length ? JSON.stringify(detail.actresses) : undefined,
            duration: detail.duration,
            releaseDate: detail.releaseDate,
            publisher: detail.publisher,
            tags: detail.tags,
            contentData: {
              ...detail,
              magnets: magnets.map((m) => ({
                name: m.name,
                magnet: m.magnet,
                size: m.size,
                date: m.date,
                isHD: m.isHD,
              })),
            },
            detailCompleted: 1,
          };
          sources = magnetsToSources(magnets, detail.detailUrl);
          break;
        }
        // JAV 女优搜索：result.actresses[] 列表，采首条
        const actresses = result.actresses as ActressItem[] | undefined;
        const first = actresses?.[0];
        if (first && first.id && first.name) {
          payload = {
            recordType: 'actress',
            dedupKey: `actress:${first.id}`,
            title: first.name,
            cover: first.cover,
            code: first.id,
            actors: first.name,
            tags: first.tags,
            contentData: {
              id: first.id,
              name: first.name,
              cover: first.cover,
              ruby: first.ruby,
              romaji: first.romaji,
              tags: first.tags,
            },
            detailCompleted: 0,
          };
        }
        break;
      }
      case 'anime': {
        const bgm = result.bgm as BgmItem[] | undefined;
        const first = bgm?.[0];
        if (first && first.id) {
          payload = {
            recordType: 'anime',
            dedupKey: `anime:bgm:${first.id}`,
            title: first.nameCN || first.name,
            cover: first.cover,
            code: `bgm:${first.id}`,
            publisher: first.studio,
            tags: first.tags,
            rating: first.rating != null ? `${first.rating} 分` : undefined,
            contentData: {
              id: first.id,
              name: first.name,
              nameCN: first.nameCN,
              cover: first.cover,
              tags: first.tags,
              studio: first.studio,
              rating: first.rating,
            },
            detailCompleted: 0,
          };
        }
        break;
      }
      case 'movie': {
        const results = result.results as MovieItem[] | undefined;
        // 注意：movie 的 results 在 JAV Hybrid 下会被多源跳转覆盖，
        // 但 movie provider 自身返回的列表在 enrichedData.results 赋值前已存在；
        // 这里取首条有 id 的（poster 可能为 null）
        const first = results?.find((r) => r && typeof r.id === 'number');
        if (first) {
          const release = first.release_date || first.first_air_date;
          payload = {
            recordType: 'movie',
            dedupKey: `movie:tmdb:${first.id}`,
            title: first.title,
            cover: first.poster || undefined,
            code: `tmdb:${first.id}`,
            releaseDate: release,
            rating: first.vote_average != null ? `${first.vote_average} 分` : undefined,
            contentData: {
              id: first.id,
              title: first.title,
              poster: first.poster,
              release_date: first.release_date,
              first_air_date: first.first_air_date,
              vote_average: first.vote_average,
            },
            detailCompleted: 0,
          };
        }
        break;
      }
      case 'manga': {
        const manga = result.manga as MangaItem[] | undefined;
        const first = manga?.[0];
        if (first && first.id) {
          payload = {
            recordType: 'manga',
            dedupKey: `manga:${first.id}`,
            title: first.title,
            cover: first.cover,
            code: first.id,
            tags: first.tags,
            contentData: {
              id: first.id,
              title: first.title,
              cover: first.cover,
              status: first.status,
              tags: first.tags,
            },
            detailCompleted: 0,
          };
        }
        break;
      }
      case 'novel': {
        const novels = result.novels as NovelItem[] | undefined;
        // novels[0] 是奇书网置顶项，跳过，取第一条 Anna's Archive 结果
        const first = novels?.find((n) => n && n.id && n.source !== '奇书网');
        if (first) {
          const tags = [first.format, first.year, first.category].filter(Boolean) as string[];
          payload = {
            recordType: 'novel',
            dedupKey: `novel:${first.id}`,
            title: first.title,
            cover: first.cover,
            code: first.id,
            actors: first.author,
            publisher: first.publisher,
            tags,
            contentData: {
              id: first.id,
              title: first.title,
              cover: first.cover,
              author: first.author,
              publisher: first.publisher,
              format: first.format,
              year: first.year,
              category: first.category,
              source: first.source,
            },
            detailCompleted: 0,
          };
        }
        break;
      }
    }

    if (!payload) return;

    const recordId = await upsertRecord(db, payload);
    if (recordId && sources.length) {
      await insertSources(db, recordId, sources);
    }
  } catch (err) {
    console.error('[data-storage] persistDataRecord error:', err);
  }
}

/**
 * 详情补充：用户查看 JAV 详情时，用完整数据更新/新建记录并补充磁力来源。
 * 即使搜索时已采集，detail 接口可能拿到更新的磁力，故始终合并来源（INSERT OR IGNORE 去重）。
 *
 * 当前仅 JAV 有独立详情接口；后续其他类型新增详情接口时可扩展。
 */
export async function enrichDataRecordFromDetail(
  db: D1Database,
  detail: { detail: JavDetail; magnets?: MagnetItem[] }
): Promise<void> {
  try {
    const d = detail.detail;
    if (!d?.code || !d?.title) return;

    const magnets = detail.magnets || [];
    const dedupKey = `jav:${d.code}`;
    const now = Date.now();

    // 查是否已存在
    const existing = await db
      .prepare('SELECT id, detail_completed FROM data_records WHERE record_type = ? AND dedup_key = ?')
      .bind('jav', dedupKey)
      .first<{ id: string; detail_completed: number }>();

    const contentData = {
      ...d,
      magnets: magnets.map((m) => ({
        name: m.name,
        magnet: m.magnet,
        size: m.size,
        date: m.date,
        isHD: m.isHD,
      })),
    };

    if (existing) {
      // 已存在：补充完整详情（若未完成）+ 刷新 last_updated_at
      await db
        .prepare(
          `UPDATE data_records
             SET title = ?, cover = COALESCE(?, cover), actors = ?,
                 duration = COALESCE(?, duration), release_date = COALESCE(?, release_date),
                 publisher = COALESCE(?, publisher), tags = ?, content_data = ?,
                 detail_completed = 1, last_updated_at = ?
           WHERE id = ?`
        )
        .bind(
          d.title,
          d.cover ?? null,
          d.actresses?.length ? JSON.stringify(d.actresses) : null,
          d.duration ?? null,
          d.releaseDate ?? null,
          d.publisher ?? null,
          JSON.stringify(d.tags || []),
          JSON.stringify(contentData),
          now,
          existing.id
        )
        .run()
        .catch((e) => console.error('[data-storage] enrich update error:', e));

      await insertSources(db, existing.id, magnetsToSources(magnets, d.detailUrl));
    } else {
      // 不存在：直接新建完整记录
      const id = generateId();
      await db
        .prepare(
          `INSERT INTO data_records
             (id, record_type, dedup_key, title, cover, code, actors, duration,
              release_date, publisher, tags, rating, content_data, detail_completed,
              status, source_count, first_seen_at, last_updated_at)
           VALUES (?, 'jav', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, 'active', 0, ?, ?)`
        )
        .bind(
          id,
          dedupKey,
          d.title,
          d.cover ?? null,
          d.code,
          d.actresses?.length ? JSON.stringify(d.actresses) : null,
          d.duration ?? null,
          d.releaseDate ?? null,
          d.publisher ?? null,
          JSON.stringify(d.tags || []),
          JSON.stringify(contentData),
          now,
          now
        )
        .run()
        .catch((e) => console.error('[data-storage] enrich insert error:', e));

      await insertSources(db, id, magnetsToSources(magnets, d.detailUrl));
    }
  } catch (err) {
    console.error('[data-storage] enrichDataRecordFromDetail error:', err);
  }
}

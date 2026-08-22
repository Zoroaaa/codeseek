/**
 * i18next 初始化入口
 *
 * 资源：bundled 静态导入（3 语言体量可控，无需懒加载）。
 * 检测：localStorage 优先（用户已选），其次浏览器 navigator。
 * 同步初始化：bundled resources + 同步 init，组件挂载前即可用 t()。
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from './config';

export const RESOURCES = {
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  'en':    { translation: en },
} as const;

void i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: RESOURCES,
    fallbackLng: FALLBACK_LANGUAGE,
    lng: DEFAULT_LANGUAGE,
    supportedLngs: ['zh-CN', 'zh-TW', 'en'],
    interpolation: {
      // React 已转义，关闭 i18next 自带转义避免双重
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      // 由 languageStore 自管持久化，禁用 detector 的反向缓存写入，避免双写冲突
      caches: [],
      convertDetectedLanguage: (lng: string) => {
        // 浏览器可能返回 zh-CN / zh-Hans / zh / zh-TW / zh-Hant / en-US 等
        if (lng.startsWith('zh-TW') || lng.startsWith('zh-Hant') || lng === 'zh-TW') return 'zh-TW';
        if (lng.startsWith('zh')) return 'zh-CN';
        if (lng.startsWith('en')) return 'en';
        return lng;
      },
    },
    returnNull: false,
  });

export default i18next;

// 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。

import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.yml';
import zhTW from './locales/zh-TW.yml';
import lzh from './locales/lzh.yml';
import en from './locales/en.yml';

/** 从 Cookie 读取语言偏好 */
function getLangCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/\bYPanelLang=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** 检测初始语言：Cookie > 浏览器语言 > en */
function detectLocale(): string {
  const cookie = getLangCookie();
  if (cookie) return cookie;

  const browser = navigator.language || (navigator as any).userLanguage;
  if (browser?.startsWith('zh')) {
    // zh-TW / zh-Hant / zh-HK → 繁體
    if (/tw|hant|hk/i.test(browser)) return 'zh-TW';
    return 'zh-CN';
  }
  return 'en';
}

const i18n = createI18n({
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { 'zh-CN': zhCN, 'zh-TW': zhTW, lzh, en },
  legacy: false,
});

export default i18n;

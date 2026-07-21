// 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。

import { createApp } from 'vue';
import App from './vue/App.vue';
import i18n from './i18n';

// Element Plus 暗色主题 CSS 变量（仅在 html.dark 时激活）
import 'element-plus/theme-chalk/dark/css-vars.css';

// ── 主题检测：Cookie 优先，无 Cookie 时跟随系统偏好 ──
const THEME_COOKIE = 'YPanelTheme';
const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

function getCookieTheme(): 'dark' | 'light' | null {
  const m = document.cookie.match(new RegExp(`\\b${THEME_COOKIE}=([^;]+)`));
  return m ? (m[1] as 'dark' | 'light') : null;
}

function applyTheme(t: 'dark' | 'light'): void {
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
}

// 初始化
const saved = getCookieTheme();
applyTheme(saved ?? (colorScheme.matches ? 'dark' : 'light'));

// Cookie 已设置时不再跟随系统；无 Cookie 时响应系统变更
colorScheme.addEventListener('change', (e) => {
  if (!getCookieTheme()) applyTheme(e.matches ? 'dark' : 'light');
});

import './styles/index.css';

const app = createApp(App);
app.use(i18n);
app.mount('#app');

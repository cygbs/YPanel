<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <!-- ===== 加载中 ===== -->
  <div v-if="authState === 'loading'" class="auth-screen">
    <el-icon class="auth-loading-icon" :size="32"><Loading /></el-icon>
    <span class="auth-loading-text">{{ $t('loading') }}</span>
  </div>

  <!-- ===== 登录 ===== -->
  <div v-else-if="authState === 'login'" class="auth-screen">
    <el-card class="auth-card" shadow="always">
      <div class="auth-header">
        <h1 class="auth-title">YPanel</h1>
        <p class="auth-subtitle">{{ $t('login.subtitle') }}</p>
      </div>
      <el-input
        v-model="pass"
        type="password"
        size="large"
        show-password
        :placeholder="$t('login.password')"
        @keyup.enter="login"
      >
        <template #prefix>
          <el-icon><Lock /></el-icon>
        </template>
      </el-input>
      <p v-if="err" class="auth-error">{{ err }}</p>
      <el-button type="primary" size="large" class="auth-btn" @click="login">
        {{ $t('login.login') }}
      </el-button>
      <a class="auth-forgot" @click="forgotPassword">{{ $t('login.forgot_password') }}</a>
      <div class="auth-bottom-row">
        <el-button size="small" class="auth-icon-btn" @click="toggleTheme">
          <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
        </el-button>
        <el-button size="small" class="auth-icon-btn" @click="cycleLocale">
          <span class="btn-inner"><el-icon><ChatDotRound /></el-icon>{{ localeLabel }}</span>
        </el-button>
      </div>
    </el-card>
  </div>

  <!-- ===== 修改密码 ===== -->
  <div v-else-if="authState === 'change-password'" class="auth-screen">
    <el-card class="auth-card" shadow="always">
      <div class="auth-header">
        <h1 class="auth-title">YPanel</h1>
        <p class="auth-subtitle">{{ $t('change_password.title') }}</p>
      </div>
      <el-input
        v-model="newPass"
        type="password"
        size="large"
        show-password
        :placeholder="$t('change_password.new_password')"
        @keyup.enter="change"
      >
        <template #prefix>
          <el-icon><Lock /></el-icon>
        </template>
      </el-input>
      <el-input
        v-model="confirmPass"
        type="password"
        size="large"
        show-password
        :placeholder="$t('change_password.confirm_password')"
        @keyup.enter="change"
      >
        <template #prefix>
          <el-icon><Lock /></el-icon>
        </template>
      </el-input>
      <p v-if="changeErr" class="auth-error">{{ changeErr }}</p>
      <el-button
        type="primary"
        size="large"
        class="auth-btn"
        :loading="changing"
        @click="change"
      >
        {{ changing ? $t('saving') : $t('save') }}
      </el-button>
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, inject, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Loading, Lock, Sunny, Moon, ChatDotRound } from '@element-plus/icons-vue';

const LOCALE_CODES = ['zh-CN', 'zh-TW', 'lzh', 'en'] as const;

export default defineComponent({
  components: { Loading, Lock, Sunny, Moon, ChatDotRound },
  setup() {
    const authState = inject<Ref<string>>('authState')!;
    const loginPassword = inject<Ref<string>>('loginPassword')!;
    const loginError = inject<Ref<string>>('loginError')!;
    const changeNewPassword = inject<Ref<string>>('changeNewPassword')!;
    const changeConfirmPassword = inject<Ref<string>>('changeConfirmPassword')!;
    const changeError = inject<Ref<string>>('changeError')!;
    const changingPassword = inject<Ref<boolean>>('changingPassword')!;
    const checkAuth = inject<() => Promise<void>>('checkAuth')!;
    const doLogin = inject<() => Promise<void>>('doLogin')!;
    const doChangePassword = inject<() => Promise<void>>('doChangePassword')!;

    const { t, locale } = useI18n();

    checkAuth();

    // ── 主题切换 ──
    const isDark = ref(document.documentElement.classList.contains('dark'));

    function toggleTheme(): void {
      isDark.value = !isDark.value;
      document.documentElement.classList.toggle('dark', isDark.value);
      document.cookie = `YPanelTheme=${isDark.value ? 'dark' : 'light'}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
    }

    // ── 语言切换 ──
    const localeLabel = ref('');

    function setLang(code: string): void {
      document.cookie = `YPanelLang=${encodeURIComponent(code)}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
      locale.value = code;
    }

    function updateLocaleLabel(): void {
      const maps: Record<string, string> = {
        'zh-CN': '中文', 'zh-TW': '繁體', lzh: '文言', en: 'EN',
      };
      localeLabel.value = maps[locale.value as string] || locale.value as string;
    }

    function cycleLocale(): void {
      const idx = LOCALE_CODES.indexOf(locale.value as typeof LOCALE_CODES[number]);
      const next = LOCALE_CODES[(idx + 1) % LOCALE_CODES.length];
      setLang(next);
      updateLocaleLabel();
    }

    updateLocaleLabel();

    // ── 忘记密码 ──
    function forgotPassword(): void {
      ElMessageBox.alert(t('login.forgot_password_body'), t('login.forgot_password_title'), {
        confirmButtonText: t('login.ok'),
        type: 'info',
      });
    }

    return {
      authState,
      pass: loginPassword,
      err: loginError,
      newPass: changeNewPassword,
      confirmPass: changeConfirmPassword,
      changeErr: changeError,
      changing: changingPassword,
      login: doLogin,
      change: doChangePassword,
      isDark,
      toggleTheme,
      cycleLocale,
      localeLabel,
      forgotPassword,
    };
  },
});
</script>

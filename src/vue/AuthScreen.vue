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
import { Loading, Lock } from '@element-plus/icons-vue';

export default defineComponent({
  components: { Loading, Lock },
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

    checkAuth();

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
    };
  },
});
</script>

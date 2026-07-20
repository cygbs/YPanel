<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div v-if="authState === 'loading'" class="auth-screen">
    <div class="auth-box">
      <div class="auth-loading">{{ $t('loading') }}</div>
    </div>
  </div>

  <div v-else-if="authState === 'login'" class="auth-screen">
    <div class="auth-box">
      <div class="auth-title">YPanel</div>
      <div class="auth-subtitle">{{ $t('login.subtitle') }}</div>
      <div class="auth-field">
        <input v-model="pass" type="password" class="input" :placeholder="$t('login.password')" @keyup.enter="login" />
      </div>
      <div v-if="err" class="auth-error">{{ err }}</div>
      <button class="btn btn-primary auth-btn" @click="login">{{ $t('login.login') }}</button>
    </div>
  </div>

  <div v-else-if="authState === 'change-password'" class="auth-screen">
    <div class="auth-box">
      <div class="auth-title">YPanel</div>
      <div class="auth-subtitle">{{ $t('change_password.title') }}</div>
      <div class="auth-field">
        <input v-model="newPass" type="password" class="input" :placeholder="$t('change_password.new_password')" @keyup.enter="change" />
      </div>
      <div class="auth-field">
        <input v-model="confirmPass" type="password" class="input" :placeholder="$t('change_password.confirm_password')" @keyup.enter="change" />
      </div>
      <div v-if="changeErr" class="auth-error">{{ changeErr }}</div>
      <button class="btn btn-primary auth-btn" :disabled="changing" @click="change">
        {{ changing ? $t('saving') : $t('save') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, inject, type Ref } from 'vue';

export default defineComponent({
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

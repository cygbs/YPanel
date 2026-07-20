<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div v-if="showLangDialog" class="dialog-overlay" @click.self="closeLangDialog">
    <div class="dialog dialog-sm">
      <div class="dialog-title">{{ $t('lang.select') }}</div>
      <div class="dialog-body">
        <div v-for="code in localeCodes" :key="code" class="lang-option"
          :class="{ selected: code === locale }" @click="setLang(code)">
          <span class="lang-option-name">{{ messages[code].name }}</span>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="closeLangDialog">{{ $t('cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, type Ref } from 'vue';

export default defineComponent({
  setup() {
    return {
      showLangDialog: inject<Ref<boolean>>('showLangDialog')!,
      localeCodes: inject<string[]>('localeCodes')!,
      locale: inject<Ref<string>>('locale')!,
      messages: inject<Record<string, { name: string }>>('messages')!,
      closeLangDialog: inject('closeLangDialog')!,
      setLang: inject('setLang')!,
    };
  },
});
</script>

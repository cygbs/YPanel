<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <el-dialog v-model="showLangDialog" :title="$t('lang.select')" width="400px"
    :close-on-click-modal="true" @closed="closeLangDialog">
    <div v-for="code in localeCodes" :key="code" class="lang-option"
      :class="{ selected: code === locale }" @click="setLang(code)">
      <span class="lang-option-name">{{ messages[code].name }}</span>
    </div>
    <template #footer>
      <el-button @click="closeLangDialog">{{ $t('cancel') }}</el-button>
    </template>
  </el-dialog>
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

<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <el-dialog v-model="showHubSettings" :title="$t('hub_settings.title')" width="500px"
    :close-on-click-modal="true" @closed="closeHubSettings">
    <label class="field">
      <span class="field-label">{{ $t('hub_settings.security_entry') }}</span>
      <el-input v-model="hubSecurityEntry" :placeholder="$t('hub_settings.entry_placeholder')">
        <template #prepend>/</template>
      </el-input>
      <span class="field-hint">{{ $t('hub_settings.entry_hint', { entry: hubSecurityEntry }) }}</span>
    </label>
    <label class="field">
      <span class="field-label">{{ $t('hub_settings.security_content') }}</span>
      <el-input v-model="hubSecurityContent" type="textarea" :rows="10" />
    </label>
    <template #footer>
      <el-button @click="closeHubSettings">{{ $t('cancel') }}</el-button>
      <el-button type="primary" :loading="savingHubSettings" @click="saveHubSettings">
        {{ savingHubSettings ? $t('saving') : $t('save') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, inject, type Ref } from 'vue';

export default defineComponent({
  setup() {
    return {
      showHubSettings: inject<Ref<boolean>>('showHubSettings')!,
      hubSecurityEntry: inject<Ref<string>>('hubSecurityEntry')!,
      hubSecurityContent: inject<Ref<string>>('hubSecurityContent')!,
      savingHubSettings: inject<Ref<boolean>>('savingHubSettings')!,
      closeHubSettings: inject('closeHubSettings')!,
      saveHubSettings: inject('saveHubSettings')!,
    };
  },
});
</script>

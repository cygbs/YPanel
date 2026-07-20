<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div v-if="showHubSettings" class="dialog-overlay" @click.self="closeHubSettings">
    <div class="dialog">
      <div class="dialog-title">{{ $t('hub_settings.title') }}</div>
      <div class="dialog-body">
        <label class="field">
          <span class="field-label">{{ $t('hub_settings.security_entry') }}</span>
          <div class="input-with-prefix">
            <span class="input-prefix">/</span>
            <input v-model="hubSecurityEntry" type="text" class="input prefix-input"
              :placeholder="$t('hub_settings.entry_placeholder')" />
          </div>
          <span class="field-hint">{{ $t('hub_settings.entry_hint', { entry: hubSecurityEntry }) }}</span>
        </label>
        <label class="field">
          <span class="field-label">{{ $t('hub_settings.security_content') }}</span>
          <textarea v-model="hubSecurityContent" class="textarea" rows="10"></textarea>
        </label>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="closeHubSettings">{{ $t('cancel') }}</button>
        <button class="btn btn-primary" :disabled="savingHubSettings" @click="saveHubSettings">
          {{ savingHubSettings ? $t('saving') : $t('save') }}
        </button>
      </div>
    </div>
  </div>
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

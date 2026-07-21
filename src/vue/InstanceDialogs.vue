<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <!-- 新建/编辑实例 -->
  <el-dialog v-model="showNewDialog" width="500px"
    :title="isEditing ? $t('instance_form.title_edit') : $t('instance_form.title_create')"
    :close-on-click-modal="true" @closed="closeNewDialog">
    <label class="field">
      <span class="field-label">{{ $t('instance_form.name') }}</span>
      <el-input v-model="newData.name" :class="{ invalid: errors.name }"
        :placeholder="$t('instance_form.name_placeholder')" />
      <span v-if="errors.name" class="field-error">{{ $t('instance_form.required') }}</span>
    </label>
    <label class="field">
      <span class="field-label">{{ $t('instance_form.uuid') }}</span>
      <el-input :model-value="newData.uuid" readonly class="mono-input" />
    </label>
    <label class="field">
      <span class="field-label">{{ $t('instance_form.icon') }}</span>
      <div class="icon-selector" @click="showInstanceIconPicker = !showInstanceIconPicker">
        <img class="icon-preview" :src="'/assets/instances/' + newData.icon" :alt="newData.icon" />
        <span class="icon-name">{{ newData.icon }}</span>
      </div>
      <div v-if="showInstanceIconPicker" class="icon-grid">
        <div v-for="icon in icons" :key="icon" class="icon-option"
          :class="{ selected: icon === newData.icon }" @click="pickIcon(icon)">
          <img :src="'/assets/instances/' + icon" :alt="icon" />
        </div>
      </div>
    </label>
    <label class="field">
      <span class="field-label">{{ $t('instance_form.command') }}
        <span v-if="isEditingLocked" class="field-hint">{{ $t('instance_form.command_lock') }}</span>
      </span>
      <el-input v-model="newData.command" :disabled="isEditingLocked"
        :class="{ invalid: errors.command }" class="mono-input" placeholder="java -jar xxx.jar" />
      <span v-if="errors.command" class="field-error">{{ $t('instance_form.required') }}</span>
    </label>
    <label class="field">
      <span class="field-label">{{ $t('instance_form.folder') }}
        <span v-if="isEditingLocked" class="field-hint">{{ $t('instance_form.folder_lock') }}</span>
      </span>
      <el-input v-model="newData.folder" :disabled="isEditingLocked"
        :class="{ invalid: errors.folder }" class="mono-input" placeholder="path/to/your/folder" />
      <span v-if="errors.folder" class="field-error">{{ $t('instance_form.required') }}</span>
    </label>
    <label class="field">
      <span class="field-label">{{ $t('instance_form.stop_command') }}</span>
      <el-input v-model="newData.stopCommand" class="mono-input" placeholder="^C" />
    </label>
    <label class="field field-row">
      <el-checkbox v-model="newData.autoStart" :label="$t('instance_form.auto_start')" />
    </label>
    <template #footer>
      <el-button @click="closeNewDialog">{{ $t('cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="createInstance">
        {{ saving ? $t('saving') : isEditing ? $t('save') : $t('instance_form.create') }}
      </el-button>
    </template>
  </el-dialog>

  <!-- 设置 -->
  <el-dialog v-model="showSettings" width="500px"
    :title="$t('node_settings.title', { name: activeNode?.name || 'Node' })"
    :close-on-click-modal="true" @closed="closeSettings">
    <label class="field">
      <span class="field-label">{{ $t('node_settings.default_shell') }}</span>
      <el-input v-model="settings.defaultShell" class="mono-input"
        :placeholder="$t('node_settings.shell_placeholder')" />
    </label>
    <label class="field">
      <span class="field-label">{{ $t('node_settings.text_editor') }}</span>
      <el-input v-model="settings.textEditor" class="mono-input"
        :placeholder="$t('node_settings.editor_placeholder')" />
    </label>
    <template #footer>
      <el-button @click="closeSettings">{{ $t('cancel') }}</el-button>
      <el-button type="primary" :loading="savingSettings" @click="saveSettings">
        {{ savingSettings ? $t('saving') : $t('save') }}
      </el-button>
    </template>
  </el-dialog>

  <!-- 删除实例确认 -->
  <el-dialog v-model="showDeleteConfirm" width="400px"
    :title="$t('delete_instance.title')"
    :close-on-click-modal="true" @closed="cancelDelete">
    <p class="delete-warning">{{ $t('delete_instance.body') }}</p>
    <template #footer>
      <el-button @click="cancelDelete">{{ $t('delete_instance.cancel') }}</el-button>
      <el-button type="danger" @click="confirmDelete">{{ $t('delete_instance.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, inject, ref, type Ref } from 'vue';

export default defineComponent({
  setup() {
    const showNewDialog = inject<Ref<boolean>>('showNewDialog')!;
    const isEditing = inject<Ref<boolean>>('isEditing')!;
    const isEditingLocked = inject<Ref<boolean>>('isEditingLocked')!;
    const newData = inject<any>('newData')!;
    const errors = inject<any>('errors')!;
    const saving = inject<Ref<boolean>>('saving')!;
    const showSettings = inject<Ref<boolean>>('showSettings')!;
    const settings = inject<any>('settings')!;
    const activeNode = inject<Ref<any>>('activeNode')!;
    const savingSettings = inject<Ref<boolean>>('savingSettings')!;
    const showDeleteConfirm = inject<Ref<boolean>>('showDeleteConfirm')!;
    const icons = inject<string[]>('AVAILABLE_ICONS')!;

    const showInstanceIconPicker = ref(false);

    return {
      showNewDialog, isEditing, isEditingLocked, newData, errors, saving,
      showSettings, settings, activeNode, savingSettings, showDeleteConfirm,
      icons, showInstanceIconPicker,
      closeNewDialog: inject('closeNewDialog')!,
      createInstance: inject('createInstance')!,
      closeSettings: inject('closeSettings')!,
      saveSettings: inject('saveSettings')!,
      cancelDelete: inject('cancelDelete')!,
      confirmDelete: inject('confirmDelete')!,
      pickIcon(name: string) { newData.icon = name; showInstanceIconPicker.value = false; },
    };
  },
});
</script>

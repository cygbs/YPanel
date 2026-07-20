<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <!-- 新建/编辑实例 -->
  <div v-if="showNewDialog" class="dialog-overlay" @click.self="closeNewDialog">
    <div class="dialog">
      <div class="dialog-title">{{ isEditing ? $t('instance_form.title_edit') : $t('instance_form.title_create') }}</div>
      <div class="dialog-body">
        <label class="field">
          <span class="field-label">{{ $t('instance_form.name') }}</span>
          <input v-model="newData.name" type="text" class="input" :class="{ invalid: errors.name }"
            :placeholder="$t('instance_form.name_placeholder')" />
          <span v-if="errors.name" class="field-error">{{ $t('instance_form.required') }}</span>
        </label>
        <label class="field">
          <span class="field-label">{{ $t('instance_form.uuid') }}</span>
          <input :value="newData.uuid" type="text" class="input mono" readonly />
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
          <input v-model="newData.command" type="text" class="input mono"
            :class="{ invalid: errors.command }" :disabled="isEditingLocked" placeholder="java -jar xxx.jar" />
          <span v-if="errors.command" class="field-error">{{ $t('instance_form.required') }}</span>
        </label>
        <label class="field">
          <span class="field-label">{{ $t('instance_form.folder') }}
            <span v-if="isEditingLocked" class="field-hint">{{ $t('instance_form.folder_lock') }}</span>
          </span>
          <input v-model="newData.folder" type="text" class="input mono"
            :class="{ invalid: errors.folder }" :disabled="isEditingLocked" placeholder="path/to/your/folder" />
          <span v-if="errors.folder" class="field-error">{{ $t('instance_form.required') }}</span>
        </label>
        <label class="field">
          <span class="field-label">{{ $t('instance_form.stop_command') }}</span>
          <input v-model="newData.stopCommand" type="text" class="input mono" placeholder="^C" />
        </label>
        <label class="field field-row">
          <input type="checkbox" class="checkbox" v-model="newData.autoStart" />
          <span class="field-label">{{ $t('instance_form.auto_start') }}</span>
        </label>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="closeNewDialog">{{ $t('cancel') }}</button>
        <button class="btn btn-primary" :disabled="saving" @click="createInstance">
          {{ saving ? $t('saving') : isEditing ? $t('save') : $t('instance_form.create') }}
        </button>
      </div>
    </div>
  </div>

  <!-- 设置 -->
  <div v-if="showSettings" class="dialog-overlay" @click.self="closeSettings">
    <div class="dialog">
      <div class="dialog-title">{{ $t('node_settings.title', { name: activeNode?.name || 'Node' }) }}</div>
      <div class="dialog-body">
        <label class="field">
          <span class="field-label">{{ $t('node_settings.default_shell') }}</span>
          <input v-model="settings.defaultShell" type="text" class="input mono"
            :placeholder="$t('node_settings.shell_placeholder')" />
        </label>
        <label class="field">
          <span class="field-label">{{ $t('node_settings.text_editor') }}</span>
          <input v-model="settings.textEditor" type="text" class="input mono"
            :placeholder="$t('node_settings.editor_placeholder')" />
        </label>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="closeSettings">{{ $t('cancel') }}</button>
        <button class="btn btn-primary" :disabled="savingSettings" @click="saveSettings">
          {{ savingSettings ? $t('saving') : $t('save') }}
        </button>
      </div>
    </div>
  </div>

  <!-- 删除实例确认 -->
  <div v-if="showDeleteConfirm" class="dialog-overlay" @click.self="cancelDelete">
    <div class="dialog dialog-sm">
      <div class="dialog-title">{{ $t('delete_instance.title') }}</div>
      <div class="dialog-body"><p class="delete-warning">{{ $t('delete_instance.body') }}</p></div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="cancelDelete">{{ $t('delete_instance.cancel') }}</button>
        <button class="btn btn-danger" @click="confirmDelete">{{ $t('delete_instance.confirm') }}</button>
      </div>
    </div>
  </div>
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

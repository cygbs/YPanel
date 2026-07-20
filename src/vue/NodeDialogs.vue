<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <!-- 新增节点 -->
  <div v-if="showNodeDialog" class="dialog-overlay" @click.self="closeNodeDialog">
    <div class="dialog dialog-sm">
      <div class="dialog-title">{{ $t('add_node.title') }}</div>
      <div class="dialog-body">
        <div class="node-gen-row">
          <input v-model="newNodeName" type="text" class="input"
            :placeholder="$t('add_node.name_placeholder')" @keyup.enter="generateNodeToken" />
          <button class="btn btn-primary" :disabled="generatingNode" @click="generateNodeToken">
            {{ generatingNode ? $t('add_node.generating') : $t('add_node.generate') }}
          </button>
        </div>
        <div v-if="nodeError" class="field-error">{{ nodeError }}</div>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="closeNodeDialog">{{ $t('close') }}</button>
      </div>
    </div>
  </div>

  <!-- Token 命令 -->
  <div v-if="showGeneratedToken" class="dialog-overlay" @click.self="showGeneratedToken = false">
    <div class="dialog">
      <div class="dialog-title">{{ $t('token_dialog.title', { name: generatedNodeName }) }}</div>
      <div class="dialog-body">
        <div class="node-token-label" style="margin-bottom:8px">{{ $t('token_dialog.command_hint') }}</div>
        <div class="token-cmd-box">
          <code class="token-cmd-text">node index.js -s {{ wsHost }}/link -t {{ generatedToken }}</code>
        </div>
        <div class="token-cmd-note">{{ $t('token_dialog.auto_close') }}</div>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-primary" @click="copyToken">{{ $t('token_dialog.copy') }}</button>
        <button class="btn btn-secondary" @click="showGeneratedToken = false">{{ $t('close') }}</button>
      </div>
    </div>
  </div>

  <!-- 编辑节点 -->
  <div v-if="showEditNodeDialog" class="dialog-overlay" @click.self="closeEditNode">
    <div class="dialog">
      <div class="dialog-title">{{ $t('edit_node.title') }}</div>
      <div class="dialog-body">
        <label class="field">
          <span class="field-label">{{ $t('edit_node.name') }}</span>
          <input v-model="editNodeData.name" type="text" class="input" :placeholder="$t('edit_node.name')" />
        </label>
        <label class="field">
          <span class="field-label">{{ $t('edit_node.icon') }}</span>
          <div class="icon-selector" @click="showNodeIconPicker = !showNodeIconPicker">
            <img class="icon-preview" :src="'/assets/instances/' + editNodeData.icon" :alt="editNodeData.icon" />
            <span class="icon-name">{{ editNodeData.icon }}</span>
          </div>
          <div v-if="showNodeIconPicker" class="icon-grid">
            <div v-for="icon in icons" :key="icon" class="icon-option"
              :class="{ selected: icon === editNodeData.icon }" @click="editNodeData.icon = icon">
              <img :src="'/assets/instances/' + icon" :alt="icon" />
            </div>
          </div>
        </label>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="closeEditNode">{{ $t('cancel') }}</button>
        <button class="btn btn-primary" :disabled="savingNode" @click="saveEditNode">
          {{ savingNode ? $t('saving') : $t('save') }}
        </button>
      </div>
    </div>
  </div>

  <!-- 删除节点确认 -->
  <div v-if="showNodeDeleteConfirm" class="dialog-overlay" @click.self="cancelNodeDelete">
    <div class="dialog dialog-sm">
      <div class="dialog-title">{{ $t('delete_node.title') }}</div>
      <div class="dialog-body"><p class="delete-warning">{{ $t('delete_node.body') }}</p></div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="cancelNodeDelete">{{ $t('cancel') }}</button>
        <button class="btn btn-danger" @click="confirmNodeDelete">{{ $t('delete_node.confirm') }}</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, ref, type Ref } from 'vue';

export default defineComponent({
  setup() {
    const showNodeDialog = inject<Ref<boolean>>('showNodeDialog')!;
    const newNodeName = inject<Ref<string>>('newNodeName')!;
    const generatingNode = inject<Ref<boolean>>('generatingNode')!;
    const generatedToken = inject<Ref<string>>('generatedToken')!;
    const generatedNodeName = inject<Ref<string>>('generatedNodeName')!;
    const showGeneratedToken = inject<Ref<boolean>>('showGeneratedToken')!;
    const nodeError = inject<Ref<string>>('nodeError')!;
    const showEditNodeDialog = inject<Ref<boolean>>('showEditNodeDialog')!;
    const editNodeData = inject<any>('editNodeData')!;
    const savingNode = inject<Ref<boolean>>('savingNode')!;
    const showNodeDeleteConfirm = inject<Ref<boolean>>('showNodeDeleteConfirm')!;
    const wsHost = inject<Ref<string>>('wsHost')!;
    const icons = inject<string[]>('AVAILABLE_ICONS')!;

    const showNodeIconPicker = ref(false);

    return {
      showNodeDialog, newNodeName, generatingNode, generatedToken,
      generatedNodeName, showGeneratedToken, nodeError, showEditNodeDialog,
      editNodeData, savingNode, showNodeDeleteConfirm, wsHost, icons,
      showNodeIconPicker,
      generateNodeToken: inject('generateNodeToken')!,
      closeNodeDialog: inject('closeNodeDialog')!,
      copyToken: inject('copyToken')!,
      openEditNode: inject('openEditNode')!,
      closeEditNode: inject('closeEditNode')!,
      saveEditNode: inject('saveEditNode')!,
      cancelNodeDelete: inject('cancelNodeDelete')!,
      confirmNodeDelete: inject('confirmNodeDelete')!,
    };
  },
});
</script>

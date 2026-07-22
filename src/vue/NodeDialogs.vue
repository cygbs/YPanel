<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <!-- 新增节点 -->
  <el-dialog v-model="showNodeDialog" :title="$t('add_node.title')" width="400px"
    :close-on-click-modal="true" @closed="closeNodeDialog">
    <div class="node-gen-row">
      <el-input v-model="newNodeName" :placeholder="$t('add_node.name_placeholder')"
        @keyup.enter="generateNodeToken" style="flex:1" />
      <el-button type="primary" :loading="generatingNode" @click="generateNodeToken">
        {{ generatingNode ? $t('add_node.generating') : $t('add_node.generate') }}
      </el-button>
    </div>
    <div v-if="nodeError" class="field-error" style="margin-top:8px">{{ nodeError }}</div>
    <template #footer>
      <el-button @click="closeNodeDialog">{{ $t('close') }}</el-button>
    </template>
  </el-dialog>

  <!-- Token 命令 -->
  <el-dialog v-model="showGeneratedToken" width="500px"
    :title="$t('token_dialog.title', { name: generatedNodeName })"
    :close-on-click-modal="true">
    <div class="node-token-label" style="margin-bottom:8px">{{ $t('token_dialog.command_hint') }}</div>
    <div class="token-cmd-box">
      <code class="token-cmd-text">ypanel node -s {{ wsHost }} -t {{ generatedToken }}</code>
    </div>
    <div class="token-cmd-note">{{ $t('token_dialog.auto_close') }}</div>
    <template #footer>
      <el-button type="primary" @click="copyToken">{{ $t('token_dialog.copy') }}</el-button>
      <el-button @click="showGeneratedToken = false">{{ $t('close') }}</el-button>
    </template>
  </el-dialog>

  <!-- 编辑节点 -->
  <el-dialog v-model="showEditNodeDialog" :title="$t('edit_node.title')" width="500px"
    :close-on-click-modal="true" @closed="closeEditNode">
    <label class="field">
      <span class="field-label">{{ $t('edit_node.name') }}</span>
      <el-input v-model="editNodeData.name" :placeholder="$t('edit_node.name')" />
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
    <template #footer>
      <el-button @click="closeEditNode">{{ $t('cancel') }}</el-button>
      <el-button type="primary" :loading="savingNode" @click="saveEditNode">
        {{ savingNode ? $t('saving') : $t('save') }}
      </el-button>
    </template>
  </el-dialog>

  <!-- 删除节点确认 -->
  <el-dialog v-model="showNodeDeleteConfirm" :title="$t('delete_node.title')" width="400px"
    :close-on-click-modal="true" @closed="cancelNodeDelete">
    <p class="delete-warning">{{ $t('delete_node.body') }}</p>
    <template #footer>
      <el-button @click="cancelNodeDelete">{{ $t('cancel') }}</el-button>
      <el-button type="danger" @click="confirmNodeDelete">{{ $t('delete_node.confirm') }}</el-button>
    </template>
  </el-dialog>
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
      closeEditNode: inject('closeEditNode')!,
      saveEditNode: inject('saveEditNode')!,
      cancelNodeDelete: inject('cancelNodeDelete')!,
      confirmNodeDelete: inject('confirmNodeDelete')!,
    };
  },
});
</script>

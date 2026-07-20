<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div v-show="activeId === 0" class="page-home">
    <div class="quick-actions">
      <template v-if="activeNodeId !== null">
        <button @click="openNewInstance">{{ $t('quick.new_instance') }}</button>
        <button @click="openFileManager()">{{ $t('quick.file_manager') }}</button>
        <button @click="openSettings">{{ $t('quick.settings') }}</button>
        <button @click="leaveNode" class="qa-back">{{ $t('quick.back_to_nodes') }}</button>
      </template>
      <template v-else>
        <button @click="openNodeDialog">{{ $t('quick.add_node') }}</button>
        <button @click="openHubSettings">{{ $t('quick.hub_settings') }}</button>
      </template>
      <button @click="openHelp">{{ $t('quick.help') }}</button>
      <button @click="cycleLocale" class="lang-btn">{{ $t('lang.title') }}</button>
      <button @click="doLogout" class="qa-back" style="margin-left:auto">{{ $t('quick.logout') }}</button>
    </div>

    <div class="home-body">
      <!-- 节点列表模式 -->
      <template v-if="activeNodeId === null">
        <div class="instance-list">
          <div v-for="node in nodes" :key="node.id" class="instance-card"
            :class="{ selected: node.id === selectedNodeId }"
            @click="selectNode(node.id)" @dblclick="dblclickNode(node)">
            <div class="inst-icon-wrap">
              <img class="inst-icon" :src="'/assets/instances/' + (node.icon || 'gear.svg')" :alt="node.name" />
              <span class="status-dot" :class="node.connected ? 'running' : 'offline'"></span>
            </div>
            <span class="inst-name">{{ node.name }}</span>
          </div>
          <div v-if="nodes.length === 0" class="no-instances-hint">{{ $t('nodes.none') }}</div>
        </div>
        <div class="function-menu">
          <template v-if="selectedNodeForMenu">
            <div class="fm-icon" @click="selectNode(null)">
              <img :src="'/assets/instances/' + (selectedNodeForMenu.icon || 'gear.svg')" />
            </div>
            <div class="fm-name">{{ selectedNodeForMenu.name }}</div>
            <div class="fm-actions">
              <button class="fm-btn" @click="clickSwitchNode(selectedNodeForMenu)">{{ $t('nodes.switch') }}</button>
              <button class="fm-btn" @click="openEditNode">{{ $t('nodes.edit') }}</button>
              <button class="fm-btn fm-btn-danger" @click="openNodeDelete(selectedNodeForMenu.id)">{{ $t('nodes.delete') }}</button>
            </div>
          </template>
          <div v-else class="fm-empty">{{ $t('nodes.select_hint') }}</div>
        </div>
      </template>

      <!-- 实例模式 -->
      <template v-else>
        <div class="instance-list">
          <div v-for="inst in instances" :key="inst.id" class="instance-card"
            :class="{ selected: inst.id === selectedInstance?.id }"
            @click="selectInstance(inst.id)" @dblclick="openTerminal()">
            <div class="inst-icon-wrap">
              <img class="inst-icon" :src="'/assets/instances/' + (inst.icon || 'grass.svg')" :alt="inst.name" />
              <span v-if="runningStates[inst.id]" class="status-dot" :class="runningStates[inst.id]"></span>
            </div>
            <span class="inst-name">{{ inst.name }} #{{ inst.id }}</span>
          </div>
          <div v-if="instances.length === 0" class="no-instances-hint">{{ $t('instances.none') }}</div>
        </div>
        <div class="function-menu">
          <template v-if="selectedInstance">
            <div class="fm-icon" @click="selectInstance(null)">
              <img :src="'/assets/instances/' + (selectedInstance.icon || 'grass.svg')" :alt="selectedInstance.name" />
            </div>
            <div class="fm-name">{{ selectedInstance.name }}</div>
            <div class="fm-actions">
              <button class="fm-btn" :disabled="selectedInstance ? !!runningStates[selectedInstance.id] : true" @click="startInstance">{{ $t('instances.start') }}</button>
              <button class="fm-btn" :class="{ 'btn-warning': selectedInstance && stopRequested[selectedInstance.id] }"
                :disabled="selectedInstance ? !runningStates[selectedInstance.id] && !stopRequested[selectedInstance.id] : true"
                @click="stopInstance">{{ selectedInstance && stopRequested[selectedInstance.id] ? $t('instances.force_stop') : $t('instances.stop') }}</button>
              <button class="fm-btn" @click="openTerminal">{{ $t('instances.open_terminal') }}</button>
              <button class="fm-btn" @click="openInstanceFolder">{{ $t('instances.open_folder') }}</button>
              <button class="fm-btn" @click="openEditInstance">{{ $t('instances.edit') }}</button>
              <button class="fm-btn fm-btn-danger" @click="openDeleteConfirm">{{ $t('instances.delete') }}</button>
            </div>
          </template>
          <div v-else class="fm-empty">{{ $t('instances.select_hint') }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, type Ref, type ComputedRef } from 'vue';

export default defineComponent({
  setup() {
    const nodes = inject<Ref<any[]>>('nodes')!;
    const activeNodeId = inject<Ref<number | null>>('activeNodeId')!;
    const activeId = inject<Ref<number>>('activeId')!;
    const instances = inject<Ref<any[]>>('instances')!;
    const selectedNodeId = inject<Ref<number | null>>('selectedNodeId')!;
    const selectedNodeForMenu = inject<ComputedRef<any>>('selectedNodeForMenu')!;
    const selectedInstance = inject<ComputedRef<any>>('selectedInstance')!;
    const runningStates = inject<any>('runningStates')!;
    const stopRequested = inject<any>('stopRequested')!;

    const openFileManager = inject<(initPath?: string) => void>('openFileManager')!;
    function openInstanceFolder(): void {
      const inst = selectedInstance.value;
      if (inst?.folder) openFileManager(inst.folder);
    }

    return {
      nodes, activeNodeId, activeId, instances,
      selectedNodeId, selectedNodeForMenu, selectedInstance,
      runningStates, stopRequested,
      selectNode: inject('selectNode')!,
      selectInstance: inject('selectInstance')!,
      openNewInstance: inject('openNewInstance')!,
      openFileManager: inject('openFileManager')!,
      openInstanceFolder,
      openUploadDialog: inject('openUploadDialog')!,
      openSettings: inject('openSettings')!,
      openNodeDialog: inject('openNodeDialog')!,
      openHubSettings: inject('openHubSettings')!,
      openHelp: inject('openHelp')!,
      cycleLocale: inject('cycleLocale')!,
      doLogout: inject('doLogout')!,
      leaveNode: inject('leaveNode')!,
      dblclickNode: inject('dblclickNode')!,
      clickSwitchNode: inject('clickSwitchNode')!,
      openEditNode: inject('openEditNode')!,
      openNodeDelete: inject('openNodeDelete')!,
      startInstance: inject('startInstance')!,
      stopInstance: inject('stopInstance')!,
      openTerminal: inject('openTerminal')!,
      openEditInstance: inject('openEditInstance')!,
      openDeleteConfirm: inject('openDeleteConfirm')!,
    };
  },
});
</script>

<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div v-show="activeId === 0" class="page-home">

    <!-- ═══════════════ 工具栏 ═══════════════ -->
    <div class="home-toolbar">
      <div class="home-toolbar-left">
        <!-- 节点模式 -->
        <template v-if="activeNodeId === null">
          <el-button size="small" @click="openNodeDialog">
            <span class="btn-inner"><el-icon><Plus /></el-icon>{{ $t('quick.add_node') }}</span>
          </el-button>
          <el-button size="small" @click="openHubSettings">
            <span class="btn-inner"><el-icon><Setting /></el-icon>{{ $t('quick.hub_settings') }}</span>
          </el-button>
        </template>
        <!-- 实例模式 -->
        <template v-else>
          <el-button size="small" type="primary" @click="openNewInstance">
            <span class="btn-inner"><el-icon><Plus /></el-icon>{{ $t('quick.new_instance') }}</span>
          </el-button>
          <el-button size="small" @click="openFileManager()">
            <span class="btn-inner"><el-icon><FolderOpened /></el-icon>{{ $t('quick.file_manager') }}</span>
          </el-button>
          <el-button size="small" @click="openSettings">
            <span class="btn-inner"><el-icon><Setting /></el-icon>{{ $t('quick.settings') }}</span>
          </el-button>
          <el-button size="small" @click="leaveNode">
            <span class="btn-inner"><el-icon><ArrowLeft /></el-icon>{{ $t('quick.back_to_nodes') }}</span>
          </el-button>
        </template>
      </div>
      <div class="home-toolbar-right">
        <el-button size="small" @click="openHelp">
          <el-icon><QuestionFilled /></el-icon>
        </el-button>
        <el-button size="small" @click="cycleLocale">
          <span class="btn-inner"><el-icon><ChatDotRound /></el-icon>{{ $t('lang.title') }}</span>
        </el-button>
        <el-button size="small" @click="toggleTheme">
          <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
        </el-button>
        <el-button size="small" type="danger" plain @click="doLogout">
          <span class="btn-inner"><el-icon><SwitchButton /></el-icon>{{ $t('quick.logout') }}</span>
        </el-button>
      </div>
    </div>

    <!-- ═══════════════ 主体 ═══════════════ -->
    <div class="home-body">

      <!-- ══ 节点列表 ══ -->
      <template v-if="activeNodeId === null">
        <div class="home-grid">
          <el-card
            v-for="node in nodes" :key="node.id"
            shadow="hover"
            :class="['home-card', { selected: node.id === selectedNodeId }]"
            :body-style="{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', padding:'10px' }"
            @click="selectNode(node.id)"
            @dblclick="dblclickNode(node)"
          >
            <div class="card-icon-wrap">
              <img class="card-icon" :src="'/assets/instances/' + (node.icon || 'gear.svg')" :alt="node.name" />
              <span class="card-dot" :class="node.connected ? 'online' : 'offline'" />
            </div>
            <span class="card-name">{{ node.name }}</span>
          </el-card>
          <div v-if="nodes.length === 0" class="home-empty">{{ $t('nodes.none') }}</div>
        </div>

        <el-card class="home-sidebar" :body-style="{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', padding:'16px 12px' }">
          <template v-if="selectedNodeForMenu">
            <div class="sidebar-icon" @click="selectNode(null)">
              <img :src="'/assets/instances/' + (selectedNodeForMenu.icon || 'gear.svg')" :alt="selectedNodeForMenu.name" />
            </div>
            <div class="sidebar-name">{{ selectedNodeForMenu.name }}</div>
            <div class="sidebar-actions">
              <el-button size="small" type="primary" @click="clickSwitchNode(selectedNodeForMenu)">
                {{ $t('nodes.switch') }}
              </el-button>
              <el-button size="small" plain @click="openEditNode">
                <span class="btn-inner"><el-icon><Edit /></el-icon>{{ $t('nodes.edit') }}</span>
              </el-button>
              <el-button size="small" type="danger" plain @click="openNodeDelete(selectedNodeForMenu.id)">
                <span class="btn-inner"><el-icon><Delete /></el-icon>{{ $t('nodes.delete') }}</span>
              </el-button>
            </div>
          </template>
          <div v-else class="sidebar-empty">{{ $t('nodes.select_hint') }}</div>
        </el-card>
      </template>

      <!-- ══ 实例列表 ══ -->
      <template v-else>
        <div class="home-grid">
          <el-card
            v-for="inst in instances" :key="inst.id"
            shadow="hover"
            :class="['home-card', { selected: inst.id === selectedInstance?.id }]"
            :body-style="{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', padding:'10px' }"
            @click="selectInstance(inst.id)"
            @dblclick="openTerminal()"
          >
            <div class="card-icon-wrap">
              <img class="card-icon" :src="'/assets/instances/' + (inst.icon || 'grass.svg')" :alt="inst.name" />
              <span
                v-if="runningStates[inst.id]"
                class="card-dot"
                :class="runningStates[inst.id]"
              />
            </div>
            <span class="card-name">{{ inst.name }} #{{ inst.id }}</span>
          </el-card>
          <div v-if="instances.length === 0" class="home-empty">{{ $t('instances.none') }}</div>
        </div>

        <el-card class="home-sidebar" :body-style="{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', padding:'16px 12px' }">
          <template v-if="selectedInstance">
            <div class="sidebar-icon" @click="selectInstance(null)">
              <img :src="'/assets/instances/' + (selectedInstance.icon || 'grass.svg')" :alt="selectedInstance.name" />
            </div>
            <div class="sidebar-name">{{ selectedInstance.name }}</div>
            <div class="sidebar-actions">
              <el-button
                size="small" type="primary"
                :disabled="!!runningStates[selectedInstance.id]"
                @click="startInstance"
              >
                <span class="btn-inner"><el-icon><VideoPlay /></el-icon>{{ $t('instances.start') }}</span>
              </el-button>
              <el-button
                size="small"
                :type="stopRequested[selectedInstance.id] ? 'warning' : 'default'"
                :disabled="!runningStates[selectedInstance.id] && !stopRequested[selectedInstance.id]"
                @click="stopInstance"
              >
                <span class="btn-inner"><el-icon><VideoPause /></el-icon>{{ stopRequested[selectedInstance.id] ? $t('instances.force_stop') : $t('instances.stop') }}</span>
              </el-button>
              <el-button size="small" plain @click="openTerminal">
                <span class="btn-inner"><el-icon><Monitor /></el-icon>{{ $t('instances.open_terminal') }}</span>
              </el-button>
              <el-button size="small" plain @click="openInstanceFolder">
                <span class="btn-inner"><el-icon><FolderOpened /></el-icon>{{ $t('instances.open_folder') }}</span>
              </el-button>
              <el-button size="small" plain @click="openEditInstance">
                <span class="btn-inner"><el-icon><Edit /></el-icon>{{ $t('instances.edit') }}</span>
              </el-button>
              <el-button size="small" type="danger" plain @click="openDeleteConfirm">
                <span class="btn-inner"><el-icon><Delete /></el-icon>{{ $t('instances.delete') }}</span>
              </el-button>
            </div>
          </template>
          <div v-else class="sidebar-empty">{{ $t('instances.select_hint') }}</div>
        </el-card>
      </template>
    </div>

    <!-- ═══════════════ 底部信息条 ═══════════════ -->
    <div class="home-footer">{{ footerText }}</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, type Ref, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Plus, FolderOpened, Setting, ArrowLeft,
  QuestionFilled, ChatDotRound, Sunny, Moon, SwitchButton,
  VideoPlay, VideoPause, Monitor, Edit, Delete,
} from '@element-plus/icons-vue';

export default defineComponent({
  components: {
    Plus, FolderOpened, Setting, ArrowLeft,
    QuestionFilled, ChatDotRound, Sunny, Moon, SwitchButton,
    VideoPlay, VideoPause, Monitor, Edit, Delete,
  },
  setup() {
    // ── 主题 ──
    const isDark = ref(document.documentElement.classList.contains('dark'));

    function toggleTheme(): void {
      isDark.value = !isDark.value;
      document.documentElement.classList.toggle('dark', isDark.value);
      document.cookie = `YPanelTheme=${isDark.value ? 'dark' : 'light'}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
    }

    // ── inject ──
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

    // ── 底部信息条 ──
    const { t } = useI18n();
    const activeNode = inject<ComputedRef<any>>('activeNode')!;

    /** 格式化时间戳，使用 i18n time_format 模板 */
    function formatTime(ts: number): string {
      const d = new Date(ts);
      const pad = (n: number) => String(n).padStart(2, '0');
      return t('footer.time_format', {
        year: String(d.getFullYear()),
        month: pad(d.getMonth() + 1),
        day: pad(d.getDate()),
        hour: pad(d.getHours()),
        minute: pad(d.getMinutes()),
      });
    }

    /** 格式化毫秒时长，使用 i18n 单位 */
    function formatDuration(ms: number): string {
      if (ms <= 0) return t('footer.duration_zero');
      const totalMin = Math.floor(ms / 60000);
      const days = Math.floor(totalMin / 1440);
      const hours = Math.floor((totalMin % 1440) / 60);
      const minutes = totalMin % 60;
      const parts: string[] = [];
      if (days > 0) parts.push(t('footer.duration_d', { n: days }));
      if (hours > 0) parts.push(t('footer.duration_h', { n: hours }));
      if (minutes > 0 || parts.length === 0) parts.push(t('footer.duration_m', { n: minutes }));
      return parts.join('');
    }

    const footerText = computed(() => {
      const inst = selectedInstance.value;
      // 选中了实例
      if (inst) {
        const running = runningStates[inst.id];
        const lastStart = inst.lastStartTime;
        const totalRuntime = inst.totalRuntime || 0;
        const name = inst.name;
        if (running) {
          return t('footer.instance_running', {
            name,
            startTime: lastStart ? formatTime(lastStart) : '?',
            runtime: formatDuration(totalRuntime + (lastStart ? Date.now() - lastStart : 0)),
          });
        } else {
          return t('footer.instance_stopped', {
            name,
            lastStart: lastStart ? formatTime(lastStart) : t('loading'),
            runtime: formatDuration(totalRuntime),
          });
        }
      }

      // 选中了节点（节点列表层单击，或进入节点后未选实例）
      const node = activeNodeId.value !== null ? activeNode.value : selectedNodeForMenu.value;
      if (node) {
        const name = node.name;
        const connected = node.connected;
        const startTime = node.startTime;
        const totalRuntime = node.totalRuntime || 0;
        if (connected) {
          return t('footer.node_online', {
            name,
            startTime: startTime ? formatTime(startTime) : '?',
            runtime: formatDuration(totalRuntime + (startTime ? Date.now() - startTime : 0)),
          });
        } else {
          return t('footer.node_offline', {
            name,
            lastStart: startTime ? formatTime(startTime) : t('loading'),
            runtime: formatDuration(totalRuntime),
          });
        }
      }

      return t('footer.default_slogan');
    });

    return {
      isDark, toggleTheme,
      nodes, activeNodeId, activeId, instances,
      selectedNodeId, selectedNodeForMenu, selectedInstance,
      runningStates, stopRequested,
      footerText,
      selectNode: inject('selectNode')!,
      selectInstance: inject('selectInstance')!,
      openNewInstance: inject('openNewInstance')!,
      openFileManager: inject('openFileManager')!,
      openInstanceFolder,
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

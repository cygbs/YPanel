import { defineComponent, reactive, ref, computed, type ComputedRef } from 'vue';
import TerminalTab from './TerminalTab';

interface TabData {
  id: number;
  title: string;
  type: 'home' | 'terminal';
  initCommands?: string[];
  instanceId?: number | null;
}

const AVAILABLE_ICONS = [
  'bee.svg', 'bee_legacy.svg', 'brick.svg', 'chicken.svg',
  'creeper.svg', 'diamond.svg', 'dirt.svg', 'enderman.svg',
  'enderpearl.svg', 'fabricmc.svg', 'flame.svg', 'fox.svg',
  'fox_legacy.svg', 'ftb_logo.svg', 'gear.svg', 'gold.svg',
  'grass.svg', 'herobrine.svg', 'iron.svg', 'magitech.svg',
  'meat.svg', 'modrinth.svg', 'neoforged.svg', 'netherstar.svg',
  'planks.svg', 'prismlauncher.svg', 'quiltmc.svg', 'skeleton.svg',
  'squarecreeper.svg', 'steve.svg', 'stone.svg', 'tnt.svg',
];

function generateUUID(): string {
  return crypto.randomUUID();
}

let nextTabId = 1;

interface NewInstanceData {
  name: string;
  uuid: string;
  icon: string;
  command: string;
  folder: string;
  stopCommand: string;
}

export default defineComponent({
  components: { TerminalTab },
  setup() {
    const tabs = reactive<TabData[]>([
      { id: 0, title: '主页', type: 'home' },
    ]);
    const activeId = ref(0);

    const instances = ref<any[]>([]);
    const selectedId = ref<number | null>(null);
    const selectedInstance = computed(() =>
      instances.value.find((i) => i.id === selectedId.value) ?? null
    );
    const runningStates = reactive<Record<number, 'running' | 'stopping' | false>>({});
    const showNewDialog = ref(false);
    const isEditing = ref(false);
    const editingId = ref<number | null>(null);
    const isEditingLocked = computed(() =>
      isEditing.value && editingId.value !== null && !!runningStates[editingId.value]
    );
    const showIconPicker = ref(false);
    const showSettings = ref(false);
    const savingSettings = ref(false);
    const settings = reactive({ defaultShell: '/usr/bin/bash' });
    const showDeleteConfirm = ref(false);
    const saving = ref(false);
    const tabRefs = ref<Record<number, any>>({});
    const instanceTabMap: Record<number, number> = {};

    function setTabRef(tabId: number, el: any) {
      if (el) tabRefs.value[tabId] = el;
    }
    const errors = reactive<Record<string, boolean>>({});
    const newData = reactive<NewInstanceData>({
      name: '',
      uuid: generateUUID(),
      icon: 'grass.svg',
      command: '',
      folder: '',
      stopCommand: '^C',
    });

    function resetNewData(): void {
      newData.name = '';
      newData.uuid = generateUUID();
      newData.icon = 'grass.svg';
      newData.command = '';
      newData.folder = '';
      newData.stopCommand = '^C';
      newData.autoStart = false;
    }

    function openNewInstance(): void {
      isEditing.value = false;
      editingId.value = null;
      resetNewData();
      showNewDialog.value = true;
    }

    async function openEditInstance(): Promise<void> {
      const inst = selectedInstance.value;
      if (!inst) return;
      isEditing.value = true;
      editingId.value = inst.id;
      newData.name = inst.name;
      newData.uuid = inst.uuid;
      newData.icon = inst.icon;
      newData.command = inst.command;
      newData.folder = inst.folder;
      newData.stopCommand = inst.stopCommand;
      newData.autoStart = !!inst.autoStart;
      showIconPicker.value = false;
      showNewDialog.value = true;
      // 查询最新运行状态
      try {
        const res = await fetch('/api/instances/' + inst.id + '/status');
        if (res.ok) {
          const data = await res.json();
          runningStates[inst.id] = data.running ? 'running' : false;
        }
      } catch { /* ignore */ }
    }

    function closeNewDialog(): void {
      showNewDialog.value = false;
      showIconPicker.value = false;
      isEditing.value = false;
      editingId.value = null;
    }

    function selectIcon(name: string): void {
      newData.icon = name;
      showIconPicker.value = false;
    }

    const terminalTabs = computed(() =>
      tabs.filter((t) => t.type === 'terminal')
    );

    function addTerminalTab(title?: string, initCommands?: string[], instanceId?: number): void {
      const id = nextTabId++;
      tabs.push({ id, title: title || `终端 ${id}`, type: 'terminal', initCommands });
      if (instanceId !== undefined) {
        instanceTabMap[instanceId] = id;
      }
      activeId.value = id;
    }

    function tabIdForInstance(instanceId: number): number | undefined {
      // 检查是否已有标签页关联该实例（通过 instanceTabMap 且标签页仍存在）
      const tid = instanceTabMap[instanceId];
      if (tid !== undefined && tabs.some((t) => t.id === tid)) {
        return tid;
      }
      return undefined;
    }

    async function pollStatus(): Promise<void> {
      for (const inst of instances.value) {
        try {
          const res = await fetch('/api/instances/' + inst.id + '/status');
          if (res.ok) {
            const data = await res.json();
            if (data.running) {
              if (runningStates[inst.id] === 'stopping') {
                // 还在停止过程中，保持红色
              } else {
                runningStates[inst.id] = 'running';
              }
            } else {
              runningStates[inst.id] = false;
            }
          }
        } catch { /* ignore */ }
      }
    }

    async function startInstance(): Promise<void> {
      const inst = selectedInstance.value;
      if (!inst) return;
      await fetch('/api/instances/' + inst.id + '/start', { method: 'POST' });
      runningStates[inst.id] = 'running';
      openTerminalForInstance(inst);
    }

    function openTerminalForInstance(inst: any): void {
      // 检查是否已有标签页
      const existing = tabIdForInstance(inst.id);
      if (existing !== undefined) {
        switchTab(existing);
        return;
      }
      // 新建连接实例的终端标签页
      const id = nextTabId++;
      tabs.push({
        id,
        title: `${inst.name} #${inst.id}`,
        type: 'terminal',
        initCommands: [],
        instanceId: inst.id,
      });
      instanceTabMap[inst.id] = id;
      activeId.value = id;
    }

    function openTerminal(): void {
      const inst = selectedInstance.value;
      if (!inst) return;
      openTerminalForInstance(inst);
    }

    async function stopInstance(): Promise<void> {
      const inst = selectedInstance.value;
      if (!inst) return;
      runningStates[inst.id] = 'stopping';
      await fetch('/api/instances/' + inst.id + '/stop', { method: 'POST' });
      // 3 秒后刷新状态
      setTimeout(() => pollStatus(), 3000);
    }

    function closeTab(id: number): void {
      if (id === 0) return;
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;
      tabs.splice(idx, 1);
      if (activeId.value === id) {
        activeId.value = tabs[Math.min(idx, tabs.length - 1)].id;
      }
    }

    function switchTab(id: number): void {
      activeId.value = id;
    }

    function selectInstance(id: number | null): void {
      selectedId.value = id;
    }

    async function loadInstances(): Promise<void> {
      try {
        const res = await fetch('/api/instances');
        if (res.ok) {
          const data = await res.json();
          instances.value = data.instances;
          // 初始化运行状态为 false
          for (const inst of data.instances) {
            if (!(inst.id in runningStates)) {
              runningStates[inst.id] = false;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    function validate(): boolean {
      // 清除旧错误
      Object.keys(errors).forEach((k) => delete errors[k]);
      let valid = true;
      if (!newData.name.trim()) {
        errors.name = true;
        valid = false;
      }
      if (!newData.command.trim()) {
        errors.command = true;
        valid = false;
      }
      if (!newData.folder.trim()) {
        errors.folder = true;
        valid = false;
      }
      return valid;
    }

    async function createInstance(): Promise<void> {
      if (!validate()) return;
      if (isEditingLocked.value) {
        // 实例运行中：强制恢复为原始值，防止前端绕过 disabled 修改
        const orig = selectedInstance.value;
        if (orig) {
          newData.command = orig.command;
          newData.folder = orig.folder;
        }
        // 同时在服务端也禁止修改运行中实例的 command/folder
        // 见 PUT 接口逻辑
      }
      saving.value = true;
      try {
        if (isEditing.value && editingId.value !== null) {
          // 编辑已有实例
          const res = await fetch('/api/instances/' + editingId.value, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newData.name,
              icon: newData.icon,
              command: newData.command,
              folder: newData.folder,
              stopCommand: newData.stopCommand,
              autoStart: newData.autoStart,
            }),
          });
          if (res.ok) {
            const updated = await res.json();
            const idx = instances.value.findIndex((i) => i.id === editingId.value);
            if (idx !== -1) instances.value[idx] = updated;
            closeNewDialog();
          }
        } else {
          // 新建实例
          const res = await fetch('/api/instances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newData.name,
              uuid: newData.uuid,
              icon: newData.icon,
              command: newData.command,
              folder: newData.folder,
              stopCommand: newData.stopCommand,
              autoStart: newData.autoStart,
            }),
          });
          if (res.ok) {
            const created = await res.json();
            instances.value.push(created);
            closeNewDialog();
          }
        }
      } catch (e) {
        console.error('Failed to save instance', e);
      } finally {
        saving.value = false;
      }
    }

    async function openSettings(): Promise<void> {
      showSettings.value = true;
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          settings.defaultShell = data.defaultShell || '/usr/bin/bash';
        }
      } catch { /* ignore */ }
    }

    function closeSettings(): void {
      showSettings.value = false;
    }

    async function saveSettings(): Promise<void> {
      savingSettings.value = true;
      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultShell: settings.defaultShell }),
        });
        showSettings.value = false;
      } catch { /* ignore */ }
      finally { savingSettings.value = false; }
    }

    function openDeleteConfirm(): void {
      showDeleteConfirm.value = true;
    }

    function cancelDelete(): void {
      showDeleteConfirm.value = false;
    }

    async function confirmDelete(): Promise<void> {
      const id = selectedId.value;
      if (id === null) return;
      try {
        const res = await fetch('/api/instances/' + id, { method: 'DELETE' });
        if (res.ok) {
          instances.value = instances.value.filter((i) => i.id !== id);
          selectedId.value = null;
          showDeleteConfirm.value = false;
        }
      } catch (e) {
        console.error('Failed to delete instance', e);
      }
    }

    // 初始加载
    loadInstances();

    // 加载后检查实例运行状态
    setTimeout(() => pollStatus(), 500);
    // 每 10 秒轮询一次
    const statusTimer = setInterval(() => pollStatus(), 10000);

    return {
      tabs,
      activeId,
      terminalTabs,
      addTerminalTab,
      closeTab,
      switchTab,
      showNewDialog,
      isEditing,
      isEditingLocked,
      showIconPicker,
      showSettings,
      showDeleteConfirm,
      newData,
      saving,
      savingSettings,
      settings,
      errors,
      setTabRef,
      runningStates,
      openNewInstance,
      closeNewDialog,
      selectIcon,
      createInstance,
      startInstance,
      stopInstance,
      openTerminal,
      openEditInstance,
      openSettings,
      closeSettings,
      saveSettings,
      openDeleteConfirm,
      confirmDelete,
      cancelDelete,
      instances,
      selectedInstance,
      selectInstance,
      AVAILABLE_ICONS,
    };
  },
  template: `
    <div class="app-layout">
      <!-- 标签栏 -->
      <div class="tab-bar">
        <div class="tabs-scroll">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab"
            :class="{ active: tab.id === activeId }"
            @click="switchTab(tab.id)"
            @mousedown.middle="closeTab(tab.id)"
          >
            <span class="tab-label">{{ tab.title }}</span>
            <span
              v-if="tab.type === 'terminal'"
              class="tab-close"
              @click.stop="closeTab(tab.id)"
              title="关闭"
            >&times;</span>
          </div>
        </div>
        <div class="tab-add" @click="addTerminalTab()" title="新标签页">+</div>
      </div>

      <!-- 内容区 -->
      <div class="content-area">
        <!-- 主页 -->
        <div v-show="activeId === 0" class="page-home">
          <div class="quick-actions">
            <button @click="openNewInstance">新建实例</button>
            <button>打开文件夹…</button>
            <button @click="openSettings">设置</button>
            <button>帮助</button>
          </div>
          <div class="home-body">
            <div class="instance-list">
              <div v-for="inst in instances" :key="inst.id" class="instance-card" :class="{ selected: inst.id === selectedInstance?.id }" @click="selectInstance(inst.id)">
                <div class="inst-icon-wrap">
                  <img class="inst-icon" :src="'/assets/instances/' + inst.icon" :alt="inst.name" />
                  <span v-if="runningStates[inst.id]" class="status-dot" :class="runningStates[inst.id]"></span>
                </div>
                <span class="inst-name">{{ inst.name }} #{{ inst.id }}</span>
              </div>
            </div>
            <div class="function-menu">
              <template v-if="selectedInstance">
                <div class="fm-icon" @click="selectInstance(null)">
                  <img :src="'/assets/instances/' + selectedInstance.icon" :alt="selectedInstance.name" />
                </div>
                <div class="fm-name">{{ selectedInstance.name }}</div>
                <div class="fm-actions">
                  <button class="fm-btn" @click="startInstance">启动</button>
                  <button class="fm-btn" @click="stopInstance">停止</button>
                  <button class="fm-btn" @click="openTerminal">打开终端</button>
                  <button class="fm-btn" @click="openEditInstance">编辑</button>
                  <button class="fm-btn fm-btn-danger" @click="openDeleteConfirm">删除实例</button>
                </div>
              </template>
              <div v-else class="fm-empty">选择一个实例</div>
            </div>
          </div>
        </div>

        <!-- 终端标签页 -->
        <div
          v-for="tab in terminalTabs"
          v-show="tab.id === activeId"
          :key="tab.id"
          class="terminal-wrapper"
        >
          <TerminalTab :ref="(el) => setTabRef(tab.id, el)" :tab-id="tab.id" :is-active="tab.id === activeId" :init-commands="tab.initCommands || []" :instance-id="tab.instanceId ?? null" />
        </div>
      </div>

      <!-- 新建/编辑实例对话框 -->
      <div v-if="showNewDialog" class="dialog-overlay" @click.self="closeNewDialog">
        <div class="dialog">
          <div class="dialog-title">{{ isEditing ? '编辑实例' : '新建实例' }}</div>
          <div class="dialog-body">
            <!-- 实例名称 -->
            <label class="field">
              <span class="field-label">实例名称</span>
              <input
                v-model="newData.name"
                type="text"
                class="input"
                :class="{ invalid: errors.name }"
                placeholder="什么名字比较好呢？"
              />
              <span v-if="errors.name" class="field-error">请填写这个。</span>
            </label>

            <!-- 实例UUID -->
            <label class="field">
              <span class="field-label">实例UUID</span>
              <input
                :value="newData.uuid"
                type="text"
                class="input mono"
                readonly
              />
            </label>

            <!-- 实例图标 -->
            <label class="field">
              <span class="field-label">实例图标</span>
              <div class="icon-selector" @click="showIconPicker = !showIconPicker">
                <img
                  class="icon-preview"
                  :src="'/assets/instances/' + newData.icon"
                  :alt="newData.icon"
                />
                <span class="icon-name">{{ newData.icon }}</span>
              </div>
              <div v-if="showIconPicker" class="icon-grid">
                <div
                  v-for="icon in AVAILABLE_ICONS"
                  :key="icon"
                  class="icon-option"
                  :class="{ selected: icon === newData.icon }"
                  @click="selectIcon(icon)"
                >
                  <img :src="'/assets/instances/' + icon" :alt="icon" />
                </div>
              </div>
            </label>

            <!-- 实例启动命令 -->
            <label class="field">
              <span class="field-label">
                实例启动命令
                <span v-if="isEditing && editingId !== null && runningStates[editingId]" class="field-hint">（停止实例后方可修改）</span>
              </span>
              <input
                v-model="newData.command"
                type="text"
                class="input mono"
                :class="{ invalid: errors.command }"
                :disabled="isEditingLocked"
                placeholder="java -jar xxx.jar"
              />
              <span v-if="errors.command" class="field-error">请填写这个。</span>
            </label>

            <!-- 实例文件夹 -->
            <label class="field">
              <span class="field-label">
                实例文件夹
                <span v-if="isEditingLocked" class="field-hint">（停止实例后方可修改）</span>
              </span>
              <input
                v-model="newData.folder"
                type="text"
                class="input mono"
                :class="{ invalid: errors.folder }"
                :disabled="isEditingLocked"
                placeholder="path/to/your/folder"
              />
              <span v-if="errors.folder" class="field-error">请填写这个。</span>
            </label>

            <!-- 实例停止方法 -->
            <label class="field">
              <span class="field-label">实例停止方法</span>
              <input
                v-model="newData.stopCommand"
                type="text"
                class="input mono"
                placeholder="^C"
              />
            </label>

            <!-- 自动启动 -->
            <label class="field field-row">
              <input type="checkbox" class="checkbox" v-model="newData.autoStart" />
              <span class="field-label">自动启动？</span>
            </label>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="closeNewDialog">取消</button>
            <button class="btn btn-primary" :disabled="saving" @click="createInstance">{{ saving ? '保存中…' : isEditing ? '保存' : '创建' }}</button>
          </div>
        </div>
      </div>

      <!-- 设置对话框 -->
      <div v-if="showSettings" class="dialog-overlay" @click.self="closeSettings">
        <div class="dialog">
          <div class="dialog-title">设置</div>
          <div class="dialog-body">
            <label class="field">
              <span class="field-label">默认Shell</span>
              <input
                v-model="settings.defaultShell"
                type="text"
                class="input mono"
                placeholder="/usr/bin/bash"
              />
            </label>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="closeSettings">取消</button>
            <button class="btn btn-primary" :disabled="savingSettings" @click="saveSettings">{{ savingSettings ? '保存中…' : '保存' }}</button>
          </div>
        </div>
      </div>

      <!-- 删除确认对话框 -->
      <div v-if="showDeleteConfirm" class="dialog-overlay" @click.self="cancelDelete">
        <div class="dialog dialog-sm">
          <div class="dialog-title">真的要删除该实例吗？</div>
          <div class="dialog-body">
            <p class="delete-warning">如果该实例处于运行状态，则会强制中止并删除该实例。删除实例后面板并不会清除其文件夹中的数据，如果需要删除，请手动操作。</p>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="cancelDelete">取消</button>
            <button class="btn btn-danger" @click="confirmDelete">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  `,
});

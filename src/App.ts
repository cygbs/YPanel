import { defineComponent, reactive, ref, computed } from 'vue';
import TerminalTab from './TerminalTab';

/** 带认证的 fetch */
function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('ypanel_token');
  const headers = { ...(options.headers || {}) } as Record<string, string>;
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, { ...options, headers });
}

const AUTH_TOKEN_KEY = 'ypanel_token';

interface TabData {
  id: number;
  title: string;
  type: 'home' | 'terminal';
  initCommands?: string[];
  instanceId?: number | null;
  nodeId?: number | null;
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
  // Math.random 模拟 UUID v4，各浏览器/HTTP 都兼容
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

let nextTabId = 1;

interface NewInstanceData {
  name: string;
  uuid: string;
  icon: string;
  command: string;
  folder: string;
  stopCommand: string;
  autoStart?: boolean;
}

export default defineComponent({
  components: { TerminalTab },
  setup() {
    // ── 认证状态 ──
    const authState = ref<'loading' | 'login' | 'change-password' | 'authenticated'>('loading');
    const loginPassword = ref('');
    const loginError = ref('');
    const changeNewPassword = ref('');
    const changeConfirmPassword = ref('');
    const changeError = ref('');
    const changingPassword = ref(false);

    async function checkAuth(): Promise<void> {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) { authState.value = 'login'; return; }
      try {
        const res = await fetch('/api/auth/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (data.valid) {
          if (data.defaultPassword) {
            authState.value = 'change-password';
          } else {
            authState.value = 'authenticated';
          }
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          authState.value = 'login';
        }
      } catch {
        authState.value = 'login';
      }
    }

    async function doLogin(): Promise<void> {
      loginError.value = '';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: loginPassword.value }),
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
          if (data.defaultPassword) {
            authState.value = 'change-password';
          } else {
            authState.value = 'authenticated';
          }
        } else {
          loginError.value = data.error || '登录失败';
        }
      } catch { loginError.value = '网络错误'; }
    }

    async function doChangePassword(): Promise<void> {
      changeError.value = '';
      if (changeNewPassword.value !== changeConfirmPassword.value) {
        changeError.value = '两次输入的密码不一致';
        return;
      }
      if (!changeNewPassword.value) {
        changeError.value = '密码不能为空';
        return;
      }
      changingPassword.value = true;
      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') },
          body: JSON.stringify({ newPassword: changeNewPassword.value }),
        });
        const data = await res.json();
        if (res.ok) {
          authState.value = 'authenticated';
        } else {
          changeError.value = data.error || '修改失败';
        }
      } catch { changeError.value = '网络错误'; }
      finally { changingPassword.value = false; }
    }

    // 启动时检查认证
    checkAuth();

    // ── 标签页 ──
    const tabs = reactive<TabData[]>([
      { id: 0, title: '主页', type: 'home' },
    ]);
    const activeId = ref(0);
    const tabRefs = ref<Record<number, any>>({});
    const terminalTabs = computed(() => tabs.filter((t) => t.type === 'terminal'));

    function setTabRef(tabId: number, el: any) {
      if (el) tabRefs.value[tabId] = el;
    }

    function addTerminalTab(title?: string, initCommands?: string[], instanceId?: number, nodeId?: number): void {
      // 不带参数 → 在节点上创建普通 Shell 终端
      if (instanceId === undefined && nodeId === undefined) {
        if (activeNodeId.value !== null) {
          nodeId = activeNodeId.value;
          // instanceId 留 undefined，对应节点的普通 Shell
        } else {
          // 不在任何节点中，无法创建终端
          return;
        }
      }
      const id = nextTabId++;
      // 显式保留 undefined 给 instanceId，组件会据此构建不带 instanceId 的 WS URL
      tabs.push({
        id, title: title || `终端 ${id}`,
        type: 'terminal', initCommands,
        instanceId: instanceId, nodeId: nodeId ?? null,
      });
      activeId.value = id;
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

    // ── 节点管理 ──
    const nodes = ref<any[]>([]);
    const pendingTokens = ref<any[]>([]);
    const activeNodeId = ref<number | null>(null);
    const activeNode = computed(() => nodes.value.find(n => n.id === activeNodeId.value) ?? null);
    const showNodeDialog = ref(false);
    const newNodeName = ref('');
    const generatingNode = ref(false);
    const generatedToken = ref('');
    const generatedNodeName = ref('');
    const showGeneratedToken = ref(false);
    const nodeError = ref('');

    /** API 前缀：当在节点中时指向代理路径 */
    function apiPrefix(): string {
      const nid = activeNodeId.value;
      return nid !== null ? `/api/node/${nid}` : '';
    }

    /** 加载节点列表 */
    async function loadNodes(): Promise<void> {
      try {
        const res = await apiFetch('/api/nodes');
        if (res.ok) {
          const data = await res.json();
          nodes.value = data.nodes || [];
          pendingTokens.value = data.pendingTokens || [];
          // 如果当前激活的节点离线了，清空选择
          if (activeNodeId.value !== null && !nodes.value.find(n => n.id === activeNodeId.value)) {
            activeNodeId.value = null;
          }
        }
      } catch { /* ignore */ }
    }

    /** 选中的节点（在节点列表中高亮） */
    const selectedNodeId = ref<number | null>(null);
    const selectedNodeForMenu = computed(() =>
      nodes.value.find(n => n.id === selectedNodeId.value) ?? null
    );
    function selectNode(id: number | null): void {
      selectedNodeId.value = id;
    }

    /** 打开节点列表对话框 */
    function openNodeDialog(): void {
      showNodeDialog.value = true;
      newNodeName.value = '';
      generatedToken.value = '';
      generatedNodeName.value = '';
      showGeneratedToken.value = false;
      nodeError.value = '';
      loadNodes();
    }

    function closeNodeDialog(): void {
      showNodeDialog.value = false;
    }

    /** 生成新节点 Token */
    async function generateNodeToken(): Promise<void> {
      generatingNode.value = true;
      nodeError.value = '';
      try {
        const res = await apiFetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newNodeName.value || undefined }),
        });
        if (res.ok) {
          const data = await res.json();
          generatedToken.value = data.token;
          generatedNodeName.value = data.nodeName;
          showGeneratedToken.value = true;
          newNodeName.value = '';
          await loadNodes();
        } else {
          nodeError.value = '生成 Token 失败';
        }
      } catch (e) {
        nodeError.value = '网络错误';
      } finally {
        generatingNode.value = false;
      }
    }

    /** 删除节点 */
    async function deleteNode(id: number): Promise<void> {
      if (!confirm('确定删除此节点？')) return;
      try {
        await apiFetch(`/api/nodes/${id}`, { method: 'DELETE' });
        if (activeNodeId.value === id) {
          activeNodeId.value = null;
        }
        await loadNodes();
      } catch { /* ignore */ }
    }

    /** 取消 pending token */
    async function cancelPendingToken(token: string): Promise<void> {
      try {
        await apiFetch(`/api/nodes/pending/${token}`, { method: 'DELETE' });
        await loadNodes();
      } catch { /* ignore */ }
    }

    /** 切换到节点 */
    function switchToNode(id: number): void {
      activeNodeId.value = id;
      showNodeDialog.value = false;
      // 重新加载实例列表
      loadInstances();
    }

    /** 返回节点列表 */
    function leaveNode(): void {
      activeNodeId.value = null;
      instances.value = [];
      selectedId.value = null;
      selectNode(null);
    }

    // ── 编辑节点 ──
    const showEditNodeDialog = ref(false);
    const editNodeData = reactive({ name: '', icon: 'gear.svg' });
    const savingNode = ref(false);

    function openEditNode(): void {
      const n = selectedNodeForMenu.value;
      if (!n) return;
      editNodeData.name = n.name;
      editNodeData.icon = n.icon || 'gear.svg';
      showIconPicker.value = false;
      showEditNodeDialog.value = true;
    }

    function closeEditNode(): void {
      showEditNodeDialog.value = false;
      showIconPicker.value = false;
    }

    async function saveEditNode(): Promise<void> {
      const n = selectedNodeForMenu.value;
      if (!n) return;
      savingNode.value = true;
      try {
        const res = await apiFetch(`/api/nodes/${n.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editNodeData.name || n.name,
            icon: editNodeData.icon,
          }),
        });
        if (res.ok) {
          await loadNodes();
          closeEditNode();
        }
      } catch { /* ignore */ }
      finally { savingNode.value = false; }
    }

    // ── 实例管理 ──
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
      Object.assign(newData, { autoStart: false });
    }

    function openNewInstance(): void {
      if (activeNodeId.value === null) return;
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
      try {
        const res = await apiFetch(apiPrefix() + '/instances/' + inst.id + '/status');
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

    function selectInstance(id: number | null): void {
      selectedId.value = id;
    }

    /** 加载实例列表（通过 hub 代理） */
    async function loadInstances(): Promise<void> {
      const prefix = apiPrefix();
      if (!prefix) return;
      try {
        const res = await apiFetch(prefix + '/instances');
        if (res.ok) {
          const data = await res.json();
          instances.value = data.instances || [];
          for (const inst of data.instances || []) {
            if (!(inst.id in runningStates)) {
              runningStates[inst.id] = false;
            }
          }
        }
      } catch { /* ignore */ }
    }

    /** 轮询实例状态 */
    async function pollStatus(): Promise<void> {
      const prefix = apiPrefix();
      if (!prefix) return;
      for (const inst of instances.value) {
        try {
          const res = await apiFetch(prefix + '/instances/' + inst.id + '/status');
          if (res.ok) {
            const data = await res.json();
            if (data.running) {
              if (runningStates[inst.id] === 'stopping') {
                // 保持红色
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
      if (!inst || activeNodeId.value === null) return;
      const prefix = apiPrefix();
      try {
        const res = await apiFetch(prefix + '/instances/' + inst.id + '/start', { method: 'POST' });
        if (!res.ok) {
          console.error('start failed:', res.status, await res.text());
          return;
        }
        const data = await res.json();
        if (data.status === 'started' || data.status === 'already_running') {
          runningStates[inst.id] = 'running';
          openTerminalForInstance(inst);
        }
      } catch (e) {
        console.error('start error:', e);
      }
    }

    function openTerminalForInstance(inst: any): void {
      if (activeNodeId.value === null) return;
      const existing = tabs.find(t =>
        t.type === 'terminal' && t.instanceId === inst.id && t.nodeId === activeNodeId.value
      );
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const id = nextTabId++;
      tabs.push({
        id,
        title: `${inst.name} #${inst.id}`,
        type: 'terminal',
        initCommands: [],
        instanceId: inst.id,
        nodeId: activeNodeId.value,
      });
      activeId.value = id;
    }

    function openTerminal(): void {
      const inst = selectedInstance.value;
      if (!inst) return;
      openTerminalForInstance(inst);
    }

    async function stopInstance(): Promise<void> {
      const inst = selectedInstance.value;
      if (!inst || activeNodeId.value === null) return;
      const prefix = apiPrefix();
      runningStates[inst.id] = 'stopping';
      await apiFetch(prefix + '/instances/' + inst.id + '/stop', { method: 'POST' });
      setTimeout(() => pollStatus(), 3000);
    }

    function validate(): boolean {
      Object.keys(errors).forEach((k) => delete errors[k]);
      let valid = true;
      if (!newData.name.trim()) { errors.name = true; valid = false; }
      if (!newData.command.trim()) { errors.command = true; valid = false; }
      if (!newData.folder.trim()) { errors.folder = true; valid = false; }
      return valid;
    }

    async function createInstance(): Promise<void> {
      if (!validate()) return;
      if (isEditingLocked.value) {
        const orig = selectedInstance.value;
        if (orig) { newData.command = orig.command; newData.folder = orig.folder; }
      }
      saving.value = true;
      const prefix = apiPrefix();
      try {
        if (isEditing.value && editingId.value !== null) {
          // 编辑
          const res = await apiFetch(prefix + '/instances/' + editingId.value, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newData.name, icon: newData.icon,
              command: newData.command, folder: newData.folder,
              stopCommand: newData.stopCommand, autoStart: newData.autoStart,
            }),
          });
          if (res.ok) {
            const updated = await res.json();
            const idx = instances.value.findIndex((i) => i.id === editingId.value);
            if (idx !== -1) instances.value[idx] = updated;
            closeNewDialog();
          }
        } else {
          // 新建
          const res = await apiFetch(prefix + '/instances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newData.name, uuid: newData.uuid,
              icon: newData.icon, command: newData.command,
              folder: newData.folder, stopCommand: newData.stopCommand,
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

    // ── 设置 ──
    async function openSettings(): Promise<void> {
      showSettings.value = true;
      const prefix = apiPrefix();
      if (!prefix) { showSettings.value = false; return; }
      try {
        const res = await apiFetch(prefix + '/settings');
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
      const prefix = apiPrefix();
      try {
        await apiFetch(prefix + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultShell: settings.defaultShell }),
        });
        showSettings.value = false;
      } catch { /* ignore */ }
      finally { savingSettings.value = false; }
    }

    // ── 删除 ──
    function openDeleteConfirm(): void {
      showDeleteConfirm.value = true;
    }

    function cancelDelete(): void {
      showDeleteConfirm.value = false;
    }

    async function confirmDelete(): Promise<void> {
      const id = selectedId.value;
      if (id === null || activeNodeId.value === null) return;
      const prefix = apiPrefix();
      try {
        const res = await apiFetch(prefix + '/instances/' + id, { method: 'DELETE' });
        if (res.ok) {
          instances.value = instances.value.filter((i) => i.id !== id);
          selectedId.value = null;
          showDeleteConfirm.value = false;
        }
      } catch (e) {
        console.error('Failed to delete instance', e);
      }
    }

    // ── 初始化 ──
    loadNodes();
    const nodesTimer = setInterval(() => loadNodes(), 5000);
    const statusTimer = setInterval(() => pollStatus(), 10000);

    // 在模板中暴露 location.host（Vue 模板不自动暴露全局 location）
    const locationHost = window.location.host;

    return {
      // 认证
      authState, loginUsername, loginPassword, loginError,
      changeNewPassword, changeConfirmPassword, changeError,
      changingPassword, doLogin, doChangePassword,
      // 标签页
      tabs, activeId, terminalTabs,
      addTerminalTab, closeTab, switchTab, setTabRef,
      // 节点管理
      nodes, pendingTokens, activeNodeId, activeNode,
      showNodeDialog, newNodeName, generatingNode,
      generatedToken, generatedNodeName, showGeneratedToken, locationHost,
      nodeError,
      selectedNodeId, selectedNodeForMenu, selectNode,
      openNodeDialog, closeNodeDialog, generateNodeToken,
      showEditNodeDialog, editNodeData, savingNode,
      openEditNode, closeEditNode, saveEditNode,
      deleteNode, cancelPendingToken,
      switchToNode, leaveNode,
      // 实例管理
      instances, selectedInstance, selectedId, selectInstance,
      runningStates, showNewDialog, isEditing, isEditingLocked,
      showIconPicker, showSettings, savingSettings, saving,
      settings, errors, showDeleteConfirm, newData,
      openNewInstance, closeNewDialog, selectIcon,
      createInstance, startInstance, stopInstance,
      openTerminal, openEditInstance,
      openSettings, closeSettings, saveSettings,
      openDeleteConfirm, confirmDelete, cancelDelete,
      AVAILABLE_ICONS,
    };
  },
  template: `
    <!-- ===== 加载中 ===== -->
    <div v-if="authState === 'loading'" class="auth-screen">
      <div class="auth-box">
        <div class="auth-loading">正在加载…</div>
      </div>
    </div>

    <!-- ===== 登录页 ===== -->
    <div v-else-if="authState === 'login'" class="auth-screen">
      <div class="auth-box">
        <div class="auth-title">YPanel</div>
        <div class="auth-subtitle">请登录</div>
        <div class="auth-field">
          <input v-model="loginPassword" type="password" class="input" placeholder="密码" @keyup.enter="doLogin" />
        </div>
        <div v-if="loginError" class="auth-error">{{ loginError }}</div>
        <button class="btn btn-primary auth-btn" @click="doLogin">登录</button>
      </div>
    </div>

    <!-- ===== 修改默认密码 ===== -->
    <div v-else-if="authState === 'change-password'" class="auth-screen">
      <div class="auth-box">
        <div class="auth-title">YPanel</div>
        <div class="auth-subtitle">请修改默认密码</div>
        <div class="auth-field">
          <input v-model="changeNewPassword" type="password" class="input" placeholder="新密码" @keyup.enter="doChangePassword" />
        </div>
        <div class="auth-field">
          <input v-model="changeConfirmPassword" type="password" class="input" placeholder="重复新密码" @keyup.enter="doChangePassword" />
        </div>
        <div v-if="changeError" class="auth-error">{{ changeError }}</div>
        <button class="btn btn-primary auth-btn" :disabled="changingPassword" @click="doChangePassword">
          {{ changingPassword ? '保存中…' : '保存' }}
        </button>
      </div>
    </div>

    <!-- ===== 主界面 ===== -->
    <div v-else class="app-layout">
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
          <!-- 快捷操作栏 -->
          <div class="quick-actions">
            <template v-if="activeNodeId !== null">
              <button @click="openNewInstance">新建实例</button>
              <button>打开文件夹…</button>
              <button @click="openSettings">设置</button>
              <button @click="leaveNode" class="qa-back">返回节点列表</button>
            </template>
            <template v-else>
              <button @click="openNodeDialog">新增节点…</button>
            </template>
            <button>帮助</button>
          </div>

          <!-- 主体区域 -->
          <div class="home-body">
            <!-- 节点列表模式 -->
            <template v-if="activeNodeId === null">
              <div class="instance-list">
                <div
                  v-for="node in nodes"
                  :key="node.id"
                  class="instance-card"
                  :class="{ selected: node.id === selectedNodeId }"
                  @click="selectNode(node.id)"
                >
                  <div class="inst-icon-wrap">
                    <img class="inst-icon" :src="'/assets/instances/' + (node.icon || 'gear.svg')" :alt="node.name" />
                    <span class="status-dot" :class="node.connected ? 'running' : 'offline'"></span>
                  </div>
                  <span class="inst-name">{{ node.name }}</span>
                </div>
                <div v-if="nodes.length === 0" class="no-instances-hint">
                  暂无节点，点击「新增节点…」创建
                </div>
              </div>
              <div class="function-menu">
                <template v-if="selectedNodeForMenu">
                  <div class="fm-icon" @click="selectNode(null)">
                    <img :src="'/assets/instances/' + (selectedNodeForMenu.icon || 'gear.svg')" />
                  </div>
                  <div class="fm-name">{{ selectedNodeForMenu.name }}</div>
                  <div class="fm-actions">
                    <button class="fm-btn" :disabled="!selectedNodeForMenu.connected"
                      @click="switchToNode(selectedNodeForMenu.id)">切换</button>
                    <button class="fm-btn"
                      @click="openEditNode">编辑</button>
                    <button class="fm-btn fm-btn-danger"
                      @click="deleteNode(selectedNodeForMenu.id)">删除</button>
                  </div>
                </template>
                <div v-else class="fm-empty">选择一个节点</div>
              </div>
            </template>

            <!-- 实例模式 -->
            <template v-else>
              <div class="instance-list">
                <div
                  v-for="inst in instances"
                  :key="inst.id"
                  class="instance-card"
                  :class="{ selected: inst.id === selectedInstance?.id }"
                  @click="selectInstance(inst.id)"
                >
                  <div class="inst-icon-wrap">
                    <img class="inst-icon" :src="'/assets/instances/' + (inst.icon || 'grass.svg')" :alt="inst.name" />
                    <span v-if="runningStates[inst.id]" class="status-dot" :class="runningStates[inst.id]"></span>
                  </div>
                  <span class="inst-name">{{ inst.name }} #{{ inst.id }}</span>
                </div>
                <div v-if="instances.length === 0" class="no-instances-hint">
                  该节点暂无实例，点击「新建实例」添加
                </div>
              </div>
              <div class="function-menu">
                <template v-if="selectedInstance">
                  <div class="fm-icon" @click="selectInstance(null)">
                    <img :src="'/assets/instances/' + (selectedInstance.icon || 'grass.svg')" :alt="selectedInstance.name" />
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
            </template>
          </div>
        </div>

        <!-- 终端标签页 -->
        <div
          v-for="tab in terminalTabs"
          v-show="tab.id === activeId"
          :key="tab.id"
          class="terminal-wrapper"
        >
          <TerminalTab
            :ref="(el) => setTabRef(tab.id, el)"
            :tab-id="tab.id"
            :is-active="tab.id === activeId"
            :init-commands="tab.initCommands || []"
            :instance-id="tab.instanceId ?? null"
            :node-id="tab.nodeId ?? null"
          />
        </div>
      </div>

      <!-- ===== 新增节点对话框（生成 Token） ===== -->
      <div v-if="showNodeDialog" class="dialog-overlay" @click.self="closeNodeDialog">
        <div class="dialog">
          <div class="dialog-title">新增节点</div>
          <div class="dialog-body">
            <div class="node-gen-section">
              <div class="node-gen-row">
                <input
                  v-model="newNodeName"
                  type="text"
                  class="input"
                  placeholder="节点名称（可选）"
                />
                <button class="btn btn-primary" :disabled="generatingNode" @click="generateNodeToken">
                  {{ generatingNode ? '生成中…' : '生成 Token' }}
                </button>
              </div>
              <div v-if="nodeError" class="field-error">{{ nodeError }}</div>
              <div v-if="showGeneratedToken" class="node-token-box">
                <div class="node-token-label">在目标机器上运行以下命令：</div>
                <div class="node-token-cmd">
                  node index.js -s ws://{{ locationHost }}/link -t {{ generatedToken }} -p 6701
                </div>
                <div class="node-token-note">节点名称：{{ generatedNodeName }}</div>
                <div class="node-token-note">节点会保存到数据中，等待连接中…</div>
              </div>
            </div>
            <!-- 待处理的 Token -->
            <div v-if="pendingTokens.length > 0" class="node-list-title">等待连接的 Token</div>
            <div v-for="pt in pendingTokens" :key="pt.token" class="node-item pending">
              <div class="node-info">
                <div class="node-status-dot pending-dot"></div>
                <div class="node-details">
                  <span class="node-name">{{ pt.name }}</span>
                  <span class="node-seen">等待连接…</span>
                </div>
              </div>
              <div class="node-actions">
                <button class="btn btn-danger btn-sm" @click="cancelPendingToken(pt.token)">取消</button>
              </div>
            </div>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="closeNodeDialog">关闭</button>
          </div>
        </div>
      </div>

      <!-- ===== 编辑节点对话框 ===== -->
      <div v-if="showEditNodeDialog" class="dialog-overlay" @click.self="closeEditNode">
        <div class="dialog">
          <div class="dialog-title">编辑节点</div>
          <div class="dialog-body">
            <label class="field">
              <span class="field-label">节点名称</span>
              <input
                v-model="editNodeData.name"
                type="text"
                class="input"
                placeholder="节点名称"
              />
            </label>
            <label class="field">
              <span class="field-label">节点图标</span>
              <div class="icon-selector" @click="showIconPicker = !showIconPicker">
                <img class="icon-preview" :src="'/assets/instances/' + editNodeData.icon" :alt="editNodeData.icon" />
                <span class="icon-name">{{ editNodeData.icon }}</span>
              </div>
              <div v-if="showIconPicker" class="icon-grid">
                <div
                  v-for="icon in AVAILABLE_ICONS"
                  :key="icon"
                  class="icon-option"
                  :class="{ selected: icon === editNodeData.icon }"
                  @click="editNodeData.icon = icon"
                >
                  <img :src="'/assets/instances/' + icon" :alt="icon" />
                </div>
              </div>
            </label>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="closeEditNode">取消</button>
            <button class="btn btn-primary" :disabled="savingNode" @click="saveEditNode">
              {{ savingNode ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ===== 新建/编辑实例对话框 ===== -->
      <div v-if="showNewDialog" class="dialog-overlay" @click.self="closeNewDialog">
        <div class="dialog">
          <div class="dialog-title">{{ isEditing ? '编辑实例' : '新建实例' }}</div>
          <div class="dialog-body">
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
            <label class="field">
              <span class="field-label">实例UUID</span>
              <input
                :value="newData.uuid"
                type="text"
                class="input mono"
                readonly
              />
            </label>
            <label class="field">
              <span class="field-label">实例图标</span>
              <div class="icon-selector" @click="showIconPicker = !showIconPicker">
                <img class="icon-preview" :src="'/assets/instances/' + newData.icon" :alt="newData.icon" />
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
            <label class="field">
              <span class="field-label">
                实例启动命令
                <span v-if="isEditingLocked" class="field-hint">（停止实例后方可修改）</span>
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
            <label class="field">
              <span class="field-label">实例停止方法</span>
              <input
                v-model="newData.stopCommand"
                type="text"
                class="input mono"
                placeholder="^C"
              />
            </label>
            <label class="field field-row">
              <input type="checkbox" class="checkbox" v-model="newData.autoStart" />
              <span class="field-label">自动启动？</span>
            </label>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="closeNewDialog">取消</button>
            <button class="btn btn-primary" :disabled="saving" @click="createInstance">
              {{ saving ? '保存中…' : isEditing ? '保存' : '创建' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ===== 设置对话框 ===== -->
      <div v-if="showSettings" class="dialog-overlay" @click.self="closeSettings">
        <div class="dialog">
          <div class="dialog-title">设置 — {{ activeNode?.name || '节点' }}</div>
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
            <button class="btn btn-primary" :disabled="savingSettings" @click="saveSettings">
              {{ savingSettings ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ===== 删除确认对话框 ===== -->
      <div v-if="showDeleteConfirm" class="dialog-overlay" @click.self="cancelDelete">
        <div class="dialog dialog-sm">
          <div class="dialog-title">真的要删除该实例吗？</div>
          <div class="dialog-body">
            <p class="delete-warning">
              如果该实例处于运行状态，则会强制中止并删除该实例。
              删除实例后面板并不会清除其文件夹中的数据，如果需要删除，请手动操作。
            </p>
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

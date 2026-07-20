<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <!-- ===== 认证界面 ===== -->
  <AuthScreen v-if="authState !== 'authenticated'" />

  <!-- ===== 主界面 ===== -->
  <div v-else class="app-layout">
    <!-- 标签栏 -->
    <div v-show="activeNodeId !== null" class="tab-bar">
      <div class="tabs-scroll">
        <div v-for="tab in tabs" :key="tab.id" class="tab"
          :class="{ active: tab.id === activeId }"
          @click="switchTab(tab.id)" @mousedown.middle="closeTab(tab.id)">
          <span class="tab-label">{{ tab.title }}</span>
          <span v-if="tab.type !== 'home'" class="tab-close"
            @click.stop="closeTab(tab.id)" :title="$t('tab.close')">&times;</span>
        </div>
      </div>
      <div class="tab-add" @click="addTerminalTab()" :title="$t('tab.new')">+</div>
    </div>

    <!-- 内容区 -->
    <div class="content-area">
      <HomeContent />
      <div v-for="tab in terminalTabs" v-show="tab.id === activeId"
        :key="tab.id" class="terminal-wrapper">
        <TerminalTab :ref="(el: any) => setTabRef(tab.id, el)"
          :tab-id="tab.id" :is-active="tab.id === activeId"
          :init-commands="tab.initCommands || []"
          :instance-id="tab.instanceId ?? null" :node-id="tab.nodeId ?? null" />
      </div>
      <div v-for="tab in fileManagerTabs" v-show="tab.id === activeId"
        :key="tab.id" class="terminal-wrapper">
        <FileManagerTab :tab-id="tab.id" :is-active="tab.id === activeId"
          :node-id="tab.nodeId ?? null" :init-path="tab.initPath || ''" />
      </div>
    </div>

    <!-- 对话框 -->
    <NodeDialogs />
    <InstanceDialogs />
    <UploadDialog />
    <HubSettingsDialog />
    <LangDialog />
    <ToastContainer />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, computed, watch, defineAsyncComponent, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import AuthScreen from './AuthScreen.vue';
import HomeContent from './HomeContent.vue';
import NodeDialogs from './NodeDialogs.vue';
import InstanceDialogs from './InstanceDialogs.vue';
import UploadDialog from './UploadDialog.vue';
import HubSettingsDialog from './HubSettingsDialog.vue';
import LangDialog from './LangDialog.vue';
import ToastContainer from './ToastContainer.vue';

const TerminalTab = defineAsyncComponent(() => import('./TerminalTab.vue'));
const FileManagerTab = defineAsyncComponent(() => import('./FileManagerTab.vue'));

// ── CSRF Token ──
let _csrfToken: string | null = null;

function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = { ...(options.headers || {}) } as Record<string, string>;
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method) && _csrfToken) {
    headers['X-CSRF-Token'] = _csrfToken;
  }
  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}

interface TabData {
  id: number; title: string; type: 'home' | 'terminal' | 'filemanager';
  initCommands?: string[]; instanceId?: number | null; nodeId?: number | null;
  initPath?: string;
}

const AVAILABLE_ICONS = [
  'bee.svg','brick.svg','chicken.svg','creeper.svg','diamond.svg','dirt.svg',
  'enderman.svg','enderpearl.svg','fabricmc.svg','flame.svg','fox.svg',
  'ftb_logo.svg','gear.svg','gold.svg','grass.svg','herobrine.svg','iron.svg',
  'magitech.svg','meat.svg','modrinth.svg','neoforged.svg','netherstar.svg',
  'planks.svg','prismlauncher.svg','quiltmc.svg','skeleton.svg',
  'squarecreeper.svg','steve.svg','stone.svg','tnt.svg',
];

function generateUUID(): string {
  try { return crypto.randomUUID(); } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

interface NewInstanceData {
  name: string; uuid: string; icon: string;
  command: string; folder: string; stopCommand: string; autoStart?: boolean;
}

let nextTabId = 1;

export default defineComponent({
  components: { AuthScreen, HomeContent, NodeDialogs, InstanceDialogs, UploadDialog, HubSettingsDialog, LangDialog, ToastContainer, TerminalTab, FileManagerTab },
  setup() {
    const { t, locale } = useI18n();

    // ── 认证 ──
    const authState = ref<'loading' | 'login' | 'change-password' | 'authenticated'>('loading');
    const loginPassword = ref('');
    const loginError = ref('');
    const changeNewPassword = ref('');
    const changeConfirmPassword = ref('');
    const changeError = ref('');
    const changingPassword = ref(false);

    async function checkAuth(): Promise<void> {
      try {
        const res = await fetch('/api/auth/check', { method: 'POST', credentials: 'same-origin' });
        const data = await res.json();
        if (data.valid) {
          const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
          if (csrfRes.ok) { const csrfData = await csrfRes.json(); _csrfToken = csrfData.csrfToken; }
          authState.value = data.defaultPassword ? 'change-password' : 'authenticated';
          if (authState.value === 'authenticated') loadNodes();
        } else { authState.value = 'login'; }
      } catch { authState.value = 'login'; }
    }

    async function doLogin(): Promise<void> {
      loginError.value = '';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify({ password: loginPassword.value }),
        });
        const data = await res.json();
        if (res.ok) {
          _csrfToken = data.csrfToken;
          authState.value = data.defaultPassword ? 'change-password' : 'authenticated';
          if (authState.value === 'authenticated') await loadNodes();
        } else { loginError.value = data.error || t('login.failed'); }
      } catch { loginError.value = t('network_error'); }
    }

    async function doChangePassword(): Promise<void> {
      changeError.value = '';
      if (changeNewPassword.value !== changeConfirmPassword.value) { changeError.value = t('change_password.mismatch'); return; }
      if (!changeNewPassword.value) { changeError.value = t('change_password.empty'); return; }
      changingPassword.value = true;
      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ oldPassword: loginPassword.value, newPassword: changeNewPassword.value }),
        });
        const data = await res.json();
        if (res.ok) { authState.value = 'authenticated'; await loadNodes(); }
        else { changeError.value = data.error || t('change_password.failed'); }
      } catch { changeError.value = t('network_error'); }
      finally { changingPassword.value = false; }
    }

    async function doLogout(): Promise<void> {
      disconnectEvents();
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* */ }
      _csrfToken = null;
      authState.value = 'login'; loginPassword.value = ''; loginError.value = '';
      leaveNode(); tabs.splice(1); activeId.value = 0;
    }

    // ── 标签页 ──
    const tabs = reactive<TabData[]>([{ id: 0, title: t('tab.home'), type: 'home' }]);
    const activeId = ref(0);
    const tabRefs = ref<Record<number, any>>({});
    const terminalTabs = computed(() => tabs.filter(t => t.type === 'terminal'));
    const fileManagerTabs = computed(() => tabs.filter(t => t.type === 'filemanager'));

    function setTabRef(tabId: number, el: any) { if (el) tabRefs.value[tabId] = el; }
    function addTerminalTab(title?: string, initCommands?: string[], instanceId?: number, nodeId?: number): void {
      if (instanceId === undefined && nodeId === undefined) {
        if (activeNodeId.value !== null) nodeId = activeNodeId.value;
        else return;
      }
      const id = nextTabId++;
      tabs.push({ id, title: title || t('tab.terminal', { id }), type: 'terminal', initCommands, instanceId, nodeId: nodeId ?? null });
      activeId.value = id;
    }
    function closeTab(id: number): void {
      if (id === 0) return; const idx = tabs.findIndex(t => t.id === id);
      if (idx === -1) return; tabs.splice(idx, 1);
      if (activeId.value === id) activeId.value = tabs[Math.min(idx, tabs.length - 1)].id;
    }
    function switchTab(id: number): void { activeId.value = id; }

    function openFileManager(initPath?: string): void {
      if (activeNodeId.value === null) return;
      const existing = tabs.find(t => t.type === 'filemanager' && t.nodeId === activeNodeId.value);
      if (existing) { switchTab(existing.id); return; }
      const id = nextTabId++;
      const title = initPath ? initPath.replace(/^.*[\\/]/, '') || initPath : t('tab.filemanager');
      tabs.push({ id, title, type: 'filemanager', nodeId: activeNodeId.value, initPath });
      activeId.value = id;
    }

    // ── 节点 ──
    const nodes = ref<any[]>([]);
    const activeNodeId = ref<number | null>(null);
    const activeNode = computed(() => nodes.value.find(n => n.id === activeNodeId.value) ?? null);
    const selectedNodeId = ref<number | null>(null);
    const selectedNodeForMenu = computed(() => nodes.value.find(n => n.id === selectedNodeId.value) ?? null);
    const showNodeDialog = ref(false);
    const newNodeName = ref('');
    const generatingNode = ref(false);
    const generatedToken = ref('');
    const generatedNodeName = ref('');
    const showGeneratedToken = ref(false);
    const nodeError = ref('');
    const showEditNodeDialog = ref(false);
    const editNodeData = reactive({ name: '', icon: 'gear.svg' });
    const savingNode = ref(false);
    const showNodeDeleteConfirm = ref(false);
    const pendingDeleteNodeId = ref<number | null>(null);

    function apiPrefix() { return activeNodeId.value !== null ? `/api/node/${activeNodeId.value}` : ''; }
    function selectNode(id: number | null) { selectedNodeId.value = id; }

    async function loadNodes(): Promise<void> {
      try {
        const res = await apiFetch('/api/nodes');
        if (res.ok) {
          const data = await res.json();
          nodes.value = data.nodes || [];
          if (activeNodeId.value !== null && !nodes.value.find(n => n.id === activeNodeId.value)) activeNodeId.value = null;
        }
      } catch { /* */ }
    }

    function openNodeDialog(): void {
      showNodeDialog.value = true; newNodeName.value = '';
      generatedToken.value = ''; generatedNodeName.value = '';
      showGeneratedToken.value = false; nodeError.value = '';
      loadNodes();
    }
    function closeNodeDialog() { showNodeDialog.value = false; }
    let pendingNodeConnCount = 0;

    async function generateNodeToken(): Promise<void> {
      generatingNode.value = true; nodeError.value = '';
      try {
        const res = await apiFetch('/api/nodes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newNodeName.value || undefined }),
        });
        if (res.ok) {
          const data = await res.json();
          generatedToken.value = data.token; generatedNodeName.value = data.nodeName;
          pendingNodeConnCount = nodes.value.filter((n: any) => n.connected).length;
          showGeneratedToken.value = true; newNodeName.value = '';
          await loadNodes();
        } else { nodeError.value = t('add_node.failed'); }
      } catch { nodeError.value = t('network_error'); }
      finally { generatingNode.value = false; closeNodeDialog(); }
    }

    function copyToken(): void {
      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const cmd = `node index.js -s ${wsProto}//${window.location.host}/link -t ${generatedToken.value}`;
      function fallbackCopy(text: string): void {
        const ta = document.createElement('textarea'); ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showNotification(t('notification.copy_success'), 'success'); showGeneratedToken.value = false; }
        catch { /* */ } document.body.removeChild(ta);
      }
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(cmd).then(
          () => { showNotification(t('notification.copy_success'), 'success'); showGeneratedToken.value = false; },
          () => fallbackCopy(cmd));
      } else { fallbackCopy(cmd); }
    }

    function openEditNode(): void {
      const n = selectedNodeForMenu.value; if (!n) return;
      editNodeData.name = n.name; editNodeData.icon = n.icon || 'gear.svg';
      showEditNodeDialog.value = true;
    }
    function closeEditNode() { showEditNodeDialog.value = false; }

    async function saveEditNode(): Promise<void> {
      const n = selectedNodeForMenu.value; if (!n) return;
      savingNode.value = true;
      try {
        const res = await apiFetch(`/api/nodes/${n.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editNodeData.name || n.name, icon: editNodeData.icon }),
        });
        if (res.ok) { await loadNodes(); closeEditNode(); }
      } catch { /* */ } finally { savingNode.value = false; }
    }

    function openNodeDelete(id: number) { pendingDeleteNodeId.value = id; showNodeDeleteConfirm.value = true; }
    function cancelNodeDelete() { showNodeDeleteConfirm.value = false; pendingDeleteNodeId.value = null; }
    async function confirmNodeDelete(): Promise<void> {
      const id = pendingDeleteNodeId.value; if (id === null) return;
      showNodeDeleteConfirm.value = false; pendingDeleteNodeId.value = null;
      try {
        await apiFetch(`/api/nodes/${id}`, { method: 'DELETE' });
        if (activeNodeId.value === id) activeNodeId.value = null;
        await loadNodes();
      } catch { /* */ }
    }

    async function switchToNode(id: number): Promise<void> {
      activeNodeId.value = id; showNodeDialog.value = false;
      await loadInstances();
      pollStatus();
    }

    function leaveNode(): void {
      activeNodeId.value = null; instances.value = [];
      selectedId.value = null; selectNode(null);
    }

    function dblclickNode(node: any) {
      if (node.connected) switchToNode(node.id);
      else showNotification(t('notification.node_offline'), 'error');
    }
    function clickSwitchNode(node: any) { dblclickNode(node); }

    // ── 实例 ──
    const instances = ref<any[]>([]);
    const selectedId = ref<number | null>(null);
    const selectedInstance = computed(() => instances.value.find(i => i.id === selectedId.value) ?? null);
    const runningStates = reactive<Record<number, 'running' | 'stopping' | false>>({});
    const stopRequested = reactive<Record<number, boolean>>({});
    const showNewDialog = ref(false);
    const isEditing = ref(false);
    const editingId = ref<number | null>(null);
    const isEditingLocked = computed(() => isEditing.value && editingId.value !== null && !!runningStates[editingId.value]);
    const showSettings = ref(false);
    const savingSettings = ref(false);
    const settings = reactive({ defaultShell: '', textEditor: '' });
    const showDeleteConfirm = ref(false);
    const saving = ref(false);
    const errors = reactive<Record<string, boolean>>({});
    const newData = reactive<NewInstanceData>({
      name: '', uuid: generateUUID(), icon: 'grass.svg',
      command: '', folder: '', stopCommand: '^C',
    });

    function resetNewData() {
      newData.name = ''; newData.uuid = generateUUID(); newData.icon = 'grass.svg';
      newData.command = ''; newData.folder = ''; newData.stopCommand = '^C';
      Object.assign(newData, { autoStart: false });
    }

    function selectInstance(id: number | null) { selectedId.value = id; }

    async function loadInstances(): Promise<void> {
      const prefix = apiPrefix(); if (!prefix) return;
      try {
        const res = await apiFetch(prefix + '/instances');
        if (res.ok) {
          const data = await res.json();
          instances.value = data.instances || [];
          for (const inst of data.instances || []) {
            if (!(inst.id in runningStates)) runningStates[inst.id] = false;
          }
        }
      } catch (e) { console.warn('loadInstances failed:', e); }
    }

    async function pollStatus(): Promise<void> {
      const prefix = apiPrefix(); if (!prefix) return;
      for (const inst of instances.value) {
        try {
          const res = await apiFetch(prefix + '/instances/' + inst.id + '/status');
          if (res.ok) {
            const data = await res.json();
            if (data.running) { if (runningStates[inst.id] !== 'stopping') runningStates[inst.id] = 'running'; }
            else { runningStates[inst.id] = false; delete stopRequested[inst.id]; }
          }
        } catch (e) { console.warn(`pollStatus #${inst.id} failed:`, e); }
      }
    }

    function openNewInstance() { if (activeNodeId.value === null) return; isEditing.value = false; editingId.value = null; resetNewData(); showNewDialog.value = true; }

    async function openEditInstance(): Promise<void> {
      const inst = selectedInstance.value; if (!inst) return;
      isEditing.value = true; editingId.value = inst.id;
      newData.name = inst.name; newData.uuid = inst.uuid; newData.icon = inst.icon;
      newData.command = inst.command; newData.folder = inst.folder;
      newData.stopCommand = inst.stopCommand; newData.autoStart = !!inst.autoStart;
      showNewDialog.value = true;
      try {
        const res = await apiFetch(apiPrefix() + '/instances/' + inst.id + '/status');
        if (res.ok) { const data = await res.json(); runningStates[inst.id] = data.running ? 'running' : false; }
      } catch { /* */ }
    }

    function closeNewDialog() { showNewDialog.value = false; isEditing.value = false; editingId.value = null; }

    function validate(): boolean {
      Object.keys(errors).forEach(k => delete errors[k]);
      let valid = true;
      if (!newData.name.trim()) { errors.name = true; valid = false; }
      if (!newData.command.trim()) { errors.command = true; valid = false; }
      if (!newData.folder.trim()) { errors.folder = true; valid = false; }
      return valid;
    }

    async function createInstance(): Promise<void> {
      if (!validate()) return;
      if (isEditingLocked.value) { const orig = selectedInstance.value; if (orig) { newData.command = orig.command; newData.folder = orig.folder; } }
      saving.value = true; const prefix = apiPrefix();
      try {
        if (isEditing.value && editingId.value !== null) {
          const res = await apiFetch(prefix + '/instances/' + editingId.value, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newData.name, icon: newData.icon, command: newData.command, folder: newData.folder, stopCommand: newData.stopCommand, autoStart: newData.autoStart }),
          });
          if (res.ok) { const updated = await res.json(); const idx = instances.value.findIndex(i => i.id === editingId.value); if (idx !== -1) instances.value[idx] = updated; closeNewDialog(); }
        } else {
          const res = await apiFetch(prefix + '/instances', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newData.name, uuid: newData.uuid, icon: newData.icon, command: newData.command, folder: newData.folder, stopCommand: newData.stopCommand, autoStart: newData.autoStart }),
          });
          if (res.ok) { const created = await res.json(); instances.value.push(created); closeNewDialog(); }
        }
      } catch (e) { console.error('Failed to save instance', e); }
      finally { saving.value = false; }
    }

    async function startInstance(): Promise<void> {
      const inst = selectedInstance.value; if (!inst || activeNodeId.value === null) return;
      try {
        const res = await apiFetch(apiPrefix() + '/instances/' + inst.id + '/start', { method: 'POST' });
        if (!res.ok) { console.error('start failed:', res.status, await res.text()); return; }
        const data = await res.json();
        if (data.status === 'started' || data.status === 'already_running') runningStates[inst.id] = 'running';
      } catch (e) { console.error('start error:', e); }
    }

    function openTerminalForInstance(inst: any): void {
      if (activeNodeId.value === null) return;
      const existing = tabs.find(t => t.type === 'terminal' && t.instanceId === inst.id && t.nodeId === activeNodeId.value);
      if (existing) { switchTab(existing.id); return; }
      const id = nextTabId++;
      tabs.push({ id, title: `${inst.name} #${inst.id}`, type: 'terminal', initCommands: [], instanceId: inst.id, nodeId: activeNodeId.value });
      activeId.value = id;
    }

    function openTerminal(): void {
      const inst = selectedInstance.value; if (!inst) return;
      if (runningStates[inst.id] === 'running' || stopRequested[inst.id]) openTerminalForInstance(inst);
      else showNotification(t('instances.start_first'), 'error');
    }

    async function stopInstance(): Promise<void> {
      const inst = selectedInstance.value; if (!inst || activeNodeId.value === null) return;
      const prefix = apiPrefix();
      if (stopRequested[inst.id]) {
        runningStates[inst.id] = 'stopping';
        await apiFetch(prefix + '/instances/' + inst.id + '/force-stop', { method: 'POST' });
      } else {
        stopRequested[inst.id] = true; runningStates[inst.id] = 'stopping';
        await apiFetch(prefix + '/instances/' + inst.id + '/stop', { method: 'POST' });
      }
    }

    async function openSettings(): Promise<void> {
      showSettings.value = true; const prefix = apiPrefix(); if (!prefix) { showSettings.value = false; return; }
      try { const res = await apiFetch(prefix + '/settings'); if (res.ok) { const data = await res.json(); settings.defaultShell = data.defaultShell || ''; settings.textEditor = data.textEditor || ''; } } catch { /* */ }
    }
    function closeSettings() { showSettings.value = false; }
    async function saveSettings(): Promise<void> {
      savingSettings.value = true;
      try { await apiFetch(apiPrefix() + '/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultShell: settings.defaultShell, textEditor: settings.textEditor }) }); showSettings.value = false; }
      catch { /* */ } finally { savingSettings.value = false; }
    }

    function openDeleteConfirm() { showDeleteConfirm.value = true; }
    function cancelDelete() { showDeleteConfirm.value = false; }
    async function confirmDelete(): Promise<void> {
      const id = selectedId.value; if (id === null || activeNodeId.value === null) return;
      try {
        const res = await apiFetch(apiPrefix() + '/instances/' + id, { method: 'DELETE' });
        if (res.ok) { instances.value = instances.value.filter(i => i.id !== id); delete runningStates[id]; selectedId.value = null; showDeleteConfirm.value = false; }
      } catch (e) { console.error('Failed to delete instance', e); }
    }

    // ── Hub 设置 ──
    const showHubSettings = ref(false);
    const hubSecurityEntry = ref('');
    const hubSecurityContent = ref('');
    const savingHubSettings = ref(false);

    async function openHubSettings(): Promise<void> {
      try {
        const res = await apiFetch('/api/hub-settings');
        if (res.ok) { const data = await res.json(); const entry = data.securityEntry || ''; hubSecurityEntry.value = entry.startsWith('/') ? entry.slice(1) : entry; hubSecurityContent.value = data.securityContent || ''; }
      } catch { /* */ }
      showHubSettings.value = true;
    }
    function closeHubSettings() { showHubSettings.value = false; }
    async function saveHubSettings(): Promise<void> {
      savingHubSettings.value = true;
      try {
        await apiFetch('/api/hub-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ securityEntry: '/' + hubSecurityEntry.value, securityContent: hubSecurityContent.value }) });
        showHubSettings.value = false;
      } catch (e) { console.error('Failed to save hub settings', e); }
      finally { savingHubSettings.value = false; }
    }

    // ── 文件上传 ──
    const CHUNK_SIZE = 64 * 1024;
    const showUploadDialog = ref(false);
    const uploadFile = ref<File | null>(null);
    const uploadPath = ref('');
    const uploadStatus = ref<'idle' | 'uploading' | 'complete' | 'error'>('idle');
    const uploadProgress = ref(0);
    const uploadReceived = ref(0);
    const uploadTotal = ref(0);
    const uploadError = ref('');
    const fileInputRef = ref<HTMLInputElement | null>(null);
    let uploadWs: WebSocket | null = null;

    function formatSize(bytes: number): string {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }

    function openUploadDialog(): void {
      showUploadDialog.value = true; uploadFile.value = null; uploadPath.value = '';
      uploadStatus.value = 'idle'; uploadProgress.value = 0; uploadReceived.value = 0; uploadTotal.value = 0; uploadError.value = '';
    }
    function cancelUpload(): void { if (uploadWs) { uploadWs.close(); uploadWs = null; } showUploadDialog.value = false; uploadFile.value = null; uploadStatus.value = 'idle'; }
    function triggerFileInput() { fileInputRef.value?.click(); }
    function onFileSelected(e: Event) { const input = e.target as HTMLInputElement; if (input.files && input.files.length > 0) { uploadFile.value = input.files[0]; uploadStatus.value = 'idle'; } }
    function onFileDrop(e: DragEvent) { const files = e.dataTransfer?.files; if (files && files.length > 0) { uploadFile.value = files[0]; uploadStatus.value = 'idle'; } }

    function startUpload(): void {
      const file = uploadFile.value; if (!file || activeNodeId.value === null) return;
      uploadStatus.value = 'uploading'; uploadProgress.value = 0; uploadReceived.value = 0; uploadTotal.value = file.size;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      uploadWs = new WebSocket(`${protocol}//${location.host}/upload?nodeId=${activeNodeId.value}`);
      uploadWs.onopen = () => { uploadWs!.send(JSON.stringify({ type: 'upload_start', fileName: file.name, uploadPath: uploadPath.value, fileSize: file.size })); };
      uploadWs.onmessage = async (event) => {
        let msg: any; try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.type === 'upload_ack' && msg.status === 'ready') {
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          for (let i = 0; i < totalChunks; i++) {
            if (!uploadWs || uploadWs.readyState !== WebSocket.OPEN) break;
            const start = i * CHUNK_SIZE, end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end), buffer = await chunk.arrayBuffer(), bytes = new Uint8Array(buffer);
            let binary = ''; for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
            uploadWs.send(JSON.stringify({ type: 'upload_chunk', data: btoa(binary), index: i, total: totalChunks, final: i === totalChunks - 1 }));
            uploadReceived.value = end; uploadProgress.value = Math.round((end / file.size) * 100);
          }
        } else if (msg.type === 'upload_progress') { uploadReceived.value = msg.received; uploadProgress.value = Math.round((msg.received / msg.total) * 100); }
        else if (msg.type === 'upload_complete') { uploadStatus.value = 'complete'; uploadProgress.value = 100; uploadWs?.close(); uploadWs = null; }
        else if (msg.type === 'upload_error') { uploadStatus.value = 'error'; uploadError.value = msg.message || t('upload.failed'); uploadWs?.close(); uploadWs = null; }
      };
      uploadWs.onerror = () => { uploadStatus.value = 'error'; uploadError.value = t('upload.connection_failed'); uploadWs = null; };
      uploadWs.onclose = () => { if (uploadStatus.value === 'uploading') { uploadStatus.value = 'error'; uploadError.value = t('upload.connection_lost'); } uploadWs = null; };
    }

    // ── 事件 WS ──
    let eventsWs: WebSocket | null = null;
    let eventsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function disconnectEvents() { if (eventsWs) { eventsWs.close(); eventsWs = null; } if (eventsReconnectTimer) { clearTimeout(eventsReconnectTimer); eventsReconnectTimer = null; } }

    function handleEventMsg(msg: any): void {
      switch (msg.type) {
        case 'nodes': {
          const d = msg.nodes; nodes.value = d.nodes || [];
          if (showGeneratedToken.value) {
            const connectedCount = nodes.value.filter((n: any) => n.connected).length;
            if (connectedCount > pendingNodeConnCount) showGeneratedToken.value = false;
          }
          if (activeNodeId.value !== null && !nodes.value.find((n: any) => n.id === activeNodeId.value)) activeNodeId.value = null;
          break;
        }
        case 'instance_status': {
          if (activeNodeId.value === msg.nodeId) {
            runningStates[msg.instanceId] = msg.running ? 'running' : false;
            if (!msg.running) delete stopRequested[msg.instanceId];
          }
          break;
        }
        case 'instances_refresh': {
          if (activeNodeId.value === msg.nodeId) loadInstances();
          break;
        }
      }
    }

    function connectEvents(): void {
      if (eventsWs && (eventsWs.readyState === WebSocket.OPEN || eventsWs.readyState === WebSocket.CONNECTING)) return;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      eventsWs = new WebSocket(`${protocol}//${location.host}/events`);
      eventsWs.onopen = () => { /* */ };
      eventsWs.onmessage = (ev) => { try { handleEventMsg(JSON.parse(ev.data)); } catch { /* */ } };
      eventsWs.onclose = () => { eventsWs = null; if (authState.value === 'authenticated') eventsReconnectTimer = setTimeout(connectEvents, 5000); };
      eventsWs.onerror = () => eventsWs?.close();
    }

    // ── 语言 ──
    const showLangDialog = ref(false);
    const localeCodes = ['zh-CN', 'zh-TW', 'lzh', 'en'] as const;
    const { messages } = useI18n();

    function openLangDialog() { showLangDialog.value = true; }
    function closeLangDialog() { showLangDialog.value = false; }
    function setLang(code: string) {
      document.cookie = `YPanelLang=${encodeURIComponent(code)}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
      locale.value = code as 'zh-CN' | 'zh-TW' | 'lzh' | 'en';
      showLangDialog.value = false;
    }
    function cycleLocale() { openLangDialog(); }
    function openHelp() { window.open('https://github.com/cygbs/YPanel/wiki', '_blank', 'noopener,noreferrer'); }

    // ── 通知 ──
    interface NotificationItem { id: number; message: string; type: 'success' | 'error'; }
    const notifications = reactive<NotificationItem[]>([]);
    let notifyId = 0;
    function showNotification(message: string, type: 'success' | 'error'): void {
      const id = ++notifyId; notifications.push({ id, message, type });
      setTimeout(() => { const idx = notifications.findIndex(n => n.id === id); if (idx !== -1) notifications.splice(idx, 1); }, 5000);
    }
    function dismissNotification(id: number): void { const idx = notifications.findIndex(n => n.id === id); if (idx !== -1) notifications.splice(idx, 1); }

    // ── 初始化 ──
    checkAuth();
    watch(authState, (state) => { if (state === 'authenticated') connectEvents(); else disconnectEvents(); });
    if (authState.value === 'authenticated') connectEvents();
    watch(locale, () => {
      for (const tab of tabs) {
        if (tab.type === 'home') tab.title = t('tab.home');
        else if (tab.type === 'terminal' && !tab.instanceId && tab.id !== 0) tab.title = t('tab.terminal', { id: tab.id });
      }
    });

    const wsHost = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;

    // ═══════════════════════════════════════════════════
    // Provide 所有状态给子组件
    // ═══════════════════════════════════════════════════

    // 认证
    provide('authState', authState); provide('loginPassword', loginPassword); provide('loginError', loginError);
    provide('changeNewPassword', changeNewPassword); provide('changeConfirmPassword', changeConfirmPassword);
    provide('changeError', changeError); provide('changingPassword', changingPassword);
    provide('checkAuth', checkAuth); provide('doLogin', doLogin); provide('doChangePassword', doChangePassword);

    // 节点
    provide('nodes', nodes); provide('activeNodeId', activeNodeId); provide('activeNode', activeNode);
    provide('selectedNodeId', selectedNodeId); provide('selectedNodeForMenu', selectedNodeForMenu);
    provide('selectNode', selectNode); provide('switchToNode', switchToNode); provide('leaveNode', leaveNode);
    provide('loadNodes', loadNodes); provide('dblclickNode', dblclickNode); provide('clickSwitchNode', clickSwitchNode);
    provide('openNodeDialog', openNodeDialog); provide('closeNodeDialog', closeNodeDialog);
    provide('generateNodeToken', generateNodeToken); provide('copyToken', copyToken);
    provide('openEditNode', openEditNode); provide('closeEditNode', closeEditNode); provide('saveEditNode', saveEditNode);
    provide('openNodeDelete', openNodeDelete); provide('cancelNodeDelete', cancelNodeDelete); provide('confirmNodeDelete', confirmNodeDelete);
    provide('showNodeDialog', showNodeDialog); provide('newNodeName', newNodeName);
    provide('generatingNode', generatingNode); provide('generatedToken', generatedToken);
    provide('generatedNodeName', generatedNodeName); provide('showGeneratedToken', showGeneratedToken);
    provide('nodeError', nodeError);
    provide('showEditNodeDialog', showEditNodeDialog); provide('editNodeData', editNodeData);
    provide('savingNode', savingNode); provide('showNodeDeleteConfirm', showNodeDeleteConfirm);

    // 实例
    provide('instances', instances); provide('selectedInstance', selectedInstance);
    provide('runningStates', runningStates); provide('stopRequested', stopRequested);
    provide('showNewDialog', showNewDialog); provide('isEditing', isEditing);
    provide('isEditingLocked', isEditingLocked); provide('newData', newData);
    provide('errors', errors); provide('saving', saving);
    provide('showSettings', showSettings); provide('settings', settings); provide('savingSettings', savingSettings);
    provide('showDeleteConfirm', showDeleteConfirm);
    provide('selectInstance', selectInstance); provide('loadInstances', loadInstances);
    provide('openNewInstance', openNewInstance); provide('closeNewDialog', closeNewDialog);
    provide('createInstance', createInstance); provide('startInstance', startInstance);
    provide('stopInstance', stopInstance); provide('openTerminal', openTerminal);
    provide('openEditInstance', openEditInstance); provide('openSettings', openSettings);
    provide('closeSettings', closeSettings); provide('saveSettings', saveSettings);
    provide('openDeleteConfirm', openDeleteConfirm); provide('cancelDelete', cancelDelete);
    provide('confirmDelete', confirmDelete);

    // Hub 设置
    provide('showHubSettings', showHubSettings); provide('hubSecurityEntry', hubSecurityEntry);
    provide('hubSecurityContent', hubSecurityContent); provide('savingHubSettings', savingHubSettings);
    provide('openHubSettings', openHubSettings); provide('closeHubSettings', closeHubSettings);
    provide('saveHubSettings', saveHubSettings);

    // 上传
    provide('showUploadDialog', showUploadDialog); provide('uploadFile', uploadFile);
    provide('uploadPath', uploadPath); provide('uploadStatus', uploadStatus);
    provide('uploadProgress', uploadProgress); provide('uploadReceived', uploadReceived);
    provide('uploadTotal', uploadTotal); provide('uploadError', uploadError);
    provide('openUploadDialog', openUploadDialog); provide('cancelUpload', cancelUpload);
    provide('startUpload', startUpload); provide('triggerFileInput', triggerFileInput);
    provide('onFileSelected', onFileSelected); provide('onFileDrop', onFileDrop);
    provide('formatSize', formatSize);

    // 标签页
    provide('tabs', tabs); provide('activeId', activeId); provide('terminalTabs', terminalTabs);
    provide('addTerminalTab', addTerminalTab); provide('closeTab', closeTab); provide('switchTab', switchTab);
    provide('setTabRef', setTabRef); provide('tabRefs', tabRefs);
    provide('fileManagerTabs', fileManagerTabs); provide('openFileManager', openFileManager);

    // 语言 + 通知 + 杂项
    provide('showLangDialog', showLangDialog); provide('localeCodes', localeCodes);
    provide('locale', locale); provide('messages', messages);
    provide('openLangDialog', openLangDialog); provide('closeLangDialog', closeLangDialog);
    provide('setLang', setLang); provide('cycleLocale', cycleLocale);
    provide('openHelp', openHelp); provide('doLogout', doLogout);
    provide('notifications', notifications); provide('showNotification', showNotification);
    provide('dismissNotification', dismissNotification);
    provide('AVAILABLE_ICONS', AVAILABLE_ICONS); provide('wsHost', wsHost);
    provide('apiPrefix', apiPrefix); provide('apiFetch', apiFetch);

    return {
      authState, tabs, activeId, terminalTabs, fileManagerTabs, activeNodeId,
      addTerminalTab, closeTab, switchTab, setTabRef, openFileManager,
    };
  },
});
</script>

<template>
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
    <div v-show="activeNodeId !== null" class="tab-bar">
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
            <button @click="openUploadDialog">上传文件…</button>
            <button @click="openSettings">设置</button>
            <button @click="leaveNode" class="qa-back">返回节点列表</button>
          </template>
          <template v-else>
            <button @click="openNodeDialog">新增节点…</button>
            <button @click="openHubSettings">设置</button>
          </template>
          <button>帮助</button>
          <button @click="doLogout" class="qa-back" style="margin-left:auto">退出登录</button>
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
          :ref="(el: any) => setTabRef(tab.id, el)"
          :tab-id="tab.id"
          :is-active="tab.id === activeId"
          :init-commands="tab.initCommands || []"
          :instance-id="tab.instanceId ?? null"
          :node-id="tab.nodeId ?? null"
        />
      </div>
    </div>

    <!-- ===== 新增节点对话框（仅名称+生成） ===== -->
    <div v-if="showNodeDialog" class="dialog-overlay" @click.self="closeNodeDialog">
      <div class="dialog dialog-sm">
        <div class="dialog-title">新增节点</div>
        <div class="dialog-body">
          <div class="node-gen-row">
            <input
              v-model="newNodeName"
              type="text"
              class="input"
              placeholder="节点名称（可选）"
              @keyup.enter="generateNodeToken"
            />
            <button class="btn btn-primary" :disabled="generatingNode" @click="generateNodeToken">
              {{ generatingNode ? '生成中…' : '生成 Token' }}
            </button>
          </div>
          <div v-if="nodeError" class="field-error">{{ nodeError }}</div>
          <!-- 待处理的 Token -->
          <div v-if="pendingTokens.length > 0" class="node-list-title" style="margin-top:12px">等待连接的 Token</div>
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

    <!-- ===== Token 命令对话框 ===== -->
    <div v-if="showGeneratedToken" class="dialog-overlay" @click.self="showGeneratedToken = false">
      <div class="dialog">
        <div class="dialog-title">新节点「{{ generatedNodeName }}」</div>
        <div class="dialog-body">
          <div class="node-token-label" style="margin-bottom:8px">在目标机器上运行以下命令：</div>
          <div class="token-cmd-box">
            <code class="token-cmd-text">node index.js -s {{ wsHost }}/link -t {{ generatedToken }}</code>
          </div>
          <div class="token-cmd-note">节点连接后此窗口将自动关闭。</div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-primary" @click="copyToken">复制命令</button>
          <button class="btn btn-secondary" @click="showGeneratedToken = false">关闭</button>
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
            <div class="icon-selector" @click="showNodeIconPicker = !showNodeIconPicker">
              <img class="icon-preview" :src="'/assets/instances/' + editNodeData.icon" :alt="editNodeData.icon" />
              <span class="icon-name">{{ editNodeData.icon }}</span>
            </div>
            <div v-if="showNodeIconPicker" class="icon-grid">
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
            <div class="icon-selector" @click="showInstanceIconPicker = !showInstanceIconPicker">
              <img class="icon-preview" :src="'/assets/instances/' + newData.icon" :alt="newData.icon" />
              <span class="icon-name">{{ newData.icon }}</span>
            </div>
            <div v-if="showInstanceIconPicker" class="icon-grid">
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
              placeholder="留空则自动检测"
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

    <!-- ===== Hub 设置对话框 ===== -->
    <div v-if="showHubSettings" class="dialog-overlay" @click.self="closeHubSettings">
      <div class="dialog">
        <div class="dialog-title">Hub 设置</div>
        <div class="dialog-body">
          <label class="field">
            <span class="field-label">安全入口</span>
            <div class="input-with-prefix">
              <span class="input-prefix">/</span>
              <input
                v-model="hubSecurityEntry"
                type="text"
                class="input prefix-input"
                placeholder="留空则无安全入口"
              />
            </div>
            <span class="field-hint">设置后访问 /{{ hubSecurityEntry }} 才可进入面板，其余路径返回 404</span>
          </label>
          <label class="field">
            <span class="field-label">返回内容</span>
            <textarea
              v-model="hubSecurityContent"
              class="textarea"
              rows="10"
            ></textarea>
          </label>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="closeHubSettings">取消</button>
          <button class="btn btn-primary" :disabled="savingHubSettings" @click="saveHubSettings">
            {{ savingHubSettings ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 上传文件对话框 ===== -->
    <div v-if="showUploadDialog" class="dialog-overlay" @click.self="cancelUpload">
      <div class="dialog">
        <div class="dialog-title">上传文件</div>
        <div class="dialog-body">
          <template v-if="!uploadFile">
            <div class="upload-dropzone" @click="triggerFileInput" @dragover.prevent @drop.prevent="onFileDrop">
              <div class="upload-hint">点击选择文件或拖拽文件到此处</div>
            </div>
            <input ref="fileInputRef" type="file" class="upload-input-hidden" @change="onFileSelected" />
          </template>
          <template v-else>
            <label class="field">
              <span class="field-label">文件</span>
              <input type="text" class="input mono" :value="uploadFile.name" readonly />
            </label>
            <label class="field">
              <span class="field-label">大小</span>
              <input type="text" class="input" :value="formatSize(uploadFile.size)" readonly />
            </label>
            <label class="field">
              <span class="field-label">上传路径（留空使用节点的家目录）</span>
              <input
                v-model="uploadPath"
                type="text"
                class="input mono"
                placeholder="留空则上传到家目录"
              />
            </label>
            <div v-if="uploadStatus" class="upload-status-area">
              <div class="upload-progress-bar">
                <div class="upload-progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
              <div class="upload-progress-text">
                <template v-if="uploadStatus === 'uploading'">
                  上传中… {{ formatSize(uploadReceived) }} / {{ formatSize(uploadTotal) }}
                </template>
                <template v-else-if="uploadStatus === 'complete'">
                  上传完成
                </template>
                <template v-else-if="uploadStatus === 'error'">
                  {{ uploadError }}
                </template>
              </div>
            </div>
          </template>
        </div>
        <div class="dialog-actions">
          <template v-if="!uploadFile">
            <button class="btn btn-secondary" @click="cancelUpload">关闭</button>
          </template>
          <template v-else-if="uploadStatus === 'idle' || uploadStatus === 'error'">
            <button class="btn btn-secondary" @click="cancelUpload">取消</button>
            <button class="btn btn-primary" @click="startUpload">上传</button>
          </template>
          <template v-else-if="uploadStatus === 'complete'">
            <button class="btn btn-primary" @click="cancelUpload">完成</button>
          </template>
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
</template>

<script lang="ts">
import { defineComponent, reactive, ref, computed, watch } from 'vue';
import TerminalTab from './TerminalTab.vue';

// ── CSRF Token（运行时内存，不自 localStorage） ──
let _csrfToken: string | null = null;

/** 带认证的 fetch（Cookie 自动发送，CSRF Token 由本函数添加） */
function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = { ...(options.headers || {}) } as Record<string, string>;
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method) && _csrfToken) {
    headers['X-CSRF-Token'] = _csrfToken;
  }
  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}

interface TabData {
  id: number;
  title: string;
  type: 'home' | 'terminal';
  initCommands?: string[];
  instanceId?: number | null;
  nodeId?: number | null;
}

const AVAILABLE_ICONS = [
  'bee.svg', 'brick.svg', 'chicken.svg',
  'creeper.svg', 'diamond.svg', 'dirt.svg', 'enderman.svg',
  'enderpearl.svg', 'fabricmc.svg', 'flame.svg', 'fox.svg',
  'ftb_logo.svg', 'gear.svg', 'gold.svg',
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
      try {
        const res = await fetch('/api/auth/check', {
          method: 'POST',
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (data.valid) {
          // 同步获取 CSRF Token
          const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
          if (csrfRes.ok) {
            const csrfData = await csrfRes.json();
            _csrfToken = csrfData.csrfToken;
          }
          if (data.defaultPassword) {
            authState.value = 'change-password';
          } else {
            authState.value = 'authenticated';
          }
        } else {
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
          credentials: 'same-origin',
          body: JSON.stringify({ password: loginPassword.value }),
        });
        const data = await res.json();
        if (res.ok) {
          _csrfToken = data.csrfToken;
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
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ oldPassword: loginPassword.value, newPassword: changeNewPassword.value }),
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

    async function doLogout(): Promise<void> {
      disconnectEvents();
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch { /* ignore */ }
      _csrfToken = null;
      authState.value = 'login';
      loginPassword.value = '';
      loginError.value = '';
      leaveNode();
      tabs.splice(1); // 保留第一个（主页），删除其余标签
      activeId.value = 0;
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
      if (instanceId === undefined && nodeId === undefined) {
        if (activeNodeId.value !== null) {
          nodeId = activeNodeId.value;
        } else {
          return;
        }
      }
      const id = nextTabId++;
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

    function apiPrefix(): string {
      const nid = activeNodeId.value;
      return nid !== null ? `/api/node/${nid}` : '';
    }

    async function loadNodes(): Promise<void> {
      try {
        const res = await apiFetch('/api/nodes');
        if (res.ok) {
          const data = await res.json();
          nodes.value = data.nodes || [];
          pendingTokens.value = data.pendingTokens || [];
          if (activeNodeId.value !== null && !nodes.value.find(n => n.id === activeNodeId.value)) {
            activeNodeId.value = null;
          }
        }
      } catch { /* ignore */ }
    }

    const selectedNodeId = ref<number | null>(null);
    const selectedNodeForMenu = computed(() =>
      nodes.value.find(n => n.id === selectedNodeId.value) ?? null
    );
    function selectNode(id: number | null): void {
      selectedNodeId.value = id;
    }

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
        closeNodeDialog();
      }
    }

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

    function copyToken(): void {
      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const cmd = `node index.js -s ${wsProto}//${window.location.host}/link -t ${generatedToken.value}`;
      navigator.clipboard.writeText(cmd).catch(() => {});
    }

    watch(pendingTokens, (list) => {
      if (showGeneratedToken.value && generatedToken.value) {
        const stillPending = list.some(p => p.token === generatedToken.value);
        if (!stillPending) {
          showGeneratedToken.value = false;
        }
      }
    });

    async function cancelPendingToken(token: string): Promise<void> {
      try {
        await apiFetch(`/api/nodes/pending/${token}`, { method: 'DELETE' });
        await loadNodes();
      } catch { /* ignore */ }
    }

    async function switchToNode(id: number): Promise<void> {
      activeNodeId.value = id;
      showNodeDialog.value = false;
      await loadInstances();
      pollStatus(); // 实例列表已加载，立即查一次状态，不等定时器
    }

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
      showNodeIconPicker.value = false;
      showEditNodeDialog.value = true;
    }

    function closeEditNode(): void {
      showEditNodeDialog.value = false;
      showNodeIconPicker.value = false;
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
    const showNodeIconPicker = ref(false);
    const showInstanceIconPicker = ref(false);
    const showSettings = ref(false);
    const savingSettings = ref(false);
    const settings = reactive({ defaultShell: '' });
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
      showInstanceIconPicker.value = false;
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
      showInstanceIconPicker.value = false;
      isEditing.value = false;
      editingId.value = null;
    }

    function selectIcon(name: string): void {
      newData.icon = name;
      showInstanceIconPicker.value = false;
    }

    function selectInstance(id: number | null): void {
      selectedId.value = id;
    }

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
      } catch (e) { console.warn('loadInstances failed:', e); }
    }

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
        } catch (e) { console.warn(`pollStatus #${inst.id} failed:`, e); }
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
            // 立即查一次新实例的状态
            pollStatus();
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
          settings.defaultShell = data.defaultShell || '';
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
          delete runningStates[id];
          selectedId.value = null;
          showDeleteConfirm.value = false;
        }
      } catch (e) {
        console.error('Failed to delete instance', e);
      }
    }

    // ── Hub 设置（安全入口等） ──
    const showHubSettings = ref(false);
    const hubSecurityEntry = ref('');
    const hubSecurityContent = ref('');
    const savingHubSettings = ref(false);

    async function openHubSettings(): Promise<void> {
      try {
        const res = await apiFetch('/api/hub-settings');
        if (res.ok) {
          const data = await res.json();
          // 安全入口：去掉开头的 / 以便在 input-with-prefix 中显示
          const entry = data.securityEntry || '';
          hubSecurityEntry.value = entry.startsWith('/') ? entry.slice(1) : entry;
          hubSecurityContent.value = data.securityContent || '';
        }
      } catch { /* ignore */ }
      showHubSettings.value = true;
    }

    function closeHubSettings(): void {
      showHubSettings.value = false;
    }

    async function saveHubSettings(): Promise<void> {
      savingHubSettings.value = true;
      try {
        const entry = '/' + hubSecurityEntry.value;
        await apiFetch('/api/hub-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            securityEntry: entry,
            securityContent: hubSecurityContent.value,
          }),
        });
        showHubSettings.value = false;
      } catch (e) {
        console.error('Failed to save hub settings', e);
      } finally {
        savingHubSettings.value = false;
      }
    }

    // ── 文件上传 ──
    const CHUNK_SIZE = 64 * 1024; // 64KB
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
      showUploadDialog.value = true;
      uploadFile.value = null;
      uploadPath.value = '';
      uploadStatus.value = 'idle';
      uploadProgress.value = 0;
      uploadReceived.value = 0;
      uploadTotal.value = 0;
      uploadError.value = '';
    }

    function cancelUpload(): void {
      if (uploadWs) { uploadWs.close(); uploadWs = null; }
      showUploadDialog.value = false;
      uploadFile.value = null;
      uploadStatus.value = 'idle';
    }

    function triggerFileInput(): void {
      fileInputRef.value?.click();
    }

    function onFileSelected(e: Event): void {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
        uploadFile.value = input.files[0];
        uploadStatus.value = 'idle';
      }
    }

    function onFileDrop(e: DragEvent): void {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        uploadFile.value = files[0];
        uploadStatus.value = 'idle';
      }
    }

    function startUpload(): void {
      const file = uploadFile.value;
      if (!file || activeNodeId.value === null) return;

      uploadStatus.value = 'uploading';
      uploadProgress.value = 0;
      uploadReceived.value = 0;
      uploadTotal.value = file.size;

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = `nodeId=${activeNodeId.value}`;
      // 认证：HttpOnly Cookie 由浏览器自动发送
      uploadWs = new WebSocket(`${protocol}//${location.host}/upload?${params}`);

      uploadWs.onopen = () => {
        // 发送开始消息
        uploadWs!.send(JSON.stringify({
          type: 'upload_start',
          fileName: file.name,
          uploadPath: uploadPath.value,
          fileSize: file.size,
        }));
      };

      uploadWs.onmessage = async (event) => {
        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === 'upload_ack' && msg.status === 'ready') {
          // 开始分片上传
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          for (let i = 0; i < totalChunks; i++) {
            if (!uploadWs || uploadWs.readyState !== WebSocket.OPEN) break;

            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            const buffer = await chunk.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let j = 0; j < bytes.length; j++) {
              binary += String.fromCharCode(bytes[j]);
            }
            const base64 = btoa(binary);

            const isFinal = i === totalChunks - 1;
            uploadWs.send(JSON.stringify({
              type: 'upload_chunk',
              data: base64,
              index: i,
              total: totalChunks,
              final: isFinal,
            }));

            uploadReceived.value = end;
            uploadProgress.value = Math.round((end / file.size) * 100);
          }
        } else if (msg.type === 'upload_progress') {
          uploadReceived.value = msg.received;
          uploadProgress.value = Math.round((msg.received / msg.total) * 100);
        } else if (msg.type === 'upload_complete') {
          uploadStatus.value = 'complete';
          uploadProgress.value = 100;
          uploadWs?.close();
          uploadWs = null;
        } else if (msg.type === 'upload_error') {
          uploadStatus.value = 'error';
          uploadError.value = msg.message || '上传失败';
          uploadWs?.close();
          uploadWs = null;
        }
      };

      uploadWs.onerror = () => {
        uploadStatus.value = 'error';
        uploadError.value = '连接失败';
        uploadWs = null;
      };

      uploadWs.onclose = () => {
        if (uploadStatus.value === 'uploading') {
          uploadStatus.value = 'error';
          uploadError.value = '连接断开';
        }
        uploadWs = null;
      };
    }

    // ── 事件推送连接 ──
    let eventsWs: WebSocket | null = null;
    let eventsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function disconnectEvents(): void {
      if (eventsWs) { eventsWs.close(); eventsWs = null; }
      if (eventsReconnectTimer) { clearTimeout(eventsReconnectTimer); eventsReconnectTimer = null; }
    }

    function connectEvents(): void {
      if (eventsWs && (eventsWs.readyState === WebSocket.OPEN || eventsWs.readyState === WebSocket.CONNECTING)) return;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      eventsWs = new WebSocket(`${protocol}//${location.host}/events`);
      eventsWs.onopen = () => { /* connected */ };
      eventsWs.onmessage = (ev) => {
        try { handleEventMsg(JSON.parse(ev.data)); } catch { /* ignore */ }
      };
      eventsWs.onclose = () => {
        eventsWs = null;
        if (authState.value === 'authenticated') {
          eventsReconnectTimer = setTimeout(connectEvents, 5000);
        }
      };
      eventsWs.onerror = () => eventsWs?.close();
    }

    function handleEventMsg(msg: any): void {
      switch (msg.type) {
        case 'nodes': {
          const d = msg.nodes;
          nodes.value = d.nodes || [];
          pendingTokens.value = d.pendingTokens || [];
          if (activeNodeId.value !== null && !nodes.value.find((n: any) => n.id === activeNodeId.value)) {
            activeNodeId.value = null;
          }
          break;
        }
        case 'instance_status': {
          if (activeNodeId.value === msg.nodeId) {
            runningStates[msg.instanceId] = msg.running ? 'running' : false;
          }
          break;
        }
        case 'instances_refresh': {
          if (activeNodeId.value === msg.nodeId) {
            loadInstances();
          }
          break;
        }
      }
    }

    // ── 初始化 ──
    loadNodes();
    watch(authState, (state) => {
      if (state === 'authenticated') {
        connectEvents();
      } else {
        disconnectEvents();
      }
    });
    // 页面加载时若已登录，手动连接
    if (authState.value === 'authenticated') connectEvents();

    const locationHost = window.location.host;
    const wsHost = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + locationHost;

    return {
      // 认证
      authState, loginPassword, loginError,
      changeNewPassword, changeConfirmPassword, changeError,
      changingPassword, doLogin, doChangePassword, doLogout,
      // 标签页
      tabs, activeId, terminalTabs,
      addTerminalTab, closeTab, switchTab, setTabRef,
      // 节点管理
      nodes, pendingTokens, activeNodeId, activeNode,
      showNodeDialog, newNodeName, generatingNode,
      generatedToken, generatedNodeName, showGeneratedToken, locationHost, wsHost,
      nodeError,
      selectedNodeId, selectedNodeForMenu, selectNode,
      openNodeDialog, closeNodeDialog, generateNodeToken, copyToken,
      showEditNodeDialog, editNodeData, savingNode,
      openEditNode, closeEditNode, saveEditNode,
      deleteNode, cancelPendingToken,
      switchToNode, leaveNode,
      // 实例管理
      instances, selectedInstance, selectedId, selectInstance,
      runningStates, showNewDialog, isEditing, isEditingLocked,
      showNodeIconPicker, showInstanceIconPicker, showSettings, savingSettings, saving,
      settings, errors, showDeleteConfirm, newData,
      openNewInstance, closeNewDialog, selectIcon,
      createInstance, startInstance, stopInstance,
      openTerminal, openEditInstance,
      openSettings, closeSettings, saveSettings,
      openDeleteConfirm, confirmDelete, cancelDelete,
      // Hub 设置
      showHubSettings, hubSecurityEntry, hubSecurityContent,
      savingHubSettings,
      openHubSettings, closeHubSettings, saveHubSettings,
      // 文件上传
      showUploadDialog, uploadFile, uploadPath,
      uploadStatus, uploadProgress, uploadReceived, uploadTotal,
      uploadError, fileInputRef,
      openUploadDialog, cancelUpload,
      triggerFileInput, onFileSelected, onFileDrop,
      startUpload, formatSize,
      AVAILABLE_ICONS,
    };
  },
});
</script>

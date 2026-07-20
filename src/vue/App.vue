<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <!-- ===== 加载中 ===== -->
  <div v-if="authState === 'loading'" class="auth-screen">
    <div class="auth-box">
      <div class="auth-loading">{{ $t('loading') }}</div>
    </div>
  </div>

  <!-- ===== 登录页 ===== -->
  <div v-else-if="authState === 'login'" class="auth-screen">
    <div class="auth-box">
      <div class="auth-title">YPanel</div>
      <div class="auth-subtitle">{{ $t('login.subtitle') }}</div>
      <div class="auth-field">
        <input v-model="loginPassword" type="password" class="input" :placeholder="$t('login.password')" @keyup.enter="doLogin" />
      </div>
      <div v-if="loginError" class="auth-error">{{ loginError }}</div>
      <button class="btn btn-primary auth-btn" @click="doLogin">{{ $t('login.login') }}</button>
    </div>
  </div>

  <!-- ===== 修改默认密码 ===== -->
  <div v-else-if="authState === 'change-password'" class="auth-screen">
    <div class="auth-box">
      <div class="auth-title">YPanel</div>
      <div class="auth-subtitle">{{ $t('change_password.title') }}</div>
      <div class="auth-field">
        <input v-model="changeNewPassword" type="password" class="input" :placeholder="$t('change_password.new_password')" @keyup.enter="doChangePassword" />
      </div>
      <div class="auth-field">
        <input v-model="changeConfirmPassword" type="password" class="input" :placeholder="$t('change_password.confirm_password')" @keyup.enter="doChangePassword" />
      </div>
      <div v-if="changeError" class="auth-error">{{ changeError }}</div>
      <button class="btn btn-primary auth-btn" :disabled="changingPassword" @click="doChangePassword">
        {{ changingPassword ? $t('saving') : $t('save') }}
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
            :title="$t('tab.close')"
          >&times;</span>
        </div>
      </div>
      <div class="tab-add" @click="addTerminalTab()" :title="$t('tab.new')">+</div>
    </div>

    <!-- 内容区 -->
    <div class="content-area">
      <!-- 主页 -->
      <div v-show="activeId === 0" class="page-home">
        <!-- 快捷操作栏 -->
        <div class="quick-actions">
          <template v-if="activeNodeId !== null">
            <button @click="openNewInstance">{{ $t('quick.new_instance') }}</button>
            <button @click="openUploadDialog">{{ $t('quick.upload_file') }}</button>
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
                @dblclick="dblclickNode(node)"
              >
                <div class="inst-icon-wrap">
                  <img class="inst-icon" :src="'/assets/instances/' + (node.icon || 'gear.svg')" :alt="node.name" />
                  <span class="status-dot" :class="node.connected ? 'running' : 'offline'"></span>
                </div>
                <span class="inst-name">{{ node.name }}</span>
              </div>
              <div v-if="nodes.length === 0" class="no-instances-hint">
                {{ $t('nodes.none') }}
              </div>
            </div>
            <div class="function-menu">
              <template v-if="selectedNodeForMenu">
                <div class="fm-icon" @click="selectNode(null)">
                  <img :src="'/assets/instances/' + (selectedNodeForMenu.icon || 'gear.svg')" />
                </div>
                <div class="fm-name">{{ selectedNodeForMenu.name }}</div>
                <div class="fm-actions">
                  <button class="fm-btn"
                    @click="clickSwitchNode(selectedNodeForMenu)">{{ $t('nodes.switch') }}</button>
                  <button class="fm-btn"
                    @click="openEditNode">{{ $t('nodes.edit') }}</button>
                  <button class="fm-btn fm-btn-danger"
                    @click="openNodeDelete(selectedNodeForMenu.id)">{{ $t('nodes.delete') }}</button>
                </div>
              </template>
              <div v-else class="fm-empty">{{ $t('nodes.select_hint') }}</div>
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
                @dblclick="openTerminal()"
              >
                <div class="inst-icon-wrap">
                  <img class="inst-icon" :src="'/assets/instances/' + (inst.icon || 'grass.svg')" :alt="inst.name" />
                  <span v-if="runningStates[inst.id]" class="status-dot" :class="runningStates[inst.id]"></span>
                </div>
                <span class="inst-name">{{ inst.name }} #{{ inst.id }}</span>
              </div>
              <div v-if="instances.length === 0" class="no-instances-hint">
                {{ $t('instances.none') }}
              </div>
            </div>
            <div class="function-menu">
              <template v-if="selectedInstance">
                <div class="fm-icon" @click="selectInstance(null)">
                  <img :src="'/assets/instances/' + (selectedInstance.icon || 'grass.svg')" :alt="selectedInstance.name" />
                </div>
                <div class="fm-name">{{ selectedInstance.name }}</div>
                <div class="fm-actions">
                  <button
                    class="fm-btn"
                    :disabled="selectedInstance ? !!runningStates[selectedInstance.id] : true"
                    @click="startInstance"
                  >{{ $t('instances.start') }}</button>
                  <button
                    class="fm-btn"
                    :class="{ 'btn-warning': selectedInstance && stopRequested[selectedInstance.id] }"
                    :disabled="selectedInstance ? !runningStates[selectedInstance.id] && !stopRequested[selectedInstance.id] : true"
                    @click="stopInstance"
                  >
                    {{ selectedInstance && stopRequested[selectedInstance.id] ? $t('instances.force_stop') : $t('instances.stop') }}
                  </button>
                  <button class="fm-btn" @click="openTerminal">{{ $t('instances.open_terminal') }}</button>
                  <button class="fm-btn" @click="openEditInstance">{{ $t('instances.edit') }}</button>
                  <button class="fm-btn fm-btn-danger" @click="openDeleteConfirm">{{ $t('instances.delete') }}</button>
                </div>
              </template>
              <div v-else class="fm-empty">{{ $t('instances.select_hint') }}</div>
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
        <div class="dialog-title">{{ $t('add_node.title') }}</div>
        <div class="dialog-body">
          <div class="node-gen-row">
            <input
              v-model="newNodeName"
              type="text"
              class="input"
              :placeholder="$t('add_node.name_placeholder')"
              @keyup.enter="generateNodeToken"
            />
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

    <!-- ===== Token 命令对话框 ===== -->
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

    <!-- ===== 编辑节点对话框 ===== -->
    <div v-if="showEditNodeDialog" class="dialog-overlay" @click.self="closeEditNode">
      <div class="dialog">
        <div class="dialog-title">{{ $t('edit_node.title') }}</div>
        <div class="dialog-body">
          <label class="field">
            <span class="field-label">{{ $t('edit_node.name') }}</span>
            <input
              v-model="editNodeData.name"
              type="text"
              class="input"
              :placeholder="$t('edit_node.name')"
            />
          </label>
          <label class="field">
            <span class="field-label">{{ $t('edit_node.icon') }}</span>
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
          <button class="btn btn-secondary" @click="closeEditNode">{{ $t('cancel') }}</button>
          <button class="btn btn-primary" :disabled="savingNode" @click="saveEditNode">
            {{ savingNode ? $t('saving') : $t('save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 新建/编辑实例对话框 ===== -->
    <div v-if="showNewDialog" class="dialog-overlay" @click.self="closeNewDialog">
      <div class="dialog">
        <div class="dialog-title">{{ isEditing ? $t('instance_form.title_edit') : $t('instance_form.title_create') }}</div>
        <div class="dialog-body">
          <label class="field">
            <span class="field-label">{{ $t('instance_form.name') }}</span>
            <input
              v-model="newData.name"
              type="text"
              class="input"
              :class="{ invalid: errors.name }"
              :placeholder="$t('instance_form.name_placeholder')"
            />
            <span v-if="errors.name" class="field-error">{{ $t('instance_form.required') }}</span>
          </label>
          <label class="field">
            <span class="field-label">{{ $t('instance_form.uuid') }}</span>
            <input
              :value="newData.uuid"
              type="text"
              class="input mono"
              readonly
            />
          </label>
          <label class="field">
            <span class="field-label">{{ $t('instance_form.icon') }}</span>
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
              {{ $t('instance_form.command') }}
              <span v-if="isEditingLocked" class="field-hint">{{ $t('instance_form.command_lock') }}</span>
            </span>
            <input
              v-model="newData.command"
              type="text"
              class="input mono"
              :class="{ invalid: errors.command }"
              :disabled="isEditingLocked"
              placeholder="java -jar xxx.jar"
            />
            <span v-if="errors.command" class="field-error">{{ $t('instance_form.required') }}</span>
          </label>
          <label class="field">
            <span class="field-label">
              {{ $t('instance_form.folder') }}
              <span v-if="isEditingLocked" class="field-hint">{{ $t('instance_form.folder_lock') }}</span>
            </span>
            <input
              v-model="newData.folder"
              type="text"
              class="input mono"
              :class="{ invalid: errors.folder }"
              :disabled="isEditingLocked"
              placeholder="path/to/your/folder"
            />
            <span v-if="errors.folder" class="field-error">{{ $t('instance_form.required') }}</span>
          </label>
          <label class="field">
            <span class="field-label">{{ $t('instance_form.stop_command') }}</span>
            <input
              v-model="newData.stopCommand"
              type="text"
              class="input mono"
              placeholder="^C"
            />
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

    <!-- ===== 设置对话框 ===== -->
    <div v-if="showSettings" class="dialog-overlay" @click.self="closeSettings">
      <div class="dialog">
        <div class="dialog-title">{{ $t('node_settings.title', { name: activeNode?.name || 'Node' }) }}</div>
        <div class="dialog-body">
          <label class="field">
            <span class="field-label">{{ $t('node_settings.default_shell') }}</span>
            <input
              v-model="settings.defaultShell"
              type="text"
              class="input mono"
              :placeholder="$t('node_settings.shell_placeholder')"
            />
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

    <!-- ===== Hub 设置对话框 ===== -->
    <div v-if="showHubSettings" class="dialog-overlay" @click.self="closeHubSettings">
      <div class="dialog">
        <div class="dialog-title">{{ $t('hub_settings.title') }}</div>
        <div class="dialog-body">
          <label class="field">
            <span class="field-label">{{ $t('hub_settings.security_entry') }}</span>
            <div class="input-with-prefix">
              <span class="input-prefix">/</span>
              <input
                v-model="hubSecurityEntry"
                type="text"
                class="input prefix-input"
                :placeholder="$t('hub_settings.entry_placeholder')"
              />
            </div>
            <span class="field-hint">{{ $t('hub_settings.entry_hint', { entry: hubSecurityEntry }) }}</span>
          </label>
          <label class="field">
            <span class="field-label">{{ $t('hub_settings.security_content') }}</span>
            <textarea
              v-model="hubSecurityContent"
              class="textarea"
              rows="10"
            ></textarea>
          </label>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="closeHubSettings">{{ $t('cancel') }}</button>
          <button class="btn btn-primary" :disabled="savingHubSettings" @click="saveHubSettings">
            {{ savingHubSettings ? $t('saving') : $t('save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 上传文件对话框 ===== -->
    <div v-if="showUploadDialog" class="dialog-overlay" @click.self="cancelUpload">
      <div class="dialog">
        <div class="dialog-title">{{ $t('upload.title') }}</div>
        <div class="dialog-body">
          <template v-if="!uploadFile">
            <div class="upload-dropzone" @click="triggerFileInput" @dragover.prevent @drop.prevent="onFileDrop">
              <div class="upload-hint">{{ $t('upload.dropzone_hint') }}</div>
            </div>
            <input ref="fileInputRef" type="file" class="upload-input-hidden" @change="onFileSelected" />
          </template>
          <template v-else>
            <label class="field">
              <span class="field-label">{{ $t('upload.file') }}</span>
              <input type="text" class="input mono" :value="uploadFile.name" readonly />
            </label>
            <label class="field">
              <span class="field-label">{{ $t('upload.size') }}</span>
              <input type="text" class="input" :value="formatSize(uploadFile.size)" readonly />
            </label>
            <label class="field">
              <span class="field-label">{{ $t('upload.path_hint') }}</span>
              <input
                v-model="uploadPath"
                type="text"
                class="input mono"
                :placeholder="$t('upload.path_placeholder')"
              />
            </label>
            <div v-if="uploadStatus" class="upload-status-area">
              <div class="upload-progress-bar">
                <div class="upload-progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
              <div class="upload-progress-text">
                <template v-if="uploadStatus === 'uploading'">
                  {{ $t('upload.uploading', { received: formatSize(uploadReceived), total: formatSize(uploadTotal) }) }}
                </template>
                <template v-else-if="uploadStatus === 'complete'">
                  {{ $t('upload.complete') }}
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
            <button class="btn btn-secondary" @click="cancelUpload">{{ $t('upload.close') }}</button>
          </template>
          <template v-else-if="uploadStatus === 'idle' || uploadStatus === 'error'">
            <button class="btn btn-secondary" @click="cancelUpload">{{ $t('upload.cancel') }}</button>
            <button class="btn btn-primary" @click="startUpload">{{ $t('upload.upload') }}</button>
          </template>
          <template v-else-if="uploadStatus === 'complete'">
            <button class="btn btn-primary" @click="cancelUpload">{{ $t('upload.done') }}</button>
          </template>
        </div>
      </div>
    </div>

    <!-- ===== 删除确认对话框 ===== -->
    <div v-if="showDeleteConfirm" class="dialog-overlay" @click.self="cancelDelete">
      <div class="dialog dialog-sm">
        <div class="dialog-title">{{ $t('delete_instance.title') }}</div>
        <div class="dialog-body">
          <p class="delete-warning">{{ $t('delete_instance.body') }}</p>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelDelete">{{ $t('delete_instance.cancel') }}</button>
          <button class="btn btn-danger" @click="confirmDelete">{{ $t('delete_instance.confirm') }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 节点删除确认对话框 ===== -->
    <div v-if="showNodeDeleteConfirm" class="dialog-overlay" @click.self="cancelNodeDelete">
      <div class="dialog dialog-sm">
        <div class="dialog-title">{{ $t('delete_node.title') }}</div>
        <div class="dialog-body">
          <p class="delete-warning">{{ $t('delete_node.body') }}</p>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelNodeDelete">{{ $t('cancel') }}</button>
          <button class="btn btn-danger" @click="confirmNodeDelete">{{ $t('delete_node.confirm') }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 语言选择对话框 ===== -->
    <div v-if="showLangDialog" class="dialog-overlay" @click.self="closeLangDialog">
      <div class="dialog dialog-sm">
        <div class="dialog-title">{{ $t('lang.select') }}</div>
        <div class="dialog-body">
          <div
            v-for="code in localeCodes"
            :key="code"
            class="lang-option"
            :class="{ selected: code === locale }"
            @click="setLang(code)"
          >
            <span class="lang-option-name">{{ messages[code].name }}</span>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="closeLangDialog">{{ $t('cancel') }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 通知弹窗 ===== -->
    <div class="toast-container">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="toast"
        :class="'toast-' + n.type"
      >
        <div class="toast-bar"></div>
        <button class="toast-close" @click="dismissNotification(n.id)">&times;</button>
        <div class="toast-body">{{ n.message }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, computed, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';

const TerminalTab = defineAsyncComponent(() => import('./TerminalTab.vue'));

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
  try {
    return crypto.randomUUID();
  } catch {
    // crypto.randomUUID 仅在 HTTPS 或 localhost 下可用
    // HTTP 局域网访问时 fallback 到 Math.random 方案
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
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
    const { t, locale } = useI18n();
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
            loadNodes(); // 已登录用户，立即拉取节点列表
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
            await loadNodes(); // 立即加载节点列表，不等 events WS
          }
        } else {
          loginError.value = data.error || t('login.failed');
        }
      } catch { loginError.value = t('network_error'); }
    }

    async function doChangePassword(): Promise<void> {
      changeError.value = '';
      if (changeNewPassword.value !== changeConfirmPassword.value) {
        changeError.value = t('change_password.mismatch');
        return;
      }
      if (!changeNewPassword.value) {
        changeError.value = t('change_password.empty');
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
          await loadNodes(); // 立即加载节点列表
        } else {
          changeError.value = data.error || t('change_password.failed');
        }
      } catch { changeError.value = t('network_error'); }
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
      { id: 0, title: t('tab.home'), type: 'home' },
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
        id, title: title || t('tab.terminal', { id }),
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
          pendingNodeConnCount = nodes.value.filter((n: any) => n.connected).length;
          showGeneratedToken.value = true;
          newNodeName.value = '';
          await loadNodes();
        } else {
          nodeError.value = t('add_node.failed');
        }
      } catch (e) {
        nodeError.value = t('network_error');
      } finally {
        generatingNode.value = false;
        closeNodeDialog();
      }
    }

    const showNodeDeleteConfirm = ref(false);
    const pendingDeleteNodeId = ref<number | null>(null);

    function openNodeDelete(id: number): void {
      pendingDeleteNodeId.value = id;
      showNodeDeleteConfirm.value = true;
    }

    function cancelNodeDelete(): void {
      showNodeDeleteConfirm.value = false;
      pendingDeleteNodeId.value = null;
    }

    async function confirmNodeDelete(): Promise<void> {
      const id = pendingDeleteNodeId.value;
      if (id === null) return;
      showNodeDeleteConfirm.value = false;
      pendingDeleteNodeId.value = null;
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

      // clipboard API 仅在 HTTPS 或 localhost 下可用
      // HTTP 局域网访问时 fallback 到选中文本 + execCommand 方案
      function fallbackCopy(text: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showNotification(t('notification.copy_success'), 'success');
          showGeneratedToken.value = false;
        } catch {
          // 什么都不做
        }
        document.body.removeChild(textarea);
      }

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(cmd).then(
          () => {
            showNotification(t('notification.copy_success'), 'success');
            showGeneratedToken.value = false;
          },
          () => fallbackCopy(cmd)
        );
      } else {
        fallbackCopy(cmd);
      }
    }



    async function switchToNode(id: number): Promise<void> {
      activeNodeId.value = id;
      showNodeDialog.value = false;
      await loadInstances();
      // 立即查询状态：节点注册时的 node_status 事件可能已错过
      pollStatus();
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
    const stopRequested = reactive<Record<number, boolean>>({});
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
              delete stopRequested[inst.id];
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
      // 实例运行中、或正在等待停止（橙色按钮状态）时允许打开终端
      if (runningStates[inst.id] === 'running' || stopRequested[inst.id]) {
        openTerminalForInstance(inst);
      } else {
        showNotification(t('instances.start_first'), 'error');
      }
    }

    async function stopInstance(): Promise<void> {
      const inst = selectedInstance.value;
      if (!inst || activeNodeId.value === null) return;
      const prefix = apiPrefix();

      if (stopRequested[inst.id]) {
        // 第二次点击：强制终止进程
        runningStates[inst.id] = 'stopping';
        await apiFetch(prefix + '/instances/' + inst.id + '/force-stop', { method: 'POST' });
      } else {
        // 第一次点击：发送用户配置的停止命令，不设超时强制杀死
        stopRequested[inst.id] = true;
        runningStates[inst.id] = 'stopping';
        await apiFetch(prefix + '/instances/' + inst.id + '/stop', { method: 'POST' });
      }
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
            // Hub 会推送 instances_refresh + instance_status 事件
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
          uploadError.value = msg.message || t('upload.failed');
          uploadWs?.close();
          uploadWs = null;
        }
      };

      uploadWs.onerror = () => {
        uploadStatus.value = 'error';
        uploadError.value = t('upload.connection_failed');
        uploadWs = null;
      };

      uploadWs.onclose = () => {
        if (uploadStatus.value === 'uploading') {
          uploadStatus.value = 'error';
          uploadError.value = t('upload.connection_lost');
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
          // Auto-close token dialog when a new node connects
          if (showGeneratedToken.value) {
            const connectedCount = nodes.value.filter((n: any) => n.connected).length;
            if (connectedCount > pendingNodeConnCount) {
              showGeneratedToken.value = false;
            }
          }
          if (activeNodeId.value !== null && !nodes.value.find((n: any) => n.id === activeNodeId.value)) {
            activeNodeId.value = null;
          }
          break;
        }
        case 'instance_status': {
          if (activeNodeId.value === msg.nodeId) {
            runningStates[msg.instanceId] = msg.running ? 'running' : false;
            if (!msg.running) {
              delete stopRequested[msg.instanceId];
            }
          }
          break;
        }
        case 'instances_refresh': {
          if (activeNodeId.value === msg.nodeId) {
            loadInstances();
            // 新建/编辑实例不改运行状态，无需 pollStatus
          }
          break;
        }
      }
    }

    // ── 初始化 ──
    // authState 初始为 'loading'，无需在此处调用 loadNodes()
    // checkAuth() 在认证通过后会自动加载节点列表
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
    const showLangDialog = ref(false);
    const localeCodes = ['zh-CN', 'zh-TW', 'lzh', 'en'] as const;
    const { messages } = useI18n();

    function openLangDialog(): void {
      showLangDialog.value = true;
    }

    function closeLangDialog(): void {
      showLangDialog.value = false;
    }

    function setLang(code: string): void {
      document.cookie = `YPanelLang=${encodeURIComponent(code)}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
      locale.value = code as 'zh-CN' | 'zh-TW' | 'lzh' | 'en';
      showLangDialog.value = false;
    }

    // ── 通知弹窗 ──
    interface NotificationItem {
      id: number;
      message: string;
      type: 'success' | 'error';
    }
    const notifications = reactive<NotificationItem[]>([]);
    let notifyId = 0;

    let pendingNodeConnCount = 0;
    function showNotification(message: string, type: 'success' | 'error'): void {
      const id = ++notifyId;
      notifications.push({ id, message, type });
      setTimeout(() => {
        const idx = notifications.findIndex(n => n.id === id);
        if (idx !== -1) notifications.splice(idx, 1);
      }, 5000);
    }

    function dismissNotification(id: number): void {
      const idx = notifications.findIndex(n => n.id === id);
      if (idx !== -1) notifications.splice(idx, 1);
    }

function dblclickNode(node: any): void {
      if (node.connected) {
        switchToNode(node.id);
      } else {
        showNotification(t('notification.node_offline'), 'error');
      }
    }

    function clickSwitchNode(node: any): void {
      if (node.connected) {
        switchToNode(node.id);
      } else {
        showNotification(t('notification.node_offline'), 'error');
      }
    }
    function cycleLocale(): void {
      // 按钮点击 → 打开语言选择对话框
      openLangDialog();
    }

    function openHelp(): void {
      window.open('https://github.com/cygbs/YPanel/wiki', '_blank', 'noopener,noreferrer');
    }

    // 切换语言时更新已存在的标签页标题
    watch(locale, () => {
      for (const tab of tabs) {
        if (tab.type === 'home') {
          tab.title = t('tab.home');
        } else if (tab.type === 'terminal' && !tab.instanceId && tab.id !== 0) {
          tab.title = t('tab.terminal', { id: tab.id });
        }
      }
    });

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
      nodes, activeNodeId, activeNode,
      showNodeDialog, newNodeName, generatingNode,
      generatedToken, generatedNodeName, showGeneratedToken, locationHost, wsHost,
      nodeError,
      selectedNodeId, selectedNodeForMenu, selectNode,
      openNodeDialog, closeNodeDialog, generateNodeToken, copyToken,
      showEditNodeDialog, editNodeData, savingNode,
      openEditNode, closeEditNode, saveEditNode,
      switchToNode, leaveNode,
      showNodeDeleteConfirm, pendingDeleteNodeId,
      openNodeDelete, cancelNodeDelete, confirmNodeDelete,
      cycleLocale, showLangDialog, localeCodes, locale, messages,
      openLangDialog, closeLangDialog, setLang, openHelp,
      // 实例管理
      instances, selectedInstance, selectedId, selectInstance,
      runningStates, stopRequested, showNewDialog, isEditing, isEditingLocked,
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
      // 通知弹窗
      notifications, showNotification, dismissNotification, dblclickNode, clickSwitchNode,
    };
  },
});
</script>

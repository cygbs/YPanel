<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div class="fm-container">
    <!-- 工具栏 -->
    <div class="fm-toolbar">
      <div class="fm-breadcrumb">
        <input ref="addrInput" v-model="addrPath" type="text" class="input fm-addr-input"
          @keyup.enter="navigateTo" @focus="onAddrFocus" />
      </div>
      <div class="fm-actions">
        <button class="fm-btn-sm" @click="showMkdir" :disabled="loading">{{ $t('fm.mkdir') }}</button>
        <button class="fm-btn-sm" @click="triggerUpload" :disabled="loading">{{ $t('fm.upload') }}</button>
        <button class="fm-btn-sm" @click="refresh" :disabled="loading">{{ $t('fm.refresh') }}</button>
      </div>
    </div>

    <!-- 新文件夹输入 -->
    <div v-if="mkdirVisible" class="fm-mkdir-row">
      <input ref="mkdirInput" v-model="mkdirName" type="text" class="input fm-mkdir-input"
        :placeholder="$t('fm.mkdir_placeholder')"
        @keyup.enter="doMkdir" @keyup.escape="mkdirVisible = false" />
      <button class="btn btn-primary btn-sm" @click="doMkdir" :disabled="!mkdirName.trim()">{{ $t('save') }}</button>
      <button class="btn btn-secondary btn-sm" @click="mkdirVisible = false">{{ $t('cancel') }}</button>
    </div>

    <!-- 重命名行 -->
    <div v-if="renameTarget" class="fm-mkdir-row">
      <input ref="renameInput" v-model="renameName" type="text" class="input fm-mkdir-input"
        :placeholder="$t('fm.rename_placeholder')"
        @keyup.enter="doRename" @keyup.escape="renameTarget = null" />
      <button class="btn btn-primary btn-sm" @click="doRename" :disabled="!renameName.trim()">{{ $t('save') }}</button>
      <button class="btn btn-secondary btn-sm" @click="renameTarget = null">{{ $t('cancel') }}</button>
    </div>

    <!-- 隐藏的 file input 用于上传 -->
    <input ref="fileInput" type="file" class="upload-input-hidden" @change="onFilePicked" />

    <!-- 文件列表 -->
    <div class="fm-list-wrap">
      <table class="fm-table" v-if="files.length > 0 || !loading">
        <thead>
          <tr>
            <th class="fm-col-name">{{ $t('fm.name') }}</th>
            <th class="fm-col-size">{{ $t('fm.size') }}</th>
            <th class="fm-col-modified">{{ $t('fm.modified') }}</th>
            <th class="fm-col-act"></th>
          </tr>
        </thead>
        <tbody>
          <!-- ".." 返回上级 -->
          <tr v-if="currentPath !== '/' && !loading" class="fm-row-up"
            @dblclick="goUp">
            <td class="fm-cell-name" colspan="1">..</td>
            <td class="fm-cell-num">-</td>
            <td class="fm-cell-num">-</td>
            <td class="fm-cell-act"></td>
          </tr>
          <!-- 文件列表 -->
          <tr v-for="f in files" :key="f.name"
            :class="{ 'fm-row-dir': f.type === 'dir', 'fm-row-selected': selectedName === f.name }"
            @click="selectedName = f.name" @dblclick="enterItem(f)">
            <td class="fm-cell-name">{{ f.type === 'dir' ? '📁' : '📄' }} {{ f.name }}</td>
            <td class="fm-cell-num">{{ f.type === 'dir' ? '-' : formatSize(f.size) }}</td>
            <td class="fm-cell-num">{{ formatDate(f.modified) }}</td>
            <td class="fm-cell-act">
              <button class="fm-act-btn" @click.stop="startEdit(f)">{{ $t('fm.edit') }}</button>
              <template v-if="f.type === 'file'">
                <button class="fm-act-btn" @click.stop="downloadFile(f)">{{ $t('fm.download') }}</button>
              </template>
              <button class="fm-act-btn fm-act-del" @click.stop="confirmDelete(f)">{{ $t('fm.delete') }}</button>
              <button class="fm-act-btn" @click.stop="startRename(f)">{{ $t('fm.rename') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="files.length === 0 && !loading" class="fm-empty">{{ $t('fm.empty') }}</div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="fm-loading">{{ $t('loading') }}</div>

    <!-- 错误 -->
    <div v-if="error" class="fm-error">{{ error }}</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, nextTick, inject, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

interface FileEntry {
  name: string;
  type: 'dir' | 'file';
  size: number;
  modified: number;
}

export default defineComponent({
  props: {
    tabId: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
    nodeId: { type: Number as () => number | null, default: null },
    initPath: { type: String, default: '' },
  },
  setup(props) {
    const { t } = useI18n();
    const apiPrefix = inject<() => string>('apiPrefix')!;
    const apiFetch = inject<(url: string, options?: RequestInit) => Promise<Response>>('apiFetch')!;
    const showNotification = inject<(message: string, type: 'success' | 'error') => void>('showNotification')!;
    const addTerminalTab = inject<(title?: string, initCommands?: string[], instanceId?: number, nodeId?: number) => void>('addTerminalTab')!;

    const currentPath = ref('');
    const addrPath = ref('');
    const addrInput = ref<HTMLInputElement | null>(null);
    const files = ref<FileEntry[]>([]);
    const selectedName = ref('');
    const loading = ref(false);
    const error = ref('');

    // 新文件夹
    const mkdirVisible = ref(false);
    const mkdirName = ref('');
    const mkdirInput = ref<HTMLInputElement | null>(null);

    // 重命名
    const renameTarget = ref<FileEntry | null>(null);
    const renameName = ref('');
    const renameInput = ref<HTMLInputElement | null>(null);

    // 上传
    const fileInput = ref<HTMLInputElement | null>(null);

    const initialLoad = ref(false);
    const nodeIdStr = ref('');

    function buildApi(path: string): string {
      const prefix = apiPrefix();
      if (!prefix) throw new Error('no node selected');
      return prefix + path;
    }

    async function listDir(p: string): Promise<void> {
      loading.value = true;
      error.value = '';
      try {
        const url = buildApi('/files') + '?path=' + encodeURIComponent(p);
        const res = await apiFetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'unknown' }));
          error.value = data.error || `HTTP ${res.status}`;
          files.value = [];
          return;
        }
        const data = await res.json();
        currentPath.value = data.path;
        addrPath.value = data.path;
        files.value = data.files || [];
        selectedName.value = '';
      } catch (e: any) {
        error.value = e.message || 'network error';
        files.value = [];
      } finally {
        loading.value = false;
        initialLoad.value = true;
      }
    }

    // 监听 nodeId 变化：加载家目录
    watch(() => props.nodeId, (nid) => {
      if (nid !== null && nid !== undefined) {
        nodeIdStr.value = String(nid);
        listDir(props.initPath || '/');
      }
    }, { immediate: true });

    // 当标签页激活时重新触发
    watch(() => props.isActive, (active) => {
      if (active && props.nodeId !== null && !initialLoad.value) {
        listDir(props.initPath || '/');
      }
    });

    function enterItem(f: FileEntry): void {
      if (f.type === 'dir') {
        const newPath = currentPath.value.replace(/\/$/, '') + '/' + f.name;
        listDir(newPath);
      }
    }

    function goUp(): void {
      if (currentPath.value === '/') return;
      const parent = currentPath.value.replace(/\/$/, '').replace(/\/[^/]+$/, '') || '/';
      listDir(parent);
    }

    function navigateTo(): void {
      const p = addrPath.value.trim() || '/';
      if (p !== currentPath.value) listDir(p);
    }

    function onAddrFocus(): void {
      // 全选方便用户直接输入新路径
      nextTick(() => addrInput.value?.select());
    }

    function refresh(): void { listDir(currentPath.value || '/'); }

    // ── 新文件夹 ──
    function showMkdir(): void {
      mkdirVisible.value = true;
      mkdirName.value = '';
      nextTick(() => mkdirInput.value?.focus());
    }
    async function doMkdir(): Promise<void> {
      const name = mkdirName.value.trim();
      if (!name) return;
      try {
        const res = await apiFetch(buildApi('/files/mkdir'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: currentPath.value, name }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({ error: 'failed' })); showNotification(d.error || t('fm.mkdir_failed'), 'error'); return; }
        mkdirVisible.value = false;
        mkdirName.value = '';
        refresh();
      } catch { showNotification(t('network_error'), 'error'); }
    }

    // ── 重命名 ──
    function startRename(f: FileEntry): void {
      renameTarget.value = f;
      renameName.value = f.name;
      nextTick(() => renameInput.value?.focus());
    }
    async function doRename(): Promise<void> {
      const f = renameTarget.value;
      if (!f) return;
      const newName = renameName.value.trim();
      if (!newName || newName === f.name) { renameTarget.value = null; return; }
      const fullPath = currentPath.value.replace(/\/$/, '') + '/' + f.name;
      try {
        const res = await apiFetch(buildApi('/files/rename'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath, newName }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({ error: 'failed' })); showNotification(d.error || t('fm.rename_failed'), 'error'); return; }
        renameTarget.value = null;
        refresh();
      } catch { showNotification(t('network_error'), 'error'); }
    }

    // ── 删除 ──
    function confirmDelete(f: FileEntry): void {
      const fullPath = currentPath.value.replace(/\/$/, '') + '/' + f.name;
      const label = f.type === 'dir' ? t('fm.delete_dir_confirm', { name: f.name }) : t('fm.delete_file_confirm', { name: f.name });
      if (!confirm(label)) return;
      doDelete(fullPath);
    }
    async function doDelete(fullPath: string): Promise<void> {
      try {
        const res = await apiFetch(buildApi('/files/delete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({ error: 'failed' })); showNotification(d.error || t('fm.delete_failed'), 'error'); return; }
        refresh();
      } catch { showNotification(t('network_error'), 'error'); }
    }

    // ── 编辑 ──
    async function startEdit(f: FileEntry): Promise<void> {
      const fullPath = currentPath.value.replace(/\/$/, '') + '/' + f.name;
      try {
        const prefix = apiPrefix();
        if (!prefix) return;
        const res = await apiFetch(prefix + '/settings');
        let editor = 'vi';
        if (res.ok) {
          const data = await res.json();
          editor = data.textEditor || 'vi';
        }
        addTerminalTab(t('fm.edit_title', { name: f.name }), [editor + ' ' + JSON.stringify(fullPath).slice(1, -1) + '; exit'], undefined, props.nodeId ?? undefined);
      } catch {
        addTerminalTab(t('fm.edit_title', { name: f.name }), ['vi ' + JSON.stringify(fullPath).slice(1, -1) + '; exit'], undefined, props.nodeId ?? undefined);
      }
    }

    // ── 下载 ──
    async function downloadFile(f: FileEntry): Promise<void> {
      const fullPath = currentPath.value.replace(/\/$/, '') + '/' + f.name;
      try {
        const url = buildApi('/files/download') + '?path=' + encodeURIComponent(fullPath);
        const res = await apiFetch(url);
        if (!res.ok) { showNotification(t('fm.download_failed'), 'error'); return; }
        const data = await res.json();
        const bytes = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: data.mime || 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = data.name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch { showNotification(t('fm.download_failed'), 'error'); }
    }

    // ── 上传 ──
    function triggerUpload(): void { fileInput.value?.click(); }
    async function onFilePicked(e: Event): Promise<void> {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      input.value = '';

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/upload?nodeId=${props.nodeId}`);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'upload_start', fileName: file.name,
          uploadPath: currentPath.value, fileSize: file.size,
        }));
      };

      const CHUNK_SIZE = 64 * 1024;
      ws.onmessage = async (event) => {
        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.type === 'upload_ack' && msg.status === 'ready') {
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          for (let i = 0; i < totalChunks; i++) {
            if (ws.readyState !== WebSocket.OPEN) break;
            const start = i * CHUNK_SIZE, end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            const buffer = await chunk.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
            ws.send(JSON.stringify({ type: 'upload_chunk', data: btoa(binary), index: i, total: totalChunks, final: i === totalChunks - 1 }));
          }
        } else if (msg.type === 'upload_complete') {
          showNotification(t('fm.upload_complete'), 'success');
          ws.close();
          refresh();
        } else if (msg.type === 'upload_error') {
          showNotification(msg.message || t('fm.upload_failed'), 'error');
          ws.close();
        }
      };
      ws.onerror = () => { showNotification(t('fm.upload_failed'), 'error'); };
    }

    function formatSize(bytes: number): string {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }

    function formatDate(ts: number): string {
      if (!ts) return '-';
      const d = new Date(ts * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    return {
      currentPath, addrPath, addrInput, files, selectedName, loading, error,
      mkdirVisible, mkdirName, mkdirInput, doMkdir, showMkdir,
      renameTarget, renameName, renameInput, startRename, doRename,
      fileInput, triggerUpload, onFilePicked,
      enterItem, goUp, navigateTo, onAddrFocus, refresh,
      confirmDelete, downloadFile, startEdit, formatSize, formatDate,
    };
  },
});
</script>

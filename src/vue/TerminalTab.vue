<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div ref="terminalRef" class="terminal-view"></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, watch, inject, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default defineComponent({
  props: {
    tabId: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
    initCommands: { type: Array as PropType<string[]>, default: () => [] },
    instanceId: { type: Number, default: null },
    nodeId: { type: Number, default: null },
  },
  setup(props, { expose }) {
    const { t } = useI18n();
    const closeTab = inject<(id: number) => void>('closeTab')!;
    const terminalRef = ref<HTMLElement | null>(null);
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let ws: WebSocket | null = null;
    let intentionalClose = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isComposing = false;
    const MAX_RECONNECT = 10;

    // 写队列（回调式流控）
    let writeQueue = '';
    let writeBusy = false;

    function flushWrite(): void {
      if (!terminal || writeBusy || writeQueue.length === 0) return;
      writeBusy = true;
      const chunk = writeQueue;
      writeQueue = '';
      terminal.write(chunk, () => {
        writeBusy = false;
        flushWrite();
      });
    }

    function enqueueWrite(data: string): void {
      writeQueue += data;
      if (!writeBusy) flushWrite();
    }

    // ── WebSocket 连接（含自动重连） ──
    function connectWs(): void {
      if (!terminal) return;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams();
      if (props.instanceId !== null && props.instanceId !== undefined) {
        params.set('instanceId', String(props.instanceId));
      }
      if (props.nodeId !== null && props.nodeId !== undefined) {
        params.set('nodeId', String(props.nodeId));
      }
      const wsPath = params.toString() ? `/ws?${params.toString()}` : '';
      const wsUrl = wsPath ? `${protocol}//${location.host}${wsPath}` : null;
      if (!wsUrl) {
        terminal.write(t('terminal.unavailable') + '\r\n');
        return;
      }
      ws = new WebSocket(wsUrl);

      ws.addEventListener('open', () => {
        reconnectAttempts = 0;
        terminal?.focus();
        fitAddon?.fit();
        ws?.send(JSON.stringify({ type: 'resize', cols: terminal?.cols, rows: terminal?.rows }));
        if (props.instanceId === null) {
          const cmds = props.initCommands;
          if (cmds && cmds.length > 0) {
            setTimeout(() => {
              for (const cmd of cmds) {
                if (ws?.readyState === WebSocket.OPEN) ws.send(cmd + '\n');
              }
            }, 200);
          }
        }
      });

      ws.addEventListener('message', (event: MessageEvent<string>) => {
        try {
          const json = JSON.parse(event.data);
          if (json.type === 'instance_stopped') {
            terminal?.write('\r\n\x1b[31m' + t('terminal.instance_stopped') + '\x1b[0m\r\n');
            intentionalClose = true;
            setTimeout(() => ws?.close(), 3000);
            return;
          }
        } catch { /* 不是 JSON，当作普通终端输出 */ }
        enqueueWrite(event.data);
      });

      ws.addEventListener('close', () => {
        if (intentionalClose) return;
        // 一次性终端（如文件编辑）：不重连，直接关闭标签页
        const isOneShot = props.instanceId === null && props.initCommands.length > 0;
        if (isOneShot) {
          closeTab(props.tabId);
          return;
        }
        if (reconnectAttempts < MAX_RECONNECT) {
          // 前 3 次 1s 间隔快速重连，之后 2s 固定间隔
          const delay = reconnectAttempts < 3 ? 1000 : 2000;
          reconnectAttempts++;
          reconnectTimer = setTimeout(connectWs, delay);
        } else {
          terminal?.write('\r\n\x1b[31m' + t('terminal.connection_closed') + '\x1b[0m\r\n');
        }
      });

      ws.addEventListener('error', () => {
        // error 后必跟 close，重连逻辑在 close 中处理
      });
    }

    onMounted(() => {
      const el = terminalRef.value;
      if (!el) return;

      const isDark = document.documentElement.classList.contains('dark');
      const theme = isDark ? {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#ffffff',
        selectionBackground: '#2d2d5e',
        black: '#262641',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#44446a',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#7b93c4',
        brightMagenta: '#ff92d0',
        brightCyan: '#a4f0ff',
        brightWhite: '#ffffff',
      } : {
        background: '#fafafa',
        foreground: '#303133',
        cursor: '#303133',
        selectionBackground: '#c6e2ff',
        black: '#303133',
        red: '#e74c3c',
        green: '#27ae60',
        yellow: '#d4a017',
        blue: '#3498db',
        magenta: '#9b59b6',
        cyan: '#1abc9c',
        white: '#ecf0f1',
        brightBlack: '#606266',
        brightRed: '#c0392b',
        brightGreen: '#2ecc71',
        brightYellow: '#f1c40f',
        brightBlue: '#2980b9',
        brightMagenta: '#8e44ad',
        brightCyan: '#16a085',
        brightWhite: '#ffffff',
      };

      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 14,
        fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
        scrollback: 50000,
        theme,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(el);

      requestAnimationFrame(() => {
        fitAddon?.fit();
      });

      // IME
      const textarea = el.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
      textarea?.addEventListener('compositionstart', () => { isComposing = true; });
      textarea?.addEventListener('compositionend', () => { isComposing = false; });

      // WebSocket 连接（含自动重连）
      connectWs();

      terminal.onData((data: string) => {
        if (ws?.readyState === WebSocket.OPEN && !isComposing) {
          ws.send(data);
        }
      });

      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });

      window.addEventListener('resize', onResize);
    });

    // 暴露方法供父组件调用
    expose({
      sendText(text: string) {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(text);
        }
      },
    });

    function onResize(): void {
      if (props.isActive) {
        fitAddon?.fit();
      }
    }

    // 当标签页被切到可见时重新 fit
    watch(() => props.isActive, (active) => {
      if (active) {
        requestAnimationFrame(() => fitAddon?.fit());
      }
    });

    onUnmounted(() => {
      intentionalClose = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      window.removeEventListener('resize', onResize);
      ws?.close();
      ws = null;
      terminal?.dispose();
      terminal = null;
      fitAddon = null;
    });

    return { terminalRef };
  },
});
</script>

<template>
  <div ref="terminalRef" class="terminal-view"></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, watch, type PropType } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default defineComponent({
  props: {
    tabId: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
    initCommands: { type: Array as PropType<string[]>, default: () => [] },
    instanceId: { type: Number, default: null },
    nodeId: { type: Number, default: null },
  },
  setup(props, { expose }) {
    const terminalRef = ref<HTMLElement | null>(null);
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let ws: WebSocket | null = null;

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

    onMounted(() => {
      const el = terminalRef.value;
      if (!el) return;

      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 14,
        fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
        scrollback: 50000,
        theme: {
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
        },
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(el);

      requestAnimationFrame(() => {
        fitAddon?.fit();
      });

      // ── WebSocket ──
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

      // 构建 WS URL：通过 Hub 代理到节点的终端
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
        terminal.write('Terminal unavailable (no node specified).\r\n');
        return;
      }

      // 认证：HttpOnly Cookie 由浏览器自动发送
      ws = new WebSocket(wsUrl);

      // IME
      let isComposing = false;
      const textarea = el.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
      textarea?.addEventListener('compositionstart', () => { isComposing = true; });
      textarea?.addEventListener('compositionend', () => { isComposing = false; });

      ws.addEventListener('open', () => {
        terminal?.focus();
        fitAddon?.fit();
        // 同步真实终端尺寸到服务端
        ws?.send(JSON.stringify({
          type: 'resize',
          cols: terminal?.cols,
          rows: terminal?.rows,
        }));
        // 执行初始化命令（仅普通终端）
        if (props.instanceId === null) {
          const cmds = props.initCommands;
          if (cmds && cmds.length > 0) {
            setTimeout(() => {
              for (const cmd of cmds) {
                ws?.send(cmd + '\n');
              }
            }, 200);
          }
        }
      });

      ws.addEventListener('message', (event: MessageEvent<string>) => {
        enqueueWrite(event.data);
      });

      ws.addEventListener('close', () => {
        terminal?.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
      });

      ws.addEventListener('error', () => {
        terminal?.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n');
      });

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

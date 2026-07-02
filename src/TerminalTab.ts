import { defineComponent, ref, onMounted, onUnmounted, watch, type PropType } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default defineComponent({
  props: {
    tabId: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
  },
  setup(props) {
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
      ws = new WebSocket(`${protocol}//${location.host}`);

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

    function onResize(): void {
      // 只对可见的终端执行 fit
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
  template: '<div ref="terminalRef" class="terminal-view"></div>',
});

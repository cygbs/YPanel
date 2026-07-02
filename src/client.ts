import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// ── 终端初始化 ──
const terminal = new Terminal({
  cursorBlink: true,
  cursorStyle: 'block',
  fontSize: 14,
  fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
  scrollback: 50000,
  allowProposedApi: true,
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

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

const terminalContainer = document.getElementById('terminal');
if (!terminalContainer) {
  throw new Error('Could not find terminal container element');
}

terminal.open(terminalContainer);

// 首次 fit 延迟一帧
requestAnimationFrame(() => {
  fitAddon.fit();
});

// ── IME 输入法合成 ──
let isComposing = false;

const textarea =
  terminalContainer.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');

textarea?.addEventListener('compositionstart', () => {
  isComposing = true;
});

textarea?.addEventListener('compositionend', () => {
  isComposing = false;
});

// ── WebSocket ──
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${location.host}`);

let writeQueue = '';
let writeBusy = false;

function flushWrite(): void {
  if (writeBusy || writeQueue.length === 0) return;
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
  if (!writeBusy) {
    flushWrite();
  }
}

ws.addEventListener('open', () => {
  terminal.focus();
  fitAddon.fit();
  // 修复：连接建立后立即同步真实终端尺寸给 PTY
  ws.send(JSON.stringify({
    type: 'resize',
    cols: terminal.cols,
    rows: terminal.rows,
  }));
});

ws.addEventListener('message', (event: MessageEvent<string>) => {
  enqueueWrite(event.data);
});

ws.addEventListener('close', () => {
  terminal.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
});

ws.addEventListener('error', () => {
  terminal.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n');
});

terminal.onData((data: string) => {
  if (ws.readyState === WebSocket.OPEN && !isComposing) {
    ws.send(data);
  }
});

terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resize', cols, rows }));
  }
});

// ── 窗口自适应 ──
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fitAddon.fit();
  }, 100);
});

/**
 * YPanel Node — 节点守护进程
 *
 * 职责：
 * - 管理本地的 Minecraft 服务器实例（进程生命周期）
 * - 通过 /link WebSocket 隧道处理来自 Hub 的 API 请求、终端和文件上传
 * - Node 不暴露 HTTP 端口，所有通信通过一条 WebSocket 连接进行
 *
 * 用法：
 *   tsx src/node.ts -s ws://hub:6699/link -t <token>
 */

import { WebSocket } from 'ws';
import { spawn, type IPty } from 'zigpty';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── CLI 参数 ──
const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (process.argv[i].startsWith('-')) {
    args[process.argv[i].slice(1)] = process.argv[i + 1];
  }
}
const HUB_URL = args.s || args.S || '';
const TOKEN = args.t || args.T || '';

if (!HUB_URL || !TOKEN) {
  console.error('Usage: node index.js -s <hub-ws-url> -t <token>');
  console.error('Example: node index.js -s ws://192.168.1.100:6699/link -t <token>');
  process.exit(1);
}

// ── 路径解析 ──
const ROOT_DIR = process.argv[1]?.endsWith('.ts')
  ? path.resolve(__dirname, '..')
  : __dirname;

const DATA_DIR = path.join(ROOT_DIR, 'data');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readInstances(): { instances: any[] } {
  ensureDataDir();
  if (!fs.existsSync(INSTANCES_FILE)) return { instances: [] };
  try { return JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf-8')); }
  catch { return { instances: [] }; }
}

function writeInstances(data: { instances: any[] }): void {
  ensureDataDir();
  fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readSettings(): { defaultShell: string } {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) return { defaultShell: '' };
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); }
  catch { return { defaultShell: '' }; }
}

function writeSettings(s: any): void {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

function getDefaultShell(): string | undefined {
  return readSettings().defaultShell || undefined;
}

/** 创建 PTY shell 进程 */
function spawnShell(cwd: string): IPty {
  return spawn(getDefaultShell(), [], {
    name: 'xterm-color', cols: 80, rows: 24,
    cwd,
    env: { ...process.env } as { [key: string]: string },
  });
}

/** 注册受控进程：绑定 onData / onExit / outputBuffer */
function registerProcess(
  pty: IPty,
  instanceId: number,
  wsTermIds: Set<string> = new Set()
): ManagedProcess {
  const entry: ManagedProcess = {
    pty, outputBuffer: [], wsTermIds,
    resizeCols: 80, resizeRows: 24,
  };
  pty.onData((data: string | Buffer) => {
    const str = ptyDataToStr(data);
    entry.outputBuffer.push(str);
    if (entry.outputBuffer.length > 2000) entry.outputBuffer.shift();
    for (const tid of entry.wsTermIds) {
      sendToHub({ type: 'terminal_data', termId: tid, data: str });
    }
  });
  pty.onExit(() => { managedProcesses.delete(instanceId); });
  managedProcesses.set(instanceId, entry);
  return entry;
}

// ── 进程管理器 ──
interface ManagedProcess {
  pty: IPty;
  outputBuffer: string[];
  wsTermIds: Set<string>;   // 当前连接到该进程的 termId 集合
  resizeCols: number;
  resizeRows: number;
}

const managedProcesses = new Map<number, ManagedProcess>();

function getInstanceById(id: number): any {
  return readInstances().instances.find((i: any) => i.id === id) || null;
}

/** 将 PTY 输出的 data 转为字符串 */
function ptyDataToStr(data: string | Buffer): string {
  return typeof data === 'string' ? data : data.toString('utf-8');
}

// ═══════════════════════════════════════════════════
// /link WebSocket 消息处理
// ═══════════════════════════════════════════════════
//
// 节点通过 /link 连接到 Hub，接收以下消息类型：
//   api_request     → 处理 REST API 调用并回复 api_response
//   terminal_open   → 创建或连接到终端进程
//   terminal_data   → 将数据写入进程 PTY
//   terminal_resize → 调整 PTY 尺寸
//   terminal_close  → 断开并清理终端
//   upload_start    → 开始文件上传
//   upload_chunk    → 写入上传文件数据块
//   upload_cancel   → 取消上传

// ── 终端映射：termId → 对应的 instanceId ──
const termToProcess = new Map<string, { instanceId: number }>();

// ── 文件上传状态 ──
interface UploadState {
  fileName: string;
  filePath: string;
  stream: fs.WriteStream;
  received: number;
  total: number;
}
const uploadStates = new Map<string, UploadState>();

/** 向 Hub 发送一条消息 */
let sendToHub: (msg: any) => void = () => {};

// ═══════════════════════════════════════════════════
// API 路由分发
// ═══════════════════════════════════════════════════

interface ApiRequest {
  requestId: string;
  method: string;
  path: string;
  body?: any;
}

function handleApiRequest(ws: WebSocket, req: ApiRequest): void {
  const respond = (status: number, data: any) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'api_response',
      requestId: req.requestId,
      status,
      data,
      error: status >= 400 ? (data.error || String(data)) : undefined,
    }));
  };

  const respondError = (status: number, error: string) => {
    respond(status, { error });
  };

  const parts = req.path.split('/').filter(Boolean);

  try {
    // ── /api/instances ──
    if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'instances') {
      if (req.method === 'GET') {
        respond(200, readInstances());
      } else if (req.method === 'POST') {
        const { name, uuid, icon, command, folder, stopCommand, autoStart } = req.body || {};
        if (!name || !uuid) { respondError(400, 'name and uuid are required'); return; }
        const data = readInstances();
        const nextId = data.instances.length;
        const instance = {
          id: nextId, name, uuid,
          icon: icon || 'grass.svg', command: command || '',
          folder: folder || '', stopCommand: stopCommand || '^C',
          autoStart: !!autoStart, createdAt: new Date().toISOString(),
        };
        data.instances.push(instance);
        writeInstances(data);
        respond(201, instance);
      } else {
        respondError(405, 'Method not allowed');
      }
      return;
    }

    // ── /api/instances/:id ──
    if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'instances') {
      const id = parseInt(parts[2], 10);
      if (isNaN(id)) { respondError(400, 'invalid id'); return; }

      if (req.method === 'PUT') {
        const data = readInstances();
        const idx = data.instances.findIndex((i: any) => i.id === id);
        if (idx === -1) { respondError(404, 'not found'); return; }
        const existing = data.instances[idx];
        const { name, icon, command, folder, stopCommand, autoStart } = req.body || {};
        if (name !== undefined) existing.name = name;
        if (icon !== undefined) existing.icon = icon;
        if (command !== undefined && !managedProcesses.has(id)) existing.command = command;
        if (folder !== undefined && !managedProcesses.has(id)) existing.folder = folder;
        if (stopCommand !== undefined) existing.stopCommand = stopCommand;
        if (autoStart !== undefined) existing.autoStart = !!autoStart;
        writeInstances(data);
        respond(200, existing);

      } else if (req.method === 'DELETE') {
        const mp = managedProcesses.get(id);
        if (mp) { mp.pty.kill(); managedProcesses.delete(id); }
        const data = readInstances();
        const idx = data.instances.findIndex((i: any) => i.id === id);
        if (idx === -1) { respondError(404, 'not found'); return; }
        data.instances.splice(idx, 1);
        writeInstances(data);
        respond(200, { ok: true });

      } else {
        respondError(405, 'Method not allowed');
      }
      return;
    }

    // ── /api/instances/:id/start ──
    if (parts.length === 4 && parts[0] === 'api' && parts[1] === 'instances' && parts[3] === 'start') {
      const id = parseInt(parts[2], 10);
      if (isNaN(id)) { respondError(400, 'invalid id'); return; }
      if (managedProcesses.has(id)) {
        respond(200, { status: 'already_running', instanceId: id });
        return;
      }
      const inst = getInstanceById(id);
      if (!inst) { respondError(404, 'not found'); return; }

      let pty: IPty;
      try {
        pty = spawn(getDefaultShell(), [], {
          name: 'xterm-color', cols: 80, rows: 24,
          cwd: inst.folder || os.homedir(),
          env: { ...process.env } as { [key: string]: string },
        });
      } catch (e: any) {
        respondError(500, `spawn failed: ${e.message}`);
        return;
      }

      const entry: ManagedProcess = {
        pty, outputBuffer: [], wsTermIds: new Set(),
        resizeCols: 80, resizeRows: 24,
      };

      pty.onData((data: string | Buffer) => {
        const str = ptyDataToStr(data);
        entry.outputBuffer.push(str);
        if (entry.outputBuffer.length > 2000) entry.outputBuffer.shift();
        for (const termId of entry.wsTermIds) {
          sendToHub({ type: 'terminal_data', termId, data: str });
        }
      });

      pty.onExit(() => {
        managedProcesses.delete(id);
      });

      managedProcesses.set(id, entry);
      pty.write(`cd "${inst.folder}"\r`);
      pty.write(`${inst.command}\r`);
      respond(200, { status: 'started', instanceId: id });
      return;
    }

    // ── /api/instances/:id/stop ──
    if (parts.length === 4 && parts[0] === 'api' && parts[1] === 'instances' && parts[3] === 'stop') {
      const id = parseInt(parts[2], 10);
      if (isNaN(id)) { respondError(400, 'invalid id'); return; }
      const mp = managedProcesses.get(id);
      if (!mp) { respond(200, { status: 'not_running' }); return; }
      const inst = getInstanceById(id);
      const stopCmd = inst?.stopCommand || '^C';
      if (stopCmd === '^C') {
        mp.pty.write('\x03');
      } else {
        mp.pty.write(stopCmd + '\r');
      }
      setTimeout(() => {
        const mp2 = managedProcesses.get(id);
        if (mp2) { mp2.pty.kill(); managedProcesses.delete(id); }
      }, 3000);
      respond(200, { status: 'stop_sent' });
      return;
    }

    // ── /api/instances/:id/status ──
    if (parts.length === 4 && parts[0] === 'api' && parts[1] === 'instances' && parts[3] === 'status') {
      const id = parseInt(parts[2], 10);
      if (isNaN(id)) { respondError(400, 'invalid id'); return; }
      respond(200, { running: managedProcesses.has(id) });
      return;
    }

    // ── /api/settings ──
    if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'settings') {
      if (req.method === 'GET') {
        respond(200, readSettings());
      } else if (req.method === 'PUT') {
        const { defaultShell } = req.body || {};
        const s = readSettings();
        if (defaultShell !== undefined) s.defaultShell = defaultShell;
        writeSettings(s);
        respond(200, s);
      } else {
        respondError(405, 'Method not allowed');
      }
      return;
    }

    respondError(404, `Not found: ${req.method} ${req.path}`);
  } catch (e: any) {
    respondError(500, e.message);
  }
}

// ═══════════════════════════════════════════════════
// 终端处理
// ═══════════════════════════════════════════════════

function handleTerminalOpen(ws: WebSocket, msg: any): void {
  const { termId, instanceId } = msg;

  if (instanceId !== null && instanceId !== undefined && managedProcesses.has(instanceId)) {
    // ── 连接到已运行的进程 ──
    const mp = managedProcesses.get(instanceId)!;
    mp.wsTermIds.add(termId);
    termToProcess.set(termId, { instanceId });

    const buf = mp.outputBuffer.slice(-200);
    for (const data of buf) {
      sendToHub({ type: 'terminal_data', termId, data });
    }
    console.log(`[tunnel] terminal: termId=${termId} attached to running #${instanceId}`);
    return;
  }

  // ── 新进程 ──
  const inst = (instanceId !== null && instanceId !== undefined) ? getInstanceById(instanceId) : null;
  const cwd = inst?.folder || os.homedir();

  let pty: IPty;
  try {
    pty = spawnShell(cwd);
  } catch (e: any) {
    sendToHub({ type: 'terminal_data', termId, data: `Failed to spawn shell: ${e.message}\r\n` });
    sendToHub({ type: 'terminal_closed', termId });
    return;
  }

  if (instanceId !== null && instanceId !== undefined) {
    // ── 有关联实例 ──
    registerProcess(pty, instanceId, new Set([termId]));
    termToProcess.set(termId, { instanceId });
    if (inst?.folder) pty.write(`cd "${inst.folder}"\r`);
    if (inst?.command) pty.write(`${inst.command}\r`);
    console.log(`[tunnel] terminal: termId=${termId} spawned shell for #${instanceId} in ${cwd}`);
  } else {
    // ── 普通终端（无实例关联） ──
    const unmanagedId = -Date.now();
    registerProcess(pty, unmanagedId, new Set([termId]));
    termToProcess.set(termId, { instanceId: unmanagedId });
    if (msg.initCommands) {
      for (const cmd of msg.initCommands) {
        pty.write(cmd + '\r');
      }
    }
    console.log(`[tunnel] terminal: termId=${termId} spawned generic shell in ${cwd}`);
  }
}

function handleTerminalData(msg: any): void {
  const { termId, data } = msg;
  const tp = termToProcess.get(termId);
  if (!tp) return;

  const mp = managedProcesses.get(tp.instanceId);
  if (!mp) { termToProcess.delete(termId); return; }
  mp.pty.write(data);
}

function handleTerminalResize(msg: any): void {
  const { termId, cols, rows } = msg;
  const tp = termToProcess.get(termId);
  if (!tp) return;

  const mp = managedProcesses.get(tp.instanceId);
  if (!mp) { termToProcess.delete(termId); return; }
  mp.resizeCols = cols;
  mp.resizeRows = rows;
  mp.pty.resize(cols, rows);
}

function handleTerminalClose(msg: any): void {
  const { termId } = msg;
  const tp = termToProcess.get(termId);
  if (!tp) return;

  const mp = managedProcesses.get(tp.instanceId);
  if (mp) {
    mp.wsTermIds.delete(termId);
    // 普通终端（ID 为负）断开即杀进程
    if (tp.instanceId < 0) {
      mp.pty.kill();
      managedProcesses.delete(tp.instanceId);
    }
  }
  termToProcess.delete(termId);
}

// ═══════════════════════════════════════════════════
// 文件上传处理
// ═══════════════════════════════════════════════════

function handleUploadStart(msg: any): void {
  const { uploadSessionId, fileName, uploadPath, fileSize } = msg;
  if (!uploadSessionId) return;

  if (uploadStates.has(uploadSessionId)) {
    sendToHub({ type: 'upload_error', uploadSessionId, message: '已有上传任务进行中' });
    return;
  }

  const safeFileName = path.basename(fileName || '');
  if (!safeFileName) {
    sendToHub({ type: 'upload_error', uploadSessionId, message: '文件名无效' });
    return;
  }

  const userPath = (uploadPath || '').trim();
  if (userPath.includes('..')) {
    sendToHub({ type: 'upload_error', uploadSessionId, message: '上传路径不能包含 ..' });
    return;
  }
  const baseDir = userPath
    ? path.resolve(userPath.replace(/^~/, os.homedir()))
    : os.homedir();

  const filePath = path.join(baseDir, safeFileName);

  console.log(`[upload] start: ${filePath} (${fileSize || '?'} bytes) session=${uploadSessionId}`);

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const stream = fs.createWriteStream(filePath);

    uploadStates.set(uploadSessionId, {
      fileName: safeFileName,
      filePath,
      stream,
      received: 0,
      total: fileSize || 0,
    });

    sendToHub({ type: 'upload_ack', uploadSessionId, status: 'ready', filePath });
  } catch (e: any) {
    sendToHub({ type: 'upload_error', uploadSessionId, message: `无法创建文件: ${e.message}` });
  }
}

function handleUploadChunk(msg: any): void {
  const { uploadSessionId, data, index, total, final } = msg;
  const state = uploadStates.get(uploadSessionId);
  if (!state) {
    sendToHub({ type: 'upload_error', uploadSessionId, message: '未开始上传' });
    return;
  }

  try {
    const chunk = Buffer.from(data || '', 'base64');
    state.stream.write(chunk);
    state.received += chunk.length;

    if (index === total - 1 || final) {
      state.stream.end();
      uploadStates.delete(uploadSessionId);
      console.log(`[upload] complete: ${state.filePath} (${state.received} bytes)`);
      sendToHub({
        type: 'upload_complete', uploadSessionId,
        fileName: state.fileName, path: state.filePath, size: state.received,
      });
    } else {
      sendToHub({
        type: 'upload_progress', uploadSessionId,
        received: state.received, total: state.total,
      });
    }
  } catch (e: any) {
    sendToHub({ type: 'upload_error', uploadSessionId, message: `写入失败: ${e.message}` });
  }
}

function handleUploadCancel(msg: any): void {
  const { uploadSessionId } = msg;
  const state = uploadStates.get(uploadSessionId);
  if (state) {
    try { state.stream.end(); } catch { /* ignore */ }
    uploadStates.delete(uploadSessionId);
    console.log(`[upload] cancelled: ${state.filePath}`);
  }
}

// ═══════════════════════════════════════════════════
// 断连清理
// ═══════════════════════════════════════════════════

/** 断连清理：只清理终端/上传等临时状态，保留已运行的实例进程 */
function cleanupTransientState(): void {
  termToProcess.clear();
  for (const [, state] of uploadStates) {
    try { state.stream.end(); } catch { /* ignore */ }
  }
  uploadStates.clear();
}

// ═══════════════════════════════════════════════════
// 自动启动
// ═══════════════════════════════════════════════════

function autoStartInstances(): void {
  const data = readInstances();
  const started: { instanceId: number }[] = [];
  for (const inst of data.instances) {
    if (inst.autoStart && !managedProcesses.has(inst.id)) {
      try {
        const pty = spawnShell(inst.folder || os.homedir());
        registerProcess(pty, inst.id);
        pty.write(`cd "${inst.folder}"\r`);
        pty.write(`${inst.command}\r`);
        console.log(`  auto-start: #${inst.id} ${inst.name}`);
        started.push({ instanceId: inst.id });
      } catch { /* skip failed spawn */ }
    }
  }
  // auto-start 完成后再上报，确保 sendToHub 已就绪
  if (started.length > 0) {
    setTimeout(() => sendToHub({ type: 'node_status', instances: started }), 1000);
  }
}

// ═══════════════════════════════════════════════════
// Hub 连接（唯一对外连接）
// ═══════════════════════════════════════════════════

function connectToHub(): void {
  console.log(`Connecting to hub: ${HUB_URL}`);
  const ws = new WebSocket(HUB_URL);

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'register',
      token: TOKEN,
    }));
  });

  ws.on('message', (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'registered':
        console.log(`Registered with hub as node #${msg.nodeId}`);
        // 上报当前正在运行的实例
        const runningInstances: { instanceId: number }[] = [];
        for (const [id] of managedProcesses) {
          if (id >= 0) runningInstances.push({ instanceId: id });
        }
        if (runningInstances.length > 0) {
          sendToHub({ type: 'node_status', instances: runningInstances });
        }
        break;
      case 'error':
        console.error(`Hub error: ${msg.message}`);
        break;
      case 'api_request':
        handleApiRequest(ws, msg);
        break;
      case 'terminal_open':
        handleTerminalOpen(ws, msg);
        break;
      case 'terminal_data':
        handleTerminalData(msg);
        break;
      case 'terminal_resize':
        handleTerminalResize(msg);
        break;
      case 'terminal_close':
        handleTerminalClose(msg);
        break;
      case 'upload_start':
        handleUploadStart(msg);
        break;
      case 'upload_chunk':
        handleUploadChunk(msg);
        break;
      case 'upload_cancel':
        handleUploadCancel(msg);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Disconnected from hub, reconnecting in 5s...');
    cleanupTransientState();
    setTimeout(connectToHub, 5000);
  });

  ws.on('error', (err) => {
    console.error('Hub connection error:', err.message);
  });

  sendToHub = (msg: any) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };
}

// ═══════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════

console.log('YPanel Node starting (tunnel mode, no HTTP port)');
autoStartInstances();
connectToHub();

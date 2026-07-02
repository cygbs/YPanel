/**
 * YPanel Node — 节点守护进程
 *
 * 职责：
 * - 管理本地的 Minecraft 服务器实例（进程生命周期）
 * - 提供 REST API 供 Hub 代理调用
 * - 提供 WebSocket 终端连接
 * - 通过 /link 连接到 Hub 注册
 *
 * 用法：
 *   tsx src/node.ts -s ws://hub:6699/link -t <token> [-p 6701]
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, IPty } from 'node-pty';
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
const NODE_PORT = parseInt(args.p || args.P || '6701', 10);

if (!HUB_URL || !TOKEN) {
  console.error('Usage: node index.js -s <hub-ws-url> -t <token> [-p <port>]');
  console.error('Example: node index.js -s ws://192.168.1.100:6699/link -t <token>');
  process.exit(1);
}

// ── 路径解析 ──
const IS_DIST = __dirname.endsWith('dist') || __dirname.endsWith('dist/');
const ROOT_DIR = IS_DIST ? __dirname : path.resolve(__dirname, '..');

// ── 数据存储（节点本地） ──
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
  if (!fs.existsSync(SETTINGS_FILE)) return { defaultShell: '/usr/bin/bash' };
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); }
  catch { return { defaultShell: '/usr/bin/bash' }; }
}

function writeSettings(s: any): void {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

function getDefaultShell(): string {
  return readSettings().defaultShell || '/usr/bin/bash';
}

// ── 进程管理器 ──
interface ManagedProcess {
  pty: IPty;
  outputBuffer: string[];
  ws: WebSocket | null;
  resizeCols: number;
  resizeRows: number;
}

const managedProcesses = new Map<number, ManagedProcess>();

function getInstanceById(id: number): any {
  return readInstances().instances.find((i: any) => i.id === id) || null;
}

// ── Express + WebSocket ──
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, clientTracking: false });

app.use(express.json());

// ═══════════════════════════════════════════════════
// REST API: 实例管理
// ═══════════════════════════════════════════════════

/** 获取所有实例 */
app.get('/api/instances', (_req, res) => {
  res.json(readInstances());
});

/** 创建新实例 */
app.post('/api/instances', (req, res) => {
  const { name, uuid, icon, command, folder, stopCommand, autoStart } = req.body;
  if (!name || !uuid) { res.status(400).json({ error: 'name and uuid are required' }); return; }
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
  res.status(201).json(instance);
});

/** 更新实例 */
app.put('/api/instances/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const data = readInstances();
  const idx = data.instances.findIndex((i: any) => i.id === id);
  if (idx === -1) { res.status(404).json({ error: 'not found' }); return; }
  const existing = data.instances[idx];
  const { name, icon, command, folder, stopCommand, autoStart } = req.body;
  if (name !== undefined) existing.name = name;
  if (icon !== undefined) existing.icon = icon;
  // 运行中的实例禁止修改 command 和 folder
  if (command !== undefined && !managedProcesses.has(id)) existing.command = command;
  if (folder !== undefined && !managedProcesses.has(id)) existing.folder = folder;
  if (stopCommand !== undefined) existing.stopCommand = stopCommand;
  if (autoStart !== undefined) existing.autoStart = !!autoStart;
  writeInstances(data);
  res.json(existing);
});

/** 删除实例 */
app.delete('/api/instances/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const mp = managedProcesses.get(id);
  if (mp) { mp.pty.kill(); managedProcesses.delete(id); }
  const data = readInstances();
  const idx = data.instances.findIndex((i: any) => i.id === id);
  if (idx === -1) { res.status(404).json({ error: 'not found' }); return; }
  data.instances.splice(idx, 1);
  writeInstances(data);
  res.json({ ok: true });
});

/** 启动实例进程（持久运行） */
app.post('/api/instances/:id/start', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  if (managedProcesses.has(id)) {
    res.json({ status: 'already_running', instanceId: id });
    return;
  }
  const inst = getInstanceById(id);
  if (!inst) { res.status(404).json({ error: 'not found' }); return; }

  const pty = spawn(getDefaultShell(), [], {
    name: 'xterm-color', cols: 80, rows: 24,
    cwd: inst.folder || os.homedir(),
    env: { ...process.env } as { [key: string]: string },
  });

  const entry: ManagedProcess = {
    pty, outputBuffer: [], ws: null,
    resizeCols: 80, resizeRows: 24,
  };

  pty.onData((data: string) => {
    entry.outputBuffer.push(data);
    if (entry.outputBuffer.length > 2000) entry.outputBuffer.shift();
    if (entry.ws && entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.send(data);
    }
  });

  pty.onExit(() => {
    managedProcesses.delete(id);
  });

  managedProcesses.set(id, entry);

  pty.write(`cd "${inst.folder}"\n`);
  pty.write(`${inst.command}\n`);

  res.json({ status: 'started', instanceId: id });
});

/** 停止实例进程 */
app.post('/api/instances/:id/stop', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const mp = managedProcesses.get(id);
  if (!mp) { res.json({ status: 'not_running' }); return; }
  const inst = getInstanceById(id);
  const stopCmd = inst?.stopCommand || '^C';
  if (stopCmd === '^C') {
    mp.pty.write('\x03');
  } else {
    mp.pty.write(stopCmd + '\n');
  }
  // 3 秒后强制终止
  setTimeout(() => {
    const mp2 = managedProcesses.get(id);
    if (mp2) { mp2.pty.kill(); managedProcesses.delete(id); }
  }, 3000);
  res.json({ status: 'stop_sent' });
});

/** 查询实例运行状态 */
app.get('/api/instances/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  res.json({ running: managedProcesses.has(id) });
});

// ── 设置 API ──

app.get('/api/settings', (_req, res) => res.json(readSettings()));
app.put('/api/settings', (req, res) => {
  const { defaultShell } = req.body;
  const s = readSettings();
  if (defaultShell !== undefined) s.defaultShell = defaultShell;
  writeSettings(s);
  res.json(s);
});

// ═══════════════════════════════════════════════════
// WebSocket: 终端连接
// ═══════════════════════════════════════════════════

wss.on('connection', (ws: WebSocket, req) => {
  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const instanceIdStr = parsed.searchParams.get('instanceId');
  const instanceId = instanceIdStr ? parseInt(instanceIdStr, 10) : null;

  if (instanceId !== null && !isNaN(instanceId)) {
    // ── 连接到已存在的实例进程 ──
    const mp = managedProcesses.get(instanceId);
    if (!mp) {
      ws.send('Instance process not running.\r\n');
      ws.close();
      return;
    }

    mp.ws = ws;

    // 发送缓冲区中的最近输出（最多 200 条）
    const buf = mp.outputBuffer.slice(-200);
    for (const data of buf) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }

    ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const msg = raw.toString();
      try {
        const json = JSON.parse(msg);
        if (json.type === 'resize') {
          mp.resizeCols = json.cols;
          mp.resizeRows = json.rows;
          mp.pty.resize(json.cols, json.rows);
          return;
        }
      } catch { /* not JSON */ }
      mp.pty.write(msg);
    });

    ws.on('close', () => { mp.ws = null; });
    ws.on('error', () => { mp.ws = null; });
  } else {
    // ── 普通终端（每次新建 shell） ──
    const shell: IPty = spawn(getDefaultShell(), [], {
      name: 'xterm-color', cols: 80, rows: 24,
      cwd: os.homedir(),
      env: { ...process.env } as { [key: string]: string },
    });

    shell.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const msg = raw.toString();
      try {
        const json = JSON.parse(msg);
        if (json.type === 'resize') { shell.resize(json.cols, json.rows); return; }
      } catch { /* not JSON */ }
      shell.write(msg);
    });

    ws.on('close', () => { shell.kill(); });
    ws.on('error', () => { shell.kill(); });
  }
});

// ═══════════════════════════════════════════════════
// Hub 连接
// ═══════════════════════════════════════════════════

function connectToHub(): void {
  console.log(`Connecting to hub: ${HUB_URL}`);
  const ws = new WebSocket(HUB_URL);

  ws.on('open', () => {
    // 自动检测本机 IP：取连接 Hub 时使用的网卡地址
    const localAddr = (ws as any)._socket?.localAddress || '127.0.0.1';
    ws.send(JSON.stringify({
      type: 'register',
      token: TOKEN,
      address: localAddr,
      port: NODE_PORT,
    }));
  });

  ws.on('message', (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'registered') {
      console.log(`Registered with hub as node #${msg.nodeId}`);
    } else if (msg.type === 'error') {
      console.error(`Hub error: ${msg.message}`);
    }
  });

  ws.on('close', () => {
    console.log('Disconnected from hub, reconnecting in 5s...');
    setTimeout(connectToHub, 5000);
  });

  ws.on('error', (err) => {
    console.error('Hub connection error:', err.message);
  });
}

// ═══════════════════════════════════════════════════
// 自动启动
// ═══════════════════════════════════════════════════

function autoStartInstances(): void {
  const data = readInstances();
  const shellCmd = getDefaultShell();
  for (const inst of data.instances) {
    if (inst.autoStart && !managedProcesses.has(inst.id)) {
      const pty = spawn(shellCmd, [], {
        name: 'xterm-color', cols: 80, rows: 24,
        cwd: inst.folder || os.homedir(),
        env: { ...process.env } as { [key: string]: string },
      });

      const entry: ManagedProcess = {
        pty, outputBuffer: [], ws: null,
        resizeCols: 80, resizeRows: 24,
      };

      pty.onData((data: string) => {
        entry.outputBuffer.push(data);
        if (entry.outputBuffer.length > 2000) entry.outputBuffer.shift();
        if (entry.ws && entry.ws.readyState === WebSocket.OPEN) {
          entry.ws.send(data);
        }
      });

      pty.onExit(() => {
        managedProcesses.delete(inst.id);
      });

      managedProcesses.set(inst.id, entry);
      pty.write(`cd "${inst.folder}"\n`);
      pty.write(`${inst.command}\n`);
      console.log(`  auto-start: #${inst.id} ${inst.name}`);
    }
  }
}

// ═══════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════

server.listen(NODE_PORT, () => {
  console.log(`YPanel Node running on http://localhost:${NODE_PORT}`);
  autoStartInstances();
  connectToHub();
});

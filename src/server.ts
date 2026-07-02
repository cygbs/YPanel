import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, IPty } from 'node-pty';
import path from 'path';
import fs from 'fs';
import os from 'os';


const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, clientTracking: false });

app.use(express.json());

// ── 路径解析（兼容 tsx 开发模式与 dist 构建模式） ──
// tsx 开发模式脚本为 .ts, 构建产物为 .js
// .ts → 取父级（项目根目录），.js → 取脚本所在目录
const ROOT_DIR = process.argv[1]?.endsWith('.ts')
  ? path.resolve(__dirname, '..')
  : __dirname;

app.use(express.static(path.join(ROOT_DIR, 'public')));

// ── 实例数据存储 ──
const DATA_DIR = path.join(ROOT_DIR, 'data');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readInstances(): { instances: any[] } {
  ensureDataDir();
  if (!fs.existsSync(INSTANCES_FILE)) { return { instances: [] }; }
  try { return JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf-8')); }
  catch { return { instances: [] }; }
}

function writeInstances(data: { instances: any[] }): void {
  ensureDataDir();
  fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ── 进程管理器：实例终端在浏览器断开后继续运行 ──
interface ManagedProcess {
  pty: IPty;
  outputBuffer: string[];
  ws: WebSocket | null;
  resizeCols: number;
  resizeRows: number;
}

const managedProcesses = new Map<number, ManagedProcess>();

function getInstanceById(id: number): any {
  const data = readInstances();
  return data.instances.find((i: any) => i.id === id) || null;
}

// GET /api/instances — 获取所有实例
app.get('/api/instances', (_req, res) => {
  res.json(readInstances());
});

// POST /api/instances — 新建实例
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

// DELETE /api/instances/:id — 删除实例
app.delete('/api/instances/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  // 停止并清理进程
  const mp = managedProcesses.get(id);
  if (mp) { mp.pty.kill(); managedProcesses.delete(id); }
  const data = readInstances();
  const idx = data.instances.findIndex((i: any) => i.id === id);
  if (idx === -1) { res.status(404).json({ error: 'instance not found' }); return; }
  data.instances.splice(idx, 1);
  writeInstances(data);
  res.json({ ok: true });
});

// PUT /api/instances/:id — 更新实例
app.put('/api/instances/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const data = readInstances();
  const idx = data.instances.findIndex((i: any) => i.id === id);
  if (idx === -1) { res.status(404).json({ error: 'instance not found' }); return; }
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

// POST /api/instances/:id/start — 启动实例进程（持久运行）
app.post('/api/instances/:id/start', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  if (managedProcesses.has(id)) {
    res.json({ status: 'already_running', instanceId: id });
    return;
  }
  const inst = getInstanceById(id);
  if (!inst) { res.status(404).json({ error: 'instance not found' }); return; }

  const pty = spawn(getDefaultShell(), [], {
    name: 'xterm-color', cols: 80, rows: 24,
    cwd: inst.folder || os.homedir(),
    env: { ...process.env } as { [key: string]: string },
  });

  const entry: ManagedProcess = {
    pty,
    outputBuffer: [],
    ws: null,
    resizeCols: 80,
    resizeRows: 24,
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

  // 执行启动命令：cd 到目录 + 启动命令
  pty.write(`cd "${inst.folder}"\n`);
  pty.write(`${inst.command}\n`);

  res.json({ status: 'started', instanceId: id });
});

// POST /api/instances/:id/stop — 停止实例进程
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
  // 如果 3 秒后进程还在，强制终止
  setTimeout(() => {
    const mp2 = managedProcesses.get(id);
    if (mp2) {
      mp2.pty.kill();
      managedProcesses.delete(id);
    }
  }, 3000);
  res.json({ status: 'stop_sent' });
});

// GET /api/instances/:id/status — 查询实例运行状态
app.get('/api/instances/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  res.json({ running: managedProcesses.has(id) });
});

// ── WebSocket ──
// 普通终端（无 instanceId）
// 实例终端（?instanceId=X）
wss.on('connection', (ws: WebSocket, req) => {
  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const instanceId = parsed.searchParams.get('instanceId')
    ? parseInt(parsed.searchParams.get('instanceId')!, 10)
    : null;

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

    // 客户端连接后会自行发送 resize 消息，无需服务端推送

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

    ws.on('close', () => {
      mp.ws = null; // 不断开进程
    });

    ws.on('error', () => {
      mp.ws = null;
    });
  } else {
    // ── 普通终端（每次新建 bash） ──
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

const PORT = parseInt(process.env.PORT || '6699', 10);
// ── 设置存储 ──
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function getDefaultShell(): string {
  return readSettings().defaultShell || '/usr/bin/bash';
}

function readSettings(): { defaultShell: string } {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) { return { defaultShell: '/usr/bin/bash' }; }
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); }
  catch { return { defaultShell: '/usr/bin/bash' }; }
}

function writeSettings(settings: { defaultShell: string }): void {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/settings — 获取设置
app.get('/api/settings', (_req, res) => {
  res.json(readSettings());
});

// PUT /api/settings — 更新设置
app.put('/api/settings', (req, res) => {
  const { defaultShell } = req.body;
  const settings = readSettings();
  if (defaultShell !== undefined) settings.defaultShell = defaultShell;
  writeSettings(settings);
  res.json(settings);
});

// ── 自动启动标记了 autoStart 的实例 ──
function autoStartInstances(): void {
  const data = readInstances();
  for (const inst of data.instances) {
    if (inst.autoStart && !managedProcesses.has(inst.id)) {
      const pty = spawn(getDefaultShell(), [], {
        name: 'xterm-color', cols: 80, rows: 24,
        cwd: inst.folder || os.homedir(),
        env: { ...process.env } as { [key: string]: string },
      });

      const entry: ManagedProcess = {
        pty,
        outputBuffer: [],
        ws: null,
        resizeCols: 80,
        resizeRows: 24,
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

server.listen(PORT, () => {
  console.log(`YPanel running on http://localhost:${PORT}`);
  autoStartInstances();
});

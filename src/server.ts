import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, IPty } from 'node-pty';
import path from 'path';
import fs from 'fs';
import os from 'os';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── 实例数据存储 ──
const DATA_DIR = path.join(__dirname, '..', 'data');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readInstances(): { instances: any[] } {
  ensureDataDir();
  if (!fs.existsSync(INSTANCES_FILE)) {
    return { instances: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf-8'));
  } catch {
    return { instances: [] };
  }
}

function writeInstances(data: { instances: any[] }): void {
  ensureDataDir();
  fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/instances — 获取所有实例
app.get('/api/instances', (_req, res) => {
  const data = readInstances();
  res.json(data);
});

// POST /api/instances — 新建实例
app.post('/api/instances', (req, res) => {
  const { name, uuid, icon, command, folder, stopCommand, autoStart } = req.body;
  if (!name || !uuid) {
    res.status(400).json({ error: 'name and uuid are required' });
    return;
  }
  const data = readInstances();
  const nextId = data.instances.length;
  const instance = {
    id: nextId,
    name,
    uuid,
    icon: icon || 'grass.svg',
    command: command || '',
    folder: folder || '',
    stopCommand: stopCommand || '^C',
    autoStart: !!autoStart,
    createdAt: new Date().toISOString(),
  };
  data.instances.push(instance);
  writeInstances(data);
  res.status(201).json(instance);
});

// DELETE /api/instances/:id — 删除实例
app.delete('/api/instances/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  const data = readInstances();
  const idx = data.instances.findIndex((i: any) => i.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'instance not found' });
    return;
  }
  data.instances.splice(idx, 1);
  writeInstances(data);
  res.json({ ok: true });
});

// ── WebSocket 终端 ──
wss.on('connection', (ws: WebSocket) => {
  const shell: IPty = spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: { ...process.env } as { [key: string]: string },
  });

  shell.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
    const msg = raw.toString();
    try {
      const json = JSON.parse(msg);
      if (json.type === 'resize') {
        shell.resize(json.cols, json.rows);
        return;
      }
    } catch {
      // not JSON -> regular terminal input
    }
    shell.write(msg);
  });

  ws.on('close', () => {
    shell.kill();
  });

  ws.on('error', () => {
    shell.kill();
  });
});

const PORT = parseInt(process.env.PORT || '6699', 10);
server.listen(PORT, () => {
  console.log(`YPanel running on http://localhost:${PORT}`);
});

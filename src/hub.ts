/**
 * YPanel Hub — 中央面板服务器
 *
 * 职责：
 * - 提供网页面板界面
 * - 管理节点（注册、列表、删除）
 * - 代理 HTTP 请求到节点上的 API
 * - 代理 WebSocket 终端到节点
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, clientTracking: false });

app.use(express.json());

// ── 路径解析（兼容 tsx 开发模式与 dist 构建模式） ──
const IS_DIST = __dirname.endsWith('dist') || __dirname.endsWith('dist/');
const ROOT_DIR = IS_DIST ? __dirname : path.resolve(__dirname, '..');
app.use(express.static(path.join(ROOT_DIR, 'public')));

// ── 数据存储 ──
const DATA_DIR = path.join(ROOT_DIR, 'data');
const NODES_FILE = path.join(DATA_DIR, 'nodes.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface NodeEntry {
  id: number;
  name: string;
  token: string;
  address: string;
  port: number;
  connected: boolean;
  lastSeen: string;
}

interface PendingToken {
  token: string;
  name: string;
  createdAt: string;
}

interface NodesData {
  nodes: NodeEntry[];
  pendingTokens: PendingToken[];
}

function readNodes(): NodesData {
  ensureDataDir();
  if (!fs.existsSync(NODES_FILE)) return { nodes: [], pendingTokens: [] };
  try { return JSON.parse(fs.readFileSync(NODES_FILE, 'utf-8')); }
  catch { return { nodes: [], pendingTokens: [] }; }
}

function writeNodes(data: NodesData): void {
  ensureDataDir();
  fs.writeFileSync(NODES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** 获取已连接的节点信息 */
function getConnectedNode(nodeId: number): { address: string; port: number } | null {
  const data = readNodes();
  const node = data.nodes.find(n => n.id === nodeId);
  if (!node || !node.connected) return null;
  return { address: node.address, port: node.port };
}

/** 跟踪每个节点当前的 WebSocket 连接（用于 /link） */
const nodeConnections = new Map<number, WebSocket>();

// ═══════════════════════════════════════════════════
// API: 节点管理
// ═══════════════════════════════════════════════════

/** 获取节点列表（含 pendingTokens） */
app.get('/api/nodes', (_req, res) => {
  res.json(readNodes());
});

/** 生成待验证 Token（新增节点第一步） */
app.post('/api/nodes', (req, res) => {
  const { name } = req.body;
  const data = readNodes();
  const token = crypto.randomUUID();
  const nodeName = name || `节点 ${data.nodes.length + data.pendingTokens.length + 1}`;
  data.pendingTokens.push({ token, name: nodeName, createdAt: new Date().toISOString() });
  writeNodes(data);
  res.json({ token, nodeName });
});

/** 删除节点 */
app.delete('/api/nodes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const data = readNodes();
  const idx = data.nodes.findIndex((n: any) => n.id === id);
  if (idx === -1) { res.status(404).json({ error: 'not found' }); return; }
  data.nodes.splice(idx, 1);
  writeNodes(data);
  // 断开节点连接
  const ws = nodeConnections.get(id);
  if (ws) { ws.close(); nodeConnections.delete(id); }
  res.json({ ok: true });
});

/** 删除 pendingToken */
app.delete('/api/nodes/pending/:token', (req, res) => {
  const data = readNodes();
  const idx = data.pendingTokens.findIndex(p => p.token === req.params.token);
  if (idx === -1) { res.status(404).json({ error: 'token not found' }); return; }
  data.pendingTokens.splice(idx, 1);
  writeNodes(data);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// 代理: 将节点相关的 API 请求转发到节点
// ═══════════════════════════════════════════════════

/** 通用的代理处理函数 */
async function proxyToNode(nodeId: number, req: express.Request, res: express.Response): Promise<void> {
  const node = getConnectedNode(nodeId);
  if (!node) {
    res.status(404).json({ error: 'node not found or offline' });
    return;
  }

  // 替换路径: /api/node/:nodeId/xxx → /api/xxx
  const targetPath = req.originalUrl.replace(/^\/api\/node\/\d+/, '/api');
  const targetUrl = `http://${node.address}:${node.port}${targetPath}`;

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
      fetchOptions.body = JSON.stringify(req.body);
    }
    const resp = await fetch(targetUrl, fetchOptions);
    const ct = resp.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await resp.json() : await resp.text();
    res.status(resp.status).json(data);
  } catch (e: any) {
    res.status(502).json({ error: `proxy error: ${e.message}` });
  }
}

// ── 实例管理（代理到节点） ──

/** 获取节点上的实例列表 */
app.get('/api/node/:nodeId/instances', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

/** 在节点上创建实例 */
app.post('/api/node/:nodeId/instances', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

/** 更新节点上的实例 */
app.put('/api/node/:nodeId/instances/:instanceId', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

/** 删除节点上的实例 */
app.delete('/api/node/:nodeId/instances/:instanceId', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

/** 启动节点上的实例 */
app.post('/api/node/:nodeId/instances/:instanceId/start', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

/** 停止节点上的实例 */
app.post('/api/node/:nodeId/instances/:instanceId/stop', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

/** 查询节点上实例的状态 */
app.get('/api/node/:nodeId/instances/:instanceId/status', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

// ── 设置（代理到节点） ──

app.get('/api/node/:nodeId/settings', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

app.put('/api/node/:nodeId/settings', (req, res) =>
  proxyToNode(parseInt(req.params.nodeId), req, res));

// ═══════════════════════════════════════════════════
// /link WebSocket: 节点接入
// ═══════════════════════════════════════════════════
//
// 节点连接后发送: { type: "register", token, address, port }
// Hub 验证 token 后回复: { type: "registered", nodeId }
// 或: { type: "error", message }

function handleLinkConnection(ws: WebSocket): void {
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  ws.on('message', (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'register') {
      const data = readNodes();
      const pIdx = data.pendingTokens.findIndex((p: any) => p.token === msg.token);
      const existing = data.nodes.find((n: any) => n.token === msg.token);

      if (pIdx !== -1 || existing) {
        const nodeName = pIdx !== -1
          ? data.pendingTokens[pIdx].name
          : existing!.name;

        if (pIdx !== -1) {
          data.pendingTokens.splice(pIdx, 1); // 消耗 pending token
        }

        const now = new Date().toISOString();
        let nodeId: number;

        if (existing) {
          nodeId = existing.id;
          existing.address = msg.address;
          existing.port = msg.port || 6701;
          existing.connected = true;
          existing.lastSeen = now;
        } else {
          nodeId = data.nodes.length;
          data.nodes.push({
            id: nodeId,
            name: nodeName,
            token: msg.token,
            address: msg.address,
            port: msg.port || 6701,
            connected: true,
            lastSeen: now,
          });
        }

        writeNodes(data);

        // 记录连接
        nodeConnections.set(nodeId, ws);

        ws.send(JSON.stringify({ type: 'registered', nodeId }));

        // 心跳保活
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 30000);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid token' }));
        setTimeout(() => ws.close(), 1000);
      }
    }
  });

  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    // 标记所有关联的节点为离线
    const data = readNodes();
    let changed = false;
    for (const [nodeId, conn] of nodeConnections) {
      if (conn === ws) {
        const node = data.nodes.find(n => n.id === nodeId);
        if (node) {
          node.connected = false;
          changed = true;
        }
        nodeConnections.delete(nodeId);
        break; // 一个 WS 只对应一个节点
      }
    }
    if (changed) writeNodes(data);
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

// ═══════════════════════════════════════════════════
// WebSocket: 终端代理 + 节点接入
// ═══════════════════════════════════════════════════

wss.on('connection', (ws: WebSocket, req) => {
  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  // /link 路径 → 节点接入
  if (parsed.pathname === '/link') {
    handleLinkConnection(ws);
    return;
  }

  // /ws 路径 → 终端代理
  const nodeIdStr = parsed.searchParams.get('nodeId');
  const instanceIdStr = parsed.searchParams.get('instanceId');
  const nodeId = nodeIdStr ? parseInt(nodeIdStr, 10) : null;
  const instanceId = instanceIdStr ? parseInt(instanceIdStr, 10) : null;

  if (nodeId === null || isNaN(nodeId)) {
    ws.send('Please specify nodeId (e.g. /ws?nodeId=0)\r\n');
    ws.close();
    return;
  }

  const node = getConnectedNode(nodeId);
  if (!node) {
    ws.send('Node not found or offline.\r\n');
    ws.close();
    return;
  }

  // 构建 node 的 WS URL
  // 有 instanceId → 连接到实例终端；无 instanceId → 连接到节点的普通 Shell
  const nodeQuery = new URLSearchParams();
  if (instanceId !== null && !isNaN(instanceId)) {
    nodeQuery.set('instanceId', String(instanceId));
  }
  const nodeWsUrl = `ws://${node.address}:${node.port}/ws${nodeQuery.toString() ? '?' + nodeQuery.toString() : ''}`;
  console.log(`[proxy] WS: hub → node #${nodeId} ${nodeWsUrl}`);

  // ws 库的消息默认是 Buffer（即使是文本帧），必须转成 string
  function bufToStr(data: any): string {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf-8');
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
    return String(data);
  }

  const nodeWs = new WebSocket(nodeWsUrl);
  let nodeOpen = false;
  let buffer: string[] = [];

  nodeWs.on('open', () => {
    nodeOpen = true;
    for (const msg of buffer) {
      if (nodeWs.readyState === WebSocket.OPEN) nodeWs.send(msg);
    }
    buffer = [];
  });

  nodeWs.on('message', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(bufToStr(data));
    }
  });

  nodeWs.on('close', () => { ws.close(); });
  nodeWs.on('error', () => { ws.close(); });

  ws.on('message', (raw) => {
    const text = bufToStr(raw);
    if (nodeOpen && nodeWs.readyState === WebSocket.OPEN) {
      nodeWs.send(text);
    } else if (!nodeOpen) {
      buffer.push(text);
    }
  });

  ws.on('close', () => {
    if (nodeWs.readyState === WebSocket.OPEN) nodeWs.close();
  });

  ws.on('error', () => {
    if (nodeWs.readyState === WebSocket.OPEN) nodeWs.close();
  });
});

// ── 处理 /link 路径 → 将非 WS 请求返回 400 ──
app.get('/link', (_req, res) => res.status(400).json({ error: 'WebSocket only' }));
app.post('/link', (_req, res) => res.status(400).json({ error: 'WebSocket only' }));

// ═══════════════════════════════════════════════════
// Hub 设置
// ═══════════════════════════════════════════════════

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readHubSettings(): { listenPort: number } {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) return { listenPort: 6699 };
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); }
  catch { return { listenPort: 6699 }; }
}

app.get('/api/settings', (_req, res) => res.json(readHubSettings()));
app.put('/api/settings', (req, res) => {
  const { listenPort } = req.body;
  const s = readHubSettings();
  if (listenPort !== undefined) s.listenPort = listenPort;
  writeSettings(s);
  res.json(s);
});

function writeSettings(s: any): void {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

// ═══════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════

const PORT = parseInt(process.env.PORT || '6699', 10);
server.listen(PORT, () => {
  console.log(`YPanel Hub running on http://localhost:${PORT}`);
  console.log(`  Node link: ws://localhost:${PORT}/link`);
});

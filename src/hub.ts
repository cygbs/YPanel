/**
 * YPanel Hub — 中央面板服务器
 *
 * 职责：
 * - 提供网页面板界面（需登录）
 * - 管理节点（注册、列表、删除）
 * - 代理 HTTP 请求到节点上的 API
 * - 代理 WebSocket 终端到节点
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, clientTracking: false });

app.use(express.json());

// ── 路径解析（兼容 tsx 开发模式与 dist 构建模式） ──
const ROOT_DIR = process.argv[1]?.endsWith('.ts')
  ? path.resolve(__dirname, '..')
  : __dirname;
app.use(express.static(path.join(ROOT_DIR, 'public')));

// ── 数据存储 ──
const DATA_DIR = path.join(ROOT_DIR, 'data');
const NODES_FILE = path.join(DATA_DIR, 'nodes.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════
// 认证系统
// ═══════════════════════════════════════════════════

interface AuthData {
  username: string;
  hash: string;            // SHA-256 哈希
  defaultPassword: boolean; // 是否仍为默认密码
}

/** SHA-256 哈希 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/** 生成随机密码 */
function randomPassword(len = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pwd = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd;
}

function readAuth(): AuthData | null {
  ensureDataDir();
  if (!fs.existsSync(AUTH_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')); }
  catch { return null; }
}

function writeAuth(data: AuthData): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** 首次运行：生成随机密码 */
function initAuth(): { username: string; password: string } {
  const password = randomPassword();
  writeAuth({
    username: 'admin',
    hash: hashPassword(password),
    defaultPassword: true,
  });
  return { username: 'admin', password };
}

// ── Session Token 管理 ──
const sessions = new Map<string, boolean>(); // token → authenticated

function createToken(): string {
  const token = crypto.randomUUID();
  sessions.set(token, true);
  return token;
}

// ── 初始化认证（首次运行时生成） ──
let firstRunCreds: { username: string; password: string } | null = null;
let authData = readAuth();
if (!authData) {
  firstRunCreds = initAuth();
  authData = readAuth();
  console.log('');
  console.log(`Random password: ${firstRunCreds!.password}`);
  console.log('Please change the password after login.');
  console.log('');
}

// ═══════════════════════════════════════════════════
// API: 认证
// ═══════════════════════════════════════════════════

/** 登录（仅需密码，用户名固定为 admin） */
app.post('/api/auth/login', (req, res) => {
  const auth = readAuth();
  if (!auth) { res.status(500).json({ error: 'auth not initialized' }); return; }
  const { password } = req.body;
  if (!password || !auth.hash || hashPassword(password) !== auth.hash) {
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }
  const token = createToken();
  res.json({ token, defaultPassword: auth.defaultPassword });
});

/** 验证 token 状态 */
app.post('/api/auth/check', (req, res) => {
  const { token } = req.body;
  if (token && sessions.has(token)) {
    const auth = readAuth();
    res.json({ valid: true, defaultPassword: auth?.defaultPassword ?? false });
  } else {
    res.json({ valid: false });
  }
});

/** 修改密码（需携带有效 token） */
app.post('/api/auth/change-password', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !sessions.has(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const auth = readAuth();
  if (!auth) { res.status(500).json({ error: 'auth not initialized' }); return; }
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length === 0) {
    res.status(400).json({ error: 'new password is required' });
    return;
  }
  auth.hash = hashPassword(newPassword);
  auth.defaultPassword = false;
  writeAuth(auth);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// 认证中间件：保护 /api/* 路由（除 /api/auth/* 外）
// ═══════════════════════════════════════════════════

app.use('/api', (req, res, next) => {
  // /api/auth/* 不需要认证
  if (req.path.startsWith('/auth/')) {
    next();
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token && sessions.has(token)) {
    next();
  } else {
    res.status(401).json({ error: 'authentication required' });
  }
});

// ═══════════════════════════════════════════════════
// 以下所有 /api/* 路由现在受认证中间件保护
// ═══════════════════════════════════════════════════

interface NodeEntry {
  id: number;
  name: string;
  token: string;
  address: string;
  port: number;
  connected: boolean;
  lastSeen: string;
  icon?: string;
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

function getConnectedNode(nodeId: number): { address: string; port: number } | null {
  const data = readNodes();
  const node = data.nodes.find(n => n.id === nodeId);
  if (!node || !node.connected) return null;
  return { address: node.address, port: node.port };
}

const nodeConnections = new Map<number, WebSocket>();

// ── API: 节点管理 ──

app.get('/api/nodes', (_req, res) => {
  res.json(readNodes());
});

app.post('/api/nodes', (req, res) => {
  const { name } = req.body;
  const data = readNodes();
  const token = crypto.randomUUID();
  const nodeName = name || `节点 ${data.nodes.length + data.pendingTokens.length + 1}`;
  data.pendingTokens.push({ token, name: nodeName, createdAt: new Date().toISOString() });
  writeNodes(data);
  res.json({ token, nodeName });
});

app.delete('/api/nodes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const data = readNodes();
  const idx = data.nodes.findIndex((n: any) => n.id === id);
  if (idx === -1) { res.status(404).json({ error: 'not found' }); return; }
  data.nodes.splice(idx, 1);
  writeNodes(data);
  const ws = nodeConnections.get(id);
  if (ws) { ws.close(); nodeConnections.delete(id); }
  res.json({ ok: true });
});

app.put('/api/nodes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const data = readNodes();
  const node = data.nodes.find((n: any) => n.id === id);
  if (!node) { res.status(404).json({ error: 'not found' }); return; }
  const { name, icon } = req.body;
  if (name !== undefined) node.name = name;
  if (icon !== undefined) node.icon = icon;
  writeNodes(data);
  res.json(node);
});

app.delete('/api/nodes/pending/:token', (req, res) => {
  const data = readNodes();
  const idx = data.pendingTokens.findIndex(p => p.token === req.params.token);
  if (idx === -1) { res.status(404).json({ error: 'token not found' }); return; }
  data.pendingTokens.splice(idx, 1);
  writeNodes(data);
  res.json({ ok: true });
});

// ── 代理到节点 ──

async function proxyToNode(nodeId: number, req: express.Request, res: express.Response): Promise<void> {
  const node = getConnectedNode(nodeId);
  if (!node) { res.status(404).json({ error: 'node not found or offline' }); return; }
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

app.get('/api/node/:nodeId/instances', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.post('/api/node/:nodeId/instances', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.put('/api/node/:nodeId/instances/:instanceId', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.delete('/api/node/:nodeId/instances/:instanceId', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.post('/api/node/:nodeId/instances/:instanceId/start', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.post('/api/node/:nodeId/instances/:instanceId/stop', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.get('/api/node/:nodeId/instances/:instanceId/status', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.get('/api/node/:nodeId/settings', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));
app.put('/api/node/:nodeId/settings', (req, res) => proxyToNode(parseInt(req.params.nodeId), req, res));

// ═══════════════════════════════════════════════════
// /link WebSocket: 节点接入（不需要认证）
// ═══════════════════════════════════════════════════

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
        const nodeName = pIdx !== -1 ? data.pendingTokens[pIdx].name : existing!.name;
        if (pIdx !== -1) data.pendingTokens.splice(pIdx, 1);
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
          data.nodes.push({ id: nodeId, name: nodeName, token: msg.token, address: msg.address, port: msg.port || 6701, connected: true, lastSeen: now });
        }
        writeNodes(data);
        nodeConnections.set(nodeId, ws);
        ws.send(JSON.stringify({ type: 'registered', nodeId }));
        heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.ping(); }, 30000);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid token' }));
        setTimeout(() => ws.close(), 1000);
      }
    }
  });

  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    const data = readNodes();
    let changed = false;
    for (const [nodeId, conn] of nodeConnections) {
      if (conn === ws) {
        const node = data.nodes.find(n => n.id === nodeId);
        if (node) { node.connected = false; changed = true; }
        nodeConnections.delete(nodeId);
        break;
      }
    }
    if (changed) writeNodes(data);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

// ═══════════════════════════════════════════════════
// WebSocket: 终端代理（需要 token 认证）
// ═══════════════════════════════════════════════════

wss.on('connection', (ws: WebSocket, req) => {
  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  // /link 路径 → 节点接入（无需 token）
  if (parsed.pathname === '/link') {
    handleLinkConnection(ws);
    return;
  }

  // /ws 路径 → 终端代理（需验证 token）
  const token = parsed.searchParams.get('token');
  if (!token || !sessions.has(token)) {
    ws.send('Authentication required.\r\n');
    ws.close();
    return;
  }

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

  const nodeQuery = new URLSearchParams();
  if (instanceId !== null && !isNaN(instanceId)) {
    nodeQuery.set('instanceId', String(instanceId));
  }
  const nodeWsUrl = `ws://${node.address}:${node.port}/ws${nodeQuery.toString() ? '?' + nodeQuery.toString() : ''}`;
  console.log(`[proxy] WS: hub → node #${nodeId} ${nodeWsUrl}`);

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
    for (const msg of buffer) { if (nodeWs.readyState === WebSocket.OPEN) nodeWs.send(msg); }
    buffer = [];
  });

  nodeWs.on('message', (data) => { if (ws.readyState === WebSocket.OPEN) ws.send(bufToStr(data)); });
  nodeWs.on('close', () => { ws.close(); });
  nodeWs.on('error', () => { ws.close(); });

  ws.on('message', (raw) => {
    const text = bufToStr(raw);
    if (nodeOpen && nodeWs.readyState === WebSocket.OPEN) { nodeWs.send(text); }
    else if (!nodeOpen) { buffer.push(text); }
  });
  ws.on('close', () => { if (nodeWs.readyState === WebSocket.OPEN) nodeWs.close(); });
  ws.on('error', () => { if (nodeWs.readyState === WebSocket.OPEN) nodeWs.close(); });
});

app.get('/link', (_req, res) => res.status(400).json({ error: 'WebSocket only' }));
app.post('/link', (_req, res) => res.status(400).json({ error: 'WebSocket only' }));

// ── Hub 设置 ──

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
  if (!firstRunCreds) {
    console.log('  Use existing credentials to login');
  }
});

/**
 * YPanel Hub — 中央面板服务器
 *
 * 职责：
 * - 提供网页面板界面（需登录）
 * - 管理节点（注册、列表、删除）
 * - 通过 /link WebSocket 隧道转发 API 调用到节点
 * - 通过 /link WebSocket 隧道代理终端和文件上传
 *
 * 架构：Node 只通过 /link WebSocket 连接到 Hub，所有通信走此隧道，
 *       双向皆由 Hub 上的同一条 WebSocket 承载。Node 不暴露端口。
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  clientTracking: false,
  handleProtocols: (protocols) => protocols.values().next().value || false,
});

app.use(express.json());

// ── 路径解析（兼容 tsx 开发模式与 dist 构建模式） ──
const ROOT_DIR = process.argv[1]?.endsWith('.ts')
  ? path.resolve(__dirname, '..')
  : __dirname;
const PUBLIC_DIR = process.argv[1]?.endsWith('.ts')
  ? path.resolve(ROOT_DIR, 'dist', 'public')
  : path.join(ROOT_DIR, 'public');
app.use(express.static(PUBLIC_DIR));

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
  hash: string;            // bcrypt hash
  defaultPassword: boolean;
}

/** bcrypt 哈希（异步，用于路由处理器） */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** bcrypt 哈希（同步，仅首次初始化使用） */
function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * 验证密码并自动迁移旧版 SHA-256 哈希到 bcrypt
 * 返回 { match, newHash? }，服务端在匹配成功时更新存储
 */
async function verifyAndMigrate(password: string, storedHash: string): Promise<{ match: boolean; newHash?: string }> {
  // 已是 bcrypt
  if (storedHash.startsWith('$2')) {
    return { match: await bcrypt.compare(password, storedHash) };
  }
  // 旧版 SHA-256（64 位十六进制）
  if (/^[0-9a-f]{64}$/i.test(storedHash)) {
    const shaHash = crypto.createHash('sha256').update(password).digest('hex');
    if (shaHash === storedHash) {
      const newHash = await hashPassword(password);
      return { match: true, newHash };
    }
  }
  return { match: false };
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
function initAuth(): { password: string } {
  const password = randomPassword();
  writeAuth({ hash: hashPasswordSync(password), defaultPassword: true });
  return { password };
}

// ── Session Token 管理 ──
interface SessionEntry {
  createdAt: number;
}
const sessions = new Map<string, SessionEntry>();

/** 清理过期 session */
function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      sessions.delete(token);
    }
  }
}
// 每分钟清理一次
setInterval(cleanExpiredSessions, 60_000);

function createToken(): string {
  const token = crypto.randomUUID();
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

/** 验证 token 是否有效（含过期检查） */
function isValidToken(token: string): boolean {
  const entry = sessions.get(token);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/** 删除 token（退出登录） */
function revokeToken(token: string): void {
  sessions.delete(token);
}

// ── 初始化认证（首次运行时生成） ──
let firstRunCreds: { password: string } | null = null;
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

/** 登录频率限制：15 分钟内最多 10 次尝试 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (_req, res) => {
    res.status(429).json({ error: '登录尝试过于频繁，请 15 分钟后再试' });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** 登录（仅需密码，用户名固定为 admin） */
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const auth = readAuth();
    if (!auth) { res.status(500).json({ error: 'auth not initialized' }); return; }
    const { password } = req.body;
    if (!password) { res.status(401).json({ error: 'invalid credentials' }); return; }

    const result = await verifyAndMigrate(password, auth.hash);
    if (!result.match) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }
    // 自动迁移旧哈希
    if (result.newHash) {
      auth.hash = result.newHash;
      writeAuth(auth);
    }
    const token = createToken();
    res.json({ token, defaultPassword: auth.defaultPassword });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: '内部错误' });
  }
});

/** 验证 token 状态 */
app.post('/api/auth/check', (req, res) => {
  const { token } = req.body;
  if (token && isValidToken(token)) {
    const auth = readAuth();
    res.json({ valid: true, defaultPassword: auth?.defaultPassword ?? false });
  } else {
    res.json({ valid: false });
  }
});

/** 修改密码（需携带有效 token，需旧密码） */
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || !isValidToken(token)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const auth = readAuth();
    if (!auth) { res.status(500).json({ error: 'auth not initialized' }); return; }
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length === 0) {
      res.status(400).json({ error: 'new password is required' });
      return;
    }
    // 必须验证旧密码
    if (!oldPassword) {
      res.status(400).json({ error: 'old password is required' });
      return;
    }
    const verify = await verifyAndMigrate(oldPassword, auth.hash);
    if (!verify.match) {
      res.status(403).json({ error: 'old password is incorrect' });
      return;
    }
    auth.hash = await hashPassword(newPassword);
    auth.defaultPassword = false;
    writeAuth(auth);
    res.json({ ok: true });
  } catch (e) {
    console.error('Change password error:', e);
    res.status(500).json({ error: '内部错误' });
  }
});

/** 退出登录 */
app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  if (token) revokeToken(token);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// 认证中间件（保护 /api/* 路由，除 /api/auth/* 外）
// ═══════════════════════════════════════════════════

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) { next(); return; }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token && isValidToken(token)) { next(); return; }
  res.status(401).json({ error: 'authentication required' });
});

// ═══════════════════════════════════════════════════
// /link WebSocket 隧道系统
// ═══════════════════════════════════════════════════

/** 节点连接池：nodeId → /link WebSocket */
const nodeConnections = new Map<number, WebSocket>();

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}
const pendingApiRequests = new Map<string, PendingRequest>();

const terminalSessions = new Map<string, WebSocket>();
const uploadSessions = new Map<string, WebSocket>();

function sendApiRequest(nodeId: number, method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const linkWs = nodeConnections.get(nodeId);
    if (!linkWs || linkWs.readyState !== WebSocket.OPEN) {
      reject(new Error('Node not connected'));
      return;
    }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingApiRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, 30000);
    pendingApiRequests.set(requestId, { resolve, reject, timer });
    linkWs.send(JSON.stringify({ type: 'api_request', requestId, method, path, body }));
  });
}

// ═══════════════════════════════════════════════════
// 节点管理
// ═══════════════════════════════════════════════════

interface NodeEntry {
  id: number;
  name: string;
  token: string;
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

app.get('/api/nodes', (_req, res) => { res.json(readNodes()); });

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

// ═══════════════════════════════════════════════════
// API（隧道转发）
// ═══════════════════════════════════════════════════

app.get('/api/node/:nodeId/instances', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'GET', '/api/instances')); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.post('/api/node/:nodeId/instances', async (req, res) => {
  try { res.status(201).json(await sendApiRequest(parseInt(req.params.nodeId), 'POST', '/api/instances', req.body)); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.put('/api/node/:nodeId/instances/:instanceId', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'PUT', `/api/instances/${req.params.instanceId}`, req.body)); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.delete('/api/node/:nodeId/instances/:instanceId', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'DELETE', `/api/instances/${req.params.instanceId}`)); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.post('/api/node/:nodeId/instances/:instanceId/start', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'POST', `/api/instances/${req.params.instanceId}/start`, req.body)); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.post('/api/node/:nodeId/instances/:instanceId/stop', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'POST', `/api/instances/${req.params.instanceId}/stop`, req.body)); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.get('/api/node/:nodeId/instances/:instanceId/status', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'GET', `/api/instances/${req.params.instanceId}/status`)); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.get('/api/node/:nodeId/settings', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'GET', '/api/settings')); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

app.put('/api/node/:nodeId/settings', async (req, res) => {
  try { res.json(await sendApiRequest(parseInt(req.params.nodeId), 'PUT', '/api/settings', req.body)); }
  catch { res.status(502).json({ error: '节点未连接或请求超时' }); }
});

// ═══════════════════════════════════════════════════
// /link WebSocket：节点接入
// ═══════════════════════════════════════════════════

function cleanupNodeState(nodeId: number): void {
  for (const [reqId, pending] of pendingApiRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error('Node disconnected'));
    pendingApiRequests.delete(reqId);
  }
  for (const [termId, browserWs] of terminalSessions) {
    try { browserWs.close(); } catch { /* ignore */ }
    terminalSessions.delete(termId);
  }
  for (const [sessionId, browserWs] of uploadSessions) {
    try { browserWs.close(); } catch { /* ignore */ }
    uploadSessions.delete(sessionId);
  }
}

function handleTerminalMessage(msg: any): void {
  if (!msg.termId || !terminalSessions.has(msg.termId)) return;
  const browserWs = terminalSessions.get(msg.termId)!;
  if (browserWs.readyState !== WebSocket.OPEN) { terminalSessions.delete(msg.termId); return; }
  if (msg.type === 'terminal_data') {
    browserWs.send(msg.data);
  } else if (msg.type === 'terminal_closed') {
    browserWs.send('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
    setTimeout(() => browserWs.close(), 200);
    terminalSessions.delete(msg.termId);
  }
}

function handleUploadMessage(msg: any): void {
  const sessionId = msg.uploadSessionId;
  if (!sessionId || !uploadSessions.has(sessionId)) return;
  const browserWs = uploadSessions.get(sessionId)!;
  if (browserWs.readyState !== WebSocket.OPEN) { uploadSessions.delete(sessionId); return; }
  const { uploadSessionId: _, ...forward } = msg;
  browserWs.send(JSON.stringify(forward));
  if (msg.type === 'upload_complete' || msg.type === 'upload_error') {
    uploadSessions.delete(sessionId);
  }
}

function handleLinkConnection(ws: WebSocket): void {
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  ws.on('message', (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'register': {
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
            existing.connected = true;
            existing.lastSeen = now;
            const oldWs = nodeConnections.get(nodeId);
            if (oldWs && oldWs !== ws) { try { oldWs.close(); } catch { /* ignore */ } }
          } else {
            nodeId = data.nodes.length;
            data.nodes.push({ id: nodeId, name: nodeName, token: msg.token, connected: true, lastSeen: now });
          }
          writeNodes(data);
          nodeConnections.set(nodeId, ws);
          ws.send(JSON.stringify({ type: 'registered', nodeId }));
          heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.ping(); }, 30000);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'invalid token' }));
          setTimeout(() => ws.close(), 1000);
        }
        break;
      }
      case 'api_response': {
        const pending = pendingApiRequests.get(msg.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          if (msg.status && msg.status >= 400) {
            pending.reject(new Error(msg.error || `API error: ${msg.status}`));
          } else {
            pending.resolve(msg.data);
          }
          pendingApiRequests.delete(msg.requestId);
        }
        break;
      }
      case 'terminal_data':
      case 'terminal_closed': {
        handleTerminalMessage(msg);
        break;
      }
      case 'upload_ack':
      case 'upload_progress':
      case 'upload_complete':
      case 'upload_error': {
        handleUploadMessage(msg);
        break;
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
        cleanupNodeState(nodeId);
        break;
      }
    }
    if (changed) writeNodes(data);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

// ═══════════════════════════════════════════════════
// WebSocket：终端代理 & 文件上传代理
// ═══════════════════════════════════════════════════
// 浏览器连接到 Hub 的 /ws 或 /upload，
// 认证通过 Sec-WebSocket-Protocol 头传递（不在 URL 中），
// Hub 通过 /link 隧道将流量转发到对应的 Node

function bufToStr(data: any): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
  return String(data);
}

/** 从 WebSocket 握手请求中提取认证 token（优先子协议头） */
function extractWsToken(req: http.IncomingMessage): string | null {
  const proto = req.headers['sec-websocket-protocol'];
  if (proto) {
    return Array.isArray(proto) ? proto[0] : proto;
  }
  // 回退：URL query（兼容旧版客户端）
  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  return parsed.searchParams.get('token');
}

wss.on('connection', (ws: WebSocket, req) => {
  const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

  // /link → 节点接入（无需 token）
  if (parsed.pathname === '/link') {
    handleLinkConnection(ws);
    return;
  }

  // ── 验证 token（从 Sec-WebSocket-Protocol 头获取） ──
  const token = extractWsToken(req);
  const nodeIdStr = parsed.searchParams.get('nodeId');
  const nodeId = nodeIdStr ? parseInt(nodeIdStr, 10) : null;
  if (!token || !isValidToken(token) || nodeId === null || isNaN(nodeId)) {
    const isJson = parsed.pathname === '/upload';
    ws.send(isJson
      ? JSON.stringify({ type: 'upload_error', message: 'Authentication required' })
      : 'Authentication required.\r\n');
    ws.close();
    return;
  }

  const linkWs = nodeConnections.get(nodeId);
  if (!linkWs || linkWs.readyState !== WebSocket.OPEN) {
    const isJson = parsed.pathname === '/upload';
    ws.send(isJson
      ? JSON.stringify({ type: 'upload_error', message: 'Node not connected' })
      : 'Node not connected.\r\n');
    ws.close();
    return;
  }

  // ── 文件上传代理（通过隧道） ──
  if (parsed.pathname === '/upload') {
    const uploadSessionId = crypto.randomUUID();
    uploadSessions.set(uploadSessionId, ws);
    console.log(`[tunnel] upload start: session=${uploadSessionId} node=#${nodeId}`);

    ws.on('message', (raw) => {
      const text = bufToStr(raw);
      let msg: any;
      try { msg = JSON.parse(text); } catch { return; }
      linkWs.send(JSON.stringify({ uploadSessionId, ...msg }));
    });

    ws.on('close', () => {
      if (linkWs.readyState === WebSocket.OPEN) {
        linkWs.send(JSON.stringify({ type: 'upload_cancel', uploadSessionId }));
      }
      uploadSessions.delete(uploadSessionId);
    });
    ws.on('error', () => { uploadSessions.delete(uploadSessionId); });
    return;
  }

  // ── 终端代理（通过隧道） ──
  const instanceIdStr = parsed.searchParams.get('instanceId');
  const instanceId = instanceIdStr ? parseInt(instanceIdStr, 10) : null;
  const termId = crypto.randomUUID();

  terminalSessions.set(termId, ws);
  console.log(`[tunnel] terminal: termId=${termId} node=#${nodeId} instanceId=${instanceId}`);

  linkWs.send(JSON.stringify({
    type: 'terminal_open',
    termId,
    instanceId: (instanceId !== null && !isNaN(instanceId)) ? instanceId : null,
  }));

  ws.on('message', (raw) => {
    const text = bufToStr(raw);
    try {
      const json = JSON.parse(text);
      if (json.type === 'resize') {
        linkWs.send(JSON.stringify({ type: 'terminal_resize', termId, cols: json.cols, rows: json.rows }));
        return;
      }
    } catch { /* 不是 JSON，当作终端输入 */ }
    linkWs.send(JSON.stringify({ type: 'terminal_data', termId, data: text }));
  });

  ws.on('close', () => {
    if (linkWs.readyState === WebSocket.OPEN) {
      linkWs.send(JSON.stringify({ type: 'terminal_close', termId }));
    }
    terminalSessions.delete(termId);
  });
  ws.on('error', () => {
    if (linkWs.readyState === WebSocket.OPEN) {
      linkWs.send(JSON.stringify({ type: 'terminal_close', termId }));
    }
    terminalSessions.delete(termId);
  });
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

/**
 * 构建后辅助脚本
 * 处理 Hub / Node 输出目录的运行时依赖复制
 *
 * 说明：前端静态文件已由 Vite 构建至 dist/public/，
 * 这里只需要处理 data 目录和 Node 端的原生模块。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── Hub 输出 ───────────────────────────────────────────
const HUB_DIST = path.join(ROOT, 'dist');
fs.mkdirSync(HUB_DIST, { recursive: true });

// data 目录（保留已有节点数据）
fs.mkdirSync(path.join(HUB_DIST, 'data'), { recursive: true });
const nodesJson = path.join(ROOT, 'data', 'nodes.json');
if (fs.existsSync(nodesJson)) {
  fs.cpSync(nodesJson, path.join(HUB_DIST, 'data', 'nodes.json'), { force: true });
}
console.log('Hub dist ready: run node dist/index.js');

// ─── Node 输出 ───────────────────────────────────────────
const NODE_DIST = path.join(ROOT, 'dist-node');
fs.mkdirSync(NODE_DIST, { recursive: true });

// data 目录
fs.mkdirSync(path.join(NODE_DIST, 'data'), { recursive: true });
const dataDir = path.join(ROOT, 'data');
if (fs.existsSync(dataDir)) {
  fs.cpSync(dataDir, path.join(NODE_DIST, 'data'), { recursive: true, force: true });
}

// ── 处理 zigpty 原生模块 ──
const ZIG_SRC = path.join(ROOT, 'node_modules', 'zigpty');
const ZIG_DST = path.join(NODE_DIST, 'node_modules', 'zigpty');

fs.mkdirSync(path.join(ZIG_DST, 'dist'), { recursive: true });
fs.cpSync(path.join(ZIG_SRC, 'dist'), path.join(ZIG_DST, 'dist'), { recursive: true, force: true });

fs.mkdirSync(path.join(ZIG_DST, 'prebuilds'), { recursive: true });
fs.cpSync(path.join(ZIG_SRC, 'prebuilds'), path.join(ZIG_DST, 'prebuilds'), { recursive: true, force: true });

fs.cpSync(path.join(ZIG_SRC, 'package.json'), path.join(ZIG_DST, 'package.json'), { force: true });

console.log('  zigpty: dist + prebuilds copied');

console.log('Node dist ready: run node dist-node/index.js -s <hub-url> -t <token>');
console.log('');
console.log('Example: node dist-node/index.js -s ws://localhost:6699/link -t YOUR_TOKEN');
console.log('To start hub:  node dist/index.js');

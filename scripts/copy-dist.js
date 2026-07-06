/**
 * 构建后辅助脚本
 * 将 Hub / Node 所需的运行时依赖和静态资源复制到输出目录
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── Hub 输出 ───────────────────────────────────────────
const HUB_DIST = path.join(ROOT, 'dist');
fs.mkdirSync(HUB_DIST, { recursive: true });

// 前端静态资源
fs.cpSync(path.join(ROOT, 'public'), path.join(HUB_DIST, 'public'), { recursive: true, force: true });

// data 目录（保留已有 nodes.json）
fs.mkdirSync(path.join(HUB_DIST, 'data'), { recursive: true });
const nodesJson = path.join(ROOT, 'data', 'nodes.json');
if (fs.existsSync(nodesJson)) {
  fs.cpSync(nodesJson, path.join(HUB_DIST, 'data', 'nodes.json'), { force: true });
}
console.log('Hub dist built: run node dist/index.js');

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
// zigpty 体积很小（~176 KB 安装），且预构建了 8 个平台的 .node 二进制
// 不需要 node-gyp / C++ 工具链
const ZIG_SRC = path.join(ROOT, 'node_modules', 'zigpty');
const ZIG_DST = path.join(NODE_DIST, 'node_modules', 'zigpty');

fs.mkdirSync(path.join(ZIG_DST, 'dist'), { recursive: true });
fs.cpSync(path.join(ZIG_SRC, 'dist'), path.join(ZIG_DST, 'dist'), { recursive: true, force: true });

fs.mkdirSync(path.join(ZIG_DST, 'prebuilds'), { recursive: true });
fs.cpSync(path.join(ZIG_SRC, 'prebuilds'), path.join(ZIG_DST, 'prebuilds'), { recursive: true, force: true });

fs.cpSync(path.join(ZIG_SRC, 'package.json'), path.join(ZIG_DST, 'package.json'), { force: true });

console.log('  zigpty: dist + prebuilds copied');

console.log('Node dist built: run node dist-node/index.js -s <hub-url> -t <token> [-p <port>]');
console.log('');
console.log('Example: node dist-node/index.js -s ws://localhost:6699/link -t YOUR_TOKEN');
console.log('To start hub:  node dist/index.js');

/**
 * 构建后辅助脚本
 * 处理 Hub / Node 输出目录的运行时依赖复制
 *
 * 说明：
 * - 前端静态文件已由 Vite 构建至 dist/public/
 * - Hub/Node 的运行时数据存储在 ~/.ypanel/hub 和 ~/.ypanel/node，
 *   不受 npm 更新影响，无需在此处理
 * - 这里只复制 Node 端的 zigpty 原生模块
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── Hub 输出 ───────────────────────────────────────────
const HUB_DIST = path.join(ROOT, 'dist');
fs.mkdirSync(HUB_DIST, { recursive: true });
console.log('Hub dist ready: run node dist/index.js');

// ─── Node 输出 ───────────────────────────────────────────
const NODE_DIST = path.join(ROOT, 'dist-node');
fs.mkdirSync(NODE_DIST, { recursive: true });

// ── 复制 zigpty 原生模块 ──
const ZIG_SRC = path.join(ROOT, 'node_modules', 'zigpty');
const ZIG_DST = path.join(NODE_DIST, 'node_modules', 'zigpty');

fs.mkdirSync(path.join(ZIG_DST, 'dist'), { recursive: true });
fs.cpSync(path.join(ZIG_SRC, 'dist'), path.join(ZIG_DST, 'dist'), { recursive: true, force: true });

fs.mkdirSync(path.join(ZIG_DST, 'prebuilds'), { recursive: true });
fs.cpSync(path.join(ZIG_SRC, 'prebuilds'), path.join(ZIG_DST, 'prebuilds'), { recursive: true, force: true });

fs.cpSync(path.join(ZIG_SRC, 'package.json'), path.join(ZIG_DST, 'package.json'), { force: true });

console.log('  zigpty: dist + prebuilds copied');

console.log('\nNode dist ready: run node dist-node/index.js -s <hub-url> -t <token>');
console.log('To start hub:   node dist/index.js');
console.log('\nData stored at:');
console.log('  Hub:  ~/.ypanel/hub/');
console.log('  Node: ~/.ypanel/node/');

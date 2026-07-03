/**
 * 构建后辅助脚本：
 * 将运行时依赖和静态资源复制到 dist/（Hub）和 dist-node/（Node）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Hub 构建输出：dist/ ──
const HUB_DIST = path.join(ROOT, 'dist');
fs.mkdirSync(HUB_DIST, { recursive: true });

// 1. 复制 public/ 静态文件（前端界面）
fs.cpSync(path.join(ROOT, 'public'), path.join(HUB_DIST, 'public'), { recursive: true, force: true });

// 2. 初始化 data/ 目录（如有 node 数据则保留）
fs.mkdirSync(path.join(HUB_DIST, 'data'), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'data', 'nodes.json'))) {
  fs.cpSync(path.join(ROOT, 'data', 'nodes.json'), path.join(HUB_DIST, 'data', 'nodes.json'), { force: true });
}

console.log('Hub dist built:  run node dist/index.js');

// ── Node 构建输出：dist-node/ ──
const NODE_DIST = path.join(ROOT, 'dist-node');
fs.mkdirSync(NODE_DIST, { recursive: true });

// 1. 复制 data/（instances.json, settings.json）
fs.mkdirSync(path.join(NODE_DIST, 'data'), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'data', 'instances.json'))) {
  fs.cpSync(path.join(ROOT, 'data'), path.join(NODE_DIST, 'data'), { recursive: true, force: true });
}

// 2. 复制 node-pty 原生模块（跨平台）
const NPTY_SRC = path.join(ROOT, 'node_modules', 'node-pty');
const NPTY_DIST = path.join(NODE_DIST, 'node_modules', 'node-pty');
if (fs.existsSync(NPTY_SRC)) {
  // lib/ — JS 运行时
  fs.cpSync(path.join(NPTY_SRC, 'lib'), path.join(NPTY_DIST, 'lib'), { recursive: true, force: true });
  // package.json — 模块元数据
  fs.cpSync(path.join(NPTY_SRC, 'package.json'), path.join(NPTY_DIST, 'package.json'), { force: true });
  // build/Release/pty.node — Linux x64 二进制
  if (fs.existsSync(path.join(NPTY_SRC, 'build', 'Release', 'pty.node'))) {
    fs.mkdirSync(path.join(NPTY_DIST, 'build', 'Release'), { recursive: true });
    fs.cpSync(path.join(NPTY_SRC, 'build', 'Release', 'pty.node'), path.join(NPTY_DIST, 'build', 'Release', 'pty.node'));
  }
  // prebuilds/ — macOS (x64+arm64) + Windows (x64+arm64) 预编译二进制
  if (fs.existsSync(path.join(NPTY_SRC, 'prebuilds'))) {
    // 如果缺少 linux-arm64，尝试构建
    const arm64Prebuild = path.join(NPTY_SRC, 'prebuilds', 'linux-arm64', 'pty.node');
    if (!fs.existsSync(arm64Prebuild)) {
      console.log('  Building linux-arm64 pty.node (cross-compile)...');
      const { execSync } = require('child_process');
      try {
        execSync('npx node-gyp rebuild', {
          cwd: NPTY_SRC,
          env: { ...process.env, CC: 'aarch64-linux-gnu-gcc-12', CXX: 'aarch64-linux-gnu-g++-12' },
          stdio: 'pipe',
        });
        fs.mkdirSync(path.dirname(arm64Prebuild), { recursive: true });
        fs.cpSync(path.join(NPTY_SRC, 'build', 'Release', 'pty.node'), arm64Prebuild);
        // 恢复 x64 构建
        execSync('npx node-gyp rebuild', { cwd: NPTY_SRC, stdio: 'pipe' });
        console.log('  linux-arm64 pty.node built');
      } catch (e) {
        console.log('  (skipped, cross-compiler not available)');
      }
    }
    fs.cpSync(path.join(NPTY_SRC, 'prebuilds'), path.join(NPTY_DIST, 'prebuilds'), { recursive: true, force: true });
  }
  console.log('  node-pty: Linux x64+arm64 + macOS x64+arm64 + Windows x64+arm64');
}

console.log('Node dist built: run node dist-node/index.js -s <hub-url> -t <token> [-p <port>]');
console.log('');
console.log('Example: node dist-node/index.js -s ws://localhost:6699/link -t YOUR_TOKEN');
console.log('To start hub:  node dist/index.js');

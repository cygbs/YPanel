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

// ── 处理 node-pty 原生模块 ──
const PTY_SRC = path.join(ROOT, 'node_modules', 'node-pty');
const PTY_DST = path.join(NODE_DIST, 'node_modules', 'node-pty');

// 1. 复制 JS 运行时 & 元数据（lib + package.json）
fs.cpSync(path.join(PTY_SRC, 'lib'), path.join(PTY_DST, 'lib'), { recursive: true, force: true });
fs.cpSync(path.join(PTY_SRC, 'package.json'), path.join(PTY_DST, 'package.json'), { force: true });

// 2. 获取 pty.node 二进制（按优先级尝试）
let binaryCopied = false;

// 优先级 1：官方预编译包 prebuilds（例如 npm i 时下载的）
const platformArch = `${process.platform}-${process.arch}`;  // linux-x64
const prebuildFile = path.join(PTY_SRC, 'prebuilds', platformArch, 'pty.node');
if (fs.existsSync(prebuildFile)) {
  // 复制整个 prebuilds 目录（包含所有平台，方便分发）
  fs.cpSync(
    path.join(PTY_SRC, 'prebuilds'),
    path.join(PTY_DST, 'prebuilds'),
    { recursive: true, force: true }
  );
  console.log(`  node-pty: prebuilds copied (including ${platformArch})`);
  binaryCopied = true;
}

// 优先级 2：从 node-gyp 编译产物 build/Release 直接复制
if (!binaryCopied) {
  const buildRelease = path.join(PTY_SRC, 'build', 'Release', 'pty.node');
  if (fs.existsSync(buildRelease)) {
    fs.mkdirSync(path.join(PTY_DST, 'build', 'Release'), { recursive: true });
    fs.cpSync(buildRelease, path.join(PTY_DST, 'build', 'Release', 'pty.node'));
    console.log('  node-pty: build/Release/pty.node copied');
    binaryCopied = true;
  }
}

// 优先级 3：以上都无，尝试现场编译（需要 node-gyp 和 C++ 工具链）
if (!binaryCopied) {
  console.log('  node-pty: no binary found, trying to rebuild...');
  try {
    require('child_process').execSync('npx node-gyp rebuild', {
      cwd: PTY_SRC,
      stdio: 'pipe'
    });
    const freshBuild = path.join(PTY_SRC, 'build', 'Release', 'pty.node');
    if (fs.existsSync(freshBuild)) {
      fs.mkdirSync(path.join(PTY_DST, 'build', 'Release'), { recursive: true });
      fs.cpSync(freshBuild, path.join(PTY_DST, 'build', 'Release', 'pty.node'));
      console.log('  node-pty: rebuilt and copied successfully');
      binaryCopied = true;
    }
  } catch (e) {
    console.error('  node-pty: rebuild failed. Install build-essential and python3, then try again.');
    console.error('  Error:', e.stderr?.toString() || e.message);
    process.exit(1);
  }
}

if (!binaryCopied) {
  console.error('  node-pty: could not obtain pty.node');
  process.exit(1);
}

console.log('Node dist built: run node dist-node/index.js -s <hub-url> -t <token> [-p <port>]');
console.log('');
console.log('Example: node dist-node/index.js -s ws://localhost:6699/link -t YOUR_TOKEN');
console.log('To start hub:  node dist/index.js');

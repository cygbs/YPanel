/**
 * 构建后辅助脚本：将运行时依赖和静态资源复制到 dist/
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

fs.mkdirSync(DIST, { recursive: true });

// 1. 复制 public/ 静态文件
fs.cpSync(path.join(ROOT, 'public'), path.join(DIST, 'public'), { recursive: true, force: true });

// 2. 复制 data/
fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'data', 'instances.json'))) {
  fs.cpSync(path.join(ROOT, 'data'), path.join(DIST, 'data'), { recursive: true, force: true });
}
if (fs.existsSync(path.join(ROOT, 'data', 'settings.json'))) {
  fs.cpSync(path.join(ROOT, 'data', 'settings.json'), path.join(DIST, 'data', 'settings.json'), { force: true });
}

// 3. 复制 node-pty 原生模块
const NPTY_SRC = path.join(ROOT, 'node_modules', 'node-pty');
const NPTY_DIST = path.join(DIST, 'node_modules', 'node-pty');
if (fs.existsSync(NPTY_SRC)) {
  fs.mkdirSync(path.join(NPTY_DIST, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(NPTY_DIST, 'build', 'Release'), { recursive: true });
  // 核心 JS
  const jsFiles = fs.readdirSync(path.join(NPTY_SRC, 'lib')).filter(f => f.endsWith('.js'));
  for (const f of jsFiles) {
    fs.cpSync(path.join(NPTY_SRC, 'lib', f), path.join(NPTY_DIST, 'lib', f));
  }
  // 原生二进制
  fs.cpSync(path.join(NPTY_SRC, 'build', 'Release', 'pty.node'), path.join(NPTY_DIST, 'build', 'Release', 'pty.node'));
  // package.json（模块入口）
  fs.cpSync(path.join(NPTY_SRC, 'package.json'), path.join(NPTY_DIST, 'package.json'));
}

// 4. 复制 SVG 图标
const SVG_SRC = path.join(ROOT, 'public', 'assets');
const SVG_DIST = path.join(DIST, 'public', 'assets');
if (fs.existsSync(SVG_SRC)) {
  fs.cpSync(SVG_SRC, SVG_DIST, { recursive: true, force: true });
}

console.log('Dist build complete.  Run: node dist/index.js');

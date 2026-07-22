#!/usr/bin/env node
/**
 * YPanel CLI — 统一入口
 *
 * 用法：
 *   ypanel                      启动 Hub（中央面板服务器）
 *   ypanel node -s <url> -t <token> [-k]  启动 Node（节点守护进程）
 */

const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args[0] === 'node') {
  // ── Node 模式 ──
  const nodeScript = path.join(__dirname, '..', 'dist-node', 'index.js');
  if (!fs.existsSync(nodeScript)) {
    console.error('Error: dist-node/index.js not found. Package may be corrupted.');
    process.exit(1);
  }
  // 透传所有剩余参数给 Node 脚本
  process.argv = [process.argv[0], nodeScript, ...args.slice(1)];
  require(nodeScript);
} else if (args[0] === '--version' || args[0] === '-v') {
  // ── 版本查询 ──
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  console.log(`ypanel v${pkg.version}`);
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log([
    'YPanel — Web Minecraft Server Manager',
    '',
    'Usage:',
    '  ypanel                  Start the Hub (central panel server)',
    '  ypanel node -s <url> -t <token> [-k]',
    '                          Start the Node (daemon, connects to Hub)',
    '',
    'Node options:',
    '  -s <url>    Hub WebSocket URL (e.g. ws://localhost:6699)',
    '  -t <token>  Node registration token (UUID v4)',
    '  -k          Skip TLS certificate verification (for self-signed certs)',
    '',
    '  ypanel --version, -v   Show version',
    '  ypanel --help, -h      Show this help',
    '',
    'Homepage: https://github.com/cygbs/YPanel',
  ].join('\n'));
} else {
  // ── Hub 模式（默认） ──
  const hubScript = path.join(__dirname, '..', 'dist', 'index.js');
  if (!fs.existsSync(hubScript)) {
    console.error('Error: dist/index.js not found. Package may be corrupted.');
    process.exit(1);
  }
  process.argv = [process.argv[0], hubScript, ...args];
  require(hubScript);
}

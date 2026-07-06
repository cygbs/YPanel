/**
 * YPanel 客户端构建脚本
 * 编译 .vue SFC + esbuild bundle 为 public/client.js
 */
import * as esbuild from 'esbuild';
import { parse, compileTemplate, compileStyleAsync } from '@vue/compiler-sfc';
import { parse as babelParse } from '@babel/parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const isProd = process.argv.includes('--prod');
const vueAlias = path.resolve(ROOT,
  isProd
    ? 'node_modules/vue/dist/vue.esm-browser.prod.js'
    : 'node_modules/vue/dist/vue.esm-browser.js'
);

/**
 * 将 export default 改写为 const 声明
 * 使用 Babel AST 以确保可靠性
 */
function rewriteExportDefault(code, varName) {
  const ast = babelParse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });

  for (const stmt of ast.program.body) {
    if (stmt.type === 'ExportDefaultDeclaration') {
      const start = stmt.start;
      const declStart = stmt.declaration.start;
      const declEnd = stmt.declaration.end;
      // 替换 "export default <decl>" → "const <varName> = <decl>"
      return (
        code.slice(0, start) +
        `const ${varName} = ` +
        code.slice(declStart, declEnd)
      );
    }
  }
  // 没有 export default，原样返回
  return code;
}

// ── Vue SFC 插件 ──
const vuePlugin = {
  name: 'vue',
  setup(build) {
    build.onResolve({ filter: /\.vue$/ }, (args) => {
      return { path: path.resolve(args.resolveDir, args.path) };
    });

    build.onLoad({ filter: /\.vue$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, 'utf-8');
      const filename = path.basename(args.path);
      const id = JSON.stringify(filename);

      const { descriptor } = parse(source);

      // 1. 编译模板 → render function module
      let templateCode = '';
      if (descriptor.template) {
        const r = compileTemplate({
          source: descriptor.template.content,
          filename,
          id,
        });
        templateCode = r.code;
      }

      // 2. 编译脚本（暂不做 script processing，用 Babel 独立处理）
      const scriptContent = descriptor.script?.content || '';

      // 3. 组合输出
      let output = '';
      if (templateCode) {
        // 把 export function render → 普通的函数声明
        const renderFn = templateCode.replace(/^export function render/m, 'function render');
        output += renderFn + '\n\n';
      }

      // 改写 export default → const __sfc__ = ...
      const varName = '_sfc_' + filename.replace(/\.vue$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      output += rewriteExportDefault(scriptContent, varName) + '\n\n';

      // 给组件挂载 render 函数
      if (templateCode) {
        output += `${varName}.render = render\n`;
      }
      output += `export default ${varName}`;

      return { contents: output, loader: 'ts' };
    });
  },
};

// ── 构建 ──
try {
  await esbuild.build({
    entryPoints: [path.resolve(ROOT, 'src/client.ts')],
    bundle: true,
    outfile: path.resolve(ROOT, 'public/client.js'),
    alias: { vue: vueAlias },
    plugins: [vuePlugin],
    define: isProd
      ? { 'process.env.NODE_ENV': '"production"' }
      : { 'process.env.NODE_ENV': '"development"' },
    minify: isProd,
  });

  console.log(`Client built: public/client.js (${isProd ? 'production' : 'development'})`);
  console.log(`  alias: vue → ${vueAlias}`);
} catch (e) {
  console.error('Build failed:', e);
  process.exit(1);
}

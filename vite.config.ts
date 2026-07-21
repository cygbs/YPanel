import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import yaml from 'js-yaml';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

/** Vite 插件：将 .yml 文件转换为 ES module */
function yamlPlugin() {
  return {
    name: 'yaml',
    transform(code: string, id: string) {
      if (id.endsWith('.yml') || id.endsWith('.yaml')) {
        return {
          code: `export default ${JSON.stringify(yaml.load(code))}`,
          map: null,
        };
      }
    },
  };
}

export default defineConfig({
  root: 'src',
  plugins: [
    vue(),
    yamlPlugin(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  publicDir: '../public',
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
  },
});

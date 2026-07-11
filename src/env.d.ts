// 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。

/// <reference types="vite/client" />

declare module '*.yml' {
  const data: Record<string, any>;
  export default data;
}

declare module '*.yaml' {
  const data: Record<string, any>;
  export default data;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

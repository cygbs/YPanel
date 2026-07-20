// 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。

import fs from 'fs';

// ── 共享类型 ──

export interface Instance {
  id: number;
  name: string;
  uuid: string;
  icon: string;
  command: string;
  folder: string;
  stopCommand: string;
  autoStart: boolean;
  createdAt: string;
}

export interface InstanceData {
  instances: Instance[];
}

export interface NodeSettings {
  defaultShell: string;
}

// ── IO 工具 ──

/** 读取 JSON 文件，解析失败或不存在时返回 fallback */
export function readJSON<T>(path: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(path, 'utf-8')); }
  catch { return fallback; }
}

/** 原子写入 JSON 文件（先写临时文件再 rename） */
export function writeJSON(path: string, data: unknown): void {
  const tmp = path + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, path);
}

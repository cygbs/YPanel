import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, IPty } from 'node-pty';
import path from 'path';
import os from 'os';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '../public')));

wss.on('connection', (ws: WebSocket) => {
  const shell: IPty = spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: { ...process.env } as { [key: string]: string },
  });

  shell.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
    const msg = raw.toString();
    try {
      const json = JSON.parse(msg);
      if (json.type === 'resize') {
        shell.resize(json.cols, json.rows);
        return;
      }
    } catch {
      // not JSON -> regular terminal input
    }
    shell.write(msg);
  });

  ws.on('close', () => {
    shell.kill();
  });

  ws.on('error', () => {
    shell.kill();
  });
});

const PORT = parseInt(process.env.PORT || '6699', 10);
server.listen(PORT, () => {
  console.log(`YPanel running on http://localhost:${PORT}`);
});

# YPanel
A web panel for Minecraft server.

![YPanel Logo](public/favicon.webp)

[中文自述文件](https://github.com/cygbs/YPanel)

This is a simple web panel suitable for Minecraft servers or any other program. It is written in TypeScript, Vue.js, etc. The instance icon comes from [Prism Launcher](https://prismlauncher.org), and the overall design also references it.

## Features

### Advantages

- Minimalist, low resource usage, fast loading speed. The operation logic is simple and intuitive.
- Supports controlling multiple servers, and the panel itself only needs to occupy one port on one server.
- Not just Minecraft servers; theoretically supports all console programs.
- Cross-platform compatible, can be installed on multiple servers with different architectures and systems.
- Security: supports setting a secure entry.

### Compared to other panels…

| Feature | Other Panels | YPanel |
| :--- | :----: | ---: |
| Multi-user | ✓ | ✗ |
| Docker support | ✓ | ✗ |
| Loading speed | ✗ | ✓ |
| Documentation | ✓ | ✗ |
| API | ✓ | ✗ |
| Node terminal | ✓ | ✓ (more convenient) |
| Instance/Template marketplace | ✓ | ✗ |
| One-click script | ✓ | ✗ |
| Secure entry | ✗ | ✓ |
| Size | ✗ | ✓ |
| Multilingual | ✓ | ✓ |
| Cross-platform | ✓ | ✓ |
| NAT friendly | ✗ | ✓ |

## Running

In any case, ensure you have a Node.js environment first. Please [install Node.js](https://nodejs.org/zh-cn/download).

**Manual method:**

Download `YPanel.zip` from [Releases](https://github.com/cygbs/YPanel/releases). After extracting, `dist` is the Hub part, `dist-node` is the Node part, and they need to be used together.

The startup method is: first enter the `dist` directory and execute `node index.js` to start the Hub, then add and obtain the Node startup command from the Hub, and finally run the Node startup command in the `dist-node` folder. The node will connect shortly.

You need one Hub and at least one Node instance to use this panel. **Never run the panel and instances using accounts like root, Administrator, or SYSTEM! This will put you in danger.**

## Building

```bash
git clone git@github.com:cygbs/YPanel.git --depth 1
cd YPanel
npm i
npm run build
```

## TODO

- Implement plugin system.
- Improve documentation.
- Provide a simple and clear external API for easy integration with other programs.
- Provide a one-click installation script.
- Use [Bubblewrap](https://github.com/containers/bubblewrap) to provide container functionality instead of Docker. This panel will not support Docker because the author believes it is not very suitable for Minecraft servers.

## License

GNU AGPLv3 or any later version.

# YPanel
A web panel for Minecraft server.

![YPanel Logo](public/favicon.webp)

[English README](https://github.com/cygbs/YPanel/blob/main/README_EN.md)

This is a simple web panel suitable for Minecraft servers, or any other programs. It is built with TypeScript, Vue.js, and more. The instance icon comes from [Prism Launcher](https://prismlauncher.org), and the overall design is also inspired by it. This project uses the `deepseek-v4-flash` & `deepseek-v4-pro` model to assist with content creation.

## Features

### Advantages

- Minimalistic, low resource usage, fast loading speed. Simple and intuitive operation logic.
- Supports controlling multiple servers, and the panel itself only needs to occupy one port on a single server.
- Not just for Minecraft servers — theoretically supports all console programs.
- Cross-platform compatible, can be installed on servers with different architectures and operating systems.
- Security, supports setting a security entrance.

### Compared to other panels…

| Feature | Other panels | YPanel |
| :--- | :----: | ---: |
| Multi-user | ✓ | ✗ |
| Docker support | ✓ | ✗ |
| Loading speed | ✗ | ✓ |
| Docs | ✓ | ✗ |
| API | ✓ | ✗ |
| Node terminal | ✓ | ✓ |
| Instance/template market | ✓ | ✗ |
| File management | ✓ | ✓ |
| UI customization | ✓ | ✗ |
| One-click script | ✓ | ✓ |
| Security entrance | ✗ | ✓ |
| Size | ✗ | ✓ |
| Multi-language | ✓ | ✓ |
| Cross-platform | ✓ | ✓ |
| NAT friendly | ✗ | ✓ |

## Running

**One-click script:**

```bash
curl -fsSL https://raw.githubusercontent.com/cygbs/YPanel/refs/heads/main/scripts/install.sh | sudo bash
```

This script currently requires systemd functionality. If your system lacks it, please use the manual method below and write your own startup script. When using the one-click script, ensure your network connection is smooth.

**One-click uninstall:**

```bash
curl -fsSL https://raw.githubusercontent.com/cygbs/YPanel/refs/heads/main/scripts/uninstall.sh | sudo bash
```

The uninstall script can only remove YPanel installed via the installation script; other cases may not be handled.

**Manual method:**

First, ensure you have a Node.js environment. Please [install Node.js](https://nodejs.org/en/download). Download `YPanel.zip` from [Releases](https://github.com/cygbs/YPanel/releases), and after decompressing, `dist` is the Hub part, `dist-node` is the Node part. They need to be used together.

The startup method is: first enter the `dist` directory and execute `node index.js` to start the Hub, then add and obtain the Node startup command within the Hub, and finally run the Node startup command in the `dist-node` folder. The node will connect shortly.

You need one Hub and at least one Node to use this panel. **Never run the panel or instances using accounts like root, Administrator, or SYSTEM! This puts you at risk. If you installed via the one-click script, it creates and runs under a low-privilege user by default. Also, make sure to put the panel behind HTTPS (via nginx or similar HTTP server software). Even a self-signed certificate is much better than exposing plain HTTP to the public internet. Ideally, configure a certificate from Let's Encrypt (you can use an auto-renewal tool like acme.sh).**

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
- Use [Bubblewrap](https://github.com/containers/bubblewrap) to provide container functionality instead of Docker. This panel will not support Docker, as the author believes it is not well-suited for MC servers.

## License

GNU AGPLv3 or any later version.

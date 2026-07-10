# YPanel
A web panel for Minecraft server.

![YPanel Logo](public/favicon.webp)

[English README](https://github.com/cygbs/YPanel/blob/main/README_EN.md)

这是一个简单的网页面板，适用于Minecraft服务器，或者是别的什么程序。它使用TypeScript、Vue.js等编写。实例图标来自[Prism Launcher](https://prismlauncher.org)，整体上也参考了它的设计。

## 特点

### 优势

- 极简，占用低、加载速度快。操作逻辑简单直观。
- 支持控制多个服务器，并且面板本身只需要占用一台服务器的一个端口。
- 不仅仅是Minecraft服务器，理论上支持所有控制台程序。
- 跨平台兼容，可以在多台不同架构、不同系统的服务器上安装。
- 安全性，支持设置安全入口。

### 和其他面板相比……

| 特性 | 其他面板 | YPanel |
| :--- | :----: | ---: |
| 多用户 | ✓ | ✗ |
| Docker支持 | ✓ | ✗ |
| 加载速度 | ✗ | ✓ |
| 文档 | ✓ | ✗ |
| API | ✓ | ✗ |
| 节点终端 | ✓ | ✓（更便捷） |
| 实例/模板市场 | ✓ | ✗ |
| 一键脚本 | ✓ | ✓ |
| 安全入口 | ✗ | ✓ |
| 体积 | ✗ | ✓ |
| 多语言 | ✓ | ✓ |
| 跨平台 | ✓ | ✓ |
| NAT友好 | ✗ | ✓ |

## 运行

**一键脚本：**

```bash
curl -fsSL https://raw.githubusercontent.com/cygbs/YPanel/refs/heads/main/scripts/install.sh | sudo bash
```

这个脚本目前需要使用systemd的功能，如果你的系统没有，请使用下面的手动方式，并自己编写启动脚本。使用一键脚本时，请确保你的网络连接畅通。

**一键卸载：**

```bash
curl -fsSL https://raw.githubusercontent.com/cygbs/YPanel/refs/heads/main/scripts/uninstall.sh | sudo bash
```

卸载脚本只能卸载使用安装脚本安装的YPanel，其余情况可能无法处理。

**手动方式：**

先确保有Node.js环境，请[安装好Node.js环境](https://nodejs.org/zh-cn/download)。从[Releases](https://github.com/cygbs/YPanel/releases)下载`YPanel.zip`，解压之后，`dist`是`Hub`部分，`dist-node`是`Node`部分，需要配合使用。

启动方法是，先进入`dist`目录执行`node index.js`启动Hub，然后在Hub中添加并获取Node端的启动命令，接着在`dist-node`文件夹中运行Node端启动命令，很快节点就能够连接上。

你需要一个Hub和一个及以上的Node端来使用这个面板。**绝对不要使用root或者Administrator、SYSTEM这样的账户来运行面板和实例！这会将你置于危险之中。**

## 编译

```bash
git clone git@github.com:cygbs/YPanel.git --depth 1
cd YPanel
npm i
npm run build
```

## TODO

- 实现插件系统。
- 完善文档。
- 提供一个简单明了的外部API，便于与其他程序联动。
- 提供一键安装脚本。
- 使用[Bubblewrap](https://github.com/containers/bubblewrap)提供容器功能，而不是Docker。这个面板不会支持Docker，因为作者认为它并不那么适合MC服务端。

## 许可证

GNU AGPLv3以及它的更高版本。

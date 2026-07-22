# YPanel
A web panel for Minecraft server.

![YPanel Logo](public/favicon.webp)

[English README](https://github.com/cygbs/YPanel/blob/main/README_EN.md) | [npm包](https://www.npmjs.com/package/ypanel)

这是一个简单的网页面板，适用于Minecraft服务器，或者是别的什么程序。它使用TypeScript、Vue.js等编写。实例图标来自[Prism Launcher](https://prismlauncher.org)，整体上也参考了它的设计。项目使用`deepseek-v4-flash`和`deepseek-v4-pro`模型辅助创作。

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
| 节点终端 | ✓ | ✓ |
| 实例/模板市场 | ✓ | ✗ |
| 文件管理 | ✓ | ✓ |
| UI自定义 | ✓ | ✗ |
| 一键脚本 | ✓ | ✓ |
| 安全入口 | ✗ | ✓ |
| 体积 | ✗ | ✓ |
| 多语言 | ✓ | ✓ |
| 跨平台 | ✓ | ✓ |
| NAT友好 | ✗ | ✓ |

## 运行

你现在可以通过npm来安装YPanel！这可能是你从未在其他面板上见到过的。只需要简单执行：

```bash
npm i -g ypanel
ypanel
```

你需要一个Hub和一个及以上的Node端来使用这个面板，在不同机器上安装Node.js，然后安装Node包，使用`ypanel`命令启动Hub，在Hub中添加节点即可获得节点启动命令。

**绝对不要使用root或者Administrator、SYSTEM这样的账户来运行面板和实例！这会将你置于危险之中。也请一定记得给面板套HTTPS（通过nginx等HTTP服务器软件），即使是自签名证书也会比HTTP直接暴露在公网好很多，最好配置一份来自Let's Encrypt的证书（可以使用acme.sh这样的自动续期程序）。**

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
- 使用[Bubblewrap](https://github.com/containers/bubblewrap)提供容器功能，而不是Docker。这个面板不会支持Docker，因为作者认为它并不那么适合MC服务端。

## 许可证

GNU AGPLv3以及它的更高版本。

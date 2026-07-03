# YPanel
A web panel for Minecraft server.

这是一个简单的网页面板，适用于Minecraft服务器，或者是别的什么程序。它使用TypeScript、Vue.js等编写。实例图标来自[Prism Launcher](https://prismlauncher.org)，整体上也参考了它的设计。

## 优势

- 极简，占用低、加载速度快。
- 支持控制多个服务器，并且面板本身只需要占用一台服务器的一个端口。
- 不仅仅是Minecraft服务器，理论上支持所有控制台程序。

你可以[在这里](https://github.com/cygbs/YPanel/tree/main/images)预览这个面板。

## 编译运行

要编译这个程序，请[安装好Node.js环境](https://nodejs.org/zh-cn/download)，然后执行`npm i`和`npm run build`命令。结束后，`dist`是本程序的`Hub`部分，而`dist-node`是`Node`部分。

`Hub`的作用是提供面板，`Node`的作用是实际管理实例。运行`Node`的服务器可以位于NAT后而不影响控制。只需要`Hub`暴露一个端口即可。你需要手动连接`Hub`与`Node`这两个部分。

如果你使用的系统不是GNU/Linux，你可能需要重新编译这个项目，目前Releases中的版本可能无法运行。

## todo

- 实现登录系统。
- 实现插件系统。

## 许可证

GNU AGPLv3以及它的更高版本。

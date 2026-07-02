# YPanel
A web panel for Minecraft server.

这是一个简单的网页面板，适用于Minecraft服务器，或者是别的什么程序。它使用TypeScript、Vue.js等编写。

要编译这个程序，请[安装好Node.js环境](https://nodejs.org/zh-cn/download)，然后执行`npm run build`命令。

## todo

- 将程序分为两个部分：`hub`和`node`，前者负责提供网页面板，后者负责实际控制服务器。`hub`有一个WS路径可供`node`连接，这样即使`node`在NAT后面也无关紧要。用户访问`hub`即可看到面板界面，并在界面中添加运行着`node`的服务器并控制它们。
- 实现登录系统。
- 实现插件系统。

## 许可证

GNU AGPLv3以及它的更高版本。

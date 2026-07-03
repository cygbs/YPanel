# YPanel
A web panel for Minecraft server.

这是一个简单的网页面板，适用于Minecraft服务器，或者是别的什么程序。它使用TypeScript、Vue.js等编写。实例图标来自[Prism Launcher](https://prismlauncher.org)，整体上也参考了它的设计。

## 优势

- 极简，占用低、加载速度快。操作逻辑简单直观。
- 支持控制多个服务器，并且面板本身只需要占用一台服务器的一个端口。
- 不仅仅是Minecraft服务器，理论上支持所有控制台程序。
- 跨平台兼容。

你可以[在这里](https://github.com/cygbs/YPanel/tree/main/images)预览这个面板。

## 运行

无论如何，先确保有Node.js环境。请[安装好Node.js环境](https://nodejs.org/zh-cn/download)。

如果你的系统有systemd，**使用下面的命令一键安装：**

```bash
curl https://raw.githubusercontent.com/cygbs/YPanel/refs/heads/main/setup.sh | bash
```

请先按1配置`Hub`，然后新建节点并复制命令，按2再粘贴进去来配置`Node`，等待节点出现后关闭对话框即可。**绝对不要使用root权限运行安装脚本和面板！运行面板的账户最好保证权限最小化。**

**手动：**

从[Releases](https://github.com/cygbs/YPanel/releases)下载`YPanel.zip`，解压之后，`dist`是`Hub`部分，`dist-node`是`Node`部分，需要配合使用。启动方法是`node index.js`。

## 编译

要编译这个程序，请[安装好Node.js环境](https://nodejs.org/zh-cn/download)，然后执行`npm i`和`npm run build`命令。结束后，`dist`是本程序的`Hub`部分，而`dist-node`是`Node`部分。

`Hub`的作用是提供面板，`Node`的作用是实际管理实例。运行`Node`的服务器可以位于NAT后而不影响控制。只需要`Hub`暴露一个端口即可。你需要手动连接`Hub`与`Node`这两个部分。

## todo

- 实现插件系统。

## 许可证

GNU AGPLv3以及它的更高版本。

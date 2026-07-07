# YPanel
A web panel for Minecraft server.

这是一个简单的网页面板，适用于Minecraft服务器，或者是别的什么程序。它使用TypeScript、Vue.js等编写。实例图标来自[Prism Launcher](https://prismlauncher.org)，整体上也参考了它的设计。

## 特点

### 优势

- 极简，占用低、加载速度快。操作逻辑简单直观。
- 支持控制多个服务器，并且面板本身只需要占用一台服务器的一个端口。
- 不仅仅是Minecraft服务器，理论上支持所有控制台程序。
- 跨平台兼容，可以在多台不同架构、不同系统的服务器上安装。

### 劣势

- 单用户设计（未来可能会增加多用户支持）。
- 不支持Docker、不支持实例模板等（这些确实不在这个程序的设计中）。
- 还没有API文档和用户文档（之后补上）。

### 和其他面板相比……

那为什么要用这个面板呢？因为它的设计更适合专业用户和小白，操作不繁琐，也没有用不上的功能，从设计之初就注重减少攻击面、让程序本身更安全。

一些面板单单是加载登录界面就需要消耗2~3秒，这个面板应该能确保加载时间小于一秒。它更不会替用户自作主张。

如果你有一些服务器，那么用这个面板是很合适的，它不像别的面板那样要求节点暴露WS或者HTTP端口，所以即使节点在NAT后也可以进行控制。

## 运行

无论如何，先确保有Node.js环境。请[安装好Node.js环境](https://nodejs.org/zh-cn/download)。

**手动方式：**

从[Releases](https://github.com/cygbs/YPanel/releases)下载`YPanel.zip`，解压之后，`dist`是`Hub`部分，`dist-node`是`Node`部分，需要配合使用。

启动方法是，先进入`dist`目录执行`node index.js`启动Hub，然后在Hub中添加并获取Node端的启动命令，接着在`dist-node`文件夹中运行Node端启动命令，很快节点就能够连接上。

你需要一个Hub和一个及以上的Node端来使用这个面板。**绝对不要使用root或者Administrator、SYSTEM这样的账户来运行面板和实例！这会将你置于危险之中。**

## 编译

要编译这个程序，请[安装好Node.js环境](https://nodejs.org/zh-cn/download)，然后执行`npm i`和`npm run build`命令。对，就这么简单。

## todo

- 实现插件系统。
- 实现i18n。
- 完善文档。
- 提供一个简单明了的外部API，便于与其他程序联动。
- 提供一键安装脚本。
- 使用[Bubblewrap](https://github.com/containers/bubblewrap)提供容器功能，而不是Docker。这个面板不会支持Docker，因为作者认为它并不那么适合MC服务端。

## 许可证

GNU AGPLv3以及它的更高版本。

#!/bin/bash

export YPANEL_VER=1.3.5

# 定义需要检查的命令列表
commands=("curl" "unzip" "systemctl" "node")

# 标记是否缺失
missing=0

for cmd in "${commands[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "错误：未找到必需的命令 '$cmd'，请先安装后再运行本脚本。" >&2
        missing=1
    fi
done

# 如果有命令缺失，退出并返回错误码 1
if [ $missing -eq 1 ]; then
    exit 1
fi

echo "所有必需命令均已找到，继续……"

# 判断是否需要下载
if [ -d "$HOME/.ypanel" ]; then
    echo "检测到 ~/.ypanel 目录已存在，跳过下载与解压。"
    DOWNLOAD_REQUIRED=false
else
    DOWNLOAD_REQUIRED=true
fi

# 下载与解压
if $DOWNLOAD_REQUIRED; then
    echo "开始安装 YPanel $YPANEL_VER 版"
    mkdir -p ~/.ypanel
    curl -L -o ~/.ypanel/YPanel.zip https://github.com/cygbs/YPanel/releases/download/$YPANEL_VER/YPanel.zip
    cd ~/.ypanel
    unzip -o YPanel.zip
    rm -f YPanel.zip
fi

# 组件选择菜单
echo "请选择要安装的组件:"
echo "1) hub  (Web 控制台, 通过 systemd --user 管理)"
echo "2) node (节点端, 通过 systemd --user 管理)"
read -p "请输入数字 [1-2]: " choice

case $choice in
  1)
    # ---------- 安装 hub ----------
    # 若刚刚解压，则整理目录
    if [ -d "$HOME/.ypanel/dist" ]; then
        mv "$HOME/.ypanel/dist" "$HOME/.ypanel/hub"
        rm -rf "$HOME/.ypanel/dist-node"
    fi

    if [ ! -f "$HOME/.ypanel/hub/index.js" ]; then
        echo "错误: hub 核心文件缺失（~/.ypanel/hub/index.js）。"
        echo "请删除 ~/.ypanel 目录后重新运行脚本。"
        exit 1
    fi

    mkdir -p ~/.config/systemd/user
    cat > ~/.config/systemd/user/ypanel-hub.service <<EOF
[Unit]
Description=YPanel Hub Web Console
After=network.target

[Service]
Type=simple
WorkingDirectory=$HOME/.ypanel/hub
ExecStart=/usr/bin/node $HOME/.ypanel/hub/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable --now ypanel-hub.service
    echo "hub 安装完成！服务已启动。"
    echo "获取随机初始密码: systemctl --user status ypanel-hub"
    ;;

  2)
    # ---------- 安装 node ----------
    # 确保 node 目录存在
    if [ -d "$HOME/.ypanel/dist-node" ]; then
        mv "$HOME/.ypanel/dist-node" "$HOME/.ypanel/node"
        rm -rf "$HOME/.ypanel/dist"
    fi

    if [ ! -f "$HOME/.ypanel/node/index.js" ]; then
        echo "错误: node 核心文件缺失（~/.ypanel/node/index.js）。"
        echo "请删除 ~/.ypanel 目录后重新运行脚本，或手动放置 node 文件。"
        exit 1
    fi

    # 获取节点连接参数
    echo "请从 hub 管理界面复制节点连接参数（以 -s 开头的一串参数）"
    echo "示例: -s ws://192.168.0.232:6699/link -t 317ad2c9-..."
    read -p "粘贴参数: " node_args

    if [ -z "$node_args" ]; then
        echo "错误: 参数不能为空。"
        exit 1
    fi

    mkdir -p ~/.config/systemd/user
    cat > ~/.config/systemd/user/ypanel-node.service <<EOF
[Unit]
Description=YPanel Node
After=network.target

[Service]
Type=simple
WorkingDirectory=$HOME/.ypanel/node
ExecStart=/usr/bin/node $HOME/.ypanel/node/index.js $node_args
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable --now ypanel-node.service
    echo "node 安装完成！服务已启动。"
    echo "查看状态: systemctl --user status ypanel-node"
    ;;

  *)
    echo "无效选择，退出。"
    exit 1
    ;;
esac

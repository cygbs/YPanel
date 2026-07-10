#!/bin/bash
#
# YPanel 自动安装脚本
# 支持 systemd 的 Linux 发行版
#
set -euo pipefail

# ── 颜色定义 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# ═══════════════════════════════════════════════════
# 前置检查
# ═══════════════════════════════════════════════════

# 1. root 权限检查
if [ "$(id -u)" -ne 0 ]; then
    error "此脚本需要 root 权限运行，请使用 sudo 或以 root 用户执行。"
    exit 1
fi

# 2. ypanel 用户存在性检查
if id "ypanel" &>/dev/null; then
    error "系统中已存在 ypanel 用户。"
    echo "  如果已安装 YPanel，请直接使用。如需重装，请先删除用户："
    echo "    userdel -r ypanel"
    echo "    rm -rf /opt/ypanel"
    exit 1
fi

# 3. systemd 检查
if ! command -v systemctl &>/dev/null; then
    error "未检测到 systemd。此脚本仅支持 systemd 的 Linux 发行版。"
    exit 1
fi

# 4. 确认安装
echo ""
#!/bin/bash
#
# YPanel 自动安装脚本
# 支持 systemd 的 Linux 发行版
#
# 用法：curl -o- https://raw.githubusercontent.com/cygbs/YPanel/refs/heads/main/scripts/install.sh | sudo bash
#

# 确保能从终端读取用户输入（防止 pipe 到 bash 时 read 从 stdin 读）
if [ -t 0 ]; then
    READ_CMD() { read -r "$@"; }
else
    READ_CMD() { read -r "$@" < /dev/tty; }
fi

set -euo pipefail

# ── 颜色定义 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# ═══════════════════════════════════════════════════
# 前置检查
# ═══════════════════════════════════════════════════

# 1. root 权限检查
if [ "$(id -u)" -ne 0 ]; then
    error "此脚本需要 root 权限运行，请使用 sudo 或以 root 用户执行。"
    exit 1
fi

# 2. ypanel 用户存在性检查
if id "ypanel" &>/dev/null; then
    error "系统中已存在 ypanel 用户。"
    echo "  如果已安装 YPanel，请直接使用。如需重装，请先删除用户："
    echo "    userdel -r ypanel"
    echo "    rm -rf /opt/ypanel"
    exit 1
fi

# 3. systemd 检查
if ! command -v systemctl &>/dev/null; then
    error "未检测到 systemd。此脚本仅支持 systemd 的 Linux 发行版。"
    exit 1
fi

# 4. 确认安装
echo ""
printf '%b' "${YELLOW}是否安装 YPanel？${NC} (y/N): "
READ_CMD confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    info "安装已取消。"
    exit 0
fi

# ═══════════════════════════════════════════════════
# 创建 ypanel 用户
# ═══════════════════════════════════════════════════

step "创建 ypanel 系统用户"

# 锁定 SSH 登录：shell 设为 /usr/sbin/nologin，如果该路径不存在则回退
NOLOGIN="/usr/sbin/nologin"
[ ! -x "$NOLOGIN" ] && NOLOGIN="/sbin/nologin"
[ ! -x "$NOLOGIN" ] && NOLOGIN="/bin/false"

useradd -m -s "$NOLOGIN" ypanel
# 锁定密码（进一步禁止 SSH 密码登录）
passwd -l ypanel &>/dev/null || true

# 移除 sudo 权限（从 sudo 和 wheel 组中删除）
for grp in sudo wheel; do
    if getent group "$grp" &>/dev/null; then
        gpasswd -d ypanel "$grp" &>/dev/null || true
    fi
done

info "ypanel 用户已创建"
info "  SSH 登录已禁止（shell: $NOLOGIN，密码已锁定）"
info "  sudo 权限已移除"

# ═══════════════════════════════════════════════════
# 安装 nvm + Node.js
# ═══════════════════════════════════════════════════

step "安装 nvm 和 Node.js 24"

sudo -u ypanel bash <<'SCRIPT'
    export NVM_DIR="$HOME/.nvm"
    # 安装 nvm
    curl -s -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    # 加载 nvm 并安装 Node.js 24
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 24
SCRIPT

# 获取 Node.js 可执行路径
NODE_BIN=$(sudo -u ypanel bash -c 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm which 24' 2>/dev/null || true)

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
    error "Node.js 安装失败，请检查网络后重试。"
    exit 1
fi

info "Node.js 已安装: $("$NODE_BIN" --version)"

# ═══════════════════════════════════════════════════
# 下载并部署 YPanel
# ═══════════════════════════════════════════════════

step "下载 YPanel 最新版"

DOWNLOAD_URL="https://github.com/cygbs/YPanel/releases/latest/download/YPanel.zip"
TMP_ZIP="/tmp/YPanel.zip"
TMP_DIR="/tmp/YPanel-extract"

curl -sL "$DOWNLOAD_URL" -o "$TMP_ZIP"
info "下载完成，解压中..."
rm -rf "$TMP_DIR"
unzip -q "$TMP_ZIP" -d "$TMP_DIR"
info "解压完成"

# 检查解压结构
if [ ! -d "$TMP_DIR/dist" ] || [ ! -d "$TMP_DIR/dist-node" ]; then
    error "解压后未找到 dist 或 dist-node 目录，文件结构异常。"
    rm -rf "$TMP_ZIP" "$TMP_DIR"
    exit 1
fi

step "部署到 /opt/ypanel"

mkdir -p /opt/ypanel
mv "$TMP_DIR/dist"       /opt/ypanel/dist
mv "$TMP_DIR/dist-node"  /opt/ypanel/dist-node
chown -R ypanel:ypanel /opt/ypanel

# 清理临时文件
rm -rf "$TMP_ZIP" "$TMP_DIR"
info "文件已部署到 /opt/ypanel"

# ═══════════════════════════════════════════════════
# 配置 Hub systemd --user 服务
# ═══════════════════════════════════════════════════

step "配置 YPanel Hub 系统服务"

# 辅助函数：以 ypanel 身份执行 systemctl --user
as_ypanel() {
    local uid
    uid=$(id -u ypanel)
    sudo -u ypanel XDG_RUNTIME_DIR="/run/user/$uid" "$@"
}

# 启用用户 linger，使服务随系统启动，无需用户登录
loginctl enable-linger ypanel

# enable-linger 启动 user manager 是异步的，需要等待 bus 就绪
info "等待 ypanel 用户的 systemd 管理器就绪..."
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if as_ypanel systemctl --user is-system-running 2>/dev/null; then
        break
    fi
    sleep 1
done

# 创建 systemd user 服务目录
sudo -u ypanel mkdir -p /home/ypanel/.config/systemd/user

# Hub 服务
cat > /home/ypanel/.config/systemd/user/ypanel-hub.service <<SERVICE
[Unit]
Description=YPanel Hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/ypanel/dist
ExecStart=$NODE_BIN /opt/ypanel/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
SERVICE

info "Hub 服务文件已创建"

# 重载并启动
as_ypanel systemctl --user daemon-reload
as_ypanel systemctl --user enable --now ypanel-hub

info "YPanel Hub 服务已启动"

# ═══════════════════════════════════════════════════
# 显示初始密码
# ═══════════════════════════════════════════════════

step "首次启动 — 检查初始密码"

# 等待服务输出
sleep 3

echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  以下是 YPanel Hub 的启动日志，请查找初始密码：${NC}"
echo -e "${YELLOW}  （密码在 Random password: 后面）${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
echo ""

# 尝试多种方式读取日志
HUB_LOG=""
HUB_LOG=$(as_ypanel journalctl --user -u ypanel-hub --no-pager -n 30 -o short 2>/dev/null || true)

if [ -n "$HUB_LOG" ]; then
    echo "$HUB_LOG"
else
    # 备选：直接看 service 状态
    as_ypanel systemctl --user status ypanel-hub --no-pager -l 2>/dev/null || true
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
echo ""
info "请务必复制上方日志中的初始密码！"
info "面板地址: http://$(hostname -I | awk '{print $1}'):6699"
echo ""

# ═══════════════════════════════════════════════════
# 可选：配置 Node
# ═══════════════════════════════════════════════════

step "配置 Node 端（可选）"

printf '%b' "${YELLOW}是否需要配置 Node 端？${NC} (y/N): "
READ_CMD setup_node
if [[ ! "$setup_node" =~ ^[Yy]$ ]]; then
    info ""
    info "安装完成！后续可以用以下命令手动配置 Node 端："
    info "  sudo -u ypanel XDG_RUNTIME_DIR=/run/user/\$(id -u ypanel) systemctl --user enable --now ypanel-node"
    info ""
    echo -e "${GREEN}============================${NC}"
    echo -e "${GREEN}  YPanel 安装完成！${NC}"
    echo -e "${GREEN}============================${NC}"
    exit 0
fi

echo ""
info "请先在浏览器中登录 YPanel 面板 → 添加节点 → 复制启动命令"
echo ""
echo -e "${CYAN}将启动命令粘贴到下方（例如：node index.js -s ws://.../link -t <token>）${NC}"
echo -e "${CYAN}然后按回车确认：${NC}"
echo ""
printf "启动命令 > " && READ_CMD node_cmd

if [ -z "$node_cmd" ]; then
    error "命令不能为空，安装取消。"
    exit 1
fi

# 将用户粘贴的命令中的 node 替换为完整路径
node_cmd_fixed=$(echo "$node_cmd" | sed "s|^node |$NODE_BIN |")

# Node 服务
cat > /home/ypanel/.config/systemd/user/ypanel-node.service <<SERVICE
[Unit]
Description=YPanel Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/ypanel/dist-node
ExecStart=$node_cmd_fixed
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
SERVICE

info "Node 服务文件已创建"

# 重载并启动
as_ypanel systemctl --user daemon-reload
as_ypanel systemctl --user enable --now ypanel-node

info "YPanel Node 服务已启动"

# ═══════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     YPanel 安装完成！                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
info "服务管理命令："
echo ""
echo "  Hub 服务:"
echo "    journalctl --user -u ypanel-hub        # 查看日志"
echo "    systemctl --user restart ypanel-hub    # 重启"
echo ""
echo "  Node 服务:"
echo "    journalctl --user -u ypanel-node       # 查看日志"
echo "    systemctl --user restart ypanel-node   # 重启"
echo ""
info "注意：使用 sudo -u ypanel 加环境变量来执行以上 systemctl --user 命令"
echo "  完整示例："
echo "    sudo -u ypanel XDG_RUNTIME_DIR=/run/user/\$(id -u ypanel) systemctl --user status ypanel-hub"
echo ""

#!/bin/bash
#
# YPanel 卸载脚本
#

# 从终端读取用户输入（解决 pipe 到 bash 时 stdin 被管道占用的问题）
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

# 2. 检查 ypanel 用户是否存在
YPANEL_EXISTS=false
if id "ypanel" &>/dev/null; then
    YPANEL_EXISTS=true
    YPANEL_UID=$(id -u ypanel)
    YPANEL_RUNTIME_DIR="/run/user/$YPANEL_UID"
fi

# 3. 检查是否真的安装了 YPanel
if [ ! -d "/opt/ypanel" ] && ! $YPANEL_EXISTS; then
    error "未检测到 YPanel 安装（/opt/ypanel 不存在，且无 ypanel 用户）。"
    exit 1
fi

# 4. 确认卸载
echo ""
printf '%b' "${YELLOW}确定要卸载 YPanel？此操作不可恢复！${NC} (y/N): "
READ_CMD confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    info "卸载已取消。"
    exit 0
fi

echo ""
warn "即将执行卸载，正在停止所有 YPanel 服务..."
echo ""

# ═══════════════════════════════════════════════════
# 停止服务
# ═══════════════════════════════════════════════════

step "停止 YPanel 服务"

if $YPANEL_EXISTS && [ -d "$YPANEL_RUNTIME_DIR" ]; then
    # 辅助函数：以 ypanel 身份运行命令
    as_ypanel() {
        sudo -u ypanel XDG_RUNTIME_DIR="$YPANEL_RUNTIME_DIR" "$@"
    }

    # 强制停止并禁用 ypanel-node
    info "停止 ypanel-node 服务..."
    as_ypanel systemctl --user stop ypanel-node 2>/dev/null || true
    as_ypanel systemctl --user disable ypanel-node 2>/dev/null || true

    # 强制停止并禁用 ypanel-hub
    info "停止 ypanel-hub 服务..."
    as_ypanel systemctl --user stop ypanel-hub 2>/dev/null || true
    as_ypanel systemctl --user disable ypanel-hub 2>/dev/null || true

    # 删除服务文件
    info "删除 systemd 用户服务文件..."
    sudo -u ypanel rm -f /home/ypanel/.config/systemd/user/ypanel-hub.service
    sudo -u ypanel rm -f /home/ypanel/.config/systemd/user/ypanel-node.service
    sudo -u ypanel rmdir /home/ypanel/.config/systemd/user 2>/dev/null || true
    sudo -u ypanel rmdir /home/ypanel/.config/systemd 2>/dev/null || true
    sudo -u ypanel rmdir /home/ypanel/.config 2>/dev/null || true

    # 重载 daemon
    as_ypanel systemctl --user daemon-reload 2>/dev/null || true

    # 禁用 linger
    info "禁用 ypanel 用户自启动（linger）..."
    loginctl disable-linger ypanel 2>/dev/null || true

    info "服务已全部停止。"
else
    warn "ypanel 用户或 runtime 目录不存在，跳过服务停止步骤。"
fi

# ═══════════════════════════════════════════════════
# 删除文件
# ═══════════════════════════════════════════════════

step "删除安装文件"

echo ""
echo -e "${RED}以下目录将被永久删除：${NC}"
echo "  - /opt/ypanel"
if $YPANEL_EXISTS; then
    echo "  - /home/ypanel（用户主目录，含 nvm/Node.js 及所有数据）"
fi
echo ""
printf '%b' "${YELLOW}确认删除以上目录？${NC} (y/N): "
READ_CMD confirm_dirs
if [[ ! "$confirm_dirs" =~ ^[Yy]$ ]]; then
    warn "目录删除已跳过。请手动清理："
    echo "  rm -rf /opt/ypanel"
    $YPANEL_EXISTS && echo "  userdel -r ypanel"
    exit 1
fi

# 删除 /opt/ypanel
if [ -d "/opt/ypanel" ]; then
    rm -rf /opt/ypanel
    info "/opt/ypanel 已删除。"
fi

# ═══════════════════════════════════════════════════
# 删除用户
# ═══════════════════════════════════════════════════

step "删除 ypanel 用户"

if $YPANEL_EXISTS; then
    echo ""
    printf '%b' "${YELLOW}是否删除 ypanel 用户（包括 /home/ypanel）？${NC} (y/N): "
    READ_CMD confirm_user
    if [[ "$confirm_user" =~ ^[Yy]$ ]]; then
        # 确保所有进程已终止
        pkill -u ypanel 2>/dev/null || true
        sleep 1
        userdel -r ypanel 2>/dev/null || {
            warn "无法删除 ypanel 用户（可能仍有进程占用），尝试强制退出..."
            # 尝试强制终止所有进程后重试
            killall -u ypanel 2>/dev/null || true
            sleep 2
            userdel -r ypanel 2>/dev/null || {
                error "删除 ypanel 用户失败，请手动处理："
                echo "  userdel -r ypanel"
                echo "  如果提示进程占用，先运行: killall -u ypanel"
            }
        }
        info "ypanel 用户已删除。"
    else
        warn "ypanel 用户已保留。如需手动删除："
        echo "  userdel -r ypanel"
    fi
fi

# ═══════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  YPanel 已从本机卸载。              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"

# 检查是否还有遗留
if [ -d "/opt/ypanel" ] || id "ypanel" &>/dev/null; then
    warn "部分残留可能需要手动清理，请检查："
    [ -d "/opt/ypanel" ] && echo "  rm -rf /opt/ypanel"
    id "ypanel" &>/dev/null && echo "  userdel -r ypanel"
fi
echo ""

#!/usr/bin/env bash
#
# migrate-containerd-root.sh
# Safely moves containerd data from /var/lib/containerd (root partition)
# to /media/endlessblink/docker/containerd (docker partition with 343GB free)
#
# This frees ~160GB from root partition (/dev/sda6) which was hitting 100%
#
# WHAT THIS DOES:
#   1. Stops all Docker containers gracefully (Supabase, bots, etc.)
#   2. Stops Docker and containerd services
#   3. Copies containerd data to the docker partition
#   4. Updates containerd config to use new location
#   5. Restarts services and brings containers back up
#
# DOWNTIME: ~2-5 minutes (container stop + start)
# DATA SAFETY: Docker volumes are on /media/endlessblink/docker (untouched).
#              Only image layers/cache are moved.
#
# ROLLBACK: If anything fails, the script restores the original config
#           and restarts services from the old location.
#
# Usage: sudo bash scripts/migrate-containerd-root.sh
#

set -euo pipefail

# --- Configuration ---
OLD_ROOT="/var/lib/containerd"
NEW_ROOT="/media/endlessblink/docker/containerd"
CONFIG="/etc/containerd/config.toml"
CONFIG_BACKUP="/etc/containerd/config.toml.backup-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/tmp/containerd-migration-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $*" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[✗]${NC} $*" | tee -a "$LOG_FILE"; }

# --- Pre-flight checks ---
preflight() {
    echo "============================================"
    echo "  Containerd Root Migration"
    echo "  ${OLD_ROOT} → ${NEW_ROOT}"
    echo "============================================"
    echo ""

    # Must be root
    if [ "$(id -u)" -ne 0 ]; then
        err "Must run as root (sudo)"
        exit 1
    fi

    # Check source exists
    if [ ! -d "$OLD_ROOT" ]; then
        err "Source directory $OLD_ROOT does not exist"
        exit 1
    fi

    # Check target partition is mounted
    if ! mountpoint -q /media/endlessblink/docker; then
        err "/media/endlessblink/docker is not mounted!"
        exit 1
    fi

    # Check target partition has enough space
    local source_size_kb
    source_size_kb=$(du -sk "$OLD_ROOT" 2>/dev/null | awk '{print $1}')
    local target_free_kb
    target_free_kb=$(df -k /media/endlessblink/docker | tail -1 | awk '{print $4}')

    local source_gb=$(( source_size_kb / 1024 / 1024 ))
    local target_free_gb=$(( target_free_kb / 1024 / 1024 ))

    log "Source size: ${source_gb}GB  |  Target free: ${target_free_gb}GB"

    if [ "$source_size_kb" -gt "$target_free_kb" ]; then
        err "Not enough space on target partition!"
        err "Need ${source_gb}GB but only ${target_free_gb}GB free"
        exit 1
    fi

    # Check containerd config exists
    if [ ! -f "$CONFIG" ]; then
        err "Containerd config not found at $CONFIG"
        exit 1
    fi

    # Show current disk usage
    echo ""
    log "Current root partition usage:"
    df -h / | tail -1 | awk '{printf "    %s used of %s (%s)\n", $3, $2, $5}'
    echo ""

    # Show what will be affected
    log "Running containers that will be stopped:"
    docker ps --format "    {{.Names}}" 2>/dev/null || true
    echo ""

    # Confirmation
    echo -e "${YELLOW}This will:${NC}"
    echo "  1. Stop ALL running Docker containers"
    echo "  2. Stop Docker and containerd services"
    echo "  3. Copy ~${source_gb}GB of data (may take a few minutes)"
    echo "  4. Update containerd config"
    echo "  5. Restart everything"
    echo ""
    echo -e "${YELLOW}Estimated downtime: 2-5 minutes${NC}"
    echo ""
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
}

# --- Rollback function ---
rollback() {
    err "Migration failed! Rolling back..."

    # Restore config backup if it exists
    if [ -f "$CONFIG_BACKUP" ]; then
        cp "$CONFIG_BACKUP" "$CONFIG"
        log "Restored original config"
    fi

    # Restart services with original config
    warn "Restarting services with original location..."
    systemctl start containerd 2>/dev/null || true
    systemctl start docker 2>/dev/null || true

    # Wait for docker to be ready
    local retries=0
    while ! docker info &>/dev/null && [ $retries -lt 30 ]; do
        sleep 1
        retries=$((retries + 1))
    done

    # Restart containers
    restart_containers

    err "Rollback complete. Root partition still has containerd data."
    err "Check log at: $LOG_FILE"
    exit 1
}

# --- Restart all compose projects ---
restart_containers() {
    log "Restarting Docker Compose projects..."

    # Supabase (via CLI)
    if command -v supabase &>/dev/null; then
        local supabase_dir="/media/endlessblink/data/my-projects/ai-development/productivity/flow-state"
        if [ -f "$supabase_dir/supabase/config.toml" ]; then
            log "  Starting Supabase..."
            (cd "$supabase_dir" && supabase start 2>/dev/null) || warn "  Supabase start failed — may need manual 'supabase start'"
        fi
    fi

    # All other compose projects
    local compose_files=(
        "/media/endlessblink/data/my-projects/ai-development/productivity/flow-state/docker-compose.yml"
        "/home/endlessblink/my-projects/linux-docker/compose/dockge/docker-compose.yml"
        "/home/endlessblink/app-data/lobe-chat/docker-compose.yml"
        "/media/endlessblink/data/my-projects/ai-development/cc-linux-enhancments/n8n-docker/docker-compose.yml"
        "/home/endlessblink/my-projects/linux-docker/compose/portainer/docker-compose.yml"
        "/media/endlessblink/data/my-projects/ai-development/bots+automation/worlds-greatest-bot/docker-compose.yml"
    )

    for cf in "${compose_files[@]}"; do
        if [ -f "$cf" ]; then
            local dir
            dir=$(dirname "$cf")
            local name
            name=$(basename "$dir")
            log "  Starting $name..."
            (cd "$dir" && docker compose up -d 2>/dev/null) || warn "  Failed to start $name"
        fi
    done
}

# --- Main migration ---
main() {
    preflight

    # Set trap for rollback on failure
    trap rollback ERR

    # Step 1: Stop all containers gracefully
    log "Step 1/6: Stopping all Docker containers..."
    docker stop $(docker ps -q) 2>/dev/null || true
    sleep 2
    log "  All containers stopped"

    # Step 2: Stop services
    log "Step 2/6: Stopping Docker and containerd services..."
    systemctl stop docker.socket 2>/dev/null || true
    systemctl stop docker 2>/dev/null || true
    systemctl stop containerd 2>/dev/null || true
    sleep 2

    # Verify they're stopped
    if pgrep -x containerd &>/dev/null; then
        err "containerd is still running!"
        rollback
    fi
    log "  Services stopped"

    # Step 3: Backup config
    log "Step 3/6: Backing up containerd config..."
    cp "$CONFIG" "$CONFIG_BACKUP"
    log "  Config backed up to $CONFIG_BACKUP"

    # Step 4: Copy data
    log "Step 4/6: Copying containerd data to new location..."
    log "  Source: $OLD_ROOT"
    log "  Target: $NEW_ROOT"
    log "  This may take a few minutes..."

    mkdir -p "$NEW_ROOT"

    # Use rsync for reliable copy with progress
    rsync -aHAX --info=progress2 "$OLD_ROOT/" "$NEW_ROOT/" 2>&1 | tee -a "$LOG_FILE"

    log "  Copy complete"

    # Verify copy integrity (check file count matches)
    local src_count
    src_count=$(find "$OLD_ROOT" -type f 2>/dev/null | wc -l)
    local dst_count
    dst_count=$(find "$NEW_ROOT" -type f 2>/dev/null | wc -l)

    if [ "$src_count" -ne "$dst_count" ]; then
        err "File count mismatch! Source: $src_count, Target: $dst_count"
        rollback
    fi
    log "  Verified: $src_count files copied correctly"

    # Step 5: Update containerd config
    log "Step 5/6: Updating containerd config..."

    # Replace the commented-out root line with the new path
    if grep -q '#root = "/var/lib/containerd"' "$CONFIG"; then
        sed -i 's|#root = "/var/lib/containerd"|root = "'"$NEW_ROOT"'"|' "$CONFIG"
    elif grep -q 'root = "/var/lib/containerd"' "$CONFIG"; then
        sed -i 's|root = "/var/lib/containerd"|root = "'"$NEW_ROOT"'"|' "$CONFIG"
    else
        # Add root directive after the license header
        sed -i '/disabled_plugins/a root = "'"$NEW_ROOT"'"' "$CONFIG"
    fi

    # Verify config was updated
    if ! grep -q "root = \"$NEW_ROOT\"" "$CONFIG"; then
        err "Failed to update config!"
        rollback
    fi
    log "  Config updated: root = $NEW_ROOT"

    # Step 6: Restart services
    log "Step 6/6: Restarting services..."
    systemctl start containerd
    sleep 2

    # Verify containerd is using new root
    if ! systemctl is-active --quiet containerd; then
        err "containerd failed to start with new config!"
        rollback
    fi
    log "  containerd started"

    systemctl start docker
    sleep 3

    # Wait for docker to be ready
    local retries=0
    while ! docker info &>/dev/null && [ $retries -lt 30 ]; do
        sleep 1
        retries=$((retries + 1))
    done

    if ! docker info &>/dev/null; then
        err "Docker failed to start!"
        rollback
    fi
    log "  Docker started"

    # Remove error trap — we're past the critical section
    trap - ERR

    # Restart all containers
    restart_containers

    # Wait for containers to stabilize
    sleep 5

    # Summary
    echo ""
    echo "============================================"
    echo "  Migration Complete!"
    echo "============================================"
    echo ""
    log "Root partition usage (after):"
    df -h / | tail -1 | awk '{printf "    %s used of %s (%s)\n", $3, $2, $5}'
    echo ""
    log "Running containers:"
    docker ps --format "    {{.Names}} ({{.Status}})" 2>/dev/null
    echo ""

    # Remind about cleanup
    echo -e "${YELLOW}Old data still exists at $OLD_ROOT${NC}"
    echo -e "${YELLOW}Once you verify everything works, free ~160GB by running:${NC}"
    echo ""
    echo "    sudo rm -rf $OLD_ROOT"
    echo ""
    echo -e "${YELLOW}Log saved to: $LOG_FILE${NC}"
}

main "$@"

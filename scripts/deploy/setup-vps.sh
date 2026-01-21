#!/bin/bash
# VPS Setup Script - Installs Docker & Essentials
# Usage: ./scripts/deploy/setup-vps.sh [USER@HOST]

VPS_TARGET=${1:-"root@84.46.253.137"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "🔧 ${GREEN}Setting up VPS at $VPS_TARGET...${NC}"

ssh $VPS_TARGET "
    # Prevent interactive prompts
    export DEBIAN_FRONTEND=noninteractive

    echo 'Updating system...'
    apt-get update && apt-get upgrade -y
    
    echo 'Installing essentials...'
    apt-get install -y curl git ufw

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo 'Installing Docker...'
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
    else
        echo 'Docker already installed.'
    fi

    echo 'Configuring Firewall...'
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable

    echo 'Setup Complete!'
"

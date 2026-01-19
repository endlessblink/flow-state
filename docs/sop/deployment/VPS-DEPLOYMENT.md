# VPS Deployment Guide for FlowState

This guide describes how to deploy FlowState to a Linux VPS (Ubuntu 22.04+ recommended) using Docker and Caddy.

## Prerequisites

1.  **Linux VPS** with public IP.
2.  **Domain Name** pointing to the VPS IP.
3.  **Docker & Docker Compose** installed on the VPS.
4.  **GitHub Secrets** configured:
    *   `VPS_HOST`
    *   `VPS_USERNAME`
    *   `VPS_SSH_KEY` (Private key)

## Initial Setup on VPS

1.  **Clone the Repository**:
    ```bash
    cd /opt
    sudo git clone https://github.com/endlessblink/flow-state.git
    cd flow-state
    ```

2.  **Configure Environment**:
    Create a `.env` file based on `.env.example`.
    ```bash
    cp .env.example .env
    nano .env
    # Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY etc.
    ```

3.  **Prepare Caddy**:
    Edit `Caddyfile` and replace `:80` with your actual domain name (e.g., `flowstate.app`).
    ```bash
    nano Caddyfile
    ```

4.  **Initial Launch**:
    ```bash
    docker compose -f docker-compose.prod.yml up -d
    ```

## Automated Deployment

The `.github/workflows/deploy.yml` file handles updates automatically on push to `main`.

It performs:
1.  SSH into VPS.
2.  `git pull` latest code.
3.  `docker compose down` & `up` to rebuild.

## Rollback Procedure

If a bad deployment occurs:

1.  **SSH into VPS**:
    ```bash
    ssh user@vps-ip
    cd /opt/flow-state
    ```

2.  **Revert Code**:
    ```bash
    git log --oneline
    git reset --hard <commit-hash-of-last-good-version>
    ```

3.  **Redeploy**:
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build --force-recreate
    ```

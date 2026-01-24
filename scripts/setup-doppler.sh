#!/bin/bash
# FlowState Doppler Setup Helper
# See docs/sop/SOP-030-doppler-secrets-management.md for full documentation

set -e

echo "=== FlowState Doppler Setup ==="
echo ""

# Check if Doppler is installed
if command -v doppler &> /dev/null; then
    echo "[OK] Doppler CLI is installed: $(doppler --version)"
else
    echo "[!] Doppler CLI not found. Installing..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install dopplerhq/cli/doppler
        else
            echo "Please install Homebrew first: https://brew.sh"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -sLf --retry 3 --tlsv1.2 --proto "=https" \
            'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | \
            sudo gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg

        echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | \
            sudo tee /etc/apt/sources.list.d/doppler-cli.list

        sudo apt-get update && sudo apt-get install -y doppler
    else
        echo "Unsupported OS. Please install Doppler manually: https://docs.doppler.com/docs/install-cli"
        exit 1
    fi

    echo "[OK] Doppler CLI installed: $(doppler --version)"
fi

echo ""

# Check if logged in
if doppler me &> /dev/null; then
    echo "[OK] Logged in to Doppler"
else
    echo "[!] Not logged in. Running 'doppler login'..."
    doppler login
fi

echo ""

# Check if project is configured
if [[ -f ".doppler.yaml" ]]; then
    echo "[OK] Project already configured"
else
    echo "[!] Project not configured. Running 'doppler setup'..."
    doppler setup
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "You can now run the dev server with Doppler secrets:"
echo "  doppler run -- npm run dev"
echo ""
echo "Or generate a .env.local file:"
echo "  doppler secrets download --no-file --format env > .env.local"
echo ""

#!/bin/bash

# Voice AI Math Tutor - Backend Start Script

set -e

cd "$(dirname "$0")"

# Check for .env file
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env and add your XAI_API_KEY"
    exit 1
fi

# Check for uv
if ! command -v uv &> /dev/null; then
    echo "uv is required. Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
uv sync

# Run the server
echo "Starting backend server..."
uv run python -m src.main

#!/usr/bin/env bash
# Quantum ALU 3D Studio — Development Environment Launcher with Auto-Reload

set -e

echo "🚀 Starting Quantum ALU 3D Studio Development Services..."

# Clean up child processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down development services..."
    kill 0 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Kill any stale processes on 8000 or 8502
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 8502/tcp 2>/dev/null || true
sleep 1

# Start FastAPI backend with --reload
echo "⚡ Launching FastAPI backend server on http://localhost:8000 (auto-reload enabled)..."
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload &

# Start Streamlit frontend with runOnSave
echo "📊 Launching Streamlit frontend server on http://localhost:8502 (auto-reload enabled)..."
python3 -m streamlit run app.py --server.port 8502 --server.address 0.0.0.0 &

echo ""
echo "✅ Development Environment is READY!"
echo "   - FastAPI Web Workbench: http://localhost:8000"
echo "   - Streamlit View:        http://localhost:8502"
echo "   (Press Ctrl+C to stop all servers)"

wait

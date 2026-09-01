#!/usr/bin/env bash
# ==============================================================================
# Quantum ALU 3D Studio 2.0 — Modular Development Server Launcher
# ==============================================================================

set -e

# Kill any lingering processes on ports 8000 and 5173
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

echo "🚀 Starting FastAPI Modular Python Backend (port 8000)..."
python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "🚀 Starting Vite React TypeScript Frontend (port 5173)..."
cd frontend
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo "=============================================================================="
echo "⚡ Quantum Studio Active Services:"
echo "   - FastAPI Backend: http://localhost:8000"
echo "   - Vite React Frontend: http://localhost:5173"
echo "=============================================================================="

# Trap SIGINT/SIGTERM to cleanly kill both background processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT

wait

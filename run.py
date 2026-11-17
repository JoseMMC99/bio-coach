"""
BioCoach AI - Root Application Runner.
Starts the unified API Gateway and serves the mobile PWA frontend.

Usage:
    python run.py
"""
import os
import sys

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.api import create_server
from backend.service import BioCoachService
from scripts.test_connection import load_env

def main():
    env = load_env()
    supabase_url = env.get("SUPABASE_URL", "")
    supabase_key = env.get("SUPABASE_PUBLISHABLE_KEY", "")
    gemini_key = env.get("GEMINI_API_KEY", "")

    if not supabase_url or not supabase_key:
        print("❌ Error: Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env file.")
        sys.exit(1)

    service = BioCoachService(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        gemini_key=gemini_key
    )

    port = 8080
    server = create_server(host="0.0.0.0", port=port, service=service)
    print("=" * 65)
    print(" 🧬 BioCoach AI Gateway & Mobile PWA")
    print("=" * 65)
    print(f" 🌐 Dashboard & WebApp:  http://localhost:{port}")
    print(f" 📡 API Health Endpoint: http://localhost:{port}/health")
    print(f" 📲 Mobile Access:      http://<your-pc-ip>:{port}")
    print("=" * 65)
    print(" Press Ctrl+C to stop the server.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido.")

if __name__ == "__main__":
    main()

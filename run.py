"""
BioCoach AI - Root Application Runner.
Starts the unified API Gateway, executes startup diagnostics, and serves the mobile PWA frontend.

Usage:
    python run.py
"""
import os
import sys
import socket
from typing import Dict, Any

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.api import create_server
from backend.service import BioCoachService
from scripts.test_connection import load_env
from scripts.generate_shortcuts import create_all_shortcuts

def get_local_ip() -> str:
    """
    Attempts to discover the primary LAN IPv4 address of the host machine.
    Enables direct connection from iPhone and Apple Watch without manually running ipconfig.
    Falls back to '127.0.0.1' if network is unavailable.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def verify_startup_environment(env: Dict[str, str]) -> BioCoachService:
    """
    Validates environment variables and initializes the core service layer.
    Exits gracefully with helpful guidance if mandatory credentials are missing.
    """
    supabase_url = env.get("SUPABASE_URL", "")
    supabase_key = env.get("SUPABASE_PUBLISHABLE_KEY", "")
    gemini_key = env.get("GEMINI_API_KEY", "")

    if not supabase_url or not supabase_key:
        print("❌ Error de configuración: Falta SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en .env")
        print("👉 Copia el archivo .env.example a .env y añade tus claves de Supabase.")
        sys.exit(1)

    return BioCoachService(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        gemini_key=gemini_key
    )


def print_startup_banner(port: int, local_ip: str, gemini_configured: bool):
    """Prints a structured, clear status dashboard in the terminal."""
    gemini_status = "🟢 Conectado (Gemini 1.5 Flash)" if gemini_configured else "🟡 Modo Offline (Reglas fisiológicas locales)"
    
    print("\n" + "=" * 68)
    print(" 🧬 BioCoach AI — Gateway Fisiológico & PWA Móvil")
    print("=" * 68)
    print(f" 🌐 Dashboard WebApp (PC):         http://localhost:{port}")
    print(f" 📲 Acceso Móvil (iPhone / Watch): http://{local_ip}:{port}")
    print(f" 🤖 Motor de Inteligencia AI:      {gemini_status}")
    print("-" * 68)
    print(" 📡 MÓDULOS ACTIVOS Y ENDPOINTS:")
    print(f"   • 📊 Telemetría y Dashboard:    http://{local_ip}:{port}/api/v1/dashboard")
    print(f"   • ☀️ Recuperación Matutina:     http://{local_ip}:{port}/api/v1/recovery")
    print(f"   • 🥑 Nutrición & Metabolismo:   http://{local_ip}:{port}/api/v1/metabolism")
    print(f"   • 🏋️ Sesiones & Strain:         http://{local_ip}:{port}/api/v1/workout")
    print(f"   • 💓 Chequeo Cardíaco:          http://{local_ip}:{port}/api/v1/hr-check")
    print(f"   • 💬 Coach Chat IA:             http://{local_ip}:{port}/api/v1/chat")
    print(f"   • 📲 Descarga de Atajos 1-Clic: http://{local_ip}:{port}/shortcuts/downloads/BioCoach_Atajos_iOS.zip")
    print("=" * 68)
    print(" Presiona Ctrl+C para detener el servidor.\n")


def main():
    env = load_env()
    service = verify_startup_environment(env)

    # 1. Ensure Apple Shortcut binary files are generated and up to date
    shortcuts_dir = os.path.join(PROJECT_ROOT, "shortcuts", "downloads")
    try:
        create_all_shortcuts(shortcuts_dir)
    except Exception as e:
        print(f"⚠️ Advertencia al compilar atajos: {e}")

    # 2. Network and server configuration
    port = int(env.get("PORT", "8080"))
    local_ip = get_local_ip()
    gemini_configured = bool(env.get("GEMINI_API_KEY", "").strip())

    server = create_server(host="0.0.0.0", port=port, service=service)
    print_startup_banner(port, local_ip, gemini_configured)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido correctamente.")


if __name__ == "__main__":
    main()

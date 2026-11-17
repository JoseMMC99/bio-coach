"""
Connectivity and health check script for Supabase.
Safely loads environment variables from .env without exposing credentials.
"""
import os
import sys
import json
import urllib.request
import urllib.error

def load_env():
    """Load key-value pairs from .env into a dictionary."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(env_path):
        print("⚠️ Warning: .env file not found. Please copy .env.example to .env")
        return {}
    env = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

def test_supabase():
    """Verify read access to Supabase PostgREST endpoint."""
    env = load_env()
    url = env.get("SUPABASE_URL")
    key = env.get("SUPABASE_PUBLISHABLE_KEY")

    if not url or not key:
        print("❌ Error: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY missing in .env")
        sys.exit(1)

    print(f"📡 Conectando a Supabase ({url})...")
    endpoint = f"{url.rstrip('/')}/rest/v1/daily_recovery?select=id&limit=1"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }

    req = urllib.request.Request(endpoint, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"✅ Conexión exitosa a Supabase. Código HTTP: {resp.status}")
            print(f"📊 Tabla 'daily_recovery' accesible y lista.")
    except urllib.error.HTTPError as e:
        print(f"❌ Error HTTP {e.code}: {e.read().decode('utf-8')}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_supabase()

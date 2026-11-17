"""
HTTP API Gateway and static file server for BioCoach AI.
Routes Apple Shortcuts webhooks to the service layer and validates payloads.
Can run standalone with zero external dependencies using Python's built-in http.server.
"""
import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Tuple, Dict, Any, Optional

# Ensure project root is in sys.path so execution works from any working directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.service import BioCoachService
from backend.payload_validator import ShortcutPayloadValidator, ValidationError

class BioCoachAPIHandler:
    """Framework-agnostic HTTP request router and endpoint handler."""

    def __init__(self, service: BioCoachService):
        self.service = service
        self.validator = ShortcutPayloadValidator()

    def handle_request(self, method: str, path: str, body: Optional[Any]) -> Tuple[int, Dict[str, Any]]:
        """Maps HTTP method, path and body to the appropriate service pipeline."""
        clean_path = path.split("?")[0].rstrip("/")

        if method == "GET" and clean_path in ["", "/health", "/api/v1/health"]:
            return 200, {"status": "healthy", "service": "BioCoach AI Gateway", "version": "1.0.0"}

        if method == "GET" and clean_path in ["/api/v1/dashboard", "/dashboard"]:
            athlete_id = None
            is_demo = None
            if "?" in path:
                from urllib.parse import parse_qs
                params = parse_qs(path.split("?", 1)[1])
                athlete_id = params.get("athlete_id", [None])[0]
                demo_param = params.get("is_demo", [None])[0]
                if demo_param is not None:
                    is_demo = demo_param.lower() in ["true", "1"]
            result = self.service.get_dashboard_summary(athlete_id=athlete_id, is_demo=is_demo)
            return 200, result

        if method != "POST":
            return 405, {"error": f"Método {method} no permitido."}

        if not isinstance(body, dict):
            return 400, {"error": "El cuerpo de la petición debe ser un objeto JSON válido."}

        try:
            if clean_path in ["/api/v1/chat", "/chat"]:
                msg = body.get("message")
                if not msg or not str(msg).strip():
                    raise ValidationError("El campo 'message' es obligatorio y no puede estar vacío.")
                result = self.service.process_coach_chat(str(msg).strip())
                return 200, result

            elif clean_path in ["/api/v1/recovery", "/recovery"]:
                metrics = self.validator.validate_morning_payload(body)
                result = self.service.process_morning_recovery(metrics)
                return 200, result

            elif clean_path in ["/api/v1/workout", "/workout"]:
                cleaned = self.validator.validate_workout_payload(body)
                result = self.service.process_workout_completion(
                    workout_type=cleaned["workout_type"],
                    duration_minutes=cleaned["duration_minutes"],
                    active_calories=cleaned["active_calories"],
                    avg_hr=cleaned["avg_hr"],
                    max_hr=cleaned["max_hr"],
                    recovery_hr_1min=cleaned.get("recovery_hr_1min")
                )
                return 200, result

            elif clean_path in ["/api/v1/hr-check", "/hr-check"]:
                cleaned = self.validator.validate_instant_hr_payload(body)
                result = self.service.process_instant_hr_check(
                    current_hr=cleaned["current_hr"],
                    current_hrv=cleaned.get("current_hrv"),
                    user_sensation=cleaned["user_sensation"]
                )
                return 200, result

            elif clean_path in ["/api/v1/nutrition", "/nutrition"]:
                cleaned = self.validator.validate_nutrition_payload(body)
                db_payload = {
                    "raw_text": cleaned["raw_text"],
                    "meal_type": cleaned["meal_type"]
                }
                headers = self.service._get_headers(prefer="return=representation")
                req_url = f"{self.service.supabase_url}/rest/v1/nutrition_logs"
                data = json.dumps(db_payload).encode("utf-8")
                import urllib.request
                req = urllib.request.Request(req_url, data=data, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=5) as resp:
                    pass
                return 200, {
                    "status": "success",
                    "message": "Comida registrada exitosamente.",
                    "watch_feedback": f"🥗 Registrado: {cleaned['raw_text'][:50]}..."
                }

            elif clean_path in ["/api/v1/metabolism", "/metabolism"]:
                result = self.service.calculate_nutrition_plan(body)
                return 200, result

            elif clean_path in ["/api/v1/seed-demo", "/seed-demo"]:
                result = self.service.seed_demo_data()
                return 200, result

            else:
                return 404, {"error": f"Ruta '{clean_path}' no encontrada."}

        except ValidationError as ve:
            return 422, {"status": "validation_error", "validation_error": str(ve), "message": str(ve)}
        except Exception as e:
            return 500, {"status": "internal_error", "message": str(e)}

def create_server(host: str = "0.0.0.0", port: int = 8000, service: Optional[BioCoachService] = None):
    """Instantiates a native Python HTTP server serving both REST endpoints and PWA assets."""
    handler_logic = BioCoachAPIHandler(service=service)

    class CustomServerHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            # Serve static files from webapp/ directory when matching PWA routes
            webapp_dir = os.path.join(PROJECT_ROOT, "webapp")
            req_path = self.path.split("?")[0]

            if req_path in ["/", "/index.html"]:
                target_file = os.path.join(webapp_dir, "index.html")
                self._serve_file(target_file, "text/html; charset=utf-8")
                return
            elif req_path in ["/manifest.json", "/app.js", "/sw.js", "/icon.jpg"]:
                target_file = os.path.join(webapp_dir, req_path.lstrip("/"))
                if req_path.endswith(".js"):
                    mime = "application/javascript"
                elif req_path.endswith(".json"):
                    mime = "application/json"
                elif req_path.endswith(".jpg"):
                    mime = "image/jpeg"
                else:
                    mime = "application/octet-stream"
                self._serve_file(target_file, mime)
                return
            elif req_path.startswith("/shortcuts/"):
                shortcut_file = os.path.join(PROJECT_ROOT, req_path.lstrip("/"))
                self._serve_file(shortcut_file, "application/octet-stream")
                return

            status, res = handler_logic.handle_request("GET", self.path, None)
            self._send_json(status, res)

        def do_POST(self):
            content_len = int(self.headers.get("Content-Length", 0))
            body = None
            if content_len > 0:
                raw_body = self.rfile.read(content_len).decode("utf-8")
                try:
                    body = json.loads(raw_body)
                except Exception:
                    body = None
            status, res = handler_logic.handle_request("POST", self.path, body)
            self._send_json(status, res)

        def _serve_file(self, file_path: str, content_type: str):
            if os.path.exists(file_path):
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                if file_path.endswith(".shortcut") or file_path.endswith(".zip"):
                    fname = os.path.basename(file_path)
                    self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()

        def _send_json(self, status: int, data: Dict[str, Any]):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))

    return HTTPServer((host, port), CustomServerHandler)

if __name__ == "__main__":
    # Allows starting the server directly from command line
    from scripts.test_connection import load_env
    env = load_env()
    srv = BioCoachService(
        supabase_url=env.get("SUPABASE_URL", ""),
        supabase_key=env.get("SUPABASE_PUBLISHABLE_KEY", ""),
        gemini_key=env.get("GEMINI_API_KEY", "")
    )
    httpd = create_server(port=8080, service=srv)
    print("🚀 BioCoach API Gateway escuchando en http://localhost:8080...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")

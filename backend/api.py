"""
HTTP API Gateway para BioCoach AI.
Enruta peticiones de Apple Shortcuts hacia la capa de servicio y valida payloads.
Puede ejecutarse de forma independiente sin dependencias externas (usa http.server).
"""
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Tuple, Dict, Any, Optional
from backend.service import BioCoachService
from backend.payload_validator import ShortcutPayloadValidator, ValidationError

class BioCoachAPIHandler:
    """Enrutador agnóstico de framework para requests HTTP."""

    def __init__(self, service: BioCoachService):
        self.service = service
        self.validator = ShortcutPayloadValidator()

    def handle_request(self, method: str, path: str, body: Optional[Any]) -> Tuple[int, Dict[str, Any]]:
        """Mapea método, ruta y cuerpo hacia el servicio correspondiente."""
        clean_path = path.split("?")[0].rstrip("/")

        if method == "GET" and clean_path in ["", "/health", "/api/v1/health"]:
            return 200, {"status": "healthy", "service": "BioCoach AI Gateway", "version": "1.0.0"}

        if method != "POST":
            return 405, {"error": f"Método {method} no permitido."}

        if not isinstance(body, dict):
            return 400, {"error": "El cuerpo de la petición debe ser un objeto JSON válido."}

        try:
            if clean_path in ["/api/v1/recovery", "/recovery"]:
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
                # Registro directo de nutrición
                db_payload = {
                    "raw_text": cleaned["raw_text"],
                    "meal_type": cleaned["meal_type"]
                }
                # Si el servicio tiene endpoint de supabase
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

            else:
                return 404, {"error": f"Ruta '{clean_path}' no encontrada."}

        except ValidationError as ve:
            return 422, {"status": "validation_error", "validation_error": str(ve), "message": str(ve)}
        except Exception as e:
            return 500, {"status": "internal_error", "message": str(e)}

def create_server(host: str = "0.0.0.0", port: int = 8000, service: Optional[BioCoachService] = None):
    """Crea una instancia de servidor HTTP nativo."""
    handler_logic = BioCoachAPIHandler(service=service)

    class CustomServerHandler(BaseHTTPRequestHandler):
        def do_GET(self):
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

        def _send_json(self, status: int, data: Dict[str, Any]):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))

    return HTTPServer((host, port), CustomServerHandler)

if __name__ == "__main__":
    # Permite ejecutar el servidor localmente para pruebas
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

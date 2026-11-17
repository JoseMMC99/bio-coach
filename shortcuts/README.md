# 📱 Atajos de iOS y Automatizaciones de Apple Watch

Este directorio contiene las especificaciones y guías de configuración bloque por bloque para los 4 flujos de automatización que conectan tu Apple Watch con **BioCoach AI**:

| Atajo | Tipo de Ejecución | Archivo de Guía |
| :--- | :--- | :--- |
| **☀️ Recuperación Matutina** | 100% Automático (al apagar alarma) | [01_morning_recovery.md](01_morning_recovery.md) |
| **🏋️ Post-Entrenamiento** | 100% Automático (al finalizar sesión) | [02_post_workout.md](02_post_workout.md) |
| **💓 Chequeo de Latidos (SOS)** | A demanda (Complicación o Siri) | [03_instant_hr_check.md](03_instant_hr_check.md) |
| **🥗 Dictado de Nutrición** | A demanda (Voz con Siri) | [04_nutrition_voice_log.md](04_nutrition_voice_log.md) |

---

## 🔧 Manejo de Formatos Locales (iOS en Español)
En dispositivos iOS configurados en español, Apple Shortcuts suele formatear los números decimales con **coma** (ejemplo: `"7,5"` en lugar de `7.5`). 

El validador de backend ([backend/payload_validator.py](../backend/payload_validator.py)) cuenta con soporte y tests para coerción automática de comas y strings vacíos (`""`), garantizando que las automatizaciones nunca fallen por formato regional.

# 🗄️ Esquema de Base de Datos - BioCoach AI

Este directorio contiene el esquema DDL y la documentación de las tablas alojadas en **PostgreSQL (Supabase)**.

## Tablas del Sistema

### 1. `daily_recovery`
Almacena el reporte matutino consolidado generado al despertar:
* `recorded_date`: Fecha única del registro (`YYYY-MM-DD`).
* `sleep_hours`: Total de horas dormidas.
* `deep_sleep_hours` / `rem_sleep_hours`: Fases clave de recuperación física y cognitiva.
* `respiratory_rate`: Respiraciones por minuto durante el sueño (alerta temprana de inflamación o enfermedad).
* `wrist_temp_deviation`: Desviación de temperatura en muñeca (°C respecto a la línea base).
* `resting_hr`: Frecuencia cardíaca en reposo matutina.
* `hrv_ms`: Variabilidad de frecuencia cardíaca (SDNN en ms).
* `daylight_minutes`: Minutos expuesto a luz natural del día anterior.
* `recovery_score`: Puntuación normalizada de 0 a 100 calculada por el backend.
* `gemini_verdict`: Diagnóstico emitido por Gemini en lenguaje natural.

### 2. `workouts`
Almacena cada sesión de entrenamiento completada en Apple Fitness:
* `workout_type`: Tipo de ejercicio (Fuerza, Carrera, Ciclismo, HIIT, etc.).
* `duration_minutes`: Duración total.
* `active_calories`: Gasto calórico activo.
* `avg_hr` / `max_hr`: Pulso promedio y pico alcanzado.
* `recovery_hr_1min`: Descenso de pulsaciones en el primer minuto post-entreno.
* `gemini_feedback`: Recomendación de recarga de glucógeno y descanso.

### 3. `nutrition_logs`
Registro de comidas mediante dictado por voz o texto:
* `logged_date`: Fecha del consumo.
* `meal_type`: Desayuno, almuerzo, cena o snack.
* `raw_text`: Texto original dictado por el usuario.
* `estimated_calories`, `protein_g`, `carbs_g`, `fat_g`: Estimación de macronutrientes calculada por Gemini.

### 4. `hr_checkins`
Chequeos reactivos o a demanda cuando el usuario siente palpitaciones o estrés:
* `current_hr`: Pulsaciones por minuto en ese instante.
* `stress_level`: Nivel de estrés biológico estimado (0 a 100).
* `user_sensation`: Contexto o síntoma reportado por el usuario.
* `gemini_guidance`: Evaluación objetiva y técnica de respiración o calma.

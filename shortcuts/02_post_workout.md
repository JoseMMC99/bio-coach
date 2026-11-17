# 🏋️ Atajo 2: Post-Entrenamiento (Workout Strain)

> **Disparador:** 100% Automático al presionar "Finalizar entreno" en el Apple Watch.
> **Destino:** Notificación de impacto fisiológico y recomendación de nutrición post-entreno.

---

## ⚡ Configuración de la Automatización en iOS

1. En la app **Atajos**, ve a **Automatización** -> **`+`**.
2. Selecciona el evento:
   * **"Entrenamiento"** -> **"Al finalizar un entrenamiento"**.
   * Tipo de entreno: Puedes elegir *Cualquiera* o específicos (Fuerza, Correr, etc.).
3. Marca **"Ejecutar inmediatamente"** y apaga **"Notificar al ejecutar"**.

---

## 🧱 Estructura Bloque por Bloque del Atajo

### Bloque 1: Extraer Muestras de la Sesión Reciente
1. **Buscar muestras de Salud**:
   * Tipo: `Entrenamientos`
   * Ordenar por: **Fecha de finalización** (El más reciente primero)
   * Límite: **1 muestra**
   * Guardar como: `Ultimo_Entreno`

2. **Obtener detalles de Salud**:
   * Extraer `Duración` de `Ultimo_Entreno` -> Guardar en `Var_Duracion` (en minutos).
   * Extraer `Calorías activas` de `Ultimo_Entreno` -> Guardar en `Var_Calorias`.
   * Extraer `Frecuencia cardíaca media` -> Guardar en `Var_FC_Media`.
   * Extraer `Frecuencia cardíaca máxima` -> Guardar en `Var_FC_Max`.
   * Extraer `Tipo de entrenamiento` -> Guardar en `Var_Tipo`.

3. *(Opcional)* **Buscar muestras de Salud**:
   * Tipo: `Recuperación de la frecuencia cardíaca` (Cardio Recovery 1-min)
   * Límite: **1 muestra**
   * Guardar como: `Var_Rec_1min`

---

### Bloque 2: Construir el Diccionario JSON
Acción **Diccionario**:
* `workout_type`: `Var_Tipo`
* `duration_minutes`: `Var_Duracion`
* `active_calories`: `Var_Calorias`
* `avg_hr`: `Var_FC_Media`
* `max_hr`: `Var_FC_Max`
* `recovery_hr_1min`: `Var_Rec_1min`

---

### Bloque 3: Llamada HTTP al Gateway BioCoach
Acción **Obtener contenido de URL**:
* **URL:** `https://tu-servidor-o-tunnel/api/v1/workout`
* **Método:** `POST`
* **Encabezados:** `Content-Type: application/json`
* **Cuerpo:** Diccionario del Bloque 2.

---

### Bloque 4: Mostrar Notificación en el Apple Watch
1. **Obtener valor del diccionario**:
   * Clave: `watch_feedback`
2. **Mostrar notificación**:
   * Título: `🏋️ Resumen de Sesión`
   * Cuerpo: *[Resultado anterior]*

---

## 📲 Resultado en tu Muñeca
> **🏋️ Resumen de Sesión**  
> Fuerza Tradicional (52m | 430 kcal).  
> Impacto: 13.8/21. Recuperación estimada: ~24h.  
> Consume 35g de proteína y carbohidratos en los próximos 45 minutos.

# ☀️ Atajo 1: Recuperación Matutina (Morning Recovery)

> **Disparador:** 100% Automático al despertar.
> **Destino:** Notificación enriquecida en la pantalla del Apple Watch.

---

## ⚡ Configuración de la Automatización en iOS

1. Abre la app **Atajos (Shortcuts)** en tu iPhone.
2. Ve a la pestaña **Automatización** y toca el botón **`+`**.
3. Selecciona el evento:
   * **"Al detener la alarma"** (o **"Al desactivarse el modo Sueño"**).
4. Elige la opción:
   * ✅ **"Ejecutar inmediatamente"**
   * ❌ Desactiva **"Notificar al ejecutar"** (para que corra en silencio de fondo).
5. Toca **"Nuevo atajo en blanco"** o enlaza a este atajo.

---

## 🧱 Estructura Bloque por Bloque del Atajo

Agrega las siguientes acciones en orden exacto:

### Bloque 1: Extraer Muestras de Apple Health
1. **Buscar muestras de Salud**:
   * Tipo: `Sueño`
   * Filtrar: *Cualquiera*
   * Ordenar por: **Fecha de finalización** (El más reciente primero)
   * Límite: **1 muestra**
   * Guardar como: Variable `Var_Sueno`

2. **Buscar muestras de Salud**:
   * Tipo: `Frecuencia cardíaca en reposo`
   * Ordenar por: **Fecha de finalización** (El más reciente primero)
   * Límite: **1 muestra**
   * Guardar como: Variable `Var_RHR`

3. **Buscar muestras de Salud**:
   * Tipo: `Variabilidad de la frecuencia cardíaca` (VFC / HRV)
   * Ordenar por: **Fecha de finalización** (El más reciente primero)
   * Límite: **1 muestra**
   * Guardar como: Variable `Var_HRV`

4. *(Opcional)* **Buscar muestras de Salud**:
   * Tipo: `Frecuencia respiratoria`
   * Límite: **1 muestra**
   * Guardar como: Variable `Var_Resp`

---

### Bloque 2: Construir el Diccionario JSON
Agrega la acción **Diccionario** con las siguientes claves:
* `sleep_hours`: `Var_Sueno` (como Número o Texto)
* `resting_hr`: `Var_RHR`
* `hrv_ms`: `Var_HRV`
* `respiratory_rate`: `Var_Resp`

---

### Bloque 3: Llamada HTTP al Gateway BioCoach
Agrega la acción **Obtener contenido de URL**:
* **URL:** `https://tu-servidor-o-tunnel/api/v1/recovery`
* **Método:** `POST`
* **Encabezados:**
  * `Content-Type`: `application/json`
* **Cuerpo de la solicitud:** Selecciona el **Diccionario** del Bloque 2.

---

### Bloque 4: Mostrar Notificación en el Apple Watch
1. Agrega la acción **Obtener valor del diccionario**:
   * Clave: `watch_notification`
   * De: *Contenido de URL*
2. Agrega la acción **Mostrar notificación**:
   * Título: `☀️ Recuperación Matutina`
   * Cuerpo: *[Resultado del paso anterior]*
   * Sonido: Sí

---

## 📲 Resultado en tu Muñeca
Unos segundos después de que desactivas tu alarma matutina, tu Apple Watch vibrará mostrando:
> **☀️ Recuperación Matutina**  
> 🟢 Sistema en verde (Recuperación 85%).  
> Hoy: Día excelente para sesión pesada de piernas o series de velocidad.  
> Consejo: Prioriza 500ml de agua con electrolitos al levantarte.

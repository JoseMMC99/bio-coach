# 💓 Atajo 3: Chequeo de Latidos / Estrés (Widget SOS)

> **Disparador:** A demanda (Complicación en esfera del Apple Watch o *"Oye Siri, revisa mis latidos"*).
> **Destino:** Diagnóstico objetivo instantáneo de estrés vs taquicardia real en pantalla o por altavoz.

---

## ⚡ Configuración en el Apple Watch

1. Crea este atajo como un atajo normal (no automatización) llamado **`Chequeo Pulso`**.
2. En la app **Watch** de tu iPhone, agrégalo como **Complicación** en tu esfera favorita o dile a Siri: *"Ejecutar Chequeo Pulso"*.

---

## 🧱 Estructura Bloque por Bloque del Atajo

### Bloque 1: Lectura del Sensor Cardíaco en Tiempo Real
1. **Buscar muestras de Salud**:
   * Tipo: `Frecuencia cardíaca`
   * Ordenar por: **Fecha de finalización** (El más reciente primero)
   * Límite: **1 muestra**
   * Guardar como: `Var_PulsoActual`

2. *(Opcional)* **Solicitar entrada**:
   * Pregunta: *"¿Qué sientes?"*
   * Tipo de entrada: Texto (o Menú rápido: *Palpitaciones / Ansiedad / Trabajo / Rutina*)
   * Guardar como: `Var_Sensacion`

---

### Bloque 2: Construir el Diccionario JSON
Acción **Diccionario**:
* `current_hr`: `Var_PulsoActual`
* `user_sensation`: `Var_Sensacion`

---

### Bloque 3: Llamada HTTP al Gateway BioCoach
Acción **Obtener contenido de URL**:
* **URL:** `https://tu-servidor-o-tunnel/api/v1/hr-check`
* **Método:** `POST`
* **Encabezados:** `Content-Type: application/json`
* **Cuerpo:** Diccionario del Bloque 2.

---

### Bloque 4: Mostrar Veredicto en Pantalla
1. **Obtener valor del diccionario**:
   * Clave: `watch_guidance`
2. **Mostrar alerta** o **Mostrar resultado**:
   * Título: `💓 BioCoach Cardíaco`
   * Texto: *[Resultado anterior]*

---

## 📲 Ejemplos de Respuesta en tu Muñeca

* **Si es sugestión / fatiga mental:**
  > **💓 BioCoach Cardíaco**  
  > Pulso: 68 bpm (Normal para tu reposo de ~65 bpm).  
  > Tu corazón está en ritmo seguro. La sensación probablemente es estrés o fatiga mental. Tómate un vaso con agua.

* **Si las pulsaciones están realmente altas sentado:**
  > **⚠️ BioCoach Cardíaco**  
  > Pulso elevado: 114 bpm (+48 bpm sobre reposo).  
  > Inicia respiración en caja: inhala profundo 4s, sostén 4s, exhala en 4s.

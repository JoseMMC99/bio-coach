# 🥗 Atajo 4: Dictado de Comidas por Voz (Nutrition Log)

> **Disparador:** A demanda (Botón en Apple Watch o *"Oye Siri, anoté comida"*).
> **Destino:** Registro en base de datos PostgreSQL y desglose automático de macronutrientes.

---

## ⚡ Configuración en el Apple Watch / iPhone

1. Crea este atajo como un atajo normal llamado **`Anotar Comida`**.
2. Puede ejecutarse dictándole a Siri en el reloj o tocando un widget en la pantalla del iPhone/Watch.

---

## 🧱 Estructura Bloque por Bloque del Atajo

### Bloque 1: Dictado por Voz
1. **Dictar texto**:
   * Idioma: Español
   * Detener escucha: Después de una pausa
   * Guardar como: `Var_AudioTexto` (ej: *"Comí 180 gramos de pechuga a la plancha con una porción de arroz blanco y ensalada"*)

2. *(Opcional)* **Elegir de menú**:
   * Opciones: `Desayuno`, `Almuerzo`, `Cena`, `Snack`
   * Guardar como: `Var_TipoComida`

---

### Bloque 2: Construir el Diccionario JSON
Acción **Diccionario**:
* `raw_text`: `Var_AudioTexto`
* `meal_type`: `Var_TipoComida`

---

### Bloque 3: Llamada HTTP al Gateway BioCoach
Acción **Obtener contenido de URL**:
* **URL:** `https://tu-servidor-o-tunnel/api/v1/nutrition`
* **Método:** `POST`
* **Encabezados:** `Content-Type: application/json`
* **Cuerpo:** Diccionario del Bloque 2.

---

### Bloque 4: Confirmación en Pantalla
1. **Obtener valor del diccionario**:
   * Clave: `watch_feedback`
2. **Mostrar notificación**:
   * Título: `🥗 BioCoach Nutrición`
   * Texto: *[Resultado anterior]*

---

## 📲 Resultado en tu Muñeca
> **🥗 BioCoach Nutrición**  
> Registrado: Comí 180 gramos de pechuga a la plancha con arroz blanco...  
> (Guardado en base de datos para análisis diario).

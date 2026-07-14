# WoW Raid Timeline & Burst Analyzer 🛡️⚔️🔮

Una sofisticada aplicación web interactiva diseñada para analizar registros de combates de **World of Warcraft** directamente desde la API v2 de **Warcraft Logs**. Esta herramienta permite visualizar de forma clara y precisa el uso de habilidades ofensivas, curativas, defensivas de banda y pociones de toda la party a lo largo de una línea de tiempo interactiva.

---

## ✨ Características Principales

### 1. 📅 Línea de Tiempo de Cooldowns (Timeline Grid)
* Visualización gráfica e interactiva de los hechizos lanzados por cada raider agrupados cronológicamente.
* Renderizado de **iconos oficiales de WoW en alta resolución** enlazados dinámicamente con Wowhead.
* Bordes de iconos coloreados según el color de clase exacto de cada personaje para una fácil identificación visual.
* Soporte para todas las clases y specs del juego (desde Death Knights hasta Evokers y Monks).

### 2. 🥞 Algoritmo Antisolapamiento de Iconos (Dynamic Lanes)
* Si un jugador activa varios bursts o pociones casi al mismo tiempo (por ejemplo, *Army of the Dead* + *Dark Transformation*), un **algoritmo de asignación de carriles en tiempo real** los distribuye verticalmente en lugar de encimarlos.
* Las filas se expanden dinámicamente según sea necesario (**44px**, **64px** u **84px**) con transiciones suaves en CSS.
* Las líneas de tiempo y marcas de segundos se estiran y adaptan automáticamente al tamaño dinámico de la fila.

### 3. 🧪 Seguimiento y Detección de Pociones (Potions Tracker)
* Mapeo de uso de pociones de combate de la party completa (incluyendo expansiones Dragonflight y The War Within).
* Soporte para pociones clave como *Fleeting Potion of Ultimate Power*, *Tempered Potion*, *Light's Potential* y más.
* Detección semántica inteligente que clasifica automáticamente cualquier hechizo como poción si contiene la palabra `"potion"` o `"poción"`.

### 4. 🎛️ Filtros Interactivos de Leyenda (Interactive Filters)
* Leyenda de la tabla convertida en **píldoras de botones ("pills") interactivos**.
* Alterna de forma independiente la visibilidad de hechizos **Ofensivos** 🟠, **Curativos** 🟢, **Defensivos de Raid** 🔵 y **Pociones** 🟣.
* Transición de atenuación visual limpia para ocultar o mostrar los elementos al instante en la línea de tiempo.

### 5. 📊 Selección Detallada de Encuentros (Pull Selector)
* Importación directa mediante código de Warcraft Logs o la URL completa del reporte.
* Desglose de jefes, número de pulls (intentos), resultado (*Kill* ✅ / *Wipe* ❌) y duración exacta de cada combate.
* Indicadores estadísticos superiores de la party activa y conteo total de eventos.

### 6. 💀 Analizador de Guías y Rotación (Unholy DK Analyzer)
* Si el parse analizado es de un **Unholy Death Knight**, la aplicación activa un **módulo inteligente de análisis comparativo**.
* Lee y mapea la lógica del archivo de guía local `unholy_dk_explained.md` (de Icy Veins).
* Compara el **Opener (Apertura)** real del jugador contra la secuencia óptima (soporta modos *Single-Target* y *Multi-Target / AoE*), entregando una puntuación detallada (*Opener Match Score*).
* Verifica la correcta **alineación de Cooldowns Mayores** (*Army of the Dead* + *Dark Transformation* castados en sincronía) a lo largo del combate.
* Detecta el uso de pociones (incluida *Light's Potential*) durante el burst inicial del combate.

---

## 🛠️ Tecnologías Utilizadas

* **React 19** + **TypeScript**
* **Vite 8** (servidor de desarrollo ultrarrápido y compilador)
* **Konva / react-konva** (renderizado del timeline en canvas)
* **Firebase Firestore** (caché de análisis APL y configuración compartida)
* **API GraphQL de Warcraft Logs** (V2)
* **Estilos CSS Pure Vanilla** (diseño oscuro premium, efectos de cristal y micro-animaciones)

---

## 🚀 Instalación y Configuración Local

### Requisitos previos

* **Node.js 20.19+** (o 22.12+) — requerido por Vite 8
* **npm** (incluido con Node)
* Una cuenta de [Warcraft Logs](https://www.warcraftlogs.com/) para crear credenciales de API

### 1. Clonar el repositorio
```bash
git clone https://github.com/lrlucas/roation-app.git
cd roation-app
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno (Credenciales de Warcraft Logs)
El proyecto requiere acceso a la API v2 de Warcraft Logs.

1. Ve al panel de clientes de Warcraft Logs: [https://www.warcraftlogs.com/api/clients/](https://www.warcraftlogs.com/api/clients/)
2. Crea un nuevo cliente de tipo **API Web Client**.
3. Copia tu `Client ID` y `Client Secret`.
4. Duplica el archivo `.env.example` en la raíz del proyecto y renombralo como `.env`:
   ```bash
   cp .env.example .env
   ```
5. Abre el archivo `.env` recién creado y reemplaza los marcadores de posición con tus credenciales reales:
   ```env
   VITE_WCL_CLIENT_ID=tu_client_id_real_aqui
   VITE_WCL_CLIENT_SECRET=tu_client_secret_real_aqui
   ```

Variables opcionales (todas tienen valores por defecto o son editables desde la UI):

| Variable | Descripción |
|---|---|
| `VITE_FEATURE_ROTATION` / `VITE_FEATURE_BURST` / `VITE_FEATURE_AVOIDABLE` / `VITE_FEATURE_RECAP` | Flags para activar/desactivar módulos de la app (`true`/`false`) |
| `VITE_WCL_USER_ID` | Tu userID de WCL para el Recap de Progreso Mítico (los reports se buscan en tu cuenta personal, no en la guild) |
| `VITE_WCL_ZONE_ID` | zoneID del tier actual para el Recap |
| `VITE_RECAP_TIMEZONE` | Zona horaria IANA de la guild para agrupar noches de raid (ej. `America/Argentina/Buenos_Aires`) |

> [!WARNING]
> **Seguridad de Credenciales**: El archivo `.env` contiene información secreta de tu cliente. Está configurado y protegido en `.gitignore` para que **NUNCA** se suba a repositorios públicos de GitHub. Asegúrate de nunca subir tus credenciales reales.

### 4. Ejecutar el Servidor de Desarrollo
Inicia el servidor local de desarrollo con Vite:
```bash
npm run dev
```
La aplicación estará disponible para interactuar en `http://localhost:5173`.

> El proxy de desarrollo definido en `vite.config.ts` reenvía el endpoint OAuth de Warcraft Logs para evitar problemas de CORS — no necesitas configurar nada extra.

### 5. Compilar para Producción
Para compilar y optimizar la aplicación para su distribución:
```bash
npm run build
```

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Type-check (`tsc -b`) + build de producción |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm run preview` | Sirve localmente el build de producción |

---

## 🔥 Firebase (opcional)

La app usa **Firestore** como caché de análisis APL y para configuración compartida. La configuración web de Firebase está en `src/api/firebase.ts` (el `apiKey` de Firebase web es público por diseño — la seguridad la dan las reglas de `firestore.rules`).

Si quieres usar tu propio proyecto de Firebase:

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) y habilita **Cloud Firestore**.
2. Reemplaza el objeto `firebaseConfig` en `src/api/firebase.ts` con el de tu proyecto.
3. Actualiza el proyecto en `.firebaserc` y despliega las reglas:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

---

## 📁 Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `src/` | Código fuente de la aplicación (React + TS) |
| `public/` | Assets estáticos |
| `APL/`, `class-wow/` | Material de referencia: APLs de SimulationCraft y guías por clase |
| `new-interface/` | Prototipo HTML de la interfaz del analizador APL |
| `test_*.js` / `test_*.mjs` | Scripts sueltos de exploración de la API de WCL (leen credenciales desde `.env`) |
| `firestore.rules` | Reglas de seguridad de Firestore |

---

## 🔒 Seguridad (Prevención de Exposición de Credenciales)

Hemos auditado y asegurado el proyecto antes de su publicación en GitHub:
- [x] **`.gitignore` Actualizado**: El archivo `.env` y todas sus variantes locales (`.env.local`, `.env.development.local`, etc.) están añadidos explícitamente en el archivo de ignores de Git para evitar su tracking.
- [x] **Sanitización de `.env.example`**: Limpiamos y reemplazamos los valores por defecto del archivo `.env.example` con marcadores legibles y seguros para evitar cualquier fuga accidental de claves.
- [x] **Scripts de test sanitizados**: Todos los scripts `test_*.js` leen las credenciales de WCL desde `.env` — no hay claves hardcodeadas en el código versionado.

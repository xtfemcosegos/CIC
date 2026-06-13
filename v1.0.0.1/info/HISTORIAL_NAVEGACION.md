# Manual de Arquitectura: Historial de Navegación

Este documento explica cómo **CIC-OS** gestiona el historial de navegación entre sus distintas pantallas (iframes) sin recargar la página web, manteniendo en todo momento la compatibilidad con los botones nativos de "Atrás" y "Adelante" del navegador.

## El Problema Base
Dado que CIC-OS funciona como un "Gestor de Ventanas" centralizado en `index.html` que simplemente oculta y muestra etiquetas `iframe`, la navegación nativa del navegador no registra estos cambios de estado visuales de manera predeterminada.

## La Solución Híbrida
Para resolver esto, el sistema utiliza un enfoque de dos niveles integrados de forma transparente:
1. **Estado Interno:** Un arreglo en el `localStorage` del usuario que guarda la pila estricta de pantallas visitadas.
2. **History API:** La API nativa de HTML5 para conectar el estado interno de la aplicación con la barra de direcciones del navegador web.

---

## 1. Estado Interno (`localStorage`)
El sistema mantiene y actualiza dos variables en el almacenamiento local del navegador:
- **`appHistory`** *(Array de Strings)*: Una lista cronológica con los IDs de los iframes visitados. Ej: `['iframe-home', 'iframe-login', 'iframe-app']`.
- **`historyPointer`** *(Integer)*: El índice actual dentro del arreglo `appHistory` que marca en qué "paso" se encuentra el usuario.

### Flujo al navegar a una nueva pantalla:
Al llamar a la función de cambio de vistas:
1. El sistema recorta cualquier historial "futuro" sobrante (esto sucede si el usuario retrocedió varios pasos y luego navega a un destino nuevo, rompiendo la línea de tiempo anterior).
2. Se añade el nuevo `frameId` al final del arreglo `appHistory`.
3. Se actualiza la variable `historyPointer` para que apunte al último elemento recién creado.

---

## 2. Integración Nativa (HTML5 History API)
Para que las flechas de navegación de la esquina del navegador funcionen correctamente, `js/script.js` y `index.html` utilizan:

- **`window.history.replaceState`**: Se ejecuta al momento de cargar la aplicación (`DOMContentLoaded`) para establecer y registrar el punto de partida en la memoria del navegador.
- **`window.history.pushState`**: Se ejecuta de manera silenciosa cada vez que se cambia a una nueva pantalla. Esto le indica al navegador que debe habilitar y agregar un nuevo paso a su historial nativo.
- **Evento `popstate`**: Un detector global que reacciona exclusivamente cuando el usuario oprime el botón "Atrás" o "Adelante" del navegador. Al activarse, extrae el estado guardado y le ordena a la aplicación cambiar de iframe sin generar un registro duplicado en la memoria.

---

## 3. Funciones Principales (en `js/script.js`)

### `switchFrame(frameId, isHistoryNavigation)`
Es el controlador maestro. Oculta todos los iframes activos y muestra el que se le solicita mediante el parámetro `frameId`. Si `isHistoryNavigation` es `false` (comportamiento predeterminado), asume que es una navegación nueva y escribe los registros en `localStorage` y `pushState`.

### `goBack()`
Lee el `historyPointer`, lo reduce en `-1` (si no está en el límite inicial) y ejecuta el retroceso visual.

### `goForward()`
Lee el `historyPointer`, lo incrementa en `+1` (si no está en el límite final) y ejecuta el avance visual.

---

## 4. Comunicación entre Módulos (Iframes)
Debido a que las aplicaciones y las pantallas de inicio operan en contenedores aislados (`iframes`), no es posible que manipulen de forma directa el historial principal por restricciones de seguridad (CORS). 

Por ello, los iframes se comunican con `index.html` mediante envíos de mensajes directos (`postMessage`).

**Ejemplo de código para implementar en iframes internos:**
```javascript
// Navegar a una pantalla específica (Ej: Volver a Home)
window.parent.postMessage({action: 'switchFrame', target: 'iframe-home'}, '*');

// Simular clic en el botón Atrás
window.parent.postMessage({action: 'goBack'}, '*');
```
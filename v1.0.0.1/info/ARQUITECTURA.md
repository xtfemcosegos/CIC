# Arquitectura del Sistema CIC-OS

Este documento explica las decisiones técnicas detrás de CIC-OS.

## 1. El Gestor de Ventanas (`index.html`)
En lugar de recargar la página completa, `index.html` actúa como un **Window Manager**. Utiliza `iframes` apilados y ocultos para mostrar las distintas pantallas.

- `iframe-home`: Pantalla de inicio pública (`public/home.html`).
- `iframe-login`: Pantalla de autenticación (`login.html`).
- `iframe-app`: Área de trabajo y escritorio (`mod/cco.html`).

**Cambio de Vistas:** El script `js/script.js` contiene la función global `switchFrame()`, que manipula el estilo `display` de los iframes e informa a la History API del navegador para habilitar las flechas de "Adelante" y "Atrás".

## 2. El Centro de Control (`mod/cco.html`)
Simula un escritorio de Sistema Operativo.
- **Dock:** Barra inferior estática.
- **Menú de Aplicaciones:** Renderizado de forma dinámica leyendo el nodo `/apps` de Firebase RTDB.
- **Panel de Notificaciones:** Interfaz para mostrar notificaciones dirigidas específicamente al `uid` del usuario.

## 3. Manejo de Datos
El sistema utiliza una arquitectura híbrida para la gestión de datos.

### 3.1. Firebase (Backend)
- **Auth:** Valida al usuario en `login.html`.
- **RTDB:** Provee la lista de aplicaciones (`/apps`) y encola notificaciones (`/notificaciones/{uid}`).

### 3.2. IndexedDB (Local/Caché)
Se crea una base de datos en el cliente llamada `cic-os` (versión 1) en el momento del arranque (`DOMContentLoaded` en `index.html`).

**Almacenes creados:**
`regas`, `elementos`, `casetas`, `marbetes`, `multimedia`, `formularios`, `reportes`, `externos`, `notificaciones`.

**Flujo de Notificaciones:**
1. El usuario inicia sesión.
2. `script.js` descarga desde Firebase las notificaciones dirigidas a su `uid`.
3. Las notificaciones se guardan dentro del almacén local `notificaciones` en IndexedDB.
4. Las notificaciones descargadas se **eliminan de Firebase** para liberar cuota de almacenamiento.
5. `cco.html` lee la base de datos local para renderizar el panel.
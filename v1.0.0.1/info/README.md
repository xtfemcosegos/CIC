# CIC-OS

CIC-OS es un entorno de simulación de Sistema Operativo basado en web, construido con tecnologías web estándar (HTML, CSS y JavaScript Vanilla). Su objetivo es proporcionar una interfaz de usuario fluida y persistente simulando un entorno de escritorio en el navegador.

## Características Principales

- **Navegación tipo Ventana/SO:** Utiliza iframes gobernados por `index.html` para el cambio entre entornos (Home Público, Login y Área de Trabajo CCO).
- **Menú Dinámico (Estilo Escritorio):** El área de trabajo principal (`mod/cco.html`) cuenta con un Dock inferior, panel de notificaciones y un menú de aplicaciones que se alimenta de Firebase Realtime Database.
- **Autenticación Integrada:** Inicio de sesión administrado a través de Firebase Auth.
- **Offline-first y Caché:** Almacenamiento local utilizando IndexedDB para caché de módulos, notificaciones de usuarios y configuraciones sin depender constantemente de internet.
- **Gestión de Historial:** Soporte nativo para botones Atrás/Adelante del navegador utilizando la HTML5 History API integrada directamente a los iframes.

## Tecnologías Utilizadas

- HTML5, CSS3, JavaScript (ES6 Modules)
- **Firebase:** Authentication y Realtime Database.
- **Almacenamiento Local:** `localStorage` (sesión e historial de iframes) e `IndexedDB` (almacenes de datos pesados como notificaciones, regas, elementos, etc.).

## Estructura Rápida de Directorios

- `/js` - Scripts globales (Firebase config, gestor de historial, IndexedDB).
- `/mod` - Módulos del sistema y del área de control central (cco.html, estilos.css).
- `/public` - Páginas públicas (Home).
- `/ico` - Iconos e imágenes de la UI.

## Próximos pasos

Consultar `ARQUITECTURA.md` para entender el flujo de los iframes y el manejo de IndexedDB.
# Manual de Integración: Apps

Este documento detalla cómo el sistema **CIC-OS** lee, interpreta y gestiona los datos provenientes de Firebase Realtime Database (RTDB) para construir el menú de aplicaciones.

## Aplicaciones (Menú de Inicio)

El menú de inicio en `mod/cco.html` se construye dinámicamente conectándose a Firebase al cargar el escritorio.

### Ruta en RTDB
`https://[TU_PROYECTO].firebaseio.com/apps`

### Estructura del JSON
Dentro del nodo `/apps`, cada aplicación debe ser un registro hijo. El identificador del nodo puede ser cualquier string único (por ejemplo, `app1`, `marbetes_app`, etc.).

```json
{
  "apps": {
    "app1": {
      "nombre": "Marbetes",
      "ruta": "mod/marbetes/index.html",
      "icono": "ico/marbetes.ico",
      "background": "#8B0000",
      "index": 1
    },
    "app2": {
      "nombre": "Reportes",
      "ruta": "mod/reportes/main.html",
      "icono": "ico/reportes.png",
      "background": "rgba(255,255,255,0.1)",
      "index": 2
    }
  }
}
```

### Descripción de Campos
- **`nombre`** *(String, Opcional)*: Texto que se mostrará debajo o al lado del icono. Si se omite, el sistema usará el ID del nodo (ej. "app1").
- **`ruta`** *(String, Obligatorio)*: Archivo al que redirige la aplicación. El sistema agrega automáticamente `../` al inicio de la ruta, por lo que debe escribirse asumiendo la raíz como punto de partida.
- **`icono`** *(String, Opcional)*: URL o ruta local de la imagen del icono. También se le agrega `../` al inicio si es una ruta relativa local.
- **`background`** *(String, Opcional)*: Color CSS del recuadro detrás del icono. Acepta HEX, RGB, o RGBA.
- **`index`** *(Number, Recomendado)*: Define el orden en el que aparecerán las aplicaciones en el menú. Se ordenan de menor a mayor.
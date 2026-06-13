# Manual de Integración: Notificaciones

Este documento detalla cómo el sistema **CIC-OS** lee, interpreta y gestiona los datos provenientes de Firebase Realtime Database (RTDB) para construir las alertas de los usuarios.

## Notificaciones del Sistema

Las notificaciones son exclusivas por usuario. Para no saturar la base de datos en la nube (RTDB), el sistema las transfiere a la base de datos local del dispositivo (IndexedDB) del usuario tan pronto como inicia sesión.

### Ruta en RTDB
`https://[TU_PROYECTO].firebaseio.com/notificaciones/{uid_del_usuario}`
*(Donde `{uid_del_usuario}` es el identificador único generado por Firebase Authentication al crear la cuenta).*

### Estructura del JSON
Dentro del `uid`, cada notificación es un registro independiente.

```json
{
  "notificaciones": {
    "USER_UID_12345": {
      "-NoxXXXXXX": {
        "titulo": "Nuevo reporte asignado",
        "descripcion": "Tienes un nuevo incidente por revisar en la caseta Norte.",
        "url": "mod/reportes/view.html?id=123",
        "img-url": "ico/alert.png"
      }
    }
  }
}
```

### Descripción de Campos
- **`titulo`** *(String)*: Encabezado principal en negritas de la notificación.
- **`descripcion`** *(String)*: Texto secundario en color gris (soporta truncamiento si es muy largo).
- **`url`** *(String, Opcional)*: Acción al hacer clic. Sirve para abrir un iframe o redirigir al usuario al módulo pertinente.
- **`img-url`** *(String, Opcional)*: Icono o avatar pequeño que se mostrará del lado izquierdo de la notificación. Si se omite, usa un icono por defecto (`../ico/cic.ico`).

### Ciclo de vida de la notificación
1. **Creación:** Un proceso backend, o un script administrativo inserta la notificación en `/notificaciones/{uid}` en RTDB.
2. **Sincronización:** Cuando el usuario con ese `{uid}` inicia sesión o recarga `cco.html`, la función `downloadNotifications()` descarga el bloque completo.
3. **Persistencia Local:** Los datos se fusionan (evitando duplicados mediante ID) en la base de datos `cic-os` de **IndexedDB**, dentro del almacén `notificaciones`.
4. **Limpieza en Nube:** El sistema **borra automáticamente** el nodo del usuario en RTDB (`remove(notifRef)`), manteniendo Firebase limpio y sin costo adicional de almacenamiento en la nube.
5. **Visualización:** El panel (`#notif-panel`) lee directamente de IndexedDB y dibuja la interfaz gráfica del usuario de la más reciente a la más antigua.
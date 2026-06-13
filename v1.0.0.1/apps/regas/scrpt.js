import { app } from '../../js/firebase.js';
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { initIndexedDB, applyHeaderStyles, syncCloudUpdate } from '../../js/script.js';

/**
 * Descarga el catálogo de casetas desde Firebase y lo guarda en IndexedDB.
 * Filtra metadatos, asigna el ID y ordena la lista por 'index'.
 * @returns {Promise<Array>} Un arreglo con las casetas ordenadas.
 */
export async function downloadCasetas() {
    try {
        // Conectar específicamente a la instancia de base de datos indicada
        const db = getDatabase(app, "https://regas.firebaseio.com");
        const updateRef = ref(db, 'casetas/ultima_actualizacion/updateDate');
        
        // 1. Obtener la última fecha de actualización remota (solo ese valor)
        const updateSnapshot = await get(updateRef);
        const remoteUpdateDate = updateSnapshot.exists() ? updateSnapshot.val() : null;
        
        const dbLocal = await initIndexedDB();
        
        // 2. Revisar la fecha local guardada en IndexedDB
        const localUpdateDate = await new Promise((resolve) => {
            const tx = dbLocal.transaction('casetas', 'readonly');
            const store = tx.objectStore('casetas');
            const req = store.get('ultima_actualizacion');
            req.onsuccess = () => resolve(req.result ? req.result.updateDate : null);
            req.onerror = () => resolve(null);
        });

        // 3. Comparar las fechas de actualización
        if (remoteUpdateDate && localUpdateDate === remoteUpdateDate) {
            console.log("Casetas al día. Cargando desde IndexedDB...");
            return new Promise((resolve, reject) => {
                const tx = dbLocal.transaction('casetas', 'readonly');
                const store = tx.objectStore('casetas');
                const req = store.getAll();
                req.onsuccess = () => {
                    // Filtramos el registro de la fecha de actualización
                    const casetasArray = req.result.filter(item => item.id !== 'ultima_actualizacion');
                    casetasArray.sort((a, b) => (a.index || 0) - (b.index || 0));
                    resolve(casetasArray);
                };
                req.onerror = () => reject(req.error);
            });
        }

        // 4. Si no están al día, descargar todo el nodo de casetas
        console.log("Casetas desactualizadas. Descargando desde Firebase...");
        const casetasRef = ref(db, 'casetas');
        const snapshot = await get(casetasRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            const casetasArray = [];
            
            const tx = dbLocal.transaction('casetas', 'readwrite');
            const store = tx.objectStore('casetas');
            
            // Limpiar almacén para borrar casetas que se hayan eliminado de la base de datos
            store.clear();
            
            // Mapear, guardar los metadatos de la actualización y las casetas
            for (const key in data) {
                if (key === 'ultima_actualizacion') {
                    store.put({ id: 'ultima_actualizacion', updateDate: data[key].updateDate });
                } else {
                    const caseta = { id: key, ...data[key] };
                    casetasArray.push(caseta);
                    store.put(caseta);
                }
            }
            
            // Ordenar numéricamente usando el campo 'index'
            casetasArray.sort((a, b) => (a.index || 0) - (b.index || 0));
            return casetasArray;
        } else {
            console.warn('El nodo de casetas está vacío o no existe.');
            return [];
        }
    } catch (error) {
        console.error('Error al descargar el catálogo de casetas:', error);
        throw error;
    }
}

/**
 * Descarga el listado completo de elementos desde Firebase y lo guarda en IndexedDB.
 * Mantiene un control de la fecha de última actualización y última descarga de la lista.
 * @returns {Promise<Array>} Un arreglo con los elementos ordenados alfabéticamente.
 */
export async function downloadElementos() {
    try {
        const db = getDatabase(app, "https://regas.firebaseio.com");
        const updateRef = ref(db, 'elementos/ultima_actualizacion');
        
        // 1. Obtener la última fecha de actualización remota
        const updateSnapshot = await get(updateRef);
        const remoteUpdateDate = updateSnapshot.exists() ? updateSnapshot.val() : null;
        
        const dbLocal = await initIndexedDB();
        
        // 2. Revisar los metadatos locales guardados en IndexedDB
        const localMeta = await new Promise((resolve) => {
            const tx = dbLocal.transaction('elementos', 'readonly');
            const store = tx.objectStore('elementos');
            const req = store.get('ultima_actualizacion');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });

        // 3. Comparar si está actualizado. Note: en elementos.json la actualización es un string directo.
        if (remoteUpdateDate && localMeta && localMeta.updateDate === remoteUpdateDate) {
            console.log("Elementos al día. Cargando desde IndexedDB...");
            return new Promise((resolve, reject) => {
                const tx = dbLocal.transaction('elementos', 'readonly');
                const store = tx.objectStore('elementos');
                const req = store.getAll();
                req.onsuccess = () => {
                    const elementsArray = req.result.filter(item => item.id !== 'ultima_actualizacion');
                    elementsArray.sort((a, b) => a.id.localeCompare(b.id)); // Orden alfabético
                    resolve(elementsArray);
                };
                req.onerror = () => reject(req.error);
            });
        }

        // 4. Si no están al día, descargar todo el nodo de elementos
        console.log("Elementos desactualizados. Descargando desde Firebase...");
        const elementosRef = ref(db, 'elementos');
        const snapshot = await get(elementosRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            const elementsArray = [];
            const timestamp = Date.now(); // Marca de tiempo de la descarga local
            
            const tx = dbLocal.transaction('elementos', 'readwrite');
            const store = tx.objectStore('elementos');
            
            // Limpiar almacén para borrar elementos que hayan sido eliminados
            store.clear();
            
            // Mapear y guardar control de descarga individual y grupal
            for (const key in data) {
                if (key === 'ultima_actualizacion') {
                    store.put({ id: 'ultima_actualizacion', updateDate: data[key], ultima_descarga: timestamp });
                } else {
                    const elemento = { id: key, ...data[key], ultima_descarga: timestamp };
                    elementsArray.push(elemento);
                    store.put(elemento);
                }
            }
            
            // Ordenar alfabéticamente por ID (Nombre)
            elementsArray.sort((a, b) => a.id.localeCompare(b.id));
            return elementsArray;
        } else {
            console.warn('El nodo de elementos está vacío o no existe.');
            return [];
        }
    } catch (error) {
        console.error('Error al descargar el catálogo de elementos:', error);
        throw error;
    }
}

/**
 * Solicita la descarga forzada de un solo elemento en específico desde Firebase.
 * Actualiza su registro en IndexedDB y renueva su campo 'ultima_descarga'.
 * @param {string} elementId - El ID/Nombre exacto del elemento a actualizar.
 */
export async function downloadElemento(elementId) {
    try {
        const db = getDatabase(app, "https://regas.firebaseio.com");
        const elementRef = ref(db, `elementos/${elementId}`);
        const snapshot = await get(elementRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            const timestamp = Date.now(); // Marca de tiempo local
            
            const elemento = {
                id: elementId,
                ...data,
                ultima_descarga: timestamp // Se actualiza solo su descarga individual
            };
            
            const dbLocal = await initIndexedDB();
            const tx = dbLocal.transaction('elementos', 'readwrite');
            const store = tx.objectStore('elementos');
            store.put(elemento);
            
            console.log(`Elemento "${elementId}" actualizado individualmente en caché.`);
            return elemento;
        } else {
            console.warn(`El elemento "${elementId}" no existe en Firebase.`);
            return null;
        }
    } catch (error) {
        console.error(`Error al descargar el elemento "${elementId}":`, error);
        throw error;
    }
}

/**
 * Descarga el registro de asistencia (Regas) desde Firebase y lo guarda en IndexedDB.
 * Permite descargar por año, mes, día o ID de elemento.
 * Mantiene un control de 'ultima_descarga' en cada nivel para evitar descargas innecesarias.
 * @param {string|number} anio - El año a descargar (Ej. "2026")
 * @param {string} [mes=null] - El mes a descargar (Ej. "Junio")
 * @param {string} [dia=null] - El día a descargar (Ej. "10062026")
 * @param {string} [idElemento=null] - El ID del elemento a descargar (Ej. "86959")
 * @param {boolean} [force=false] - Forzar la descarga ignorando la caché local (5 mins)
 * @returns {Promise<Object>} La estructura de datos solicitada.
 */
export async function downloadRegas(anio, mes = null, dia = null, idElemento = null, force = false) {
    const dbLocal = await initIndexedDB();
    const timestamp = Date.now();
    const CACHE_TIME = 5 * 60 * 1000; // 5 minutos de caché por defecto

    // 1. Obtener la estructura base del año desde IndexedDB
    let localAnio = await new Promise((resolve) => {
        const tx = dbLocal.transaction('regas', 'readonly');
        const store = tx.objectStore('regas');
        const req = store.get(anio.toString());
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });

    if (!localAnio) {
        localAnio = { id: anio.toString(), meses: {} };
    }

    // 2. Determinar la ruta en Firebase y si se requiere descarga
    let path = `/${anio}`;
    let needsDownload = force;

    if (!mes) {
        if (!localAnio.ultima_descarga || (timestamp - localAnio.ultima_descarga > CACHE_TIME)) needsDownload = true;
    } else {
        if (!localAnio.meses[mes]) localAnio.meses[mes] = { dias: {} };
        path += `/${mes}`;
        
        if (!dia) {
            if (!localAnio.meses[mes].ultima_descarga || (timestamp - localAnio.meses[mes].ultima_descarga > CACHE_TIME)) needsDownload = true;
        } else {
            if (!localAnio.meses[mes].dias[dia]) localAnio.meses[mes].dias[dia] = { registros: {} };
            path += `/${dia}`;
            
            if (!idElemento) {
                if (!localAnio.meses[mes].dias[dia].ultima_descarga || (timestamp - localAnio.meses[mes].dias[dia].ultima_descarga > CACHE_TIME)) needsDownload = true;
            } else {
                if (!localAnio.meses[mes].dias[dia].registros[idElemento]) localAnio.meses[mes].dias[dia].registros[idElemento] = {};
                path += `/${idElemento}`;
                
                if (!localAnio.meses[mes].dias[dia].registros[idElemento].ultima_descarga || (timestamp - localAnio.meses[mes].dias[dia].registros[idElemento].ultima_descarga > CACHE_TIME)) needsDownload = true;
            }
        }
    }

    // 3. Ejecutar descarga si la caché expiró o se forzó
    if (needsDownload) {
        console.log(`Descargando regas desde Firebase: ${path}`);
        const db = getDatabase(app, "https://regas.firebaseio.com");
        const regasRef = ref(db, path);
        const snapshot = await get(regasRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Función auxiliar para procesar un día
            const procesarDia = (datosDia, objDia) => {
                objDia.ultima_descarga = timestamp;
                if (datosDia.ultima_actualizacion) objDia.ultima_actualizacion = datosDia.ultima_actualizacion;
                for (const id in datosDia) {
                    if (id !== 'ultima_actualizacion') {
                        objDia.registros[id] = { ...datosDia[id], ultima_descarga: timestamp };
                    }
                }
            };

            // Inyectar los datos en el árbol local según el nivel descargado
            if (!mes) {
                localAnio.ultima_descarga = timestamp;
                for (const m in data) {
                    if (!localAnio.meses[m]) localAnio.meses[m] = { dias: {} };
                    localAnio.meses[m].ultima_descarga = timestamp;
                    for (const d in data[m]) {
                        if (!localAnio.meses[m].dias[d]) localAnio.meses[m].dias[d] = { registros: {} };
                        procesarDia(data[m][d], localAnio.meses[m].dias[d]);
                    }
                }
            } else if (!dia) {
                localAnio.meses[mes].ultima_descarga = timestamp;
                for (const d in data) {
                    if (!localAnio.meses[mes].dias[d]) localAnio.meses[mes].dias[d] = { registros: {} };
                    procesarDia(data[d], localAnio.meses[mes].dias[d]);
                }
            } else if (!idElemento) {
                procesarDia(data, localAnio.meses[mes].dias[dia]);
            } else {
                localAnio.meses[mes].dias[dia].registros[idElemento] = { ...data, ultima_descarga: timestamp };
            }
            
            // Guardar el árbol completo actualizado en IndexedDB
            const txWrite = dbLocal.transaction('regas', 'readwrite');
            const storeWrite = txWrite.objectStore('regas');
            storeWrite.put(localAnio);
            
        } else {
            console.warn(`No se encontraron datos en Firebase para: ${path}`);
            return null;
        }
    } else {
        console.log(`Cargando regas desde caché local: ${path}`);
    }

    // 4. Retornar solo el fragmento solicitado
    if (!mes) return localAnio;
    if (!dia) return localAnio.meses[mes];
    if (!idElemento) return localAnio.meses[mes].dias[dia];
    return localAnio.meses[mes].dias[dia].registros[idElemento];
}

/**
 * Descarga el catálogo de motivos de ausentismo desde Firebase y lo guarda en IndexedDB.
 * Utiliza control de fecha para optimizar las recargas locales.
 */
export async function downloadMotivosAusentismo() {
    try {
        const db = getDatabase(app, "https://regas.firebaseio.com");
        const updateRef = ref(db, 'motivosausentismo/ultima_actualizacion/updateDate');
        
        const updateSnapshot = await get(updateRef);
        const remoteUpdateDate = updateSnapshot.exists() ? updateSnapshot.val() : null;
        
        const dbLocal = await initIndexedDB();
        
        const localUpdateDate = await new Promise((resolve) => {
            const tx = dbLocal.transaction('motivosAusentismo', 'readonly');
            const store = tx.objectStore('motivosAusentismo');
            const req = store.get('ultima_actualizacion');
            req.onsuccess = () => resolve(req.result ? req.result.updateDate : null);
            req.onerror = () => resolve(null);
        });

        if (remoteUpdateDate && localUpdateDate === remoteUpdateDate) {
            return new Promise((resolve, reject) => {
                const tx = dbLocal.transaction('motivosAusentismo', 'readonly');
                const store = tx.objectStore('motivosAusentismo');
                const req = store.getAll();
                req.onsuccess = () => {
                    const arr = req.result.filter(item => item.id !== 'ultima_actualizacion');
                    arr.sort((a, b) => (a.index || 0) - (b.index || 0));
                    resolve(arr);
                };
                req.onerror = () => reject(req.error);
            });
        }

        const snapshot = await get(ref(db, 'motivosausentismo'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            const arr = [];
            const tx = dbLocal.transaction('motivosAusentismo', 'readwrite');
            const store = tx.objectStore('motivosAusentismo');
            store.clear();
            for (const key in data) {
                if (key === 'ultima_actualizacion') {
                    store.put({ id: 'ultima_actualizacion', updateDate: data[key].updateDate });
                } else {
                    const item = { id: key, ...data[key] };
                    arr.push(item);
                    store.put(item);
                }
            }
            arr.sort((a, b) => (a.index || 0) - (b.index || 0));
            return arr;
        }
        
        // Lista predeterminada de RH en caso de que no exista el nodo aún en Firebase
        const defaultMotivos = [
            { id: "Falta", index: 1, bgHeader: { preset: 0, customColors: ["#991b1b", "#7f1d1d", "#000000", "#000000", "#000000"] } },
            { id: "Descanso", index: 2, bgHeader: { preset: 0, customColors: ["#1e3a8a", "#1d4ed8", "#000000", "#000000", "#000000"] } },
            { id: "Incapacidad", index: 3, bgHeader: { preset: 0, customColors: ["#b45309", "#d97706", "#000000", "#000000", "#000000"] } },
            { id: "Vacaciones", index: 4, bgHeader: { preset: 0, customColors: ["#047857", "#059669", "#000000", "#000000", "#000000"] } },
            { id: "Permiso", index: 5, bgHeader: { preset: 0, customColors: ["#6b21a8", "#7e22ce", "#000000", "#000000", "#000000"] } },
            { id: "Desconocido", index: 99, bgHeader: { preset: 0, customColors: ["#4b5563", "#6b7280", "#000000", "#000000", "#000000"] } }
        ];
        
        // Guardamos la lista base en caché para que esté lista offline
        const tx = dbLocal.transaction('motivosAusentismo', 'readwrite');
        const store = tx.objectStore('motivosAusentismo');
        store.clear();
        defaultMotivos.forEach(m => store.put(m));
        
        return defaultMotivos;
    } catch (error) { throw error; }
}

/**
 * Crea un nuevo motivo de ausentismo si no existe en la base de datos y lo sube a Firebase
 * @param {Object} motivoObj - Estructura predeterminada del motivo
 */
export async function createMotivoAusentismo(motivoObj) {
    try {
        const dbLocal = await initIndexedDB();
        const tx = dbLocal.transaction('motivosAusentismo', 'readwrite');
        const store = tx.objectStore('motivosAusentismo');
        
        const newTimestamp = Date.now();
        store.put(motivoObj);
        store.put({ id: 'ultima_actualizacion', updateDate: newTimestamp });
        
        const updates = {};
        updates[`motivosausentismo/${motivoObj.id}`] = motivoObj;
        updates[`motivosausentismo/ultima_actualizacion/updateDate`] = newTimestamp;
        
        await syncCloudUpdate("https://regas.firebaseio.com", updates);
    } catch (e) { console.error("Error al crear motivo:", e); }
}

/**
 * Obtiene la fotografía de un elemento.
 * Intenta leerla de IndexedDB (en Base64), y si no existe, la descarga desde Firebase Storage.
 * @param {string} id - El ID del elemento
 * @returns {Promise<string>} Base64 de la imagen o una silueta SVG por defecto
 */
export async function getFotoElemento(id) {
    const siluetaDefault = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23cccccc%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%2F%3E%3C%2Fsvg%3E';
    const dbLocal = await initIndexedDB();
    
    // 1. Intentar obtener desde IndexedDB
    let fotosEntry = await new Promise((resolve) => {
        const tx = dbLocal.transaction('multimedia', 'readonly');
        const store = tx.objectStore('multimedia');
        const req = store.get('Fotos');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });

    if (!fotosEntry) fotosEntry = { id: 'Fotos' };

    if (fotosEntry[id]) {
        if (fotosEntry[id] instanceof Blob) {
            return URL.createObjectURL(fotosEntry[id]);
        }
        return fotosEntry[id]; // Devuelve Base64 si se guardó con el formato anterior
    }

    // 2. Si no está en caché, descargar de Firebase Storage
    const storage = getStorage(app);
    const photoRef = storageRef(storage, `Fotos/ElementosPP/${id}.webp`);
    
    let url;
    try {
        // Intentamos obtener la ruta pública del archivo
        url = await getDownloadURL(photoRef);
    } catch (error) {
        // Falla silenciosa: El archivo no existe en Storage o no hay permisos
        return siluetaDefault;
    }

    // 3. Intentar descargarla como binario para guardarla en caché (Puede fallar por políticas CORS)
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        // Guardar el Blob directamente en IndexedDB ('multimedia' > 'Fotos' > ID)
        const txWrite = dbLocal.transaction('multimedia', 'readwrite');
        const storeWrite = txWrite.objectStore('multimedia');
        
        const reqWrite = storeWrite.get('Fotos');
        reqWrite.onsuccess = () => {
            const updatedEntry = reqWrite.result || { id: 'Fotos' };
            updatedEntry[id] = blob;
            storeWrite.put(updatedEntry);
        };
        
        return URL.createObjectURL(blob);
    } catch (error) {
        // Si falla la conversión a binario, retornamos la URL directa para que al menos se renderice
        console.warn(`No se pudo cachear la foto de ${id} por políticas de CORS en Storage. Mostrando URL directa.`, error);
        return url;
    }
}

/**
 * Actualiza en Firebase la ubicación (Caseta/Motivo) de un elemento mediante Drag and Drop
 */
export async function moveElementoRegas(anio, mes, dia, idElemento, dbKey, newBoxId, isAusentismo, extraUpdates = null) {
    try {
        const fieldToUpdate = isAusentismo ? 'motivo' : 'Caseta';
        const localUpdates = { [fieldToUpdate]: newBoxId };

        if (extraUpdates) {
            for (const [k, v] of Object.entries(extraUpdates)) {
                localUpdates[k] = v;
            }
        }
        
        // Limpiar la contraparte para mantener la base de datos pulcra
        if (isAusentismo) {
            localUpdates.Caseta = null;
        } else {
            localUpdates.motivo = null;
            localUpdates.Motivo = null;
        }
        
        const timestamp = await updateShiftDataLocal(anio, mes, dia, idElemento, dbKey, localUpdates);
        
        const updates = {};
        for (const [k, v] of Object.entries(localUpdates)) {
            updates[`${anio}/${mes}/${dia}/${idElemento}/${dbKey}/${k}`] = v;
        }
        updates[`${anio}/${mes}/${dia}/ultima_actualizacion`] = timestamp;
        
        await syncCloudUpdate("https://regas.firebaseio.com", updates);
    } catch(e) {
        console.error("Error moviendo elemento:", e);
        throw e;
    }
}

// Helper Interno: Actualizar campo específico del turno
export async function updateShiftData(anio, mes, dia, idElemento, shiftKey, updatesObj) {
    try {
        const updates = {};
        const path = `${anio}/${mes}/${dia}/${idElemento}/${shiftKey}`;
        for (const [k, v] of Object.entries(updatesObj)) {
            updates[`${path}/${k}`] = v;
        }
        updates[`${anio}/${mes}/${dia}/ultima_actualizacion`] = Date.now();
        await syncCloudUpdate("https://regas.firebaseio.com", updates);
    } catch(e) {
        console.error("Error en updateShiftData:", e);
    }
}

export async function updateShiftDataLocal(anio, mes, dia, idElemento, shiftKey, updatesObj) {
    const dbLocal = await initIndexedDB();
    const timestamp = Date.now();
    return new Promise((resolve, reject) => {
        const tx = dbLocal.transaction('regas', 'readwrite');
        const store = tx.objectStore('regas');
        const req = store.get(anio.toString());
        req.onsuccess = () => {
            let localAnio = req.result;
            if (localAnio && localAnio.meses[mes] && localAnio.meses[mes].dias[dia]) {
                let record = localAnio.meses[mes].dias[dia].registros[idElemento];
                if (!record) {
                    localAnio.meses[mes].dias[dia].registros[idElemento] = {};
                    record = localAnio.meses[mes].dias[dia].registros[idElemento];
                }
                if (!record[shiftKey]) record[shiftKey] = {};
                
                for (const [k, v] of Object.entries(updatesObj)) {
                    if (v === null) delete record[shiftKey][k];
                    else record[shiftKey][k] = v;
                }
                record[shiftKey].ultima_edicion = timestamp;
                localAnio.meses[mes].dias[dia].ultima_actualizacion = timestamp;
                store.put(localAnio);
            }
            resolve(timestamp);
        };
        req.onerror = () => reject(req.error);
    });
}

export async function updateShiftDataCloud(anio, mes, dia, idElemento, shiftKey, updatesObj, timestamp) {
    const updates = {};
    const path = `${anio}/${mes}/${dia}/${idElemento}/${shiftKey}`;
    for (const [k, v] of Object.entries(updatesObj)) {
        updates[`${path}/${k}`] = v;
    }
    updates[`${path}/ultima_edicion`] = timestamp;
    updates[`${anio}/${mes}/${dia}/ultima_actualizacion`] = timestamp;
    await syncCloudUpdate("https://regas.firebaseio.com", updates);
}

// Helper Interno: Renombrar llave (Ej. de Matutino a Ausentismo)
export async function renameShiftKey(anio, mes, dia, idElemento, oldKey, newKey, newData) {
    try {
        const timestamp = Date.now();
        const dbLocal = await initIndexedDB();
        await new Promise((resolve, reject) => {
            const tx = dbLocal.transaction('regas', 'readwrite');
            const store = tx.objectStore('regas');
            const req = store.get(anio.toString());
            req.onsuccess = () => {
                let localAnio = req.result;
                if (localAnio && localAnio.meses[mes] && localAnio.meses[mes].dias[dia]) {
                    let record = localAnio.meses[mes].dias[dia].registros[idElemento];
                    if (record) {
                        record[newKey] = newData;
                        record[newKey].ultima_edicion = timestamp;
                        delete record[oldKey];
                        localAnio.meses[mes].dias[dia].ultima_actualizacion = timestamp;
                        store.put(localAnio);
                    }
                }
                resolve();
            };
            req.onerror = () => reject(req.error);
        });

        const updates = {};
        updates[`${anio}/${mes}/${dia}/${idElemento}/${newKey}`] = newData;
        updates[`${anio}/${mes}/${dia}/${idElemento}/${oldKey}`] = null;
        updates[`${anio}/${mes}/${dia}/ultima_actualizacion`] = timestamp;
        await syncCloudUpdate("https://regas.firebaseio.com", updates);
    } catch(e) {
        console.error("Error en renameShiftKey:", e);
    }
}

// Helper Interno: Eliminar turno completo
export async function deleteShiftKey(anio, mes, dia, idElemento, shiftKey) {
    try {
        const timestamp = Date.now();
        const dbLocal = await initIndexedDB();
        await new Promise((resolve, reject) => {
            const tx = dbLocal.transaction('regas', 'readwrite');
            const store = tx.objectStore('regas');
            const req = store.get(anio.toString());
            req.onsuccess = () => {
                let localAnio = req.result;
                if (localAnio && localAnio.meses[mes] && localAnio.meses[mes].dias[dia]) {
                    let record = localAnio.meses[mes].dias[dia].registros[idElemento];
                    if (record && record[shiftKey]) {
                        delete record[shiftKey];
                        localAnio.meses[mes].dias[dia].ultima_actualizacion = timestamp;
                        store.put(localAnio);
                    }
                }
                resolve();
            };
            req.onerror = () => reject(req.error);
        });

        const updates = {};
        updates[`${anio}/${mes}/${dia}/${idElemento}/${shiftKey}`] = null;
        updates[`${anio}/${mes}/${dia}/ultima_actualizacion`] = timestamp;
        await syncCloudUpdate("https://regas.firebaseio.com", updates);
    } catch(e) {
        console.error("Error en deleteShiftKey:", e);
    }
}

/**
 * (Paso 1) Actualiza el perfil de un elemento SOLO en la Base Local (IndexedDB).
 */
export async function updateElementProfileLocal(elementKey, flatUpdates) {
    const dbLocal = await initIndexedDB();
    const timestamp = Date.now();
    return new Promise((resolve, reject) => {
        const tx = dbLocal.transaction('elementos', 'readwrite');
        const store = tx.objectStore('elementos');
        const req = store.get(elementKey);
        req.onsuccess = () => {
            let el = req.result;
            if (!el) el = { id: elementKey };
            
            for (const [path, val] of Object.entries(flatUpdates)) {
                const parts = path.split('.');
                let current = el;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = val;
            }
            
            el.ultima_edicion = timestamp;
            el.ultima_actualizacion = timestamp;
            store.put(el);
            
            // Actualizar marcador global
            store.put({ id: 'ultima_actualizacion', updateDate: timestamp, ultima_descarga: timestamp });
            resolve(timestamp);
        };
        req.onerror = () => reject(req.error);
    });
}

/**
 * (Paso 2) Actualiza el perfil en la Nube (Firebase RTDB).
 */
export async function updateElementProfileCloud(elementKey, flatUpdates, timestamp) {
    const updates = {};
    
    for (const [path, val] of Object.entries(flatUpdates)) {
        updates[`elementos/${elementKey}/${path.replace(/\./g, '/')}`] = val;
    }
    
    updates[`elementos/${elementKey}/ultima_edicion`] = timestamp;
    updates[`elementos/${elementKey}/ultima_actualizacion`] = timestamp;
    updates[`elementos/ultima_actualizacion`] = timestamp;
    
    await syncCloudUpdate("https://regas.firebaseio.com", updates);
}

// Helper Interno: Renderizar formulario de perfil interactivo
function renderProfileForm(container, elData, elementKey) {
    const createInput = (label, value, path, type="text", extraHtml="") => {
        let safeValue = (value || '').toString().replace(/"/g, '&quot;');
        
        // Corrección estricta de formato de fecha para inputs tipo "date" (requiere yyyy-MM-dd)
        if (type === 'date' && safeValue) {
            if (safeValue.includes('/')) {
                const p = safeValue.split('/');
                if (p.length === 3) safeValue = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            } else if (safeValue.includes('-')) {
                const p = safeValue.split('-');
                // Si tiene guiones pero el año no está al principio (ej. 12-06-2023)
                if (p.length === 3 && p[0].length !== 4) {
                    safeValue = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                }
            }
        }
        
        return `
            <div class="input-col">
                <label>${label}</label>
                <div style="display:flex; gap:5px; align-items:center;">
                    <div style="position:relative; flex:1; display:flex; align-items:center;">
                        <input type="${type}" class="form-select profile-input" data-path="${path}" value="${safeValue}" style="width:100%; padding-right:25px;">
                        <div class="save-status" style="position:absolute; right:8px; display:flex; align-items:center; pointer-events:none;"></div>
                    </div>
                    ${extraHtml}
                </div>
            </div>
        `;
    };

    const createSelect = (label, value, path, options) => {
        let optsHtml = options.map(opt => {
            const isSelected = (value || '').toLowerCase() === opt.value.toLowerCase() ? 'selected' : '';
            return `<option value="${opt.value}" ${isSelected}>${opt.text}</option>`;
        }).join('');
        
        // Mantener valor existente si no está en las opciones conocidas
        const exists = options.some(opt => opt.value.toLowerCase() === (value || '').toLowerCase());
        if (value && !exists) optsHtml += `<option value="${value}" selected>${value} (Desconocido)</option>`;

        return `
            <div class="input-col">
                <label>${label}</label>
                <div style="position:relative; display:flex; align-items:center;">
                    <select class="form-select profile-input" data-path="${path}" style="width:100%; padding-right:25px;">
                        <option value="">Seleccione...</option>
                        ${optsHtml}
                    </select>
                    <div class="save-status" style="position:absolute; right:20px; display:flex; align-items:center; pointer-events:none;"></div>
                </div>
            </div>
        `;
    };

    const createCheckbox = (label, value, path) => {
        const isChecked = value === true || value === "true" || value === "Si" || value === "Sí" || value === "SI";
        return `
            <div class="input-col" style="justify-content: flex-end; padding-bottom: 8px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:600; color:#334155; margin:0; text-transform:none;">
                    <input type="checkbox" class="profile-input-cb" data-path="${path}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; accent-color: var(--fiusha);">
                    ${label}
                    <div class="save-status" style="display:flex; align-items:center;"></div>
                </label>
            </div>
        `;
    };

    const idData = elData.Identidad || {};
    const opData = elData.Operativa || {};
    const uniData = elData.Uniforme || {};
    const emergencia = (idData['en caso de emergencia'] && idData['en caso de emergencia'][0]) ? idData['en caso de emergencia'][0] : {};
    const curso = (idData.Curso && idData.Curso[0]) ? idData.Curso[0] : {};

    const telValue = (elData.Teléfono || '').replace(/\D/g,'');
    const emailValue = elData.email || '';

    // --- CÁLCULO DE EDAD EXACTA ---
    const dobValue = idData['Fecha de nacimiento'];
    let edadValue = '--';
    if (dobValue && typeof dobValue === 'string') {
        let birthDate;
        if (dobValue.includes('-')) {
            const parts = dobValue.split('-');
            if (parts[0].length === 4) {
                birthDate = new Date(parts[0], parts[1] - 1, parts[2]); // YYYY-MM-DD
            } else {
                birthDate = new Date(parts[2], parts[1] - 1, parts[0]); // DD-MM-YYYY
            }
        } else if (dobValue.includes('/')) {
            const parts = dobValue.split('/');
            birthDate = new Date(parts[2], parts[1] - 1, parts[0]); // Asume DD/MM/YYYY
        } else {
            birthDate = new Date(dobValue);
        }

        if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            edadValue = age >= 0 ? age + ' años' : '--';
        }
    }

    const svgWA = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`;
    const svgCall = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    const svgSMS = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    const svgMail = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;

    const telBtns = `
        <button type="button" title="WhatsApp" onclick="window.location.href='whatsapp://send?phone=52${telValue}'" style="border:none; background:#25D366; color:white; border-radius:6px; padding:9px 10px; cursor:pointer; display:flex; align-items:center; transition: all 0.2s; box-shadow: 0 2px 4px rgba(37,211,102,0.2);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${svgWA}</button>
        <button type="button" title="Mensaje SMS" onclick="window.location.href='sms:${telValue}'" style="border:none; background:#8b5cf6; color:white; border-radius:6px; padding:9px 10px; cursor:pointer; display:flex; align-items:center; transition: all 0.2s; box-shadow: 0 2px 4px rgba(139,92,246,0.2);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${svgSMS}</button>
        <button type="button" title="Llamar" onclick="window.location.href='tel:${telValue}'" style="border:none; background:#3b82f6; color:white; border-radius:6px; padding:9px 10px; cursor:pointer; display:flex; align-items:center; transition: all 0.2s; box-shadow: 0 2px 4px rgba(59,130,246,0.2);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${svgCall}</button>
    `;
    const mailBtns = `
        <button type="button" title="Enviar Correo" onclick="window.location.href='mailto:${emailValue}'" style="border:none; background:#ef4444; color:white; border-radius:6px; padding:9px 10px; cursor:pointer; display:flex; align-items:center; transition: all 0.2s; box-shadow: 0 2px 4px rgba(239,68,68,0.2);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${svgMail}</button>
    `;

    const modulos = [
        {value: 'cco', text: 'CCO'},
        {value: 'encargado', text: 'Encargado'},
        {value: 'caseta', text: 'Caseta'},
        {value: 'elemento', text: 'Elemento'},
        {value: 'colaborador', text: 'Colaborador'},
        {value: 'externo', text: 'Externo'}
    ];

    let html = `
        <div class="shift-detail-body">
            <!-- IDENTIFICACIÓN PRINCIPAL (FUERA DE SECCIONES) -->
            <div class="detail-row" style="margin-bottom: 5px;">
                ${createInput('Num. Empleado / ID', elData.ID, 'ID')}
                ${createSelect('Estado', opData.Estado, 'Operativa.Estado', [{value:'Activo', text:'Activo'}, {value:'Baja', text:'Baja'}])}
            </div>

            <!-- CONTACTO -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> Contacto</h4>
                <div class="detail-row" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                    ${createInput('Teléfono', elData.Teléfono, 'Teléfono', 'text', telBtns)}
                    ${createInput('Correo Electrónico', elData.email, 'email', 'email', mailBtns)}
                </div>
            </div>

            <!-- IDENTIDAD: DATOS PERSONALES -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Datos Personales</h4>
                <div class="detail-row">
                    ${createInput('Fecha Nacimiento', idData['Fecha de nacimiento'], 'Identidad.Fecha de nacimiento', 'date')}
                    <div class="input-col"><label>Edad Exacta</label><div class="worked-time" style="border: 1px solid #cbd5e1; background: #ffffff; color: var(--fiusha);">${edadValue}</div></div>
                    ${createInput('Género', idData.Genero, 'Identidad.Genero')}
                </div>
                <div class="detail-row">
                    ${createInput('Estado Civil', idData['Estado civil'], 'Identidad.Estado civil')}
                    ${createInput('Lugar de Origen', idData['Lugar de origen'], 'Identidad.Lugar de origen')}
                </div>
            </div>

            <!-- IDENTIDAD: MÉDICA -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Información Médica</h4>
                <div class="detail-row">
                    ${createInput('No. IMSS', idData['No de IMSS'], 'Identidad.No de IMSS')}
                    ${createSelect('Tipo Sangre', idData['Tipo de sangre'], 'Identidad.Tipo de sangre', [
                        {value:'O+', text:'O+'}, {value:'O-', text:'O-'},
                        {value:'A+', text:'A+'}, {value:'A-', text:'A-'},
                        {value:'B+', text:'B+'}, {value:'B-', text:'B-'},
                        {value:'AB+', text:'AB+'}, {value:'AB-', text:'AB-'}
                    ])}
                    ${createInput('Alergias', idData.Alergias, 'Identidad.Alergias')}
                </div>
            </div>

            <!-- IDENTIDAD: CONTACTO DE EMERGENCIA -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Contacto de Emergencia</h4>
                <div class="detail-row">
                    ${createInput('Nombre', emergencia.Nombre, 'Identidad.en caso de emergencia.0.Nombre')}
                    ${createInput('Parentesco', emergencia.Parentesco, 'Identidad.en caso de emergencia.0.Parentesco')}
                    ${createInput('Teléfono', emergencia['numero de telefono'], 'Identidad.en caso de emergencia.0.numero de telefono')}
                </div>
            </div>

            <!-- IDENTIDAD: DOMICILIO Y EDUCACIÓN -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> Domicilio y Educación</h4>
                <div class="detail-row" style="grid-template-columns: 1fr;">
                    ${createInput('Domicilio Actual', idData['Domicilio actual'], 'Identidad.Domicilio actual')}
                </div>
                <div class="detail-row">
                    ${createInput('Grado Estudios', idData['Grado de estudios'], 'Identidad.Grado de estudios')}
                    ${createInput('Institución', idData.Institucion, 'Identidad.Institucion')}
                </div>
                <div class="detail-row">
                    ${createInput('Último Curso', curso.Curso, 'Identidad.Curso.0.Curso')}
                    ${createInput('Fecha Curso', curso.Fecha, 'Identidad.Curso.0.Fecha')}
                    ${createInput('Estatus Curso', curso.Estatus, 'Identidad.Curso.0.Estatus')}
                </div>
            </div>

            <!-- OPERATIVA: LABORAL -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> Perfil Laboral Operativo</h4>
                <div class="detail-row">
                    ${createInput('Puesto', opData.Puesto, 'Operativa.Puesto')}
                    ${createInput('Caseta / Acceso Predet.', opData.AccesoPredeterminado, 'Operativa.AccesoPredeterminado')}
                </div>
            </div>

            <!-- UNIFORME -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><path d="M20.38 3.46L16 2a8 8 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path></svg> Tallas de Uniforme</h4>
                <div class="detail-row">
                    ${createInput('Camisa / Polo', uniData.Camisa, 'Uniforme.Camisa')}
                    ${createInput('Pantalón', uniData.Pantalon, 'Uniforme.Pantalon')}
                    ${createInput('Calzado', uniData.Calzado, 'Uniforme.Calzado')}
                    ${createCheckbox('Usa Gorra', uniData.Gorra, 'Uniforme.Gorra')}
                </div>
            </div>

            <!-- SISTEMA -->
            <div class="form-group-box">
                <h4 class="profile-section-title"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg> Sistema</h4>
                <div class="detail-row">
                    ${createSelect('Módulo del Sistema', elData.Modulo, 'Modulo', modulos)}
                    ${createInput('UID Vinculado', elData.uid, 'uid')}
                </div>
                <div class="detail-row">
                    ${createInput('Fecha Ingreso', opData.FechaDeIngreso, 'Operativa.FechaDeIngreso', 'date')}
                    ${createInput('Fecha Baja', opData.FechaDeBaja, 'Operativa.FechaDeBaja', 'date')}
                    ${createCheckbox('Acceso Habilitado', elData.Acceso, 'Acceso')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // --- AUTOGUARDADO INDIVIDUAL POR CAMPO (AUTO-SAVE) ---
    container.querySelectorAll('.profile-input, .profile-input-cb').forEach(input => {
        input.addEventListener('change', async (e) => {
            const path = input.getAttribute('data-path');
            const value = input.type === 'checkbox' ? input.checked : input.value;
            
            const statusDiv = input.parentNode.querySelector('.save-status');
            const svgClock = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="#94a3b8" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
            const svgCheckGray = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#94a3b8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            const svgCheckGreen = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#059669" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            if (statusDiv) statusDiv.innerHTML = svgClock;
            input.style.backgroundColor = '#fef08a'; // Amarillo (Guardando)
            
            try {
                const ts = await updateElementProfileLocal(elementKey, { [path]: value });
                if (statusDiv) statusDiv.innerHTML = svgCheckGray; // Guardado Local
                
                await updateElementProfileCloud(elementKey, { [path]: value }, ts);
                if (statusDiv) statusDiv.innerHTML = `<div style="display:flex; margin-right:-6px;">${svgCheckGreen}<span style="margin-left:-10px;">${svgCheckGreen}</span></div>`; // Guardado Nube
                
                input.style.backgroundColor = '#dcfce7'; // Verde (Éxito)
                setTimeout(() => { input.style.backgroundColor = ''; if (statusDiv) statusDiv.innerHTML = ''; }, 2500);
            } catch (err) {
                console.error("Error al autoguardar:", err);
                if (statusDiv) statusDiv.innerHTML = `<span style="color:#ef4444; font-weight:bold; font-size:14px;">!</span>`;
                input.style.backgroundColor = '#fee2e2'; // Rojo (Error)
                setTimeout(() => { input.style.backgroundColor = ''; if (statusDiv) statusDiv.innerHTML = ''; }, 2500);
            }
        });
    });
}

// --- LÓGICA DEL PANEL DERECHO (DETALLES) ---

export function closeRightPanel() {
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel) rightPanel.style.display = 'none';
}

export async function openDetailPanel(idElemento, empleadoNombre, record, initialShiftName, bgHeader = null, casetasList = [], motivosList = [], isToday = false, anio, mes, dia) {
    const rightPanel = document.getElementById('right-panel');
    if (!rightPanel) return;
    
    // Ocultar la lista de catálogo y mostrar los detalles
    const detailDiv = document.getElementById('right-panel-detail');
    const addDiv = document.getElementById('right-panel-add');
    const reportDiv = document.getElementById('right-panel-report');
    if (detailDiv) detailDiv.style.display = 'flex';
    if (addDiv) addDiv.style.display = 'none';
    if (reportDiv) reportDiv.style.display = 'none';

    let localRecord = record || {};
    rightPanel.style.display = 'flex';
    
    // Reconstruir objeto fecha para uso en reportes
    const mesesStr = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mIndex = mesesStr.indexOf(mes);
    const dNum = parseInt(dia.substring(0, 2), 10);
    const yNum = parseInt(anio, 10);
    const contextDate = new Date(yNum, mIndex, dNum);
    
    const headerEl = rightPanel.querySelector('.detail-header');
    if (headerEl) {
        applyHeaderStyles(headerEl, bgHeader);
    }

    const nameEl = document.getElementById('detail-name');
    const idEl = document.getElementById('detail-id');
    const photoEl = document.getElementById('detail-photo');
    
    if (nameEl) nameEl.innerText = empleadoNombre;
    if (idEl) idEl.innerText = `ID: ${idElemento}`;
    
    if (photoEl) {
        // Silueta mientras carga la foto asíncrona
        photoEl.src = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23cccccc%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%2F%3E%3C%2Fsvg%3E';
        getFotoElemento(idElemento).then(url => { photoEl.src = url; });
    }
    
    // Cargar perfil en la primera pestaña
    const contentPerfil = document.getElementById('content-perfil');
    if (contentPerfil) {
        contentPerfil.innerHTML = '<p style="color: #888; text-align: center; margin-top: 20px;">Cargando perfil...</p>';
        initIndexedDB().then(dbLocal => {
            const tx = dbLocal.transaction('elementos', 'readonly');
            const store = tx.objectStore('elementos');
            const req = store.get(empleadoNombre);
            req.onsuccess = () => {
                const qaContainer = document.getElementById('detail-quick-actions-container');
                if (qaContainer) qaContainer.innerHTML = ''; // Limpiar por si acaso
                
                if (req.result) {
                    renderProfileForm(contentPerfil, req.result, empleadoNombre);
                    
                    const elData = req.result;
                    const telValue = (elData.Teléfono || '').replace(/\D/g,'');
                    const emailValue = elData.email || '';
                    
                    const svgWA = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`;
                    const svgSMS = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                    const svgCall = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
                    const svgMail = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
                    
                    if (qaContainer) {
                        qaContainer.innerHTML = `
                            <div class="mobile-quick-actions" style="padding: 15px 15px 5px 15px; margin: 0; width: auto; box-sizing: border-box;">
                                <button type="button" title="WhatsApp" onclick="window.location.href='whatsapp://send?phone=52${telValue}'" class="mq-btn wa-btn">${svgWA}</button>
                                <button type="button" title="Mensaje SMS" onclick="window.location.href='sms:${telValue}'" class="mq-btn sms-btn">${svgSMS}</button>
                                <button type="button" title="Llamar" onclick="window.location.href='tel:${telValue}'" class="mq-btn call-btn">${svgCall}</button>
                                <button type="button" title="Enviar Correo" onclick="window.location.href='mailto:${emailValue}'" class="mq-btn mail-btn">${svgMail}</button>
                            </div>
                        `;
                    }
                } else {
                    contentPerfil.innerHTML = '<p style="color: red; text-align: center; margin-top: 20px;">Perfil no encontrado localmente.</p>';
                }
            };
        });
    }

    selectDetailTab('turno'); // Mueve a pestaña turno
    
    const container = document.getElementById('turno-details-container');
    if (container) {
        // Determinar todos los turnos disponibles para este empleado en esta fecha
        const availableShifts = [];
        if (localRecord) {
            Object.keys(localRecord).forEach(k => {
                const lowerK = k.toLowerCase();
                if (['matutino', 'vespertino', 'nocturno', 'ausentismo'].includes(lowerK)) {
                    availableShifts.push({ name: lowerK, dbKey: k, data: localRecord[k] });
                }
            });
        }

        const renderShiftForm = (activeShiftName) => {
            container.innerHTML = '';
            
            // 1. DIBUJAR SUB-PESTAÑAS
            const tabsDiv = document.createElement('div');
            tabsDiv.className = 'shift-subtabs';
            
            availableShifts.forEach(sh => {
                const t = document.createElement('div');
                t.className = `subtab subtab-${sh.name}` + (sh.name === activeShiftName ? ' active' : '');
                t.innerText = sh.name.charAt(0).toUpperCase() + sh.name.slice(1);
                t.onclick = () => renderShiftForm(sh.name);
                tabsDiv.appendChild(t);
            });
            
            const tGhost = document.createElement('div');
            tGhost.className = 'subtab ghost' + (activeShiftName === null ? ' active' : '');
            tGhost.innerText = '+ Nuevo';
            tGhost.onclick = () => renderShiftForm(null); // Formulario vacío
            tabsDiv.appendChild(tGhost);
            
            container.appendChild(tabsDiv);
            
            // 2. EXTRAER DATOS DEL TURNO SELECCIONADO

            // Si es la pestaña "Fantasma", dibujamos los botones de turnos disponibles para crear
            if (activeShiftName === null) {
                const ghostDiv = document.createElement('div');
                let buttonsHtml = '';
                let hasAvailable = false;
                
                ['Matutino', 'Vespertino', 'Nocturno', 'Ausentismo'].forEach(t => {
                    const exists = availableShifts.find(sh => sh.name === t.toLowerCase());
                    if (!exists) {
                        hasAvailable = true;
                        buttonsHtml += `<button class="btn-new-shift" data-turno="${t.toLowerCase()}">+ ${t}</button>`;
                    }
                });

                if (!hasAvailable) {
                    buttonsHtml = `<p style="text-align: center; color: #64748b; font-size: 12px; grid-column: 1 / -1; margin: 10px 0;">Todos los turnos posibles ya están asignados.</p>`;
                }

                ghostDiv.innerHTML = `
                    <div class="form-group-box">
                        <label style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Asignar nuevo turno</label>
                        <div class="new-shift-grid">${buttonsHtml}</div>
                    </div>
                `;
                container.appendChild(ghostDiv);
                
                ghostDiv.querySelectorAll('.btn-new-shift').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const newVal = e.target.getAttribute('data-turno');
                        let casetaDefault = 'Desconocido';
                        
                        try {
                            const dbLocal = await initIndexedDB();
                            const req = dbLocal.transaction('elementos', 'readonly').objectStore('elementos').get(empleadoNombre);
                            await new Promise(res => {
                                req.onsuccess = () => {
                                    if (req.result && req.result.Operativa && req.result.Operativa.AccesoPredeterminado) {
                                        casetaDefault = req.result.Operativa.AccesoPredeterminado;
                                    }
                                    res();
                                };
                                req.onerror = () => res();
                            });
                        } catch (err) {}

                        const newData = {
                            Caseta: newVal === 'ausentismo' ? null : casetaDefault,
                            motivo: newVal === 'ausentismo' ? 'Falta' : null
                        };

                        let shiftsToDelete = [];

                        if (newVal === 'ausentismo') {
                            const regularShifts = availableShifts.filter(sh => ['matutino', 'vespertino', 'nocturno'].includes(sh.name));
                            if (regularShifts.length > 0) {
                                const shiftToReplace = regularShifts[0];
                                newData.turno_original = shiftToReplace.name;
                                newData.caseta_original = shiftToReplace.data.Caseta || 'Desconocido';
                                newData.reporte = "";
                                shiftsToDelete = regularShifts.map(sh => sh.name);
                            } else {
                                newData.reporte = "";
                            }
                        } else {
                            const ausentismoShift = availableShifts.find(sh => sh.name === 'ausentismo');
                            if (ausentismoShift) {
                                shiftsToDelete.push('ausentismo');
                            }
                        }

                        localRecord[newVal] = newData;
                        availableShifts.push({ name: newVal, dbKey: newVal, data: newData });
                        try {
                            const ts = await updateShiftDataLocal(anio, mes, dia, idElemento, newVal, newData);
                            await updateShiftDataCloud(anio, mes, dia, idElemento, newVal, newData, ts);
                            
                            for (const s of shiftsToDelete) {
                                await deleteShiftKey(anio, mes, dia, idElemento, s);
                                delete localRecord[s];
                                const idx = availableShifts.findIndex(sh => sh.name === s);
                                if (idx > -1) availableShifts.splice(idx, 1);
                            }

                            renderShiftForm(newVal);
                            window.dispatchEvent(new CustomEvent('regasUpdated'));
                        } catch(e) { console.error(e); }
                    });
                });
                return;
            }

            const activeShift = availableShifts.find(sh => sh.name === activeShiftName);
            const sName = activeShift ? activeShift.name : '';
            const sData = activeShift ? activeShift.data : {};

            // Helper: Evaluar si la incidencia está activa (Soporta booleanos y textos de Firebase)
            const isIncActive = (key) => {
                const val = sData[key];
                return val === true || String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'si';
            };

            // Helper de Laborado
            const calcWorked = (ent, sal) => {
                const parseT = (tStr) => {
                    if (!tStr) return null;
                    const str = String(tStr).trim().toLowerCase();
                    if (str === 'null' || str === '') return null;
                    const match = str.match(/(\d{1,2}):(\d{1,2})/);
                    if (!match) return null;
                    let h = parseInt(match[1], 10);
                    let m = parseInt(match[2], 10);
                    if (str.includes('pm') && h < 12) h += 12;
                    if (str.includes('am') && h === 12) h = 0;
                    return { h, m };
                };

                const e = parseT(ent);
                let s = parseT(sal);

                if (!e) return '--h --m';

                // Si no hay salida registrada, usamos la hora actual "En vivo"
                if (!s) {
                    const now = new Date();
                    s = { h: now.getHours(), m: now.getMinutes() };
                }

                let eMins = e.h * 60 + e.m;
                let sMins = s.h * 60 + s.m;
                let diffMins = 0;

                // Lógica solicitada: Evaluación matemática estricta sobre reloj de 24h
                if (e.h >= 17) {
                    // Turno Nocturno
                    if (sMins >= eMins) {
                        diffMins = sMins - eMins;
                    } else {
                        diffMins = ((24 * 60) - eMins) + sMins;
                    }
                } else {
                    // Turnos de día
                    if (sMins >= eMins) {
                        diffMins = sMins - eMins;
                    } else {
                        diffMins = ((24 * 60) - eMins) + sMins;
                    }
                }

                return `${Math.floor(diffMins/60)}h ${diffMins%60}m`;
            };

            // 3. CONSTRUIR FORMULARIO (5 Filas)
            const formDiv = document.createElement('div');
            formDiv.className = 'shift-detail-body';
            
            // Fila 1: Selectores
            let selectUbicacion = `<select class="form-select" id="sel-ubicacion" style="width:100%; padding-right:25px;">`;
            if (activeShiftName === 'ausentismo') {
                selectUbicacion += `<optgroup label="Motivos de Ausentismo">`;
                motivosList.forEach(m => selectUbicacion += `<option value="${m.id}" ${(sData.motivo === m.id || sData.Motivo === m.id) ? 'selected' : ''}>${m.id}</option>`);
                selectUbicacion += `</optgroup>`;
            } else {
                selectUbicacion += `<optgroup label="Casetas">`;
                casetasList.forEach(c => selectUbicacion += `<option value="${c.id}" ${(sData.Caseta === c.id || (!sData.Caseta && sData.motivo === c.id)) ? 'selected' : ''}>${c.id}</option>`);
                selectUbicacion += `</optgroup>`;
            }
            selectUbicacion += `</select>`;

            let selectTurnoModify = `<select class="form-select" id="sel-turno-modify" style="width:100%; padding-right:25px;">`;
            ['Matutino', 'Vespertino', 'Nocturno', 'Ausentismo'].forEach(t => selectTurnoModify += `<option value="${t.toLowerCase()}" ${t.toLowerCase() === sName ? 'selected' : ''}>${t}</option>`);
            selectTurnoModify += `</select>`;

            // Fila 4: Botón Interactivo / Estado
            let actionHtml = '';
            if (isToday) {
                if (!sData.entrada_real) actionHtml = `<button class="btn-action-main btn-entrada">Registrar Entrada</button>`;
                else if (!sData.salida_real) actionHtml = `<button class="btn-action-main btn-salida">Registrar Salida</button>`;
                else actionHtml = `<div class="badge-cumplido">Turno Cumplido</div>`;
            } else {
                if (sData.entrada_real && sData.salida_real) actionHtml = `<div class="badge-cumplido">Turno Cumplido</div>`;
                else actionHtml = `<div class="badge-pasado">Turno Pasado</div>`;
            }

            const isAusentismoView = activeShiftName === 'ausentismo';
            const hasReportField = (sData.reporte !== undefined && sData.reporte !== null) || isAusentismoView || isIncActive('retardo');
            
            let currentReportText = sData.reporte || '';
            let typeSiniestro = 'Falta';
            let actionText = '';
            let cleanActionText = '';
            const casetaName = sData.caseta_original || sData.Caseta || 'Desconocido';
            
            if (hasReportField) {
                if (isIncActive('retardo')) typeSiniestro = 'Retardo';
                else if (isAusentismoView && sData.motivo && sData.motivo !== 'Falta') typeSiniestro = sData.motivo;
                
                if (typeSiniestro === 'Retardo') {
                    actionText = `Se aplica retardo a *${empleadoNombre}* , elemento de protección patrimonial CSCP, con número de empleado *${idElemento}* asignado en caseta ${casetaName}, quien ingresa a las ${sData.entrada_real || '--:--'} Hrs.`;
                    cleanActionText = `Se aplica retardo a ${empleadoNombre} , elemento de protección patrimonial CSCP, con número de empleado ${idElemento} asignado en caseta ${casetaName}, quien ingresa a las ${sData.entrada_real || '--:--'} Hrs.`;
                } else {
                    actionText = `Se aplica ${typeSiniestro.toLowerCase()} a *${empleadoNombre}* , elemento de protección patrimonial CSCP, con número de empleado *${idElemento}* asignado en caseta ${casetaName}.`;
                    cleanActionText = `Se aplica ${typeSiniestro.toLowerCase()} a ${empleadoNombre} , elemento de protección patrimonial CSCP, con número de empleado ${idElemento} asignado en caseta ${casetaName}.`;
                }

                // Auto-actualizar si está vacío o si tiene el formato viejo sin Markdown
                if (currentReportText.trim() === '' || (!currentReportText.includes('*CENTRO') && currentReportText.includes('CENTRO DE CONTROL OS'))) {
                    const dateStr = contextDate.toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'});
                    
                    // Mantener el folio si ya se había generado en la versión anterior
                    const oldFolioMatch = currentReportText.match(/Número de Reporte:[ \t]*(\d+)/i);
                    const folioStr = oldFolioMatch ? oldFolioMatch[1] : '';

                    currentReportText = `*CENTRO DE CONTROL OS*\n*NUEVO LEON*\n*MEXICO*\n\n*Número de Reporte:* ${folioStr}\n*Z/R/P:* OFICINAS DE SERVICIO\n*Edo/Mun:* NUEVO LEÓN, MONTERREY\n*F/H:*  ${dateStr} ${sData.entrada_programada || '00:00'} Hrs. Ocurre\n*TIPO/SUBTIPO:* INCUMPLIMIENTO DE NORMAS INTERNAS POR EMPLEADOS / TERCEROS ${typeSiniestro.toUpperCase()} DE ELEMENTO PROTECCIÓN PATRIMONIAL CSCP– CORPORATIVO OXXO MTY\n\n${actionText}\n\n*CECON informa a José David Montano Amaro Coordinador Protección Instalaciones.*`;
                    
                    // Auto-guardado silencioso del reporte pre-generado
                    sData.reporte = currentReportText;
                    updateShiftDataLocal(anio, mes, dia, idElemento, activeShiftName, { reporte: currentReportText }).then(ts => {
                        updateShiftDataCloud(anio, mes, dia, idElemento, activeShiftName, { reporte: currentReportText }, ts);
                    });
                }
            }

            const folioMatch = currentReportText.match(/Número de Reporte:\*?[ \t]*(\d+)/i);
            const isSent = folioMatch && folioMatch[1].length > 0;

            formDiv.innerHTML = `
                <div class="form-group-box compact">
                    <div class="detail-row">
                        <div class="input-col"><label>${isAusentismoView ? 'Motivo' : 'Asignación'}</label>
                            <div style="position:relative; display:flex; align-items:center;">
                                ${selectUbicacion}
                                <div class="save-status" style="position:absolute; right:20px; display:flex; align-items:center; pointer-events:none;"></div>
                            </div>
                        </div>
                        <div class="input-col"><label>Turno</label>
                            <div style="position:relative; display:flex; align-items:center;">
                                ${selectTurnoModify}
                                <div class="save-status" style="position:absolute; right:20px; display:flex; align-items:center; pointer-events:none;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                ${!isAusentismoView ? `
                <div class="form-group-box compact">
                    <div class="detail-row">
                        <div class="input-col"><label>H. Prog.</label>
                            <div style="position:relative; display:flex; align-items:center; width:100%;">
                                <input type="time" class="form-time inp-prog" value="${sData.entrada_programada || ''}" style="width:100%; padding-right:25px;">
                                <div class="save-status" style="position:absolute; right:8px; display:flex; align-items:center; pointer-events:none;"></div>
                            </div>
                        </div>
                        <div class="input-col"><label>Entrada Real</label>
                            <div style="position:relative; display:flex; align-items:center; width:100%;">
                                <input type="time" class="form-time inp-ent" value="${sData.entrada_real || ''}" style="width:100%; padding-right:25px;">
                                <div class="save-status" style="position:absolute; right:8px; display:flex; align-items:center; pointer-events:none;"></div>
                            </div>
                        </div>
                        <div class="input-col"><label>Salida Real</label>
                            <div style="position:relative; display:flex; align-items:center; width:100%;">
                                <input type="time" class="form-time inp-sal" value="${sData.salida_real || ''}" style="width:100%; padding-right:25px;">
                                <div class="save-status" style="position:absolute; right:8px; display:flex; align-items:center; pointer-events:none;"></div>
                            </div>
                        </div>
                        <div class="input-col"><label>Laborado</label><div class="worked-time" style="padding: 0; font-size: 11px;">${calcWorked(sData.entrada_real, sData.salida_real)}</div></div>
                    </div>
                </div>

                <div class="form-group-box compact">
                    <div class="incidents-row">
                        <button class="incident-btn inc-extra ${isIncActive('es_extra') ? 'active' : ''}">Extra</button>
                        <button class="incident-btn inc-recup ${isIncActive('es_recuperacion') ? 'active' : ''}">Recup.</button>
                        <button class="incident-btn inc-festivo ${isIncActive('es_festivo') ? 'active' : ''}">Festivo</button>
                        <button class="incident-btn inc-retardo ${isIncActive('retardo') ? 'active' : ''}">Retardo</button>
                    </div>
                </div>

                <div class="action-row" style="margin-top: 0;">${actionHtml}</div>
                ` : ''}
                
                <div class="form-group-box compact" style="flex: 1;">
                    <div class="comments-row" style="position:relative;">
                        <textarea class="form-textarea inp-com" placeholder="Escribe un comentario sobre este turno..." style="padding-right:25px; min-height: 70px;">${sData.comentarios || ''}</textarea>
                        <div class="save-status" style="position:absolute; right:8px; top:8px; display:flex; align-items:center; pointer-events:none;"></div>
                    </div>
                </div>
                
                ${hasReportField ? `
                <div class="form-group-box compact">
                    <h4 class="profile-section-title" style="color: #0284c7; border-bottom-color: #e0f2fe;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Reporte de Incidencia
                    </h4>
                    <div class="comments-row" style="position:relative;">
                        <textarea class="form-textarea inp-rep" placeholder="Texto del reporte..." style="padding-right:25px; min-height: 140px;">${currentReportText}</textarea>
                        <div class="save-status" style="position:absolute; right:8px; top:8px; display:flex; align-items:center; pointer-events:none;"></div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:5px;">
                        <button class="btn-action-main btn-copy-rep" title="Copiar Reporte" style="background:#475569; padding:10px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px; flex:1;">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copiar
                        </button>
                        ${isSent ? `
                        <div style="flex:1; display:flex; align-items:center; justify-content:center; color:#059669; font-weight:700; font-size:12px; border:1px solid #059669; border-radius:8px; background:#dcfce7; gap:6px;">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Enviado
                        </div>
                        ` : `
                        <button class="btn-action-main btn-mail-rep" title="Preparar Correo" style="background:#0284c7; padding:10px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px; flex:1;">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> Enviar Correo
                        </button>
                        `}
                    </div>
                </div>
                ` : ''}

                <button class="btn-delete-shift" title="Eliminar Registro">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            `;
            container.appendChild(formDiv);

            // Helper: Atar eventos al botón principal de acción
            const bindMainActionBtn = () => {
                const btnAction = formDiv.querySelector('.btn-action-main');
                if (btnAction) {
                    btnAction.addEventListener('click', async (e) => {
                        e.preventDefault();
                        btnAction.disabled = true;
                        btnAction.style.opacity = '0.5';

                        const now = new Date();
                        const hh = String(now.getHours()).padStart(2, '0');
                        const mm = String(now.getMinutes()).padStart(2, '0');
                        const timeStr = `${hh}:${mm}`;
                        
                        try {
                            let payload = {};
                            if (!sData.entrada_real) { sData.entrada_real = timeStr; payload = { entrada_real: timeStr }; } 
                            else if (!sData.salida_real) { sData.salida_real = timeStr; payload = { salida_real: timeStr }; }
                            
                            const ts = await updateShiftDataLocal(anio, mes, dia, idElemento, activeShiftName, payload);
                            await updateShiftDataCloud(anio, mes, dia, idElemento, activeShiftName, payload, ts);
                            renderShiftForm(activeShiftName);
                            window.dispatchEvent(new CustomEvent('regasUpdated'));
                        } catch(err) {
                            console.error("Error al registrar hora:", err);
                            btnAction.disabled = false;
                            btnAction.style.opacity = '1';
                        }
                    });
                }
            };
            bindMainActionBtn();

            // 4. ATAR EVENTOS A LOS CONTROLES (Firebase en vivo)
            const svgClock = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="#94a3b8" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
            const svgCheckGray = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#94a3b8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            const svgCheckGreen = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#059669" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            const bindInput = (selector, field) => {
                const el = formDiv.querySelector(selector);
                if (el) el.addEventListener('change', async (e) => {
                    const statusDiv = el.parentNode.querySelector('.save-status');
                    if (statusDiv) statusDiv.innerHTML = svgClock;
                    el.style.backgroundColor = '#fef08a'; // Guardando (Amarillo)
                    
                    sData[field] = e.target.value;
                    try {
                        const ts = await updateShiftDataLocal(anio, mes, dia, idElemento, activeShiftName, { [field]: e.target.value });
                        if (statusDiv) statusDiv.innerHTML = svgCheckGray;
                        
                        await updateShiftDataCloud(anio, mes, dia, idElemento, activeShiftName, { [field]: e.target.value }, ts);
                        if (statusDiv) statusDiv.innerHTML = `<div style="display:flex; margin-right:-6px;">${svgCheckGreen}<span style="margin-left:-10px;">${svgCheckGreen}</span></div>`;
                        
                        if (field.includes('real')) {
                            // Actualización quirúrgica del Tiempo Laborado sin recargar formulario
                            const workedDiv = formDiv.querySelector('.worked-time');
                            if (workedDiv) workedDiv.innerText = calcWorked(sData.entrada_real, sData.salida_real);
                            
                            // Actualización quirúrgica del Botón Principal
                            const actionRow = formDiv.querySelector('.action-row');
                            if (actionRow) {
                                let newActionHtml = '';
                                if (isToday) {
                                    if (!sData.entrada_real) newActionHtml = `<button class="btn-action-main btn-entrada">Registrar Entrada</button>`;
                                    else if (!sData.salida_real) newActionHtml = `<button class="btn-action-main btn-salida">Registrar Salida</button>`;
                                    else newActionHtml = `<div class="badge-cumplido">Turno Cumplido</div>`;
                                } else {
                                    if (sData.entrada_real && sData.salida_real) newActionHtml = `<div class="badge-cumplido">Turno Cumplido</div>`;
                                    else newActionHtml = `<div class="badge-pasado">Turno Pasado</div>`;
                                }
                                actionRow.innerHTML = newActionHtml;
                                bindMainActionBtn();
                            }
                        }
                        
                        el.style.backgroundColor = '#dcfce7'; // Guardado (Verde)
                        setTimeout(() => { el.style.backgroundColor = ''; if(statusDiv) statusDiv.innerHTML = ''; }, 2500);
                        
                        window.dispatchEvent(new CustomEvent('regasUpdated'));
                    } catch (err) {
                        if (statusDiv) statusDiv.innerHTML = `<span style="color:#ef4444; font-weight:bold; font-size:14px;">!</span>`;
                        el.style.backgroundColor = '#fee2e2'; // Rojo (Error)
                        setTimeout(() => { el.style.backgroundColor = ''; if(statusDiv) statusDiv.innerHTML = ''; }, 2500);
                    }
                });
            };
            bindInput('.inp-prog', 'entrada_programada');
            bindInput('.inp-ent', 'entrada_real');
            bindInput('.inp-sal', 'salida_real');
            bindInput('.inp-com', 'comentarios');
            if (hasReportField) bindInput('.inp-rep', 'reporte');
            
            const btnCopyRep = formDiv.querySelector('.btn-copy-rep');
            if (btnCopyRep) {
                btnCopyRep.addEventListener('click', (e) => {
                    e.preventDefault();
                    const repText = formDiv.querySelector('.inp-rep').value;
                    navigator.clipboard.writeText(repText).then(() => {
                        const orig = btnCopyRep.innerHTML;
                        btnCopyRep.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado!`;
                        btnCopyRep.style.background = '#059669';
                        setTimeout(() => { btnCopyRep.innerHTML = orig; btnCopyRep.style.background = '#475569'; }, 2000);
                    });
                });
            }

            const btnMailRep = formDiv.querySelector('.btn-mail-rep');
            if (btnMailRep) {
                btnMailRep.addEventListener('click', (e) => {
                    e.preventDefault();
                    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || [{}];
                    const authName = userInfo[0].nombre || 'Desconocido (Autenticado)';
                    
                    let edif = 'Edison';
                    if (casetaName.toLowerCase() === 'michelena' || casetaName.toLowerCase() === 'simón bolívar') {
                        edif = casetaName;
                    }

                    const emailPayload = {
                        negocioSeleccionado: "Oficinas de servicio Oxxo",
                        plazaSeleccionada: "Oficina de servicio (OS)",
                        edificioSeleccionado: edif,
                        tipoSiniestroSeleccionado: "Protección Patrimonial",
                        subtipoSeleccionado: "Incumplimiento de normas internas",
                        descripcionIncidente: cleanActionText,
                        descripcionTextoPlano: "*" + cleanActionText,
                        personasAfectadas: "Lesionados: No\nDetenidos: No",
                        nombreReporta: "Centro de Control",
                        nombreRealiza: authName,
                        listadoCorreos: "",
                        timestamp: new Date().toISOString()
                    };

                    openEmailModal(emailPayload, async (folio) => {
                        const repTextarea = formDiv.querySelector('.inp-rep');
                        let textToUpdate = repTextarea ? repTextarea.value : currentReportText;
                        
                        // Remplaza el espacio vacío conservando el asterisco del formato markdown si existe
                        textToUpdate = textToUpdate.replace(/(\*?Número de Reporte:\*?)[ \t]*(\d*)/i, `$1 ${folio}`);
                        
                        if (repTextarea) repTextarea.value = textToUpdate;
                        sData.reporte = textToUpdate;

                        try {
                            const ts = await updateShiftDataLocal(anio, mes, dia, idElemento, activeShiftName, { reporte: textToUpdate });
                            await updateShiftDataCloud(anio, mes, dia, idElemento, activeShiftName, { reporte: textToUpdate }, ts);
                            
                            // Forzar actualización visual para quitar el botón de envío y mostrar "Enviado"
                            renderShiftForm(activeShiftName);
                            
                            window.dispatchEvent(new CustomEvent('regasUpdated'));
                        } catch (err) { console.error("Error guardando folio en reporte:", err); }
                    });
                });
            }

            const selUbi = formDiv.querySelector('#sel-ubicacion');
            if (selUbi) {
                selUbi.addEventListener('change', async (e) => {
                    const statusDiv = selUbi.parentNode.querySelector('.save-status');
                    if (statusDiv) statusDiv.innerHTML = svgClock;
                    selUbi.style.backgroundColor = '#fef08a';
                    
                    const newVal = e.target.value;
                    const isAus = activeShiftName === 'ausentismo';
                    if (isAus) { sData.motivo = newVal; delete sData.Caseta; } 
                    else { sData.Caseta = newVal; delete sData.motivo; }
                    
                    const payload = { Caseta: isAus ? null : newVal, motivo: isAus ? newVal : null };
                    
                    if (isAus) {
                        payload.reporte = null;
                        delete sData.reporte;
                    }

                    try {
                        const ts = await updateShiftDataLocal(anio, mes, dia, idElemento, activeShiftName, payload);
                        if (statusDiv) statusDiv.innerHTML = svgCheckGray;
                        
                        await updateShiftDataCloud(anio, mes, dia, idElemento, activeShiftName, payload, ts);
                        if (statusDiv) statusDiv.innerHTML = `<div style="display:flex; margin-right:-6px;">${svgCheckGreen}<span style="margin-left:-10px;">${svgCheckGreen}</span></div>`;
                        
                        selUbi.style.backgroundColor = '#dcfce7';
                        setTimeout(() => { selUbi.style.backgroundColor = ''; if(statusDiv) statusDiv.innerHTML = ''; }, 2500);
                        window.dispatchEvent(new CustomEvent('regasUpdated'));
                    } catch (err) {
                        if (statusDiv) statusDiv.innerHTML = `<span style="color:#ef4444; font-weight:bold; font-size:14px;">!</span>`;
                        selUbi.style.backgroundColor = '#fee2e2';
                        setTimeout(() => { selUbi.style.backgroundColor = ''; if(statusDiv) statusDiv.innerHTML = ''; }, 2500);
                    }
                });
            }

            const selTurMod = formDiv.querySelector('#sel-turno-modify');
            if (selTurMod) {
                selTurMod.addEventListener('change', async (e) => {
                    const statusDiv = selTurMod.parentNode.querySelector('.save-status');
                    if (statusDiv) statusDiv.innerHTML = svgClock;
                    selTurMod.style.backgroundColor = '#fef08a';
                    
                    const newVal = e.target.value;
                    if (newVal !== activeShiftName) {
                        const newData = { ...sData };
                        if (newVal === 'ausentismo') { 
                            newData.motivo = newData.Caseta || 'Falta'; 
                            newData.caseta_original = newData.Caseta || 'Desconocido';
                            newData.turno_original = activeShiftName;
                            newData.reporte = "";
                            delete newData.Caseta; 
                        } 
                        else { 
                            newData.Caseta = newData.caseta_original || newData.motivo || 'Desconocido'; 
                            delete newData.motivo; 
                            delete newData.Motivo; 
                            delete newData.caseta_original;
                            delete newData.turno_original;
                            delete newData.reporte;
                        }
                        localRecord[newVal] = newData;
                        delete localRecord[activeShiftName];
                        const idx = availableShifts.findIndex(sh => sh.name === activeShiftName);
                        availableShifts[idx] = { name: newVal, dbKey: newVal, data: newData };
                        
                        try {
                            await renameShiftKey(anio, mes, dia, idElemento, activeShiftName, newVal, newData);
                            if (statusDiv) statusDiv.innerHTML = `<div style="display:flex; margin-right:-6px;">${svgCheckGreen}<span style="margin-left:-10px;">${svgCheckGreen}</span></div>`;
                            selTurMod.style.backgroundColor = '#dcfce7';
                            setTimeout(() => { selTurMod.style.backgroundColor = ''; if(statusDiv) statusDiv.innerHTML = ''; }, 2500);
                            
                            renderShiftForm(newVal);
                            window.dispatchEvent(new CustomEvent('regasUpdated'));
                        } catch (err) {
                            if (statusDiv) statusDiv.innerHTML = `<span style="color:#ef4444; font-weight:bold; font-size:14px;">!</span>`;
                            selTurMod.style.backgroundColor = '#fee2e2';
                            setTimeout(() => { selTurMod.style.backgroundColor = ''; if(statusDiv) statusDiv.innerHTML = ''; }, 2500);
                        }
                    }
                });
            }

            [
                { cls: 'extra', key: 'es_extra' },
                { cls: 'recup', key: 'es_recuperacion' },
                { cls: 'festivo', key: 'es_festivo' },
                { cls: 'retardo', key: 'retardo' }
            ].forEach(inc => {
                const btn = formDiv.querySelector('.inc-' + inc.cls);
                if(btn) btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const newValue = !isIncActive(inc.key); // Alterna el valor
                    sData[inc.key] = newValue;
                    
                    const payload = { [inc.key]: newValue };
                    if (newValue && (inc.key === 'retardo' || inc.key === 'suspencion')) {
                        payload.reporte = sData.reporte || "";
                        sData.reporte = payload.reporte;
                    } else if (!newValue && (inc.key === 'retardo' || inc.key === 'suspencion')) {
                        payload.reporte = null;
                        delete sData.reporte;
                    }

                    try {
                        const ts = await updateShiftDataLocal(anio, mes, dia, idElemento, activeShiftName, payload);
                        await updateShiftDataCloud(anio, mes, dia, idElemento, activeShiftName, payload, ts);
                        renderShiftForm(activeShiftName);
                        window.dispatchEvent(new CustomEvent('regasUpdated'));
                    } catch (err) { console.error(err); }
                });
            });

            const btnDelete = formDiv.querySelector('.btn-delete-shift');
            if (btnDelete) {
                btnDelete.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if(confirm(`¿Estás seguro de eliminar permanentemente el registro de ${activeShiftName}?`)) {
                        btnDelete.disabled = true;
                        btnDelete.innerText = 'Eliminando...';
                        
                        await deleteShiftKey(anio, mes, dia, idElemento, activeShiftName);
                        delete localRecord[activeShiftName];
                        const idx = availableShifts.findIndex(sh => sh.name === activeShiftName);
                        if (idx > -1) availableShifts.splice(idx, 1);
                        
                        window.dispatchEvent(new CustomEvent('regasUpdated'));
                        renderShiftForm(availableShifts.length > 0 ? availableShifts[0].name : null);
                    }
                });
            }
        };
        
        // Renderizar el turno inicial donde dimos clic
        renderShiftForm(initialShiftName);
    }
}

export function selectDetailTab(tab) {
    document.querySelectorAll('.d-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.d-content').forEach(c => c.classList.remove('active'));
    
    const tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.classList.add('active');
    
    const contentId = tab === 'turno' ? 'content-turno-detail' : 'content-' + tab;
    const contentEl = document.getElementById(contentId);
    if (contentEl) contentEl.classList.add('active');
}

// --- MODAL GLOBAL DE CORREO DE REPORTES ---
function openEmailModal(emailPayload, onSuccessCallback) {
    let modal = document.getElementById('email-report-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'email-report-modal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; justify-content:center; align-items:center; backdrop-filter: blur(5px); padding: 15px; box-sizing: border-box;';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="background:#fff; padding:25px; border-radius:12px; width:500px; max-width:100%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex; flex-direction: column; max-height: 90vh;">
            <h3 style="margin-top:0; color:#0284c7; display:flex; align-items:center; gap:8px;">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                Enviar Reporte
            </h3>
            
            <label style="font-size:11px; font-weight:800; color:#64748b; margin-bottom:5px; text-transform:uppercase;">Destinatarios</label>
            <input type="text" id="email-dest" placeholder="ejemplo@correo.com, supervisor@correo.com" style="width:100%; margin-bottom:15px; padding:12px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; font-family: inherit;">
            
            <label style="font-size:11px; font-weight:800; color:#64748b; margin-bottom:5px; text-transform:uppercase;">Vista Previa (Carga Útil JSON)</label>
            <div style="flex:1; overflow-y:auto; background:#0f172a; border-radius:8px; margin-bottom:15px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
                <pre id="email-preview-pre" style="color:#38bdf8; padding:15px; font-size:12px; margin:0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace;">${JSON.stringify(emailPayload, null, 2)}</pre>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-cancel-email" style="padding:10px 20px; border:none; border-radius:6px; cursor:pointer; background:#e2e8f0; color:#334155; font-weight: 700; transition: background 0.2s;">Cancelar</button>
                <button id="btn-confirm-email" style="padding:10px 20px; border:none; border-radius:6px; background:#0284c7; color:white; cursor:pointer; font-weight:700; transition: background 0.2s; display:flex; align-items:center; gap:8px;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    Enviar Datos
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    const destInput = document.getElementById('email-dest');
    const previewPre = document.getElementById('email-preview-pre');

    // Actualizar el Payload y la Vista Previa en tiempo real al escribir
    destInput.addEventListener('input', (e) => {
        // Reemplazamos comas por punto y coma, que es el formato estándar de Power Automate / Outlook
        emailPayload.listadoCorreos = e.target.value.replace(/,/g, ';');
        previewPre.textContent = JSON.stringify(emailPayload, null, 2);
    });

    document.getElementById('btn-cancel-email').onclick = () => modal.style.display = 'none';
    document.getElementById('btn-confirm-email').onclick = () => {
        const btn = document.getElementById('btn-confirm-email');
        
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Enviando...`;
        
        const apiUrl = "https://default3b2cbccb81bb44a2a19a2386bb3606.02.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/28a6ecf6c40e4d14aa520a51c8430065/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=4DbF_Lj5HOOWUNIaV_lSLMZH1j5etCF1n18CTLRDkxs";

        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
        })
        .then(async response => {
            if (response.ok) {
                try {
                    const data = await response.json();
                    let folio = "";
                    if (data && data.body && data.body.Folio) folio = data.body.Folio;
                    else if (data && data.Folio) folio = data.Folio;
                    
                    if (folio && onSuccessCallback) onSuccessCallback(folio);
                } catch (e) {
                    console.warn("La respuesta no es un JSON válido o no contiene Folio", e);
                }

                btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> ¡Enviado!`;
                btn.style.background = '#059669';
                btn.style.opacity = '1';
                setTimeout(() => modal.style.display = 'none', 1500);
            } else {
                throw new Error('Error al enviar el reporte. Status: ' + response.status);
            }
        })
        .catch(error => {
            console.error("Error conectando con la API de correos:", error);
            btn.innerHTML = `Error al enviar`;
            btn.style.background = '#ef4444';
            btn.style.opacity = '1';
            setTimeout(() => {
                btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Enviar Datos`;
                btn.style.background = '#0284c7';
                btn.disabled = false;
            }, 3000);
        });
    };
}
/**
 * CIC-OS - Scripts y Utilidades Globales
 * Este archivo contiene las funciones que pueden ser llamadas desde cualquier
 * parte de la interfaz principal (Shell) o aplicaciones contenidas.
 */

// ==========================================
// FUNCIÓN 1: SINCRONIZADOR DIFERENCIAL (DELTA UPDATES) DESDE FIRESTORE
// ==========================================
window.Download_DB = async function(mode = "AUTO") {
    console.log("[CIC-OS] Iniciando sincronización diferencial de bases de datos...");
    
    let specificNodes = null;

    // --- MANEJO DE MODOS DE DESCARGA ---
    if (Array.isArray(mode)) {
        specificNodes = mode; // Es una petición interna de módulos específicos
    } else if (mode === "MANUAL") {
        console.log("[CIC-OS] Sincronización manual detectada: Borrando caché de versiones para forzar descarga total...");
        localStorage.removeItem('updates_regas');
    }

    // Cambiamos el cursor para indicar que está procesando
    document.body.style.cursor = 'wait';
    
    // Cambiamos el texto en la UI (si existe el elemento)
    const syncText = document.getElementById('syncStatusText');
    if (syncText) {
        syncText.innerText = "Sincronizando...";
        syncText.classList.replace('text-blue-600', 'text-yellow-600');
    }

    try {
        // --- MODO HÍBRIDO: Busca en Session primero, si falla busca en Local ---
        const configStr = sessionStorage.getItem('cic_os_config') || localStorage.getItem('cic_os_config');
        const tokenStr = sessionStorage.getItem('cic_os_token') || localStorage.getItem('cic_os_token');

        // Validación de seguridad (Kill Switch)
        if (!configStr) {
            throw new Error("No se encontró la configuración cic_os_config. Por favor, inicie sesión nuevamente.");
        }

        const firebaseConfig = JSON.parse(configStr);

        // Importaciones dinámicas del SDK modular
        const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
        const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");

        const apps = getApps();
        const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
        const rtdb = getDatabase(app);
        const firestore = getFirestore(app);

        // 1. Obtener el "Mapa de Versiones" desde la nube
        const updatesRef = ref(rtdb, 'updates/RegAs');
        const updatesSnap = await get(updatesRef);
        const remoteUpdates = updatesSnap.val() || {}; 
        
        // --- PARCHE DE SEGURIDAD PARA INSTALACIONES LIMPIAS ---
        const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const now = new Date();
        const currentYearStr = now.getFullYear().toString();
        const currentMonthNode = `${currentYearStr}_${MONTH_NAMES[now.getMonth()]}`;
        
        let prevMonthIndex = now.getMonth() - 1;
        let prevYearStr = currentYearStr;
        if (prevMonthIndex < 0) { prevMonthIndex = 11; prevYearStr = (now.getFullYear() - 1).toString(); }
        const prevMonthNode = `${prevYearStr}_${MONTH_NAMES[prevMonthIndex]}`;

        if (!remoteUpdates["Catalogos"]) remoteUpdates["Catalogos"] = "1";
        if (!remoteUpdates[currentMonthNode]) remoteUpdates[currentMonthNode] = "1";
        if (!remoteUpdates[prevMonthNode]) remoteUpdates[prevMonthNode] = "1";

        // 2. Obtener nuestro "Mapa de Versiones" local
        let localUpdates = {};
        try {
            const stored = localStorage.getItem('updates_regas');
            if (stored && stored.startsWith('{')) {
                localUpdates = JSON.parse(stored);
            }
        } catch(e) { console.warn("Creando nuevo registro local de actualizaciones."); }

        const nodesToUpdate = [];

        // 3. Comparar qué partes específicas están desactualizadas
        if (specificNodes && Array.isArray(specificNodes)) {
            specificNodes.forEach(node => {
                if (remoteUpdates[node] && remoteUpdates[node] !== localUpdates[node]) {
                    nodesToUpdate.push(node);
                }
            });
        } else {
            for (const key in remoteUpdates) {
                if (remoteUpdates[key] !== localUpdates[key]) {
                    nodesToUpdate.push(key);
                }
            }
        }

        if (nodesToUpdate.length === 0) {
            console.log("[CIC-OS] Las bases de datos ya coinciden con la nube (Nada que descargar).");
            if (mode === "MANUAL" && typeof showToast === 'function') {
                showToast("Descarga completada. Sistema al día.", "success");
            }
            document.body.style.cursor = 'default';
            if (syncText) {
                syncText.innerText = "En línea";
                syncText.classList.replace('text-yellow-600', 'text-blue-600');
            }
            return;
        }

        if (typeof showToast === 'function') {
            showToast(`Descargando ${nodesToUpdate.length} actualización(es)...`, "info");
        }

        // 4. Abrir IndexedDB de forma SEGURA 
        const idb = await new Promise((resolve, reject) => {
            const openReq = indexedDB.open("CIC_OS_RegAs", 8);
            
            openReq.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("registros")) db.createObjectStore("registros", { keyPath: "id" });
                if (!db.objectStoreNames.contains("catalogos")) db.createObjectStore("catalogos", { keyPath: "id" });
            };
            openReq.onsuccess = (e) => resolve(e.target.result);
            openReq.onerror = (e) => {
                console.error("[CIC-OS] Error nativo IndexedDB:", e.target.error);
                reject(new Error("Error al abrir IndexedDB: " + (e.target.error ? e.target.error.name : 'Desconocido')));
            };
            openReq.onblocked = () => reject(new Error("Apertura de IndexedDB bloqueada por otra pestaña"));
        });

        const saveToIDB = (storeName, dataObj) => {
            return new Promise((resolve, reject) => {
                const tx = idb.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                store.put(dataObj);
                tx.oncomplete = resolve;
                tx.onerror = reject;
            });
        };

        // 5. Descarga Quirúrgica
        for (const node of nodesToUpdate) {
            console.log(`[CIC-OS] -> Descargando e inyectando nodo: ${node}...`);
            
            if (node === "Catalogos") {
                const catDocSnap = await getDoc(doc(firestore, "RegAs", "Catalogos"));
                if (catDocSnap.exists()) {
                    const dataCatalogos = catDocSnap.data();
                    if (dataCatalogos.ElementosPP) {
                        const elementObj = typeof dataCatalogos.ElementosPP === 'object' && dataCatalogos.ElementosPP !== null
                            ? { id: "ElementosPP", ...dataCatalogos.ElementosPP }
                            : { id: "ElementosPP", data: dataCatalogos.ElementosPP };
                        await saveToIDB("catalogos", elementObj);
                    }
                    if (dataCatalogos.Casetas) {
                        const casetaObj = typeof dataCatalogos.Casetas === 'object' && dataCatalogos.Casetas !== null
                            ? { id: "Casetas", ...dataCatalogos.Casetas }
                            : { id: "Casetas", data: dataCatalogos.Casetas };
                        await saveToIDB("catalogos", casetaObj);
                    }
                }
            } else {
                const [anio, mes] = node.split('_');
                if (anio && mes) {
                    const mesDocSnap = await getDoc(doc(firestore, "RegAs", "Registros", anio, mes));
                    if (mesDocSnap.exists()) {
                        await saveToIDB("registros", { id: node, ...mesDocSnap.data() });
                    }
                }
            }
            
            localUpdates[node] = remoteUpdates[node];
        }

        idb.close();

        // 6. Guardamos el nuevo "Mapa de Versiones" en localStorage
        localStorage.setItem('updates_regas', JSON.stringify(localUpdates));

        console.log("[CIC-OS] ¡Sincronización diferencial completada con éxito!");
        if (mode === "MANUAL" && typeof showToast === 'function') {
            showToast("Bases de datos actualizadas", "success");
        }
        
        if (syncText) {
            syncText.innerText = "En línea";
            syncText.classList.replace('text-yellow-600', 'text-blue-600');
        }
        
    } catch (error) {
        console.error("[CIC-OS] ERROR DETECTADO DURANTE LA DESCARGA:", error);
        if (typeof showToast === 'function') {
            showToast("Error en sincronización: " + error.message, "error");
        }
        if (syncText) {
            syncText.innerText = "Error local";
            syncText.classList.replace('text-blue-600', 'text-red-600');
        }
    } finally {
        document.body.style.cursor = 'default';
    }
};

// ==========================================
// FUNCIÓN 2: ACTUALIZAR SISTEMA DEL SITIO (Forzar Limpieza de Caché HTML/JS)
// ==========================================
window.Update_CIC = async function() {
    console.log("[CIC-OS] Solicitud de actualización de versión recibida. Limpiando caché del navegador...");
    
    if (typeof showToast === 'function') {
        showToast("Buscando nueva versión... Limpiando caché", "info");
    }
    
    try {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log("[CIC-OS] Caché de archivos estáticos borrado exitosamente.");
        }

        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
            console.log("[CIC-OS] Service Workers desregistrados.");
        }
    } catch (error) {
        console.warn("[CIC-OS] No se pudo limpiar la caché a nivel profundo:", error);
    }
    
    // Forzar recarga ignorando el caché (Hard Reload)
    setTimeout(() => {
        window.location.reload(true); 
    }, 800);
};
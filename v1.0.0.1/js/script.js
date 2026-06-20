import { app } from './firebase.js';
import { getDatabase, ref, get, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Calcular URL de sw.js dinámicamente sin importar dónde se llame este script
const SW_URL = new URL('../sw.js', import.meta.url).href;

// Función global para cambiar entre pantallas
export function switchFrame(frameId, isHistoryNavigation = false) {
    if (frameId === 'iframe-home') {
        // Ocultamos login/app y aseguramos que se vea el home
        document.getElementById('iframe-login').style.display = 'none';
        document.getElementById('iframe-app').style.display = 'none';
        document.getElementById('iframe-home').style.display = 'block';
    } else {
        // Para la app principal, ocultamos todo y mostramos la app a pantalla completa
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => iframe.style.display = 'none');
        document.getElementById(frameId).style.display = 'block';
    }

    // Gestionar historial en localStorage (si no es navegación de adelante/atrás)
    if (!isHistoryNavigation) {
        let history = JSON.parse(localStorage.getItem('appHistory')) || [];
        let pointer = parseInt(localStorage.getItem('historyPointer'));
        if (isNaN(pointer)) pointer = -1;

        // Recortar historial futuro si navegamos a una nueva sección desde un punto anterior
        history = history.slice(0, pointer + 1);
        history.push(frameId);
        
        localStorage.setItem('appHistory', JSON.stringify(history));
        localStorage.setItem('historyPointer', history.length - 1);

        // Le informamos al navegador nativo sobre este nuevo paso en el historial
        window.history.pushState({ frameId: frameId }, "", "");
    }
}

// Función para ir a la vista anterior
export function goBack() {
    let history = JSON.parse(localStorage.getItem('appHistory')) || [];
    let pointer = parseInt(localStorage.getItem('historyPointer')) || 0;
    if (pointer > 0) {
        pointer--;
        localStorage.setItem('historyPointer', pointer);
        switchFrame(history[pointer], true);
    }
}

// Función para ir a la vista siguiente
export function goForward() {
    let history = JSON.parse(localStorage.getItem('appHistory')) || [];
    let pointer = parseInt(localStorage.getItem('historyPointer')) || 0;
    if (pointer < history.length - 1) {
        pointer++;
        localStorage.setItem('historyPointer', pointer);
        switchFrame(history[pointer], true);
    }
}

// Helper para obtener la versión de la App dinámicamente desde sw.js
async function getAppVersion() {
    try {
        // Forzar al navegador a saltarse todas las cachés (incluyendo las de discos y proxies)
        const response = await fetch(SW_URL + '?t=' + Date.now(), { 
            cache: 'reload',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (!response.ok) throw new Error('Fetch fallido');
        const text = await response.text();
        let match = text.match(/const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (!match) match = text.match(/const\s+CACHE_NAME\s*=\s*['"]cic-os-cache-([^'"]+)['"]/); // Fallback para versiones viejas
        if (match) {
            localStorage.setItem('cic_app_version', match[1]);
            return match[1];
        }
        throw new Error('Versión no encontrada');
    } catch(e) {
        const cachedVersion = localStorage.getItem('cic_app_version');
        return cachedVersion ? cachedVersion : 'Offline';
    }
}

// Función que inyecta los iconos al HTML
export function renderApps(apps, containerId = 'start-menu') {
    const startMenu = document.getElementById(containerId);
    if (!startMenu) return;
    
    startMenu.innerHTML = ''; // Limpiamos loading/mensajes
    
    apps.forEach(app => {
        const link = document.createElement('a');
        link.className = 'app-item';
        // Aplicando '../' para salir de mod/ y buscar la ruta real del sistema
        link.href = app.ruta ? '../' + app.ruta : '#';
        
        // Interceptar el clic para abrir la app en el iframe interno
        link.addEventListener('click', (e) => {
            if(app.ruta) {
                e.preventDefault();
                launchApp(app);
            }
        });

        const iconContainer = document.createElement('div');
        iconContainer.className = 'app-icon-container';
        // Usamos el campo background para pintar el fondo de la pastilla
        iconContainer.style.backgroundColor = app.background || 'rgba(255, 255, 255, 0.1)';
        
        const img = document.createElement('img');
        // Aplicando '../' para la ruta del icono de acuerdo a las instrucciones
        img.src = app.icono ? '../' + app.icono : '';
        // Si tu base de datos tiene un campo nombre usa ese, sino el ID
        img.alt = app.nombre || app.id;
        
        const text = document.createElement('span');
        text.innerText = app.nombre || app.id;
        
        iconContainer.appendChild(img);
        link.appendChild(iconContainer);
        link.appendChild(text);
        
        startMenu.appendChild(link);
    });

    // Separador visual en el menú
    const separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.backgroundColor = 'rgba(255,255,255,0.1)';
    separator.style.margin = '10px 0 5px 0';
    startMenu.appendChild(separator);

    // Contenedor en fila para botones del sistema
    const sysActionsContainer = document.createElement('div');
    sysActionsContainer.style.display = 'flex';
    sysActionsContainer.style.gap = '10px';
    sysActionsContainer.style.width = '100%';

    // Botón de Actualizar Apps
    const refreshLink = document.createElement('a');
    refreshLink.className = 'app-item';
    refreshLink.href = '#';
    refreshLink.title = 'Actualizar Apps'; // Tooltip explicativo
    refreshLink.style.flex = '1';
    refreshLink.style.justifyContent = 'center';
    
    const refreshIconContainer = document.createElement('div');
    refreshIconContainer.className = 'app-icon-container';
    refreshIconContainer.style.backgroundColor = 'rgba(0, 102, 204, 0.6)'; // Azul translúcido
    refreshIconContainer.style.marginRight = '0'; // Remueve margen para centrar
    refreshIconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 20px; height: 20px; stroke: #ffffff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
    
    refreshLink.appendChild(refreshIconContainer);
    
    refreshLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('refreshApps'));
    });
    
    sysActionsContainer.appendChild(refreshLink);

    // Botón de cerrar sesión
    const logoutLink = document.createElement('a');
    logoutLink.className = 'app-item';
    logoutLink.href = '#';
    logoutLink.title = 'Cerrar Sesión'; // Tooltip explicativo
    logoutLink.style.flex = '1';
    logoutLink.style.justifyContent = 'center';
    
    const logoutIconContainer = document.createElement('div');
    logoutIconContainer.className = 'app-icon-container';
    logoutIconContainer.style.backgroundColor = 'rgba(139, 0, 0, 0.6)'; // Rojo oscuro translúcido
    logoutIconContainer.style.marginRight = '0'; // Remueve margen para centrar
    logoutIconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 20px; height: 20px; stroke: #ffffff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;
    
    logoutLink.appendChild(logoutIconContainer);
    
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userInfo'); // Limpiamos la caché del usuario al salir
        localStorage.removeItem('appsList'); // Limpiamos las apps para mayor seguridad
        localStorage.removeItem('runningAppsState'); // Limpiamos estado de apps
        window.parent.postMessage({action: 'switchFrame', target: 'iframe-home'}, '*');
    });
    
    sysActionsContainer.appendChild(logoutLink);
    startMenu.appendChild(sysActionsContainer);

    // Etiqueta de versión de la aplicación
    const versionLabel = document.createElement('div');
    versionLabel.style.textAlign = 'center';
    versionLabel.style.color = 'rgba(255, 255, 255, 0.4)';
    versionLabel.style.fontSize = '10px';
    versionLabel.style.marginTop = '15px';
    versionLabel.style.paddingTop = '10px';
    versionLabel.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    versionLabel.innerText = `Cargando versión...`;
    startMenu.appendChild(versionLabel);
    
    getAppVersion().then(version => {
        versionLabel.innerText = `Versión ${version}`;
    });
}

// Funciones de Notificaciones en IndexedDB y RTDB
export async function downloadNotifications(uid) {
    const db = getDatabase(app);
    const notifRef = ref(db, `notificaciones/${uid}`);
    
    try {
        const snapshot = await get(notifRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const newNotifications = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));

            const dbLocal = await initIndexedDB();
            const tx = dbLocal.transaction('notificaciones', 'readwrite');
            const store = tx.objectStore('notificaciones');
            
            const getReq = store.get(uid);
            getReq.onsuccess = () => {
                let existing = getReq.result;
                let mergedItems = newNotifications;
                
                if (existing && existing.items) {
                    // Evitar duplicados revisando los IDs
                    const existingIds = new Set(existing.items.map(i => i.id));
                    const uniqueNew = newNotifications.filter(i => !existingIds.has(i.id));
                    mergedItems = [...existing.items, ...uniqueNew];
                }
                
                // Guardar la entrada por UID en el almacén local
                store.put({ id: uid, items: mergedItems });
                
                // Eliminar de RTDB al confirmar la descarga local
                remove(notifRef).then(() => {
                    console.log("Notificaciones descargadas al cliente y eliminadas de RTDB.");
                    // Disparar evento para que la interfaz se actualice
                    window.dispatchEvent(new CustomEvent('notificacionesActualizadas'));
                });
            };
        }
    } catch (error) {
        console.error("Error descargando notificaciones: ", error);
    }
}

export async function getLocalNotifications(uid) {
    const dbLocal = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = dbLocal.transaction('notificaciones', 'readonly');
        const store = tx.objectStore('notificaciones');
        const request = store.get(uid);
        request.onsuccess = () => {
            resolve(request.result ? request.result.items : []);
        };
        request.onerror = () => reject(request.error);
    });
}

// Inicializar IndexedDB para el sistema
export function initIndexedDB() {
    return new Promise((resolve, reject) => {
        // Abre o crea la base de datos 'cic-os' en su versión 2
        const request = indexedDB.open('cic-os', 2);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const stores = ['regas', 'elementos', 'casetas', 'marbetes', 'multimedia', 'formularios', 'reportes', 'externos','notificaciones', 'motivosAusentismo', 'RecorridosConfig'];
            
            stores.forEach(store => {
                if (!db.objectStoreNames.contains(store)) {
                    // Crea el almacén definiendo 'id' como el identificador principal
                    db.createObjectStore(store, { keyPath: 'id' });
                }
            });
        };

        request.onsuccess = (event) => resolve(event.target.result);

        request.onerror = (event) => reject(event.target.error);
    });
}

export async function renderUserCard(userData) {
    if (!userData) return; // Evita errores si el objeto está vacío
    
    const nameEl = document.getElementById('user-name');
    const idEl = document.getElementById('user-id');
    const cardEl = document.getElementById('user-card');
    const photoEl = document.getElementById('user-photo');

    if (nameEl) nameEl.innerText = userData.nombre || 'Desconocido';
    if (idEl) idEl.innerText = `ID: ${userData.ID || 'N/A'} | ${userData.puesto || ''}`;
    if (cardEl) cardEl.style.display = 'flex';

    // Lógica de caché en IndexedDB para la Foto
    const dbLocal = await initIndexedDB();
    const tx = dbLocal.transaction('multimedia', 'readwrite');
    const store = tx.objectStore('multimedia');
    
    const getReq = store.get('Fotos');
    getReq.onsuccess = async () => {
        let fotosEntry = getReq.result || { id: 'Fotos' };
        
        // Si la foto ya existe localmente, la renderizamos desde caché
        if (fotosEntry[userData.ID]) {
            const localPhotoUrl = URL.createObjectURL(fotosEntry[userData.ID]);
            if (photoEl) photoEl.src = localPhotoUrl;
        } else {
            // Si no está local, obtener desde Firebase Storage
            const storage = getStorage(app);
            const photoRef = storageRef(storage, `Fotos/ElementosPP/${userData.ID}.webp`);
            try {
                const photoUrl = await getDownloadURL(photoRef);
                if (photoEl) photoEl.src = photoUrl; // Mostrar instantáneamente
                
                // Descargarla y guardarla en la Base de Datos Local
                const response = await fetch(photoUrl);
                const blob = await response.blob();
                
                // Usamos una nueva transacción rápida para no bloquear
                const txWrite = dbLocal.transaction('multimedia', 'readwrite');
                const storeWrite = txWrite.objectStore('multimedia');
                const getWriteReq = storeWrite.get('Fotos');
                getWriteReq.onsuccess = () => {
                    let fEntry = getWriteReq.result || { id: 'Fotos' };
                    fEntry[userData.ID] = blob;
                    storeWrite.put(fEntry);
                };
            } catch (photoError) {
                console.warn("Foto no encontrada o bloqueada por CORS en Storage.", photoError);
            }
        }
    };
}

export async function renderNotifPanel(uid) {
    const listDiv = document.getElementById('notif-list');
    const notifs = await getLocalNotifications(uid);
    listDiv.innerHTML = '';

    if (notifs.length === 0) {
        listDiv.innerHTML = '<p style="color:#aaa; text-align:center; font-size:13px;">No tienes notificaciones nuevas.</p>';
        return;
    }

    // Invertir arreglo para mostrar lo más reciente arriba
    notifs.slice().reverse().forEach(n => {
        const a = document.createElement('a');
        a.className = 'notif-item';
        a.href = n.url ? n.url : '#'; // Funciona como link para el iframe o vista actual
        
        a.innerHTML = `
            <img class="notif-img" src="${n['img-url'] || '../ico/cic.ico'}" alt="Icono Notificación">
            <div class="notif-content">
                <div class="notif-title">${n.titulo || 'Notificación del Sistema'}</div>
                <div class="notif-desc">${n.descripcion || ''}</div>
            </div>
        `;
        listDiv.appendChild(a);
    });
}

// --- SISTEMA DE VENTANAS Y MULTITAREA ---

export function launchApp(app, makeActive = true) {
    const appsContainer = document.getElementById('apps-container');
    const runningAppsDock = document.getElementById('running-apps');
    const startMenu = document.getElementById('start-menu');
    
    if (startMenu) startMenu.classList.remove('show'); // Cierra el menú de inicio al abrir la app

    const iframeId = `iframe-${app.id}`;
    const dockBtnId = `dock-btn-${app.id}`;
    
    if (makeActive) {
        // Ocultar todas las apps y quitar estado activo
        document.querySelectorAll('.running-app-iframe').forEach(ifr => ifr.style.display = 'none');
        document.querySelectorAll('.running-app-btn').forEach(btn => btn.classList.remove('active'));
    }

    let appIframe = document.getElementById(iframeId);
    let dockBtn = document.getElementById(dockBtnId);

    if (!appIframe) {
        appIframe = document.createElement('iframe');
        appIframe.id = iframeId;
        appIframe.className = 'running-app-iframe';
        appIframe.src = '../' + app.ruta;
        appIframe.style.display = makeActive ? 'block' : 'none';
        if (appsContainer) appsContainer.appendChild(appIframe);

        dockBtn = document.createElement('button');
        dockBtn.id = dockBtnId;
        dockBtn.className = 'dock-btn running-app-btn' + (makeActive ? ' active' : '');
        dockBtn.title = app.nombre || app.id;
        
        const img = document.createElement('img');
        img.src = app.icono ? '../' + app.icono : '../ico/cic.ico';
        dockBtn.appendChild(img);
        
        dockBtn.addEventListener('click', () => {
            if (dockBtn.classList.contains('active')) {
                appIframe.style.display = 'none';
                dockBtn.classList.remove('active');
            } else {
                document.querySelectorAll('.running-app-iframe').forEach(ifr => ifr.style.display = 'none');
                document.querySelectorAll('.running-app-btn').forEach(btn => btn.classList.remove('active'));
                appIframe.style.display = 'block';
                dockBtn.classList.add('active');
            }
            saveRunningAppsState(); // Guarda cambios al minimizar/restaurar
        });
        
        if (runningAppsDock) runningAppsDock.appendChild(dockBtn);
    } else if (makeActive) {
        // Si la app ya estaba abierta, solo la traemos al frente
        appIframe.style.display = 'block';
        dockBtn.classList.add('active');
    }
    
    saveRunningAppsState(); // Guarda que se abrió una app
}

export function saveRunningAppsState() {
    const runningApps = [];
    document.querySelectorAll('.running-app-btn').forEach(btn => {
        const appId = btn.id.replace('dock-btn-', '');
        const isActive = btn.classList.contains('active');
        runningApps.push({ id: appId, active: isActive });
    });
    localStorage.setItem('runningAppsState', JSON.stringify(runningApps));
}

export function restoreRunningApps() {
    const state = JSON.parse(localStorage.getItem('runningAppsState')) || [];
    const appsList = JSON.parse(localStorage.getItem('appsList')) || [];
    
    state.forEach(savedApp => {
        // Buscamos los datos originales de la app en la caché
        const app = appsList.find(a => a.id === savedApp.id);
        if (app) {
            launchApp(app, savedApp.active); // Lanzamos respetando si estaba minimizada o visible
        }
    });
}

// --- LÓGICA DE PERSONALIZACIÓN DE ENCABEZADOS ---

export const colorPalettes = [
    ['#041e42', '#0f386c', '#1d5a9b', '#3b82f6', '#93c5fd'], // Azul corporativo
    ['#064e3b', '#065f46', '#059669', '#10b981', '#6ee7b7'], // Verde bosque
    ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#fca5a5'], // Rojo intenso
    ['#4c1d95', '#7e22ce', '#6d28d9', '#8b5cf6', '#c4b5fd'], // Púrpura profundo
    ['#78350f', '#92400e', '#b45309', '#d97706', '#fcd34d'], // Naranja ámbar
    ['#171717', '#262626', '#404040', '#525252', '#a3a3a3'], // Gris carbón
    ['#164e63', '#0e7490', '#0891b2', '#06b6d4', '#67e8f9'], // Cian océano
    ['#831843', '#9d174d', '#be185d', '#db2777', '#f9a8d4'], // Rosa magenta
    ['#3f6212', '#713f12', '#854d0e', '#a16207', '#fde047'], // Oliva dorado
    ['#8B0056', '#a21069', '#b9217c', '#cf338f', '#e646a3'], // Fiusha Regas
    ['#1e1b4b', '#312e81', '#4f46e5', '#818cf8', '#c7d2fe'], // Índigo nocturno
    ['#022c22', '#065f46', '#059669', '#34d399', '#a7f3d0'], // Esmeralda vibrante
    ['#3b0764', '#701a75', '#a21caf', '#e879f9', '#f0abfc'], // Ciruela neón
    ['#451a03', '#78350f', '#b45309', '#f59e0b', '#fde047'], // Bronce cálido
    ['#0f172a', '#1e293b', '#334155', '#64748b', '#cbd5e1'], // Pizarra metálica
    ['#4c0519', '#881337', '#e11d48', '#fb7185', '#fecdd3'], // Rubí brillante
    ['#1c1917', '#44403c', '#78716c', '#a8a29e', '#e7e5e4'], // Piedra cálida
    ['#082f49', '#0369a1', '#0ea5e9', '#7dd3fc', '#bae6fd'], // Azul cerúleo
    ['#365314', '#4d7c0f', '#65a30d', '#a3e635', '#d9f99d'], // Verde lima
    ['#4a044e', '#86198f', '#c026d3', '#e879f9', '#f5d0fe'], // Orquídea
    ['#0a192f', '#112240', '#233554', '#495670', '#8892b0'], // Azul medianoche
    ['#291c0a', '#4a3614', '#7a5a1f', '#b8860b', '#e6c255'], // Oro antiguo
    ['#1a0b2e', '#32155c', '#5725a3', '#854cdb', '#c29ef5'], // Amatista oscuro
    ['#00201a', '#004035', '#00705f', '#00b096', '#33ffd8'], // Turquesa profundo
    ['#3a1300', '#6e2400', '#a83600', '#e64c00', '#ff8447'], // Naranja terracota
    ['#0d171c', '#1b2d36', '#2b4754', '#4a7587', '#86b0c2'], // Acero azulado
    ['#2e041f', '#5c083e', '#910b5c', '#cf1180', '#ff4daa'], // Fresa vibrante
    ['#1d1f05', '#353b09', '#57610f', '#8b9c18', '#c5d92e'], // Verde militar
    ['#2a1015', '#521d27', '#822c3d', '#bc3f57', '#f26f8b'], // Carmín oscuro
    ['#000000', '#111111', '#222222', '#444444', '#777777']  // Negro absoluto
];

export function renderPalettes() {
    const container = document.getElementById('preset-palettes');
    if(!container) return;
    container.innerHTML = '';
    colorPalettes.forEach((colors, idx) => {
        const btn = document.createElement('div');
        btn.style.width = '24px';
        btn.style.height = '24px';
        btn.style.borderRadius = '50%';
        btn.style.cursor = 'pointer';
        btn.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[3]}, ${colors[4]})`;
        btn.style.border = '2px solid #ccc';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        btn.title = `Muestra ${idx + 1}`;
        btn.onclick = () => {
            if(window.applyPalette) window.applyPalette(idx);
            else applyPalette(idx);
        };
        container.appendChild(btn);
    });
}

export function applyPalette(index) {
    const colors = colorPalettes[index];
    document.getElementById('color1').value = colors[0];
    document.getElementById('color2').value = colors[1];
    document.getElementById('color3').value = colors[2];
    document.getElementById('color4').value = colors[3];
    document.getElementById('color5').value = colors[4];
    
    document.getElementById('cust-type').value = 'custom_linear';
    if(window.updatePreview) window.updatePreview();
    else updatePreview();
}

export function applyHeaderStyles(element, bg) {
    if (bg && bg.customColors && bg.customColors.length > 0) {
        const c = bg.customColors;
        const preset = String(bg.preset || '0');
        const angle = bg.angle || 135;
        
        const c1 = c[0] || '#8B0056';
        const c2 = c[1] || c1;
        const c3 = c[2] || c2;
        const c4 = c[3] || c3;
        const c5 = c[4] || c4;
        
        switch(preset) {
            case '1':
                element.style.background = `linear-gradient(${angle}deg, ${c1}, ${c2}, ${c3}, ${c4}, ${c5})`;
                break;
            case '3':
                element.style.background = `radial-gradient(circle at top right, ${c5} 0%, ${c4} 25%, ${c3} 50%, ${c2} 75%, ${c1} 100%)`;
                break;
            case '4':
                element.style.background = `linear-gradient(to right, ${c5} 0%, ${c5} 4px, ${c4} 4px, ${c4} 8px, ${c3} 8px, ${c3} 12px, ${c2} 12px, ${c2} 16px, ${c1} 16px, ${c1} 100%)`;
                break;
            case 'custom_linear':
                element.style.background = `linear-gradient(${angle}deg, ${c1}, ${c2}, ${c3}, ${c4}, ${c5})`;
                break;
            case '0':
            default:
                element.style.background = `linear-gradient(to right, ${c5} 0%, ${c4} 4px, ${c3} 8px, ${c2} 12px, ${c1} 16px, ${c1} 100%)`;
                break;
        }
        element.style.opacity = bg.opacity !== undefined ? bg.opacity : 1;
    } else {
        // Fallback a CSS Variable si no hay configuración
        element.style.background = 'var(--color-base, var(--fiusha, #8B0056))';
        element.style.opacity = 1;
    }
}

let currentEditingItem = null;
let currentSaveConfig = null;

export function openCustomizeModal(item, saveConfig) {
    currentEditingItem = item;
    currentSaveConfig = saveConfig;
    document.getElementById('customize-title').innerText = `Personalizar ${item.id || 'Elemento'}`;
    document.getElementById('customize-preview').innerText = item.id || 'Vista Previa';
    
    const bg = item.bgHeader || {};
    const c = bg.customColors || ['#3f3f46', '#7682a2', '#047857', '#d97706', '#991b1b'];
    
    document.getElementById('color1').value = c[0] || '#000000';
    document.getElementById('color2').value = c[1] || '#000000';
    document.getElementById('color3').value = c[2] || '#000000';
    document.getElementById('color4').value = c[3] || '#000000';
    document.getElementById('color5').value = c[4] || '#000000';
    
    document.getElementById('cust-opacity').value = bg.opacity !== undefined ? bg.opacity : 1;
    document.getElementById('cust-type').value = bg.preset !== undefined ? bg.preset : 0;
    document.getElementById('cust-angle').value = bg.angle || 135;
    
    document.getElementById('customize-modal').style.display = 'flex';
    if(window.updatePreview) window.updatePreview();
    else updatePreview();
}

export function closeCustomizeModal() {
    document.getElementById('customize-modal').style.display = 'none';
    currentEditingItem = null;
    currentSaveConfig = null;
}

export function updatePreview() {
    const bgData = {
        customColors: [
            document.getElementById('color1').value,
            document.getElementById('color2').value,
            document.getElementById('color3').value,
            document.getElementById('color4').value,
            document.getElementById('color5').value
        ],
        opacity: parseFloat(document.getElementById('cust-opacity').value),
        preset: document.getElementById('cust-type').value,
        angle: parseInt(document.getElementById('cust-angle').value)
    };
    
    const preset = document.getElementById('cust-type').value;
    document.getElementById('angle-container').style.display = (preset == '1' || preset == 'custom_linear') ? 'flex' : 'none';
    document.getElementById('angle-val').innerText = bgData.angle;
    document.getElementById('op-val').innerText = Math.round(bgData.opacity * 100);

    applyHeaderStyles(document.getElementById('customize-preview'), bgData);
}

export async function saveCustomizeModal() {
    if(!currentEditingItem || !currentSaveConfig) return;
    
    const bgData = {
        customColors: [
            document.getElementById('color1').value,
            document.getElementById('color2').value,
            document.getElementById('color3').value,
            document.getElementById('color4').value,
            document.getElementById('color5').value
        ],
        opacity: parseFloat(document.getElementById('cust-opacity').value),
        preset: document.getElementById('cust-type').value,
        angle: parseInt(document.getElementById('cust-angle').value)
    };

    currentEditingItem.bgHeader = bgData;
    const newTimestamp = Date.now();

    // 1. Guardar en Base de Datos Local (IndexedDB)
    if (currentSaveConfig.storeName) {
        try {
            const dbLocal = await initIndexedDB();
            const tx = dbLocal.transaction(currentSaveConfig.storeName, 'readwrite');
            const store = tx.objectStore(currentSaveConfig.storeName);
            store.put(currentEditingItem);
            store.put({ id: 'ultima_actualizacion', updateDate: newTimestamp });
        } catch(e) { console.warn("No se pudo guardar en caché", e); }
    }

    // 2. Guardar en Firebase Realtime Database
    if (currentSaveConfig.dbUrl && currentSaveConfig.dbPath) {
        try {
            const updates = {};
            updates[`${currentSaveConfig.dbPath}/${currentEditingItem.id}/bgHeader`] = bgData;
            updates[`${currentSaveConfig.dbPath}/ultima_actualizacion/updateDate`] = newTimestamp;
            
            await syncCloudUpdate(currentSaveConfig.dbUrl, updates);
        } catch(e) { console.warn("No se pudo guardar en Firebase", e); }
    }

    closeCustomizeModal();
    if (currentSaveConfig.onSave) currentSaveConfig.onSave();
}

// --- SISTEMA DE SINCRONIZACIÓN OFFLINE (GLOBAL) ---

export async function syncCloudUpdate(dbUrl, updates) {
    if (navigator.onLine) {
        try {
            const db = getDatabase(app, dbUrl);
            await update(ref(db), updates);
            return true;
        } catch (e) {
            console.warn("Fallo de red al actualizar online, encolando...", e);
            enqueueFirebaseUpdate(dbUrl, updates);
            return false;
        }
    } else {
        console.log("Sistema offline, encolando actualización para más tarde...");
        enqueueFirebaseUpdate(dbUrl, updates);
        return false;
    }
}

function enqueueFirebaseUpdate(dbUrl, updates) {
    let queue = JSON.parse(localStorage.getItem('cic_sync_queue')) || [];
    queue.push({ dbUrl, updates, timestamp: Date.now() });
    localStorage.setItem('cic_sync_queue', JSON.stringify(queue));
}

export async function processFirebaseQueue() {
    if (!navigator.onLine) return;
    
    const lock = localStorage.getItem('cic_sync_lock');
    if (lock && Date.now() - parseInt(lock) < 10000) return; // Candado de 10s para evitar envíos múltiples simultáneos
    localStorage.setItem('cic_sync_lock', Date.now().toString());

    let queue = JSON.parse(localStorage.getItem('cic_sync_queue')) || [];
    if (queue.length === 0) {
        localStorage.removeItem('cic_sync_lock');
        return;
    }

    let failedQueue = [];
    for (let item of queue) {
        try {
            const db = getDatabase(app, item.dbUrl);
            await update(ref(db), item.updates);
        } catch (e) {
            console.error("Error procesando cola de sync", e);
            failedQueue.push(item);
        }
    }
    
    localStorage.setItem('cic_sync_queue', JSON.stringify(failedQueue));
    localStorage.removeItem('cic_sync_lock');
}

// --- SISTEMA DE ACTUALIZACIÓN (NETWORK-FIRST MANUAL) ---
export async function asegurarUltimaVersion() {
    if (navigator.onLine && 'caches' in window) {
        try {
            // En lugar del HTML, revisamos la versión oficial dentro de sw.js
            const response = await fetch(SW_URL + '?t=' + Date.now(), { 
                cache: 'reload',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            if (!response.ok) return;
            
            const text = await response.text();
            const match = text.match(/const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
            const newVersion = match ? match[1] : null;
            
            if (newVersion) {
                const cachedVersion = localStorage.getItem('cic_app_version');
                
                // Si la versión cambió, limpiamos todo y recargamos
                if (cachedVersion && cachedVersion !== newVersion) {
                    console.log(`¡Nueva versión detectada! (${cachedVersion} -> ${newVersion}). Limpiando caché y recargando...`);
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                    localStorage.setItem('cic_app_version', newVersion);
                    
                    // Exigimos al Service Worker actualizarse estructuralmente antes de recargar
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration) {
                        await registration.update();
                    }
                    
                    window.location.reload(true);
                } else if (!cachedVersion) {
                    localStorage.setItem('cic_app_version', newVersion);
                }
            }
        } catch (e) {
            console.log("Modo offline activo o error de red. Cargando versión en caché.");
        }
    }
}

// --- REGISTRO DEL SERVICE WORKER (SOPORTE OFFLINE DE PÁGINAS) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Verificar si hay una nueva versión disponible antes de usar la caché
        asegurarUltimaVersion();

        navigator.serviceWorker.register(SW_URL).then(registration => {
            console.log('Soporte Offline Activado. Scope:', registration.scope);
            
            // Forzar al Service Worker a buscar actualizaciones estructurales si hay conexión
            if (navigator.onLine) {
                registration.update();
            }
        }).catch(err => {
            console.warn('Fallo el registro del Soporte Offline:', err);
        });
    });
}
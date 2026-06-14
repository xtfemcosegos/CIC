import { moveElementoRegas, downloadRegas, updateShiftData, renameShiftKey, deleteShiftKey } from './scrpt.js';

window.currentContextMenuData = null;

// Cierra el menú al dar clic fuera de él o cancela el modo "Intercambio"
document.addEventListener('click', (e) => {
    const menu = document.getElementById('element-context-menu');
    if (menu && menu.style.display === 'flex' && !menu.contains(e.target)) {
        menu.style.display = 'none';
    }
    if (window.intercambioData && !e.target.closest('.draggable-row') && !e.target.closest('#right-panel')) {
        const swapPanel = document.getElementById('right-panel-swap');
        if (!swapPanel || swapPanel.style.display !== 'flex') {
            window.intercambioData = null;
            document.body.style.cursor = '';
        }
    }
});

// Cancela el modo "Intercambio" al oprimir Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.intercambioData) {
        window.intercambioData = null;
        document.body.style.cursor = '';
    }
});

// Función pública para construir y mostrar el menú
window.showContextMenu = function(e, idElemento, empleadoNombre, record, shift, currentCaseta, contextDate, bgHeaderToPass, casetasGlobal, motivosGlobal) {
    window.currentContextMenuData = { idElemento, empleadoNombre, record, shift, currentCaseta, contextDate, bgHeaderToPass, casetasGlobal, motivosGlobal };
    
    const assignedShifts = Object.keys(record || {}).map(k => k.toLowerCase());
    const allShifts = ['matutino', 'vespertino', 'nocturno'];
    const unassignedShifts = allShifts.filter(s => !assignedShifts.includes(s));

    let html = '';

    // Detalle de elemento
    html += `<div class="ctx-group-label">Detalle de elemento</div>`;
    html += `<div class="ctx-item" onclick="handleMenuAction('perfil')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Perfil</div>`;
    html += `<div class="ctx-item" onclick="handleMenuAction('turno')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Turno</div>`;
    html += `<div class="ctx-item" onclick="handleMenuAction('patrones')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> Patrones</div>`;

    // Asignación de turno
    if (unassignedShifts.length > 0) {
        html += `<div class="ctx-divider"></div>`;
        html += `<div class="ctx-group-label">Asignación de turno</div>`;
        unassignedShifts.forEach(s => {
            const label = s.charAt(0).toUpperCase() + s.slice(1);
            html += `<div class="ctx-item" onclick="handleMenuAction('asignar', '${s}')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> ${label}</div>`;
        });
    }

    // Acciones Rápidas
    html += `<div class="ctx-divider"></div>`;
    html += `<div class="ctx-item" style="color: #ef4444;" onclick="handleMenuAction('falta')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Poner falta</div>`;
    
    const isRetardo = shift.data.retardo === true || String(shift.data.retardo).toLowerCase() === 'true' || String(shift.data.retardo).toLowerCase() === 'si';
    html += `<div class="ctx-item" style="color: #d97706;" onclick="handleMenuAction('retardo')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${isRetardo ? 'Quitar retardo' : 'Marcar retardo'}</div>`;
    
    html += `<div class="ctx-item" style="color: #ef4444;" onclick="handleMenuAction('eliminar')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Desasignar / Eliminar</div>`;
    html += `<div class="ctx-item" style="color: #3b82f6;" onclick="handleMenuAction('intercambiar')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg> Intercambiar turno con...</div>`;

    const menu = document.getElementById('element-context-menu');
    if (menu) {
        menu.innerHTML = html;
        menu.style.display = 'flex';

        requestAnimationFrame(() => {
            let x = e.clientX;
            let y = e.clientY;
            const rect = menu.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 5;
            if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 5;
            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
        });
    }
};

// Función pública para ejecutar las acciones del menú
window.handleMenuAction = async function(action, param) {
    const menu = document.getElementById('element-context-menu');
    if (menu) menu.style.display = 'none';

    const data = window.currentContextMenuData;
    if (!data) return;

    const reqDate = data.contextDate;
    const isToday = reqDate.toDateString() === new Date().toDateString();
    const anio = reqDate.getFullYear().toString();
    const mes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][reqDate.getMonth()];
    const dia = reqDate.getDate().toString().padStart(2, '0') + (reqDate.getMonth()+1).toString().padStart(2, '0') + reqDate.getFullYear().toString();

    const fireUpdateEvent = () => window.dispatchEvent(new CustomEvent('regasUpdated'));

    if (['perfil', 'turno', 'patrones'].includes(action)) {
        if (window.openDetailPanel) {
            await window.openDetailPanel(data.idElemento, data.empleadoNombre, data.record, data.shift.name, data.bgHeaderToPass, data.casetasGlobal, data.motivosGlobal, isToday, anio, mes, dia);
            if (action !== 'turno' && window.selectDetailTab) window.selectDetailTab(action);
        }
    } else if (action === 'asignar') {
        try { await moveElementoRegas(anio, mes, dia, data.idElemento, param, 'Desconocido', false, null); fireUpdateEvent(); } catch(e) { console.error(e); }
    } else if (action === 'falta') {
        try { 
            if (data.shift.name !== 'ausentismo') {
                const newData = { 
                    motivo: 'Falta', 
                    reporte: '', 
                    turno_original: data.shift.name, 
                    caseta_original: data.shift.data.Caseta || 'Desconocido' 
                };
                await renameShiftKey(anio, mes, dia, data.idElemento, data.shift.name, 'ausentismo', newData); 
            } else {
                await updateShiftData(anio, mes, dia, data.idElemento, data.shift.name, { motivo: 'Falta', Caseta: null, reporte: '' }); 
            }
            fireUpdateEvent(); 
        } catch(e) { console.error(e); }
    } else if (action === 'retardo') {
        try { 
            const isRetardo = data.shift.data.retardo === true || String(data.shift.data.retardo).toLowerCase() === 'true' || String(data.shift.data.retardo).toLowerCase() === 'si'; 
            const updates = { retardo: !isRetardo };
            if (!isRetardo) {
                updates.reporte = data.shift.data.reporte || ""; // Agregar reporte si se activa
            } else {
                updates.reporte = null; // Eliminar reporte si se quita el retardo
            }
            await updateShiftData(anio, mes, dia, data.idElemento, data.shift.name, updates); 
            fireUpdateEvent(); 
        } catch(e) { console.error(e); }
    } else if (action === 'eliminar') {
        if (confirm(`¿Estás seguro de desasignar y eliminar el turno de ${data.empleadoNombre}?`)) {
            try { await deleteShiftKey(anio, mes, dia, data.idElemento, data.shift.name); fireUpdateEvent(); } catch(e) { console.error(e); }
        }
    } else if (action === 'intercambiar') {
        window.intercambioData = data;
        if (window.openSwapPanel) {
            window.openSwapPanel();
        } else {
            document.body.style.cursor = 'crosshair';
        }
    }
};
/**
 * CIC OS - Authentication Guard
 * Protege las rutas verificando la existencia del token en sessionStorage.
 */
(function() {
    const token = sessionStorage.getItem('cic_os_token');
    
    // Si no hay token, redirigir al login inmediatamente
    if (!token) {
        console.warn("Acceso no autorizado. Redirigiendo al inicio...");
        
        // Detectar profundidad de carpeta para volver a la raíz
        const path = window.location.pathname;
        const depth = (path.match(/\//g) || []).length;
        
        // Ajustar según tu estructura (index.html está en la raíz)
        if (path.includes('/mods/')) {
            window.location.href = '../index.html';
        } else if (path.includes('/secciones/')) {
            window.location.href = '../../../index.html';
        } else {
            window.location.href = 'index.html';
        }
    }
})();
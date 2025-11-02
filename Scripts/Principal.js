async function VerificarSesion() {
  try {
    const archivo = await fetch('inicio_sesion.json'); // debe estar en raíz
    if (!archivo.ok) throw new Error('Archivo no encontrado');

    const sesion = await archivo.json();
    const { nombre, tipo } = sesion;

    const rutaImagen = `ImgUser/${nombre}.png`;
    const img = new Image();
    img.src = rutaImagen;
    img.onerror = () => img.src = 'ImgUser/0.png';
    img.alt = 'Foto de usuario';
    img.style.height = '32px';
    img.style.borderRadius = '50%';
    img.style.marginLeft = '8px';

    const info = document.getElementById('infoUsuario');
    info.innerHTML = `👋 Bienvenido, ${nombre} (${tipo})`;
    info.appendChild(img);
  } catch (error) {
    console.log('No hay sesión activa:', error.message);
  }
}

async function IniciarSesion(event) {
  event.preventDefault();

  const usuario = document.getElementById('usuario').value.trim();
  const contraseña = document.getElementById('contraseña').value;

  if (!usuario || !contraseña) {
    alert('Por favor, completa todos los campos.');
    return false;
  }

  try {
    const respuesta = await fetch('https://tuservidor.com/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, contraseña })
    });

    if (!respuesta.ok) throw new Error(`Error: ${respuesta.status}`);

    const datos = await respuesta.json();

    if (datos.autenticado) {
      // Guardar token y datos de sesión
      localStorage.setItem('token', datos.token);

      // Crear archivo de sesión local (simulado)
      const sesion = {
        nombre: datos.nombre || usuario,
        tipo: datos.tipo || 'usuario'
      };

      // Simulación de persistencia local (solo para entorno local)
      const blob = new Blob([JSON.stringify(sesion)], { type: 'application/json' });
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = 'inicio_sesion.json';
      enlace.click();

      window.location.href = 'dashboard.html';
    } else {
      alert('❌ Usuario o contraseña incorrectos');
    }
  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);
    alert('⚠️ No se pudo conectar con el servidor.');
  }

  return false;
}
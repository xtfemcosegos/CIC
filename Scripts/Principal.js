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
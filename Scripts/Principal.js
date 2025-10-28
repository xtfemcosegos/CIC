async function Autenticar(usuario, contraseña) {
  try {
    const respuesta = await fetch('https://tuservidor.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ usuario, contraseña })
    });

    if (!respuesta.ok) {
      throw new Error(`Error en la solicitud: ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    if (datos.autenticado) {
      console.log('✅ Usuario válido');
      // Redirigir o guardar token
      localStorage.setItem('token', datos.token);
      window.location.href = 'dashboard.html';
    } else {
      alert('❌ Usuario o contraseña incorrectos');
    }
  } catch (error) {
    console.error('Error al validar:', error.message);
    alert('⚠️ No se pudo conectar con el servidor.');
  }
}
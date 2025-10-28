async function Autenticar(usuario, contraseña) {
  try {
    const respuesta = await fetch('https://tuservidor.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usuario: usuario,
        contraseña: contraseña
      })
    });

    if (!respuesta.ok) {
      throw new Error('Error en la solicitud: ' + respuesta.status);
    }

    const datos = await respuesta.json();

    if (datos.autenticado) {
      console.log('✅ Usuario válido');
      // Aquí puedes redirigir o guardar token
    } else {
      console.log('❌ Usuario o contraseña incorrectos');
    }

  } catch (error) {
    console.error('Error al validar:', error.message);
  }
}
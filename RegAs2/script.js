// Recuperar datos desde Power Automate
async function recuperarDatos(solicitud) {
  try {
    const response = await fetch("https://default3b2cbccb81bb44a2a19a2386bb3606.02.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/097a63200e254f4db1c47d052f2613ef/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=4GE6KXcJvL1j7ih9cl-ubC93RoycRieLuJuz2DdbFU4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Mode: solicitud })
    });

    if (!response.ok) {
      throw new Error("Error en la solicitud: " + response.status);
    }

    const data = await response.json();
    console.log("Datos recibidos:", data);
    return data;
  } catch (error) {
    console.error("Error al recuperar datos:", error);
  }
}

// Enviar datos al endpoint de Power Automate
async function enviarDatos(formData) {
  try {
    const response = await fetch("https://default3b2cbccb81bb44a2a19a2386bb3606.02.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/28a6ecf6c40e4d14aa520a51c8430065/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=4DbF_Lj5HOOWUNIaV_lSLMZH1j5etCF1n18CTLRDkxs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error(`Error en la petición: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Datos enviados correctamente:", data);
    alert("Registro enviado con éxito ✅");
  } catch (error) {
    console.error("❌ Error al enviar los datos:", error);
    alert("Hubo un problema al enviar el registro. Revisa la consola.");
  }
}

// Cambiar color de texto enriquecido con input color
function inicializarColorPicker() {
  const colorPicker = document.getElementById("colorPicker");
  if (colorPicker) {
    colorPicker.addEventListener("input", (e) => {
      const color = e.target.value;
      document.execCommand("foreColor", false, color);
    });
  }
}

  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hh}:${mm}:${ss}`;
  }
 

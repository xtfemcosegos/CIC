const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { genkit, z } = require("genkit");
const { googleAI } = require("@genkit-ai/googleai");
const { defineSecret } = require("firebase-functions/params");

// 1. Declarar el secreto usando el gestor seguro de Firebase
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 2. Definimos estrictamente cómo queremos que la IA nos responda usando Zod
const PatronSchema = z.object({
    tipoPatron: z.enum(["2x2x2x2", "fijo_dia", "fijo_tarde", "custom_weekly", "custom_cyclic"])
        .describe("El tipo de patrón que detectaste en el historial"),
    secuencia: z.array(z.string()).optional()
        .describe("Si es cíclico o personalizado, el arreglo de turnos en minúsculas (ej. ['matutino', 'vespertino', 'nocturno', 'descanso'])"),
    razonamiento: z.string()
        .describe("Una breve explicación de 1 línea de por qué detectaste este patrón")
});

// 3. Exponemos el flujo indicando el Secreto
exports.sugerirpatron = onCall(
    { cors: true, secrets: [geminiApiKey] }, 
    async (request) => {
    try {
        // Obtenemos el valor de la llave extraído con seguridad
        const apiKey = geminiApiKey.value();

        const ai = genkit({
            plugins: [googleAI({ apiKey: apiKey })],
        });

        const prompt = `
        Eres un experto analista de recursos humanos. Analiza este historial de los últimos 30 días de un guardia:
        ${request.data.historial}

        Identifica el ciclo de turnos. Los ausentismos pueden ser considerados como días de descanso regulares.
        Responde estrictamente utilizando el esquema JSON solicitado.
        `;

        const response = await ai.generate({
            model: 'googleai/gemini-1.5-flash', // Usar formato de texto es más seguro para evitar fallos de importación
            prompt: prompt,
            output: { schema: PatronSchema }
        });

        // Compatibilidad cruzada (Genkit 0.5.x vs 1.x) para asegurar que se retorne el objeto correctamente
        return typeof response.output === 'function' ? response.output() : response.output;
    } catch (error) {
        console.error("Error detallado en la IA:", error);
        // Usamos "unknown" porque Firebase oculta los detalles de los errores "internal" al frontend
        throw new HttpsError("unknown", "Error de Genkit: " + (error.message || error.toString()));
    }
}
);

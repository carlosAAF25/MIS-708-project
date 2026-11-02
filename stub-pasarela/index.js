const express = require('express');
const app = express();

app.use(express.json());

// Configurables por variables de entorno según la rúbrica
const ERROR_RATE = parseFloat(process.env.ERROR_RATE || '0.3');
const MAX_LATENCY_MS = parseInt(process.env.MAX_LATENCY_MS || '5000', 10);

app.post('/v1/pagos', (req, res) => {
    // Latencia aleatoria entre 0 y MAX_LATENCY_MS
    const delay = Math.floor(Math.random() * MAX_LATENCY_MS);
    
    setTimeout(() => {
        // Fallo simulado basado en la tasa de error
        if (Math.random() < ERROR_RATE) {
            console.log(`[STUB] Fallo simulado ejecutado tras ${delay}ms`);
            return res.status(503).json({ error: 'Service Unavailable - Pasarela caída' });
        }
        
        // Cobro exitoso
        console.log(`[STUB] Cobro aprobado en ${delay}ms`);
        return res.status(200).json({
            estado: 'aprobado',
            transaccion_id: `txn_${Date.now()}`
        });
    }, delay);
});

// Endpoint de salud para Docker
app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Stub Pasarela iniciado en puerto ${PORT}`);
    console.log(`Configuración -> Error Rate: ${ERROR_RATE * 100}% | Latencia Máx: ${MAX_LATENCY_MS}ms`);
});
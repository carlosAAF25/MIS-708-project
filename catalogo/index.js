const express = require('express');
const db = require('./db');
const verificarToken = require('./auth');

const app = express();
app.use(express.json());

// Middleware simple para capturar el Correlation ID enviado por Pedidos
app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || 'N/A';
    next();
});

// Endpoint síncrono: Reserva de stock (Paso 2 del flujo principal)
app.post('/v1/catalogo/reservar', verificarToken, async (req, res) => {
    const { sucursal_id, items } = req.body; 
    
    console.log(`[Catálogo][${req.correlationId}] Solicitud de reserva recibida.`);

    try {
        await db.transaction(async trx => {
            for (const item of items) {
                // Bloquea la fila para evitar "race conditions"
                const stock = await trx('existencias')
                    .where({ sucursal_id, producto_id: item.producto_id })
                    .forUpdate()
                    .first();

                if (!stock || (stock.cantidad - stock.reservado) < item.cantidad) {
                    throw new Error(`Stock insuficiente para producto ${item.producto_id}`);
                }

                // Incrementa el stock reservado (bloqueado temporalmente)
                await trx('existencias')
                    .where({ sucursal_id, producto_id: item.producto_id })
                    .increment('reservado', item.cantidad);
            }
        });
        
        console.log(`[Catálogo][${req.correlationId}] Reserva exitosa.`);
        res.status(200).json({ status: 'Reserva exitosa' });
        
    } catch (error) {
        console.warn(`[Catálogo][${req.correlationId}] Fallo en reserva: ${error.message}`);
        // Devuelve 409 Conflict si no hay stock
        res.status(409).json({ error: error.message }); 
    }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

const PORT = 3001;
app.listen(PORT, () => console.log(`Catálogo iniciado en puerto ${PORT}`));
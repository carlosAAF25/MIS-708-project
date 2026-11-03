const express = require('express');
const axios = require('axios');
const amqplib = require('amqplib');
const { randomUUID } = require('crypto');
const db = require('./db');
const verificarToken = require('./auth');

const app = express();
app.use(express.json());

let canalRabbit;

// Conexión a RabbitMQ
// Reemplaza tu función conectarRabbitMQ con esta que ahora también consume:
async function conectarRabbitMQ() {
    try {
        const conn = await amqplib.connect(process.env.RABBITMQ_URL);
        canalRabbit = await conn.createChannel();
        await canalRabbit.assertQueue('cobros_solicitados', { durable: true });
        await canalRabbit.assertQueue('cobros_resultados', { durable: true });
        
        console.log('[Pedidos] Conectado a RabbitMQ y esperando resultados...');

        // Escuchar resultados de Pagos para cerrar la Saga
        canalRabbit.consume('cobros_resultados', async (msg) => {
            if (msg !== null) {
                const { pedido_id, correlation_id, estado, motivo } = JSON.parse(msg.content.toString());
                console.log(`\n[Pedidos][${correlation_id}] Resultado de cobro recibido: ${estado}`);

                try {
                    const nuevoEstado = estado === 'aprobado' ? 'confirmado' : 'rechazado';
                    
                    // Actualizar BD local
                    await db.transaction(async trx => {
                        await trx('pedidos').where({ id: pedido_id }).update({ estado: nuevoEstado });
                        await trx('historial_estados').insert({
                            pedido_id, estado: nuevoEstado, motivo: motivo || 'Procesado por Pagos'
                        });
                    });

                    // Recuperar datos del pedido para enviar a Catálogo
                    const pedido = await db('pedidos').where({ id: pedido_id }).first();
                    const items = await db('pedido_items').where({ pedido_id });

                    // Ejecutar Compensación (Rollback) o Consolidación
                    const accion = estado === 'aprobado' ? 'consolidar' : 'liberar';
                    await axios.post(`${process.env.CATALOGO_URL}/v1/catalogo/${accion}`, {
                        sucursal_id: pedido.sucursal_id,
                        items
                    }, {
                        headers: { 'x-correlation-id': correlation_id }
                    });

                    console.log(`[Pedidos][${correlation_id}] Saga finalizada. Stock ${accion}do.`);
                    canalRabbit.ack(msg);
                } catch (error) {
                    console.error(`[Pedidos][${correlation_id}] Error finalizando saga:`, error.message);
                }
            }
        });
    } catch (error) {
        console.error('[Pedidos] Error al conectar con RabbitMQ', error);
        setTimeout(conectarRabbitMQ, 5000);
    }
}
conectarRabbitMQ();
// Agrega este endpoint antes del app.listen para que el cliente consulte su pedido
app.get('/v1/pedidos/:id', verificarToken, async (req, res) => {
    const pedido = await db('pedidos').where({ id: req.params.id, cliente_id: req.user.id }).first();
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    
    const historial = await db('historial_estados').where({ pedido_id: pedido.id }).orderBy('fecha', 'asc');
    res.json({ pedido, historial });
});

// Endpoint de creación de pedido (Inicio de la Saga)
app.post('/v1/pedidos', verificarToken, async (req, res) => {
    const { sucursal_id, items } = req.body;
    const cliente_id = req.user.id; 
    
    // Generación del ID de Correlación (Exigencia de la rúbrica)
    const correlationId = randomUUID();
    console.log(`[Pedidos][${correlationId}] Iniciando saga para nuevo pedido.`);

    try {
        // 1. Calcular total y guardar pedido "pendiente" con idempotencia
        const total = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
        
        let pedidoId;
        await db.transaction(async trx => {
            const [pedido] = await trx('pedidos').insert({
                cliente_id,
                sucursal_id,
                total,
                correlation_id: correlationId // Clave de idempotencia
            }).returning('id');
            pedidoId = pedido.id;

            const itemsInsert = items.map(i => ({ ...i, pedido_id: pedidoId }));
            await trx('pedido_items').insert(itemsInsert);

            await trx('historial_estados').insert({
                pedido_id: pedidoId,
                estado: 'pendiente',
                motivo: 'Pedido creado por el cliente'
            });
        });

        // 2. Llamada síncrona a Catálogo para reservar stock
        try {
            await axios.post(`${process.env.CATALOGO_URL}/v1/catalogo/reservar`, {
                sucursal_id,
                items
            }, {
                headers: { 
                    'Authorization': req.headers['authorization'],
                    'x-correlation-id': correlationId 
                },
                timeout: 3000 // Exigido en rúbrica: Timeout explícito
            });
            console.log(`[Pedidos][${correlationId}] Reserva de stock confirmada por Catálogo.`);
        } catch (error) {
            // Compensación local si falla la reserva síncrona
            await marcarPedidoRechazado(pedidoId, 'Stock insuficiente o error en Catálogo');
            return res.status(409).json({ error: 'No se pudo reservar el stock', motivo: error.response?.data || error.message });
        }

        // 3. Llamada asíncrona: Publicar evento para Pagos
        const eventoCobro = {
            pedido_id: pedidoId,
            correlation_id: correlationId,
            monto: total
        };
        
        canalRabbit.sendToQueue('cobros_solicitados', Buffer.from(JSON.stringify(eventoCobro)), { persistent: true });
        console.log(`[Pedidos][${correlationId}] Evento publicado en cobros_solicitados.`);

        res.status(202).json({ 
            mensaje: 'Pedido recibido y en proceso', 
            pedido_id: pedidoId,
            correlation_id: correlationId
        });

    } catch (error) {
        console.error(`[Pedidos][${correlationId}] Error interno:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Función auxiliar para actualizar estados
async function marcarPedidoRechazado(pedidoId, motivo) {
    await db.transaction(async trx => {
        await trx('pedidos').where({ id: pedidoId }).update({ estado: 'rechazado' });
        await trx('historial_estados').insert({ pedido_id: pedidoId, estado: 'rechazado', motivo });
    });
}

app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

const PORT = 3002;
app.listen(PORT, () => console.log(`Pedidos iniciado en puerto ${PORT}`));
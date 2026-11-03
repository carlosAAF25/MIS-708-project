const express = require('express');
const amqplib = require('amqplib');
const axios = require('axios');
const CircuitBreaker = require('opossum');
const db = require('./db');

const app = express();
app.use(express.json());

// 1. Configuración del Circuit Breaker (Opossum)
async function procesarCobroPasarela(payload) {
    // Si el stub tarda más de 4000ms, axios corta la petición y lanza error
    const res = await axios.post(`${process.env.PASARELA_URL}/v1/pagos`, payload, {
        timeout: 4000 
    });
    return res.data;
}

const breaker = new CircuitBreaker(procesarCobroPasarela, {
    timeout: 4000, 
    errorThresholdPercentage: 50, // Abre el circuito si el 50% de las peticiones fallan
    resetTimeout: 10000 // Tiempo en estado 'Open' antes de probar si la pasarela revivió (Half-Open)
});

// Eventos de observabilidad para tu defensa en vivo
breaker.on('open', () => console.warn('[Circuit Breaker] ¡Circuito ABIERTO! Protegiendo pasarela.'));
breaker.on('halfOpen', () => console.log('[Circuit Breaker] Circuito MEDIO-ABIERTO. Probando conexión...'));
breaker.on('close', () => console.log('[Circuit Breaker] Circuito CERRADO. Operación normal.'));

// 2. Conexión y Consumo de Eventos desde RabbitMQ
let canalRabbit;
async function iniciarConsumidor() {
    try {
        const conn = await amqplib.connect(process.env.RABBITMQ_URL);
        canalRabbit = await conn.createChannel();
        
        await canalRabbit.assertQueue('cobros_solicitados', { durable: true });
        await canalRabbit.assertQueue('cobros_resultados', { durable: true });

        console.log('[Pagos] Consumidor de eventos iniciado');

        canalRabbit.consume('cobros_solicitados', async (msg) => {
            if (msg !== null) {
                const evento = JSON.parse(msg.content.toString());
                const { pedido_id, correlation_id, monto } = evento;

                console.log(`\n[Pagos][${correlation_id}] Solicitud de cobro recibida.`);

                try {
                    // 3. Idempotencia: Verificar si el cobro ya fue procesado
                    const transaccionExistente = await db('transacciones')
                        .where({ correlation_id }).first();

                    if (transaccionExistente) {
                        console.log(`[Pagos][${correlation_id}] Evento duplicado ignorado (Idempotencia).`);
                        return canalRabbit.ack(msg);
                    }

                    // 4. Intentar cobro a través del Circuit Breaker
                    let estadoCobro = 'rechazado';
                    let motivoRechazo = null;

                    try {
                        await breaker.fire({ monto, correlation_id });
                        estadoCobro = 'aprobado';
                    } catch (error) {
                        // Opossum lanza 'Breaker is open' si cortó el circuito por exceso de fallos
                        motivoRechazo = error.message === 'Breaker is open' 
                            ? 'Rechazado por circuito abierto (Pasarela inestable)' 
                            : 'Fallo o timeout en la pasarela simulada';
                        console.warn(`[Pagos][${correlation_id}] Cobro fallido: ${motivoRechazo}`);
                    }

                    // 5. Guardar en base de datos local
                    await db('transacciones').insert({
                        pedido_id,
                        correlation_id,
                        monto,
                        estado: estadoCobro
                    });

                    // 6. Publicar el resultado para que Pedidos lo escuche
                    const eventoResultado = {
                        pedido_id,
                        correlation_id,
                        estado: estadoCobro,
                        motivo: motivoRechazo
                    };

                    canalRabbit.sendToQueue('cobros_resultados', Buffer.from(JSON.stringify(eventoResultado)), { persistent: true });
                    console.log(`[Pagos][${correlation_id}] Resultado publicado: ${estadoCobro.toUpperCase()}`);
                    
                    // Confirmar a RabbitMQ que el mensaje se procesó exitosamente
                    canalRabbit.ack(msg); 
                } catch (error) {
                    console.error(`[Pagos][${correlation_id}] Error interno procesando mensaje:`, error);
                    // Sin ack(), RabbitMQ reintentará entregar el mensaje más tarde
                }
            }
        });
    } catch (error) {
        console.error('[Pagos] Error de conexión con RabbitMQ', error);
        setTimeout(iniciarConsumidor, 5000);
    }
}
iniciarConsumidor();

app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

const PORT = 3003;
app.listen(PORT, () => console.log(`Pagos iniciado en puerto ${PORT}`));
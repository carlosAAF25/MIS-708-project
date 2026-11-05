# ADR 002: Comunicación asíncrona mediante RabbitMQ

## Estado
Aceptado

## Contexto
La integración con la pasarela de pagos externa es propensa a altas latencias y fallos aleatorios. Una comunicación 100% HTTP (REST) entre Pedidos y Pagos provocaría bloqueos de red y saturación de hilos.

## Decisión
Se adoptó un modelo híbrido, utilizando **RabbitMQ** para la mensajería asíncrona entre Pedidos y Pagos. Se implementaron colas durables (`cobros_solicitados` y `cobros_resultados`) para garantizar que ningún mensaje se pierda si un servicio se reinicia.

## Consecuencias
* **Positivas:** Desacoplamiento temporal. Si el servicio de Pagos se cae, RabbitMQ retiene los mensajes hasta que vuelva a estar en línea. 
* **Negativas:** Introduce complejidad operativa (gestión del broker) y el sistema pasa a tener **consistencia eventual** en lugar de consistencia fuerte.

# ADR 001: Uso del Patrón Saga (Orquestación)

## Estado
Aceptado

## Contexto
El sistema de pedidos requiere una transacción distribuida que involucra tres microservicios independientes (Pedidos, Catálogo y Pagos), cada uno con su propia base de datos PostgreSQL, lo que imposibilita el uso de transacciones ACID tradicionales (Commit en 2 fases).

## Decisión
Se implementó el **Patrón Saga basado en Orquestación**. El servicio de `Pedidos` actúa como el orquestador central que dirige el flujo lógico:
1. Reserva el stock de manera síncrona.
2. Solicita el cobro de manera asíncrona.
3. Evalúa el resultado del cobro para consolidar el pedido o ejecutar transacciones compensatorias (liberar stock).

## Consecuencias
* **Positivas:** El flujo de negocio completo es visible y fácil de monitorear desde un solo servicio (Pedidos). Evita dependencias cíclicas complejas.
* **Negativas:** El servicio de Pedidos concentra demasiada lógica de dominio y podría convertirse en un cuello de botella.

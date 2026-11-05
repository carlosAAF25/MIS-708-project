# Sistema de Pedidos - Microservicios (Saga Orquestada)

Este proyecto implementa una arquitectura de microservicios para la gestión de pedidos, cumpliendo con patrones de resiliencia, transacciones distribuidas y tolerancia a fallos.

## Requisitos Previos
- Docker y Docker Compose instalados.
- Node.js v18+ (Para ejecutar los scripts de pruebas y generación de tokens locales).

## 1. Arranque del Sistema
El ecosistema está completamente contenerizado. Para levantar la infraestructura (PostgreSQL, RabbitMQ) y los microservicios (Pedidos, Catálogo, Pagos, Stub-Pasarela):

docker compose up --build -d

*Nota técnica:* RabbitMQ tiene configurado un `healthcheck` de 60 segundos. Los microservicios de Node.js esperarán automáticamente a que el broker esté en estado `healthy` antes de iniciar para evitar errores de conexión.

## 2. Generación de Token de Prueba
El sistema utiliza seguridad mediante JWT. Para generar un token válido para las pruebas del tribunal, ejecuta el siguiente script en la raíz del proyecto:


node generar-token.js

Copia el token resultante (incluyendo la palabra `Bearer `) para usarlo en las peticiones.

## 3. Pruebas y Colección de Postman
En la raíz de este repositorio se incluye el archivo `postman_collection.json`. 
1. Importa este archivo en Postman.
2. La colección contiene la petición preconfigurada `POST /v1/pedidos`.
3. Ve a la pestaña **Authorization**, selecciona **Bearer Token** y pega el token generado en el paso anterior.
4. Envía la petición para iniciar la Saga.

También puedes ejecutar el script de pruebas automatizadas de salud y resiliencia con:
```bash
node pruebas-automatizadas.js
```

## Arquitectura y Patrones Implementados
- **Patrón Saga (Orquestación):** El servicio de *Pedidos* dirige la transacción distribuida. Reserva stock de forma síncrona y solicita cobros de forma asíncrona. Ejecuta la compensación (liberación de stock en Catálogo) si el cobro es rechazado.
- **Comunicación Asíncrona:** Uso de colas durables en RabbitMQ (`cobros_solicitados`, `cobros_resultados`) para desacoplar el motor de pagos del orquestador.
- **Circuit Breaker:** Implementado en el servicio de *Pagos* (usando `opossum`) para tolerar los fallos y latencias extremas inyectadas en el stub de la pasarela, aislando el error mediante fail-fast.
- **Idempotencia:** Uso de un `correlation_id` (UUID) inyectado desde el inicio de la petición para rastrear la traza completa de la saga y evitar operaciones duplicadas.

*Documentación extendida:* Los diagramas de arquitectura C4, diagramas de secuencia, contrato OpenAPI y los ADRs se encuentran en la carpeta `/docs`.
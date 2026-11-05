# ADR 003: Tolerancia a fallos con Circuit Breaker

## Estado
Aceptado

## Contexto
El servicio de `stub-pasarela` está configurado intencionalmente para devolver errores (`ERROR_RATE=0.3`) y latencias extremas (`MAX_LATENCY_MS=5000`). Seguir enviando peticiones a un servicio caído degrada el rendimiento de toda la plataforma.

## Decisión
Se implementó el patrón **Circuit Breaker** (usando la librería `opossum` en Node.js) dentro del servicio de Pagos, justo antes de consumir el endpoint de la pasarela. Se configuró para "abrir el circuito" y rechazar transacciones instantáneamente (fail-fast) si el umbral de errores supera el 50% o si las peticiones tardan más de 4000ms.

## Consecuencias
* **Positivas:** Protege al servicio de Pagos contra el agotamiento de recursos (hilos en espera) y mejora la resiliencia del sistema aislando la falla externa.
* **Negativas:** Requiere ajuste cuidadoso de los umbrales de tiempo y tasa de error para no rechazar pagos legítimos durante falsos positivos.

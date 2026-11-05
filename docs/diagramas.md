# Documentación Visual de Arquitectura

## 1. Diagrama C4 Nivel 1: Contexto del Sistema
```mermaid
C4Context
    title Diagrama de Contexto - Sistema de Pedidos
    Person(cliente, "Cliente", "Usuario autenticado que realiza pedidos")
    System(sistema_pedidos, "Sistema de Pedidos", "Plataforma de microservicios para gestión de compras")
    System_Ext(pasarela, "Pasarela de Pagos Externa", "Sistema de terceros para procesar cobros (Simulado)")

    Rel(cliente, sistema_pedidos, "Crea y consulta pedidos", "HTTPS/REST")
    Rel(sistema_pedidos, pasarela, "Solicita cobros", "HTTPS/REST")
```

## 2. Diagrama C4 Nivel 2: Contenedores
```mermaid
C4Container
    title Diagrama de Contenedores - Arquitectura Interna
    Person(cliente, "Cliente", "Usuario autenticado")
    
    Container(pedidos, "Servicio de Pedidos", "Node.js/Express", "Orquesta la Saga y expone la API al cliente")
    Container(catalogo, "Servicio de Catálogo", "Node.js/Express", "Gestiona inventario y reservas")
    Container(pagos, "Servicio de Pagos", "Node.js/Express", "Maneja cobros con Circuit Breaker")
    
    ContainerDb(db_pedidos, "BD Pedidos", "PostgreSQL", "Almacena órdenes y estados")
    ContainerDb(db_catalogo, "BD Catálogo", "PostgreSQL", "Almacena stock")
    ContainerDb(db_pagos, "BD Pagos", "PostgreSQL", "Almacena transacciones")
    
    Container(rabbitmq, "Message Broker", "RabbitMQ", "Gestión de eventos asíncronos")
    System_Ext(pasarela, "Pasarela de Pagos", "Stub", "API Externa")

    Rel(cliente, pedidos, "API REST", "HTTPS")
    Rel(pedidos, catalogo, "Reserva/Libera stock", "HTTP/REST")
    Rel(pedidos, db_pedidos, "Lee/Escribe")
    Rel(catalogo, db_catalogo, "Lee/Escribe")
    Rel(pagos, db_pagos, "Lee/Escribe")
    
    Rel(pedidos, rabbitmq, "Publica evento cobro", "AMQP")
    Rel(rabbitmq, pagos, "Consume evento cobro", "AMQP")
    Rel(pagos, pasarela, "Intenta cobro (Opossum)", "HTTP")
    Rel(pagos, rabbitmq, "Publica resultado", "AMQP")
    Rel(rabbitmq, pedidos, "Consume resultado", "AMQP")
```

## 3. Secuencia de la Saga: Camino Feliz (Consolidación)
```mermaid
sequenceDiagram
    actor C as Cliente
    participant P as Pedidos
    participant Cat as Catálogo
    participant R as RabbitMQ
    participant Pag as Pagos
    participant Pas as Pasarela (Stub)

    C->>P: POST /v1/pedidos
    P->>Cat: HTTP POST /reservar (Síncrono)
    Cat-->>P: 200 OK (Stock bloqueado)
    P->>R: Publica evento "cobros_solicitados"
    P-->>C: 202 Accepted (Pedido en proceso)
    
    R->>Pag: Consume "cobros_solicitados"
    Pag->>Pas: HTTP POST (Cobro)
    Pas-->>Pag: 200 OK (Aprobado)
    Pag->>R: Publica evento "cobros_resultados" (Aprobado)
    
    R->>P: Consume "cobros_resultados"
    P->>Cat: HTTP POST /consolidar
    Cat-->>P: 200 OK (Stock descontado final)
```

## 4. Secuencia de la Saga: Camino de Compensación (Fallo pasarela)
```mermaid
sequenceDiagram
    participant P as Pedidos
    participant Cat as Catálogo
    participant R as RabbitMQ
    participant Pag as Pagos
    participant Pas as Pasarela (Stub)

    P->>Cat: HTTP POST /reservar (Síncrono)
    Cat-->>P: 200 OK (Stock bloqueado)
    P->>R: Publica evento "cobros_solicitados"
    
    R->>Pag: Consume evento
    Pag->>Pas: HTTP POST (Cobro)
    Pas-->>Pag: 500 Error / Timeout (Circuit Breaker Abierto)
    Pag->>R: Publica evento "cobros_resultados" (Rechazado)
    
    R->>P: Consume resultado (Rechazado)
    P->>Cat: HTTP POST /liberar (Compensación)
    Cat-->>P: 200 OK (Stock devuelto)
    P->>P: Estado de pedido = "Rechazado"
```

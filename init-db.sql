-- 1. Esquema y tablas para CATÁLOGO
CREATE SCHEMA catalogo_db;
SET search_path TO catalogo_db;

CREATE TABLE sucursales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL
);

CREATE TABLE existencias (
    sucursal_id INT REFERENCES sucursales(id),
    producto_id INT REFERENCES productos(id),
    cantidad INT NOT NULL DEFAULT 0, -- Stock real
    reservado INT NOT NULL DEFAULT 0, -- Stock bloqueado por pedidos en proceso
    PRIMARY KEY (sucursal_id, producto_id)
);

-- Datos de prueba
INSERT INTO sucursales (nombre) VALUES ('Sucursal Central');
INSERT INTO productos (nombre, precio) VALUES ('Hamburguesa Doble', 45.00), ('Papas Fritas', 15.00);
INSERT INTO existencias (sucursal_id, producto_id, cantidad) VALUES (1, 1, 50), (1, 2, 100);

-- 2. Esquema y tablas para PEDIDOS
CREATE SCHEMA pedidos_db;
SET search_path TO pedidos_db;

CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL,
    sucursal_id INT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    correlation_id UUID UNIQUE NOT NULL -- Clave de idempotencia y trazabilidad
);

CREATE TABLE pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id),
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL
);

CREATE TABLE historial_estados (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id),
    estado VARCHAR(20) NOT NULL,
    motivo TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Esquema y tablas para PAGOS
CREATE SCHEMA pagos_db;
SET search_path TO pagos_db;

CREATE TABLE transacciones (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL,
    correlation_id UUID NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    estado VARCHAR(20) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
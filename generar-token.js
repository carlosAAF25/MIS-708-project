const jwt = require('jsonwebtoken');
const secret = 'examen_jwt_secret';

// Generar token para un cliente
const tokenCliente = jwt.sign({ id: 1, rol: 'cliente' }, secret, { expiresIn: '24h' });
console.log('Token Cliente (cópialo en Postman):', tokenCliente);
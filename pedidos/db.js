const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  // Fuerza a que este servicio solo vea sus propias tablas
  searchPath: [process.env.DB_SCHEMA, 'public'], 
});

module.exports = db;
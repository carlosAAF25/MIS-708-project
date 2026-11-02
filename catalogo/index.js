const express = require('express');
const app = express();

app.use(express.json());

// Endpoint de liveness/readiness para Docker
app.get('/health', (req, res) => res.status(200).json({ status: 'OK', service: 'Pedidos' }));

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Servicio de Catalogo iniciado en puerto ${PORT}`);
});
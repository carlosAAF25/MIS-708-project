const axios = require('axios');

async function ejecutarPruebas() {
    console.log('Iniciando pruebas automatizadas...');
    let pasaron = 0;

    try {
        // Prueba 1: Verificar Catálogo
        const resCat = await axios.get('http://localhost:3001/health');
        if (resCat.status === 200) { console.log('✅ Catálogo responde correctamente'); pasaron++; }

        // Prueba 2: Verificar Pedidos
        const resPed = await axios.get('http://localhost:3002/health');
        if (resPed.status === 200) { console.log('✅ Pedidos responde correctamente'); pasaron++; }

        // Prueba 3: Verificar que el Stub devuelve error rate configurado (probamos 1 vez)
        try {
            await axios.post('http://localhost:8080/pago', { monto: 100 });
            console.log('✅ Stub Pasarela responde correctamente');
            pasaron++;
        } catch (e) {
            if (e.response && (e.response.status === 500 || e.response.status === 503)) {
                console.log('✅ Stub Pasarela responde con el fallo simulado (Correcto)');
                pasaron++;
            }
        }

        console.log(`\n RESULTADO: ${pasaron}/3 pruebas superadas con éxito.`);
    } catch (error) {
        console.error(' Error en las pruebas:', error.message);
    }
}

ejecutarPruebas();
const express = require('express');
const app = express();

// Função de serviço fictícia para fins de demonstração
function service(req) {
    // Simula a obtenção de dados confidenciais
    return { segredo: "Este é um dado confidencial." };
}

app.get('/dados-confidenciais', (req, res) => {
    // Recupera o token do cabeçalho 'Authorization'
    const token = req.headers['authorization'];

    // Verifica se o token existe e é válido
    if (!token || token !== 'seu-token-secreto') {
        // Se não autorizado, retorna status 401 e uma mensagem genérica
        res.status(401).send('Não autorizado');
        return;
    }

    // Se autorizado, prossegue para executar o serviço
    const jsonData = service(req);

    // Retorna os dados
    res.json(jsonData);
});

// Inicia o servidor (para fins de teste)
app.listen(3000, () => {
    console.log('Servidor está executando na porta 3000');
});

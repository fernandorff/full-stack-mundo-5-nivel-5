const express = require('express');
const app = express();

app.use(express.json()); // Middleware para analisar o corpo das requisições em JSON

let users = []; // Lista de usuários registrados
let loginAttempts = {}; // Contador de tentativas de login por usuário

// Constantes de segurança
const TAMANHO_MINIMO_SENHA = 8;
const MAXIMO_TENTATIVAS_LOGIN = 5;

// Função fictícia para simular um serviço que retorna dados confidenciais
function service(req) {
    // Simula a obtenção de dados confidenciais
    return { segredo: "Este é um dado confidencial." };
}

// Função para gerar um token simples
function generateToken(username) {
    return Buffer.from(username).toString('base64');
}

// Função para verificar o token
function verifyToken(token) {
    // Em produção, verifique o token de forma adequada (por exemplo, usando JWT)
    try {
        const username = Buffer.from(token, 'base64').toString('ascii');
        const user = users.find(u => u.username === username);
        return !!user;
    } catch (err) {
        return false;
    }
}

// Endpoint para registro de usuário
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Verifica se o nome de usuário já está em uso
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: "Já existe usuário com esse nome." });
    }

    // Verifica se a senha atende ao tamanho mínimo
    if (password.length < TAMANHO_MINIMO_SENHA) {
        return res.status(400).json({ error: `A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` });
    }

    // Permite que o usuário utilize qualquer caractere como senha

    // Cria o novo usuário e salva
    users.push({ username, password }); // Em uma aplicação real, a senha deve ser armazenada de forma segura (hash)

    return res.json({ message: "Usuário registrado com sucesso." });
});

// Endpoint para login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Verifica se o usuário existe
    const user = users.find(u => u.username === username);

    // Mensagem de erro genérica para credenciais inválidas
    const errorMessage = "Usuário ou senha incorretos.";

    if (!user) {
        return res.status(401).json({ error: errorMessage });
    }

    // Incrementa o número de tentativas de login para este usuário
    if (!loginAttempts[username]) {
        loginAttempts[username] = 0;
    }
    loginAttempts[username]++;

    if (loginAttempts[username] > MAXIMO_TENTATIVAS_LOGIN) {
        return res.status(429).json({ error: "Número máximo de tentativas de login excedido. Por favor, tente novamente mais tarde." });
    }

    // Verifica as credenciais
    if (user.password !== password) {
        return res.status(401).json({ error: errorMessage });
    }

    // Se as credenciais são válidas, reseta as tentativas de login
    loginAttempts[username] = 0;

    // Gera um token (em produção, utilize um método seguro como JWT)
    const token = generateToken(username);

    // Retorna o token de autenticação
    return res.json({ message: "Login realizado com sucesso.", token });
});

// Endpoint protegido que retorna dados confidenciais
app.get('/dados-confidenciais', (req, res) => {
    // Recupera o token do cabeçalho 'Authorization'
    const token = req.headers['authorization'];

    // Verifica se o token existe e é válido
    if (!token || !verifyToken(token)) {
        // Se não autorizado, retorna status 401 e uma mensagem genérica
        res.status(401).send('Não autorizado');
        return;
    }

    // Se autorizado, prossegue para executar o serviço
    const jsonData = service(req);

    // Retorna os dados confidenciais
    res.json(jsonData);
});

// Inicia o servidor
app.listen(3000, () => {
    console.log('Servidor está executando na porta 3000');
});

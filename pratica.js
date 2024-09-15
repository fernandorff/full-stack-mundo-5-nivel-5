// Importações necessárias
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg'); // Cliente PostgreSQL

const app = express();

app.use(bodyParser.json());

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor está executando na porta ${port}`);
});

// Configuração do banco de dados PostgreSQL
const pool = new Pool({
  user: 'postgres', // substitua pelo seu usuário do PostgreSQL
  password: '123123', // substitua pela sua senha do PostgreSQL
  host: 'localhost', // substitua se o host for diferente
  database: 'estacio', // substitua pelo nome do seu banco de dados
  port: 5432, // porta padrão do PostgreSQL
});

// Chave secreta para assinatura do token JWT (em produção, use variáveis de ambiente)
const SECRET_KEY = 'sua_chave_secreta';

// Função para criar as tabelas se não existirem
async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        perfil VARCHAR(50) NOT NULL
      );
    `);

    console.log('Tabelas criadas ou já existentes.');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
  }
}

// Chama a função para criar as tabelas
createTables();

// Função para registrar um novo usuário
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, perfil } = req.body;

  // Verifica se o usuário já existe
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Nome de usuário já existe' });
    }

    // Hasheia a senha antes de armazenar
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insere o novo usuário no banco de dados
    const result = await pool.query(
      'INSERT INTO users (username, password, email, perfil) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, hashedPassword, email, perfil || 'user']
    );

    // Retorna os dados do usuário criado (exceto a senha)
    const newUser = result.rows[0];
    delete newUser.password;

    res.status(201).json({ message: 'Usuário registrado com sucesso', user: newUser });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Função para autenticar usuário e gerar token JWT
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Busca o usuário no banco de dados
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const userData = result.rows[0];

    // Verifica se a senha está correta
    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Gera o token JWT com o id do usuário e o perfil
    const payload = {
      id: userData.id,
      perfil: userData.perfil,
    };

    // Opcionalmente, você pode adicionar um tempo de expiração ao token
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Middleware para verificar o token JWT e o perfil do usuário
function authenticateToken(req, res, next) {
  // O token deve ser enviado no cabeçalho 'Authorization' no formato 'Bearer token'
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado' });
    }

    req.user = user;
    next();
  });
}

// Middleware para verificar se o usuário tem perfil 'admin'
function authorizeAdmin(req, res, next) {
  if (req.user.perfil !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado: usuário não possui privilégios de administrador' });
  }
  next();
}

// Endpoint para recuperação dos dados de todos os usuários cadastrados (somente admin)
app.get('/api/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, perfil FROM users');

    res.status(200).json({ data: result.rows });
  } catch (err) {
    console.error('Erro ao obter usuários:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Endpoint para recuperação dos dados do usuário logado (qualquer usuário autenticado)
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, perfil FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Erro ao obter perfil do usuário:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Função para criar a tabela 'contracts' se não existir
async function createContractsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id SERIAL PRIMARY KEY,
        empresa VARCHAR(255) NOT NULL,
        data_inicio DATE NOT NULL,
        detalhes TEXT
      );
    `);

    console.log('Tabela "contracts" criada ou já existente.');
  } catch (err) {
    console.error('Erro ao criar tabela "contracts":', err);
  }
}

// Chama a função para criar a tabela 'contracts'
createContractsTable();

// Endpoint para recuperação dos contratos existentes (somente admin)
app.get('/api/contracts', authenticateToken, authorizeAdmin, async (req, res) => {
  const { empresa, inicio } = req.query;

  try {
    // Sanitiza os parâmetros para prevenir injeção
    const sanitizedEmpresa = sanitizeInput(empresa);
    const sanitizedInicio = sanitizeInput(inicio);

    const result = await getContracts(sanitizedEmpresa, sanitizedInicio);

    if (result.length > 0) {
      res.status(200).json({ data: result });
    } else {
      res.status(404).json({ data: 'Dados não encontrados' });
    }
  } catch (err) {
    console.error('Erro ao obter contratos:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Função de sanitização de entrada
function sanitizeInput(input) {
  if (typeof input === 'string') {
    // Remove caracteres potencialmente perigosos
    return input.replace(/[^\w\s-]/gi, '');
  }
  return input;
}

// Função para recuperar contratos do banco de dados
async function getContracts(empresa, inicio) {
    try {
      let query = 'SELECT * FROM contracts';
      const params = [];
      const conditions = [];
  
      // Verifica se 'empresa' foi fornecida
      if (empresa) {
        conditions.push(`empresa = $${params.length + 1}`);
        params.push(empresa);
      }
  
      // Verifica se 'inicio' foi fornecida
      if (inicio) {
        conditions.push(`data_inicio = $${params.length + 1}`);
        params.push(inicio);
      }
  
      // Se houver condições, adiciona o WHERE
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
  
      const result = await pool.query(query, params);
  
      return result.rows;
    } catch (err) {
      console.error('Erro ao executar consulta de contratos:', err);
      throw err;
    }
  }
  

app.post('/api/contracts', authenticateToken, authorizeAdmin, async (req, res) => {
  const { empresa, data_inicio, detalhes } = req.body;

  try {
    // Valida os dados de entrada
    if (!empresa || !data_inicio) {
      return res.status(400).json({ message: 'Os campos "empresa" e "data_inicio" são obrigatórios' });
    }

    // Sanitiza os dados de entrada
    const sanitizedEmpresa = sanitizeInput(empresa);
    const sanitizedDataInicio = sanitizeInput(data_inicio);
    const sanitizedDetalhes = detalhes ? sanitizeInput(detalhes) : null;

    // Insere o novo contrato no banco de dados
    const result = await pool.query(
      'INSERT INTO contracts (empresa, data_inicio, detalhes) VALUES ($1, $2, $3) RETURNING *',
      [sanitizedEmpresa, sanitizedDataInicio, sanitizedDetalhes]
    );

    res.status(201).json({ message: 'Contrato criado com sucesso', contract: result.rows[0] });
  } catch (err) {
    console.error('Erro ao criar contrato:', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

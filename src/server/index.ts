import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranscriptionRepo } from './db.js';
import { createOpenAIClient } from './openaiClient.js';
import { basicAuthMiddleware } from './auth.js';
import { createRouter } from './routes.js';
import { resolveApiPort } from './port.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

const PORT = resolveApiPort(process.env);
const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
const AUTH_USER = requireEnv('AUTH_USER');
const AUTH_PASSWORD = requireEnv('AUTH_PASSWORD');
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../data/transcricoes.db');

const repo = createTranscriptionRepo(DB_PATH);
const openaiClient = createOpenAIClient(OPENAI_API_KEY);

const app = express();
app.use(
  '/api',
  basicAuthMiddleware(AUTH_USER, AUTH_PASSWORD),
  createRouter({ repo, transcribeChunk: openaiClient.transcribeChunk })
);

const clientDist = path.join(__dirname, '../../dist/client');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Rota não encontrada' });
    return;
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Transcritor rodando na porta ${PORT}`);
});

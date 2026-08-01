import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranscriptionRepo } from './db.js';
import { createOpenAIClient } from './openaiClient.js';
import { basicAuthMiddleware } from './auth.js';
import { createRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

const PORT = Number(process.env.PORT ?? 3001);
const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
const AUTH_USER = requireEnv('AUTH_USER');
const AUTH_PASSWORD = requireEnv('AUTH_PASSWORD');
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../data/transcricoes.db');

const repo = createTranscriptionRepo(DB_PATH);
const openaiClient = createOpenAIClient(OPENAI_API_KEY);

const app = express();
app.use(basicAuthMiddleware(AUTH_USER, AUTH_PASSWORD));
app.use('/api', createRouter({ repo, transcribeChunk: openaiClient.transcribeChunk }));

const clientDist = path.join(__dirname, '../../dist/client');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Transcritor rodando na porta ${PORT}`);
});

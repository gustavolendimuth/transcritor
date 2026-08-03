# Transcritor

Ferramenta pessoal para transcrever áudios via API da OpenAI (`whisper-1`
com tempo nas falas, ou `gpt-4o-transcribe` sem),
com histórico salvo em SQLite. Sem contas de usuário — protegida por HTTP
Basic Auth.

## Desenvolvimento local

    cp .env.example .env
    # preencher OPENAI_API_KEY, AUTH_USER, AUTH_PASSWORD em .env
    npm install
    npm run dev

Frontend em http://localhost:5173 (proxy para a API em :3001).

## Build e execução em produção

    npm run build
    npm start

## Variáveis de ambiente

- `OPENAI_API_KEY` — chave da API da OpenAI.
- `AUTH_USER` / `AUTH_PASSWORD` — credenciais do HTTP Basic Auth.
- `DB_PATH` — caminho do arquivo SQLite (padrão: `./data/transcricoes.db`).
- `PORT` — porta HTTP (padrão: 3001; Railway define automaticamente).

## Deploy no Railway

Requer um volume persistente montado (ex: em `/data`) e `DB_PATH` apontando
para dentro dele, para que o histórico sobreviva a reinicializações. Ver
`docs/superpowers/specs/2026-08-01-transcritor-design.md` para o design
completo.

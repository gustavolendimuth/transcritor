# Transcritor

Ferramenta pessoal para transcrever áudios e vídeos via API da OpenAI
(`whisper-1` com tempo nas falas, ou `gpt-4o-transcribe` sem), com histórico
salvo em SQLite. Em vídeos, somente o áudio é extraído; a compatibilidade dos
formatos depende do FFmpeg. A mídia enviada é excluída após o processamento,
sem retenção própria. Sem contas de usuário — protegida por HTTP Basic Auth.

O aplicativo não impõe um limite próprio de tamanho ou duração dos arquivos,
mas a hospedagem pode impor limites de upload, tempo de processamento ou
armazenamento temporário.

## Desenvolvimento local

    cp .env.example .env
    # preencher OPENAI_API_KEY, AUTH_USER, AUTH_PASSWORD em .env
    npm install
    npm run dev

Frontend em http://localhost:5173 (proxy para a API local em :3011). A porta
da API local é configurada por `API_PORT`; `VITE_PORT` configura a porta do
frontend.

Para usar outra porta no frontend durante o desenvolvimento local:

    VITE_PORT=5174 npm run dev

## Desenvolvimento com Docker

    cp .env.example .env
    # preencher OPENAI_API_KEY, AUTH_USER e AUTH_PASSWORD em .env
    docker compose up --build

Abra http://localhost:5173. O frontend e a API recarregam ao alterar arquivos
em `src/`; o SQLite fica em `./data`. Para publicar o frontend em outra porta,
use, por exemplo:

    VITE_PORT=5174 docker compose up --build

O Compose mantém a API publicada em `3011:3011`. Para recriar dependências do
container, execute `docker compose down -v` e depois `docker compose up --build`.

## Build e execução em produção

    npm run build
    npm start

## Variáveis de ambiente

- `OPENAI_API_KEY` — chave da API da OpenAI.
- `AUTH_USER` / `AUTH_PASSWORD` — credenciais do HTTP Basic Auth.
- `DB_PATH` — caminho do arquivo SQLite (padrão: `./data/transcricoes.db`).
- `API_PORT` — porta da API no desenvolvimento local (padrão: `3011`).
- `VITE_PORT` — porta do frontend Vite e do mapeamento correspondente no
  Docker Compose (padrão: `5173`).
- `PORT` — reservado à porta HTTP injetada pelo Railway; quando presente, tem
  prioridade sobre `API_PORT`.

## Deploy no Railway

Requer um volume persistente montado (ex: em `/data`) e `DB_PATH` apontando
para dentro dele, para que o histórico sobreviva a reinicializações. Ver
`docs/superpowers/specs/2026-08-01-transcritor-design.md` para o design
completo.

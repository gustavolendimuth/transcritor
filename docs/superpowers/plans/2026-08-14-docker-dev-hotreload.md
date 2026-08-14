# Docker de Desenvolvimento com Hot Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir executar frontend e API do Transcritor em Docker Compose com hot reload e SQLite persistente.

**Architecture:** Um único serviço Compose monta o repositório e executa o script existente `npm run dev`, que inicia Vite e `tsx watch`. A imagem de desenvolvimento baseada em Node 22 instala FFmpeg e ferramentas nativas; volumes separados preservam `node_modules` Linux e `./data` no host.

**Tech Stack:** Docker Compose, Dockerfile Debian Node 22, FFmpeg, npm, Vite 5, tsx, SQLite/better-sqlite3.

## Global Constraints

- Manter Railway/Nixpacks e o fluxo de produção inalterados.
- Usar Node 22 e instalar FFmpeg na imagem de desenvolvimento.
- Persistir o banco em `./data` com `DB_PATH=./data/transcricoes.db`.
- Não copiar `.env` ou arquivos de dados para a imagem.
- Expor Vite na porta 5173 e API na porta 3011.

---

## File Structure

- `Dockerfile.dev`: imagem de desenvolvimento com dependências de sistema e
  ponto de entrada que inicializa dependências no volume.
- `docker-compose.yml`: serviço `app`, portas, bind mounts, volume nomeado e
  variáveis de ambiente para o desenvolvimento.
- `.dockerignore`: exclui dependências, build, dados e segredos do contexto
  Docker.
- `vite.config.ts`: faz o servidor Vite escutar em interface publicável pelo
  Docker sem alterar o proxy de API atual.
- `README.md`: documenta a inicialização, URLs e recuperação do volume de
  dependências.

### Task 1: Imagem e orquestração de desenvolvimento

**Files:**
- Create: `Dockerfile.dev`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `package.json` com `npm run dev`, `.env` com credenciais locais e
  `./data` como diretório persistente no host.
- Produces: serviço Compose `app` acessível em `localhost:5173` e
  `localhost:3011`, com o volume nomeado `node_modules` montado em
  `/app/node_modules`.

- [ ] **Step 1: Criar a imagem de desenvolvimento**

Criar `Dockerfile.dev` com Node 22 Bookworm, FFmpeg e ferramentas necessárias
para módulos nativos, copiando somente os manifests antes de instalar as
dependências. Usar um comando de inicialização que instala dependências quando
`/app/node_modules/.package-lock.json` não existir e, então, executa `npm run dev`.

```dockerfile
FROM node:22-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

CMD ["sh", "-c", "test -f node_modules/.package-lock.json || npm ci && npm run dev"]
```

- [ ] **Step 2: Criar a definição do Compose e o contexto mínimo**

Criar `docker-compose.yml` que constrói `Dockerfile.dev`, carrega `.env`,
publica ambas as portas, monta o repositório e `./data`, e mantém
`/app/node_modules` em volume nomeado. Criar `.dockerignore` para remover
artefatos locais e segredos do contexto de build.

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file: .env
    environment:
      DB_PATH: ./data/transcricoes.db
    ports:
      - "5173:5173"
      - "3011:3011"
    volumes:
      - .:/app
      - ./data:/app/data
      - node_modules:/app/node_modules

volumes:
  node_modules:
```

```gitignore
node_modules
dist
data
.env
.git
*.log
```

- [ ] **Step 3: Validar a configuração estática**

Run: `docker compose config`

Expected: saída YAML resolvida com o serviço `app`, ambos os mapeamentos de
porta, `DB_PATH=./data/transcricoes.db` e o volume `node_modules`; nenhuma
variável secreta precisa aparecer no arquivo.

- [ ] **Step 4: Fazer commit da configuração de contêiner**

```bash
git add Dockerfile.dev docker-compose.yml .dockerignore
git commit -m "chore: add Docker development environment"
```

### Task 2: Rede do Vite e documentação operacional

**Files:**
- Modify: `vite.config.ts:9-13`
- Modify: `README.md:11-17`

**Interfaces:**
- Consumes: serviço Compose `app` da Task 1, com portas 5173 e 3011 publicadas.
- Produces: Vite disponível no host em `http://localhost:5173`, mantendo o
proxy `/api` para `http://localhost:3011`, e instruções reproduzíveis de uso.

- [ ] **Step 1: Ajustar o listener do Vite para o container**

Adicionar `host: '0.0.0.0'` à seção `server` sem modificar o proxy atual.

```ts
server: {
  host: '0.0.0.0',
  proxy: {
    '/api': 'http://localhost:3011',
  },
},
```

- [ ] **Step 2: Documentar o fluxo Docker de desenvolvimento**

Acrescentar ao README a sequência abaixo após as instruções de desenvolvimento
local, deixando claro que `.env` deve existir e que o banco persiste em
`./data`.

```markdown
## Desenvolvimento com Docker

    cp .env.example .env
    # preencher OPENAI_API_KEY, AUTH_USER e AUTH_PASSWORD em .env
    docker compose up --build

Abra http://localhost:5173. O frontend e a API recarregam ao alterar arquivos
em `src/`; o SQLite fica em `./data`. Para recriar dependências do container,
execute `docker compose down -v` e depois `docker compose up --build`.
```

- [ ] **Step 3: Fazer a verificação de tipos sem Docker**

Run: `npm run typecheck`

Expected: saída do TypeScript sem erros; a configuração Vite continua válida.

- [ ] **Step 4: Fazer commit da compatibilidade e documentação**

```bash
git add vite.config.ts README.md
git commit -m "docs: explain Docker development workflow"
```

### Task 3: Verificação de execução e persistência

**Files:**
- Modify: `README.md` somente se os comandos reais ou URLs divergirem do
  documentado.

**Interfaces:**
- Consumes: configuração de Docker da Task 1 e listener Vite da Task 2.
- Produces: evidência de que os processos iniciam, portas respondem, o watcher
  observa mudanças e `./data` não é apagado na recriação do serviço.

- [ ] **Step 1: Construir e iniciar o ambiente**

Run: `docker compose up --build -d`

Expected: o serviço `app` permanece em execução e os logs mostram o Vite em
`0.0.0.0:5173` e a API na porta 3011.

- [ ] **Step 2: Verificar frontend e API**

Run: `curl --fail http://localhost:5173/ && curl --fail -u "$AUTH_USER:$AUTH_PASSWORD" http://localhost:3011/api/history`

Expected: ambos os comandos retornam HTTP 2xx. A verificação da API usa
`GET /api/history`, rota autenticada já definida em `src/server/routes.ts`;
ela retorna uma lista vazia quando o banco ainda não tem transcrições.

- [ ] **Step 3: Verificar hot reload e persistência**

Criar temporariamente `data/.docker-dev-persistence-check`, executar
`docker compose restart app`, e confirmar que o arquivo permanece. Alterar
temporariamente uma linha inócua de `src/client/style.css` e uma de
`src/server/index.ts`, inspecionando `docker compose logs app` após cada
alteração para confirmar respectivamente a atualização do Vite e o reinício do
`tsx watch`. Reverter exatamente essas duas alterações temporárias e remover
o arquivo de verificação.

```bash
docker compose logs --tail=100 app
git diff -- src/client/style.css src/server/index.ts
```

Expected: logs evidenciam ambos os watchers, o diff dos arquivos fonte fica
vazio e não resta arquivo temporário em `data`.

- [ ] **Step 4: Encerrar o serviço e registrar quaisquer correções**

Run: `docker compose down`

Expected: o container é removido, enquanto `./data` e o volume nomeado de
dependências permanecem. Se uma correção em `README.md` foi necessária,
commitá-la explicitamente:

```bash
git add README.md
git commit -m "docs: correct Docker development instructions"
```

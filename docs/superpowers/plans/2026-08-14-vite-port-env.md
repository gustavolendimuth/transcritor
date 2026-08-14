# Porta configurável do Vite por variável de ambiente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar a porta do Vite por `VITE_PORT`, mantendo a API local em `API_PORT` e o `PORT` injetado pelo Railway como prioridade.

**Architecture:** A configuração do Vite carrega `.env` explicitamente e aplica `VITE_PORT`, com fallback para 5173. O Compose usa essa mesma variável nos dois lados do mapeamento; a API escolhe `PORT`, depois `API_PORT`, depois 3011, para que Railway continue sendo compatível.

**Tech Stack:** Vite 5, TypeScript, Node.js/Express, Docker Compose, Vitest.

## Global Constraints

- `PORT` fornecido pelo Railway tem precedência sobre `API_PORT`.
- `API_PORT` permanece local e o Docker de desenvolvimento mantém a API em 3011.
- `VITE_PORT` tem padrão 5173 e configura a mesma porta no Vite e no host Docker.
- O proxy Vite `/api` permanece em `http://localhost:3011`.
- Railway, Nixpacks, build de produção e portas do build estático permanecem inalterados.

---

## File Structure

- `vite.config.ts`: carrega `VITE_PORT` de `.env` e configura `server.port`.
- `docker-compose.yml`: substitui o mapeamento fixo do Vite por `VITE_PORT`
  com fallback, preservando o mapeamento 3011 da API.
- `src/server/index.ts`: resolve a porta da API na prioridade compatível com
  Railway.
- `tests/server/index.test.ts`: verifica a ordem de resolução de porta sem
  iniciar o servidor real.
- `README.md`: documenta `VITE_PORT`, `API_PORT` e os exemplos locais/Docker.

### Task 1: Resolução de portas de API e Vite

**Files:**
- Modify: `src/server/index.ts`
- Modify: `vite.config.ts`
- Create: `tests/server/index.test.ts`

**Interfaces:**
- Produces: `resolveApiPort(env: NodeJS.ProcessEnv): number`, que retorna
  `PORT`, depois `API_PORT`, depois `3011`.
- Produces: configuração Vite com `server.port` obtida de `VITE_PORT` e
  fallback `5173`.

- [ ] **Step 1: Escrever o teste que falha para a prioridade da API**

Criar `tests/server/index.test.ts`, extraindo a resolução de porta para um
módulo sem efeitos de inicialização se necessário. O teste deve provar o
comportamento observável: quando ambas existem, a porta fornecida pelo Railway
vence a configuração local.

```ts
import { describe, expect, it } from 'vitest';
import { resolveApiPort } from '../../src/server/port.js';

describe('resolveApiPort', () => {
  it('prefers Railway PORT over local API_PORT', () => {
    expect(resolveApiPort({ PORT: '9999', API_PORT: '3011' })).toBe(9999);
  });

  it('uses API_PORT locally and falls back to 3011', () => {
    expect(resolveApiPort({ API_PORT: '3012' })).toBe(3012);
    expect(resolveApiPort({})).toBe(3011);
  });
});
```

- [ ] **Step 2: Executar o teste para confirmar a falha**

Run: `npx vitest run tests/server/index.test.ts`

Expected: FAIL porque `src/server/port.ts` e `resolveApiPort` ainda não
existem.

- [ ] **Step 3: Implementar a resolução de porta e conectá-la à API**

Criar `src/server/port.ts` e trocar a resolução atual em `src/server/index.ts`
pela função exportada, sem alterar o host de escuta da Express.

```ts
export function resolveApiPort(env: NodeJS.ProcessEnv): number {
  return Number(env.PORT ?? env.API_PORT ?? 3011);
}
```

- [ ] **Step 4: Configurar a porta do Vite a partir de `.env`**

Em `vite.config.ts`, usar `loadEnv` para carregar variáveis sem filtro e
definir `server.port` por `Number(env.VITE_PORT ?? 5173)`, preservando
`host: '0.0.0.0'` e o proxy atual.

```ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'src/client',
    build: {
      outDir: '../../dist/client',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT ?? 5173),
      proxy: { '/api': 'http://localhost:3011' },
    },
  };
});
```

- [ ] **Step 5: Verificar o teste e tipos**

Run: `npx vitest run tests/server/index.test.ts && npm run typecheck`

Expected: os dois testes de `resolveApiPort` passam e TypeScript não reporta
erros.

- [ ] **Step 6: Fazer commit da resolução de portas**

```bash
git add src/server/port.ts src/server/index.ts vite.config.ts tests/server/index.test.ts
git commit -m "feat: configure development ports from environment"
```

### Task 2: Mapeamento Docker e documentação

**Files:**
- Modify: `docker-compose.yml:9-11`
- Modify: `README.md:17-43`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `VITE_PORT` do `.env` e `server.port` da Task 1.
- Produces: Docker publica `${VITE_PORT:-5173}:${VITE_PORT:-5173}` e a
documentação orienta uso consistente de `API_PORT` e `VITE_PORT`.

- [ ] **Step 1: Tornar o mapeamento do Vite configurável**

Substituir somente o primeiro mapeamento de `ports`, preservando `3011:3011`.

```yaml
ports:
  - "${VITE_PORT:-5173}:${VITE_PORT:-5173}"
  - "3011:3011"
```

- [ ] **Step 2: Documentar as portas configuráveis**

Atualizar README e `.env.example` com valores e explicação precisos:

```env
API_PORT=3011
VITE_PORT=5173
```

Explicar que `API_PORT` é para desenvolvimento local, `VITE_PORT` determina a
URL do frontend e o mapeamento Docker, e `PORT` é reservado ao Railway. Usar
`VITE_PORT=5174 docker compose up --build` como exemplo Docker e
`VITE_PORT=5174 npm run dev` como exemplo local.

- [ ] **Step 3: Validar as configurações padrão e personalizada**

Se `.env` não existir, criar temporariamente a partir de `.env.example`; não
sobrescrever um `.env` existente. Executar:

```bash
docker compose config --quiet
VITE_PORT=5174 docker compose config | rg -F '5174:5174'
```

Expected: ambas passam; a segunda saída contém `5174:5174` para o serviço
`app`, enquanto a porta da API continua `3011:3011`. Remover somente o `.env`
temporário criado por esta etapa.

- [ ] **Step 4: Fazer commit do Compose e documentação**

```bash
git add docker-compose.yml README.md .env.example
git commit -m "docs: configure Vite port through environment"
```

### Task 3: Validação de execução configurada

**Files:**
- Modify: `README.md` somente se a execução revelar divergência da
  documentação.

**Interfaces:**
- Consumes: `VITE_PORT=5174`, `API_PORT=3011` e a configuração das Tasks 1 e 2.
- Produces: evidência de que Vite atende em 5174, a API atende em 3011 e o
  proxy `/api` permanece funcional.

- [ ] **Step 1: Criar configuração temporária e iniciar Docker**

Criar temporariamente `.env` contendo credenciais de teste, `API_PORT=3011` e
`VITE_PORT=5174`. Executar:

```bash
docker compose up --build -d
```

Expected: `docker compose ps` mostra `5174->5174` e `3011->3011`.

- [ ] **Step 2: Esperar pela API e verificar as duas portas**

Usar polling com limite de 30 segundos para `GET /api/history` autenticado em
`http://localhost:3011`; então verificar o frontend em
`http://localhost:5174/`.

```bash
curl --fail -u docker-dev:docker-dev http://localhost:3011/api/history
curl --fail http://localhost:5174/
```

Expected: API retorna HTTP 2xx (lista JSON) e frontend retorna HTTP 2xx.

- [ ] **Step 3: Confirmar o proxy Vite e limpar o ambiente temporário**

Requisitar `http://localhost:5174/api/history` com autenticação e confirmar a
resposta da API. Remover a `.env` temporária, executar `docker compose down`,
remover somente o banco temporário criado em `data/` e reverter qualquer
edição temporária. Não remover o volume nomeado `node_modules`.

- [ ] **Step 4: Executar a suíte completa e fazer commit documental, se necessário**

Run: `npm test && npm run typecheck && npm run build`

Expected: suíte, typecheck e build passam. Se a execução exigir corrigir
README, fazer commit explícito apenas desse arquivo:

```bash
git add README.md
git commit -m "docs: correct configurable Vite port instructions"
```

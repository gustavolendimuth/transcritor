# Porta configurável do Vite por variável de ambiente

## Objetivo

Permitir escolher a porta do frontend de desenvolvimento por `.env`, mantendo
a API Express independente na porta definida por `PORT`.

## Variáveis e comportamento

- `API_PORT` configura a API Express local, com padrão `3011`.
- `PORT` permanece reservado ao valor injetado automaticamente pelo Railway e
  tem prioridade sobre `API_PORT` em produção.
- `VITE_PORT` configura o servidor Vite, com padrão `5173`.
- Com `VITE_PORT=5174`, tanto `npm run dev` quanto Docker Compose deixam o
  frontend disponível em `http://localhost:5174`.
- Sem `VITE_PORT`, o comportamento atual permanece: Vite em `5173` e API em
  `3011`.

## Implementação

`vite.config.ts` carregará explicitamente as variáveis de `.env` durante a
avaliação da configuração e definirá `server.port` a partir de `VITE_PORT`.
Isso evita depender de detalhes implícitos de como Vite disponibiliza `.env`
para o processo de configuração.

`docker-compose.yml` usará a mesma expressão com fallback dos dois lados do
mapeamento de porta: `${VITE_PORT:-5173}:${VITE_PORT:-5173}`. Assim, a porta
publicada pelo host coincide com a porta em que o Vite escuta dentro do
container.

O proxy `/api` continuará apontando para `http://localhost:3011` dentro do
container, sem relação com `VITE_PORT`.

`src/server/index.ts` escolherá a porta da API na ordem
`PORT`, `API_PORT`, `3011`. Dessa forma, renomear a variável local não altera
o contrato exigido pelo Railway; o deploy continua escutando na porta que a
plataforma fornece.

## Documentação e verificação

O README explicará `VITE_PORT`, a separação entre as duas portas e exemplos
para execução local e Docker.

Verificar:

1. a configuração padrão ainda resolve Vite em `5173`;
2. `VITE_PORT=5174` faz Vite escutar e Compose publicar `5174`;
3. a API continua acessível em `3011` e o proxy `/api` funciona pelo frontend;
4. com `PORT=9999` e `API_PORT=3011`, a API prefere `9999`;
5. typecheck e testes existentes continuam passando.

## Fora de escopo

Não torna a porta da API configurável no Docker, não altera o comportamento
de produção/Railway além de preservar seu contrato de `PORT`, nem altera a
porta usada pelo build estático.

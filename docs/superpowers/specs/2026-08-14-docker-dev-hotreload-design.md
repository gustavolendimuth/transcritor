# Docker de desenvolvimento com hot reload

## Objetivo

Permitir desenvolver o Transcritor inteiramente em Docker, com atualização
automática do frontend e da API, sem perder o banco SQLite local.

## Arquitetura

Um único serviço `app` no Docker Compose executa `npm run dev`, que inicia:

- a API Express pelo `tsx watch`, na porta 3011;
- o Vite, na porta 5173, que encaminha `/api` para a API no mesmo container.

O container será construído por um `Dockerfile.dev` baseado em Node 22 sobre
Debian. Ele instala FFmpeg — necessário ao processamento de vídeos — e as
ferramentas de compilação exigidas por `better-sqlite3`.

## Volumes e configuração

- O diretório do projeto será montado em `/app`, portanto alterações locais
  ficam disponíveis imediatamente ao Vite e ao `tsx watch`.
- `node_modules` será um volume nomeado. Isso preserva as dependências Linux
  compiladas no container e impede que o bind mount do código as substitua.
- `./data` será montado em `/app/data`; com `DB_PATH=./data/transcricoes.db`,
  o histórico SQLite persiste mesmo se o container for recriado.
- `.env` continuará sendo a fonte das credenciais e configurações locais. O
  Compose a carregará sem incluir segredos na imagem.

## Rede e uso

O Compose publicará as portas 5173 e 3011. O acesso de desenvolvimento será
por `http://localhost:5173`; a porta 3011 ficará disponível para testar a API
diretamente. Vite e o watcher da API devem escutar em todas as interfaces do
container para que as portas publicadas funcionem no host.

O comando de uso será `docker compose up --build`. Na primeira execução, o
serviço instala dependências no volume nomeado antes de iniciar os processos
de desenvolvimento. Execuções posteriores reutilizam esse volume.

## Tratamento de falhas

Falhas de instalação ou de compilação fazem o container encerrar com o erro
visível no Compose. Caso o volume de dependências fique incompatível após uma
alteração relevante de `package-lock.json`, a documentação indicará remover
apenas o volume nomeado do projeto e reconstruir. A ausência ou invalidade das
variáveis de `.env` continua sendo reportada pela própria aplicação.

## Verificação

Após a implementação, validar:

1. `docker compose config` aceita a configuração;
2. o build instala FFmpeg e dependências nativas corretamente;
3. `docker compose up --build` disponibiliza Vite e a API;
4. uma alteração em `src/client` recarrega o frontend e uma em `src/server`
   reinicia a API;
5. um arquivo criado em `./data` permanece após recriar o container.

## Fora de escopo

Não altera a imagem/configuração de produção do Railway, autenticação,
endpoints ou o formato do banco.

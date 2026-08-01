# Transcritor — Design

## Contexto

Ferramenta pessoal para transcrever áudios (ex: PTTs do WhatsApp) usando a API
da OpenAI (`gpt-4o-transcribe`), acessível via navegador, com deploy no
Railway. Sem depender de infraestrutura externa de banco de dados — histórico
persistido em SQLite local (volume do Railway).

Nasceu de um fluxo manual (compressão + chunking com ffmpeg + chamadas
`curl` à API) repetido em conversas anteriores; o objetivo é automatizar esse
fluxo numa interface web de uso próprio.

## Arquitetura

Serviço único Node.js/TypeScript (Express):

- Serve o frontend estático (build Vite: HTML + CSS + TS vanilla, sem
  framework de UI)
- Expõe API REST para upload, transcrição e histórico
- Executa `ffmpeg`/`ffprobe` localmente para pré-processar áudio
- Persiste histórico em SQLite (`better-sqlite3`) num volume do Railway
- Protege o serviço inteiro com HTTP Basic Auth (usuário/senha via variáveis
  de ambiente)

```
projetos/transcritor/
├── src/
│   ├── server/
│   │   ├── index.ts       # bootstrap do Express
│   │   ├── auth.ts        # middleware Basic Auth
│   │   ├── db.ts          # setup better-sqlite3 + schema
│   │   ├── audio.ts       # decide/realiza compressão e chunking (ffmpeg)
│   │   ├── transcribe.ts  # chamadas à API da OpenAI
│   │   └── routes.ts      # /api/transcribe, /api/history, /api/history/:id
│   └── client/
│       ├── index.html
│       ├── main.ts
│       └── style.css
├── nixpacks.toml          # inclui pacote ffmpeg
├── railway.json
├── package.json
└── tsconfig.json
```

## Fluxo de dados

1. **Upload** — usuário arrasta/seleciona um áudio na página →
   `POST /api/transcribe` (multipart, limite de 100MB por arquivo).
2. **Pré-processamento** (`audio.ts`) — `ffprobe` mede duração e tamanho do
   arquivo recebido. Se o arquivo exceder 25MB **ou** 10 minutos de duração
   (faixa onde observamos truncamento da resposta do modelo), o servidor:
   - converte para Opus mono, 32kbps (ogg)
   - divide em segmentos de 5 minutos (`ffmpeg -f segment`)
   Caso contrário, envia o arquivo original diretamente.
3. **Transcrição** (`transcribe.ts`) — cada segmento (ou o arquivo original)
   é enviado à OpenAI (`POST /v1/audio/transcriptions`, modelo
   `gpt-4o-transcribe`); os textos retornados são concatenados na ordem dos
   segmentos.
4. **Persistência** (`db.ts`) — se a transcrição for concluída com sucesso,
   salva `{ id, filename, text, duration_seconds, created_at }` no SQLite.
5. **Resposta** — retorna o texto completo ao navegador. O frontend exibe:
   - caixa de texto com o resultado
   - botão "copiar"
   - botão "baixar .txt" (nome baseado no arquivo original)
6. **Histórico** — `GET /api/history` lista transcrições salvas (mais
   recentes primeiro). Clicar num item reexibe o texto. Botão de excluir
   remove o registro (`DELETE /api/history/:id`).

Arquivos temporários (original e segmentos) são apagados ao final do
processamento, tanto em caso de sucesso quanto de erro.

## Tratamento de erros

- Formato de áudio não suportado pelo ffmpeg → `400` com mensagem clara
  ("formato não suportado").
- Falha na chamada à OpenAI (rate limit, chave inválida, timeout) → `502`
  com mensagem amigável; nada é salvo no histórico.
- Falha num segmento intermediário (ex: segmento 3 de 4) → aborta o
  processamento inteiro, informa qual segmento falhou; não salva
  transcrição parcial.
- Requisição sem credenciais válidas → `401` (prompt nativo do navegador via
  HTTP Basic Auth).

## Testes

Escopo enxuto, adequado a uma ferramenta pessoal de uso simples:

- Testes unitários da lógica de decisão de compressão/chunking em
  `audio.ts` (dado tamanho/duração de entrada, decide se comprime e em
  quantos segmentos divide) — sem invocar o ffmpeg de fato, apenas a lógica
  de decisão.
- Teste de integração do endpoint `/api/history` (criar, listar, excluir no
  SQLite).
- Sem testes E2E automatizados — verificação manual no navegador antes de
  considerar a implementação concluída.

## Fora de escopo (YAGNI)

- Contas de usuário / múltiplos usuários (autenticação é uma senha
  compartilhada única).
- Fila de processamento assíncrono (transcrição é síncrona; aceitável para
  uso pessoal com poucos áudios por vez).
- Gravação de áudio via microfone no navegador (apenas upload de arquivo).
- Suporte a múltiplos idiomas configurável na UI (a API detecta o idioma
  automaticamente).

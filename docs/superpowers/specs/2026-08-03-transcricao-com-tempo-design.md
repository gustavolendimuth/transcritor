# Transcrição com tempo das falas — Design

## Contexto

Hoje o Transcritor gera texto puro via `gpt-4o-transcribe`, sem nenhuma
marcação de tempo. A ideia original era exportar `.srt`, mas a decisão final
foi mais simples: quando o usuário quiser, o próprio texto transcrito passa a
trazer o tempo de cada trecho falado embutido, como `[HH:MM:SS] texto`. Não
existe formato de legenda separado — é sempre um `.txt`, com ou sem os
marcadores de tempo.

Ver [2026-08-01-transcritor-design.md](./2026-08-01-transcritor-design.md)
para o desenho geral do serviço.

## Decisões

- **Um único artefato de saída.** Não há dois arquivos nem dois formatos: o
  campo `text` (já existente, sem mudança de schema no banco) contém a
  transcrição pronta, com ou sem tempo, dependendo da opção escolhida no
  upload. Um único botão "Baixar .txt" continua funcionando sem alteração.
- **Opção marcada por padrão.** O checkbox "Adicionar tempo às falas" vem
  marcado ao carregar a página — esse é o modo padrão de uso.
- **Modelo por modo:**
  - Com tempo → `whisper-1` (único modelo da OpenAI que retorna
    `segments` com timestamps via `response_format: 'verbose_json'`).
  - Sem tempo → `gpt-4o-transcribe`, como hoje.
- **Idioma selecionável.** Dropdown com Português (padrão), Inglês e
  Espanhol, sempre visível, valendo para os dois modos — o parâmetro
  `language` (`pt`/`en`/`es`) é enviado à OpenAI em ambos os modelos para
  melhorar a precisão (evita autodetecção).
- **Granularidade do tempo:** por segmento/frase, como o `whisper-1` já
  retorna nativamente — sem quebrar em nível de palavra.

## Fluxo de dados

1. **Upload** — usuário escolhe o áudio. Dois controles novos na seção de
   upload:
   - Checkbox "Adicionar tempo às falas" (marcado por padrão). Texto de
     ajuda: *"Adiciona o tempo de cada trecho falado ao texto. Isso usa
     outro modelo de transcrição e pode reduzir um pouco a qualidade — se
     notar isso, tente novamente sem marcar esta opção."*
   - Dropdown de idioma (Português / Inglês / Espanhol, padrão Português).
   - Ao enviar, o client inclui `withTimestamps` (`'true'`/`'false'`) e
     `language` (`'pt'`/`'en'`/`'es'`) no `FormData` de
     `POST /api/transcribe`.
2. **Rota** (`routes.ts`) — lê `withTimestamps` e `language` de `req.body`
   (multer já popula campos de texto do multipart) e repassa para
   `transcribeUpload`.
3. **Pré-processamento** (`audio.ts`) — inalterado: decide compressão/chunking
   por tamanho/duração, como hoje.
4. **Transcrição** (`transcribeService.ts`) — para cada chunk, chama
   `transcribeChunk(chunkPath, { withTimestamps, language })`:
   - **Sem tempo:** concatena os textos dos chunks com espaço, igual a hoje.
   - **Com tempo:** cada chamada retorna `segments` (`{ start, text }[]`)
     relativos ao início do próprio chunk. O serviço mantém um offset
     acumulado em segundos (soma da duração real de cada chunk anterior,
     obtida via `getAudioInfo` — evita deriva por arredondamento do
     `ffmpeg`), soma esse offset ao `start` de cada segmento, formata cada
     um como `[HH:MM:SS] texto` (uma linha por segmento) e junta todas as
     linhas com `\n`. Esse resultado final é o `text` salvo.
5. **Chamada à OpenAI** (`openaiClient.ts`):
   - `withTimestamps=false` → `model: 'gpt-4o-transcribe'`, `language`,
     retorna `{ text }` — mesmo comportamento de hoje, só ganhou o
     parâmetro de idioma.
   - `withTimestamps=true` → `model: 'whisper-1'`,
     `response_format: 'verbose_json'`, `language`, retorna
     `{ text, segments: { start, text }[] }` (usa só os campos `start` e
     `text` de cada segmento retornado pela API).
6. **Persistência** (`db.ts`) — **sem mudança de schema.** O `text` salvo já
   é a versão final (com ou sem tempo embutido).
7. **Resposta / UI** — `resultText.value = record.text` e o botão único
   "Baixar .txt" já funcionam sem alteração, pois o conteúdo já vem pronto
   do servidor.

## Componentes afetados

- `src/client/index.html` — checkbox + dropdown de idioma na seção de
  upload.
- `src/client/main.ts` — lê os dois controles e inclui no `FormData` antes
  de enviar; nenhuma mudança na exibição do resultado ou no download.
- `src/server/routes.ts` — lê `withTimestamps`/`language` do body e repassa.
- `src/server/transcribeService.ts` — recebe as opções, acumula offset entre
  chunks e formata as linhas com tempo quando aplicável.
- `src/server/openaiClient.ts` — `TranscribeChunkFn` passa a aceitar
  `{ withTimestamps, language }` e retornar `{ text, segments? }`; branch de
  modelo/response_format.
- `src/server/db.ts` — **sem alteração.**

## Tratamento de erros

- Falha na chamada à OpenAI (rate limit, chave inválida, timeout) continua
  tratada como hoje: `TranscriptionApiError` → `502`, nada é salvo.
- Falha num chunk intermediário continua abortando o processamento inteiro
  (sem transcrição parcial salva) — comportamento inalterado.
- Não existe mais estado "parcial" possível em relação a tempo (ex.:
  segments ausentes numa transcrição que deveria ter): como tudo vira texto
  simples antes de salvar, não há um campo separado que possa ficar
  inconsistente.

## Testes

- `tests/server/transcribeService.test.ts` — formatação de linha com tempo
  (`[HH:MM:SS] texto`) e cálculo correto do offset acumulado entre chunks
  com durações diferentes; caso sem tempo permanece coberto pelos testes
  existentes (adaptando os mocks de `transcribeChunk` para a nova
  assinatura/retorno).
- `tests/server/openaiClient.test.ts` (novo) — branch de modelo e
  parâmetros (`model`, `response_format`, `language`) conforme as opções
  recebidas, usando mock do SDK da OpenAI.
- `tests/server/routes.test.ts` — repasse correto de `withTimestamps` e
  `language` do corpo da requisição para `transcribeUpload`.

## Fora de escopo (YAGNI)

- Exportação em formato `.srt`/`.vtt` — decisão explícita de manter sempre
  `.txt`.
- Timestamps em nível de palavra.
- Detecção automática de outros idiomas além dos três oferecidos no
  dropdown.
- Indicador visual no histórico mostrando se uma transcrição antiga tem
  tempo embutido ou não — o próprio texto já deixa isso claro ao abrir.

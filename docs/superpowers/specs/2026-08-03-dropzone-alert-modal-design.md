# Estado do arquivo selecionado no dropzone + modal de avisos — Design

## Contexto

Hoje, ao selecionar um áudio (clique ou drag-drop), o dropzone continua
mostrando sempre o texto "Arraste um áudio aqui ou clique para escolher" — a
única confirmação de que um arquivo foi escolhido é a linha de status abaixo
do botão "Transcrever" (`Selecionado: <nome>`). Esse mesmo elemento de status
também é reaproveitado para erros de transcrição, erros de histórico e a
mensagem "Concluído." após sucesso, misturando texto informativo discreto com
avisos que merecem mais destaque.

A mudança tem dois objetivos: (1) o dropzone passa a mostrar o nome do
arquivo selecionado, permanecendo clicável para trocar de arquivo; (2) a
linha de status é removida e os avisos (erros e a confirmação de sucesso)
passam a aparecer numa modal, no mesmo padrão já usado pela modal de loading
(`#loading-backdrop`).

Ver [2026-08-01-transcritor-design.md](./2026-08-01-transcritor-design.md)
para o desenho geral do serviço.

## Decisões

- **Sem novo controle de "trocar arquivo".** O dropzone já é uma
  `<label for="file-input">` envolvendo o `<input type="file">` — clicar nele
  sempre reabre o seletor nativo, então a troca de arquivo já funciona hoje.
  A mudança é só visual: uma classe `has-file` no dropzone alterna entre o
  estado vazio (ícone de upload + texto de instrução) e o estado preenchido
  (ícone de check + nome do arquivo + "Clique para trocar o arquivo").
- **Uma única modal de aviso para todo o app.** Em vez de uma modal só para
  erro de transcrição, `#alert-backdrop` é reaproveitada para: erro ao
  transcrever, sucesso ("Concluído."), erro ao carregar histórico e erro ao
  excluir do histórico. Uma função central `showAlert(message, type)`
  substitui todas as chamadas a `setStatus`.
- **Fecha só pelo botão "OK".** Sem fechar ao clicar no backdrop e sem
  auto-hide — o usuário precisa confirmar a leitura, igual ao padrão de erro
  já usado na modal de login (`#login-error`).
- **Sucesso e erro no mesmo componente, cor muda.** A mensagem usa
  `--ctp-green` para sucesso e `--ctp-red` para erro (cores já existentes no
  tema), sem título/ícone extra — mantém a modal simples.
- **Loading e alerta nunca abertos ao mesmo tempo.** A modal de loading é
  escondida antes de abrir a modal de aviso (tanto no caminho de sucesso
  quanto no de erro), evitando duas modais empilhadas.
- **Remoção completa do status de texto.** `<p id="status">`, a função
  `setStatus` e a regra CSS `.status` são removidos — nenhum código novo
  precisa deles.

## Fluxo de dados

1. **Seleção de arquivo** (clique no `file-input` ou drag-drop) — chama uma
   função única `setSelectedFile(file)` que:
   - guarda `selectedFile`;
   - habilita/desabilita o botão "Transcrever";
   - alterna a classe `has-file` no dropzone;
   - atualiza o texto do nome do arquivo exibido dentro do dropzone.
2. **Transcrever** (clique no botão) — fluxo igual a hoje até a resposta da
   API, com duas mudanças no tratamento do resultado:
   - sucesso: esconde a modal de loading, chama `showResult` (como hoje) e
     em seguida `showAlert('Concluído.', 'success')`;
   - erro: esconde a modal de loading e chama
     `showAlert(mensagem, 'error')` em vez de `setStatus`.
3. **Histórico** (`loadHistory`) — erro ao carregar chama
   `showAlert('Não foi possível carregar o histórico', 'error')`.
4. **Excluir do histórico** — erro ao excluir chama
   `showAlert('Não foi possível excluir a transcrição.', 'error')`.
5. **Fechar a modal de aviso** — clique em "OK" apenas esconde
   `#alert-backdrop` (`hidden = true`); nenhum estado adicional é limpo.

## Componentes afetados

- `src/client/index.html`:
  - dropzone ganha um segundo ícone (check) e um segundo bloco de texto
    (nome do arquivo + "Clique para trocar o arquivo"), ambos alternados via
    CSS pela classe `has-file`.
  - `<p id="status">` é removido.
  - novo `#alert-backdrop` com `.modal`, mensagem (`#alert-message`) e botão
    `#alert-ok-btn`, seguindo a mesma estrutura de `#loading-backdrop`.
- `src/client/style.css`:
  - regras para os dois estados do dropzone (`.dropzone .dropzone-prompt` /
    `.dropzone-file`, mostrando/escondendo conforme `.has-file`).
  - `.alert-message--error` (cor `--ctp-red`) e `.alert-message--success`
    (cor `--ctp-green`).
  - remoção da regra `.status` (não usada mais).
- `src/client/main.ts`:
  - `setSelectedFile` substitui as atribuições diretas a `selectedFile` no
    handler de `change` do input e no `drop` do dropzone.
  - `showAlert(message, type)` substitui `setStatus` em todos os call sites
    (transcrever, histórico, excluir).
  - `setStatus` e `statusEl` são removidos.

## Tratamento de erros

- Nenhum caminho de erro novo é introduzido — os mesmos catches existentes
  (`transcribeBtn` click, `loadHistory`, delete do histórico) só trocam o
  destino da mensagem de `setStatus` para `showAlert(..., 'error')`.
- Se `showAlert` for chamada duas vezes em sequência rápida (não deve
  acontecer no fluxo atual, já que cada ação é sequencial), a segunda
  chamada simplesmente sobrescreve a mensagem e mantém a modal aberta — sem
  necessidade de fila de mensagens.

## Testes

- Não há suíte de testes de cliente no projeto (`tests/` cobre só
  `src/server`). Validação será manual, rodando o app no navegador:
  - selecionar arquivo por clique e por drag-drop → dropzone mostra o nome
    correto e continua clicável para trocar;
  - forçar um erro (ex.: backend fora do ar) → modal de erro abre com texto
    em vermelho e fecha só pelo "OK";
  - transcrição bem-sucedida → modal de loading fecha, resultado aparece,
    modal de sucesso abre em seguida com texto em verde;
  - erro ao carregar/excluir histórico → mesma modal de erro é usada.

## Fora de escopo (YAGNI)

- Botão explícito de "remover arquivo selecionado" (limpar sem escolher
  outro) — não foi pedido; o usuário sempre pode selecionar outro arquivo
  para substituir.
- Fila/histórico de múltiplos avisos empilhados — sempre um aviso por vez,
  suficiente para os fluxos atuais do app.
- Auto-fechar a modal de sucesso — decisão explícita de exigir clique em
  "OK" para todos os avisos, incluindo sucesso.

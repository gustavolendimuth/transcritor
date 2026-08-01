# Redesign do frontend + login em modal — Design

## Contexto

O frontend atual (`src/client/`) é funcional mas visualmente cru: HTML sem
hierarquia visual, CSS mínimo, e o login depende do prompt nativo de HTTP
Basic Auth do navegador (feio, sem controle de UX, sem forma de "sair").

Objetivo: deixar a interface mais bonita e profissional, com UX simples e
funcional, e substituir o prompt nativo por um modal de login customizado —
sem exigir mudanças no backend.

## Decisões

- **Autenticação continua Basic Auth no servidor.** `basicAuthMiddleware`,
  `AUTH_USER`/`AUTH_PASSWORD` e os testes em `tests/server/auth.test.ts` não
  mudam. O que muda é só como o cliente coleta e envia as credenciais.
- **Tema visual: Catppuccin Mocha**, para ficar coerente com o resto do
  ambiente do usuário (GTK, SDDM, cursors, wallpaper — ver `CLAUDE.md`).
- **Sem framework de UI.** Continua HTML + CSS + TypeScript vanilla (Vite),
  seguindo o padrão já estabelecido no projeto.
- **Sem testes de frontend automatizados** — o projeto não tem infraestrutura
  de testes de UI hoje (só `tests/server/`); validação é manual no navegador.

## Fluxo de autenticação (cliente)

Novo módulo `src/client/auth.ts`:

- `getCredentials()` / `setCredentials(user, pass)` / `clearCredentials()` —
  leem/escrevem um valor Basic Auth já codificado (`base64(user:pass)`) em
  `sessionStorage` (não `localStorage`, para expirar ao fechar a aba, já que
  não existe conceito de sessão no servidor).
- `authFetch(input, init)` — wrapper de `fetch` que injeta o header
  `Authorization: Basic <credenciais>` quando existem credenciais salvas. Se
  a resposta vier `401`, limpa as credenciais salvas e dispara um evento
  (`auth:unauthorized`) para a UI reabrir o modal.

Fluxo em `main.ts`:

1. Ao carregar a página, se houver credenciais salvas, tenta
   `authFetch('/api/history')`. Sucesso → esconde o modal, segue fluxo normal
   (carrega histórico). Falha (401 ou sem credenciais) → mostra o modal e
   mantém o resto da UI oculto/bloqueado atrás dele.
2. Modal: campos usuário/senha, botão "Entrar". No submit, chama
   `authFetch('/api/history')` com as credenciais digitadas (usando um
   header manual, já que ainda não foram salvas). Sucesso → `setCredentials`,
   fecha modal, carrega app. Falha → mensagem inline no modal ("Usuário ou
   senha inválidos"), campo de senha limpo, foco de volta no campo usuário.
3. Modal é obrigatório: sem botão de fechar, sem clique-fora, sem tecla ESC.
4. Header do app ganha botão "Sair" (visível só quando autenticado): chama
   `clearCredentials()` e reabre o modal, sem precisar recarregar a página.
5. Todas as chamadas existentes (`/api/transcribe`, `/api/history`,
   `/api/history/:id`) passam a usar `authFetch` em vez de `fetch`.

## Visual — Catppuccin Mocha

Paleta (valores oficiais da paleta Mocha):

- Fundo da página: `base` `#1e1e2e`
- Cards/seções: `surface0` `#313244`, borda em `surface1` `#45475a`
- Texto principal: `text` `#cdd6f4`; texto secundário: `subtext0` `#a6adc8`
- Destaque/ação primária: `mauve` `#cba6f7`
- Sucesso: `green` `#a6e3a1`; erro/perigo: `red` `#f38ba8`; aviso: `yellow`
  `#f9e2af`

Layout: container central (~720px), cards com `border-radius: 12px` e
`box-shadow` sutil, escala de espaçamento consistente (múltiplos de 0.5rem).
Tipografia continua `system-ui`, mas com escala de tamanho/peso deliberada
para título, seções e corpo (hoje é tudo uniforme).

## Componentes

- **Header**: título "Transcritor" + ícone SVG inline (sem dependência
  externa) + botão "Sair" à direita (só quando autenticado).
- **Modal de login**: card centralizado sobre backdrop com blur
  (`backdrop-filter`) e overlay escuro semi-transparente; campos com labels;
  botão "Entrar" em `mauve`; erro inline em `red`.
- **Dropzone**: maior, ícone de upload, borda tracejada que vira sólida/mauve
  em hover e dragover.
- **Botão Transcrever**: estado de loading com spinner substituindo o texto
  estático de status atual.
- **Card de resultado**: elevado (`surface0`), textarea estilizada, botões
  "Copiar"/"Baixar" como secundários (ghost button) com ícone.
- **Histórico**: itens em card com nome do arquivo, duração, data formatada
  (`pt-BR`) e botão de excluir (ícone lixeira) visível no hover. Estado vazio
  ("Nenhuma transcrição ainda") quando a lista estiver vazia — hoje inexistente.

## Tratamento de erros

- Credenciais inválidas no modal → mensagem inline, modal permanece aberto.
- `401` em qualquer chamada autenticada durante o uso normal (ex: variáveis
  de ambiente do servidor mudaram) → limpa credenciais salvas e reabre o
  modal, sem perder o resto do estado da página (histórico recarrega depois
  do novo login).
- Erros de transcrição/histórico (já existentes: formato não suportado,
  falha na API, etc.) continuam exibidos na área de status, sem relação com
  o fluxo de auth.

## Escopo de arquivos

- `src/client/index.html` — nova estrutura (header, modal, seções)
- `src/client/style.css` — reescrita com o design system Catppuccin Mocha
- `src/client/main.ts` — ajustado para usar `authFetch`, lógica do modal e
  do botão "Sair"
- `src/client/auth.ts` — novo módulo de credenciais/`authFetch`
- **Nenhum arquivo em `src/server/` muda.**

## Testes

- Sem testes automatizados de frontend (consistente com o estado atual do
  projeto).
- Validação manual no navegador (`npm run dev`) cobrindo: login inválido,
  login válido, refresh de página com sessão salva, upload e transcrição,
  histórico (listar/reabrir/excluir), logout, e sessão expirada em uso
  (simulando 401 no meio do uso).

## Fora de escopo (YAGNI)

- Sessão baseada em cookie/servidor (mantido Basic Auth por trás do modal).
- "Lembrar-me" persistente entre fechamentos do navegador (`sessionStorage`,
  não `localStorage`, é intencional).
- Light mode / troca de tema (Catppuccin Mocha fixo, dark-only).
- Qualquer mudança de comportamento da API ou do fluxo de transcrição
  existente.

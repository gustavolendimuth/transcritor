# Migração do frontend para React + Tailwind — Design

## Contexto

O frontend atual (`src/client/`) é vanilla TypeScript + DOM manual (Vite como
build tool), com CSS próprio (`style.css`, fontes Fraunces/IBM Plex, motivo
de waveform animado). Funciona, mas manter estado via `Map`, listeners de DOM
manuais e manipulação imperativa de elementos dificulta evoluir a UI.

Objetivo desta fase: reescrever o frontend em **React**, aproveitando a troca
para também **modernizar o visual** — mantendo a identidade atual (fontes,
motivo de waveform, tom editorial/aconchegante) só com execução mais
consistente. O backend Express + SQLite (`src/server/`) não muda.

Este é o primeiro de dois sub-projetos: um empacotamento mobile via
**Capacitor**, reaproveitando este mesmo app React, é uma fase futura
separada — fora de escopo aqui. Nada nesta fase deve travar essa fase 2 (ex.:
o layout já nasce responsivo), mas nenhuma configuração de Capacitor entra
neste plano.

## Escopo

**Dentro do escopo:**
- Reescrita completa (big bang) de `src/client/` em React + TypeScript.
- Redesign visual mantendo a identidade atual (fontes, waveform, paleta),
  usando Tailwind CSS.
- Layout responsivo (mobile/touch-friendly), preparando terreno pra fase 2.
- Reaproveitamento da lógica de negócio já testada e desacoplada do DOM.
- Testes de componente novos com Testing Library.

**Fora do escopo:**
- Qualquer mudança no backend (`src/server/`), rotas de API, autenticação
  Basic Auth no servidor, ou schema do banco.
- Empacotamento mobile (Capacitor) — fase 2, spec própria.
- Dark mode.
- Gerenciador de estado externo (Redux/Zustand) — decisão explícita de usar
  só React (`useState`/`useReducer`/`useContext`).

## Decisões

- **Migração big bang**: substitui `src/client/` de uma vez, sem período de
  coexistência entre DOM manual e React.
- **Build tool**: continua Vite, adiciona `@vitejs/plugin-react`. O proxy de
  `/api` no dev server permanece como está hoje.
- **Estilização**: Tailwind CSS. Substitui `style.css`; o que não é
  expressável em utility classes (ex.: `@keyframes` do waveform, `@font-face`
  se necessário) vai numa camada `@layer` pequena.
- **Estado**: só hooks nativos do React (`useState`, `useReducer`,
  `useContext`) — sem lib de state management. Único contexto global é
  autenticação (`AuthContext`); o resto é estado local por componente.
- **Componentes primeiro (UI kit)**: antes de montar as telas, cria
  primitivos reutilizáveis com Tailwind (`Button`, `Field`, `Card`, `Modal`,
  `TagPill`, `Combobox`, `Spinner`, `Waveform`), depois compõe as telas a
  partir deles. Prioriza consistência visual e reuso sobre velocidade de
  entrega da primeira tela.
- **Testes**: Vitest continua o runner; adiciona `@testing-library/react`,
  `@testing-library/jest-dom` e ambiente `jsdom`.

## Estrutura de pastas

```
src/client/
  main.tsx              # entry point, monta <App />
  App.tsx                # shell: AuthProvider, AlertProvider, roteia
                          # entre tela de login e app autenticado
  ui/                     # primitivos de design system (Tailwind)
    Button.tsx
    Field.tsx
    Card.tsx
    Modal.tsx
    TagPill.tsx
    Combobox.tsx
    Spinner.tsx
    Waveform.tsx
  features/
    auth/
      LoginScreen.tsx
      useAuth.ts          # hook que embrulha lib/auth.ts + AuthContext
    upload/
      UploadCard.tsx
      useUploadQueue.ts   # hook que embrulha lib/uploadQueue.ts
    editor/
      ResultEditor.tsx
      useAutosave.ts       # hook que embrulha lib/autosave.ts
    history/
      HistoryList.tsx
      HistoryTagFilter.tsx
    tags/
      useProjectTags.ts    # deriva lista de tags a partir do histórico
  lib/
    auth.ts                # igual ao atual: getCredentials, attemptLogin,
                            # clearCredentials, authFetch (puro, sem DOM)
    autosave.ts             # igual ao atual: createAutosave (puro, sem DOM)
    uploadQueue.ts           # igual ao atual: createUploadQueue (puro, sem DOM)
    tagColor.ts              # mantém hashTag/tagColorVar (puras); a função
                              # applyTagColor (que toca HTMLElement) é
                              # descartada — o componente Combobox/TagPill
                              # aplica a cor via style inline do React
  shared/
    languages.ts            # inalterado (já é framework-agnostic)
index.html                 # shell mínimo: <div id="root">, fontes, título
```

**Nota sobre reaproveitamento:** `auth.ts`, `autosave.ts` e `uploadQueue.ts`
já são módulos puros (fábricas de função, sem tocar DOM) — migram para
`lib/` praticamente inalterados, e os testes atuais (`autosave.test.ts`,
`uploadQueue.test.ts`) continuam valendo. `tagCombobox.ts`, por outro lado,
manipula elementos DOM diretamente (listbox, `aria-*`, navegação por
teclado) — essa lógica **não** é portada como está; vira o componente
`ui/Combobox.tsx`, reimplementado em React (estado local + handlers de
teclado), reaproveitando só a lógica pura de cor (`tagColorVar`) de
`tagColor.ts`.

## Mapeamento de funcionalidades

Cada seção do `index.html` atual mapeia para um componente/feature:

| Hoje (`index.html` / `main.ts`) | React |
|---|---|
| `#login-backdrop` + `#login-form` | `features/auth/LoginScreen.tsx` |
| `#drop-zone`, `#file-input`, checkbox timestamps, select idioma, tag combobox de upload, `#upload-queue` | `features/upload/UploadCard.tsx` |
| `#result-section` (nome, tag, textarea, contagem, copiar/baixar) | `features/editor/ResultEditor.tsx` |
| `#history-section` (loading, filtro de tag, lista, empty state) | `features/history/HistoryList.tsx` + `HistoryTagFilter.tsx` |
| `#alert-backdrop`/`#alert-modal` | `ui/Modal.tsx` + `AlertContext`/`useAlert` |
| `.waveform` (login e header) | `ui/Waveform.tsx` |

## Fluxo de dados

- **Auth**: `useAuth` embrulha `lib/auth.ts` (`attemptLogin`, `getCredentials`,
  `clearCredentials`, `authFetch`) e expõe `{ isAuthenticated, login, logout,
  authFetch }` via `AuthContext` no topo do `App`. É o único estado
  verdadeiramente global.
- **Upload**: `useUploadQueue` embrulha `createUploadQueue`, expõe a lista de
  tasks e ações (`enqueue`, `retry`) para `UploadCard`.
- **Editor**: cada registro de transcrição aberto é uma instância de
  `ResultEditor`, que usa `useAutosave` internamente — troca o `Map<id,
  RecordEditor>` gerenciado manualmente hoje pelo React cuidando do ciclo de
  vida por componente (um registro fechado = componente desmontado).
- **Histórico**: `HistoryList` busca a lista via `authFetch` em `useEffect`
  (recarrega ao autenticar ou ao trocar filtro de tag), filtro ativo como
  `useState` local.
- **Tags**: `useProjectTags` deriva a lista de tags distintas a partir do
  histórico carregado; passada como prop para os `Combobox` de upload e do
  editor.

## Tratamento de erros

- O modal de alerta (sucesso/erro, com botão "tentar novamente") vira
  `ui/Modal.tsx` + `AlertContext`/`useAlert`, com API `showAlert(message, {
  variant: 'success' | 'error', onRetry? })` — substitui a manipulação direta
  do DOM (`#alert-backdrop`, `#alert-message`, etc.) de hoje.
- `authFetch` continua detectando `401` e disparando
  `CustomEvent('auth:unauthorized')` no `window`, exatamente como hoje —
  `lib/auth.ts` permanece puro, sem depender de React. O `useAuth` registra
  um listener desse evento em `useEffect` e chama `logout()` do
  `AuthContext` quando ele dispara. Mantém o mesmo comportamento observável:
  sessão expirada limpa credenciais e volta pra tela de login.
- Validação de formulário (login, nome do arquivo) continua simples e local
  — erro exibido como estado do componente, mesmo padrão visual de hoje
  (texto de erro abaixo do campo).

## Visual

- Mantém fontes atuais (Fraunces para títulos, IBM Plex Sans/Mono para o
  resto), motivo de waveform animado, paleta e tom editorial/aconchegante
  já estabelecidos — a mudança é a **execução**: componentes consistentes
  via `ui/`, espaçamento e estados (hover/focus/disabled/loading)
  padronizados pelo design system novo, não a identidade em si.
- Layout responsivo desde já: breakpoints Tailwind (`sm`/`md`/`lg`) cobrindo
  telas de celular até desktop, alvos de toque com tamanho adequado
  (mínimo ~44px), preparando o terreno pra fase 2 (Capacitor) sem
  retrabalho.
- Sem dark mode nesta fase.

## Testes

- Vitest continua o runner de testes.
- `lib/auth.ts`, `lib/autosave.ts`, `lib/uploadQueue.ts` mantêm testes de
  unidade equivalentes aos atuais (`tests/client/autosave.test.ts`,
  `tests/client/uploadQueue.test.ts`), já que a lógica não muda.
- Componentes novos (`ui/` e `features/`) ganham testes com
  `@testing-library/react` focados em comportamento observável (ex.: "envia
  arquivo ao soltar no dropzone", "mostra erro ao logar com senha errada",
  "abre confirmação de retry quando autosave falha").
- Testes do servidor (`tests/server/`) não são tocados.

## Não-objetivos

- Redesenhar o backend ou a API.
- Adicionar roteamento (`react-router`) — o app é uma tela única com seções,
  não há necessidade de múltiplas rotas nesta fase.
- Configurar Capacitor ou qualquer build mobile.
- Dark mode ou temas alternativos.
- Gerenciador de estado externo.

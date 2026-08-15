# Ocultar Feedback do Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o texto e botão visuais do autosave, preservando seu salvamento automático.

**Architecture:** O DOM do editor deixa de conter a linha de feedback. O
controlador de autosave continua registrando estado e agendando requisições,
mas o cliente não atualiza mais elementos de status inexistentes.

**Tech Stack:** TypeScript, DOM nativo, Vitest.

## Global Constraints

- Não alterar `createAutosave` nem seus testes comportamentais.
- Não remover o botão de retry da fila de upload.
- Não incluir mudanças locais não relacionadas do usuário.

---

### Task 1: Remover feedback visual do autosave

**Files:**
- Modify: `src/client/index.html:159-162`
- Modify: `src/client/main.ts:64-65,133-143,436-438`
- Modify: `src/client/style.css:476-517` somente se regras ficarem sem uso.

**Interfaces:**
- Consumes: `createAutosave` inalterado.
- Produces: editor sem `#autosave-status` e `#autosave-retry-btn`.

- [ ] **Step 1: Escrever uma verificação de UI que falha**

Adicionar um teste DOM mínimo ou, se o projeto não possuir ambiente DOM,
usar verificação manual documentada: o HTML atual contém `autosave-status` e
`autosave-retry-btn`, portanto a verificação inicial falha para a ausência
requerida.

- [ ] **Step 2: Remover o markup e referências DOM**

Remover a `<div class="autosave-row">` inteira de `index.html`, as duas
consultas `getElementById`, o corpo visual de `setAutosaveStatus` e o listener
do botão. Manter as chamadas de `autosave.schedule` e o controlador.

- [ ] **Step 3: Remover CSS órfão**

Remover somente `.autosave-row`, `.autosave-status` e
`.autosave-status--error` que não tiverem mais consumidores.

- [ ] **Step 4: Validar e fazer commit**

Run: `npm test && npm run typecheck && npm run build`

Expected: testes, typecheck e build passam; `rg 'autosave-status|autosave-retry-btn' src/client` não retorna resultados.

```bash
git add src/client/index.html src/client/main.ts src/client/style.css
git commit -m "feat: hide autosave status feedback"
```

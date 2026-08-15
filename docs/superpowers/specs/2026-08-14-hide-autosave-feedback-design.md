# Ocultar feedback visual do autosave

## Objetivo

Remover do editor o texto de estado do autosave, incluindo `Salvo`, e o botão
`Tentar novamente`, sem alterar o salvamento automático das transcrições.

## Implementação

O HTML deixará de renderizar a linha de status do autosave. O cliente manterá
o controlador de autosave e continuará agendando alterações, mas não buscará
nem atualizará os elementos visuais removidos. A tentativa manual deixa de
existir na interface; uma falha de autosave permanece silenciosa até a próxima
edição, que agenda uma nova tentativa automática.

## Verificação

Validar typecheck e os testes existentes de autosave. Verificar manualmente
que editar nome, texto ou tag continua enviando o salvamento sem exibir a linha
de status ou botão.

## Fora de escopo

Não altera a fila de upload nem seu botão `Tentar novamente`, que é um fluxo
separado de falhas de upload.

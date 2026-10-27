## ADDED Requirements

### Requirement: Página de histórias de usuário
O app MUST oferecer uma página "Histórias" na rota `/historias`, acessível por um link na navegação principal, que só carrega dados quando há um projeto configurado.

#### Scenario: Acesso pela navegação
- **WHEN** o usuário clica em "Histórias" na barra de navegação
- **THEN** o app abre a rota `/historias` e o link fica marcado como ativo

#### Scenario: Sem projeto configurado
- **WHEN** o usuário abre `/historias` sem configuração salva
- **THEN** a página mostra o estado vazio com o botão "Ir para configurações", sem chamar a API do GitLab

### Requirement: Listagem das histórias do GitLab
A página MUST listar todas as issues do projeto que têm a label de história configurada, em qualquer estado (abertas e fechadas), buscando todas as páginas da API. As abertas MUST aparecer antes das fechadas e, dentro de cada grupo, a ordem MUST ser pelo código da história e, em seguida, pelo iid.

#### Scenario: Histórias abertas e fechadas
- **WHEN** o projeto tem as issues `US007 - Gerenciar Credenciamento` (aberta) e `US001 - Autenticação GOV.BR` (fechada), ambas com a label `História`
- **THEN** as duas aparecem na lista, com a US007 antes da US001 e a US001 marcada como "Fechada"

#### Scenario: Mais de 100 histórias
- **WHEN** o projeto tem 130 issues com a label de história
- **THEN** as 130 aparecem na lista

#### Scenario: Label de história não configurada
- **WHEN** a label de história está vazia nas configurações
- **THEN** a seção mostra um aviso pedindo para configurá-la e não lista histórias do GitLab

### Requirement: Cada história é um acordeon
Cada história MUST ser exibida como um acordeon, fechado por padrão. O cabeçalho MUST mostrar o código, o título, o estado, a quantidade de subtasks concluídas sobre o total, a porcentagem de desenvolvimento e uma barra de progresso. Ao abrir, o acordeon MUST listar as subtasks da história e um link para a issue (ou página da wiki) da própria história. O acordeon MUST ser operável por teclado.

#### Scenario: Abrir e fechar
- **WHEN** o usuário clica no cabeçalho de uma história fechada
- **THEN** o acordeon abre e mostra as subtasks; um novo clique fecha o acordeon

#### Scenario: Teclado
- **WHEN** o foco está no cabeçalho de um acordeon e o usuário pressiona Enter ou Espaço
- **THEN** o acordeon alterna entre aberto e fechado

### Requirement: Vínculo entre história e subtasks
Uma subtask MUST ser uma issue com a label de subtask configurada cujo título começa com o código da história entre colchetes (ex.: `[US007] - Validar unicidade de SIPAR`). A comparação de código MUST ser exata e sem diferença entre maiúsculas e minúsculas (`US007` não casa com `US007B`). Issues com qualquer label de exclusão configurada MUST ser ignoradas. Quando mais de uma história do GitLab tem o mesmo código, a subtask MUST ir para a história cuja referência `#iid` aparece na descrição da subtask; sem essa referência, MUST ir para a história de maior iid com aquele código.

#### Scenario: Código exato
- **WHEN** existem as subtasks `[US007] - Corrigir drawer` e `[US007B] - Rodar suíte completa`
- **THEN** a história US007 lista só a primeira e a US007B lista só a segunda

#### Scenario: Código repetido com issue-mãe na descrição
- **WHEN** existem as histórias #124 e #545, ambas `US007`, e a subtask `[US007] - Validar SIPAR` tem `Issue-mãe: #545` na descrição
- **THEN** a subtask aparece só na história #545

#### Scenario: Código repetido sem referência
- **WHEN** existem as histórias #124 e #545, ambas `US007`, e a descrição da subtask `[US007] - Ajustar mode` não cita nenhuma delas
- **THEN** a subtask aparece só na história #545

#### Scenario: Issue sem a label de subtask
- **WHEN** a issue `[US007] - Exibir histórico` não tem a label de subtask configurada
- **THEN** ela não aparece como subtask de nenhuma história

#### Scenario: Issue excluída
- **WHEN** a subtask `[US005] - Investigar divergência` tem uma das labels de exclusão configuradas
- **THEN** ela não aparece na lista nem entra no cálculo da porcentagem

### Requirement: Estado de cada subtask
Cada subtask MUST ser marcada como "Concluída" quando a issue está fechada ou tem alguma das labels de coluna de concluído configuradas, e como "Pendente" nos demais casos. A marcação MUST usar ícone e texto, não só cor. Cada subtask MUST mostrar o iid e o título com link para a issue no GitLab. As subtasks MUST ser ordenadas por iid crescente.

#### Scenario: Subtask fechada
- **WHEN** a subtask `[US004B] - Criar entidade Multa` está fechada
- **THEN** ela aparece como "Concluída"

#### Scenario: Subtask aberta em coluna de concluído
- **WHEN** a subtask está aberta e tem a label `Testing`, que está entre as colunas de concluído configuradas
- **THEN** ela aparece como "Concluída"

#### Scenario: Subtask aberta fora das colunas de concluído
- **WHEN** a subtask está aberta e tem só a label `Em Roteiro QA`, que não é coluna de concluído
- **THEN** ela aparece como "Pendente"

### Requirement: Porcentagem de desenvolvimento
A porcentagem de desenvolvimento de uma história MUST ser o número de subtasks concluídas dividido pelo total de subtasks vinculadas, arredondado para o inteiro mais próximo. Uma história sem subtasks MUST mostrar "Sem subtasks" no lugar da porcentagem, e não 0%.

#### Scenario: Cálculo
- **WHEN** a história tem 40 subtasks e 9 estão concluídas
- **THEN** o cabeçalho mostra "9/40" e "23%"

#### Scenario: Sem subtasks
- **WHEN** nenhuma subtask está vinculada à história
- **THEN** o cabeçalho mostra "Sem subtasks", sem barra preenchida, e o acordeon aberto diz que não há subtasks com o prefixo `[<código>]`

### Requirement: Histórias em validação na wiki
Quando uma pasta da wiki de validação está configurada, a página MUST mostrar uma segunda seção, "Em validação (wiki)", com uma história por página da wiki dentro dessa pasta (incluindo subpastas e excluindo a página da própria pasta). Cada uma MUST usar o mesmo acordeon, com o selo "Em validação", link para a página da wiki e as subtasks do GitLab vinculadas pelo código extraído do título da página, com as mesmas regras de estado e porcentagem. Essa seção MUST ser independente da seção do GitLab: uma falha ao ler a wiki MUST mostrar um erro só nessa seção.

#### Scenario: Página da wiki sem subtasks
- **WHEN** a pasta tem a página `US020 - Gestão de Vendedores (Operadores do PDV)` e não há subtasks `[US020]`
- **THEN** a seção mostra um acordeon "US020 – Gestão de Vendedores (Operadores do PDV)" com "Sem subtasks" e link para a página da wiki

#### Scenario: Página da wiki com subtasks já criadas
- **WHEN** a pasta tem a página `US013 - Gestão de Extra Teto` e existem subtasks `[US013]` no GitLab
- **THEN** o acordeon da US013 mostra essas subtasks marcadas como concluídas ou pendentes e a porcentagem correspondente

#### Scenario: Pasta não configurada
- **WHEN** o campo de pasta da wiki está vazio
- **THEN** a seção não é exibida e a página mostra uma dica de que ela pode ser configurada

#### Scenario: Erro ao ler a wiki
- **WHEN** a chamada que lista as páginas da wiki falha e a de issues funciona
- **THEN** a seção do GitLab é exibida normalmente e a seção da wiki mostra a mensagem de erro

### Requirement: Configuração das fontes de histórias e subtasks
A tela de Configurações MUST permitir editar a label das histórias (padrão `História`), a label das subtasks (padrão `Task`) e a pasta da wiki com as histórias em validação (padrão vazio). O campo da pasta MUST aceitar tanto o caminho da página (`Documentação-Negocial/.../Validação`) quanto a URL completa da wiki copiada do navegador. Configurações salvas antes desta mudança MUST continuar carregando, com os valores padrão nos campos novos.

#### Scenario: URL da wiki colada
- **WHEN** o usuário cola `https://gitlab.inova-af.dev.br/inova-af/fp/-/wikis/Documenta%C3%A7%C3%A3o-Negocial/Portal-e-Gestor-Farmacia-Popular/Hist%C3%B3ria-de-Usu%C3%A1rio/Valida%C3%A7%C3%A3o` e salva
- **THEN** a seção de validação lista as páginas dentro de `Documentação-Negocial/Portal-e-Gestor-Farmacia-Popular/História-de-Usuário/Validação/`

#### Scenario: Configuração antiga
- **WHEN** o `sessionStorage` tem uma configuração salva sem os campos novos
- **THEN** o app carrega a configuração com `História`, `Task` e pasta vazia

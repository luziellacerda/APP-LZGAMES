# Indicações: concessões ativas e utilização financeira pendente

Atualizado em 05/09/2026. O levantamento original foi complementado pela implantação separada do cashback de serviços.

**Reforço posterior já ativo:** [indicação única por pessoa/telefone, convite de uso único, transações e reservas permanentes](SEGURANCA-INDICACOES-AGENDA-CPF.md). A restrição antiga apenas por par foi substituída por essa implantação. Os limites sobre ausência de OTP/atestação e titularidade continuam válidos; não existe garantia de fraude impossível.

**Os 5% de serviço estão ativos no servidor, somente para notas nº 480 em diante**, conforme [registro da implantação](CASHBACK-SERVICOS-5.md). Todas as notas existentes até a 479 foram excluídas, inclusive as ainda abertas. A entrada paga não reduz a base e nenhum crédito retroativo foi criado. O APK 22 lê a regra do servidor, sem outra compilação. **O usuário confirmou primeiro acesso para os R$ 9,90**, e a [concessão separada já foi ativada](BONUS-APP-990.md). A [utilização auditável nas notas também está ativa](USO-CREDITO-APP.md), com estorno restrito a notas abertas ainda não pagas. As considerações de identidade/legado abaixo continuam relevantes.

## Regras acordadas com o usuário

| Programa | Beneficiário | Benefício | Utilização/liberação | Gatilho |
| --- | --- | --- | --- | --- |
| Indicação para uso do app | Cliente indicador | R$ 9,90, armazenados como **990 centavos** | Crédito acumulável, exclusivo para serviços; **não permite saque**. Abatimento ativo no painel da OS | **Primeiro acesso autenticado elegível ao app**, confirmado pelo usuário; convite vinculado antes do acesso |
| Indicação de serviço | Cliente indicador | **5% do total final salvo da nota**, serviços, peças e frete, após desconto e antes de abater a entrada | Aprovação em centavos e registro auditável; separado do crédito restrito do app. Não implementa saque/PIX automático | OS elegível nº 480 ou posterior marcada como **Finalizada no painel** |

Para o cashback de serviço, **pagamento não é o gatilho definido**. Não substituir conclusão por `pago = 'Sim'`, recebimento, emissão da nota ou outro evento.

O beneficiário é o indicador, e não o amigo indicado. As faixas antigas de 0% a 30% e as regras antigas de pontos não definem esses novos benefícios.

## Decisões ainda necessárias

1. Compilar e testar fisicamente a nova interface do crédito. Concessão e abatimento controlado no painel já estão implantados; o gatilho dos R$ 9,90 continua primeiro acesso elegível, não compra.
2. Definir a futura utilização/liberação financeira, se solicitada: aprovação acumulada não equivale a saldo líquido disponível para saque.
3. Definir a política financeira de estorno após reabertura/cancelamento. A implementação atual preserva o histórico e impede crédito duplicado; não estorna automaticamente uma aprovação.
4. Se desejado reforço antifraude, definir OTP de posse do telefone e atestação nativa. A versão implantada usa identidade autenticada, correspondência canônica única, histórico anterior disponível e deduplicação; não comprova pessoa física única.

A base dos 5% foi confirmada pelo usuário como a nota inteira e o corte das notas anteriores também foi confirmado. A regra ativa mantém uma aprovação por indicação/OS, exige cadastro canônico atual e não aprova indicação ambígua. Não interpreta “nota inteira” como comissão recorrente de todas as futuras notas do mesmo indicado.

Outros limites não informados — expiração, teto por cliente, estorno após cancelamento ou possibilidade de acumular ambos os programas numa mesma indicação — não devem ser inventados durante a implementação.

## Fatos verificados no sistema existente

### CORE: indicação e cashback aprovado

Arquivos principais:

- API: `/home/lz-servidor/Documentos/lzgames/api/app.js`.
- Rotas: `routes/referrals.js`, `routes/benefits.js`, `routes/referralsAdmin.js`.
- Autenticação específica: `middleware/referralAuth.js`; cópia auditável e instruções em [server/core/README.md](../server/core/README.md).
- Portal: `/home/lz-servidor/Documentos/lzgames/frontend/src/pages/IndicacoesPremiadas.jsx`, `pages/Login.jsx` e `services/apiClient.js`.

Rotas consumidor já existentes:

- `GET /api/me/referrals/summary`: contagens, cashback aprovado histórico e configuração enviada pelo servidor. Com a regra ativa, retorna nível único de 5% e `eligible_from_os_id=480`.
- `GET /api/me/referrals/list?days=365`: histórico, limitado a 200 registros.
- `POST /api/me/referrals/link`, com alias `/generate-link`: gera o link pessoal existente; não concede crédito.
- `POST /api/referrals/accept`: registra a indicação como `pendente`; não aprova cashback.

A tabela `DB4.indicacoes` possui, entre outros campos:

```text
id
indicador_cliente_id
indicado_cliente_id
codigo_ref
origem_canal: manual | link | loja | whatsapp
status: pendente | concluida | cancelada
cashback_valor_centavos
cashback_versao_id
os_concluida_id
created_at
updated_at
```

O schema atual contém as colunas necessárias às consultas de resumo/histórico e ao cadastro pendente. Não é necessário registrar uma indicação real para verificar isso.

Índices legados: chave primária em `id`, unicidade em `codigo_ref` e índices não únicos separados em `indicador_cliente_id` e `indicado_cliente_id`. A unicidade global agora é imposta pelas chaves em `lz_referral_claims`, pelo consumo único em `lz_referral_invites` e por transações/travas. Não foi preciso apagar duplicatas históricas ou recriar `indicacoes`.

`cashback_aprovado_centavos` é uma soma de indicações concluídas. **Não representa, por si só, saldo disponível para saque:** não desconta um ledger comprovado de utilizações/liberações. O `wallet` de `benefits.js` também é uma composição de valores do histórico, limitado pelos registros consultados.

O endpoint legado `/api/referrals/confirm-from-os` agora rejeita atribuição de valor enquanto a nova regra está ativa; a aprovação vem da conclusão autenticada da OS. Lançamentos auditados não podem ser sobrescritos por essa integração, inclusive com a política desativada. As rotas administrativas antigas do portal continuam bloqueadas. Procedimentos legados de pontos e saque não foram alterados nem executados.

### Assistência: conclusão e valores da nota

Raiz ativa identificada: `/home/lz-servidor/HOSTINGER SITE DOCUMENTOS/sistema2026.lzgames.com.br/public_html`.

- `painel/paginas/os/status.php`: grava a alteração de status pelo painel principal, usando o novo helper `painel/service-referral.php`.
- `painel/paginas/os_tecnico/status.php`: usa o mesmo helper para o técnico autorizado. Os dois caminhos foram integrados.
- `painel/paginas/os.php`, linha 2778: solicitação AJAX de status; linha 1209: campo de mão de obra.
- `painel/paginas/os/salvar.php`, linha 140, e `painel/paginas/os/totalizar.php`, linha 49: cálculos financeiros existentes.
- `painel/rel/os.php`, linha 640: PDF exibe o valor legado `os.vall` como valor do serviço.

O status de conclusão é **`Finalizada`**, distinto de `Entregue`. O vínculo deve seguir `os.cliente` → `indicacoes.indicado_cliente_id` e creditar `indicador_cliente_id`. A integração antiga `trg_os_au_cashback` observa pagamento, não status; não atende ao gatilho definido pelo usuário.

Foram confirmados `os.mao_obra`, totais de itens de serviço (`servicos_orc.total`), produtos (`produtos_orc.total`) e o campo legado `os.vall`. O desconto é global, percentual ou em valor, sem rateio explícito entre peças e serviços. Há divergência entre a aplicação do desconto ao salvar e ao totalizar. `subtotal` inclui frete e desconta entrada: **não usar `subtotal` sozinho nem somar os campos sobrepostos**.

O usuário confirmou a nota inteira. A base implementada é `centavos(subtotal) + centavos(val_entrada)`, restaurando a entrada uma única vez sobre o valor já salvo. Não foram alterados os cálculos originais da nota. O registro de implantação explica o arredondamento, a proteção contra repetição e o marco nº 480.

### Agenda: carteira e ledger reutilizáveis como referência

No banco Agenda (DB2), foram verificados:

```text
wallet
  id, usuario_id UNIQUE, balance_cents, updated_at

wallet_tx
  id, wallet_id, type: credit | debit, amount_cents,
  reason, ref_table, ref_id, idempotency_key UNIQUE, created_at

points_ledger
  id, usuario_id, delta_points, reason, meta,
  idempotency_key UNIQUE, created_at
```

O gatilho `trg_wallet_tx_apply` aplica cada crédito/débito ao saldo de `wallet`. A API `routes/agenda.js` lê essa carteira por `usuario_id`.

Essas tabelas oferecem um padrão útil de histórico e idempotência, mas **não possuem separação por finalidade de carteira nem campos que garantam crédito exclusivo para serviços e impedimento de saque**. A chave única atual de `wallet.usuario_id` prevê uma única carteira por usuário. Apenas escrever uma justificativa em `reason` não isola o saldo.

Também existe `referral_rules`, com configurações antigas de pontos. A existência dessa configuração não autoriza aplicá-la aos R$ 9,90 nem ao cashback fixo de 5%.

### DB4: pontos e saques não equivalem ao novo crédito

Existem `usuarios.pontos_total`, `usuarios.pontos_disponiveis`, `transacoes_pontos` e `saques`. O procedimento `sp_resgatar_cashback` trabalha com pontos e pedidos de saque. Não foi confirmado um vínculo contábil entre esse saldo e os centavos aprovados em `indicacoes`.

Portanto, não converter os R$ 9,90 em pontos dessa carteira, não adicioná-los a `cashback_valor_centavos` e não reutilizar automaticamente o caminho de saque para o novo crédito restrito.

O gatilho legado de `os.pago` encontrado no banco alimenta integração de pontos. **Não é o gatilho de conclusão definido para o novo cashback de serviço.**

## Primeiro uso do app e identidade

Locais usados pela implantação do evento, com diário imutável acrescentado separadamente:

- `App.tsx` e `src/api.ts`: sincronização de presença após acesso autenticado.
- `/home/lz-servidor/apps/lzgames-sorteios/public/app-communications.php`: `app_register_device`, na rota `/api/app/device`.
- `/home/lz-servidor/apps/lzgames-sorteios/lib/app-messaging.php`: `app_device_save` e tabela `app_devices`.

`app_devices` guarda provedor, ID externo, hash da instalação, `linked_at`, `last_seen_at` e desvinculação. É presença operacional por instalação, **não um registro definitivo de primeiro uso por cliente**:

- A instalação e a plataforma são informadas pelo cliente; não comprovam, sozinhas, instalação legítima ou pessoa única.
- Reinstalações podem gerar outra instalação.
- A mesma instalação pode trocar de conta.
- O upsert atual pode trocar o proprietário sem redefinir `linked_at`; essa data pode pertencer à conta anterior.

A concessão agora usa identidade canônica baseada em `CORE.clientes.id`, resolvida no servidor, e diário próprio. Contas CORE e TurboBox da mesma pessoa não recebem concessões separadas por mudança de provedor. Não usar telefone informado no corpo da requisição, token, instalação ou apelido como chave final de recompensa. A origem exata, baseline e limitações estão em [BONUS-APP-990.md](BONUS-APP-990.md).

O cadastro CORE atual valida formato, senha e duplicatas e emite uma sessão, mas não exige comprovação de posse do telefone por OTP. Os schemas de clientes CORE e usuários TurboBox não possuem campo de telefone verificado. O histórico OTP existente pertence ao fluxo de OS; não deve ser interpretado automaticamente como verificação do cadastro do app.

A ponte CORE/TurboBox confirma uma correspondência cadastral atual e única por telefone completo. Isso reduz associação incorreta, mas **não equivale à comprovação de posse do telefone nem impede todas as formas de cadastro artificial**.

## Separação contábil: o que falta e o que está implementado

### Carteira de crédito do app

Foi criado `lz_app_referral_credits`, ledger exclusivo de concessões de 990 centavos ao indicador canônico, sem ligação ao saque legado. Posteriormente, `lz_app_referral_redemptions` e `lz_app_credit_os` passaram a controlar uso/estorno de notas abertas, referência da nota, saldo e idempotência. Veja [USO-CREDITO-APP.md](USO-CREDITO-APP.md); estornos pós-fechamento continuam sujeitos a conferência e política financeira próprias.

O servidor deve impor a restrição de uso somente em serviços e impedir saque. A interface apenas comunica essa restrição; um campo visual não substitui a regra no backend. A futura utilização deve validar a parcela elegível do serviço, serializar o débito e impedir saldo negativo ou reutilização concorrente do mesmo crédito.

Reutilizar diretamente `wallet`/`wallet_tx` exigiria primeiro separar as carteiras e revisar todos os leitores/escritores do saldo antigo. Um ledger dedicado oferece isolamento sem alterar a semântica dos saldos existentes.

### Cashback de serviço liberável

`indicacoes` foi preservada como fonte da indicação e aprovação, com o registro auditável adicional `lz_service_referral_credits`. Os 5% são aprovados apenas pela conclusão elegível confirmada. Ainda não foi implementado um fluxo de liberação, utilização ou saque desses centavos.

Para informar saldo liberável de forma correta, deve haver histórico contábil identificável de créditos, liberações e estornos. Não substituir esse histórico pela soma de aprovações nem vinculá-lo aos pontos antigos sem uma correspondência comprovada.

### Deduplicação e auditoria

- Registrar a atribuição da indicação e o futuro evento qualificador com data do servidor.
- Deduplicar a recompensa por programa e cliente indicado canônico, não por dispositivo ou login.
- Guardar a versão da regra para auditoria; trocar essa versão não deve, por si só, conceder outra recompensa ao mesmo indicado.
- Impedir autoindicação após a resolução canônica CORE/TurboBox.
- Registrar reversões compensatórias sem apagar o histórico de concessão.
- Definir uma política clara para contas antigas e eventos anteriores à ativação; não executar concessão retroativa por inferência.

## Apresentação recomendada no app

Manter duas informações separadas:

1. **Crédito para serviços:** saldo próprio do programa de indicação do app, com a informação “Não permite saque”.
2. **Cashback de serviços:** aprovação pela conclusão da nota/OS e informações de liberação baseadas no respectivo histórico contábil.

Para os 5%, exibir regra e aprovações reais, sem chamar a soma histórica de saldo disponível para saque. A nova fonte do app exibe os créditos de R$ 9,90 somente quando confirmados pelo servidor, separando disponível, acumulado e usado nas notas. O APK 22 não contém esse cartão; ele integra a fonte enviada no [APK 23](BUILD-23.md), cujo registro informa compilação, download e verificações. Não executar pagamentos, estornos pós-fechamento ou migrações adicionais apenas com base neste levantamento; as implantações autorizadas possuem registros próprios.

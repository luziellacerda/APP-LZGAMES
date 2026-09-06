# Uso dos créditos do app nas notas de serviço

Ativado em **05/09/2026 às 18:05:29 de Maceió / 21:05:29 UTC**. Esta entrega conclui o abatimento dos créditos de R$ 9,90 já concedidos pelo [primeiro acesso elegível do indicado](BONUS-APP-990.md). Não altera o programa separado de [5% por conclusão de serviço](CASHBACK-SERVICOS-5.md).

## Como usar no atendimento

1. Entre no painel da assistência e abra a OS do cliente. É necessário usuário ativo administrador, ou as duas permissões **OS** e **Contas a Receber**. O técnico não recebe acesso financeiro só por atender a OS.
2. Salve primeiro os serviços, produtos, mão de obra, desconto, entrada e o cliente correto. Na edição, abaixo dos valores, use **Crédito do app · serviços → Consultar saldo da OS salva**.
3. Confira o saldo disponível e o limite dessa nota. Digite quanto deseja usar e clique em **Aplicar na nota**. É permitido usar uma parte do saldo, inclusive centavos; o restante continua acumulado para serviços futuros.
4. O total a pagar diminui. O PDF mostra **CRÉDITO DO APP (SERVIÇOS)** em linha separada. O desconto original e a entrada permanecem identificados como antes. Aplicar crédito não envia WhatsApp, não recebe dinheiro, não altera a indicação de 5% e não finaliza a OS.
5. Com crédito aplicado, os valores, itens e o cliente ficam protegidos. Observações/dados técnicos e o pagamento continuam disponíveis. Ao marcar **Pago**, o recebimento considera somente o total líquido; repetir o salvamento não lança outro recebimento.
6. Se precisar ajustar valores enquanto a OS estiver aberta e não paga, informe um motivo e clique em **Estornar crédito**. O valor volta exclusivamente ao saldo para serviços e a nota recupera o total anterior. Corrija, salve e aplique novamente se necessário.

Não há botão de saque nem de aplicação automática pelo consumidor. O cliente consulta os saldos; o atendimento aplica na nota do próprio cliente, nunca em uma OS de outra pessoa.

## Limite e segurança financeira

- Uma utilização ativa por OS. Atualizar/repetir o mesmo pedido não duplica o débito; duas OS simultâneas não podem gastar o mesmo saldo. Um pedido antigo já estornado não volta a abater por repetição.
- A parte elegível é **itens de serviços + mão de obra + valor de serviço legado (`vall`)**. Produtos e frete não aumentam esse limite. A entrada já paga não pode ser coberta de novo.
- Como o sistema tem desconto global sem rateio, o cálculo é conservador: considera esse desconto primeiro sobre os serviços. Isso evita que o crédito seja usado indiretamente para cobrir produtos. O limite final é o menor entre saldo, serviços líquidos elegíveis e total ainda devido.
- Usa os centavos do total efetivamente salvo, sem reexecutar os dois cálculos legados divergentes de desconto. Se os totais de itens divergirem dos totais salvos, ou a conta não fechar, pede revisão da OS e não aplica crédito.
- É necessário aplicar antes de concluir/pagar. Estados aceitos: Aberta, Iniciada, Aguardando Peça, Aguardando Aprovação e Em Bancada. OS com cobrança já lançada, exceto entrada, exige conferência financeira antes do abatimento.
- Ao pagar ou sair desses estados, o abatimento fica fechado para estorno automático. **Reabrir a OS não remove essa proteção.** Estorne antes de cancelar/concluir, se for o caso. Estornos pós-fechamento, devolução em dinheiro e liberação dos 5% continuam dependendo de política/fluxo financeiro próprios; não apagar o histórico para contornar a regra.
- Os créditos não expiram automaticamente. Saldo não representa dinheiro sacável. Não há transferência para a carteira de pontos, PIX, saques legados ou cashback de 5%.

Exemplo fictício: R$ 19,80 acumulados; aplicação de R$ 9,90 em uma OS de R$ 100,00 de serviço deixa **R$ 90,10 a pagar** e **R$ 9,90 disponíveis**. Um estorno elegível restaura os R$ 100,00 da nota e os R$ 19,80 do saldo, sem movimentar caixa.

Os 5% continuam calculados sobre o total final salvo da nota, restaurando a entrada uma vez. Portanto, um desconto de crédito efetivamente aplicado já está descontado desse total; ele não é tratado como uma entrada em dinheiro.

## App e versão instalada

O resumo autenticado agora informa três valores separados:

```json
{
  "creditos_acumulados_centavos": 1980,
  "creditos_utilizados_centavos": 990,
  "saldo_disponivel_centavos": 990,
  "redemption_enabled": true
}
```

Exemplo sintético. São campos dentro de `app_referral_credit`; os campos anteriores e a restrição `services_only` permanecem. O total acumulado continua sendo concessões, não saldo disponível. Utilizações estornadas não reduzem o saldo. Inconsistência ou falha de consulta não é apresentada como saldo zero.

A fonte do app mostra disponível, acumulado e usado; o detalhe da OS mostra `app_credit_centavos` e o total líquido, preservando os outros dados do consumidor. **O APK 22 não contém esses componentes.** Depois da implantação, o usuário pediu o [APK 23](BUILD-23.md), enviado com essa fonte após 115 testes, TypeScript e Expo Doctor (21/21), usando crédito do plano existente, sem contratação adicional ou publicação na Play Store. O registro do build informa estado, download e verificações. Instalação e validação no aparelho continuam pendentes; exportar JavaScript não equivale a compilar um instalador Android.

## Arquitetura e arquivos

Assistência ativa:
`/home/lz-servidor/HOSTINGER SITE DOCUMENTOS/sistema2026.lzgames.com.br/public_html`.

- `painel/app-credit.php`: autorização, CSRF/origem, consulta, limite em centavos, aplicação e estorno.
- `painel/app-credit-schema.php`, `painel/app-credit-migrate.php`: migração CLI explícita e proteções no banco. As páginas não criam tabelas nem ativam regras.
- `painel/paginas/os/app_credit.php`: POST autenticado `quote`, `apply`, `undo`. Não aceita beneficiário livre: compara o cliente esperado com o cliente atual da OS bloqueada.
- `painel/paginas/os.php`, `painel/js/app-credit.js`: controle compacto, bloqueio de repetição, tratamento de erros e de troca de OS/cliente.
- `salvar.php`, `totalizar.php`: preservam a fotografia financeira de uma nota com crédito; `rel/os.php` exibe o abatimento separado.
- Cópia e patch revisável: [server/assistance](../server/assistance/README.md). O patch contém somente as mudanças nas páginas existentes; não copiar snapshots antigos sobre alterações novas.

CORE: `lib/appReferral.js` acrescenta saldo e utilizados em consulta consistente; `routes/orders.js` acrescenta o crédito por OS à consulta já existente. Cópias/testes em `server/core/`, integração em `app-credit-redemption.patch`.

MySQL, **no mesmo servidor**, tabelas InnoDB:

| Local | Tabela | Função |
| --- | --- | --- |
| CORE | `lz_app_credit_os` | Aplicação ativa da OS, total anterior/líquido e fechamento para estorno |
| Cashback/DB4 | `lz_app_referral_redemptions` | Histórico auditável de utilização e eventual reversão, usuário, motivo e datas UTC |
| Cashback/DB4 | `lz_app_referral_wallet_locks` | Serializa gastos do mesmo cliente em notas diferentes |
| Cashback/DB4 | `lz_app_referral_redemption_policy` | Ativação explícita de novos abatimentos |

Concessões continuam em `lz_app_referral_credits`. O novo endpoint usa **uma conexão e uma transação atravessando os dois schemas**: débito, total da OS e proteção ativa confirmam juntos ou voltam juntos. Não é um par de commits independentes. A configuração recusa servidores diferentes; migrar para bancos separados exige outra arquitetura transacional.

Doze gatilhos novos no CORE protegem valores/cliente, exclusão da nota, edição de itens e cobranças vinculadas; outros dois, no DB4, protegem o histórico contra alteração arbitrária e exclusão. `sealed` permanece mesmo após reabrir o status. Os gatilhos não substituem autenticação geral dos demais endpoints legados; protegem especificamente notas com esse crédito. Não houve ALTER dos campos monetários legados — inclusive `os.desconto`, que atualmente é inteiro e não deve receber os R$ 9,90 como se fosse um decimal.

## Reproduzir em outro servidor autorizado

Antes de qualquer migração, faça backup privado dos dois bancos e das páginas sobrepostas. Verifique privilégios, mesma instância MySQL, schemas corretos e InnoDB. Não copie `.env`, dumps, sessões, chaves de push ou credenciais para Git/EAS.

1. Instale os novos helpers/endpoint/JS e reconcilie os patches com os arquivos atuais. Os arquivos do diretório `server/assistance/` correspondem ao `painel/` do site; não publique o diretório de testes como página funcional.
2. Com o recurso ainda desativado, crie as tabelas e proteções:

```sh
cd '/caminho/da/assistencia/public_html'
php painel/app-credit-migrate.php
php painel/tests/app-credit.php
LZ_APP_CREDIT_SQL_TESTS=1 php painel/tests/app-credit.php
node painel/tests/app-credit-ui.cjs
```

O teste SQL cria dois schemas aleatórios `lz_credit_test_<hex>_main/_cb`, com dados exclusivamente sintéticos, confere a marca do ambiente e remove somente esses schemas ao terminar. Usa transações reais, gatilhos e dois processos concorrentes. Nunca passe uma conexão de produção para inserir fixtures. O teste de código legado substitui apenas o bootstrap em memória, antes de executar salvar/totalizar; não deve carregar `conexao.php` real. As cópias de teste no repositório aceitam `LZ_ASSISTANCE_ROOT` apontando para a árvore atual da assistência. O teste visual requer Chrome/Node, bloqueia HTTP/HTTPS e usa AJAX simulado.

3. Atualize os leitores CORE e reinicie somente `lzgames-api.service` pelo gerenciamento do servidor. Confirme saúde e rejeição de consultas sem autenticação.
4. Ative explicitamente após os testes:

```sh
php painel/app-credit-migrate.php --activate
```

No servidor atual já foi executado. A migração é repetível, conserva data e histórico e recusa substituir um gatilho divergente. **Não apagar gatilhos para forçar uma atualização em notas com crédito ativo**; revisar a alteração com migração segura.

Para pausar novos usos sem apagar saldo ou histórico:

```sh
php painel/app-credit-migrate.php --disable
```

A pausa não desfaz abatimentos existentes, não desativa as proteções e permite o estorno elegível. Nunca remover tabelas/helpers/gatilhos enquanto houver OS com crédito. Um rollback de código não deve transformar o total reduzido em valor bruto nem devolver saldo sem recompor a nota na mesma transação.

Backup desta entrega, privado: `/home/lz-servidor/.config/lzgames/app-credit-redemption-backup-csWfIA/`, com dumps anteriores dos dois bancos e arquivos sobrepostos. É material sensível; não versionar nem restaurar sobre dados novos sem reconciliação.

## Verificações da entrega

- **74 verificações PHP**, incluindo limite só de serviços, autorização, CSRF, concorrência, rollback entre schemas, idempotência, estorno, bloqueios de edição e salvamento/pagamento pelo código legado.
- **9 verificações no Chromium** com imagens a 1200 e 390 px, sem rolagem lateral; a execução sem capturas roda 7. Nenhuma chamada real ao servidor de cobrança.
- **115 testes do app**: 14 Agenda, 23 indicações, 39 push/controles, 37 efeitos e 2 de detalhe da OS. TypeScript passou.
- CORE: resumo, SQL com tabelas temporárias, leitura das OS, ponte de identidade e regressão dos 5% passaram. Configuração local de push passou; isso não comprova entrega física.
- Exportação Android/Hermes: **695 módulos**, bundle local de aproximadamente 2,1 MB em `/tmp/lzgames-android-credit-export-b3TFoE`. Não é APK.
- Após ativar: API pública saudável; endpoint financeiro sem sessão/CSRF rejeitado; **zero concessões e zero utilizações reais** nas tabelas do novo crédito na conferência. Não foram criadas notas/clientes ou recebimentos reais para demonstrar a função.

Ainda validar com a próxima versão instalada: atualização dos três saldos, detalhe da OS com abatimento, perda de conexão, troca de conta e preservação das telas de Agenda, sorteios e OS. A liberação financeira/saque dos **5%** não foi implementada por esta entrega.

# Cashback de serviços: 5% pela conclusão da OS

Implantado no servidor em 05/09/2026. Regra `service5_note_total_v1`, ativa, **somente para notas nº 480 em diante**. A última nota no momento da definição do limite era a 479, já `Entregue`; ela não recebe crédito retroativo. Todas as 172 notas existentes até esse marco foram excluídas, inclusive as ainda abertas. Nenhuma OS real foi finalizada e nenhum crédito real foi criado como teste.

## Funcionamento para a loja e para o cliente

1. O cliente indicado aceita o convite e a indicação fica `pendente`, vinculada aos IDs de clientes CORE. Aceitar o convite não concede dinheiro.
2. A loja cadastra uma nova nota/OS elegível. Notas anteriores à 480 continuam funcionando normalmente, mas não participam deste programa, mesmo quando finalizadas depois.
3. Um funcionário autorizado altera a OS para **`Finalizada`** no painel principal ou do técnico. A mudança de status e seu evento de cashback são gravados na mesma transação.
4. O processador verifica a nota e a indicação e aprova **5% para quem indicou**. A varredura ocorre a cada 15 segundos; falhas temporárias ficam registradas para nova tentativa após 60 segundos.
5. O aplicativo consulta o cashback aprovado em **Indique e ganhe cashback**, usando o mesmo resumo e histórico existentes. O APK 22 aceita a regra enviada pelo servidor; esta alteração não exige outra compilação.

Pagamento não é o gatilho: marcar apenas `pago=Sim`, salvar a nota ou alterar diretamente para `Entregue` não cria o evento. Se a nota foi finalizada corretamente e depois entregue antes da varredura, o evento de conclusão continua válido.

## Base de cálculo

O usuário confirmou a nota inteira. A base é o **total final salvo da nota**, incluindo serviços, peças e frete, após o desconto global e sem reduzir o benefício pela entrada paga:

```text
base_em_centavos = centavos(os.subtotal) + centavos(os.val_entrada)
cashback_em_centavos = arredondamento_comercial(base_em_centavos × 5 / 100)
```

Neste sistema, `subtotal` é o restante após a entrada. Não somar novamente `valor`, `mao_obra`, `vall`, itens ou frete: esses campos já compõem a nota e alguns se sobrepõem. O cálculo financeiro original da nota não foi modificado.

Exemplo: nota de R$ 200,00, com entrada de R$ 50,00 e restante de R$ 150,00 → cashback de **R$ 10,00**. Total inválido, não positivo ou benefício arredondado a zero não gera crédito.

## Proteções e limites

- Beneficiário: `indicacoes.indicador_cliente_id`. Fonte: `os.cliente = indicacoes.indicado_cliente_id`; não aceitar um ID do corpo da requisição como beneficiário.
- Uma aprovação por indicação e por OS, com unicidade no registro auditável. Repetir a finalização, reenviar a requisição ou reiniciar o processador não duplica o valor.
- Mantido o modelo existente: uma indicação pendente é consumida pela primeira conclusão elegível, **não há comissão recorrente para todas as futuras notas da mesma indicação**.
- Indicação deve existir antes do evento. Autoindicação, identidade ambígua, múltiplas indicações não canceladas para o mesmo cliente, cliente removido e indicação já liquidada não são aprovados automaticamente.
- O processador confere novamente proprietário, status e valor da OS. Se mudaram desde a conclusão, registra o motivo e não adivinha uma nova base.
- Reabertura depois do crédito não apaga nem estorna automaticamente o histórico. Outra finalização não paga novamente; cancelamento/estorno financeiro requer política própria e revisão, sem editar o lançamento original.
- A integração antiga `confirm-from-os` não pode escolher um valor ou sobrescrever aprovações enquanto a automação está ativa. Mesmo com a política desativada, lançamentos já auditados estão protegidos. A administração antiga do portal continua bloqueada.
- Valores históricos anteriores foram preservados. `cashback_aprovado_centavos` continua sendo **aprovação acumulada**, não um saldo líquido disponível para saque.
- Não foram implementados pagamento automático, PIX, saque, resgate ou conversão em pontos dos 5%. Em implantação posterior e independente, foi ativada a [concessão de R$ 9,90 no primeiro acesso elegível ao app](BONUS-APP-990.md), exclusiva para serviços e sem saque. Esse valor não entra no total aprovado dos 5%; veja [as pendências financeiras](REGRAS-INDICACOES-PENDENTES.md).

## Arquivos e bancos

CORE ativo: `/home/lz-servidor/Documentos/lzgames/api`.

- `lib/serviceReferral.js`: dinheiro em centavos, decisão, proteção de integração e processamento idempotente.
- `scripts/service-referral-migrate.js`: tabelas próprias, marco de notas e ativação explícita.
- `scripts/service-referral-worker.js`: processador `lzgames-referral-rewards` no PM2.
- `routes/referrals.js`: resumo de 5%, marco mínimo e confirmação antiga protegida.
- Cópias auditáveis em `server/core/`. `snapshots/referrals.js` é uma referência, **não uma ordem para sobrescrever o arquivo ativo**. `service-referrals.patch` contém o delta desta entrega.

Assistência ativa: `/home/lz-servidor/HOSTINGER SITE DOCUMENTOS/sistema2026.lzgames.com.br/public_html`.

- `painel/service-referral.php`: validação de sessão/permissão e transação de status/evento.
- Integração em `painel/paginas/os/status.php` e `painel/paginas/os_tecnico/status.php`.
- Cópia e patch em `server/assistance/`; mensagens de WhatsApp e demais rotinas existentes foram preservadas.

Tabelas novas no CORE: `lz_service_referral_policy`, `lz_service_referral_baseline`, `lz_service_referral_outbox`. No banco de cashback: `lz_service_referral_credits`, com chaves únicas por OS e indicação. A aprovação na tabela existente `indicacoes` e o lançamento auditável são atômicos no banco de cashback. Se houver falha antes da confirmação no CORE, a repetição reconhece o crédito já existente.

Não houve ALTER/DROP em tabelas financeiras legadas. A migração acrescenta campos apenas à nova tabela de política. O marco é persistente (`min_os_id=480`) e não é recalculado a cada reinício ou reativação.

## Testes e operação

Testes locais, sem enviar mensagens ou modificar clientes reais:

```sh
cd /home/lz-servidor/Documentos/lzgames/api
node --test tests/serviceReferral.test.js tests/serviceReferral.routes.test.js tests/referralAuth.test.js

cd /home/lz-servidor/projetos/APP-LZGAMES
php server/assistance/tests/service-referral.php
npm run test:referrals
npm run typecheck
```

Também foram executadas fixtures MySQL isoladas, com tabelas **TEMPORARY** nas conexões exclusivas do teste: crédito, repetição, rollback, integração antiga e recusa de nota anterior ao marco. As fixtures PHP/PDO cobrem o limite e os dois perfis de funcionário; não chamam os endpoints de WhatsApp. Resultados: 27 testes CORE, 1 suíte MySQL, 43 verificações PHP, 10 verificações PDO/MySQL e 18 testes do recurso no app.

Verificação operacional somente leitura:

```sh
systemctl is-active lzgames-api.service
pm2 describe lzgames-referral-rewards
curl --fail --silent --show-error https://app.lzgames.com.br/api/health
```

O worker foi salvo no PM2, cujo serviço de inicialização já está habilitado. Logs contêm categorias e contagens, não telefone, senha, token, valor de cliente ou SQL bruto. A configuração existente em `/etc/lzgames/` e no `.env` do CORE permanece apenas no servidor, fora do Git e do APK.

### Reproduzir uma implantação autorizada

Não executar concessões em uma base real para testar. Primeiro fazer backup privado, reconciliar patches e código, executar os testes e criar as tabelas com a política desativada. No servidor desta entrega, o limite aprovado é **479 como última nota excluída**; não substituir esse número pelo último ID de outra data sem uma nova decisão.

```sh
cd /home/lz-servidor/Documentos/lzgames/api
node scripts/service-referral-migrate.js
# Política deve estar pausada; repetir o mesmo marco é idempotente.
node scripts/service-referral-migrate.js --start-after-os=479
```

Depois de instalar os hooks nos dois painéis, atualizar a API e iniciar o worker, ativar explicitamente:

```sh
node scripts/service-referral-migrate.js --activate
```

Não criar outro worker com o mesmo nome. Em uma instalação sem esse processo, usar `pm2 start scripts/service-referral-worker.js --name lzgames-referral-rewards --cwd /home/lz-servidor/Documentos/lzgames/api --time --kill-timeout 20000`, conferir a saúde e só então `pm2 save`. Não reiniciar outros serviços. Uma reativação mantém o marco e o histórico.

### Pausa/rollback

Para interromper novas concessões, alterar **somente** `lz_service_referral_policy.enabled` para `0` pela conexão administrativa autorizada e parar **somente** `lzgames-referral-rewards`. Não apagar eventos/lançamentos, não restaurar dumps inteiros sobre dados recentes e não remover as tabelas enquanto os hooks estiverem instalados. Restaurar arquivos exige reconciliar os patches e preservar alterações posteriores.

Backups originais privados desta intervenção: `/home/lz-servidor/.config/lzgames/referral-service5-backup-nYJbhv/`. Não publicar os dumps ou a cópia do estado PM2. A validação física da tela no aparelho continua pendente; nenhum teste desta entrega usou uma conta real para conceder cashback.

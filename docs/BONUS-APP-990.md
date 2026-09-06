# Bônus de indicação do app: R$ 9,90 no primeiro acesso

Em 05/09/2026 o usuário confirmou o **primeiro acesso do indicado ao app** como gatilho. O servidor foi ativado às **17:21:35 de Maceió / 20:21:35 UTC**, regra `app_first_use_990_v1`. Beneficiário: **quem indicou**, não quem instalou.

## O que está pronto e o que ainda falta

- Ativos: captura autenticada, atribuição com horário do servidor, processamento automático, lançamento auditável de **990 centavos**, proteção contra repetição e consulta separada do crédito.
- Convite opcional na entrada/cadastro e cartão próprio de crédito para serviços fazem parte do [APK 23](BUILD-23.md), enviado posteriormente a pedido do usuário. **Não estão no APK 22.** O registro do build informa estado, download e verificações; teste físico pendente, sem publicação na Play Store.
- O [abatimento controlado nas OS foi ativado posteriormente, às 18:05 de Maceió](USO-CREDITO-APP.md), com saldo disponível/usado separado e estorno de notas abertas ainda não pagas. Permanecem pendentes: estornos pós-fechamento, liberação financeira dos 5% e teste físico da nova versão. Não oferece saque/PIX do crédito do app.
- Os [5% por conclusão de serviço](CASHBACK-SERVICOS-5.md), somente da nota 480 em diante, permanecem independentes e inalterados. O bônus do app não altera o status/valor da indicação de serviço, nem entra em pontos, carteira Agenda ou saques antigos.

## Fluxo do cliente

1. Quem indica abre **Indique e ganhe cashback → Compartilhar convite**. Nada é enviado automaticamente.
2. Antes do primeiro acesso, o amigo cola o link/código em **Recebi um convite**, na entrada ou cadastro da nova versão. Continuar com o campo preenchido autoriza o vínculo. Um cliente já cadastrado também pode aceitar o link no portal web antes de entrar no app.
3. O app valida o formato localmente, autentica/cadastra, confirma a indicação no CORE e **só depois** abre a tela inicial e registra presença. Se o vínculo falhar, a pessoa corrige e tenta novamente sem cadastrar a conta uma segunda vez. Há opção de sair da conta; apagar o convite permite continuar sem indicação.
4. O primeiro registro autenticado de presença Android/iOS produz um evento imutável. O worker verifica a identidade canônica e a indicação anterior e lança R$ 9,90 para o indicador. Normalmente processa em até 15 segundos; indisponibilidade pode aumentar esse prazo.
5. O indicador atualiza a área de cashback para consultar os créditos. Três amigos elegíveis geram **R$ 29,70** em créditos exclusivos para serviços, sem saque, sem expiração automática. Não se misturam com o total histórico de 5% aprovado.

Entrar sem convite anterior consome a condição de primeiro uso sem gerar bônus. Um convite aceito depois, inclusive na tela de cashback de uma sessão já aberta, não gera os R$ 9,90 retroativamente. Reinstalação, novo login e troca de provedor não renovam o benefício.

Se a pessoa fechar o app entre autenticação e confirmação do convite, a sessão pode ser restaurada sem vínculo. Não existe aceite automático de convites pendentes no boot: nenhum convite é armazenado para associar silenciosamente uma conta futura. A pessoa deve resolver a falha de vínculo antes de sair dessa etapa; este limite deve ser considerado no teste físico.

## Evidência, identidade e limitações

- Fonte: `POST /api/app/device`, com Bearer e provedor validados nos endpoints fixos CORE/TurboBox. Não há endpoint público de concessão e o corpo não define indicador nem valor.
- Presença e evento são gravados na **mesma transação SQLite**. O cliente informa a plataforma; páginas web/preview web não qualificam. Consentimento de push/WhatsApp não é requisito financeiro e não é alterado pelo bônus.
- Identidade final: `CORE.clientes.id`, após conferir provedor, contato atual e correspondência única pelo telefone brasileiro completo. Ambiguidade ou indisponibilidade bloqueia a concessão e mantém o evento para revisão/nova tentativa.
- Registro imutável por provedor/conta e hash do contato; no cashback, unicidade também por cliente indicado canônico, telefone, evento e indicação. Um reinício entre commit e confirmação da fila não paga novamente.
- Presenças nativas anteriores conhecidas, inclusive desvinculadas, foram registradas como histórico sem crédito. No servidor havia duas instalações de uma identidade canônica: **um evento de exclusão histórica, zero concessões reais** na verificação da implantação.
- O cadastro ainda **não exige OTP de posse de telefone nem atestação criptográfica da instalação**. A proteção cadastral não prova pessoa física única nem elimina cadastros artificiais. Não prometer proteção antifraude absoluta.
- A fonte antiga `app_devices` pode sobrescrever o dono da instalação. A migração preserva o histórico disponível, não inventa informação perdida. Da ativação em diante o novo diário mantém a primeira observação independentemente desses upserts.
- Apenas uma indicação válida anterior pode receber o bônus. Autoindicação, conta do indicador com o mesmo contato, múltiplos indicadores e indicação cancelada não recebem concessão automática. Cancelamento posterior a uma concessão não causa estorno automático.

## Arquivos e dados

Sorteios ativo: `/home/lz-servidor/apps/lzgames-sorteios`.

- `lib/app-referral-first-use.php`: captura, migração explícita, resolução, decisão e lançamento.
- `lib/app-messaging.php`: hook `app_referral_capture` no final da transação de presença.
- `app-referral-migrate.php`: cria apenas tabelas próprias, exclui presenças anteriores e ativa explicitamente. Não limpa nem recalcula história na reativação.
- `app-referral-worker.php`: worker CLI único, lock de processo, intervalo de 15 s; falha transitória reentra na fila após 60 s. Sem mensagens, WhatsApp ou concessão no processo HTTP.
- SQLite `.data/sorteios.sqlite`: `app_referral_policy`, `app_referral_first_uses`, `app_referral_worker_health`.

CORE ativo: `/home/lz-servidor/Documentos/lzgames/api`.

- `lib/appReferral.js` e integração em `routes/referrals.js`: aceite e evidência UTC com microssegundos em uma transação; resumo somente leitura, limitado ao cliente autenticado.
- DB4: `lz_app_referral_attributions`, `lz_app_referral_first_uses`, `lz_app_referral_credits`.
- Atribuições novas têm `bound_at_utc`, permitindo distinguir um vínculo anterior de outro posterior mesmo no mesmo segundo. Para indicações antigas sem essa evidência, `created_at` local deve preceder o segundo inteiro do primeiro acesso. Na dúvida não há bônus automático.
- Nenhum ALTER/DROP foi feito nas tabelas legadas. As novas indicações continuam no fluxo existente; somente recebem evidência temporal própria na mesma transação.

App: `src/referralEntry.ts`, `App.tsx`, `src/api.ts`, `src/ReferralRewards.tsx`. Os leitores antigos continuam recebendo os campos anteriores. O resumo acrescenta:

```json
{
  "app_referral_credit": {
    "rule_version": "app_first_use_990_v1",
    "bonus_centavos": 990,
    "creditos_acumulados_centavos": 1980,
    "indicacoes_premiadas": 2,
    "usage_restriction": "services_only",
    "withdrawable": false,
    "creditos_utilizados_centavos": 990,
    "saldo_disponivel_centavos": 990,
    "redemption_enabled": true,
    "trigger": "first_authenticated_native_app_use",
    "expires": false
  }
}
```

Exemplo sintético, não saldo de cliente real. O total acumulado continua sendo concessões. A implantação de [utilização nas notas](USO-CREDITO-APP.md) acrescenta débitos/estornos auditáveis, bloqueia gasto acima do saldo e limita o abatimento à parte elegível de serviço; não reutiliza o saque/pontos legado.

## Operação e reprodução

Cópias auditáveis: `server/raffles/` e `server/core/`. Reconciliar os patches com os arquivos ativos; não sobrescrever alterações alheias usando snapshots. Credenciais permanecem somente no servidor (`/etc/lzgames/`); nunca copiar para Git/EAS ou imprimir em diagnósticos.

Ordem em outro servidor autorizado, depois dos backups e testes:

1. Instalar os helpers/CLI de Sorteios, sem ativar; executar `php app-referral-migrate.php`.
2. Reconciliar o hook de presença e as alterações CORE, incluindo `lib/appReferral.js`; reiniciar apenas a API CORE e conferir saúde.
3. Executar `php app-referral-migrate.php --activate`.
4. Iniciar **uma** instância no PM2:

```sh
cd /home/lz-servidor/apps/lzgames-sorteios
pm2 start app-referral-worker.php --name lzgames-app-referral990 --interpreter php --time --max-memory-restart 96M --restart-delay 3000
pm2 save
```

No servidor atual esses passos **já foram executados**. Não iniciar outro worker. `pm2 restart lzgames-app-referral990` recarrega alteração de código; o processo longo não recarrega PHP sozinho. Após mudanças de configuração de processos, salvar novamente o PM2 sem revelar o ambiente.

Inspeção somente leitura:

```sh
sqlite3 .data/sorteios.sqlite 'SELECT enabled,activated_at FROM app_referral_policy; SELECT baseline,outcome,COUNT(*) FROM app_referral_first_uses GROUP BY baseline,outcome; SELECT heartbeat_at FROM app_referral_worker_health;'
```

Backup privado anterior em `/home/lz-servidor/.config/lzgames/app-referral990-backup-0qH3k3/`, incluindo snapshot SQLite, arquivos sobrepostos do app/servidor e configuração PM2. Não versionar esse diretório.

Para pausar apenas o processamento e manter a elegibilidade dos novos eventos: parar **somente** `lzgames-app-referral990`. Para desativar novas concessões: `php app-referral-migrate.php --disable`; acessos durante a desativação são preservados como não elegíveis. Nenhuma opção apaga ou estorna créditos. Não remover tabelas, truncar fila nem resetar a data de ativação.

## Validação original da concessão (antes do abatimento)

Para a validação posterior do uso nas notas, consulte [USO-CREDITO-APP.md](USO-CREDITO-APP.md).

- 112 testes do app: 14 Agenda, 22 indicações/entrada, 39 push/controles e 37 efeitos; TypeScript sem erros.
- 37 verificações PHP do novo fluxo, inclusive MySQL real com tabelas **TEMPORARY**, sem alterar cadastros ou conceder crédito real.
- Testes CORE de resumo/aceite, 5% e ponte de identidade; testes SQL adicionais opt-in em conexões exclusivas com tabelas temporárias.
- Regressão dos testes PHP existentes de autenticação, push, fonte de serviços, agenda e lembretes.
- Saúde CORE pública HTTP 200; resumo privado e inbox sem sessão retornam 401. Worker online e com heartbeat, histórico excluído, zero créditos reais criados durante os testes.

```sh
# APP
npm run typecheck
npm run test:referrals
npm run test:agenda
npm run test:push
npm run test:effects

# Sorteios; sem rede nos testes básicos
php tests/app-referral-first-use.php
# Financeiro isolado, somente no servidor autorizado:
LZ_APP_REFERRAL_SQL_FIXTURES=1 php tests/app-referral-first-use.php

# CORE
node --test tests/appReferral.test.js tests/appReferral.sql.test.js tests/serviceReferral.routes.test.js
LZ_APP_REFERRAL_SQL_FIXTURES=1 node --test tests/appReferral.sql.test.js
```

Ainda testar no aparelho novo: convite na criação/entrada, crédito aparecendo para o indicador após atualizar, erro de vínculo recuperável, login repetido, reinstalação, permissão de push negada e contas CORE/TurboBox. Não usar um cliente real para fabricar elegibilidade nem pagar bônus apenas para testar.

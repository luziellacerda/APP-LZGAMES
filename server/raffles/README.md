# Bônus do app: servidor Sorteios

**Atualização ativa:** [vínculo único, evidência financeira e proteção contra instalação reutilizada](../../docs/SEGURANCA-INDICACOES-AGENDA-CPF.md). Reconciliar `app-messaging.php` e `app-referral-first-use.php` em conjunto, aplicar o schema SQLite aditivo e reiniciar somente o worker correspondente. As guardas financeiras também dependem das tabelas CORE/DB4 novas; não implantar só metade da integração. A cópia de testes passou em 44 verificações com tabelas temporárias, sem concessões reais.

Cópias auditáveis da implantação de R$ 9,90 pelo primeiro acesso autenticado elegível. Não são outro site para publicar e não contêm bancos, clientes ou credenciais. `server/` permanece excluído do EAS.

Leia [BONUS-APP-990.md](../../docs/BONUS-APP-990.md) para fluxo completo, ativação, rollback, limites e teste físico pendente. O abatimento nas notas ainda não está implementado; crédito acumulado não permite saque.

- Destino real: `/home/lz-servidor/apps/lzgames-sorteios`.
- Arquivos novos: `lib/app-referral-first-use.php`, `app-referral-migrate.php`, `app-referral-worker.php`, teste correspondente.
- `app-presence-hook.patch` é a mudança mínima no `lib/app-messaging.php` existente. A cópia completa desse arquivo e de `app-service-source.php` serve para auditoria e testes; não sobrescrever versões mais novas cegamente.
- A ligação CORE, o resumo autenticado e a evidência temporal do convite estão em `../core/`, especialmente `app-referral990.patch` e `lib/appReferral.js`.

Teste isolado desta cópia:

```sh
php server/raffles/tests/app-referral-first-use.php
```

Não executar migração/worker dentro desta cópia: os comandos de operação destinam-se ao servidor real. As tabelas financeiras temporárias exigem variável opt-in e configuração privada do servidor; não usar dados de clientes como fixtures.

# Integrações na assistência

Leia [USO-CREDITO-APP.md](../../docs/USO-CREDITO-APP.md) e [CASHBACK-SERVICOS-5.md](../../docs/CASHBACK-SERVICOS-5.md) antes de implantar. São programas separados: crédito do app utilizável só em serviços, e aprovação histórica de 5% por conclusão elegível.

Os caminhos relativos deste diretório correspondem a `painel/` na assistência. `app-credit-integration.patch` documenta alterações em páginas/PDF existentes; `service-referral-status.patch` registra a integração anterior de status. Reconciliar, não sobrescrever arquivos inteiros de outra versão.

Arquivos novos de crédito: `app-credit.php`, `app-credit-schema.php`, `app-credit-migrate.php`, `paginas/os/app_credit.php`, `js/app-credit.js` e testes. Dependem do `service-referral.php` já presente para autorização/origem. Migração somente CLI, explícita; não usar a navegação no site para migrar.

Teste unitário desta cópia:

```sh
php server/assistance/tests/app-credit.php
```

Para os testes SQL/código legado/visuais, use a árvore completa da assistência com assets e páginas reconciliadas. `LZ_ASSISTANCE_ROOT` permite indicar essa raiz ao executar a cópia dos testes. A variável não contém credenciais. O teste SQL requer autorização de criação/remoção somente de schemas sintéticos aleatórios; o visual usa o Chrome local e não envia chamadas reais.

Nenhum dump, sessão, ambiente ou chave deve entrar neste diretório. `server/` é excluído do pacote EAS. Pausar usos com `php painel/app-credit-migrate.php --disable` preserva notas, saldos e histórico. Não remover proteções de OS com crédito ativo.

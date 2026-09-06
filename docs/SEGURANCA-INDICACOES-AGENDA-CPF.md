# Indicação única e correção da agenda por CPF

Implantação em 05/09/2026. As proteções abaixo já estão no servidor. Os ajustes do aplicativo estão separados em [BUILD-25.md](BUILD-25.md), compilado e publicado posteriormente em 06/09/2026. O [APK 24](BUILD-24.md) concluído anteriormente não contém os aumentos de Lotties nem a mudança local de compartilhamento desta rodada.

## Regras no servidor

- A primeira indicação aceita e validada reserva o cliente e seu telefone globalmente: outro indicador não pode convidar essa mesma pessoa novamente.
- A reserva usa ID canônico CORE, telefones completos normalizados (principal e secundário) e CPF válido, quando disponível. DDI, pontuação e variação legada do nono dígito não criam outra pessoa. Não há comparação apenas pelo final do telefone.
- Trocar telefone/CPF depois, cancelar a indicação ou apagar seu registro legado não libera as reservas históricas. Registros de identidade não possuem exclusão em cascata.
- Cada ação de gerar convite emite um código aleatório assinado e registrado no banco. Cada código vincula no máximo um destinatário; assinatura válida sem emissão registrada não basta.
- Repetir exatamente o mesmo aceite já concluído, com a mesma identidade íntegra e indicação não cancelada, é idempotente: retorna o vínculo existente sem criar outro. Usá-lo com outra conta ou pessoa é recusado.
- Autoindicação, CPF/telefone compartilhado, perfil duplicado, sessão com contato desatualizado e ciclos de indicação são recusados. Identidades e beneficiário são resolvidos no cadastro atual do servidor, não escolhidos pelo corpo da requisição.
- Transação, trava de concorrência e chaves únicas garantem um vencedor quando dois indicadores disputam uma pessoa ou duas pessoas tentam consumir um convite. Falha intermediária desfaz inserções parciais.
- Emissão e aceite possuem limites persistentes por conta/ação e IP. Alterar somente a interface ou chamar a API diretamente não contorna a unicidade.
- Ambos os processadores financeiros exigem vínculo auditado íntegro e reservas permanentes. Indicação manual sem essa evidência, vínculo alterado ou legado ambíguo não gera recompensa automaticamente.
- O diário da primeira instalação observada impede bônus em outra conta com telefone diferente na mesma instalação identificada. A presença e os avisos continuam funcionando; a restrição é financeira.

O telefone fica reservado no **aceite autenticado válido**, quando o sistema conhece o destinatário. Criar ou abrir um link, sem aceite, não identifica nem reserva antecipadamente um telefone.

Convites antigos determinísticos não são aceitos para novos vínculos. É necessário gerar e compartilhar outro. O APK 23/24 entende os códigos novos, mas pode manter o último link em memória na mesma tela: até instalar a próxima versão, saia da tela de indicações e entre novamente antes de convidar outra pessoa. A fonte 25 solicita um novo código a cada compartilhamento explícito. Não revogar indiscriminadamente convites já emitidos e ainda não usados.

## Financeiro preservado

- R$ 9,90 ao indicador somente no primeiro acesso autenticado elegível ao app, com indicação anterior. Crédito acumulável exclusivamente para serviços, sem saque e sem expiração nova.
- Cashback de serviço de 5% continua dependendo da OS elegível, nº 480 em diante, marcada como Finalizada no painel. Notas anteriores continuam excluídas; pagamento não substitui a conclusão.
- Nenhum novo gatilho por download, abertura de link, cadastro ou clique. Nenhuma aprovação, estorno ou transferência retroativa foi executada nesta implantação.
- As três indicações legadas encontradas eram canceladas e conflitantes. As três identidades foram importadas para proteção e marcadas para conferência. Não foram excluídas nem reabertas. A verificação final continuou com zero concessões de app e zero concessões de serviços; os testes não usaram clientes reais.

## Limites conhecidos — não prometer proteção absoluta

O cadastro não comprova posse do telefone por OTP. Validar dígitos do CPF não prova titularidade. IDs de instalação são informados pelo cliente, podem mudar numa reinstalação e não são atestação de aparelho. Contas artificiais com novos dados válidos ainda exigem controles adicionais: comprovação de posse, verificação de titularidade e, se adotada, atestação nativa. IP/dispositivo compartilhado também não prova que duas pessoas sejam a mesma.

Não foi acrescentada silenciosamente uma etapa de OTP nem alterado o gatilho financeiro já autorizado. Histórico anterior que tenha sido apagado antes desta implantação e não esteja mais disponível não pode ser reconstruído por suposição. Perfil duplicado precisa ser conferido pela loja; não consolidar clientes nem movimentar saldos automaticamente.

As decisões de validação no servidor, credencial por operação e proteção contra repetição seguem os princípios de [autorização de transações da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) e de [segurança da lógica de negócio](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html). Travas e invariantes do banco complementam a aplicação; não dependem de esconder o botão.

## Agenda: erro real encontrado e correção

O arquivo publicado é `/home/lz-servidor/Documentos/lzgames/agenda/index.php`, não a pasta antiga `systema/agenda`. Os registros do nginx mostraram `SQLSTATE[23000]`, erro 1062, índice `uq_usuario_cpf` ao confirmar. Havia CPF equivalente em dois formatos históricos: com pontuação e só números. O cadastro certo era localizado pelo telefone, mas a atualização tentava transformar o CPF já equivalente no formato sem pontuação, colidindo com a outra linha.

`booking-customer.php` agora resolve o telefone completo dentro da transação da reserva e compara CPF normalizado antes de atualizar. Se o cadastro correto já tem o mesmo CPF, reutiliza seu ID e preserva a representação armazenada. Não apaga duplicatas, não transfere reservas nem associa o cliente errado pelo CPF. Um CPF diferente ou realmente pertencente a outro telefone continua sendo recusado com mensagem específica. A ponte móvel traduz os códigos conhecidos em mensagens seguras, sem exibir erro SQL.

Permanecem as regras anteriores de calendário, feriados, profissionais, intervalos de uma hora, bloqueio de almoço 12h–14h e confirmação WhatsApp após uma reserva efetiva. Não foi enviada reserva real nem WhatsApp de teste.

## Arquivos e operação

| Componente | Caminho ativo | Cópia de manutenção |
| --- | --- | --- |
| CORE | `/home/lz-servidor/Documentos/lzgames/api` | `server/core/` |
| Diário e crédito do app | `/home/lz-servidor/apps/lzgames-sorteios` | `server/raffles/` |
| Agenda PHP | `/home/lz-servidor/Documentos/lzgames/agenda` | `server/agenda/` |
| Ponte móvel | `/home/lz-servidor/releases/turbobox/coupons-v1-20260902` | `server/turbobox/` |

CORE: novos `lib/referralGuard.js`, `lib/referralGuardSchema.js`, `scripts/referral-guard-migrate.js`; alterações em `routes/referrals.js`, `lib/appInvite.js`, `lib/serviceReferral.js` e validação dos dígitos do CPF no cadastro em `routes/authRoutes.js`. Os dois patches `referral-guard-integration.patch` e `referral-cpf-registration.patch` documentam a integração. O snapshot é referência, não autorização para sobrescrever alterações futuras.

SQLite: `lib/app-referral-first-use.php` cria as tabelas de instalação e bloqueio, mantendo o diário e ledgers existentes. `lib/app-messaging.php` fornece o hash validado da instalação ao capturar presença. A rotina `app_referral_schema` foi executada no banco existente, de forma aditiva; o worker usa o mesmo arquivo.

Agenda: colocar o helper ao lado de `index.php` e reconciliar `server/agenda/booking-customer-integration.patch`. A ponte `mobile-agenda-auth.php` permanece ao lado de `mobile-api.php`. Não substituir a monolítica Agenda pelo helper.

### Reproduzir em outro servidor autorizado

1. Fazer backup privado dos arquivos ativos e snapshot consistente dos bancos. Nesta máquina foi usado o diretório privado `/home/lz-servidor/.config/lzgames/referral-guard-backup-Cd8aCO`; não publicar esse diretório.
2. Disponibilizar os novos helpers CORE e reconciliar rotas/validações sem retirar alterações existentes. As migrações financeiras anteriores e seus ledgers devem existir. Configurações de banco, chaves e credenciais ficam fora do Git.
3. Na raiz da API CORE, executar **uma vez na implantação**, não como teste de consumo:

   ```bash
   node scripts/referral-guard-migrate.js --apply
   ```

   Cria as quatro tabelas `lz_referral_invites`, `lz_referral_bindings`, `lz_referral_claims`, `lz_referral_limits` e importa todas as indicações legadas, inclusive canceladas. É aditiva e reexecutável, não concede dinheiro. Rever as contagens de conflitos, sem expor dados pessoais.
4. Atualizar helpers PHP de presença e concessão; executar a rotina de schema SQLite no bootstrap existente. Reiniciar somente os processadores afetados `lzgames-referral-rewards` e `lzgames-app-referral990` e recarregar a API `lzgames-api.service`. Não reiniciar todos os serviços da empresa.
5. Integrar a correção da Agenda e os textos da ponte móvel. Não é necessária migração ou fusão de clientes da Agenda.
6. Rodar testes isolados e conferir `/api/health`, download e geração pública genérica. Não criar indicação/agendamento/WhatsApp real para diagnóstico sem destinatário e cenário de teste autorizados.

### Verificações executadas

Na raiz CORE:

```bash
LZ_REFERRAL_SQL_FIXTURES=1 LZ_GUARD_SQL_FIXTURES=1 node --test tests/referralGuard*.test.js tests/serviceReferral*.test.js tests/referralAuth.test.js tests/appInvite.test.js
```

44 testes passaram. O teste concorrente usa tabelas sintéticas com prefixo aleatório, allowlist e conexões independentes. Remove somente essas tabelas ao terminar, nunca clientes ou registros de produção. Os testes financeiros usam tabelas temporárias da conexão. Inclui telefone/CPF antigo após edição, identidade duplicada, convite forjado/não emitido, uso único, concorrência, rollback, ciclo, cancelamento, exclusão e limite de tentativas.

Na aplicação de sorteios: `LZ_APP_REFERRAL_SQL_FIXTURES=1 php tests/app-referral-first-use.php`: 44 verificações, incluindo bloqueio de instalação reutilizada e vínculo financeiro sem evidência íntegra.

Na Agenda: `LZ_AGENDA_SQL_FIXTURES=1 php tests/booking-customer.php`: 11 verificações; reprodução SQL da colisão por CPF e preservação das duas linhas. Sem reservas ou mensagens reais.

Na raiz APP: TypeScript e 125 testes do app passaram; `php server/turbobox/tests/mobile-agenda-auth.php` passou em 148 verificações offline. O teste da página de convite passou em 36 verificações no navegador com rede totalmente interceptada. Firebase cliente validado. Essas conferências não substituem uso real em Android.

### Reversão segura

Preservar sempre reservas de identidade, histórico de consumo e ledgers. Não apagar as tabelas de proteção nem restaurar o banco antigo por cima de dados novos. Se for necessário reverter código de indicação, suspender temporariamente a emissão/aceite e os processadores correspondentes antes de reconciliar versões; voltar ao endpoint antigo sem guardas reabre o abuso. Não desabilitar a regra financeira ou liberar indicações em revisão para contornar erros.

A Agenda pode ter a integração revertida a partir do backup do arquivo, sem apagar dados, mas isso reintroduz a colisão confirmada de CPF. Revalidar o caminho realmente publicado antes de qualquer alteração. O APK 23 foi mantido ao publicar o 24; cada arquivo tem nome versionado e hash próprio.

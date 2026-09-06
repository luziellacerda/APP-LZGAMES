# APK 21 — LZ-GAMES / VFX-12

Registro de 05/09/2026. **Compilação concluída (`FINISHED`), APK baixado e verificado. Validação física no celular: PENDENTE.**

[Baixar APK 21](https://expo.dev/artifacts/eas/7rw5i36ShXdlNwxd4OONK8-0CW7AhVs3guz4arvGu5A.apk).

- [Acompanhar esta compilação no Expo](https://expo.dev/accounts/lzgames/projects/lz-games/builds/9a855d84-923b-4ed0-841f-dbe408a127aa).
- ID: `9a855d84-923b-4ed0-841f-dbe408a127aa`.
- Criado em `2026-09-05T17:57:09.548Z`; concluído em `2026-09-05T18:05:24.063Z`. Estado confirmado pelo EAS: `FINISHED`, prioridade `HIGH`.
- Versão `1.0.1`, Android `versionCode 21`, pacote `br.com.lzgames.app`, nome `LZ-GAMES`.
- Perfil `preview`: APK de instalação direta. Não é publicação na Play Store.
- Fonte do app congelada para esta compilação. Não enviar outro build apenas para acompanhar o progresso.

Consulta somente leitura:

```bash
npx eas-cli build:view 9a855d84-923b-4ed0-841f-dbe408a127aa
```

O link acima é o artefato retornado pelo EAS para esta compilação. O arquivo foi baixado e teve assinatura, pacote e conteúdo conferidos separadamente, conforme o registro abaixo. Os dados do [APK 20](BUILD-20.md) permanecem como histórico.

## Mudanças incluídas

1. Foguete, calendário e ferramentas passam a usar três animações vetoriais obtidas na web, com arquivos e termos de licença dentro do app. Não há download de animações durante a reprodução. Origem e adaptações em [assets/README.md](../src/effects/assets/README.md).
2. O troféu dos cards fica aproximadamente 12% menor: escala interna de `1.7×` para `1.5×`, preservando os espaços de 86 e 88 pontos. Mantidos o giro selecionado, as moedas de fundo e o respeito à preferência de reduzir movimento.
3. Revisão visual `VFX-12`, identificável no preview de desenvolvimento. O marcador não aparece na tela de produção.
4. Preferência independente **Minha conta → OS e agendamentos → Ativar**, para avisos de status de OS e lembretes de agenda pelo app/push. As opções de sorteios e WhatsApp continuam separadas.
5. Avisos privados da central usam rótulos e destinos próprios: OS abre **OS**, agendamento abre **Agenda**. A central é reutilizada em Conta e Sorteios. Avisos globais antigos continuam abrindo Sorteios; tipos desconhecidos não recebem ação de navegação.

## Regras de OS e agendamentos

O servidor consulta a fonte atual de serviços em ciclos de aproximadamente 60 segundos, somente para clientes vinculados que ativaram essa categoria. A primeira leitura cria uma base de observação; não dispara alterações anteriores à ativação. O monitor não reconstrói o histórico completo das OS e pode não observar mudanças intermediárias entre duas leituras. A leitura não altera OS ou agendamentos de origem.

- **Status de OS:** uma alteração observada pode gerar aviso para o próprio cliente, inclusive a alteração que encerra uma OS.
- **Resumo de OS:** uma única contagem de três dias por cliente, desde o início do acompanhamento ou o último aviso de OS gerado. O resumo reúne apenas OS ativas; OS encerradas não recebem lembretes periódicos. Isso evita resumos diários causados por OS com datas diferentes.
- **Agenda:** lembretes de 6, 3 e 1 hora antes, no fuso `America/Maceio`. Ativação tardia não recupera lembretes cujo horário já passou. Cancelamento, remoção ou remarcação invalida pendências antigas; a nova programação usa sua própria revisão.
- **Canais:** essa categoria usa o app e push, sem disparos por WhatsApp. Os canais Android `os` e `agenda` são configurados como `PRIVATE` na tela bloqueada. O canal de sorteios permanece separado.

O registro usa `scope: 'services'`; o escopo legado, omitido ou `raffles`, continua reservado aos sorteios. O token é compartilhado pela instalação, mas cada autorização é independente. Sua renovação usa `refreshOnly` e não deve reativar uma preferência revogada. Desativar uma categoria remove apenas seus avisos locais; sair da conta limpa todos e solicita a desvinculação autenticada.

O backend restringe os avisos privados à identidade do cliente e revalida origem, autorização e programação antes do transporte. Mensagens já aceitas pelo provedor não podem ser recolhidas. Os prazos são de programação, não garantia de entrega imediata no aparelho.

## Backend ativo

Verificação informada em 05/09/2026: processador de notificações ativo com PID `213739`, heartbeat às `18:05:55` no registro do servidor, duas tabelas de monitoramento instaladas e nova autorização de serviços disponível. Naquele momento havia **zero autorizações da nova categoria e zero jobs privados**. A próxima etapa é instalar o APK 21 e o cliente ativar a opção em Conta. Não houve envio real de notificação para teste.

## Validações locais da fonte congelada

- `npm run typecheck`: aprovado.
- `npm run test:push`: 37 testes aprovados.
- `npm run test:effects`: 37 testes aprovados.
- Exportação Android local: aprovada.
- Prévia SVG local das animações: aprovada.

Os testes do app usam fixtures locais e cobrem autorizações, revogação, navegação, erros e estados de movimento. Não houve envio real de notificação nesta preparação. Exportações locais e atualizações posteriores desta documentação não alteram a fonte enviada para o build 21. Exportação e prévia SVG não substituem a conferência do APK, renderização nativa ou teste físico.

Na conferência final, `typecheck`, os 37 testes de push e os 37 testes de efeitos foram executados novamente e passaram.

## Conferência do APK concluído

Verificação concluída em `2026-09-05T18:08:28.267Z`: **21 de 21 conferências aprovadas**.

Arquivo local: `play-store/LZ-GAMES-build21.apk` (ignorado no Git), **72.602.534 bytes**.

```text
SHA-256: 2670ddb15dd5e9d4e42b63c5f349bde629587a95984691820222fd873ade6d04
```

- Pacote `br.com.lzgames.app`, versão `1.0.1` e Android `versionCode 21`.
- Assinatura válida, com o mesmo certificado do APK 20.
- Permissão de notificações, serviço FCM e identificadores de projeto, sender e app Firebase conferidos.
- Bundle Hermes contém os cinco marcadores verificados dos fluxos de serviços, além dos fluxos de sorteios e moedas.
- As quatro animações obtidas na web — foguete, calendário, ferramentas e troféu — estão no pacote, com autores e termos completos das licenças.

Essas conferências verificam o arquivo distribuído. Não comprovam instalação, reprodução nativa, toque ou recebimento de push em um celular.

## Pendências da entrega

1. Instalar o APK 21 no aparelho autorizado e verificar os três ícones, o tamanho do troféu, a pausa das animações e os controles em Conta.
2. Ativar **OS e agendamentos**, conceder permissão e testar recebimento e abertura em OS/Agenda com o app aberto, em segundo plano e fechado.
3. Verificar no aparelho revogação por categoria, saída/troca de conta, cancelamento/remarcação e privacidade na tela bloqueada. Os testes devem usar contas e destinatários controlados.

Configuração e operação no [guia de notificações push](NOTIFICACOES-PUSH.md).

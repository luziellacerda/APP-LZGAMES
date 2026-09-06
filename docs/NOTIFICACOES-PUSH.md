# Notificações push LZ-GAMES

## Estado desta entrega — 05/09/2026

Código do app e do servidor implementado. Versão Android enviada mais recente: `versionCode 21`, revisão `VFX-12`.
**APK 21 concluído (`FINISHED`), baixado e verificado; teste físico e recebimento real em celular PENDENTES.** Fonte congelada e enviada em `2026-09-05T17:57:09.548Z`, concluída pelo EAS em `2026-09-05T18:05:24.063Z`, build `9a855d84-923b-4ed0-841f-dbe408a127aa`, prioridade `HIGH`. As 21 conferências do arquivo passaram em `2026-09-05T18:08:28.267Z`: assinatura preservada, versão 21, FCM e conteúdo Hermes/animado confirmados. [Baixar APK 21](https://expo.dev/artifacts/eas/7rw5i36ShXdlNwxd4OONK8-0CW7AhVs3guz4arvGu5A.apk) · [SHA-256, conferências e pendências](BUILD-21.md). O [APK 20](BUILD-20.md) permanece como histórico.

Nesta versão, o cliente ativa avisos de serviços em **Minha conta → OS e agendamentos → Ativar**. Essa autorização é independente do push de sorteios e do WhatsApp. Na validação local da fonte congelada, passaram 37 testes de push, 37 de efeitos, a checagem de tipos, a exportação Android e a prévia SVG. A checagem de tipos e as duas suítes foram repetidas na conferência final e passaram. Os testes locais não comprovam entrega em aparelho.

- Firebase: `lz-games-app-e16e4972`, nome **LZ-GAMES**, número `737555207035`.
- Android: `br.com.lzgames.app`, Firebase app ID `1:737555207035:android:aeefe58d293ab2192263de`.
- Expo existente: `lzgames/lz-games`, project ID `e16e4972-a5ab-4e40-9b50-25eb952c889c`.
- `google-services.json` instalado na raiz e validado. Chave FCM V1 enviada ao EAS e atribuída ao pacote existente, sem trocar o keystore.
- Conta dedicada `lz-games-expo-push@lz-games-app-e16e4972.iam.gserviceaccount.com`, apenas papel `roles/firebasecloudmessaging.admin`.
- Chave privada guardada fora do Git em `/home/lz-servidor/.config/lzgames/push/fcm-service-account.json`, permissão `0600`. Não copiar para o app nem publicar.
- API Google Cloud Billing consultada: `billingEnabled=false`. Não houve vinculação de faturamento. O projeto antigo `lz-on-goku` foi preservado.
- OAuth com a chave privada e FCM `projects.messages.send` com **`validate_only=true`** passaram. Isso valida autenticação/permissão/payload, não entrega em aparelho.
- Histórico de configuração: testes PHP/TypeScript e o build preview 19 `498dec34-97e1-4fed-a2df-668c4161d369` passaram. Nenhum envio real a clientes foi executado nesta preparação.
- Histórico do pacote 19: exportação Android/Hermes e `build:inspect --stage archive` conferiram configuração cliente incluída e ausência de chave privada nos JSONs. A inspeção local não inicia uma compilação remota.
- Histórico do APK 19: concluído em `2026-09-05T16:13:02.536Z` e validado com `apksigner`/`aapt`. Essas conferências anteriores não substituem a inspeção do APK 21 nem o teste de recebimento em celular.

Esta configuração de credenciais é para **Android**. Publicação/push iOS ainda requerem credencial Apple/APNs e validação separada; não estão concluídos por gerar FCM.

Não confundir exportação JavaScript bem-sucedida com APK compilado, nem aceite do provedor com mensagem vista pelo cliente.

## Funcionamento

1. Cliente instala a nova versão, entra na conta e ativa a categoria desejada em **Minha conta**: **Notificações no celular** para sorteios ou **OS e agendamentos** para serviços.
2. O Android/iOS pede permissão. Recusar não impede usar OS, agenda ou sorteios.
3. O app cria os canais Android `sorteios`, `os` e `agenda` antes de solicitar permissão/token. `os` e `agenda` usam visibilidade `PRIVATE` na tela bloqueada. O token Expo permanece vinculado ao projeto EAS existente e à instalação autenticada.
4. Ao criar um novo sorteio oficial ou salvar sua programação, o servidor publica uma campanha no app e enfileira push/WhatsApp conforme as autorizações de cada canal. A instalação do recurso não anuncia sorteios antigos.
5. O processador envia ao serviço Expo, que encaminha ao FCM/APNs. Com o app fechado, quem exibe a notificação é o sistema do celular, sem polling em segundo plano.
6. Ao tocar, o tipo do aviso determina uma tela fixa: `raffle` abre Sorteios, `service_order` abre OS e `appointment` abre Agenda. O app atualiza os dados e registra o toque; campos de URL ou tela arbitrária não controlam a navegação. Na primeira abertura sem sessão, o cliente entra antes de acessar a área autenticada.

Para sorteios, push e WhatsApp têm autorizações independentes. Os destinatários precisam estar vinculados e ativos nos últimos 90 dias. Push vai para cada aparelho autorizado; WhatsApp é deduplicado pelo telefone normalizado. O aviso global de sorteio continua disponível dentro do app mesmo sem destinatários externos.

O envio automático tem chave única por evento/sorteio/data. Alterar a programação retira a campanha anterior; encerrar ou remover o sorteio cancela pendentes. Avisos já aceitos pelo provedor não podem ser recolhidos. Lembretes e mensagens de vencedores do site continuam usando o fluxo anterior; esta entrega não unifica esses destinatários com clientes adicionados somente pelo app.

### OS e agendamentos — app/push

Esta categoria não dispara WhatsApp. O registro envia `scope: 'services'` e a presença retorna `push.serviceEnabled`. O push legado de sorteios usa `push.enabled` e escopo `raffles` ou omitido. Cada operação altera apenas a autorização do seu escopo, mantendo o token compartilhado da instalação. A manutenção atualiza cada escopo habilitado com `refreshOnly`, sem renovar consentimento revogado.

O monitor do servidor consulta o estado atual das fontes em ciclos de aproximadamente 60 segundos, somente para clientes elegíveis. A ativação cria uma base de observação, sem disparar mudanças passadas. Esse monitor não reproduz um histórico completo de alterações; estados intermediários entre duas consultas podem não ser observados. As fontes de OS e agenda são lidas sem modificações.

- Alterações observadas no status de uma OS geram aviso privado para o cliente correspondente.
- Após três dias desde a ativação ou o último aviso de OS gerado, um resumo reúne as OS ainda ativas. A contagem é global por cliente, evitando lembretes em dias diferentes para cada OS. OS encerradas ficam fora desse resumo; o próprio encerramento ainda pode gerar o aviso de mudança de status.
- A agenda programa lembretes para 6, 3 e 1 hora antes, no fuso `America/Maceio`. Não há recuperação de lembretes anteriores à ativação; a janela de processamento é de até dez minutos após cada horário previsto.
- Cancelamento, remoção e remarcação invalidam avisos pendentes da versão anterior. A origem é novamente conferida antes do envio; falha de leitura suspende a entrega, sem inventar um status atualizado.
- Os avisos de serviço são privados, filtrados pelo backend para a identidade autenticada. Na central de Conta/Sorteios e no aviso da página inicial, OS e agenda abrem suas respectivas telas; tipos legados nulos continuam abrindo Sorteios e tipos desconhecidos não navegam.

Desativar serviços preserva as opções de sorteios e WhatsApp. O app remove apenas os avisos locais da categoria desativada; sair da conta continua limpando todos os avisos locais e solicitando a desvinculação autenticada da instalação.

## Configuração Android sem contratar outro serviço

Use o projeto Firebase da empresa, se já existir. Não ative planos pagos, serviços extras nem faturamento por causa destas instruções.

1. No Firebase, registre/confira um app Android com o pacote **`br.com.lzgames.app`**. Não mude o pacote do aplicativo existente.
2. Baixe o **arquivo de configuração do app Android** `google-services.json` e coloque-o na raiz deste repositório. Ele não é a chave privada de servidor.
3. Alternativa: variável de ambiente **do tipo arquivo** `GOOGLE_SERVICES_JSON` no EAS, disponível ao ambiente usado pelo perfil de build. O script local `check:push` requer uma cópia local ou essa variável apontando a um arquivo acessível.
4. Nas credenciais EAS do projeto `lzgames/lz-games`, configure **FCM V1** com uma conta de serviço autorizada do mesmo projeto Firebase. Nunca inclua o JSON privado no app, no Git ou em mensagens de chat.
5. Não recrie o keystore Android. Preserve a assinatura usada pelos APKs anteriores.
6. `app.config.js` valida o pacote e informa o arquivo ao Expo. A compilação remota Android é bloqueada se o arquivo faltar.

`google-services.json` está ignorado no Git, mas autorizado no pacote EAS por `.easignore`. Isso se aplica **somente à configuração cliente**. Chaves privadas de conta de serviço continuam excluídas.

Referências oficiais: [configuração Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/), [credenciais FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/).

### Recuperação em outra máquina

Não crie um segundo projeto Firebase ou uma chave nova a cada build. Para recuperar apenas a configuração cliente, entre com a conta autorizada e execute na raiz do app:

```bash
npx firebase-tools login
npx firebase-tools apps:sdkconfig ANDROID 1:737555207035:android:aeefe58d293ab2192263de --project lz-games-app-e16e4972 --out google-services.json
npm run check:push
```

A chave privada já está no EAS e **não precisa ser baixada para compilar**. Para conferir o vínculo: `npx eas-cli credentials --platform android`, selecione o perfil e **Google Service Account → Push Notifications (FCM V1)**. Não use as opções de apagar/trocar keystore. Se a chave privada for comprometida, substitua a credencial no EAS, valide e revogue a chave antiga no IAM; não a revogue durante uma simples compilação.

## Validação antes de compilar

Na pasta `/home/lz-servidor/projetos/APP-LZGAMES`:

```bash
npm ci
npm run check:push
npm run typecheck
npm run test:push
npm run test:effects
npx expo install --check
```

Somente com Firebase e credencial FCM V1 configurados:

```bash
npm run build:android:preview
```

Esse comando envia uma compilação EAS; não executá-lo para fazer apenas testes de código. Para Play Store, use o perfil `production` depois de validar o APK e os requisitos de publicação. Push nativo não chega ao APK antigo por simples atualização do site, cache ou Git. Requer nova compilação e instalação.

O Expo Go não suporta o teste deste push Android. A interface continua funcionando no preview, mas orienta instalar o APK oficial.

## Servidor

Repositório: `/home/lz-servidor/apps/lzgames-sorteios`.

- `lib/app-messaging.php`: migrações aditivas, registro, consentimento, campanhas, destinatários e cancelamento.
- `lib/app-push-worker.php`: integração Expo HTTPS, fila e verificação de recibos.
- `lib/app-service-source.php`: leitura das fontes de OS/agenda e validação de identidade, telefone completo e propriedade dos registros.
- `lib/app-service-scheduler.php`: observações, cadência global de OS, lembretes de agenda, cancelamento e revalidação antes do envio.
- `public/app-communications.php`: endpoints autenticados e painel com CSRF.
- `notification-worker.php`: processador PM2 já existente; consulta serviços a cada aproximadamente 60 segundos e mantém a integração MenuIA sem enviar os novos avisos de serviços ao WhatsApp.
- `public/index.php` / `public/live-admin-v2.php`: criação/programação de sorteios publica os novos avisos.

```bash
cd /home/lz-servidor/apps/lzgames-sorteios
php tests/app-push.php
php tests/app-auth.php
php tests/app-service-source.php
php tests/app-service-scheduler.php
php tests/app-service-push.php
php tests/participant-list.php
php -l notification-worker.php
pm2 status lzgames-sorteios-whatsapp
```

Após atualizar o código, reinicie **somente** o processador afetado:

```bash
pm2 restart lzgames-sorteios-whatsapp
```

O painel informa se houve sinal do processador nos últimos 90 segundos. Um sinal recente comprova apenas que o processo está rodando; não valida as credenciais Google/Apple.

Ativação do monitor de serviços confirmada em 05/09/2026: processador PID `213739` ativo, heartbeat às `18:05:55` no registro do servidor, tabelas `app_service_monitors` e `app_service_observations` instaladas e nova autorização de serviços disponível. Naquele momento havia zero autorizações da categoria e zero jobs privados. O backend aguarda a instalação do APK 21 e a ativação pelo cliente em Conta; nenhuma notificação real foi enviada para teste.

Verificação histórica da configuração inicial em 05/09/2026: migrações conferidas, `lzgames-sorteios-whatsapp` reiniciado, heartbeat recente, `/health` HTTP 200 e registro de dispositivo sem sessão HTTP 401. Naquele momento havia zero aparelhos vinculados e zero campanhas; não houve disparo real. Essa observação não é uma contagem atual nem comprova entrega dos novos avisos de serviços. Backup daquela etapa: `.data/sorteios-before-push-final-20260905.sqlite` (privado, não enviar ao Git).

Para segurança adicional, habilite a proteção de push no projeto EAS e disponibilize ao processador `LZGAMES_EXPO_PUSH_ACCESS_TOKEN` por configuração secreta. O valor deve ser um token autorizado no projeto; nunca `EXPO_PUBLIC_*`, nunca no Git. Se habilitar a proteção no EAS sem configurar o servidor, os envios falharão com `UNAUTHORIZED`.

Referência: [envios e recibos Expo](https://docs.expo.dev/push-notifications/sending-notifications/).

## Teste controlado em celular

1. Instale o APK novo num aparelho de teste e entre com uma conta autorizada.
2. Ative apenas push se não quiser receber WhatsApp.
3. Acesse `https://sorteios.lzgames.com.br/admin/app`.
4. Expanda **Teste controlado de push · um aparelho**, selecione o aparelho correto e confirme o envio.
5. Esse botão envia somente ao aparelho selecionado, não ao restante dos clientes e não ao WhatsApp. A mensagem de teste não entra no mural geral do app.
6. Verifique aberto, em segundo plano e fechado; toque e confirme abertura da aba Sorteios. Retirar o app da lista de recentes não é o mesmo que forçar parada pelo Android.
7. Após cerca de 15 minutos, confira o recibo no painel. Verifique a coluna Toques após abrir pelo aviso.
8. Revogue push no app e confira que novos testes para esse aparelho ficam indisponíveis. Reative, saia da conta e confira a desvinculação. Repita trocando de conta.

Para validar OS/agendamentos, use uma conta de teste com registros controlados e ative **Minha conta → OS e agendamentos**. Confira avisos e abertura em OS/Agenda, revogação independente, ocultação do conteúdo na tela bloqueada, cancelamento e remarcação. O teste controlado de sorteio descrito acima não comprova esses fluxos. A validação física do APK 21 permanece **PENDENTE**.

**Criar uma campanha normal ou um sorteio oficial é uma ação de produção:** pode atingir todos os destinatários autorizados. Não use essa ação para testar com clientes reais.

## Garantias e limites operacionais

- Identidade validada pelo backend que emitiu a sessão; não se aceita ID de cliente arbitrário.
- Token exclusivo por instalação, sem exposição nas telas/logs. Troca de conta não herda autorizações.
- Na saída, o app serializa o registro de dispositivo e revoga o vínculo antes de apagar a sessão. Offline ou em falha temporária do servidor, mostra erro e pede reconexão para concluir com segurança. Sessão realmente expirada/revogada pode sair localmente, mas avisa que não confirmou a desvinculação remota.
- Permissão e token são reconferidos quando o app volta ao primeiro plano; a manutenção respeita cada escopo habilitado. Listeners são removidos ao sair. O app não mantém consultas push em segundo plano; a observação periódica de serviços acontece no servidor.
- Claim atômico e um consumidor por lock. Limites de payload e canais escolhidos por tipos permitidos, sem destinos arbitrários.
- Com progresso, o consumidor faz pausa de 100ms (no máximo 10 envios push/s, além do tempo de rede); ocioso, aguarda 3s. As mensagens WhatsApp usam o mesmo processo, portanto podem alongar o tempo real da fila.
- Erros temporários explícitos têm backoff e no máximo cinco tentativas. Timeout/resultado ambíguo vira **Sem confirmação**, sem repetir cegamente uma notificação possivelmente já enviada.
- Para campanhas WhatsApp do app, timeout/5xx/resposta sem confirmação também não são reenviados automaticamente. Falha comprovada antes de conectar e limite 429 podem tentar novamente até cinco vezes. O fluxo legado de inscrições/lembretes do site foi preservado.
- Recibos são consultados após 15 minutos e novamente quando ausentes. Após 24 horas sem recibo, status **Sem confirmação**; o conteúdo não é reenviado.
- `DeviceNotRegistered` remove o token correspondente. Recibo antigo não invalida token novo após rotação.
- **Push confirmado** é aceitação pelo FCM/APNs; **Toques** é abertura reportada pelo app, não leitura comprovada do conteúdo.
- Não há garantia de entrega exatamente uma vez ou imediata. Rede, permissões, modo economia, não perturbe e parada forçada podem impedir ou atrasar o aviso. `tag`/`collapseId` ajudam a agrupar substituições do mesmo aviso.

## Dados e privacidade

São armazenados: hash da instalação, identidade autenticada, nome/telefone já cadastrado, plataforma/versão, última atividade, consentimento, token de push, status/recibos e abertura pelo aviso. Os clientes precisam de transparência sobre isso na política de privacidade. Não adicionar tokens/telefones a relatórios públicos. Não reusar consentimento de WhatsApp para push.

Não há expurgo automático do histórico nesta entrega. Defina uma política de retenção com a empresa antes de programar exclusões. As migrações preservam cadastros, inscrições e resultados.

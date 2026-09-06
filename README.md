# LZ Games Mobile

Aplicativo único para clientes dos serviços TurboBox e TurboRama.

## Executar

```bash
npm install
npm run android
```

A API padrão é `https://turbobox.lzgames.com.br/api/mobile/v1`. Para desenvolvimento:

```bash
EXPO_PUBLIC_API_URL=http://IP-DO-SERVIDOR:8080/api/mobile/v1 npm start
```

O aplicativo nunca acessa SQLite ou PostgreSQL diretamente. A autenticação usa token aleatório armazenado pelo SecureStore; no servidor apenas o hash do token é persistido.

## Produção Android / Play Store

**Disponível: [APK 26 / VFX-15](docs/BUILD-26.md), concluído, verificado e publicado na página de compartilhamento.** [Baixar APK 26](https://app.lzgames.com.br/convite/lz-games-26.apk). Inclui os detalhes completos dos agendamentos, confirmação pelo modelo existente de WhatsApp, Lotties maiores, foguete +30% e convite novo por compartilhamento. A [correção da Agenda por CPF e as proteções de indicação única](docs/SEGURANCA-INDICACOES-AGENDA-CPF.md) seguem ativas no servidor. Os dados dos builds anteriores abaixo são históricos.

O identificador definitivo do aplicativo é `br.com.lzgames.app`. A versão de loja gera um Android App Bundle (`.aab`) e usa exclusivamente a API HTTPS de produção.

Entrega anterior: [build 23 — versão 1.0.1](docs/BUILD-23.md). **Compilação concluída (`FINISHED`), APK baixado e 45 conferências aprovadas; teste no aparelho pendente.** Criado em `2026-09-05T21:25:05.774Z`, concluído em `2026-09-05T21:32:52.405Z`, `versionCode: 23`, perfil `preview`, prioridade `HIGH`, assinatura igual ao APK 22. [Consultar no Expo](https://expo.dev/accounts/lzgames/projects/lz-games/builds/d94778de-156e-4e99-a9ec-1d0bba9510d0) · [Baixar APK 23](https://expo.dev/artifacts/eas/lmk9ZF4dCElUGq3-G0h3T0l1zIDoSYo96VKtbB9d5VM.apk). Não envie outro build apenas para consultar este; o APK 22 é histórico e não contém os componentes novos.

Esta entrega inclui convite na entrada/cadastro, cartão de crédito com disponível/acumulado/usado e abatimento nos detalhes da OS. Mantém a reserva de clientes da assistência/CORE e **Indique e ganhe cashback** em Início e Conta. Estão ativos no servidor a [regra de 5% por conclusão de OS, somente da nota nº 480 em diante](docs/CASHBACK-SERVICOS-5.md), o [bônus separado de R$ 9,90 no primeiro acesso elegível ao app](docs/BONUS-APP-990.md), exclusivo para serviços e sem saque, e o [abatimento nas notas pelo painel](docs/USO-CREDITO-APP.md). Os saldos e autorizações são consultados no servidor; o app não concede crédito localmente.

Preserva as funções do [APK 21](docs/BUILD-21.md): três ícones Lottie empacotados para uso offline, troféu menor e avisos de OS/agendamentos. O cliente ativa essa categoria em **Minha conta → OS e agendamentos → Ativar**. São avisos pelo app/push, sem WhatsApp adicional: alterações de status, resumo das OS ativas a cada três dias sem novo aviso de OS e lembretes de agenda 6, 3 e 1 hora antes. Sorteios continuam independentes.

O monitor de serviços permanece ativo no backend. A Agenda e a ponte de autenticação das indicações também foram ativadas. Nenhuma reserva, indicação, concessão de crédito ou notificação real foi feita para teste nesta entrega.

Consulta somente leitura do último APK concluído (26):

```bash
npx --no-install eas-cli build:view 50448f84-c8fd-4194-8a8d-99d6a32e783f
```

Em outro computador, restaure primeiro o `google-services.json` na raiz do projeto: esse arquivo de configuração cliente é ignorado pelo Git e não vem no clone. Use o projeto Firebase existente e siga o [guia de notificações push](docs/NOTIFICACOES-PUSH.md). A chave privada FCM fica fora do repositório e não deve entrar no pacote do app.

Antes de uma nova compilação:

```bash
npm run check:push
npm run typecheck
npm run test:agenda
npm run test:referrals
npm run test:orders
npm run test:push
npm run test:effects
npx expo-doctor
```

Para uma futura versão aprovada nos testes e destinada à loja:

```bash
npx eas-cli login
npm run build:android:production
npm run submit:android
```

Para instalar e testar diretamente em um Android antes da publicação, gere o APK interno:

```bash
npm run build:android:preview
```

Antes de publicar, conclua no Play Console a ficha da loja, classificação indicativa, segurança de dados, política de privacidade e teste fechado exigido para a conta de desenvolvedor.

## Documentação

A integração de indicações e a correção da Agenda estão documentadas em [INDICACOES-AGENDA.md](docs/INDICACOES-AGENDA.md) e no histórico [BUILD-22.md](docs/BUILD-22.md). A implantação dos [5% no servidor](docs/CASHBACK-SERVICOS-5.md) é independente da compilação. Todas as notas até a 479 estão excluídas, inclusive se finalizadas depois; aprovações históricas foram preservadas. Não confundir essa regra com o [bônus de R$ 9,90, ativo no servidor e separado](docs/BONUS-APP-990.md). A fonte do [APK 23](docs/BUILD-23.md), incluindo [uso do crédito](docs/USO-CREDITO-APP.md), passou em 115 testes do app, TypeScript e Expo Doctor (21/21). O envio utilizou o plano existente, sem contratação adicional, AAB ou publicação na Play Store.

**Comece pelo [registro da entrega 25](docs/BUILD-25.md) e pela [implantação de indicação única e correção da Agenda](docs/SEGURANCA-INDICACOES-AGENDA-CPF.md)**. O [guia de notificações push](docs/NOTIFICACOES-PUSH.md) e os registros dos builds anteriores permanecem como referência. TypeScript e os 125 testes do app passaram nesta rodada; verificações automáticas não substituem Android físico.

O [handoff completo, do código ao APK](docs/HANDOFF-COMPLETO.md) é o guia histórico da entrega 17 / VFX-09. Explica as integrações, efeitos e operação do projeto; seus números de versão e resultados de validação são históricos. O [registro do APK 17](docs/BUILD-17.md) permanece disponível para consulta.

O passo a passo completo, incluindo APK, AAB, atualização de versão, download, instalação via ADB e solução de erros, está em [docs/COMPILACAO-ANDROID.md](docs/COMPILACAO-ANDROID.md).

Os efeitos neon, ícones Lottie, cenário espacial e seus testes estão documentados em [docs/EFEITOS-VISUAIS.md](docs/EFEITOS-VISUAIS.md).

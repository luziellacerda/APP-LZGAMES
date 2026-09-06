# Tutorial completo de compilação Android — LZ-GAMES

**Entrega atual: [APK 28 — Games Usados e moderação](BUILD-28.md)**, na branch `feature/appgamesusados-marketplace`. [Acompanhar esta compilação](https://expo.dev/accounts/lzgames/projects/lz-games/builds/f101a096-2892-48ba-8ce9-702a0975243d). Não troque para `main` para compilar a loja; o projeto anterior permanece separado. Consulte o registro 28 para o resultado verificado.

**Entrega anterior: [26 / VFX-15](BUILD-26.md), baixada, validada e publicada.** Não enviar novamente uma versão para consultar o andamento nem esperar recursos novos ao reinstalar um APK anterior.

**Fonte do APK 26:** detalhes completos dos agendamentos, confirmação pelo modelo existente de WhatsApp, Lotties maiores, foguete +30% e convite novo por compartilhamento. As [guardas de indicação e a correção da Agenda por CPF](SEGURANCA-INDICACOES-AGENDA-CPF.md) já estão no servidor. Este build foi concluído em 06/09/2026; os passos de outro envio só devem ser executados quando solicitado.

O [APK 27, versão 1.0.1](BUILD-27.md) é anterior à revisão atual. Ele não contém o novo design, edição, bloqueios ou avisos da entrega 28. A [operação atual e seus limites](GAMES-USADOS-PRODUCAO.md) estão documentados separadamente. Teste físico continua necessário.

Para assumir o projeto, consulte também o [guia de notificações push](NOTIFICACOES-PUSH.md), com Firebase/FCM, testes físicos e limites operacionais. O [handoff completo](HANDOFF-COMPLETO.md), o [registro do APK 17 / VFX-09](BUILD-17.md) e o [registro do build 19](BUILD-19.md) são históricos e permanecem como referência. Compare sempre a versão local com o histórico do EAS antes de um novo envio.

Este documento explica como preparar o ambiente, testar o projeto e gerar os dois formatos Android:

- **APK:** instalação direta em celulares para testes externos.
- **AAB:** pacote destinado à publicação no Google Play Console.

## 1. Requisitos

- Git
- Node.js LTS e npm
- Uma conta Expo com acesso ao projeto `@lzgames/lz-games`
- Acesso à internet

Confira as ferramentas instaladas:

```bash
git --version
node --version
npm --version
```

## 2. Baixar o projeto

```bash
git clone --branch feature/appgamesusados-marketplace https://github.com/luziellacerda/APP-LZGAMES.git
cd APP-LZGAMES
```

Se o projeto já estiver no computador, atualize-o:

```bash
cd /caminho/para/APP-LZGAMES
git switch feature/appgamesusados-marketplace
git pull --ff-only origin feature/appgamesusados-marketplace
```

Não use `git reset --hard` em uma pasta com alterações que ainda não foram salvas.

## 3. Instalar dependências

Para reproduzir exatamente as versões registradas em `package-lock.json`:

```bash
npm ci
```

Durante o desenvolvimento, `npm install` também funciona, mas pode atualizar o arquivo de dependências.

### Restaurar a configuração Firebase após o clone

O `google-services.json` é ignorado pelo Git; portanto, não aparece ao baixar o repositório. Antes de compilar:

1. No projeto Firebase existente `lz-games-app-e16e4972`, baixe a configuração do app Android de pacote `br.com.lzgames.app` usando a conta autorizada. O [guia de push](NOTIFICACOES-PUSH.md) também contém o comando para recuperá-la.
2. Coloque o arquivo na raiz de `APP-LZGAMES`, ao lado de `app.json`. Não crie outro projeto Firebase para cada build.
3. Execute `npm run check:push`. O resultado valida a configuração local; a credencial FCM V1 correspondente também precisa estar vinculada ao projeto no EAS.

Como alternativa, o EAS aceita `GOOGLE_SERVICES_JSON` como variável **do tipo arquivo**, disponível ao ambiente do perfil utilizado. A verificação local ainda precisa da cópia local ou dessa variável apontando para um arquivo acessível na máquina.

O `app.config.js` configura o arquivo cliente e bloqueia builds Android sem ele. A `.easignore` permite o envio desse arquivo cliente ao compilador, apesar de ele não estar no Git. **Não confunda com a chave privada de conta de serviço FCM:** ela deve permanecer fora do repositório e do pacote enviado; a credencial já cadastrada no EAS não precisa ser baixada para compilar.

## 4. Validar o código

Execute antes de toda compilação:

```bash
npm run check:push
npm run typecheck
npm run test:agenda
npm run test:referrals
npm run test:orders
npm run test:push
npm run test:effects
npm run test:marketplace
npx expo-doctor
git status --short
```

Todos os testes precisam terminar sem erros. Revise qualquer alerta do Expo Doctor antes de gerar a versão final. `check:push` não testa entrega em aparelho: a validação física de permissão, recebimento, abertura e saída da conta está no [guia de push](NOTIFICACOES-PUSH.md).

## 5. Executar no Expo durante o desenvolvimento

Inicie o servidor local:

```bash
npm start
```

Para abrir o modo Android:

```bash
npm run android
```

Para testar por túnel em outro telefone/rede:

```bash
npx expo start --tunnel --clear
```

A API de produção TurboBox configurada é:

```text
https://turbobox.lzgames.com.br/api/mobile/v1
```

A loja, as indicações e os dados CORE também utilizam `https://app.lzgames.com.br/api`, configurável por `EXPO_PUBLIC_CORE_API_URL`. São APIs diferentes; alterar somente `EXPO_PUBLIC_API_URL` não redireciona Games Usados. Nunca colocar senhas do banco, JWT ou chave FCM em variáveis `EXPO_PUBLIC_*`, pois ficam no aplicativo.

Para apontar temporariamente para outro servidor de desenvolvimento:

```bash
EXPO_PUBLIC_API_URL=http://IP-DO-SERVIDOR:8080/api/mobile/v1 npm start
```

Nunca coloque senha, token, chave de assinatura ou credencial de banco no GitHub.

## 6. Entrar na conta Expo

O EAS Build compila e assina o aplicativo nos servidores do Expo:

```bash
npx eas-cli login
npx eas-cli whoami
```

O resultado de `whoami` deve mostrar uma conta autorizada no projeto LZ-GAMES.

Confira o uso incluído no plano antes de enviar um build; esta consulta não contrata nada:

```bash
npx eas-cli account:usage lzgames --non-interactive
```

Não compre plano/créditos nem envie uma compilação que gere cobrança adicional sem autorização. Neste projeto o usuário não autorizou novas compras. Consulte também o histórico para evitar envio duplicado; não compartilhe JSON bruto ou URLs assinadas de logs.

## 7. Atualizar a versão Android

O build 27 já enviado usa estes valores em `app.json` (registro da entrega, não instrução para reenviá-la):

```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 27
    }
  }
}
```

- `version`: versão visível ao consumidor.
- `android.versionCode`: número interno inteiro, sempre maior que o build anterior.

Antes da próxima atualização, aumente o `versionCode` para um número ainda não enviado e maior que o anterior; depois do `27`, seria `28` se o histórico do EAS não tiver avançado; a fonte local permanece em `27`, o último número enviado. O perfil `preview` não incrementa automaticamente; não reenvie o número de um build em andamento por engano.

## 8. Gerar APK para instalação direta

O perfil `preview` do `eas.json` produz um APK:

```bash
npm run build:android:preview
```

Forma explícita, preservando a verificação de configuração do comando npm:

```bash
npm run check:push && npx eas-cli build --platform android --profile preview
```

Para enviar o build e liberar o terminal sem aguardar:

```bash
npm run check:push && npx eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials
```

Ao terminar, o Expo apresenta uma página e um link para o arquivo `.apk`. Envie esse link ao testador. No Android, ele deverá permitir a instalação de aplicativos provenientes do navegador ou gerenciador de arquivos.

## 9. Gerar AAB para a Play Store

O perfil `production` do `eas.json` produz um Android App Bundle:

```bash
npm run build:android:production
```

Ou:

```bash
npm run check:push && npx eas-cli build --platform android --profile production
```

O AAB não é instalado diretamente no celular. Ele deve ser enviado ao Google Play Console.

## 10. Consultar um build

Para consultar o build 26 já concluído, sem criar outra compilação:

```bash
npx eas-cli build:view 50448f84-c8fd-4194-8a8d-99d6a32e783f
```

Copie o identificador exibido pelo Expo e execute:

```bash
npx eas-cli build:view ID-DO-BUILD
```

Para obter os dados da entrega atual em JSON, também somente leitura:

```bash
npx eas-cli build:view 50448f84-c8fd-4194-8a8d-99d6a32e783f --json
```

Estados comuns:

- `NEW` ou `IN_QUEUE`: aguardando.
- `IN_PROGRESS`: compilando.
- `FINISHED`: concluído.
- `ERRORED`: falhou; abra os logs indicados.
- `CANCELED`: cancelado.

## 11. Baixar o arquivo pelo terminal

O [registro do APK 26](BUILD-26.md) centraliza o download oficial desta entrega, já `FINISHED` e verificada. Nas próximas entregas, aguarde `FINISHED` antes de baixar; confira a origem em `artifacts.buildUrl` no JSON do ID acima. Não reutilize o link de um APK anterior para testar estas mudanças. Use um nome novo, sem sobrescrever o APK anterior:

```bash
curl --proto '=https' --proto-redir '=https' -fL 'URL-DO-ARQUIVO' -o LZ-GAMES-build26.apk
```

Confirme tamanho e integridade:

```bash
ls -lh LZ-GAMES-build26.apk
sha256sum LZ-GAMES-build26.apk
```

Para um AAB, troque o nome final para `LZ-GAMES.aab`.

## 12. Instalar um APK por cabo USB

Com o Android Debug Bridge instalado, depuração USB habilitada e o aparelho autorizado:

```bash
adb devices
adb install -r LZ-GAMES-build26.apk
```

O parâmetro `-r` atualiza uma instalação anterior mantendo os dados, desde que o pacote esteja assinado pela mesma chave.

## 13. Enviar AAB ao Google Play

Depois que a conta do Play Console estiver totalmente verificada:

```bash
npm run submit:android
```

O perfil atual envia como rascunho para a faixa interna. No primeiro envio, o Google pode exigir configuração manual ou uma chave de conta de serviço. Como alternativa, baixe o AAB e faça o upload diretamente pelo Play Console.

Antes de solicitar publicação, conclua:

- ficha principal da loja;
- ícone, banner e capturas de tela;
- política de privacidade;
- formulário de segurança dos dados;
- classificação etária e público-alvo;
- acesso ao aplicativo para os revisores;
- teste fechado exigido para a conta;
- declaração de anúncios e demais formulários apresentados pelo Console.

## 14. Fluxo recomendado para cada atualização

Em uma cópia sem alterações locais pendentes, use a sequência abaixo. Em diretório já modificado, revise e preserve o trabalho antes de atualizar pelo Git; um envio EAS não faz commit/push automaticamente.

```bash
git pull --ff-only origin main
npm ci
npm run check:push
npm run typecheck
npm run test:agenda
npm run test:referrals
npm run test:orders
npm run test:push
npm run test:effects
npx expo-doctor
git status --short
npx eas-cli whoami
npx eas-cli account:usage lzgames --non-interactive
npm run build:android:preview
```

Em outro computador, restaure antes o arquivo Firebase conforme a seção 3. Antes do último comando, confirme a versão e a ausência de outro build equivalente em andamento. Depois que o APK for aprovado nos testes, inclusive push em aparelho físico:

```bash
npm run build:android:production
```

## 15. Solução de problemas

### O celular informa que o pacote é inválido

Confirme que foi baixado um `.apk`, não um `.aab`, e baixe novamente usando uma conexão estável.

### A atualização não instala sobre a anterior

O pacote precisa continuar como `br.com.lzgames.app` e usar a mesma chave de assinatura. Aumente também o `versionCode`.

### O APK mostra conteúdo antigo

Confirme que as alterações foram salvas e enviadas antes do build:

```bash
git status --short
git log -1 --oneline
```

Use `--clear-cache` se for necessário eliminar cache remoto:

```bash
npm run check:push && npx eas-cli build --platform android --profile preview --clear-cache
```

### O EAS não reconhece a conta ou projeto

```bash
npx eas-cli logout
npx eas-cli login
npx eas-cli whoami
```

Confira em `app.json` se `owner`, `slug` e `extra.eas.projectId` continuam corretos.

### O build demora

Consulte a página fornecida pelo EAS. Fechar o terminal após usar `--no-wait` não cancela a compilação remota.

## Arquivos importantes

- `App.tsx`: aplicação principal.
- `src/`: telas, integrações e componentes.
- `app.json`: nome, pacote, versão e ícones.
- `app.config.js`: validação e inclusão da configuração Firebase Android.
- `google-services.json`: configuração cliente Firebase, recuperada separadamente e ignorada pelo Git.
- `.easignore`: controle dos arquivos enviados ao compilador; não incluir chaves privadas.
- `eas.json`: perfis APK/AAB e ambiente de produção.
- `assets/`: ícones e tela de abertura.
- `play-store/`: materiais preparados para publicação.

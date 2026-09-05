# Tutorial completo de compilação Android — LZ-GAMES

Para assumir o projeto desde a instalação das ferramentas, leia primeiro o [handoff completo](HANDOFF-COMPLETO.md). A entrega atual é o [APK 17 / VFX-09](BUILD-17.md); os números de versão abaixo são exemplos e devem ser comparados com o histórico antes de um novo envio.

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
git clone https://github.com/luziellacerda/APP-LZGAMES.git
cd APP-LZGAMES
```

Se o projeto já estiver no computador, atualize-o:

```bash
cd /caminho/para/APP-LZGAMES
git switch main
git pull --ff-only origin main
```

Não use `git reset --hard` em uma pasta com alterações que ainda não foram salvas.

## 3. Instalar dependências

Para reproduzir exatamente as versões registradas em `package-lock.json`:

```bash
npm ci
```

Durante o desenvolvimento, `npm install` também funciona, mas pode atualizar o arquivo de dependências.

## 4. Validar o código

Execute antes de toda compilação:

```bash
npm run typecheck
npm run test:effects
npx expo-doctor
git status --short
```

O TypeScript precisa terminar sem erros. Revise qualquer alerta do Expo Doctor antes de gerar a versão final.

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

A API de produção configurada é:

```text
https://turbobox.lzgames.com.br/api/mobile/v1
```

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

## 7. Atualizar a versão Android

Antes de distribuir uma atualização, abra `app.json` e aumente:

```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 18
    }
  }
}
```

- `version`: versão visível ao consumidor.
- `android.versionCode`: número interno inteiro, sempre maior que o build anterior.

Exemplo: depois do build `17` desta entrega, use um número maior, como `18`, na próxima atualização. O perfil `preview` não incrementa automaticamente; não reenvie o número de um build em andamento por engano.

## 8. Gerar APK para instalação direta

O perfil `preview` do `eas.json` produz um APK:

```bash
npm run build:android:preview
```

O mesmo comando, de forma explícita:

```bash
npx eas-cli build --platform android --profile preview
```

Para enviar o build e liberar o terminal sem aguardar:

```bash
npx eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials
```

Ao terminar, o Expo apresenta uma página e um link para o arquivo `.apk`. Envie esse link ao testador. No Android, ele deverá permitir a instalação de aplicativos provenientes do navegador ou gerenciador de arquivos.

## 9. Gerar AAB para a Play Store

O perfil `production` do `eas.json` produz um Android App Bundle:

```bash
npm run build:android:production
```

Ou:

```bash
npx eas-cli build --platform android --profile production
```

O AAB não é instalado diretamente no celular. Ele deve ser enviado ao Google Play Console.

## 10. Consultar um build

Copie o identificador exibido pelo Expo e execute:

```bash
npx eas-cli build:view ID-DO-BUILD
```

Para obter os dados em JSON:

```bash
npx eas-cli build:view ID-DO-BUILD --json
```

Estados comuns:

- `NEW` ou `IN_QUEUE`: aguardando.
- `IN_PROGRESS`: compilando.
- `FINISHED`: concluído.
- `ERRORED`: falhou; abra os logs indicados.
- `CANCELED`: cancelado.

## 11. Baixar o arquivo pelo terminal

Depois que o build estiver como `FINISHED`, copie o endereço de `artifacts.buildUrl` retornado pelo JSON:

```bash
curl -fL 'URL-DO-ARQUIVO' -o LZ-GAMES.apk
```

Confirme tamanho e integridade:

```bash
ls -lh LZ-GAMES.apk
sha256sum LZ-GAMES.apk
```

Para um AAB, troque o nome final para `LZ-GAMES.aab`.

## 12. Instalar um APK por cabo USB

Com o Android Debug Bridge instalado, depuração USB habilitada e o aparelho autorizado:

```bash
adb devices
adb install -r LZ-GAMES.apk
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

```bash
git pull --ff-only origin main
npm ci
npm run typecheck
npm run test:effects
npx expo-doctor
git status --short
npx eas-cli whoami
npx eas-cli build --platform android --profile preview
```

Depois que o APK for aprovado nos testes:

```bash
npx eas-cli build --platform android --profile production
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
npx eas-cli build --platform android --profile preview --clear-cache
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
- `eas.json`: perfis APK/AAB e ambiente de produção.
- `assets/`: ícones e tela de abertura.
- `play-store/`: materiais preparados para publicação.

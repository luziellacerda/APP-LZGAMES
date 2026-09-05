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

O identificador definitivo do aplicativo é `br.com.lzgames.app`. A versão de loja gera um Android App Bundle (`.aab`) e usa exclusivamente a API HTTPS de produção.

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

**Comece pelo [handoff completo, do código ao APK](docs/HANDOFF-COMPLETO.md).** Ele explica a instalação em outro computador, as integrações, os efeitos, os testes, o GitHub, o envio ao Expo, o download e a instalação no celular, com comandos e cuidados de segurança.

O [registro do APK 17 / VFX-09](docs/BUILD-17.md) contém o link da compilação e as validações desta entrega.

O passo a passo completo, incluindo APK, AAB, atualização de versão, download, instalação via ADB e solução de erros, está em [docs/COMPILACAO-ANDROID.md](docs/COMPILACAO-ANDROID.md).

Os efeitos neon, ícones Lottie, cenário espacial e seus testes estão documentados em [docs/EFEITOS-VISUAIS.md](docs/EFEITOS-VISUAIS.md).

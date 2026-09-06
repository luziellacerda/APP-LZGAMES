# APK 27 — Games Usados

**Concluído e verificado em 06/09/2026.** Não repetir o envio para consultar o andamento.

[Abrir a compilação](https://expo.dev/accounts/lzgames/projects/lz-games/builds/dd94f3ac-cfd1-4f29-a53b-122f335665f9) · [Baixar APK 27](https://expo.dev/artifacts/eas/ERlvnaWIleoa5OvrW6H6kD6sfF7FSeE8Q_voMPY-NQk.apk).

- ID: `dd94f3ac-cfd1-4f29-a53b-122f335665f9`.
- Fonte enviada: commit `8247752`.
- Arquivo de envio inspecionado: 112 arquivos fora metadados Git; fontes novas e Firebase cliente presentes; servidor, bancos, APKs e chaves privadas excluídos. [Hashes da fonte enviada](BUILD-27-sources.sha256) reconciliados com o diretório local; documentação posterior não altera o código do APK.

- Branch isolada: `feature/appgamesusados-marketplace`; `main` preservada.
- Android APK, perfil `preview`, versão `1.0.1`, `versionCode 27`.
- Nome/pacote preservados: `LZ-GAMES`, `br.com.lzgames.app`.
- Inclui Games Usados: catálogo, busca, painel do vendedor, até cinco fotos, vídeo curto, reservas e acompanhamento de pedidos. Mídia comprimida no servidor e banco independente dos sistemas existentes.
- Preserva Agenda, OS, TurboRama, sorteios, indicações e notificações.
- Pré-validação: 141 testes aprovados, TypeScript sem erros, Firebase cliente válido e Expo Doctor 21/21.
- Crédito de builds consultado antes do envio: 48% utilizado, cobrança adicional reportada igual a zero; sem compra ou alteração de plano.

## Resultado verificado

- Estado EAS `FINISHED`; criado em `2026-09-06T20:10:07.436Z`, concluído em `2026-09-06T20:18:11.283Z`, prioridade `HIGH`.
- APK: `play-store/LZ-GAMES-build27.apk`, **77.114.609 bytes**; integridade ZIP válida.
- Pacote `br.com.lzgames.app`, versão `1.0.1`, `versionCode 27`, SDK mínimo 24, alvo 36.
- Assinatura APK v2 válida e mesmo certificado do APK 26: SHA-256 `9b1ef548a90a075f2d8f95853b671819b8d53e9a074580a8272c2c0fcd716c9e`.
- SHA-256 do arquivo: `84b2f048381975ed100ffff46beea9c9a927ab5008a2aacbbcaa1eaa000ea164`.
- Bundle do APK contém Games Usados, endpoint `/marketplace/products`, seleção de mídia, ExpoVideo e API de produção.
- Entrega pelo link do Expo. A página pública de convite não foi alterada nesta solicitação de compilação, nem houve merge na `main`.

## Compilar (somente para um novo envio autorizado)

```bash
npm run check:push
npx --no-install eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 27 - Games Usados com catalogo, anuncios, midia e reservas'
```

Consulta somente leitura (não inicia outro build):

```bash
npx --no-install eas-cli build:view dd94f3ac-cfd1-4f29-a53b-122f335665f9
```

Este APK não é uma publicação na Play Store. Teste físico de interface, seleção de mídia e notificações continua necessário após a compilação.

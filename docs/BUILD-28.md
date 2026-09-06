# APK 28 — Games Usados com operação e moderação

Aplicativo LZ-GAMES 1.0.1, Android `versionCode` 28, pacote `br.com.lzgames.app`, perfil EAS `preview` (APK instalável), branch `feature/appgamesusados-marketplace`.

Inclui a nova experiência de loja e a [entrega técnica 28](GAMES-USADOS-PRODUCAO.md): edição de dados/capa, denúncias, bloqueios, avisos internos e proteção de concorrência/publicação na API. O servidor e o painel de moderação já foram atualizados. OS, agenda, sorteios, cashback e respectivos push foram preservados.

## Checagens anteriores à compilação

- 155 testes gerais + 10 testes HTTP/MariaDB/PHP com dados fictícios: aprovados. Depois do envio, mais 7 checagens da API compartilhada e a repetição dos 10 testes SQL validaram a atualização das dependências do servidor.
- `npm run typecheck` e `npm run check:push`: aprovados.
- Exportação Android/Hermes: concluída, 725 módulos, aproximadamente 2,8 MB de bundle (não é o tamanho do APK).
- Prévia local responsiva e novos diálogos conferidos; teste físico continua pendente.
- Expo Starter: crédito informado antes deste build 2.300/4.500, custo adicional informado zero. Não foi alterado plano nem contratado serviço.

## Comando

```sh
cd /home/lz-servidor/projetos/APP-LZGAMES
npm ci
npm run typecheck
npm run check:push
npm run test:marketplace
npx --no-install eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 28 - Games Usados com moderacao, edicao e protecoes de producao'
```

Executar uma única vez, guardar o ID retornado e consultar seu estado; não reenviar só porque o build está na fila. A credencial Firebase cliente e a assinatura Android existentes são reaproveitadas, sem versionar segredos.

## Estado

Enviado uma única vez ao EAS, a partir do commit `5d98ca962caec2a255131f8aee210d83621a163e`. ID: `f101a096-2892-48ba-8ce9-702a0975243d`.

[Página desta compilação](https://expo.dev/accounts/lzgames/projects/lz-games/builds/f101a096-2892-48ba-8ce9-702a0975243d).

Concluído (`FINISHED`) em 06/09/2026 às 20:24:33 de Maceió (23:24:33 UTC). [Baixar o APK 28](https://expo.dev/artifacts/eas/CrPbkiJmtDkOOf8T7neFCQC8flwLnxyYd4LMYPJ8urw.apk).

Arquivo conferido: `play-store/LZ-GAMES-build28.apk`, 77.180.569 bytes (73,60 MiB). ZIP íntegro, pacote `br.com.lzgames.app`, versão `1.0.1`, `versionCode=28`, minSdk 24 e targetSdk 36. O bundle contém as novas rotas de avisos/bloqueios, versão das regras, chave de publicação e estado de moderação.

- SHA-256 do APK: `fbabfa5ebde5df1b58024533c947793fd8229356ec1e6f23a9be3a74692aaa78`.
- SHA-256 do certificado: `9b1ef548a90a075f2d8f95853b671819b8d53e9a074580a8272c2c0fcd716c9e`, igual ao APK 27. A assinatura foi verificada com `apksigner`.

Não confundir com o APK 27, que não contém esta revisão. A página pública de compartilhamento não foi trocada automaticamente: continua separada desta branch da loja.

As [dependências da API](../server/core/runtime/README.md) foram corrigidas e verificadas após o envio deste APK; essa alteração é de servidor, não exige gerar outro APK. O commit da fonte Android continua sendo o informado acima; commits posteriores de documentação, testes e lockfile da API não mudam o binário já assinado.

Esta compilação é para instalação e validação Android. Não representa publicação na Play Store nem comprova testes em aparelho físico ou pagamento protegido.

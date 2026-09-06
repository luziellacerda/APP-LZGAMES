# APK 28 — Games Usados com operação e moderação

Aplicativo LZ-GAMES 1.0.1, Android `versionCode` 28, pacote `br.com.lzgames.app`, perfil EAS `preview` (APK instalável), branch `feature/appgamesusados-marketplace`.

Inclui a nova experiência de loja e a [entrega técnica 28](GAMES-USADOS-PRODUCAO.md): edição de dados/capa, denúncias, bloqueios, avisos internos e proteção de concorrência/publicação na API. O servidor e o painel de moderação já foram atualizados. OS, agenda, sorteios, cashback e respectivos push foram preservados.

## Checagens anteriores à compilação

- 155 testes gerais + 10 testes HTTP/MariaDB/PHP com dados fictícios: aprovados.
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

Preparado para envio ao EAS. O ID e o resultado serão registrados após a submissão. Não confundir com o APK 27, que não contém esta revisão. A página pública de compartilhamento não foi trocada automaticamente.

Esta compilação é para instalação e validação Android. Não representa publicação na Play Store nem comprova testes em aparelho físico ou pagamento protegido.

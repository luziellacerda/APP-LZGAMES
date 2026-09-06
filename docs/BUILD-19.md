# APK 19 — LZ-GAMES com notificações push

Registro de 05/09/2026. **Compilação concluída (FINISHED) e APK verificado; instalação e teste físico de push pendentes.**

[Baixar APK 19](https://expo.dev/artifacts/eas/A1KdCaE4EQj0b4bduXHhtAITvD2FgaNYOvu2Q8-v9cI.apk).

## Identificação

- Build EAS: `498dec34-97e1-4fed-a2df-668c4161d369`.
- [Página desta compilação](https://expo.dev/accounts/lzgames/projects/lz-games/builds/498dec34-97e1-4fed-a2df-668c4161d369).
- Android `br.com.lzgames.app`, versão `1.0.1`, `versionCode 19`.
- Perfil `preview`: APK de instalação direta, sem publicação na Play Store.
- Projeto Expo existente `lzgames/lz-games`; mesma configuração de keystore `Build Credentials lYLU4_f1Aw`.
- Firebase `lz-games-app-e16e4972`, sender `737555207035`, credencial FCM V1 atribuída ao pacote no EAS.
- Conclusão EAS: `2026-09-05T16:13:02.536Z`; log nativo `BUILD SUCCESSFUL in 6m 38s`.

## O que entrou no envio

Push Android nativo, canal `sorteios`, autorização independente do WhatsApp, registro de aparelho autenticado, tratamento de toque/abertura, manutenção do token e desvinculação ao sair. As alterações locais já existentes, inclusive efeitos e ajustes visuais aprovados, foram preservadas.

O código e a configuração cliente Firebase foram enviados a partir da árvore local de trabalho. Não houve commit/push nesta rodada de compilação: o hash Git exibido pelo Expo identifica a base anterior e não descreve sozinho o conteúdo local enviado. Chaves privadas não foram incluídas no pacote.

O servidor de sorteios já possui fila, revalidação de consentimento, tentativas limitadas, recibos e teste direcionado a um aparelho. Sua implantação é separada do APK. Consulte [NOTIFICACOES-PUSH.md](NOTIFICACOES-PUSH.md).

## Comando executado

Depois de `check:push`, TypeScript e testes aprovados:

```bash
npx eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 19 - notificacoes push FCM V1 e sorteios'
```

Foi enviado **um único build**. Antes de iniciar, a lista EAS mostrava o APK 18 concluído e nenhuma compilação da versão 19. A consulta do plano Starter mostrou créditos disponíveis e custo excedente zero; nenhum plano, pagamento ou publicação foi contratado.

Para acompanhar sem criar outro:

```bash
npx eas-cli build:view 498dec34-97e1-4fed-a2df-668c4161d369
```

## Verificações antes do envio

- Pacote, versão, projeto EAS e Firebase compatíveis.
- Configuração `google-services.json` incluída no arquivo local de envio; zero chaves privadas nos JSONs incluídos.
- `npm run check:push`, `npm run typecheck`, 11 testes mobile push e `git diff --check` aprovados.
- Na preparação anterior, 18 testes de efeitos e exportação Android/Hermes aprovados.
- Backend: testes de autorização e fila push aprovados, incluindo falhas temporárias, revogação, troca de conta, recibos e não repetição de resultados ambíguos.

## Teste no celular — não confundir com compilação aprovada

1. Baixe o APK 19 pelo link acima, não o APK 18 ou 17.
2. Instale como atualização, sem desinstalar o app anterior por tentativa. A assinatura foi preservada.
3. Entre na conta e abra **Minha conta → Notificações no celular → Ativar**. Autorize no Android.
4. No [painel de aparelhos](https://sorteios.lzgames.com.br/admin/app), selecione **somente o aparelho de teste** na seção de teste controlado.
5. Envie o teste direcionado; confira o aviso com app aberto, em segundo plano e fechado, e a abertura da aba Sorteios ao tocar.
6. Confira o recibo no painel após aproximadamente 15 minutos e o toque registrado. Recibo do provedor não comprova leitura.

Sem um aparelho atualizado e autorizado, não é possível declarar entrega real validada. Nenhuma campanha geral, mensagem de WhatsApp ou notificação a clientes foi disparada para testar esta compilação.

## Conferência do APK gerado

Arquivo baixado em `play-store/LZ-GAMES-build19.apk` (ignorado no Git), com **72.320.778 bytes**.

```text
SHA-256: 3f37080e7faa3066a6104ac90f2e36cc9432dbb750dd7094541ec74686280bd2
```

Conferências realizadas com `aapt` e `apksigner`:

- Nome `LZ-GAMES`, pacote `br.com.lzgames.app`, versão `1.0.1` e código `19` corretos no manifesto binário.
- Assinatura válida e certificado SHA-256 idêntico ao keystore existente: `9B:1E:F5:48:A9:0A:07:5F:2D:8F:95:85:3B:67:18:19:B8:D5:3E:9A:07:45:80:A8:27:2C:2C:0F:CD:71:6C:9E`.
- Permissão `android.permission.POST_NOTIFICATIONS` e serviço `com.google.firebase.MESSAGING_EVENT` presentes.
- Projeto Firebase, sender e app ID corretos nos recursos compilados do APK.

As ferramentas de inspeção foram baixadas em diretório temporário; não foi necessário instalar Android Studio ou modificar o sistema para essas conferências. Ainda é necessário testar recebimento/toque em celular real.

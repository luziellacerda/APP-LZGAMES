# APK 25 — VFX-14

**Compilação concluída (`FINISHED`) em 06/09/2026, APK baixado, verificado e publicado na página de compartilhamento.** [Página da compilação 25](https://expo.dev/accounts/lzgames/projects/lz-games/builds/dc681c29-e532-4492-bd2c-a1ab04aa1879) · [Baixar APK 25](https://app.lzgames.com.br/convite/lz-games-25.apk). Não reinstale o 24 esperando receber os tamanhos abaixo.

- ID `dc681c29-e532-4492-bd2c-a1ab04aa1879`, criado em `2026-09-06T12:33:19.252Z`, prioridade `HIGH`.
- Concluído em `2026-09-06T12:41:05.704Z`. [Artefato original Expo](https://expo.dev/artifacts/eas/vRU5T6BxanUVrEz1KIh14K90tLmpMgKDB2D3oi3kwGY.apk).
- Android, perfil `preview`, distribuição interna APK; `LZ-GAMES`, `br.com.lzgames.app`, versão `1.0.1`, `versionCode 25`.
- Mesma assinatura remota e projeto, com `--freeze-credentials`. Nenhuma compra, alteração de plano, AAB ou envio à Play Store.
- Upload informado: 7,0 MB em dois segundos; esse não é o tamanho final do APK.
- Preflight: configuração cliente Firebase válida, TypeScript, 125 testes do app e Expo Doctor 21/21 aprovados. Arquivo de envio inspecionado com 101 arquivos (fora metadados Git), 63 hashes reconciliados e nenhuma credencial privada detectada. `server/`, bancos e APKs excluídos; Firebase cliente e os Lotties locais presentes. [Hashes da fonte 25](BUILD-25-sources.sha256).
- Uso do plano existente antes do envio: 44% dos créditos incluídos utilizados; cobrança adicional de builds reportada igual a zero.

Comando **já executado uma única vez**; não repeti-lo para consultar:

```bash
npx --no-install eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 25 VFX-14 - Lotties maiores, convite unico por pessoa e correcao Agenda CPF no servidor'
```

Consulta somente leitura:

```bash
npx --no-install eas-cli build:view dc681c29-e532-4492-bd2c-a1ab04aa1879
```

Pedidos reunidos nesta rodada:

- Dois primeiros Lotties na página Indicações: moeda/crédito do app de 52 × 42 para 78 × 63; dinheiro/cashback de 64 × 42 para 96 × 63. Aumento de 50%, sem substituir os desenhos escolhidos.
- Foguete de Suite/TurboRama: 54 × 54 para 70,2 × 70,2, aumento exato de 30%. Não altera a nave de fundo.
- Compartilhar convite solicita um código novo a cada ação, sem reaproveitar o código anterior em memória. Mensagens explicam destinatário único e bloqueio de pessoa/telefone já indicado.
- `app.json` preparado com `android.versionCode: 25`, mantendo versão 1.0.1, nome LZ-GAMES, pacote, projeto e assinatura. Marcador de desenvolvimento `VFX-14`, ausente em produção.

As [regras de indicação única e a correção da Agenda por CPF](SEGURANCA-INDICACOES-AGENDA-CPF.md) **já estão ativas no servidor** e não esperam uma compilação. O APK 24 também recebe essas validações pela API. A atualização de desenho e compartilhamento local precisa do APK 25.

## Checklist de preparação e instalação

1. Confirmar que o histórico EAS não possui outro build com número 25. Não repetir um envio apenas para consultar.
2. Preservar a configuração cliente Firebase existente, nome/pacote/assinatura e revisar a árvore Git sem apagar alterações do usuário.
3. Executar:

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

   Na preparação de 06/09, a configuração Firebase, TypeScript, os 125 testes do app e Expo Doctor 21/21 passaram. Conferência física do novo tamanho ainda pendente.
4. Conferir visualmente em Android a página Indicações, Lotties maiores sem corte, toque do foguete, convite novo ao compartilhar outra vez e confirmação de agenda com CPF. Não gerar crédito real para testar concorrência.
5. Seguir [COMPILACAO-ANDROID.md](COMPILACAO-ANDROID.md). Quando solicitado enviar, usar o perfil `preview` para APK interno e `--freeze-credentials`, sem criar assinatura ou projeto novo. A publicação na loja é outra ação.
6. Depois de `FINISHED`, baixar o artefato do ID novo e confirmar versão 25, pacote, certificado, ZIP, bundle e assets. Só então atualizar download público/metadados. Instalar sobre a versão existente, sem desinstalar nem apagar dados.

Os arquivos de manutenção `server/` e as credenciais privadas ficam fora do pacote EAS. Nenhum commit/push foi feito nesta rodada; as alterações locais anteriores foram preservadas.

## Verificação e download oficial

- Tamanho final: **73.213.502 bytes**, aproximadamente 69,8 MiB. SHA-256: `7524f29d74905ac9f95d2ad7a7febb7949747a1227c3dd052dee01da59b45eef`.
- AAPT confirmou pacote `br.com.lzgames.app`, versão `1.0.1`, número interno `25`, target SDK 36. ZIP íntegro e assinatura Android válida.
- Certificado SHA-256 preservado, igual ao APK 24: `9b1ef548a90a075f2d8f95853b671819b8d53e9a074580a8272c2c0fcd716c9e`.
- Bundle Hermes inspecionado: seis referências dos Lotties escolhidos presentes e valores 70,2 do foguete encontrados. As fontes e os tamanhos 78 × 63 / 96 × 63 foram reconciliados com os 63 hashes do arquivo de envio, sem alteração durante a compilação.
- Publicado como `/var/www/lzgames/convite/lz-games-25.apk`. APKs 23/24 mantidos, sem sobrescrever os arquivos anteriores. A página `https://app.lzgames.com.br/convite/` mantém o mesmo endereço e os parâmetros dos convites, oferecendo agora o 25.
- Metadados `config/appRelease.json`, alternativa sem JavaScript, testes versionados e cópias de manutenção reconciliados. API recarregada para servir a versão nova. A troca do APK não consome convites nem altera identidade, agenda ou regras financeiras.

Instalar sobre a versão existente, **sem desinstalar nem apagar dados**. Teste físico de interface, notificações e confirmação da reserva continua pendente; testes automáticos e conferência do APK não substituem essa etapa.

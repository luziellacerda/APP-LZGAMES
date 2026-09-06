# APK 20 — LZ-GAMES / VFX-11

Registro de 05/09/2026. **Compilação concluída (`FINISHED`), APK baixado e verificado. Teste físico no celular pendente.**

[Baixar APK 20](https://expo.dev/artifacts/eas/bGb5sDnx3cn5JvFXT4JMt9ig0wghrD51WcWN4MHuc-U.apk).

- [Acompanhar esta compilação](https://expo.dev/accounts/lzgames/projects/lz-games/builds/c8218d6a-6c86-4dc5-86cf-0aa8079add21).
- ID: `c8218d6a-6c86-4dc5-86cf-0aa8079add21`.
- Criado em `2026-09-05T17:07:58.916Z`; concluído em `2026-09-05T17:15:46.382Z`. Estado consultado: `FINISHED`, prioridade `HIGH`.
- Versão `1.0.1`, Android `versionCode 20`, pacote `br.com.lzgames.app`, nome `LZ-GAMES`.
- Perfil `preview`: APK de instalação direta. Não é AAB e não foi publicado na Play Store.
- Mantidos projeto Expo `lzgames/lz-games`, Firebase/FCM e keystore remoto existente `Build Credentials lYLU4_f1Aw`.

## Mudanças incluídas

1. Botão superior de avisos pelo WhatsApp mais fácil de tocar: largura do card, mínimo de 52 dp, texto maior e feedback de salvamento/falha. Consentimento continua opcional.
2. Fundo de Sorteios com um Lottie nativo de moedas douradas, substituindo os troféus caindo. Doze moedas, três desenhos compartilhados, sem downloads em execução.
3. Troféu maior e giratório nos cards de Sorteios, obtido no LottieFiles, com origem e termos da licença dentro do pacote. Giro recortado para não sair de quadro.
4. Mantidos push Android, dados de OS/agenda/sorteios e demais efeitos aprovados. A correção da autenticação CORE no servidor de sorteios já está ativa e não depende da instalação deste APK.

O envio usa os arquivos locais de trabalho, incluindo alterações ainda não commitadas. Não houve commit/push nesta etapa, troca de chave, contratação de plano ou disparo de mensagem a clientes. Foi enviada somente uma compilação 20, com `--freeze-credentials`; para acompanhar, consulte o ID acima em vez de enviar outra.

## Verificações anteriores ao envio

- `npm run check:push`: configuração cliente Firebase válida para o pacote.
- `npm run typecheck`: sem erros.
- `npm run test:push`: 18 testes aprovados.
- `npm run test:effects`: 30 testes aprovados.
- `git diff --check`: sem erros.
- Exportação Android/Hermes local e renderização SVG isolada das animações aprovadas; taça inteira nos frames selecionados, sem downloads de assets durante a animação.
- Revisão do pacote: inclui `google-services.json` cliente e assets/licença; não inclui chave privada de conta de serviço nem APKs antigos.

## Conferência do APK concluído

Arquivo local: `play-store/LZ-GAMES-build20.apk` (ignorado no Git), **72.466.934 bytes**.

```text
SHA-256: 4c6ffa9db5536fb7c7315a7d6c95fdd5ff0a87b0268b6418f19d21e0b8859a5a
```

Conferências aprovadas com `aapt`, `apksigner` e leitura do bundle do APK:

- Nome `LZ-GAMES`, pacote `br.com.lzgames.app`, versão `1.0.1` e `versionCode 20`.
- Assinatura válida; certificado SHA-256 preservado: `9B:1E:F5:48:A9:0A:07:5F:2D:8F:95:85:3B:67:18:19:B8:D5:3E:9A:07:45:80:A8:27:2C:2C:0F:CD:71:6C:9E`.
- Permissão Android de notificações e serviço FCM presentes; projeto, sender e app ID Firebase corretos.
- Bundle contém o controle de avisos ampliado, moedas, novo troféu e termos completos da licença.

Esta conferência verifica o arquivo distribuído; não substitui a validação de toque, desempenho ou recebimento de push em aparelho real. Não confundir o APK 19 com esta atualização.

## Instalação e teste no celular

No Android, instalar por cima da versão anterior, sem desinstalar primeiro. Conferir o botão em Minha conta, moedas/troféu em Sorteios, OS, agenda e pausa das animações. O recebimento real de push continua exigindo teste controlado no aparelho autorizado; compilação aprovada não comprova entrega nem leitura de notificações.

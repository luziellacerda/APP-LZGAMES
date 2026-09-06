# APK 26 — VFX-15

**Concluído, verificado e publicado em 06/09/2026.**
[Abrir a compilação](https://expo.dev/accounts/lzgames/projects/lz-games/builds/50448f84-c8fd-4194-8a8d-99d6a32e783f) · [Baixar APK 26](https://app.lzgames.com.br/convite/lz-games-26.apk).

- ID: `50448f84-c8fd-4194-8a8d-99d6a32e783f`.
- Criado em `2026-09-06T16:14:12.844Z`, concluído em `2026-09-06T16:21:35.443Z`, prioridade `HIGH`.
- Perfil `preview`, Android APK interno; versão `1.0.1`, `versionCode 26`.
- Nome/pacote preservados: `LZ-GAMES`, `br.com.lzgames.app`.
- Assinatura remota existente preservada com `--freeze-credentials`.
- 137 testes do app, TypeScript, configuração cliente Firebase e Expo Doctor 21/21 aprovados.
- [Arquivo de envio auditado](BUILD-26-sources.sha256): 106 arquivos fora metadados Git; 65 fontes/recursos comparados ao diretório local. Novos componentes da Agenda e Lotties presentes; `server/`, bancos, APKs e credenciais privadas ausentes. Configuração Firebase cliente presente.
- Uso do plano existente antes do envio: Starter, 46% do crédito incluído usado, cobrança adicional de builds reportada igual a zero. Nenhuma compra ou troca de plano foi feita.
- APK verificado: **73.221.966 bytes**, ZIP íntegro, pacote `br.com.lzgames.app`, versão `1.0.1`, `versionCode 26`, SDK mínimo 24 e alvo 36.
- Certificado SHA-256 preservado: `9b1ef548a90a075f2d8f95853b671819b8d53e9a074580a8272c2c0fcd716c9e`.
- SHA-256 do APK: `90e5b0cd7ab63608fb147dc53a34e9917f710d4180ce505cb125041ca17e46a9`.
- Bundle conferido com os detalhes da Agenda e as seis animações Lottie solicitadas.

## Alterações incluídas

- Agendamentos com `VER DETALHES`: protocolo, situação, serviço, data, intervalo, profissional, cliente, WhatsApp e endereço da loja. Sem preços ou códigos internos de cancelamento.
- Comprovante retornado pelo servidor pode aparecer imediatamente; falha de atualização não repete a reserva. Dados atualizados substituem a lista normalmente, preservando a remoção de cancelados/apagados.
- Dados da loja vêm da consulta de serviços existente. Datas civis preservadas sem deslocamento do fuso do aparelho.
- Mantém as alterações do APK 25: Lotties maiores e os desenhos escolhidos, foguete +30%, compartilhamento com convite novo e guardas de indicação no servidor.

O [modelo de confirmação WhatsApp e a espera corrigida de 45 segundos](AGENDA-DETALHES-E-WHATSAPP.md) **já estão no servidor**. Não é disparo pelo WhatsApp do aparelho. Os testes não enviaram mensagens nem criaram reservas reais.

## Comando executado

Executado **uma única vez**; não repeti-lo para consultar:

```bash
npx --no-install eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 26 VFX-15 - detalhes dos agendamentos e confirmacao WhatsApp integrada ao servidor'
```

Consulta somente leitura:

```bash
npx --no-install eas-cli build:view 50448f84-c8fd-4194-8a8d-99d6a32e783f
```

O artefato foi baixado, validado e publicado como `lz-games-26.apk`. A API e a
página pública agora anunciam o APK 26; o APK 25 permanece disponível como histórico.
Teste físico de interface e entrega de WhatsApp/push continua sendo uma etapa separada.

O APK não foi publicado na Play Store; esta entrega é para instalação direta.

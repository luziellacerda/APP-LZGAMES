# APK 23 — Convites e crédito para serviços

Registro de 05/09/2026. **Compilação concluída (`FINISHED`), APK baixado e 45 conferências aprovadas. Teste físico no telefone pendente.** O APK 22 não contém os componentes descritos abaixo.

- [Página desta compilação no Expo](https://expo.dev/accounts/lzgames/projects/lz-games/builds/d94778de-156e-4e99-a9ec-1d0bba9510d0).
- ID: `d94778de-156e-4e99-a9ec-1d0bba9510d0`.
- Criado em `2026-09-05T21:25:05.774Z`, prioridade `HIGH`, perfil `preview`.
- Concluído em `2026-09-05T21:32:52.405Z`; verificado em `2026-09-05T21:33:50.934Z`.
- [Baixar APK 23](https://expo.dev/artifacts/eas/lmk9ZF4dCElUGq3-G0h3T0l1zIDoSYo96VKtbB9d5VM.apk). Não iniciar outro build apenas para consultar este.

## Identidade e conteúdo

- Nome `LZ-GAMES`, pacote `br.com.lzgames.app`, versão `1.0.1`, Android `versionCode 23`.
- Perfil `preview`: APK de instalação direta, usando a chave de assinatura existente. Sem envio à Play Store.
- Convite opcional em **Recebi um convite**, na entrada/cadastro, antes do primeiro acesso autenticado elegível.
- Cartão separado do crédito de R$ 9,90: disponível, acumulado e usado em serviços; sem saque e sem prazo de validade.
- Detalhes da OS com abatimento do crédito e total líquido, mantendo os dados anteriores.
- Preservados Agenda/pesquisa, OS, TurboRama, sorteios, notificações e efeitos/Lotties da entrega anterior.

As regras e o resgate são validados pelas APIs já implantadas; o app não concede dinheiro localmente. Consulte [bônus do app](BONUS-APP-990.md), [uso do crédito](USO-CREDITO-APP.md) e [5% por conclusão de serviço](CASHBACK-SERVICOS-5.md).

## Verificações prévias

- TypeScript aprovado.
- 115 testes do app aprovados: 14 Agenda, 23 indicações/entrada, 39 push/controles, 37 efeitos e 2 detalhes do crédito nas OS.
- Configuração Firebase local aprovada; Expo Doctor com 21/21 verificações aprovadas.
- Arquivo de envio inspecionado: 107 arquivos, fontes atuais conferidos por SHA-256, configuração cliente Firebase presente e padrões de bancos, backups e credenciais privadas excluídos. Upload informado pelo EAS: 6,9 MB.
- Histórico EAS conferido: última compilação Android 22 concluída, sem outra em andamento entre as cinco mais recentes.
- Uso do plano Starter conferido antes do envio: 40% do crédito incluído utilizado, custo adicional registrado de compilação igual a zero. Não foi contratada assinatura nem comprado crédito.

Nenhuma reserva, indicação, concessão, pagamento ou mensagem real foi feita para testar esta compilação. Validação no telefone ainda pendente.

## Conferência do APK entregue

Arquivo local: `play-store/LZ-GAMES-build23.apk`, ignorado no Git, **72.647.982 bytes**.

```text
SHA-256: 5058e7612a9ddbe7e946540704a90c3f3c4d71c29210e4679d061b27c0f6eba9
Certificado SHA-256: 9b1ef548a90a075f2d8f95853b671819b8d53e9a074580a8272c2c0fcd716c9e
```

As **45 conferências** aprovaram: identidade remota do projeto/perfil, integridade ZIP, versão 23, nome/pacote corretos, compilação sem `debuggable`, assinatura válida e igual ao APK 22, configuração e permissão FCM, bundle Hermes, quatro Lotties com licenças, preservação de avisos de sorteios/OS/Agenda, controles de convite antes do login, regras e campos do saldo para serviços, instrução de uso e linha de crédito na OS. Os nomes do arquivo também foram conferidos quanto aos padrões de fontes `server/` e credenciais privadas. A conferência de identidade remota e o download ocorreram antes das 45 verificações do conteúdo.

O download usou exclusivamente HTTPS e redirecionamentos oficiais `expo.dev` → `api.expo.dev` → `wf-artifacts.eascdn.net`, sem encaminhar credenciais da conta. O APK anterior não foi sobrescrito. A verificação estática não substitui teste funcional/entrega de push em aparelho.

Consulta de uso após a conclusão: **42% do crédito de compilação incluído consumido e custo adicional de compilação registrado igual a zero**. Não houve nova contratação, compra de crédito, AAB ou envio à Play Store.

## Rastreabilidade

O envio usa os arquivos atuais do diretório de trabalho, inclusive alterações anteriores ainda não commitadas. O hash de commit exibido pelo EAS, isoladamente, não identifica todo este conteúdo. Nenhum commit/push é implicitamente feito pelo pedido de gerar APK. Os fontes de servidor, bancos, backups e credenciais privadas não devem integrar o arquivo enviado ao EAS; o arquivo cliente `google-services.json` é necessário e não é uma chave privada FCM.

Os SHA-256 dos 47 arquivos de fonte, recursos e configuração desta versão estão em [BUILD-23-sources.sha256](BUILD-23-sources.sha256). Foram calculados sobre o pacote inspecionado antes do envio e comparados com os arquivos locais. Documentação escrita depois do envio não muda o aplicativo. Na raiz do repositório, confira a fonte com:

```bash
sha256sum -c docs/BUILD-23-sources.sha256
```

Comando utilizado, após as verificações:

```bash
npx --no-install eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 23 - Convite na entrada, credito de 9,90 para servicos e abatimento na OS'
```

Consulta da compilação já enviada, sem repetir o comando acima:

```bash
npx eas-cli build:view d94778de-156e-4e99-a9ec-1d0bba9510d0
```

## Aceite no telefone

1. Instalar o APK 23 por cima da versão anterior, sem desinstalar, verificando nome e acesso preservados.
2. Conferir dados da OS, pesquisa/reserva na Agenda, TurboRama e sorteios. A reserva real e notificações exigem conta/destinatário autorizados.
3. Em uma conta elegível para primeiro uso, testar o convite antes da primeira presença autenticada; não usar clientes reais para criar crédito fictício.
4. Conferir saldo disponível/acumulado/usado e, em OS com utilização real autorizada, a linha de crédito e o total líquido.
5. Conferir permissão, recebimento e abertura dos avisos no aparelho. Uma compilação ou inspeção estática não comprova entrega de push.

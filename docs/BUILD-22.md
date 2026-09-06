# APK 22 — Agenda e programa de indicações

Registro de 05/09/2026. **Compilação concluída (`FINISHED`), APK baixado e 36 conferências aprovadas. Teste físico no telefone pendente.**

Atualizações posteriores a este artefato: [5% por conclusão da OS](CASHBACK-SERVICOS-5.md) e [bônus de R$ 9,90 pelo primeiro acesso ao app](BONUS-APP-990.md) já estão ativos no servidor. O APK 22 lê os 5% dinamicamente, mas não contém o novo campo de convite na entrada/cadastro nem o cartão separado dos R$ 9,90. Esses componentes e o detalhe do crédito na OS foram compilados no [APK 23](BUILD-23.md). As observações abaixo descrevem o momento do build 22, não revogam essas implantações posteriores.

[Baixar APK 22](https://expo.dev/artifacts/eas/ICdxqqqBA-eF6CIptUSezO84lWUUI3wmDBe_K_p9abM.apk).

- [Página da compilação no Expo](https://expo.dev/accounts/lzgames/projects/lz-games/builds/eb4b4bbf-34af-4306-bb2c-e74a8c1d2fae).
- ID: `eb4b4bbf-34af-4306-bb2c-e74a8c1d2fae`.
- Criado em `2026-09-05T18:50:31.041Z`, concluído em `2026-09-05T18:57:29.469Z`, prioridade `HIGH`, perfil `preview`.
- Versão `1.0.1`, Android `versionCode 22`, pacote `br.com.lzgames.app`, nome `LZ-GAMES`.
- Instalação direta por APK. Não houve envio à Play Store nem compra de serviços.

## Fonte incluída

1. Correção do bloqueio de reservas de clientes com sessão CORE: a confirmação da Agenda aceita o cadastro da assistência, sem exigir uma sessão TurboBox adicional. Mantidas as regras de horários/profissionais do site e a confirmação WhatsApp existente.
2. Uma reserva por ação, bloqueio de toque duplo, ausência de repetição automática após falha e confirmação somente com sucesso/protocolo válidos. Erro ao atualizar a lista depois da reserva não descarta o sucesso.
3. Atalhos **Indique e ganhe cashback** em Início e Conta, mantendo as seis opções do menu inferior. Tela nativa com resumo, níveis recebidos do servidor, convite compartilhável, vinculação confirmada e histórico em grupos de dez.
4. Identificação CORE ou TurboBox nas rotas de indicação, com validação no servidor. Dados financeiros não são calculados no app; o total aprovado exibido é histórico, não saldo sacável.
5. Mantidos efeitos, ícones Lottie, login, sorteios, avisos de OS e lembretes de agenda do APK 21.

Detalhes, limites e testes em [INDICACOES-AGENDA.md](INDICACOES-AGENDA.md).

## Definição posterior ao envio

Depois de congelar e enviar esta fonte, o usuário definiu uma evolução do programa: **R$ 9,90 por indicação do app**, acumulados exclusivamente para serviços, sem saque, e **5% por indicação de serviço**, creditados ao indicador quando o serviço do indicado for marcado como concluído no painel da nota. O gatilho do serviço é conclusão, não pagamento. Essa nova concessão de crédito e separação de saldos **não estão neste APK nem foram ativadas no banco**. O build 22 integra o programa já existente. É necessário concluir as condições do bônus do app, separar o crédito de serviços de valores liberáveis e testar a nova regra sem recalcular o histórico.

## Validações antes da compilação

- Checagem TypeScript: aprovada.
- App: 14 testes Agenda, 17 indicações, 38 push/controles e 37 efeitos aprovados (106 no total).
- Backend Agenda: 124 verificações isoladas aprovadas.
- Ponte CORE/TurboBox: 11 testes aprovados no servidor completo; na cópia auditável, 10 passam e a integração com arquivos completos fica explicitamente pendente.
- Configuração Firebase local: válida. Exportação Android: aprovada.
- Revisão independente dos contratos, autenticação, limites de histórico, compartilhamento e confirmação: sem bloqueante novo identificado.

Não foram feitas reservas, aceitações de indicação, concessões de crédito ou mensagens reais para teste.

## Backend implantado

A correção da Agenda foi ativada no TurboBox sem substituir o site. Sondas sem sessão ou com token inválido retornaram `401`, inclusive no fluxo CORE.

A ponte de indicações foi ativada no serviço CORE em 05/09/2026. O processo próprio foi encerrado com `SIGTERM` somente após conferir UID, PID e política `Restart=always`; o supervisor relançou a API. Estado posterior: `active/running`, PID `239472`, `NRestarts=1`. Saúde retornou `200 healthy`; sessões CORE/BOX ausentes ou inválidas foram recusadas com `401`; preflight CORS retornou `204` permitindo `X-LZ-Identity-Provider`.

## Teste físico pendente

Instalar a versão correta em um Android autorizado, conferir os atalhos e o compartilhamento nativo e realizar um fluxo controlado de reserva e indicação com conta/destinatário definidos. Verificação da compilação, testes simulados e sondas sem autenticação não substituem esse teste.

## Conferência do arquivo distribuído

Arquivo local: `play-store/LZ-GAMES-build22.apk`, ignorado no Git, **72.637.674 bytes**.

```text
SHA-256: 6fba04d2450ef8a1f0fbac718f4a5273d562e1e814ab5729036e53882411418d
Certificado SHA-256: 9b1ef548a90a075f2d8f95853b671819b8d53e9a074580a8272c2c0fcd716c9e
```

As 36 conferências passaram em `2026-09-05T19:01:29.621Z`: assinatura válida e igual ao APK 21, pacote/nome/versão corretos, permissão e configuração FCM, bundle Hermes, quatro Lotties com suas licenças, avisos de sorteios/OS/agenda preservados, marcadores da nova tela e das rotas de indicação, remoção do bloqueio antigo de reserva e presença do tratamento de sessão CORE. A inspeção dos nomes no arquivo também confirmou exclusão dos fontes `server/` e dos padrões de arquivos privados verificados.

O download partiu do artefato oficial retornado pelo EAS e seguiu uma cadeia limitada de HTTPS entre `expo.dev`, `api.expo.dev` e `wf-artifacts.eascdn.net`, sem encaminhar credenciais de conta. Nenhuma URL temporária assinada ou segredo foi registrado.

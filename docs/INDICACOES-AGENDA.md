# Indique e ganhe no app e correção da Agenda

Implementação de 05/09/2026. Estas alterações são posteriores ao APK 21; instalar um APK que inclua esta fonte. Atualizar apenas a página do Expo não altera um aplicativo já instalado.

## Para o cliente

O atalho **Indique e ganhe cashback** fica no **Início** e em **Minha conta**. Abre uma tela interna; as seis opções do menu inferior continuam no mesmo lugar.

- Resumo: quantidade de indicações pendentes, concluídas e canceladas, nível atual e progresso para o próximo nível.
- Cashback aprovado: soma histórica aprovada informada pelo servidor. Não é um saldo disponível para saque ou consumo. O app não concede créditos nem executa pagamentos.
- Compartilhar convite: solicita o código assinado à API existente e abre o compartilhamento nativo do telefone. O cliente escolhe o destinatário e confirma o envio. Não envia WhatsApp automaticamente.
- Recebeu uma indicação: aceita o código ou o link oficial. O cliente confirma a vinculação em uma janela antes do envio. Não associa indicações silenciosamente ao abrir a tela ou fazer login.
- Histórico: registros dos últimos 365 dias, até 200, com nome abreviado, situação, data e valor informado. Exibe dez por vez, com botão para mostrar mais. Não mostra CPF ou telefone dos indicados.

Sem resposta válida do servidor, a tela informa o erro e permite tentar novamente. Não inventa saldo zero nem confirma um cadastro que falhou. Cliques duplicados são bloqueados durante a operação.

## Reutilização do programa existente

O aplicativo consome a API CORE em `https://app.lzgames.com.br/api`:

| Ação | Rota | Efeito |
| --- | --- | --- |
| Consultar resumo e níveis | `GET /me/referrals/summary` | Somente leitura |
| Consultar histórico | `GET /me/referrals/list?days=365` | Somente leitura |
| Gerar convite | `POST /me/referrals/link` | Código assinado pelo servidor; não cria indicação |
| Vincular convite recebido | `POST /referrals/accept` | Registra a indicação pendente após confirmação do cliente |

Os níveis vêm da resposta do servidor. Não são valores concedidos pelo aplicativo. A API existente bloqueia autoindicação e evita duplicar o mesmo par de indicador/indicado; isso não significa exclusividade global de um único indicador por pessoa. As regras financeiras, validação pela loja, rotas administrativas e confirmação por integração não foram alteradas.

A integração financeira legada precisa de uma revisão separada antes de prometer aprovação automática por pagamento de OS. Foram identificadas divergências em um procedimento legado de confirmação; ele não foi executado nem corrigido neste trabalho. Esta entrega permite cadastrar a indicação e acompanhar os créditos que o sistema efetivamente aprovar, sem inventar uma regra de concessão.

## Identificação e segurança

O app usa as sessões que já possui: TurboBox quando presente, CORE caso contrário. O cabeçalho `X-LZ-Identity-Provider` informa o provedor; ele não substitui a validação do Bearer. Não há troca automática de identidade após uma falha.

Somente as rotas de indicação do consumidor receberam uma ponte para a sessão TurboBox. O CORE verifica essa sessão no endpoint fixo HTTPS `/api/mobile/v1/me` e encontra um único cadastro atual pelo telefone completo. Cadastros ausentes ou ambíguos são bloqueados com orientação para a loja. A ponte não cria contas, copia senhas, emite tokens ou concede créditos. A autenticação CORE existente continua disponível.

Código auditável, testes e implantação: [server/core/README.md](../server/core/README.md). Esse diretório é excluído do envio EAS por `.easignore`; não contém credenciais privadas.

## Correção da Agenda

O cadastro pelo aplicativo gerava uma sessão CORE. Entretanto, o envio de uma reserva exigia uma sessão TurboBox e mostrava “Entre com seu WhatsApp para usar a agenda”, mesmo com o cliente conectado. O CPF era preenchido na mesma etapa, mas não causava o bloqueio.

Agora `bookAgenda` envia uma única solicitação autenticada ao endpoint existente `/api/mobile/v1/agenda/book`, identificando CORE ou TurboBox. O backend valida a sessão e usa nome/telefone obtidos no servidor; o CPF continua sendo informado no formulário. O backend encaminha ao mesmo `criarAgendamento` do site, preservando serviços, profissionais, dias bloqueados, intervalos, horários e confirmação WhatsApp.

Não há segunda tentativa automática após falha de rede: a primeira pode já ter criado a reserva. O cliente só recebe confirmação quando a resposta informa sucesso e protocolo. Uma falha posterior ao atualizar a lista não transforma uma reserva confirmada em falha. O texto só informa envio pelo WhatsApp quando o servidor declara `notificacao: enviado`.

Código auditável: `server/turbobox/mobile-agenda-auth.php`. A implantação modifica apenas o tratamento de autenticação/resposta da rota de reserva no `mobile-api.php`; não substitui o site da Agenda.

## Testes reproduzíveis

```bash
npm run typecheck
npm run test:agenda
npm run test:referrals
npm run test:push
npm run test:effects
php server/turbobox/tests/mobile-agenda-auth.php
node --test server/core/tests/referralAuth.test.js
```

As suítes utilizam fixtures, transportes e bancos simulados. Não criam agendamentos reais, não enviam WhatsApp, não cadastram indicações reais e não alteram créditos. A cópia parcial do CORE marca como pendente a verificação de integração com os arquivos completos; esse teste deve passar no servidor CORE antes da ativação.

Depois de instalar a nova versão em um telefone autorizado, conferir navegação, compartilhamento nativo, entrada de código, atualização do histórico e reserva com uma conta controlada. Um teste real que cria reserva ou indicação exige conta e destinatário de teste definidos. Não foi realizado nesta preparação.

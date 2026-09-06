# Agenda: detalhes da reserva e confirmação no WhatsApp

Implementação de 06/09/2026 incluída no [APK 26](BUILD-26.md), já compilado,
verificado e publicado. O servidor também usa a alteração. É necessário instalar
o APK 26 para ver o cartão de detalhes no aparelho.

## O que o cliente vê

Na Agenda, cada reserva tem `VER DETALHES`. Tocar no resumo abre ou fecha os dados:
protocolo, data, intervalo de horário, situação, serviço, profissional, cliente,
WhatsApp e dados da loja. Não exibe preços, chaves de cancelamento ou observações
internas. Os textos são selecionáveis. Reservas apagadas/canceladas continuam
saindo da lista quando ela é atualizada; detalhes abertos refletem os dados novos.

`AppointmentCard.tsx` usa os efeitos existentes, sem dependência, animação ou
consulta adicional. `appointmentDetails.ts` organiza uma lista explícita de
campos de ambas as APIs. Datas civis não são convertidas para o fuso do aparelho.

O nome/endereço do estabelecimento vêm de `listServicos.loja`, reaproveitando a
consulta do catálogo. A fonte é `LOJA_NOME`/`LOJA_ENDERECO` da Agenda, a mesma do
WhatsApp; não há endereço da empresa duplicado dentro do APK.

## Fluxo do envio

1. O app envia uma única reserva autenticada para `/api/mobile/v1/agenda/book`.
2. A ponte valida a identidade CORE/BOX e chama `criarAgendamento` da Agenda.
3. A Agenda valida CPF, expediente/feriados, almoço, serviço e disponibilidade,
   grava a reserva/cupom e confirma a transação.
4. `agenda_notify_booking` monta o **modelo que já existia no site**, chama
   `msg_texto`/Menuia uma vez, imediatamente, e registra em `whatsapp_mensagens`.
5. A resposta mantém todos os campos antigos e acrescenta `agendamento`, com o
   comprovante da reserva. O app o apresenta antes de atualizar a lista. Uma falha
   de atualização não transforma a reserva aceita em uma nova tentativa de POST.

O modelo preserva título, emojis, separadores, loja, profissional, serviço, data,
horário inicial/final, cliente, contato, endereço e orientação da véspera. Foi
corrigida a máscara do telefone: o DDI 55 não aparece como se fosse o DDD.

Não usa `wa.me`, não abre o WhatsApp do telefone e não envia uma segunda mensagem
pela API móvel. Os avisos push existentes de OS/agenda/sorteios não foram alterados.

### Tempos e falhas

Menuia tem limite de 25 segundos. A ponte móvel tinha somente 15, o que poderia
interromper uma resposta de reserva já gravada. Agora `criarAgendamento` espera
até 45 segundos (incluindo folga para conexão, lock e banco); consultas mantêm 15.
Timeout de reserva orienta conferir a lista antes de tentar novamente. Não há
reenvio automático de POST/mensagem.

`notificacao=enviado` significa resposta aceita pelo provedor, **não** confirmação
de entrega/leitura no aparelho. HTTP de erro, rejeição explícita ou falha de rede
não anunciam envio bem-sucedido. Falhas também são registradas. Se o registro de
auditoria falhar após envio aceito, não ocorre novo disparo nem desfazimento da
reserva. Logs técnicos não incluem o corpo do provedor, tokens, telefone ou nome.

## Servidores e implantação

- Agenda ativa: `/home/lz-servidor/Documentos/lzgames/agenda/index.php`.
- Helper ao lado: `booking-confirmation.php`.
- Ponte ativa: `/home/lz-servidor/releases/turbobox/coupons-v1-20260902/mobile-api.php`.
- Helper da ponte: `mobile-agenda-auth.php`.
- Backup privado anterior a esta mudança:
  `/home/lz-servidor/.config/lzgames/agenda-details-backup-viLQAP`.

No repositório, os helpers ficam em `server/agenda/` e `server/turbobox/`.
Reconciliar `booking-confirmation-integration.patch` e
`appointment-details-integration.patch` somente nos arquivos ativos indicados.
Não substituir a Agenda pelo diretório antigo `systema/agenda`. Não versionar o
`index.php` completo com suas credenciais; os patches não contêm essas chaves.
Não houve migração nem alteração das regras de CPF/convites/crédito.

## Validação

```bash
npm run typecheck
node --test scripts/*.test.cjs
php server/agenda/tests/booking-confirmation.php
php server/agenda/tests/booking-customer.php
php server/turbobox/tests/mobile-agenda-auth.php
```

Resultados: TypeScript aprovado; 137 testes do app aprovados, incluindo abertura e
fechamento dos detalhes, preservação da reserva em falha de atualização e remoção
de registros excluídos. Helper da confirmação: 28 verificações simuladas; CPF: 8
verificações offline; ponte CORE/BOX: 150 verificações offline. Sintaxe PHP dos
arquivos ativos aprovada e helpers conferidos contra as cópias do repositório.

Consultas públicas verificadas: saúde da Agenda, catálogo com 96 serviços e dados
da loja. Rotas móveis/de consulta sem sessão continuam respondendo 401. Nenhuma
reserva real, mensagem ao cliente ou mudança de crédito foi usada nos testes.

Validação final em aparelho, após instalar o APK 26: reservar um horário usando uma
conta/destinatário de teste autorizado; conferir uma mensagem única no WhatsApp,
protocolo/data/horário/profissional no app e na Agenda; atualizar/cancelar a reserva
pelo fluxo normal e conferir a lista. O teste simulado não comprova entrega real.

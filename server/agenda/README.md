# Correção do cadastro na confirmação da Agenda

Atualização de 06/09/2026: [detalhes da reserva e confirmação WhatsApp](../../docs/AGENDA-DETALHES-E-WHATSAPP.md). Coloque também `booking-confirmation.php` ao lado do `index.php` e reconcilie `booking-confirmation-integration.patch`. Ele reutiliza o modelo do site após o commit, preserva os campos antigos de resposta e acrescenta o comprovante para o app. `php tests/booking-confirmation.php` executa 28 verificações simuladas sem disparos reais.

Fonte ativa: `/home/lz-servidor/Documentos/lzgames/agenda/index.php`. Leia [causa, implantação, segurança e testes](../../docs/SEGURANCA-INDICACOES-AGENDA-CPF.md).

Copie `booking-customer.php` ao lado do `index.php` real, e reconcilie `booking-customer-integration.patch`. O helper não substitui a página e não deve ser publicado como um novo endpoint. Sua função precisa executar dentro da mesma transação da reserva.

Ele compara telefone completo e CPF normalizado, reutilizando o cliente correto sem regravar um CPF equivalente que colidiria com `uq_usuario_cpf`. Mantém conflitos reais explícitos. Não faz fusão de clientes, exclusão de duplicatas ou alteração das regras de horário.

```bash
php -l booking-customer.php
php -l index.php
php tests/booking-customer.php
```

Na máquina autorizada, `LZ_AGENDA_SQL_FIXTURES=1 php tests/booking-customer.php` também reproduz o problema usando somente a tabela temporária da conexão. A variável desativa o teste SQL por padrão. São 11 verificações com SQL, sem criar reserva ou enviar WhatsApp real.

Atualize também `../turbobox/mobile-agenda-auth.php` no backend móvel para traduzir os códigos de conflito. Não retirar autenticação nem simplesmente esconder o erro na interface.

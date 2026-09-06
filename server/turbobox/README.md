# Agenda: sessão CORE e TurboBox

Atualização de 06/09/2026: reconcilie também `appointment-details-integration.patch` e a versão atual do helper. Reservas aguardam até 45 segundos para comportar o envio imediato Menuia de até 25 segundos; consultas mantêm 15. A lista da Agenda inclui nome e telefone do próprio cliente para o cartão de detalhes. A ponte não faz disparo adicional de WhatsApp. Veja [fluxo e testes](../../docs/AGENDA-DETALHES-E-WHATSAPP.md). O teste do helper passou em 150 verificações offline; o número menor abaixo é histórico.

Atualização posterior: tradução dos conflitos de CPF/cadastro e datas em mensagens específicas. A [correção da colisão de CPF](../agenda/README.md) está no backend PHP da Agenda; somente traduzir o erro não a substitui. Os testes desta cópia passaram em 148 verificações offline.

Implementação de 05/09/2026 no arquivo ativo `/home/lz-servidor/releases/turbobox/coupons-v1-20260902/mobile-api.php`. O diretório é publicado pelo nginx e roteia `/api/mobile/v1`. Não substituir o site da Agenda.

Coloque `mobile-agenda-auth.php` ao lado de `mobile-api.php`. Os testes isolados podem ser executados sem bootstrap de banco:

```bash
php -l mobile-agenda-auth.php
php tests/mobile-agenda-auth.php
```

No arquivo da API móvel, adicione somente:

```php
require_once __DIR__.'/mobile-agenda-auth.php';
```

Substitua exclusivamente o bloco POST `/agenda/book` por:

```php
if ($route === '/agenda/book' && $method === 'POST') {
    try {
        $identity=mobile_agenda_identity((string)($_SERVER['HTTP_X_LZ_IDENTITY_PROVIDER']??''),mobile_token(),
            static fn()=>mobile_user($db),static fn()=>mobile_legacy_db('main'));
        if(!tb_rate_limit($identity['rateKey'],5,3600)) mobile_json(429,['ok'=>false,'error'=>['code'=>'rate_limited','message'=>'Limite de agendamentos atingido. Tente mais tarde.']]);
        $payload=mobile_agenda_booking_payload($identity['user'],mobile_body());
        $result=mobile_agenda_booking_response(mobile_agenda_request('criarAgendamento',[],$payload));
        mobile_json($result['status'],$result['payload']);
    } catch(MobileAgendaAuthError $error) {
        mobile_json($error->httpStatus,['ok'=>false,'error'=>['code'=>$error->errorCode,'message'=>$error->getMessage()]]);
    }
}
```

São dependências existentes da API: `mobile_token`, `mobile_user`, `mobile_legacy_db`, `tb_rate_limit`, `mobile_body`, `mobile_agenda_request` e `mobile_json`. Não duplicar essas funções nem armazenar senhas/tokens neste diretório.

O provedor omitido ou `box` mantém a autenticação TurboBox anterior. `core` valida o Bearer no endereço fixo HTTPS `/api/auth/me` do CORE e confirma ID e telefone atuais em `clientes`, antes de usar nome/telefone obtidos pelo servidor. O corpo da reserva não define a identidade do cliente. O CPF continua vindo do formulário da Agenda. Falhas temporárias e respostas inválidas não desencadeiam uma reserva com outro provedor.

Faça backup privado do arquivo ativo antes de reconciliar alterações; não sobrescreva outras rotas. Nesta implantação, o backup anterior ficou em `/tmp/lzgames-agenda-fix-NXp28x/mobile-api.before.php`, e o diff confirmou mudança apenas no `require_once` e no bloco de reserva. Não houve migração de banco, criação de cliente ou mensagem real para teste. O PHP ativo reconheceu a nova rota sem reiniciar outros serviços.

Valide também a sintaxe de `mobile-api.php` após a integração. Requisições de diagnóstico sem sessão ou com token inválido devem retornar `401` antes de criar qualquer agendamento. Uma reserva real requer conta e destinatário de teste definidos.

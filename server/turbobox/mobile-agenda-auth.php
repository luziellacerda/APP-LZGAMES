<?php
declare(strict_types=1);

/** Narrow bridge for POST /api/mobile/v1/agenda/book only. No bootstrap, migrations or token storage. */
final class MobileAgendaAuthError extends RuntimeException
{
    public function __construct(public readonly int $httpStatus,public readonly string $errorCode,string $message)
    {
        parent::__construct($message);
    }
}

function mobile_agenda_canonical_phone(string $phone): string
{
    if($phone===''||strlen($phone)>40||preg_match('/[^0-9+().\s-]/',$phone))return '';
    $digits=preg_replace('/\D/','',$phone)??'';
    if(in_array(strlen($digits),[12,13],true)&&str_starts_with($digits,'55'))$digits=substr($digits,2);
    if(!preg_match('/^[1-9][0-9](?:[2-9][0-9]{7}|9[0-9]{8})$/D',$digits))return '';
    if(strlen($digits)===10&&preg_match('/^[1-9][0-9][6-9]/',$digits))$digits=substr($digits,0,2).'9'.substr($digits,2);
    return '55'.$digits;
}

/** Fixed authenticated upstream. A token is never decoded locally or forwarded to an arbitrary URL. */
function mobile_agenda_core_request(string $token): array
{
    $raw='';$tooLarge=false;
    $ch=curl_init('https://app.lzgames.com.br/api/auth/me');
    curl_setopt_array($ch,[CURLOPT_HTTPGET=>true,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,
        CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_HTTPHEADER=>['Accept: application/json','Authorization: Bearer '.$token],
        CURLOPT_WRITEFUNCTION=>static function($handle,string $chunk)use(&$raw,&$tooLarge):int{
            if(strlen($raw)+strlen($chunk)>65536){$tooLarge=true;return 0;}
            $raw.=$chunk;return strlen($chunk);
        }]);
    $done=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$failed=$done===false||curl_errno($ch)!==0;
    curl_close($ch);
    $payload=null;
    if(!$failed&&!$tooLarge){try{$payload=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}catch(Throwable){}}
    return ['status'=>$status,'payload'=>$payload,'transportFailed'=>$failed&&!$tooLarge,'invalidResponse'=>$tooLarge];
}

/** Resolvers are injected for offline tests. BOX uses its unchanged local authentication resolver. */
function mobile_agenda_identity(string $provider,string $token,callable $boxUser,callable $mainDatabase,?callable $transport=null): array
{
    if(!in_array($provider,['','box','core'],true))throw new MobileAgendaAuthError(400,'invalid_identity_provider','Origem da sessão inválida.');
    if($provider!== 'core'){
        $user=$boxUser();
        return ['provider'=>'box','user'=>$user,'rateKey'=>'mobile_agenda_book_'.(int)$user['id']];
    }
    if(!preg_match('/^[\x21-\x7e]{1,8192}$/D',$token))throw new MobileAgendaAuthError(401,'unauthorized','Acesso não autenticado.');
    try{$response=($transport??'mobile_agenda_core_request')($token);}catch(Throwable){$response=['status'=>0];}
    if(!is_array($response))throw new MobileAgendaAuthError(502,'identity_invalid_response','Não foi possível validar a resposta do cadastro.');
    $status=$response['status']??0;
    if(!is_int($status))throw new MobileAgendaAuthError(502,'identity_invalid_response','Não foi possível validar a resposta do cadastro.');
    if(!empty($response['transportFailed'])||$status===0||in_array($status,[408,429],true)||($status>=500&&$status<=599))
        throw new MobileAgendaAuthError(503,'identity_unavailable','O cadastro está temporariamente indisponível. Tente novamente.');
    if(in_array($status,[401,403],true))throw new MobileAgendaAuthError($status,'invalid_token','Sua sessão não permite agendar. Entre novamente.');
    $payload=$response['payload']??null;$claim=is_array($payload)?($payload['user']??null):null;
    $id=is_array($claim)?($claim['id']??null):null;
    $claimedPhone=is_array($claim)&&is_string($claim['telefone']??null)?mobile_agenda_canonical_phone($claim['telefone']):'';
    if($status!==200||!empty($response['invalidResponse'])||!is_array($payload)||($payload['ok']??null)!==true||!is_array($claim)
        ||(!is_string($id)&&!is_int($id))||!preg_match('/^[1-9][0-9]{0,18}$/D',(string)$id)||$claimedPhone==='')
        throw new MobileAgendaAuthError(502,'identity_invalid_response','Não foi possível validar a resposta do cadastro.');
    // auth/me authenticates the claim, but current ownership must still be confirmed in CORE.
    try{
        $main=$mainDatabase();
        if(!$main instanceof PDO)throw new RuntimeException('Unavailable');
        $query=$main->prepare('SELECT id,nome,telefone,cpf FROM clientes WHERE id=? LIMIT 2');
        $query->execute([(string)$id]);$rows=$query->fetchAll(PDO::FETCH_ASSOC);
    }catch(Throwable){throw new MobileAgendaAuthError(503,'identity_unavailable','O cadastro está temporariamente indisponível. Tente novamente.');}
    $current=count($rows)===1?$rows[0]:null;
    $phone=is_array($current)&&is_string($current['telefone']??null)?mobile_agenda_canonical_phone($current['telefone']):'';
    $name=is_array($current)&&is_string($current['nome']??null)?trim($current['nome']):'';
    if(!$current||(string)$current['id']!==(string)$id||$phone===''||!hash_equals($claimedPhone,$phone)||$name==='')
        throw new MobileAgendaAuthError(403,'identity_changed','Seu cadastro precisa ser atualizado. Entre novamente ou procure atendimento.');
    return ['provider'=>'core','user'=>['id'=>(string)$id,'name'=>$name,'phone'=>$phone,'document'=>(string)($current['cpf']??'')],
        'rateKey'=>'mobile_agenda_book_core_'.(string)$id];
}

/** Identity fields can only come from the server resolver, never the booking body. */
function mobile_agenda_booking_payload(array $user,array $body): array
{
    $service=$body['serviceId']??0;$sector=$body['sectorId']??0;$date=$body['date']??'';$start=$body['start']??'';
    $document=$body['document']??$user['document']??'';
    if((!is_int($service)&&!is_string($service))||(!is_int($sector)&&!is_string($sector))
        ||!ctype_digit((string)$service)||!ctype_digit((string)$sector)||(int)$service<1||(int)$sector<1
        ||!is_string($date)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',trim($date))
        ||!is_string($start)||!preg_match('/^\d{2}:\d{2}$/D',trim($start))||(!is_string($document)&&!is_int($document)))
        throw new MobileAgendaAuthError(422,'validation','Preencha serviço, data e horário.');
    return ['nome'=>(string)$user['name'],'telefone'=>(string)$user['phone'],'cpf'=>preg_replace('/\D+/','',(string)$document),
        'setor_id'=>(int)$sector,'servico_id'=>(int)$service,'data'=>trim($date),'inicio'=>trim($start)];
}

function mobile_agenda_request_timeout(string $action): int
{
    // Booking waits for the existing immediate Menuia send (up to 25 seconds)
    // plus the reservation lock and database work. Read-only discovery stays fast.
    return $action==='criarAgendamento'?45:15;
}

/** Some legacy business failures use HTTP 200. Never report them as a completed booking. */
function mobile_agenda_booking_response(array $response): array
{
    $status=$response['status']??0;$payload=$response['payload']??null;
    if(!is_int($status)||$status<200||$status>=600||($status>=300&&$status<400)||!is_array($payload))
        return ['status'=>502,'payload'=>['ok'=>false,'error'=>['code'=>'agenda_invalid_response','message'=>'A agenda retornou uma resposta inválida.']]];
    $failed=$status>=400||($payload['ok']??null)===false||($payload['success']??null)===false||!empty($payload['error'])||!empty($payload['erro']);
    if(!$failed)return ['status'=>200,'payload'=>['ok'=>true,'data'=>$payload]];
    $messages=['cpf_invalido'=>'Informe um CPF válido para agendar.','slot_ocupado'=>'Esse horário acabou de ser ocupado. Escolha outro.',
        'dia_lotado'=>'A agenda desse dia está lotada.','horario_passado'=>'Esse horário já passou.',
        'cpf_em_uso'=>'Este CPF está vinculado a outro telefone na agenda. A loja precisa conferir o cadastro antes de vincular um telefone diferente.',
        'cpf_divergente'=>'O CPF informado é diferente do cadastro deste telefone. Confira os números digitados.',
        'cadastro_ambiguo'=>'Há mais de um cadastro para este telefone. A loja precisa conferir os registros.',
        'telefone_invalido'=>'Atualize seu WhatsApp com DDD no cadastro e entre novamente.',
        'horario_invalido'=>'Escolha novamente um dos horários disponíveis.',
        'dia_fechado'=>'Não há atendimento nesta data. Escolha outro dia.',
        'data_passada'=>'Escolha uma data a partir de hoje.',
        'data_invalida'=>'Escolha uma data válida no calendário.',
        'data_fora_limite'=>'Escolha uma data dentro dos próximos 12 meses.',
        'agenda_ocupada'=>'A agenda está processando outra reserva. Tente novamente em instantes.',
        'servico_invalido'=>'Selecione o serviço novamente antes de confirmar.',
        'dados_invalidos'=>'Confira os dados do cadastro, serviço e horário antes de confirmar.'];
    $candidate=$payload['error']??$payload['erro']??'';
    $code=is_string($candidate)&&isset($messages[$candidate])?$candidate:'agenda_error';
    return ['status'=>$status>=400?$status:422,'payload'=>['ok'=>false,'error'=>['code'=>$code,
        'message'=>$messages[$code]??'Não foi possível concluir o agendamento. Tente novamente ou procure atendimento.']]];
}

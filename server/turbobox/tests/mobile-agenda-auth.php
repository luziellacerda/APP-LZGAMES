<?php
declare(strict_types=1);
require_once __DIR__.'/../mobile-agenda-auth.php';
$checks=0;
function agenda_check(bool $ok,string $label): void{global $checks;$checks++;if(!$ok)throw new RuntimeException($label);}
agenda_check(mobile_agenda_request_timeout('criarAgendamento')>=25+5+5,'Booking timeout exceeds Menuia, lock and connection budgets');
agenda_check(mobile_agenda_request_timeout('slots')===15&&mobile_agenda_request_timeout('listServicos')===15,'Read-only requests retain their previous timeout');
function agenda_reject(callable $action,int $status,string $label): void{
    try{$action();}catch(MobileAgendaAuthError $e){agenda_check($e->httpStatus===$status,$label.' status');agenda_check($e->getPrevious()===null&&!str_contains($e->getMessage(),'SYNTHETIC_PRIVATE'),'Sanitized error');return;}
    throw new RuntimeException($label.' was accepted');
}
function agenda_main(): PDO{
    $db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec("CREATE TABLE clientes(id INTEGER PRIMARY KEY,nome TEXT,telefone TEXT,cpf TEXT);
        INSERT INTO clientes VALUES(1,'Current CORE fixture','(82) 99888-7777','123.456.789-00'),(2,'Other CORE fixture','82996665555','98765432100');
        PRAGMA query_only=ON;");return $db;
}
function agenda_claim(array $user=[]): array{return ['status'=>200,'payload'=>['ok'=>true,'user'=>$user+['id'=>1,'nome'=>'Stale claim name','telefone'=>'5582998887777','documento'=>'00000000000']]];}
$db=agenda_main();$calls=['box'=>0,'main'=>0,'transport'=>0];
$box=static function()use(&$calls):array{$calls['box']++;return ['id'=>1,'name'=>'BOX fixture','phone'=>'82992223333','document'=>'22222222222'];};
$main=static function()use(&$calls,$db):PDO{$calls['main']++;return $db;};
$transport=static function(string $token)use(&$calls):array{$calls['transport']++;agenda_check($token==='synthetic-core-bearer','Token forwarded only to injected fixed transport');return agenda_claim();};
foreach(['','box'] as $provider){$identity=mobile_agenda_identity($provider,'synthetic-box-token',$box,$main,$transport);agenda_check($identity['user']['name']==='BOX fixture'&&$identity['rateKey']==='mobile_agenda_book_1','BOX compatibility');}
agenda_check($calls===['box'=>2,'main'=>0,'transport'=>0],'BOX never queries CORE');
$identity=mobile_agenda_identity('core','synthetic-core-bearer',$box,$main,$transport);
agenda_check($calls['box']===2&&$calls['main']===1&&$calls['transport']===1,'CORE never resolves a colliding BOX id');
agenda_check($identity['user']===['id'=>'1','name'=>'Current CORE fixture','phone'=>'5582998887777','document'=>'123.456.789-00'],'Current CORE row is authoritative');
agenda_check($identity['rateKey']==='mobile_agenda_book_core_1','Separate CORE rate limit namespace');
foreach(['other','CORE',' core','core,box','https://untrusted.example'] as $provider)agenda_reject(fn()=>mobile_agenda_identity($provider,'token',$box,$main,$transport),400,'Provider allowlist');
foreach(['',"with\nnewline",'two tokens',str_repeat('a',8193)] as $token)agenda_reject(fn()=>mobile_agenda_identity('core',$token,$box,$main,$transport),401,'Invalid bearer');
$before=$calls;
foreach([0,408,429,500,503,599] as $status)agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>['status'=>$status,'payload'=>['error'=>'SYNTHETIC_PRIVATE']]),503,'Retryable identity upstream');
foreach([401,403] as $status)agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>['status'=>$status,'payload'=>['error'=>'SYNTHETIC_PRIVATE']]),$status,'Auth rejection preserved');
foreach([201,302,404,422] as $status)agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>['status'=>$status]),502,'Unexpected identity status');
foreach([['status'=>200,'payload'=>null],['status'=>200,'payload'=>['ok'=>false]],['status'=>200,'payload'=>['ok'=>true,'data'=>['user'=>['id'=>1]]]],agenda_claim(['id'=>'1 OR 1=1']),agenda_claim(['id'=>true]),agenda_claim(['id'=>'01']),agenda_claim(['telefone'=>'8887777']),agenda_claim(['telefone'=>['SYNTHETIC_PRIVATE']]),agenda_claim()+['invalidResponse'=>true]] as $response)
    agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>$response),502,'Malformed identity envelope');
agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>agenda_claim()+['transportFailed'=>true]),503,'Partial response/network error');
agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>throw new RuntimeException('SYNTHETIC_PRIVATE')),503,'Transport exception');
agenda_check($calls===$before,'Failed CORE identity never falls back to BOX or reads legacy DB');
agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,fn()=>null,fn()=>agenda_claim()),503,'Missing main connection');
agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,fn()=>throw new RuntimeException('SYNTHETIC_PRIVATE'),fn()=>agenda_claim()),503,'Database exception');
agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>agenda_claim(['id'=>99])),403,'Deleted CORE customer');
agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>agenda_claim(['id'=>2])),403,'Valid claim phone cannot select another CORE customer');
agenda_reject(fn()=>mobile_agenda_identity('core','fixture',$box,$main,fn()=>agenda_claim(['telefone'=>'82996665555'])),403,'Current phone mismatch');
agenda_check((int)$db->query('SELECT COUNT(*) FROM clientes')->fetchColumn()===2,'CORE lookup makes no customer writes');
agenda_check(mobile_agenda_canonical_phone('(82) 9888-7777')==='5582998887777','Canonical legacy mobile');
agenda_check(mobile_agenda_canonical_phone('+55 (82) 3333-4444')==='558233334444','Full landline normalization');
foreach(['8887777','00000000000','+1 82998887777','5582998887777123','82998887777 ext 2'] as $phone)agenda_check(mobile_agenda_canonical_phone($phone)==='','No suffix/invalid phone matching');
$body=['serviceId'=>5,'sectorId'=>2,'date'=>'2026-09-08','start'=>'14:00','document'=>'111.222.333-44',
    'nome'=>'SYNTHETIC_PRIVATE impersonation','phone'=>'82991112222','telefone'=>'82991112222','userId'=>2,'provider'=>'box'];
$booking=mobile_agenda_booking_payload($identity['user'],$body);
agenda_check($booking===['nome'=>'Current CORE fixture','telefone'=>'5582998887777','cpf'=>'11122233344','setor_id'=>2,'servico_id'=>5,'data'=>'2026-09-08','inicio'=>'14:00'],'Only booking fields from body; contact always server identity');
unset($body['document']);agenda_check(mobile_agenda_booking_payload($identity['user'],$body)['cpf']==='12345678900','Current profile document default');
foreach([['serviceId'=>[]],['serviceId'=>0],['sectorId'=>false],['date'=>[]],['start'=>'bad'],['document'=>[]]] as $invalid)agenda_reject(fn()=>mobile_agenda_booking_payload($identity['user'],$invalid+$body),422,'Invalid booking body');
$success=['status'=>200,'payload'=>['ok'=>true,'id'=>123]];
agenda_check(mobile_agenda_booking_response($success)===['status'=>200,'payload'=>['ok'=>true,'data'=>$success['payload']]],'Success envelope preserved');
foreach([['status'=>200,'payload'=>['ok'=>false]],['status'=>200,'payload'=>['success'=>false]],['status'=>200,'payload'=>['erro'=>'slot_ocupado']],['status'=>409,'payload'=>['error'=>'slot_ocupado']],['status'=>500,'payload'=>['error'=>'SYNTHETIC_PRIVATE SQL']],['status'=>500,'payload'=>['error'=>['SYNTHETIC_PRIVATE']]]] as $failed){
    $result=mobile_agenda_booking_response($failed);
    agenda_check($result['status']>=400&&$result['payload']['ok']===false,'Business failure cannot become booking success');
    agenda_check(!str_contains(json_encode($result),'SYNTHETIC_PRIVATE'),'No raw booking error in client response');
}
agenda_check(mobile_agenda_booking_response(['status'=>200,'payload'=>['erro'=>'slot_ocupado']])['payload']['error']['code']==='slot_ocupado','Known business error has safe localized message');
foreach(['cpf_em_uso','cpf_divergente','cadastro_ambiguo','telefone_invalido','horario_invalido','dia_fechado','data_passada','data_invalida','data_fora_limite','agenda_ocupada','servico_invalido','dados_invalidos'] as $code){
    $result=mobile_agenda_booking_response(['status'=>409,'payload'=>['error'=>$code]]);
    agenda_check($result['status']===409&&$result['payload']['error']['code']===$code,'Booking conflicts keep their business code: '.$code);
    agenda_check($result['payload']['error']['message']!==$code,'Booking conflicts have understandable safe text: '.$code);
}
foreach([['status'=>0],['status'=>302,'payload'=>[]],['status'=>200,'payload'=>null]] as $bad)agenda_check(mobile_agenda_booking_response($bad)['status']===502,'Invalid booking response rejected');
$source=file_get_contents(__DIR__.'/../mobile-agenda-auth.php');
agenda_check(substr_count($source,'https://app.lzgames.com.br/api/auth/me')===1,'Single fixed CORE endpoint');
agenda_check(str_contains($source,'CURLOPT_FOLLOWLOCATION=>false')&&str_contains($source,'CURLOPT_SSL_VERIFYPEER=>true')&&str_contains($source,'CURLOPT_SSL_VERIFYHOST=>2'),'No redirects; strict TLS');
agenda_check(str_contains($source,'CURLOPT_TIMEOUT=>8')&&str_contains($source,'>65536'),'Bounded request and response');
echo "PASS: $checks offline checks for agenda CORE/BOX isolation, remote identity/error contract, current customer ownership, canonical phone, namespace rate limits, identity-only booking fields and safe business failures. No network, production database, booking or WhatsApp sends.\n";

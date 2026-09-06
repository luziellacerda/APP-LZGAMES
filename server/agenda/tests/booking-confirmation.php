<?php
declare(strict_types=1);
require_once __DIR__.'/../booking-confirmation.php';
$checks=0;
function check_confirmation(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks++;}
$appointment=['agendamento_id'=>901,'protocolo'=>'LZ-2030-000901','telefone'=>'+5582999990000','data_d'=>'2030-04-10',
    'hora_i'=>'10:00:00','hora_f'=>'11:00:00','servico_nome'=>'Orçamento sintético','profissional_nome'=>'Profissional de teste',
    'cliente_nome'=>'Cliente sintético','loja'=>['nome'=>'Loja sintética','endereco'=>'Endereço sintético, Maceió - AL']];
$message=agenda_booking_confirmation_message($appointment);
foreach(['✅ Horário Confirmado','🎮 - Loja: Loja sintética','🕹️ - Profissional: Profissional de teste',
    '🛠️ - Serviço: Orçamento sintético','📅 - Data: 10/04/2030','⏰ - Horário: 10:00 – 11:00',
    '🧍 - Cliente: Cliente sintético','📱 - Contato: (82) 99999-0000','📍 - Endereço: Endereço sintético, Maceió - AL',
    'responda CONFIRMO até as 17h','🙏 - Obrigado pela preferência!'] as $expected){
    check_confirmation(str_contains($message,$expected),'Existing template field: '.$expected);
}
check_confirmation(!str_contains($message,'R$')&&!str_contains($message,'cpf')&&!str_contains($message,'cancel_code'),'No prices, CPF, or private cancellation keys');
foreach(['82999990000','(82) 99999-0000','+55 (82) 99999-0000'] as $phone){
    check_confirmation(agenda_booking_confirmation_message(array_replace($appointment,['telefone'=>$phone]))===$message,'Same complete phone formatting');
}
check_confirmation(str_contains(agenda_booking_confirmation_message(array_replace($appointment,['telefone'=>'+558233330000'])),'(82) 3333-0000'),'Landline formatting');
$calls=0;$records=[];
$status=agenda_notify_booking($appointment,function($to,$text)use(&$calls,$message){$calls++;check_confirmation($to==='+5582999990000'&&$text===$message,'Exact recipient and template');return ['http'=>200,'body'=>['data'=>['id'=>'synthetic-api-id']]];},function($row)use(&$records){$records[]=$row;});
check_confirmation($status==='enviado'&&$calls===1&&count($records)===1,'One successful send and one log');
check_confirmation($records[0]['api_message_id']==='synthetic-api-id'&&$records[0]['status_envio']==='enviado'&&$records[0]['agendamento_id']===901,'Provider ID and reservation are linked');
foreach([['http'=>500,'body'=>[]],['http'=>401,'body'=>[]],['http'=>200,'body'=>['success'=>false]],['http'=>200,'body'=>['error'=>'fixture']],['http'=>200,'body'=>['status'=>'failed']],['http'=>200,'body'=>['ok'=>false]],['http'=>200,'body'=>'invalid provider reply']] as $response){
    $calls=0;$records=[];
    $status=agenda_notify_booking($appointment,function()use(&$calls,$response){$calls++;return $response;},function($row)use(&$records){$records[]=$row;});
    check_confirmation($status==='falha'&&$calls===1&&count($records)===1&&$records[0]['status_envio']==='falha','Failure recorded without retry or false success');
}
$calls=0;$records=[];
$status=agenda_notify_booking($appointment,function()use(&$calls){$calls++;throw new RuntimeException('Synthetic timeout; no network');},function($row)use(&$records){$records[]=$row;});
check_confirmation($status==='falha'&&$calls===1&&count($records)===1,'Transport exception logged without retry');
$calls=0;
$status=agenda_notify_booking($appointment,function()use(&$calls){$calls++;return ['http'=>200,'body'=>[]];},function(){throw new RuntimeException('Synthetic audit failure');});
check_confirmation($status==='enviado'&&$calls===1,'Audit failure does not change acknowledged send or resend');
echo "Booking confirmation: $checks checks passed; all recipients, senders and records are synthetic.\n";

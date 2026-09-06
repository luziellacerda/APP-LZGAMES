<?php
declare(strict_types=1);

/** Existing Agenda confirmation template, shared by website and native bookings. */
function agenda_booking_confirmation_message(array $appointment): string
{
    $line=static fn($value):string=>trim((string)preg_replace('/[\r\n\t]+/u',' ',(string)$value));
    $phone=preg_replace('/\D+/','',(string)$appointment['telefone']);
    if(preg_match('/^55\d{10,11}$/D',$phone))$phone=substr($phone,2);
    if(preg_match('/^(\d{2})(\d{4,5})(\d{4})$/D',$phone,$parts))$phone="({$parts[1]}) {$parts[2]}-{$parts[3]}";
    $date=(new DateTimeImmutable((string)$appointment['data_d']))->format('d/m/Y');
    $start=substr((string)$appointment['hora_i'],0,5);$end=substr((string)$appointment['hora_f'],0,5);
    return "✅ Horário Confirmado\n\n".
        "━━━━━━━━━━━━━━━━━━━━━━━━\n".
        "🎮 - Loja: ".$line($appointment['loja']['nome'])."\n".
        "🕹️ - Profissional: ".$line($appointment['profissional_nome'])."\n".
        "━━━━━━━━━━━━━━━━━━━━━━━━\n".
        "🛠️ - Serviço: ".$line($appointment['servico_nome'])."\n".
        "📅 - Data: {$date}\n".
        "⏰ - Horário: {$start} – {$end}\n".
        "━━━━━━━━━━━━━━━━━━━━━━━━\n".
        "🧍 - Cliente: ".$line($appointment['cliente_nome'])."\n".
        "📱 - Contato: {$phone}\n\n".
        "📍 - Endereço: ".$line($appointment['loja']['endereco'])."\n".
        "━━━━━━━━━━━━━━━━━━━━━━━━\n\n".
        "🔔 - Lembrete: você receberá um aviso 1 dia antes, responda CONFIRMO até as 17h da véspera. Atrasos acima de 10 min podem gerar reagendamento.\n\n".
        "🙏 - Obrigado pela preferência!";
}

/** One immediate Menuia request, strictly after the reservation is committed.
 * Callbacks permit offline tests without contacting customers or the database.
 * Provider acknowledgment is not a WhatsApp delivered/read receipt.
 */
function agenda_notify_booking(array $appointment, callable $send, callable $save): string
{
    $message=agenda_booking_confirmation_message($appointment);
    $status='falha';$apiId=null;
    try{
        $response=$send((string)$appointment['telefone'],$message);
        $body=$response['body']??[];
        $invalidBody=!is_array($body);
        if($invalidBody)$body=[];
        $providerStatus=is_string($body['status']??null)?strtolower($body['status']):'';
        $rejected=$invalidBody||!empty($body['error'])||!empty($body['erro'])
            ||($body['success']??null)===false||($body['ok']??null)===false||($body['status']??null)===false
            ||in_array($providerStatus,['error','failed','failure'],true);
        $status=($response['http']??0)===200&&!$rejected?'enviado':'falha';
        $candidate=$body['data']['id']??($body['id']??null);
        if(is_string($candidate)||is_int($candidate))$apiId=(string)$candidate;
    }catch(Throwable $error){
        error_log('Agenda confirmation send failed; appointment='.(int)$appointment['agendamento_id'].'; kind='.get_class($error));
    }
    // Persist failures too. A logging failure must not resend the message or undo
    // an accepted reservation (which would encourage the customer to book twice).
    try{
        $save(['agendamento_id'=>$appointment['agendamento_id'],'to_numero'=>$appointment['telefone'],
            'message'=>$message,'tipo'=>'texto','status_envio'=>$status,'api_message_id'=>$apiId]);
    }catch(Throwable $error){
        error_log('Agenda confirmation audit failed; appointment='.(int)$appointment['agendamento_id'].'; kind='.get_class($error));
    }
    return $status;
}

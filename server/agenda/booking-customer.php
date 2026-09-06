<?php
declare(strict_types=1);

final class AgendaCustomerConflict extends RuntimeException {}
function agenda_customer_phone(string $value): string {
    if(strlen($value)>40||preg_match('/[^0-9+().\s-]/',$value))return '';
    $p=preg_replace('/\D/','',$value);
    if(in_array(strlen($p),[12,13],true)&&str_starts_with($p,'55'))$p=substr($p,2);
    if(strlen($p)===10&&preg_match('/^[1-9][0-9][6-9]/',$p))$p=substr($p,0,2).'9'.substr($p,2);
    return preg_match('/^[1-9][0-9]9[0-9]{8}$/D',$p)?'55'.$p:'';
}
function agenda_customer_decision(array $rows,string $phone,?string $cpf): array {
    $canonical=agenda_customer_phone($phone);$document=preg_replace('/\D/','',$cpf??'');
    if($canonical==='')throw new AgendaCustomerConflict('telefone_invalido');
    $matching=array_values(array_filter($rows,static fn($row)=>agenda_customer_phone((string)$row['telefone'])===$canonical));
    if(count($matching)>1)throw new AgendaCustomerConflict('cadastro_ambiguo');
    $row=$matching[0]??null;
    $current=$row?preg_replace('/\D/','',(string)($row['cpf']??'')):'';
    if($row && $document!=='' && $current!=='' && $document!==$current)throw new AgendaCustomerConflict('cpf_divergente');
    // An existing matching customer's masked CPF is already the same document. Do NOT rewrite it
    // to digits and collide with a separate legacy row's uq_usuario_cpf key.
    if($row && ($document==='' || $current!==''))return ['row'=>$row,'setCpf'=>false];
    foreach($rows as $candidate) {
        if($document!=='' && preg_replace('/\D/','',(string)($candidate['cpf']??''))===$document
            && (!$row || (string)$candidate['id']!==(string)$row['id']))throw new AgendaCustomerConflict('cpf_em_uso');
    }
    return ['row'=>$row,'setCpf'=>$document!==''];
}
/** Must participate in the same booking transaction; never merges customers or moves appointments. */
function agenda_booking_customer(PDO $db,string $name,string $phone,?string $cpf): int {
    if(!$db->inTransaction())throw new LogicException('Booking transaction required');
    $canonical=agenda_customer_phone($phone);$local=substr($canonical,2);
    $variants=[$canonical,$local];
    if(strlen($local)===11&&preg_match('/^[1-9][0-9]9[6-9]/',$local)){
        $old=substr($local,0,2).substr($local,3);$variants[]=$old;$variants[]='55'.$old;
    }
    $clean=static function(string $column):string {
        $value="COALESCE($column,'')";
        foreach(['+',' ','(',')','-','.'] as $character)$value="REPLACE($value,'$character','')";
        return $value;
    };
    $document=preg_replace('/\D/','',$cpf??'');
    $q=$db->prepare('SELECT id,nome,telefone,cpf FROM usuarios WHERE '.$clean('telefone').' IN ('.implode(',',array_fill(0,count($variants),'?')).')'
        .($document!==''?' OR '.$clean('cpf').'=?':'').' ORDER BY id LIMIT 10 FOR UPDATE');
    $q->execute([...$variants,...($document!==''?[$document]:[])]);
    $decision=agenda_customer_decision($q->fetchAll(PDO::FETCH_ASSOC),$phone,$cpf);$row=$decision['row'];
    if(!$row) {
        $db->prepare('INSERT INTO usuarios(nome,telefone,cpf) VALUES(?,?,?)')->execute([$name,$phone,$document?:null]);
        return (int)$db->lastInsertId();
    }
    if($decision['setCpf'])$db->prepare('UPDATE usuarios SET cpf=? WHERE id=?')->execute([$document,$row['id']]);
    if(trim((string)$row['nome'])!==trim($name))$db->prepare('UPDATE usuarios SET nome=? WHERE id=?')->execute([$name,$row['id']]);
    return (int)$row['id'];
}

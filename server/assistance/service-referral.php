<?php
declare(strict_types=1);

/** Authenticated status transition + durable, amount-frozen event. No payouts/network/messages. */
function lz_referral_money_cents($value, bool $nullable=false): int
{
    if($nullable&&($value===null||$value===''))return 0;
    if(!is_string($value)||!preg_match('/^-?[0-9]{1,9}(?:\.[0-9]{1,2})?$/D',$value))throw new InvalidArgumentException('invalid_note_total');
    $negative=str_starts_with($value,'-');$parts=explode('.',ltrim($value,'-'));
    return ((int)$parts[0]*100+(int)str_pad($parts[1]??'',2,'0'))*($negative?-1:1);
}
function lz_referral_note_total(array $row): int
{
    $entry=lz_referral_money_cents($row['val_entrada']??null,true);
    $total=lz_referral_money_cents($row['subtotal']??null)+$entry;
    if($entry<0||$total<=0||$total>200000000)throw new InvalidArgumentException('invalid_note_total');
    return $total;
}
function lz_referral_origin_allowed(array $server): bool
{
    if(($server['HTTP_SEC_FETCH_SITE']??'')==='cross-site')return false;
    $origin=$server['HTTP_ORIGIN']??'';
    if($origin==='')return true;
    if(!is_string($origin)||strlen($origin)>256)return false;
    $parsed=parse_url($origin);
    if(!$parsed||isset($parsed['user'])||isset($parsed['pass'])||isset($parsed['query'])||isset($parsed['fragment']))return false;
    $host=strtolower((string)($parsed['host']??''));$scheme=$parsed['scheme']??'';
    if($scheme==='https'&&!isset($parsed['port'])&&in_array($host,['app.lzgames.com.br','sistema2026.lzgames.com.br'],true))return true;
    $request=parse_url('http://'.($server['HTTP_HOST']??''));
    if($scheme==='https'&&$host!==''&&$host===strtolower((string)($request['host']??''))&&($parsed['port']??443)===($request['port']??443))return true;
    return in_array($host,['localhost','127.0.0.1'],true)&&in_array($scheme,['http','https'],true)
        &&$host===($request['host']??'')&&($parsed['port']??80)===($request['port']??80);
}
function lz_referral_authorize(PDO $pdo,array $session,array $server,string $scope,int $osId): int
{
    $id=$session['id']??null;
    if((!is_string($id)&&!is_int($id))||!preg_match('/^[1-9][0-9]{0,9}$/D',(string)$id)
        ||($session['token_0102']??'')!=='A12345'||!lz_referral_origin_allowed($server))throw new RuntimeException('Acesso não autorizado. Entre novamente no painel.');
    $q=$pdo->prepare('SELECT id,nivel,ativo FROM usuarios WHERE id=? LIMIT 1');$q->execute([(int)$id]);$user=$q->fetch(PDO::FETCH_ASSOC);
    if(!$user||($user['ativo']??'')!=='Sim'||($user['nivel']??'')==='Cliente')throw new RuntimeException('Usuário sem permissão para alterar a OS.');
    if($user['nivel']==='Administrador')return (int)$id;
    $keys=$scope==='technician'?['os_tecnico']:['os','os_status'];
    $marks=implode(',',array_fill(0,count($keys),'?'));
    $q=$pdo->prepare("SELECT 1 FROM usuarios_permissoes p JOIN acessos a ON a.id=p.permissao WHERE p.usuario=? AND a.chave IN ($marks) LIMIT 1");
    $q->execute(array_merge([(int)$id],$keys));
    if(!$q->fetchColumn())throw new RuntimeException('Usuário sem permissão para alterar a OS.');
    if($scope==='technician'){
        $q=$pdo->prepare('SELECT tecnico FROM os WHERE id=? LIMIT 1');$q->execute([$osId]);
        if((int)$q->fetchColumn()!==(int)$id)throw new RuntimeException('OS não vinculada a este técnico.');
    }
    return (int)$id;
}
function lz_referral_change_status(PDO $pdo,int $osId,string $status,int $actor): void
{
    if($osId<1||$actor<1||$status===''||mb_strlen($status)>20||preg_match('/[\x00-\x1f]/',$status))throw new InvalidArgumentException('Status da OS inválido.');
    if($pdo->inTransaction())throw new RuntimeException('Transação de OS já iniciada.');
    $pdo->beginTransaction();
    try{
        $q=$pdo->query('SELECT enabled,min_os_id,cutoff_set_at FROM lz_service_referral_policy WHERE id=1 FOR UPDATE');$policy=$q->fetch(PDO::FETCH_ASSOC);
        $enabled=(int)($policy['enabled']??0)===1;$minimum=(int)($policy['min_os_id']??0);
        if($enabled&&($minimum<1||empty($policy['cutoff_set_at'])))throw new RuntimeException('Regra de cashback sem marco de notas.');
        $q=$pdo->prepare('SELECT id,cliente,status,subtotal,val_entrada FROM os WHERE id=? LIMIT 1 FOR UPDATE');$q->execute([$osId]);$old=$q->fetch(PDO::FETCH_ASSOC);
        if(!$old)throw new RuntimeException('OS não encontrada.');
        $q=$pdo->prepare('UPDATE os SET status=?,funcionario=? WHERE id=?');$q->execute([$status,$actor,$osId]);
        if($enabled&&$osId>=$minimum&&$status==='Finalizada'&&!in_array($old['status'],['Finalizada','Entregue'],true)){
            $outcome=null;$base=0;
            try{$base=lz_referral_note_total($old);}catch(InvalidArgumentException){$outcome='invalid_note_total';}
            $q=$pdo->prepare("INSERT INTO lz_service_referral_outbox(os_id,indicated_id,actor_id,base_cents,outcome,processed_at)
                VALUES (?,?,?,?,?,IF(? IS NULL,NULL,NOW(6)))");
            $q->execute([$osId,(int)$old['cliente'],$actor,$base,$outcome,$outcome]);
        }
        $pdo->commit();
    }catch(Throwable $error){$pdo->rollBack();throw $error;}
}

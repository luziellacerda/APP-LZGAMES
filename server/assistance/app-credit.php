<?php
declare(strict_types=1);
require_once __DIR__.'/service-referral.php';

/** Services-only app credits. No legacy cashback, points, withdrawal or messaging writes. */
final class LzAppCreditError extends RuntimeException {}

function lz_app_credit_id($value): int
{
    if ((!is_string($value) && !is_int($value)) || !preg_match('/^[1-9][0-9]{0,8}$/D',(string)$value)) {
        throw new LzAppCreditError('Identificador inválido.');
    }
    return (int)$value;
}
function lz_app_credit_cents($value): int
{
    if ($value===null || $value==='') return 0;
    try { $cents=lz_referral_money_cents((string)$value); }
    catch (Throwable) { throw new LzAppCreditError('Valor da nota inválido. Revise a OS antes de usar créditos.'); }
    if ($cents<0 || $cents>99999999) throw new LzAppCreditError('Valor da nota fora do limite.');
    return $cents;
}
function lz_app_credit_decimal(int $cents): string
{
    if ($cents<0 || $cents>99999999) throw new LzAppCreditError('Valor fora do limite.');
    return intdiv($cents,100).'.'.str_pad((string)($cents%100),2,'0',STR_PAD_LEFT);
}
function lz_app_credit_open(array $os): bool
{
    return in_array($os['status']??'', ['Aberta','Iniciada','Aguardando Peça','Aguardando Aprovação','Em Bancada'],true)
        && in_array($os['pago']??'', ['', 'Não','Nao'],true);
}
function lz_app_credit_table(string $schema,string $table): string
{
    if (!preg_match('/^lz_app_[a-z_]+$/D',$table) || ($schema!=='' && !preg_match('/^[A-Za-z0-9_-]+$/D',$schema))) throw new LogicException('Invalid credit table');
    return ($schema===''?'':"`$schema`.")."`$table`";
}
function lz_app_credit_env(): array
{
    $env=[];
    foreach (['/etc/lzgames/agenda.env','/etc/lzgames/db.env','/etc/lzgames/db.systemd.env'] as $file) {
        foreach (is_readable($file)?file($file,FILE_IGNORE_NEW_LINES):[] as $line) {
            if (preg_match('/^(DB(?:4)?_(?:HOST|PORT|NAME|USER|PASS))=(.*)$/D',trim($line),$m)) $env[$m[1]]=trim($m[2],"\"'");
        }
    }
    return $env;
}
/** One writer / one InnoDB transaction across the two schemas on this same MySQL server. */
function lz_app_credit_writer(): array
{
    $e=lz_app_credit_env();
    if (($e['DB_HOST']??'')!==($e['DB4_HOST']??null) || ($e['DB_PORT']??'3306')!==($e['DB4_PORT']??'3306')) throw new LzAppCreditError('Integração financeira indisponível.');
    $host=$e['DB_HOST']??''; $port=$e['DB_PORT']??'3306'; $name=$e['DB_NAME']??''; $cb=$e['DB4_NAME']??'';
    if (!preg_match('/^[A-Za-z0-9._:-]+$/D',$host) || !ctype_digit($port) || !preg_match('/^[A-Za-z0-9_-]+$/D',$name) || !preg_match('/^[A-Za-z0-9_-]+$/D',$cb)) throw new LzAppCreditError('Integração financeira indisponível.');
    $db=new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",$e['DB_USER']??'',$e['DB_PASS']??'',[
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_TIMEOUT=>3]);
    $db->exec("SET SESSION time_zone='+00:00'");
    $db->exec('SET SESSION innodb_lock_wait_timeout=4');
    return [$db,$cb];
}
function lz_app_credit_csrf(array $session,array $server,$token): void
{
    if (($server['REQUEST_METHOD']??'')!=='POST' || !is_string($token) || !preg_match('/^[a-f0-9]{64}$/D',$token)
        || !is_string($session['app_credit_csrf']??null) || !hash_equals($session['app_credit_csrf'],$token)
        || !lz_referral_origin_allowed($server)) throw new LzAppCreditError('Sessão expirada. Atualize o painel.');
}
/** Recheck real active user and BOTH OS and receivables permissions, not a browser role. */
function lz_app_credit_authorize(PDO $db,array $session,array $server): int
{
    $actor=lz_referral_authorize($db,$session,$server,'office',0);
    $q=$db->prepare('SELECT nivel FROM usuarios WHERE id=?');$q->execute([$actor]);
    if ($q->fetchColumn()==='Administrador') return $actor;
    $q=$db->prepare("SELECT COUNT(DISTINCT a.chave) FROM usuarios_permissoes p JOIN acessos a ON a.id=p.permissao WHERE p.usuario=? AND a.chave IN ('os','receber')");
    $q->execute([$actor]);
    if ((int)$q->fetchColumn()!==2) throw new LzAppCreditError('É necessário acesso a OS e Contas a Receber para usar créditos.');
    return $actor;
}
function lz_app_credit_active(PDO $db,int $osId): ?array
{
    $q=$db->prepare('SELECT * FROM lz_app_credit_os WHERE os_id=?');$q->execute([$osId]);
    return $q->fetch(PDO::FETCH_ASSOC) ?: null;
}
function lz_app_credit_balance(PDO $db,string $cb,int $customer): array
{
    $credits=lz_app_credit_table($cb,'lz_app_referral_credits');
    $uses=lz_app_credit_table($cb,'lz_app_referral_redemptions');
    // One consistent statement: an undo/apply cannot fall between the two totals.
    $q=$db->prepare("SELECT (SELECT COALESCE(SUM(amount_cents),0) FROM $credits WHERE beneficiary_id=? AND usage_restriction='services_only') earned,
        (SELECT COALESCE(SUM(amount_cents),0) FROM $uses WHERE beneficiary_id=? AND state='active') used");
    $q->execute([$customer,$customer]);$r=$q->fetch();
    foreach (['earned','used'] as $key) if (!preg_match('/^[0-9]{1,12}$/D',(string)$r[$key])) throw new LzAppCreditError('Saldo indisponível para conferência.');
    $earned=(int)$r['earned'];$used=(int)$r['used'];
    if ($used>$earned) throw new LzAppCreditError('Saldo indisponível para conferência.');
    return ['earned_cents'=>$earned,'used_cents'=>$used,'available_cents'=>$earned-$used];
}
/** Conservative allocation: existing global discount consumes services first, never products/freight. */
function lz_app_credit_cap(array $os,int $products,int $services): int
{
    if ($products!==lz_app_credit_cents($os['total_produtos']) || $services!==lz_app_credit_cents($os['total_servicos'])) throw new LzAppCreditError('Os itens mudaram. Salve a OS e consulte o crédito novamente.');
    $serviceBase=$services+lz_app_credit_cents($os['mao_obra'])+lz_app_credit_cents($os['vall']);
    $remaining=lz_app_credit_cents($os['subtotal']);
    $effectiveDiscount=$products+$serviceBase+lz_app_credit_cents($os['frete'])-lz_app_credit_cents($os['val_entrada'])-$remaining;
    if ($effectiveDiscount<0) throw new LzAppCreditError('Total inconsistente. Salve e revise a OS antes de usar créditos.');
    return min($remaining,max(0,$serviceBase-$effectiveDiscount));
}
function lz_app_credit_charge_check(PDO $db,int $id): void
{
    $q=$db->prepare("SELECT 1 FROM receber WHERE id_ref=? AND referencia='Serviço' AND (descricao IS NULL OR descricao<>'Valor Entrada OS') LIMIT 1");
    $q->execute([$id]);
    if ($q->fetchColumn()) throw new LzAppCreditError('A OS já possui cobrança financeira. Revise a cobrança antes de usar ou estornar créditos.');
}
function lz_app_credit_quote(PDO $db,string $cb,int $id): array
{
    $q=$db->prepare('SELECT * FROM os WHERE id=?');$q->execute([$id]);$os=$q->fetch();
    if (!$os) throw new LzAppCreditError('OS não encontrada.');
    $customer=lz_app_credit_id($os['cliente']);$active=lz_app_credit_active($db,$id);
    $balance=lz_app_credit_balance($db,$cb,$customer);
    $policy=lz_app_credit_table($cb,'lz_app_referral_redemption_policy');
    $enabled=(int)$db->query("SELECT enabled FROM $policy WHERE id=1")->fetchColumn()===1;
    $cap=0; $reason=''; $canUndo=false;
    try {
        if (!lz_app_credit_open($os)) throw new LzAppCreditError('Use o crédito antes da conclusão ou pagamento da OS.');
        lz_app_credit_charge_check($db,$id);
        if ($active) { $canUndo=!(int)$active['sealed']; }
        else {
            foreach (['produtos_orc'=>'products','servicos_orc'=>'services'] as $table=>$key) {
                $q=$db->prepare("SELECT COALESCE(SUM(total),0) FROM $table WHERE os=?");$q->execute([$id]);${$key}=lz_app_credit_cents($q->fetchColumn());
            }
            $cap=lz_app_credit_cap($os,$products,$services);
        }
    } catch (LzAppCreditError $e) { $reason=$e->getMessage(); }
    if (!$enabled && !$active) $reason='Novos abatimentos estão temporariamente pausados.';
    if ($active && !$canUndo) $reason='Crédito aplicado e fechado para estorno automático. O registro permanece na nota.';
    return $balance+['os_id'=>$id,'customer_id'=>$customer,'subtotal_cents'=>lz_app_credit_cents($os['subtotal']),
        'limit_cents'=>$enabled?min($cap,$balance['available_cents']):0,'service_limit_cents'=>$cap,
        'active'=>$active?['id'=>$active['redemption_id'],'amount_cents'=>(int)$active['amount_cents'],'can_undo'=>$canUndo]:null,'reason'=>$reason];
}
/** Caller has validated session+CSRF. Values are re-read under locks; quote/customer is only a precondition. */
function lz_app_credit_apply(PDO $db,string $cb,int $osId,int $actor,int $customer,int $amount,int $expectedSubtotal,string $request): array
{
    if ($db->inTransaction() || $amount<=0 || $amount>99999999 || !preg_match('/^[a-f0-9]{32}$/D',$request)) throw new LzAppCreditError('Pedido de crédito inválido.');
    $policy=lz_app_credit_table($cb,'lz_app_referral_redemption_policy');$wallet=lz_app_credit_table($cb,'lz_app_referral_wallet_locks');$uses=lz_app_credit_table($cb,'lz_app_referral_redemptions');
    $db->beginTransaction();
    try {
        $enabled=(int)$db->query("SELECT enabled FROM $policy WHERE id=1 LOCK IN SHARE MODE")->fetchColumn()===1;
        $db->prepare("INSERT INTO $wallet(beneficiary_id) VALUES(?) ON DUPLICATE KEY UPDATE beneficiary_id=beneficiary_id")->execute([$customer]);
        $q=$db->prepare("SELECT beneficiary_id FROM $wallet WHERE beneficiary_id=? FOR UPDATE");$q->execute([$customer]);$q->fetch();
        $q=$db->prepare('SELECT * FROM os WHERE id=? FOR UPDATE');$q->execute([$osId]);$os=$q->fetch();
        if (!$os || (int)$os['cliente']!==$customer) throw new LzAppCreditError('A OS ou o cliente mudou. Consulte novamente.');
        $q=$db->prepare("SELECT * FROM $uses WHERE id=? FOR UPDATE");$q->execute([$request]);$previous=$q->fetch();
        if ($previous) {
            if ((int)$previous['os_id']!==$osId || (int)$previous['beneficiary_id']!==$customer || (int)$previous['amount_cents']!==$amount) throw new LzAppCreditError('Identificador de pedido já utilizado.');
            $db->commit();return ['id'=>$request,'state'=>$previous['state'],'replayed'=>true];
        }
        if (!$enabled) throw new LzAppCreditError('Novos abatimentos estão temporariamente pausados.');
        if (lz_app_credit_active($db,$osId)) throw new LzAppCreditError('Esta OS já tem crédito aplicado.');
        if (!lz_app_credit_open($os)) throw new LzAppCreditError('Use o crédito antes da conclusão ou pagamento da OS.');
        lz_app_credit_charge_check($db,$osId);
        $before=lz_app_credit_cents($os['subtotal']);
        if ($before!==$expectedSubtotal) throw new LzAppCreditError('O total mudou. Consulte novamente antes de aplicar.');
        foreach (['produtos_orc'=>'products','servicos_orc'=>'services'] as $table=>$key) {
            // Parent row is locked; triggers serialize item edits on that same parent.
            $q=$db->prepare("SELECT total FROM $table WHERE os=? FOR UPDATE");$q->execute([$osId]);${$key}=0;
            foreach ($q->fetchAll() as $row) ${$key}+=lz_app_credit_cents($row['total']);
        }
        $cap=lz_app_credit_cap($os,$products,$services);
        $balance=lz_app_credit_balance($db,$cb,$customer);
        if ($amount>$cap || $amount>$balance['available_cents']) throw new LzAppCreditError('Valor maior que o saldo ou que os serviços elegíveis desta nota.');
        $after=$before-$amount;
        $db->prepare("INSERT INTO $uses(id,beneficiary_id,os_id,amount_cents,subtotal_before_cents,subtotal_after_cents,actor_id,state) VALUES(?,?,?,?,?,?,?,'active')")
            ->execute([$request,$customer,$osId,$amount,$before,$after,$actor]);
        $db->prepare('UPDATE os SET subtotal=? WHERE id=?')->execute([lz_app_credit_decimal($after),$osId]);
        $db->prepare('INSERT INTO lz_app_credit_os(os_id,redemption_id,beneficiary_id,amount_cents,subtotal_before_cents,subtotal_after_cents) VALUES(?,?,?,?,?,?)')
            ->execute([$osId,$request,$customer,$amount,$before,$after]);
        $db->commit();return ['id'=>$request,'state'=>'active','replayed'=>false];
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack();throw $e; }
}
/** Reversal only of an open/unpaid, never-closed note; credit returns to services, never cash. */
function lz_app_credit_undo(PDO $db,string $cb,int $osId,int $actor,int $customer,string $request,string $reason): array
{
    $reason=trim($reason);
    if ($db->inTransaction() || !preg_match('/^[a-f0-9]{32}$/D',$request) || mb_strlen($reason)<5 || mb_strlen($reason)>160 || preg_match('/[\x00-\x1f]/',$reason)) throw new LzAppCreditError('Informe um motivo de estorno entre 5 e 160 caracteres.');
    $wallet=lz_app_credit_table($cb,'lz_app_referral_wallet_locks');$uses=lz_app_credit_table($cb,'lz_app_referral_redemptions');
    $db->beginTransaction();
    try {
        $q=$db->prepare("SELECT beneficiary_id FROM $wallet WHERE beneficiary_id=? FOR UPDATE");$q->execute([$customer]);$q->fetch();
        $q=$db->prepare('SELECT * FROM os WHERE id=? FOR UPDATE');$q->execute([$osId]);$os=$q->fetch();
        $q=$db->prepare("SELECT * FROM $uses WHERE id=? FOR UPDATE");$q->execute([$request]);$use=$q->fetch();
        if (!$os || !$use || (int)$use['os_id']!==$osId || (int)$use['beneficiary_id']!==$customer || (int)$os['cliente']!==$customer) throw new LzAppCreditError('Abatimento não encontrado nesta OS.');
        if ($use['state']==='reversed') { $db->commit();return ['state'=>'reversed','replayed'=>true]; }
        $active=lz_app_credit_active($db,$osId);
        if (!$active || $active['redemption_id']!==$request || (int)$active['sealed'] || !lz_app_credit_open($os)) throw new LzAppCreditError('OS já fechada para estorno automático. É necessária conferência financeira.');
        if (lz_app_credit_cents($os['subtotal'])!==(int)$use['subtotal_after_cents']) throw new LzAppCreditError('Valor da nota divergente. É necessária conferência financeira.');
        lz_app_credit_charge_check($db,$osId);
        $db->prepare('DELETE FROM lz_app_credit_os WHERE os_id=? AND redemption_id=?')->execute([$osId,$request]);
        $db->prepare('UPDATE os SET subtotal=? WHERE id=?')->execute([lz_app_credit_decimal((int)$use['subtotal_before_cents']),$osId]);
        $db->prepare("UPDATE $uses SET state='reversed',reversed_by=?,reversed_at=UTC_TIMESTAMP(6),reversal_reason=? WHERE id=? AND state='active'")->execute([$actor,$reason,$request]);
        $db->commit();return ['state'=>'reversed','replayed'=>false];
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack();throw $e; }
}

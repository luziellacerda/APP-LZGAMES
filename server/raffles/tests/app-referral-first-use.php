<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/app-referral-first-use.php';
require_once __DIR__.'/../lib/app-messaging.php';
$checks=0;
function check(bool $ok,string $why): void { global $checks; if (!$ok) throw new RuntimeException($why); $checks++; }
function memory(): PDO { return new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); }
function capture(PDO $db,array $customer,string $platform='android',string $at='2026-09-05 20:00:00.500000'): void {
    $db->beginTransaction();app_referral_capture($db,$customer,$platform,null,$at);$db->commit();
}
$customer=['provider'=>'core','id'=>'202','phone'=>'82988880000'];
$presence=memory();app_schema($presence);app_referral_schema($presence);
$presence->exec('UPDATE app_referral_policy SET enabled=1 WHERE id=1');
app_device_save($presence,$customer+['name'=>'Synthetic'],['installationId'=>str_repeat('X',32),'platform'=>'android']);
app_device_save($presence,$customer+['name'=>'Synthetic'],['installationId'=>str_repeat('Y',32),'platform'=>'android','marketingOptIn'=>true]);
check((int)$presence->query('SELECT COUNT(*) FROM app_referral_first_uses')->fetchColumn()===1,'Actual presence hook captures once without push consent');
app_device_save($presence,['provider'=>'core','id'=>'505','phone'=>'82987000505','name'=>'Synthetic'],['installationId'=>str_repeat('X',32),'platform'=>'android']);
$blockedEvent=$presence->query("SELECT * FROM app_referral_first_uses WHERE external_user_id='505'")->fetch();
check(app_referral_process($presence,memory(),$blockedEvent)==='device_reused','A second account on the same installation cannot earn an app bonus');
$presence->exec("CREATE TRIGGER synthetic_capture_failure BEFORE INSERT ON app_referral_first_uses WHEN NEW.external_user_id='404' BEGIN SELECT RAISE(ABORT,'synthetic rollback'); END");
try {app_device_save($presence,['provider'=>'core','id'=>'404','phone'=>'82988880404','name'=>'Synthetic'],['installationId'=>str_repeat('Z',32),'platform'=>'android']);check(false,'Presence transaction rollback');}catch(PDOException){check(true,'Presence transaction rollback');}
check((int)$presence->query("SELECT COUNT(*) FROM app_devices WHERE external_user_id='404'")->fetchColumn()===0,'Device and event cannot commit independently');
$journal=memory();
$journal->exec("CREATE TABLE app_devices(identity_provider TEXT,external_user_id TEXT,customer_phone TEXT,platform TEXT,linked_at TEXT,unlinked_at TEXT)");
app_referral_schema($journal);
$journal->exec("INSERT INTO app_devices VALUES('core','101','82988880101','android','2026-08-01 12:00:00','2026-08-02 12:00:00')");
$journal->beginTransaction();app_referral_seed($journal);$journal->commit();
check((int)$journal->query('SELECT baseline FROM app_referral_first_uses')->fetchColumn()===1,'Historical/unlinked users excluded');
check(app_referral_process($journal,memory(),$journal->query('SELECT * FROM app_referral_first_uses')->fetch())==='historical','Baseline acknowledges without any external identity/financial query');
$journal->exec('UPDATE app_referral_policy SET enabled=1 WHERE id=1');
capture($journal,$customer,'web'); capture($journal,$customer,'unknown');
check((int)$journal->query('SELECT COUNT(*) FROM app_referral_first_uses')->fetchColumn()===1,'No rewards from web visits');
capture($journal,$customer);capture($journal,$customer,'ios','2026-09-06 20:00:00.000000');
capture($journal,['provider'=>'box','id'=>'808','phone'=>'+55 (82) 98888-0000']);
check((int)$journal->query('SELECT COUNT(*) FROM app_referral_first_uses')->fetchColumn()===2,'Login, reinstall and provider reuse deduplicated by account/full phone');
$event=$journal->query("SELECT * FROM app_referral_first_uses WHERE external_user_id='202'")->fetch();
check($event['first_seen_at']==='2026-09-05 20:00:00.500000','First timestamp immutable');
try { $journal->exec("UPDATE app_referral_first_uses SET first_seen_at='2027' WHERE id=2");check(false,'Immutable trigger'); } catch (PDOException) {check(true,'Trigger blocked rewrite');}
$result=app_referral_batch($journal,static function(array $event):string { if ($event['baseline']) return 'historical';throw new RuntimeException('synthetic upstream failure'); });
check($result===['handled'=>1,'credited'=>0,'retry'=>1],'Outages retry without credit or first-use loss');
$journal->exec("UPDATE app_referral_first_uses SET retry_at='2020-01-01' WHERE processed_at IS NULL");
check(app_referral_batch($journal,static fn(array $e):string=>'no_prior_referral')['handled']===1,'Retry ack');
check(app_referral_batch($journal,static fn(array $e):string=>'credited')['handled']===0,'No reprocessing after completed no-referral');

$main=memory();$main->exec('CREATE TABLE clientes(id INTEGER,telefone TEXT,telefone2 TEXT)');
$main->exec("INSERT INTO clientes VALUES(202,'(82) 98888-0000',NULL),(303,'82988880303',NULL)");
$box=memory();$box->exec('CREATE TABLE users(id INTEGER,phone TEXT,role TEXT,status TEXT)');
$box->exec("INSERT INTO users VALUES(808,'5582988880000','customer','active')");
check(app_referral_owner($event,$main,null)==='202','CORE ownership');
$boxEvent=$event;$boxEvent['identity_provider']='box';$boxEvent['external_user_id']='808';
check(app_referral_owner($boxEvent,$main,$box)==='202','BOX resolves same CORE identity');
$bad=$event;$bad['customer_phone']='82988889999';
try {app_referral_owner($bad,$main,null);check(false,'Changed contact rejected');}catch(AppServiceSourceError){check(true,'Changed contact rejected');}
$main->exec("INSERT INTO clientes VALUES(404,'82988880000',NULL)");
try {app_referral_owner($event,$main,null);check(false,'Ambiguous identity rejected');}catch(AppServiceSourceError){check(true,'Ambiguous identity rejected');}

if (getenv('LZ_APP_REFERRAL_SQL_FIXTURES')==='1') {
    $cb=app_referral_cashback(app_service_source_env());
    // Only this connection sees these temporary tables. If any creation fails, abort immediately.
    $cb->exec('CREATE TEMPORARY TABLE indicacoes(id BIGINT PRIMARY KEY,indicador_cliente_id BIGINT,indicado_cliente_id BIGINT,
        status VARCHAR(24),created_at DATETIME,cashback_valor_centavos INT NOT NULL DEFAULT 0,fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    app_referral_cashback_schema($cb,true);
    $cb->exec('CREATE TEMPORARY TABLE lz_referral_bindings(referral_id BIGINT PRIMARY KEY,indicated_id BIGINT,indicator_id BIGINT,phone_hash CHAR(64),cpf_hash CHAR(64),review_required INT DEFAULT 0) ENGINE=InnoDB');
    $cb->exec('CREATE TEMPORARY TABLE lz_referral_claims(identity_key VARCHAR(90) PRIMARY KEY,referral_id BIGINT) ENGINE=InnoDB');
    $guard=static function(int $ref,int $indicated,string $hash)use($cb):void {
        $cb->prepare('INSERT INTO lz_referral_bindings(referral_id,indicated_id,indicator_id,phone_hash) VALUES(?,?,303,?)')->execute([$ref,$indicated,$hash]);
        foreach(['id:'.$indicated,'phone:'.$hash] as $key)$cb->prepare('INSERT INTO lz_referral_claims(identity_key,referral_id) VALUES(?,?)')->execute([$key,$ref]);
    };
    foreach (['indicacoes','lz_app_referral_first_uses','lz_app_referral_credits','lz_app_referral_attributions','lz_referral_bindings','lz_referral_claims'] as $table) {
        $definition=$cb->query('SHOW CREATE TABLE '.$table)->fetch(PDO::FETCH_NUM);
        check(str_contains(strtoupper($definition[1]),'CREATE TEMPORARY TABLE'),'Must shadow permanent table: '.$table);
    }
    $cb->exec("INSERT INTO indicacoes(id,indicador_cliente_id,indicado_cliente_id,status,created_at) VALUES(7,303,202,'pendente','2026-09-05 17:00:00')");
    $cb->exec("INSERT INTO lz_app_referral_attributions VALUES(7,'2026-09-05 20:00:00.100000')");
    $guard(7,202,$event['phone_hash']);
    check(app_referral_grant($cb,$event,'202',false,static fn($id)=>$id==='303')==='credited','Same-second prior authenticated invitation qualifies');
    check(app_referral_grant($cb,$event,'202',false,static fn()=>true)==='duplicate','Replay after commit before journal ack cannot duplicate');
    $other=$event;$other['event_key']=str_repeat('a',64);$other['phone_hash']=str_repeat('b',64);
    check(app_referral_grant($cb,$other,'202',false,static fn()=>true)==='duplicate','Canonical account cannot re-earn after new provider/contact');
    $credit=$cb->query('SELECT * FROM lz_app_referral_credits')->fetch();
    check((int)$credit['amount_cents']===990 && (int)$credit['beneficiary_id']===303 && $credit['usage_restriction']==='services_only','Fixed 990 cents to referrer, no withdrawable credit');
    $legacy=$cb->query('SELECT status,cashback_valor_centavos FROM indicacoes WHERE id=7')->fetch();
    check($legacy['status']==='pendente' && (int)$legacy['cashback_valor_centavos']===0,'Service 5% approval untouched');
    $make=static function(int $id) use($event):array { return array_replace($event,['event_key'=>hash('sha256','event'.$id),'phone_hash'=>hash('sha256','phone'.$id)]); };
    $valid=static fn()=>true;
    $guard(16,211,$make(211)['phone_hash']);$guard(17,212,$make(212)['phone_hash']);
    $cb->exec("INSERT INTO indicacoes(id,indicador_cliente_id,indicado_cliente_id,status,created_at) VALUES
        (8,303,204,'pendente','2026-09-01'),(9,303,205,'pendente','2026-09-06'),
        (10,206,206,'pendente','2026-09-01'),(11,303,207,'cancelada','2026-09-01'),
        (12,303,208,'pendente','2026-09-01'),(13,404,208,'pendente','2026-09-01'),
        (14,303,209,'pendente','2026-09-01'),(15,303,210,'pendente','2026-09-05 17:00:00'),
        (16,303,211,'pendente','2026-09-01'),(17,303,212,'pendente','2026-09-01')");
    check(app_referral_grant($cb,$make(204),'204',true,$valid)==='historical','No retroactive bonus');
    check(app_referral_grant($cb,$make(205),'205',false,$valid)==='no_prior_referral','Later referral cannot qualify');
    check(app_referral_grant($cb,$make(206),'206',false,$valid)==='self_referral','No self referral');
    check(app_referral_grant($cb,$make(207),'207',false,$valid)==='no_prior_referral','Cancelled invitation excluded');
    check(app_referral_grant($cb,$make(208),'208',false,$valid)==='ambiguous','Two referrers cannot receive same user');
    check(app_referral_grant($cb,$make(209),'209',false,static fn()=>false)==='invalid_beneficiary','Missing or own-phone referrer excluded');
    $cb->exec("INSERT INTO lz_app_referral_attributions VALUES(15,'2026-09-05 20:00:00.800000')");
    check(app_referral_grant($cb,$make(210),'210',false,$valid)==='no_prior_referral','Same-second LATER binding rejected');
    try { app_referral_grant($cb,$make(211),'211',false,static function(){throw new RuntimeException('synthetic rollback');});check(false,'Failure rollback'); }catch(RuntimeException){check(true,'Failure rollback');}
    check((int)$cb->query('SELECT COUNT(*) FROM lz_app_referral_first_uses WHERE customer_id=211')->fetchColumn()===0,'Failed transaction did not consume customer');
    check(app_referral_grant($cb,$make(211),'211',false,$valid)==='credited','Retry successful');
    check(app_referral_grant($cb,$make(212),'212',false,$valid)==='credited','Different valid invite accumulates');
    check((int)$cb->query('SELECT SUM(amount_cents) FROM lz_app_referral_credits WHERE beneficiary_id=303')->fetchColumn()===2970,'Three independent invitations accumulate R$29.70');
    $cb->exec("INSERT INTO indicacoes(id,indicador_cliente_id,indicado_cliente_id,status,created_at) VALUES
        (18,303,213,'pendente','2026-09-01'),(19,303,214,'pendente','2026-09-01'),(20,303,215,'pendente','2026-09-01')");
    check(app_referral_grant($cb,$make(213),'213',false,$valid)==='guard_rejected','An unaudited manual referral cannot award credit');
    $guard(19,214,$make(214)['phone_hash']);
    $cb->exec('UPDATE lz_referral_bindings SET review_required=1 WHERE referral_id=19');
    check(app_referral_grant($cb,$make(214),'214',false,$valid)==='guard_rejected','A conflicted historical binding cannot award credit');
    $guard(20,215,$make(215)['phone_hash']);
    $cb->prepare('DELETE FROM lz_referral_claims WHERE identity_key=?')->execute(['phone:'.$make(215)['phone_hash']]);
    check(app_referral_grant($cb,$make(215),'215',false,$valid)==='guard_rejected','Missing permanent phone reservation cannot award credit');
    check((int)$cb->query('SELECT SUM(amount_cents) FROM lz_app_referral_credits WHERE beneficiary_id=303')->fetchColumn()===2970,'Rejected bindings made no extra credit');
    $cb=null; // TEMPORARY fixtures destroyed; no DROP/DELETE on any real customer/table.
} else echo "MySQL financial fixtures skipped (set LZ_APP_REFERRAL_SQL_FIXTURES=1).\n";
echo "App first-use bonus: $checks checks passed.\n";

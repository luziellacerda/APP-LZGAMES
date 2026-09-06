<?php
declare(strict_types=1);
require_once __DIR__.'/app-service-source.php';

/** Explicit migration only. Registration must never create/activate a financial policy. */
function app_referral_schema(PDO $db): void
{
    $db->exec("CREATE TABLE IF NOT EXISTS app_referral_policy(
        id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)), activated_at TEXT);
        INSERT OR IGNORE INTO app_referral_policy(id) VALUES(1);
        CREATE TABLE IF NOT EXISTS app_referral_first_uses(
            id INTEGER PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
            identity_provider TEXT NOT NULL, external_user_id TEXT NOT NULL,
            customer_phone TEXT NOT NULL, phone_hash TEXT UNIQUE,
            first_seen_at TEXT NOT NULL, baseline INTEGER NOT NULL CHECK(baseline IN(0,1)),
            processed_at TEXT, outcome TEXT, attempts INTEGER NOT NULL DEFAULT 0,
            retry_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(identity_provider,external_user_id));
        CREATE INDEX IF NOT EXISTS app_referral_pending ON app_referral_first_uses(processed_at,retry_at,id);
        CREATE TRIGGER IF NOT EXISTS app_referral_first_use_immutable
        BEFORE UPDATE OF event_key,identity_provider,external_user_id,customer_phone,phone_hash,first_seen_at,baseline
        ON app_referral_first_uses BEGIN SELECT RAISE(ABORT,'First app use is immutable'); END;
        CREATE TABLE IF NOT EXISTS app_referral_worker_health(id INTEGER PRIMARY KEY CHECK(id=1), heartbeat_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS app_referral_installations(installation_hash TEXT PRIMARY KEY,
            identity_provider TEXT NOT NULL,external_user_id TEXT NOT NULL,phone_hash TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS app_referral_device_blocks(identity_provider TEXT NOT NULL,external_user_id TEXT NOT NULL,
            reason TEXT NOT NULL DEFAULT 'device_reused',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(identity_provider,external_user_id));
        CREATE TRIGGER IF NOT EXISTS app_referral_installation_immutable BEFORE UPDATE ON app_referral_installations
            BEGIN SELECT RAISE(ABORT,'First installation owner is immutable'); END;");
    // Seed existing installations without creating a bonus or changing any device/push preference.
    if($db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_devices'")->fetchColumn()) {
        $columns=$db->query('PRAGMA table_info(app_devices)')->fetchAll(PDO::FETCH_ASSOC);
        if(in_array('installation_hash',array_column($columns,'name'),true)) {
            foreach($db->query("SELECT installation_hash,identity_provider,external_user_id,customer_phone FROM app_devices WHERE platform IN ('android','ios')")->fetchAll() as $device) {
                $phone=app_service_source_phone((string)$device['customer_phone']);
                $db->prepare('INSERT OR IGNORE INTO app_referral_installations(installation_hash,identity_provider,external_user_id,phone_hash) VALUES(?,?,?,?)')
                    ->execute([$device['installation_hash'],$device['identity_provider'],$device['external_user_id'],$phone===''?null:hash('sha256',$phone)]);
            }
        }
    }
}

/** Within the existing authenticated presence transaction; web visits/permission changes are not bonuses. */
function app_referral_capture(PDO $db, array $customer, string $platform, ?bool $baseline = null, ?string $at = null, ?string $installationHash = null): void
{
    if (!in_array($platform,['android','ios'],true)) return;
    if (!$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_referral_policy'")->fetchColumn()) return;
    if (!$db->inTransaction()) throw new LogicException('Presence transaction required');
    if (!in_array($customer['provider'] ?? null,['core','box'],true)) return;
    try { $id = app_service_source_id($customer['id'] ?? null); } catch (AppServiceSourceError) { return; }
    $phone = app_service_source_phone((string)($customer['phone'] ?? ''));
    if($installationHash!==null) {
        if(!preg_match('/^[a-f0-9]{64}$/D',$installationHash)) throw new LogicException('Invalid installation fingerprint');
        $phoneHash=$phone===''?null:hash('sha256',$phone);
        $db->prepare('INSERT OR IGNORE INTO app_referral_installations(installation_hash,identity_provider,external_user_id,phone_hash) VALUES(?,?,?,?)')
            ->execute([$installationHash,$customer['provider'],$id,$phoneHash]);
        $q=$db->prepare('SELECT * FROM app_referral_installations WHERE installation_hash=?');$q->execute([$installationHash]);$first=$q->fetch();
        if(!$first || (!(($first['identity_provider']===$customer['provider']) && ((string)$first['external_user_id']===$id)) && (!$phoneHash || $first['phone_hash']!==$phoneHash))) {
            $db->prepare('INSERT OR IGNORE INTO app_referral_device_blocks(identity_provider,external_user_id) VALUES(?,?)')->execute([$customer['provider'],$id]);
        }
    }
    $enabled = (int)$db->query('SELECT enabled FROM app_referral_policy WHERE id=1')->fetchColumn() === 1;
    // Missing contact still consumes this provider/account's first use, but can never earn money.
    $db->prepare('INSERT OR IGNORE INTO app_referral_first_uses
        (event_key,identity_provider,external_user_id,customer_phone,phone_hash,first_seen_at,baseline) VALUES(?,?,?,?,?,?,?)')
        ->execute([bin2hex(random_bytes(32)),$customer['provider'],$id,$phone,$phone === '' ? null : hash('sha256',$phone),
            $at ?? (new DateTimeImmutable('now',new DateTimeZone('UTC')))->format('Y-m-d H:i:s.u'),(int)($baseline ?? !$enabled)]);
}

function app_referral_seed(PDO $db): void
{
    if (!$db->inTransaction()) throw new LogicException('Migration transaction required');
    $rows = $db->query("SELECT identity_provider,external_user_id,customer_phone,platform,MIN(linked_at) AS first_seen_at
        FROM app_devices WHERE platform IN ('android','ios')
        GROUP BY identity_provider,external_user_id,customer_phone,platform ORDER BY first_seen_at")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) app_referral_capture($db,['provider'=>$r['identity_provider'],'id'=>$r['external_user_id'],
        'phone'=>$r['customer_phone']],$r['platform'],true,$r['first_seen_at'].'.000000');
}

/** Strict live ownership resolution; an installation ID or client-supplied beneficiary is never trusted. */
function app_referral_owner(array $event, PDO $main, ?PDO $box): string
{
    $provider = $event['identity_provider'];
    $id = app_service_source_id($event['external_user_id']);
    $cached = app_service_source_phone($event['customer_phone']);
    if ($cached === '') throw new AppServiceSourceError('identidade');
    if ($provider === 'core') {
        $rows = app_service_source_read($main,'SELECT id,telefone AS phone FROM clientes WHERE id=? LIMIT 2',[$id],'identidade');
    } elseif ($provider === 'box' && $box) {
        $rows = app_service_source_read($box,"SELECT id,phone FROM users WHERE id=? AND role='customer' AND status='active' LIMIT 2",[$id],'identidade');
        $boxOwners = app_service_source_owners($box,'users',['phone'],$cached,'identidade');
        if (count($boxOwners)!==1 || (string)$boxOwners[0]['id']!==$id) throw new AppServiceSourceError('identidade');
    } else throw new AppServiceSourceError('identidade');
    if (count($rows)!==1 || app_service_source_phone((string)$rows[0]['phone'])!==$cached) throw new AppServiceSourceError('identidade');
    $owners = app_service_source_owners($main,'clientes',['telefone','telefone2'],$cached,'identidade');
    if (count($owners)!==1 || ($provider==='core' && (string)$owners[0]['id']!==$id)) throw new AppServiceSourceError('identidade');
    return app_service_source_id($owners[0]['id']);
}

/** Dedicated cashback writer. Never reuse the read-only legacy source connection for writes. */
function app_referral_cashback(array $env): PDO
{
    $host=$env['DB4_HOST'] ?? ''; $name=$env['DB4_NAME'] ?? ''; $port=$env['DB4_PORT'] ?? '3306';
    if (!preg_match('/^[A-Za-z0-9._:-]+$/D',$host) || !preg_match('/^[A-Za-z0-9_-]+$/D',$name) || !ctype_digit((string)$port)) throw new AppServiceSourceError('configuração');
    try {
        $db=new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",$env['DB4_USER'] ?? '',$env['DB4_PASS'] ?? '',[
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT=>3,PDO::ATTR_EMULATE_PREPARES=>false]);
        $db->exec("SET SESSION time_zone='+00:00'");
        $db->exec('SET SESSION innodb_lock_wait_timeout=3');
        return $db;
    } catch (Throwable) { throw new AppServiceSourceError('conexão'); }
}

function app_referral_cashback_schema(PDO $db, bool $temporary = false): void
{
    $prefix=$temporary ? 'CREATE TEMPORARY TABLE' : 'CREATE TABLE IF NOT EXISTS';
    $db->exec("$prefix lz_app_referral_first_uses(
        customer_id BIGINT UNSIGNED PRIMARY KEY, phone_hash CHAR(64) NOT NULL UNIQUE,
        event_key CHAR(64) NOT NULL UNIQUE, first_seen_at DATETIME(6) NOT NULL,
        outcome VARCHAR(32) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB");
    $db->exec("$prefix lz_app_referral_credits(
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        indicated_id BIGINT UNSIGNED NOT NULL UNIQUE, beneficiary_id BIGINT UNSIGNED NOT NULL,
        referral_id BIGINT UNSIGNED NOT NULL UNIQUE, event_key CHAR(64) NOT NULL UNIQUE,
        amount_cents INT UNSIGNED NOT NULL CHECK(amount_cents=990),
        usage_restriction VARCHAR(24) NOT NULL CHECK(usage_restriction='services_only'),
        rule_version VARCHAR(48) NOT NULL, first_seen_at DATETIME(6) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX app_referral_beneficiary(beneficiary_id)
    ) ENGINE=InnoDB");
    $db->exec("$prefix lz_app_referral_attributions(
        referral_id BIGINT UNSIGNED PRIMARY KEY, bound_at_utc DATETIME(6) NOT NULL
    ) ENGINE=InnoDB");
}

/** One atomic, replay-safe 990-cent entry. Never writes indicacoes or the service 5% ledger. */
function app_referral_grant(PDO $cb, array $event, string $owner, bool $historical, callable $validBeneficiary): string
{
    $date=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s.u',$event['first_seen_at'],new DateTimeZone('UTC'));
    if (!$date || $date->format('Y-m-d H:i:s.u')!==$event['first_seen_at']) throw new AppServiceSourceError('data');
    $cb->beginTransaction();
    try {
        $cb->prepare("INSERT INTO lz_app_referral_first_uses(customer_id,phone_hash,event_key,first_seen_at,outcome)
            VALUES(?,?,?,?,'pending') ON DUPLICATE KEY UPDATE customer_id=customer_id")
            ->execute([$owner,$event['phone_hash'],$event['event_key'],$event['first_seen_at']]);
        $q=$cb->prepare('SELECT event_key,outcome FROM lz_app_referral_first_uses WHERE customer_id=? OR phone_hash=? FOR UPDATE');
        $q->execute([$owner,$event['phone_hash']]); $seen=$q->fetchAll();
        if (count($seen)!==1 || $seen[0]['event_key']!==$event['event_key'] || $seen[0]['outcome']!=='pending') {
            $cb->rollBack(); return 'duplicate';
        }
        $outcome='historical';
        if (!$historical) {
            // New API bindings have UTC microseconds, including same-second signup/login.
            // Old records without precise evidence must precede the entire first-use second.
            $q=$cb->prepare("SELECT i.id,i.indicador_cliente_id FROM indicacoes i
                LEFT JOIN lz_app_referral_attributions a ON a.referral_id=i.id WHERE i.indicado_cliente_id=?
                AND i.status IN ('pendente','concluida') AND ((a.bound_at_utc IS NOT NULL AND a.bound_at_utc<?)
                    OR (a.bound_at_utc IS NULL AND i.created_at<?)) ORDER BY i.id LIMIT 3 FOR UPDATE");
            $q->execute([$owner,$event['first_seen_at'],$date->setTimezone(new DateTimeZone('America/Maceio'))->format('Y-m-d H:i:s')]);
            $refs=$q->fetchAll();
            $outcome=count($refs)>1 ? 'ambiguous' : 'no_prior_referral';
            if (count($refs)===1) {
                $beneficiary=app_service_source_id($refs[0]['indicador_cliente_id']);
                $outcome=$beneficiary===$owner ? 'self_referral' : 'invalid_beneficiary';
                if ($beneficiary!==$owner && $validBeneficiary($beneficiary,$event['customer_phone'])) {
                    $guard=$cb->prepare("SELECT b.referral_id FROM lz_referral_bindings b
                        JOIN lz_referral_claims c ON c.identity_key=CONCAT('id:',b.indicated_id) AND c.referral_id=b.referral_id
                        JOIN lz_referral_claims p ON p.identity_key=CONCAT('phone:',b.phone_hash) AND p.referral_id=b.referral_id
                        WHERE b.referral_id=? AND b.indicator_id=? AND b.indicated_id=? AND b.phone_hash=? AND b.review_required=0");
                    $guard->execute([$refs[0]['id'],$beneficiary,$owner,$event['phone_hash']]);
                    if (!$guard->fetchColumn()) {
                        $cb->prepare("UPDATE lz_app_referral_first_uses SET outcome='guard_rejected' WHERE customer_id=?")->execute([$owner]);
                        $cb->commit();return 'guard_rejected';
                    }
                    $cb->prepare("INSERT INTO lz_app_referral_credits(indicated_id,beneficiary_id,referral_id,event_key,
                        amount_cents,usage_restriction,rule_version,first_seen_at)
                        VALUES(?,?,?,?,990,'services_only','app_first_use_990_v1',?)")
                        ->execute([$owner,$beneficiary,$refs[0]['id'],$event['event_key'],$event['first_seen_at']]);
                    $outcome='credited';
                }
            }
        }
        $cb->prepare('UPDATE lz_app_referral_first_uses SET outcome=? WHERE customer_id=?')->execute([$outcome,$owner]);
        $cb->commit(); return $outcome;
    } catch (Throwable $error) {
        if ($cb->inTransaction()) $cb->rollBack();
        throw $error;
    }
}

function app_referral_process(PDO $journal, PDO $cb, array $event): string
{
    $q=$journal->prepare('SELECT 1 FROM app_referral_device_blocks WHERE identity_provider=? AND external_user_id=?');
    $q->execute([$event['identity_provider'],$event['external_user_id']]);
    if($q->fetchColumn()) return 'device_reused';
    // A baseline is ineligible by definition, including legacy accounts with ambiguous contacts.
    // Preserve its immutable identity/phone exclusion without touching the financial database.
    if ((int)$event['baseline']===1) return 'historical';
    $connections=[];
    try {
        $main=$connections[]=app_service_source_mysql(app_service_source_env(),'main');
        $box=null;
        if ($event['identity_provider']==='box') $box=$connections[]=app_service_source_box();
        $owner=app_referral_owner($event,$main,$box);
        // Includes old/unlinked CORE identities even if their phone has since changed.
        $q=$journal->prepare("SELECT 1 FROM app_referral_first_uses WHERE id<>? AND first_seen_at<=?
            AND ((identity_provider='core' AND external_user_id=?) OR phone_hash=?) LIMIT 1");
        $q->execute([$event['id'],$event['first_seen_at'],$owner,$event['phone_hash']]);
        $historical=(bool)$event['baseline'] || (bool)$q->fetchColumn();
        return app_referral_grant($cb,$event,$owner,$historical,static function(string $id,string $indicatedPhone) use($main,$owner,$cb): bool {
            $rows=app_service_source_read($main,'SELECT id,telefone,telefone2,cpf FROM clientes WHERE id=? LIMIT 2',[$id],'indicador');
            if (count($rows)!==1) return false;
            // Also reject self-referral through a second account with the same full contact.
            foreach (['telefone','telefone2'] as $key) if (app_service_source_phone((string)($rows[0][$key] ?? ''))===$indicatedPhone) return false;
            $current=app_service_source_read($main,'SELECT cpf FROM clientes WHERE id=? LIMIT 2',[$owner],'indicado');
            if(count($current)!==1) return false;
            $document=preg_replace('/\D/','',(string)($current[0]['cpf']??''));
            $referrerDocument=preg_replace('/\D/','',(string)($rows[0]['cpf']??''));
            if($document!=='' && $document===$referrerDocument) return false;
            $q=$cb->prepare('SELECT cpf_hash FROM lz_referral_bindings WHERE indicated_id=? AND review_required=0');
            $q->execute([$owner]);$bindings=$q->fetchAll();
            if(count($bindings)!==1 || ($bindings[0]['cpf_hash']!==null && !hash_equals($bindings[0]['cpf_hash'],hash('sha256',$document)))) return false;
            return true;
        });
    } finally {
        foreach ($connections as $c) if ($c->inTransaction()) $c->rollBack();
    }
}

/** Errors remain retryable and do not invent a zero/credit. No personal data or bearer tokens in logs. */
function app_referral_batch(PDO $journal, callable $processor): array
{
    if ((int)$journal->query('SELECT enabled FROM app_referral_policy WHERE id=1')->fetchColumn()!==1) return ['handled'=>0,'credited'=>0,'retry'=>0];
    $rows=$journal->query('SELECT * FROM app_referral_first_uses WHERE processed_at IS NULL AND (baseline=1 OR retry_at<=CURRENT_TIMESTAMP) ORDER BY baseline DESC,first_seen_at,id LIMIT 50')->fetchAll(PDO::FETCH_ASSOC);
    $counts=['handled'=>0,'credited'=>0,'retry'=>0];
    foreach ($rows as $event) {
        try {
            $outcome=$processor($event);
            $journal->prepare('UPDATE app_referral_first_uses SET processed_at=CURRENT_TIMESTAMP,outcome=?,attempts=attempts+1 WHERE id=? AND processed_at IS NULL')->execute([$outcome,$event['id']]);
            $counts['handled']++; if ($outcome==='credited') $counts['credited']++;
        } catch (Throwable) {
            $journal->prepare("UPDATE app_referral_first_uses SET outcome='retry',attempts=attempts+1,retry_at=datetime('now','+60 seconds') WHERE id=? AND processed_at IS NULL")->execute([$event['id']]);
            $counts['retry']++;
        }
    }
    $journal->exec('INSERT INTO app_referral_worker_health(id,heartbeat_at) VALUES(1,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at');
    return $counts;
}

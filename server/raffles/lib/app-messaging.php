<?php
declare(strict_types=1);
require_once __DIR__.'/app-referral-first-use.php';

function app_schema(PDO $db): void
{
    $db->exec("CREATE TABLE IF NOT EXISTS app_devices(
        id INTEGER PRIMARY KEY,
        installation_hash TEXT NOT NULL UNIQUE,
        identity_provider TEXT NOT NULL CHECK(identity_provider IN ('core','box')),
        external_user_id TEXT NOT NULL,
        customer_name TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        platform TEXT NOT NULL DEFAULT 'unknown',
        app_version TEXT NOT NULL DEFAULT '',
        marketing_opt_in INTEGER NOT NULL DEFAULT 0,
        linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        unlinked_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS app_devices_customer_installation ON app_devices(identity_provider,external_user_id,installation_hash);
    CREATE INDEX IF NOT EXISTS app_devices_active_seen ON app_devices(unlinked_at,last_seen_at);

    CREATE TABLE IF NOT EXISTS app_campaigns(
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        audience TEXT NOT NULL DEFAULT 'active_opted_in',
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','queued','sending','sent','partial','cancelled')),
        scheduled_at TEXT,
        created_by TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT,
        sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS app_campaign_deliveries(
        id INTEGER PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES app_campaigns(id) ON DELETE CASCADE,
        recipient_key TEXT NOT NULL,
        phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','retry','failed','cancelled')),
        attempts INTEGER NOT NULL DEFAULT 0,
        provider_id TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at TEXT,
        next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(campaign_id,recipient_key)
    );
    CREATE INDEX IF NOT EXISTS app_campaign_delivery_queue ON app_campaign_deliveries(status,next_attempt_at);");
    $columns = array_column($db->query('PRAGMA table_info(app_devices)')->fetchAll(), 'name');
    foreach ([
        'push_token'=>'TEXT', 'push_permission'=>"TEXT NOT NULL DEFAULT 'undetermined'",
        'push_opt_in'=>'INTEGER NOT NULL DEFAULT 0', 'push_updated_at'=>'TEXT',
        'push_consent_at'=>'TEXT', 'push_error'=>'TEXT',
        'service_push_opt_in'=>'INTEGER NOT NULL DEFAULT 0', 'service_push_consent_at'=>'TEXT',
    ] as $column=>$definition) {
        if (!in_array($column, $columns, true)) $db->exec("ALTER TABLE app_devices ADD COLUMN $column $definition");
    }
    $columns = array_column($db->query('PRAGMA table_info(app_campaigns)')->fetchAll(), 'name');
    foreach (['event_key'=>'TEXT','giveaway_id'=>'INTEGER','event_type'=>'TEXT','expires_at'=>'TEXT',
        'target_provider'=>'TEXT','target_user_id'=>'TEXT','resource_id'=>'TEXT'] as $column=>$definition) {
        if (!in_array($column, $columns, true)) $db->exec("ALTER TABLE app_campaigns ADD COLUMN $column $definition");
    }
    $columns=array_column($db->query('PRAGMA table_info(app_campaign_deliveries)')->fetchAll(),'name');
    if(!in_array('claimed_at',$columns,true))$db->exec('ALTER TABLE app_campaign_deliveries ADD COLUMN claimed_at TEXT');
    $db->exec("CREATE UNIQUE INDEX IF NOT EXISTS app_device_push_unique ON app_devices(push_token) WHERE push_token IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS app_campaign_event_unique ON app_campaigns(event_key) WHERE event_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS app_campaign_customer ON app_campaigns(audience,target_provider,target_user_id);
        CREATE TABLE IF NOT EXISTS app_push_deliveries(
            id INTEGER PRIMARY KEY,
            campaign_id INTEGER NOT NULL REFERENCES app_campaigns(id) ON DELETE CASCADE,
            device_id INTEGER NOT NULL REFERENCES app_devices(id),
            identity_provider TEXT NOT NULL, external_user_id TEXT NOT NULL,
            token TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','delivered','retry','failed','cancelled','expired','unknown')),
            attempts INTEGER NOT NULL DEFAULT 0,
            ticket_id TEXT, last_error TEXT, claimed_at TEXT, accepted_at TEXT, delivered_at TEXT,
            next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            receipt_after TEXT, receipt_attempts INTEGER NOT NULL DEFAULT 0,
            opened_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(campaign_id,device_id)
        );
        CREATE INDEX IF NOT EXISTS app_push_queue ON app_push_deliveries(status,next_attempt_at);
        CREATE INDEX IF NOT EXISTS app_push_receipts ON app_push_deliveries(status,receipt_after);");
    $db->exec("CREATE TABLE IF NOT EXISTS app_delivery_health(id INTEGER PRIMARY KEY CHECK(id=1),last_heartbeat_at TEXT NOT NULL);");
}

function app_push_valid_token(string $token): bool
{
    return preg_match('/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{16,200}\]$/D', $token) === 1;
}

/** Invalidate the next baseline atomically when the last consenting device leaves. No scheduler migration here. */
function app_service_invalidate_monitors(PDO $db): void
{
    if (!$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_service_monitors'")->fetchColumn()) return;
    $db->exec("UPDATE app_service_monitors SET enabled=0 WHERE enabled=1 AND NOT EXISTS(
        SELECT 1 FROM app_devices d WHERE d.identity_provider=app_service_monitors.identity_provider
            AND d.external_user_id=app_service_monitors.external_user_id AND d.service_push_opt_in=1
            AND d.push_permission='granted' AND d.push_token IS NOT NULL AND d.unlinked_at IS NULL
            AND d.last_seen_at>=datetime('now','-90 days'))");
}

function app_device_save(PDO $db, array $customer, array $body): string
{
    $installation=$body['installationId'] ?? '';
    if (!is_string($installation) || !preg_match('/^[A-Za-z0-9_-]{24,160}$/D',$installation)) throw new InvalidArgumentException('Identificador de instalação inválido.');
    $hash=hash('sha256',$installation);
    $platform=$body['platform'] ?? 'unknown';
    if (!in_array($platform,['android','ios','web','unknown'],true)) $platform='unknown';
    if (isset($body['marketingOptIn']) && !is_bool($body['marketingOptIn'])) throw new InvalidArgumentException('Autorização inválida.');
    $optIn=(int)($body['marketingOptIn'] ?? false);
    $db->beginTransaction();
    try {
        $db->prepare("INSERT INTO app_devices(installation_hash,identity_provider,external_user_id,customer_name,customer_phone,platform,app_version,marketing_opt_in)
            VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(installation_hash) DO UPDATE SET
            push_token=CASE WHEN app_devices.identity_provider<>excluded.identity_provider OR app_devices.external_user_id<>excluded.external_user_id OR app_devices.unlinked_at IS NOT NULL THEN NULL ELSE app_devices.push_token END,
            push_opt_in=CASE WHEN app_devices.identity_provider<>excluded.identity_provider OR app_devices.external_user_id<>excluded.external_user_id OR app_devices.unlinked_at IS NOT NULL THEN 0 ELSE app_devices.push_opt_in END,
            service_push_opt_in=CASE WHEN app_devices.identity_provider<>excluded.identity_provider OR app_devices.external_user_id<>excluded.external_user_id OR app_devices.unlinked_at IS NOT NULL THEN 0 ELSE app_devices.service_push_opt_in END,
            push_consent_at=CASE WHEN app_devices.identity_provider<>excluded.identity_provider OR app_devices.external_user_id<>excluded.external_user_id OR app_devices.unlinked_at IS NOT NULL THEN NULL ELSE app_devices.push_consent_at END,
            service_push_consent_at=CASE WHEN app_devices.identity_provider<>excluded.identity_provider OR app_devices.external_user_id<>excluded.external_user_id OR app_devices.unlinked_at IS NOT NULL THEN NULL ELSE app_devices.service_push_consent_at END,
            marketing_opt_in=CASE WHEN app_devices.identity_provider<>excluded.identity_provider OR app_devices.external_user_id<>excluded.external_user_id OR app_devices.unlinked_at IS NOT NULL THEN excluded.marketing_opt_in ELSE app_devices.marketing_opt_in END,
            identity_provider=excluded.identity_provider,external_user_id=excluded.external_user_id,
            customer_name=excluded.customer_name,customer_phone=excluded.customer_phone,
            platform=excluded.platform,app_version=excluded.app_version,last_seen_at=CURRENT_TIMESTAMP,unlinked_at=NULL")
            ->execute([$hash,$customer['provider'],$customer['id'],$customer['name'],$customer['phone'],$platform,mb_substr((string)($body['appVersion']??''),0,32),$optIn]);
        $q=$db->prepare('SELECT id FROM app_devices WHERE installation_hash=?');$q->execute([$hash]);$id=(int)$q->fetchColumn();
        $db->prepare("UPDATE app_push_deliveries SET status='cancelled',last_error='Conta alterada' WHERE device_id=? AND status IN ('queued','retry') AND (identity_provider<>? OR external_user_id<>?)")->execute([$id,$customer['provider'],$customer['id']]);
        if (array_key_exists('marketingOptIn',$body)) {
            $db->prepare('UPDATE app_devices SET marketing_opt_in=? WHERE identity_provider=? AND external_user_id=? AND unlinked_at IS NULL')->execute([$optIn,$customer['provider'],$customer['id']]);
        }
        app_push_register($db,$id,$body);
        app_service_invalidate_monitors($db);
        app_referral_capture($db,$customer,$platform,null,null,$hash);
        $db->commit();
        return $hash;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

/** Must run inside the device-registration transaction, after authenticated ownership is set. */
function app_push_register(PDO $db, int $deviceId, array $body): void
{
    if (!isset($body['push']) || !is_array($body['push'])) return; // Old APKs remain compatible.
    $push = $body['push'];
    $permission = $push['permission'] ?? 'undetermined';
    if (!in_array($permission, ['granted','denied','undetermined','unavailable'], true)
        || !is_bool($push['enabled'] ?? null)) throw new InvalidArgumentException('Preferência push inválida.');
    if(array_key_exists('refreshOnly',$push)&&!is_bool($push['refreshOnly']))throw new InvalidArgumentException('Tipo de atualização push inválido.');
    $scope=array_key_exists('scope',$push)?$push['scope']:'raffles'; // Old APKs only control raffle notifications.
    if(!in_array($scope,['raffles','services'],true))throw new InvalidArgumentException('Categoria push inválida.');
    $flag=$scope==='services'?'service_push_opt_in':'push_opt_in';
    $consent=$scope==='services'?'service_push_consent_at':'push_consent_at';
    $token = $push['token'] ?? null;
    if ($token !== null && (!is_string($token) || !app_push_valid_token($token))) throw new InvalidArgumentException('Token push inválido.');
    $current=$db->prepare('SELECT push_token,push_opt_in,service_push_opt_in FROM app_devices WHERE id=?');$current->execute([$deviceId]);
    $device=$current->fetch();
    if(!$device)throw new InvalidArgumentException('Aparelho não encontrado.');
    $enabled = $push['enabled'] && $permission === 'granted' && $token !== null;
    if(!empty($push['refreshOnly'])){
        $enabled=$enabled&&(bool)$device[$flag];
    }
    // OS-level permission is shared; category opt-out is not global revocation.
    $globalRevocation=$permission!=='granted';
    $token=$globalRevocation?null:($token??$device['push_token']);
    // Tokens are exclusive to one installation. Never deliver the old account's queue to a new owner.
    if ($token !== null) {
        $db->prepare("UPDATE app_push_deliveries SET status='cancelled',last_error='Token vinculado a outro aparelho' WHERE token=? AND device_id<>? AND status IN ('queued','retry')")->execute([$token,$deviceId]);
        $db->prepare('UPDATE app_devices SET push_token=NULL,push_opt_in=0,service_push_opt_in=0 WHERE push_token=? AND id<>?')->execute([$token,$deviceId]);
    }
    $db->prepare("UPDATE app_devices SET push_token=?,push_permission=?,$flag=?,push_error=?,
        $consent=CASE WHEN CAST(? AS INTEGER)=1 AND $flag=0 THEN CURRENT_TIMESTAMP ELSE $consent END,
        push_updated_at=CURRENT_TIMESTAMP WHERE id=?")
        ->execute([$token,$permission,(int)$enabled,$push['enabled'] && !$enabled && empty($push['refreshOnly']) ? 'Registro push indisponível; reconecte o aplicativo' : null,(int)$enabled,$deviceId]);
    if($globalRevocation)$db->prepare('UPDATE app_devices SET push_opt_in=0,service_push_opt_in=0 WHERE id=?')->execute([$deviceId]);
    $db->prepare("UPDATE app_push_deliveries SET status='cancelled',last_error='Autorização ou token alterado'
        WHERE device_id=? AND status IN ('queued','retry') AND NOT EXISTS(
          SELECT 1 FROM app_devices d JOIN app_campaigns c ON c.id=app_push_deliveries.campaign_id
          WHERE d.id=app_push_deliveries.device_id AND d.push_token=app_push_deliveries.token
            AND d.push_permission='granted' AND ".app_push_audience_sql().")")
        ->execute([$deviceId]);
}

function app_device_unlink(PDO $db, string $hash, array $customer): void
{
    $query=$db->prepare('SELECT id FROM app_devices WHERE installation_hash=? AND identity_provider=? AND external_user_id=?');
    $query->execute([$hash,$customer['provider'],$customer['id']]);
    $id=$query->fetchColumn();
    if (!$id) return;
    $db->prepare("UPDATE app_push_deliveries SET status='cancelled',last_error='Cliente saiu da conta' WHERE device_id=? AND status IN ('queued','retry')")->execute([$id]);
    $db->prepare('UPDATE app_devices SET unlinked_at=CURRENT_TIMESTAMP,push_token=NULL,push_opt_in=0,service_push_opt_in=0,marketing_opt_in=0 WHERE id=?')->execute([$id]);
    app_service_invalidate_monitors($db);
}

/** Internal SQL fragment; aliases d (device) and c (campaign) are fixed by callers. */
function app_push_audience_sql(): string
{
    return "((c.audience='service_customer' AND c.event_type IN ('service_order','appointment')
        AND c.target_provider=d.identity_provider AND c.target_user_id=d.external_user_id
        AND c.resource_id IS NOT NULL AND d.service_push_opt_in=1)
        OR (c.audience IN ('active_opted_in','single_device_test') AND d.push_opt_in=1))";
}

function app_push_enqueue(PDO $db, int $campaignId, ?string $when=null, ?int $onlyDevice=null): int
{
    $query=$db->prepare("INSERT OR IGNORE INTO app_push_deliveries(campaign_id,device_id,identity_provider,external_user_id,token,next_attempt_at)
        SELECT c.id,d.id,d.identity_provider,d.external_user_id,d.push_token,? FROM app_devices d JOIN app_campaigns c ON c.id=?
        WHERE d.unlinked_at IS NULL AND d.push_permission='granted' AND d.push_token IS NOT NULL
          AND c.status IN ('scheduled','queued','sending')
          AND d.last_seen_at>=datetime('now','-90 days') AND ".app_push_audience_sql().($onlyDevice!==null?' AND d.id=?':''));
    $params=[$when ?: gmdate('Y-m-d H:i:s'),$campaignId];
    if($onlyDevice!==null)$params[]=$onlyDevice;
    $query->execute($params);
    return $query->rowCount();
}

function app_push_test_device(PDO $db,int $deviceId): int
{
    $db->beginTransaction();
    try{
        $db->prepare("INSERT INTO app_campaigns(title,message,audience,status,published_at,expires_at)
            VALUES(?,?,'single_device_test','queued',CURRENT_TIMESTAMP,datetime('now','+1 hour'))")
            ->execute(['Teste de notificação LZ-GAMES','🔔 Este é um teste autorizado do sistema de avisos. Toque para abrir Sorteios.']);
        $id=(int)$db->lastInsertId();
        if(app_push_enqueue($db,$id,null,$deviceId)!==1)throw new InvalidArgumentException('Aparelho sem token ou sem autorização push ativa.');
        $db->commit();return $id;
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

function app_whatsapp_enqueue(PDO $db, int $campaignId, ?string $when=null): int
{
    // Private service campaigns are push/inbox only, including accidental legacy calls.
    $campaign=$db->prepare('SELECT audience FROM app_campaigns WHERE id=?');$campaign->execute([$campaignId]);
    if($campaign->fetchColumn()!=='active_opted_in')return 0;
    $rows=$db->query("SELECT identity_provider,external_user_id,customer_phone FROM app_devices
        WHERE unlinked_at IS NULL AND marketing_opt_in=1 AND last_seen_at>=datetime('now','-90 days')")->fetchAll();
    $insert=$db->prepare('INSERT OR IGNORE INTO app_campaign_deliveries(campaign_id,recipient_key,phone,next_attempt_at) VALUES(?,?,?,?)');
    $count=0;
    foreach ($rows as $row) {
        $phone=app_message_phone((string)$row['customer_phone']);
        if ($phone === '') continue;
        $insert->execute([$campaignId,'phone:'.$phone,$phone,$when ?: gmdate('Y-m-d H:i:s')]);
        $count+=$insert->rowCount();
    }
    return $count;
}

function app_message_phone(string $phone): string
{
    $phone=preg_replace('/\D/','',$phone) ?? '';
    if (strlen($phone)===10 || strlen($phone)===11) $phone='55'.$phone;
    return preg_match('/^55\d{10,11}$/D',$phone) ? $phone : '';
}

/** Enqueue only. Never perform network requests inside a customer/admin transaction. */
function app_campaign_create(PDO $db, string $title, string $message, ?string $when=null, ?string $eventKey=null, ?int $giveawayId=null, ?string $eventType=null, ?string $expires=null): array
{
    $ownTransaction=!$db->inTransaction();
    if ($ownTransaction) $db->beginTransaction();
    try {
        $scheduled=$when !== null && $when>gmdate('Y-m-d H:i:s');
        $q=$db->prepare('INSERT OR IGNORE INTO app_campaigns(title,message,status,scheduled_at,published_at,event_key,giveaway_id,event_type,expires_at) VALUES(?,?,?,?,?,?,?,?,?)');
        $q->execute([$title,$message,$scheduled?'scheduled':'queued',$when,$scheduled?null:gmdate('Y-m-d H:i:s'),$eventKey,$giveawayId,$eventType,$expires]);
        if ($q->rowCount()===0) {
            $q=$db->prepare('SELECT id FROM app_campaigns WHERE event_key=?');$q->execute([$eventKey]);
            $result=['id'=>(int)$q->fetchColumn(),'push'=>0,'whatsapp'=>0,'duplicate'=>true];
        } else {
            $id=(int)$db->lastInsertId();
            $result=['id'=>$id,'push'=>app_push_enqueue($db,$id,$when),'whatsapp'=>app_whatsapp_enqueue($db,$id,$when),'duplicate'=>false];
        }
        if ($ownTransaction) $db->commit();
        return $result;
    } catch (Throwable $e) {
        if ($ownTransaction && $db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

/**
 * Private queue only; no network or WhatsApp. Caller supplies a verified server-side owner.
 * Title/body must contain only an OS number/status or appointment date/time, never customer
 * name, phone, equipment, fault description, access code/password or price.
 * eventKey must identify one immutable resource event; no historical replay on registration.
 */
function app_service_campaign_create(PDO $db, array $customer, string $eventKey, string $eventType, string $resourceId, string $title, string $message, ?string $when=null, ?string $expires=null): array
{
    $provider=$customer['provider']??null;$userId=$customer['id']??null;
    if(!in_array($provider,['core','box'],true)||!is_string($userId)||$userId===''||mb_strlen($userId)>160
        ||!in_array($eventType,['service_order','appointment'],true)||$resourceId===''||mb_strlen($resourceId)>160
        ||$eventKey===''||mb_strlen($eventKey)>500||trim($title)===''||trim($message)==='')
        throw new InvalidArgumentException('Evento de serviço inválido.');
    foreach([$when,$expires] as $date){
        if($date===null)continue;
        $parsed=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$date,new DateTimeZone('UTC'));
        if(!$parsed||$parsed->format('Y-m-d H:i:s')!==$date)throw new InvalidArgumentException('Data de aviso inválida.');
    }
    // Even callers that omit expiry cannot leave stale service notifications pending forever.
    $expires??=gmdate('Y-m-d H:i:s',max(time(),$when?(new DateTimeImmutable($when,new DateTimeZone('UTC')))->getTimestamp():0)+86400);
    $ownTransaction=!$db->inTransaction();if($ownTransaction)$db->beginTransaction();
    try{
        $scheduled=$when!==null&&$when>gmdate('Y-m-d H:i:s');
        $q=$db->prepare("INSERT OR IGNORE INTO app_campaigns(title,message,audience,status,scheduled_at,published_at,event_key,event_type,expires_at,target_provider,target_user_id,resource_id,created_by)
            VALUES(?,?,'service_customer',?,?,?,?,?,?,?,?,?,'service_scheduler')");
        $q->execute([mb_substr(trim($title),0,120),mb_substr(trim($message),0,240),$scheduled?'scheduled':'queued',$when,
            $scheduled?null:gmdate('Y-m-d H:i:s'),$eventKey,$eventType,$expires,$provider,$userId,$resourceId]);
        if($q->rowCount()===0){
            $q=$db->prepare('SELECT id,audience,target_provider,target_user_id,event_type,resource_id FROM app_campaigns WHERE event_key=?');$q->execute([$eventKey]);$existing=$q->fetch();
            if(!$existing||$existing['audience']!=='service_customer'||$existing['target_provider']!==$provider
                ||$existing['target_user_id']!==$userId||$existing['event_type']!==$eventType||$existing['resource_id']!==$resourceId)
                throw new InvalidArgumentException('Identificador de evento já pertence a outro destino.');
            $result=['id'=>(int)$existing['id'],'push'=>0,'whatsapp'=>0,'duplicate'=>true];
        }else{
            $id=(int)$db->lastInsertId();$result=['id'=>$id,'push'=>app_push_enqueue($db,$id,$when),'whatsapp'=>0,'duplicate'=>false];
        }
        if($ownTransaction)$db->commit();return $result;
    }catch(Throwable $e){if($ownTransaction&&$db->inTransaction())$db->rollBack();throw $e;}
}

/** Called only by a NEW admin action; installing this feature does not replay historical raffles. */
function app_announce_giveaway(PDO $db, int $id, ?DateTimeImmutable $date=null): void
{
    $q=$db->prepare("SELECT title FROM giveaways WHERE id=? AND mode='LIVE' AND status='OPEN'");$q->execute([$id]);
    $title=$q->fetchColumn();if (!$title) return;
    $type=$date?'scheduled':'created';
    $key='giveaway:'.$id.':'.$type.($date?':'.$date->getTimestamp():'');
    // A → B → A is a new scheduling action, not a replay of cancelled A.
    $prior=$db->prepare('SELECT id,status,event_key FROM app_campaigns WHERE event_key=? OR event_key LIKE ? ORDER BY id DESC LIMIT 1');
    $prior->execute([$key,$key.':revision:%']);$previous=$prior->fetch();
    if($previous)$key=$previous['status']==='cancelled'?$key.':revision:'.((int)$previous['id']+1):$previous['event_key'];
    if ($date) {
        $old=$db->prepare("SELECT id FROM app_campaigns WHERE giveaway_id=? AND event_type='scheduled' AND event_key<>? AND status<>'cancelled'");
        $old->execute([$id,$key]);
        foreach($old->fetchAll() as $campaign) app_campaign_cancel($db,(int)$campaign['id']);
    }
    $q=$db->prepare('SELECT label FROM prizes WHERE giveaway_id=? ORDER BY position LIMIT 5');$q->execute([$id]);
    $prizes=implode(' • ',array_column($q->fetchAll(),'label'));
    $message="🏆 LZ-GAMES — ".$title."\n\n";
    if ($prizes!=='') $message.='🎁 '.mb_substr($prizes,0,500)."\n";
    $message.=$date?'📅 '.$date->setTimezone(new DateTimeZone('America/Maceio'))->format('d/m/Y às H:i').' (Maceió)': '📅 Data e horário serão divulgados no aplicativo.';
    $message.="\n\nConfira as informações e sua participação na aba Sorteios do app.\nhttps://sorteios.lzgames.com.br/";
    app_campaign_create($db,$date?'Sorteio programado: '.mb_substr($title,0,90):'Novo sorteio: '.mb_substr($title,0,100),$message,null,$key,$id,$type,$date?$date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'):null);
}

function app_campaign_cancel(PDO $db, int $id): void
{
    $db->prepare("UPDATE app_campaigns SET status='cancelled' WHERE id=?")->execute([$id]);
    $db->prepare("UPDATE app_campaign_deliveries SET status='cancelled' WHERE campaign_id=? AND status IN ('queued','retry')")->execute([$id]);
    $db->prepare("UPDATE app_push_deliveries SET status='cancelled',last_error='Campanha cancelada' WHERE campaign_id=? AND status IN ('queued','retry')")->execute([$id]);
}

function app_cancel_giveaway_announcements(PDO $db,int $giveawayId,bool $onlySchedule=false): void
{
    $q=$db->prepare("SELECT id FROM app_campaigns WHERE giveaway_id=? AND status<>'cancelled'".($onlySchedule?" AND event_type='scheduled'":''));
    $q->execute([$giveawayId]);
    foreach($q->fetchAll() as $campaign) app_campaign_cancel($db,(int)$campaign['id']);
}

function app_campaign_refresh_status(PDO $db): void
{
    // Campaign publication is independent of the WhatsApp audience and remains available even with zero devices.
    $db->exec("UPDATE app_campaigns SET status='queued',published_at=COALESCE(published_at,CURRENT_TIMESTAMP)
        WHERE status='scheduled' AND scheduled_at<=CURRENT_TIMESTAMP;
        UPDATE app_campaigns SET status=CASE WHEN
          EXISTS(SELECT 1 FROM app_campaign_deliveries w WHERE w.campaign_id=app_campaigns.id AND w.status='failed') OR
          EXISTS(SELECT 1 FROM app_push_deliveries p WHERE p.campaign_id=app_campaigns.id AND p.status IN ('failed','unknown','expired'))
          THEN 'partial' ELSE 'sent' END,sent_at=CURRENT_TIMESTAMP
        WHERE status IN ('queued','sending')
          AND NOT EXISTS(SELECT 1 FROM app_campaign_deliveries w WHERE w.campaign_id=app_campaigns.id AND w.status IN ('queued','retry','sending'))
          AND NOT EXISTS(SELECT 1 FROM app_push_deliveries p WHERE p.campaign_id=app_campaigns.id AND p.status IN ('queued','retry','sending','accepted'));");
}

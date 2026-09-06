<?php
declare(strict_types=1);
require_once __DIR__.'/app-credit.php';

/** Explicit CLI migration. Never called by a page or an API request. No ALTER of legacy money columns. */
function lz_app_credit_schema(PDO $db,string $cb): void
{
    $policy=lz_app_credit_table($cb,'lz_app_referral_redemption_policy');
    $wallet=lz_app_credit_table($cb,'lz_app_referral_wallet_locks');
    $uses=lz_app_credit_table($cb,'lz_app_referral_redemptions');
    $db->exec("CREATE TABLE IF NOT EXISTS $policy(id TINYINT PRIMARY KEY,enabled TINYINT NOT NULL DEFAULT 0,activated_at DATETIME(6),CHECK(id=1),CHECK(enabled IN(0,1))) ENGINE=InnoDB");
    $db->exec("INSERT IGNORE INTO $policy(id) VALUES(1)");
    $db->exec("CREATE TABLE IF NOT EXISTS $wallet(beneficiary_id BIGINT UNSIGNED PRIMARY KEY) ENGINE=InnoDB");
    $db->exec("CREATE TABLE IF NOT EXISTS $uses(
        id CHAR(32) PRIMARY KEY,beneficiary_id BIGINT UNSIGNED NOT NULL,os_id INT NOT NULL,
        amount_cents INT UNSIGNED NOT NULL,subtotal_before_cents INT UNSIGNED NOT NULL,subtotal_after_cents INT UNSIGNED NOT NULL,
        actor_id INT NOT NULL,state VARCHAR(12) NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        reversed_by INT,reversed_at DATETIME(6),reversal_reason VARCHAR(160),
        CHECK(amount_cents>0),CHECK(subtotal_before_cents-subtotal_after_cents=amount_cents),CHECK(state IN('active','reversed')),
        INDEX app_credit_usage(beneficiary_id,state),INDEX app_credit_os_history(os_id)
    ) ENGINE=InnoDB");
    $db->exec("CREATE TABLE IF NOT EXISTS lz_app_credit_os(
        os_id INT PRIMARY KEY,redemption_id CHAR(32) NOT NULL UNIQUE,beneficiary_id BIGINT UNSIGNED NOT NULL,
        amount_cents INT UNSIGNED NOT NULL,subtotal_before_cents INT UNSIGNED NOT NULL,subtotal_after_cents INT UNSIGNED NOT NULL,
        sealed TINYINT NOT NULL DEFAULT 0,CHECK(sealed IN(0,1)),CHECK(amount_cents>0),CHECK(subtotal_before_cents-subtotal_after_cents=amount_cents)
    ) ENGINE=InnoDB");
}

/** Triggers cover every legacy writer, including imports/direct SQL, not just the new UI. */
function lz_app_credit_triggers(PDO $db,string $cb): array
{
    $sql=[];
    $fields=['id','cliente','cliente_id','valor','desconto','tipo_desconto','subtotal','total_produtos','total_servicos','frete','mao_obra','val_entrada','vall','orcamento'];
    $changed=implode(' OR ',array_map(static fn($f)=>"NOT(OLD.`$f` <=> NEW.`$f`)",$fields));
    $error="SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Credito do app aplicado: estorne antes de alterar valores, cliente ou itens'";
    $sql['lz_app_credit_os_update']="BEFORE UPDATE ON os FOR EACH ROW BEGIN
        DECLARE credit INT DEFAULT NULL; SELECT amount_cents INTO credit FROM lz_app_credit_os WHERE os_id=OLD.id FOR UPDATE;
        IF credit IS NOT NULL AND (($changed) OR (OLD.pago='Sim' AND NOT(NEW.pago <=> OLD.pago))) THEN $error; END IF;
    END";
    $sql['lz_app_credit_os_delete']="BEFORE DELETE ON os FOR EACH ROW BEGIN
        DECLARE credit INT DEFAULT NULL; SELECT amount_cents INTO credit FROM lz_app_credit_os WHERE os_id=OLD.id FOR UPDATE;
        IF credit IS NOT NULL THEN $error; END IF;
    END";
    $sql['lz_app_credit_os_seal']="AFTER UPDATE ON os FOR EACH ROW BEGIN
        IF NEW.pago='Sim' OR NEW.status NOT IN ('Aberta','Iniciada','Aguardando Peça','Aguardando Aprovação','Em Bancada') OR NEW.status IS NULL THEN
            UPDATE lz_app_credit_os SET sealed=1 WHERE os_id=NEW.id AND sealed=0;
        END IF;
    END";
    foreach (['produtos_orc'=>'produto','servicos_orc'=>'servico'] as $table=>$item) {
        foreach (['insert'=>'INSERT','update'=>'UPDATE','delete'=>'DELETE'] as $suffix=>$op) {
            $columns=['os',$item,'quantidade','valor','total','orcamento'];
            if ($item==='servico') $columns[]='cliente';
            $change=implode(' OR ',array_map(static fn($f)=>"NOT(OLD.`$f` <=> NEW.`$f`)",$columns));
            $before=$op==='INSERT'?'0':'COALESCE(OLD.os,0)';$after=$op==='DELETE'?'0':'COALESCE(NEW.os,0)';
            $checks="SET first_id=LEAST($before,$after); SET second_id=GREATEST($before,$after);
                IF first_id>0 THEN
                    SELECT id INTO parent_id FROM os WHERE id=first_id FOR UPDATE;
                    SET credit=NULL; SELECT amount_cents INTO credit FROM lz_app_credit_os WHERE os_id=first_id FOR UPDATE;
                    IF credit IS NOT NULL THEN $error; END IF;
                END IF;
                IF second_id>0 AND second_id<>first_id THEN
                    SELECT id INTO parent_id FROM os WHERE id=second_id FOR UPDATE;
                    SET credit=NULL; SELECT amount_cents INTO credit FROM lz_app_credit_os WHERE os_id=second_id FOR UPDATE;
                    IF credit IS NOT NULL THEN $error; END IF;
                END IF;";
            if ($op==='UPDATE') $checks="IF $change THEN $checks END IF;";
            $sql["lz_app_credit_{$item}_$suffix"]="BEFORE $op ON $table FOR EACH ROW BEGIN
                DECLARE parent_id INT DEFAULT NULL; DECLARE credit INT DEFAULT NULL; DECLARE first_id INT; DECLARE second_id INT;
                $checks
            END";
        }
    }
    // A charge cannot race with an app-credit application or continue using the pre-discount total.
    foreach (['INSERT','UPDATE','DELETE'] as $op) {
        $rows=$op==='INSERT'?['NEW']:($op==='DELETE'?['OLD']:['OLD','NEW']);$body='';
        foreach ($rows as $row) {
            $body.="IF $row.referencia='Serviço' AND $row.id_ref>0 THEN
                SET remaining=NULL; SELECT subtotal INTO remaining FROM os WHERE id=$row.id_ref FOR UPDATE;
                SET credit=NULL; SELECT amount_cents INTO credit FROM lz_app_credit_os WHERE os_id=$row.id_ref FOR UPDATE;
                IF credit IS NOT NULL THEN ";
            if ($op==='DELETE' || ($op==='UPDATE' && $row==='OLD')) $body.="SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cobranca vinculada a credito do app: conferir financeiro';";
            else $body.="IF COALESCE($row.descricao,'')<>'Nova OS' OR COALESCE($row.pago,'')<>'Sim' OR remaining IS NULL OR $row.valor<>remaining OR $row.valor IS NULL THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cobranca deve usar o total liquido da OS com credito'; END IF;";
            $body.='END IF; END IF;';
        }
        $sql['lz_app_credit_charge_'.strtolower($op)]="BEFORE $op ON receber FOR EACH ROW BEGIN DECLARE remaining DECIMAL(8,2) DEFAULT NULL; DECLARE credit INT DEFAULT NULL; $body END";
    }
    // Append-only audit, with one explicit reversal transition; never delete financial history.
    $auditFields=['id','beneficiary_id','os_id','amount_cents','subtotal_before_cents','subtotal_after_cents','actor_id','created_at'];
    $change=implode(' OR ',array_map(static fn($f)=>"NOT(OLD.`$f` <=> NEW.`$f`)",$auditFields));
    $uses=lz_app_credit_table($cb,'lz_app_referral_redemptions');
    $sql["$cb.lz_app_credit_audit_update"]="BEFORE UPDATE ON $uses FOR EACH ROW BEGIN
        IF ($change) OR OLD.state<>'active' OR NEW.state<>'reversed' OR NEW.reversed_by IS NULL OR NEW.reversed_at IS NULL OR CHAR_LENGTH(COALESCE(NEW.reversal_reason,''))<5 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Immutable app credit audit'; END IF;
    END";
    $sql["$cb.lz_app_credit_audit_delete"]="BEFORE DELETE ON $uses FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Immutable app credit audit'; END";
    return $sql;
}
function lz_app_credit_install_triggers(PDO $db,string $cb): void
{
    $main=(string)$db->query('SELECT DATABASE()')->fetchColumn();
    foreach (lz_app_credit_triggers($db,$cb) as $key=>$definition) {
        $parts=explode('.',$key);$schema=count($parts)===2?$parts[0]:$main;$name=end($parts);
        if (!preg_match('/^[A-Za-z0-9_-]+$/D',$schema) || !preg_match('/^lz_app_credit_[a-z_]+$/D',$name)) throw new LogicException('Invalid trigger identifier');
        $q=$db->prepare('SELECT ACTION_STATEMENT,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? AND TRIGGER_NAME=?');$q->execute([$schema,$name]);$existing=$q->fetch();
        if (!$existing) $db->exec("CREATE TRIGGER `$schema`.`$name` $definition");
        else {
            // Do not replace somebody else's trigger or briefly remove active protections.
            preg_match('/^(BEFORE|AFTER) (INSERT|UPDATE|DELETE) ON (\S+) FOR EACH ROW (.*)$/sD',$definition,$m);
            $normalize=static fn($v)=>preg_replace('/\s+/',' ',trim($v));
            if (!$m || $normalize($existing['ACTION_STATEMENT'])!==$normalize($m[4]) || $existing['ACTION_TIMING']!==$m[1] || $existing['EVENT_MANIPULATION']!==$m[2]) throw new RuntimeException('Credit trigger differs; manual reconciliation required');
        }
    }
}

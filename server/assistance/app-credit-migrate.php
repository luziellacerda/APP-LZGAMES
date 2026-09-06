<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
require_once __DIR__.'/app-credit-schema.php';
try {
    [$db,$cb]=lz_app_credit_writer();
    $main=(string)$db->query('SELECT DATABASE()')->fetchColumn();
    foreach ([$main=>['os','servicos_orc','produtos_orc','receber','clientes'],$cb=>['lz_app_referral_credits']] as $schema=>$tables) {
        foreach ($tables as $table) {
            $q=$db->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?');$q->execute([$schema,$table]);
            if ($q->fetchColumn()!=='InnoDB') throw new RuntimeException('Transactional source required');
        }
    }
    lz_app_credit_schema($db,$cb);
    lz_app_credit_install_triggers($db,$cb);
    $policy=lz_app_credit_table($cb,'lz_app_referral_redemption_policy');
    if (in_array('--disable',$argv,true)) $db->exec("UPDATE $policy SET enabled=0 WHERE id=1");
    elseif (in_array('--activate',$argv,true)) $db->exec("UPDATE $policy SET enabled=1,activated_at=COALESCE(activated_at,UTC_TIMESTAMP(6)) WHERE id=1");
    echo json_encode($db->query("SELECT enabled,activated_at FROM $policy WHERE id=1")->fetch()),PHP_EOL;
} catch (Throwable) { fwrite(STDERR,"Credit migration failed. No secrets logged; check schema/protections before activating.\n");exit(1); }

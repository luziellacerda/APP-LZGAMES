<?php
declare(strict_types=1);
require_once __DIR__.'/lib/app-referral-first-use.php';
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
umask(0077);
try {
    $journal=new PDO('sqlite:'.__DIR__.'/.data/sorteios.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $journal->exec('PRAGMA busy_timeout=5000');
    app_referral_schema($journal);
    if (in_array('--disable',$argv,true)) {
        $journal->exec('UPDATE app_referral_policy SET enabled=0 WHERE id=1');
        echo "Processing disabled; first-use capture and all credits preserved.\n"; exit;
    }
    $cb=app_referral_cashback(app_service_source_env());
    app_referral_cashback_schema($cb);
    $journal->beginTransaction();
    // Take the SQLite write lock before seeding so a concurrent first access cannot slip past the baseline.
    $journal->exec('UPDATE app_referral_policy SET enabled=enabled WHERE id=1');
    $active=$journal->query('SELECT activated_at FROM app_referral_policy WHERE id=1')->fetchColumn();
    if (!$active) app_referral_seed($journal);
    if (in_array('--activate',$argv,true)) {
        $journal->exec('UPDATE app_referral_policy SET enabled=1,activated_at=COALESCE(activated_at,CURRENT_TIMESTAMP) WHERE id=1');
    }
    $journal->commit();
    echo json_encode($journal->query('SELECT enabled,activated_at FROM app_referral_policy WHERE id=1')->fetch()),PHP_EOL;
} catch (Throwable) {
    if (isset($journal) && $journal->inTransaction()) $journal->rollBack();
    fwrite(STDERR,"Migration failed; check connections/schema. No private details logged.\n"); exit(1);
}

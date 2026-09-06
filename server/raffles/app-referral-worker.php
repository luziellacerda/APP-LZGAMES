<?php
declare(strict_types=1);
require_once __DIR__.'/lib/app-referral-first-use.php';
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
umask(0077);
$lock=fopen(__DIR__.'/.data/app-referral-worker.lock','c');
if (!$lock || !flock($lock,LOCK_EX|LOCK_NB)) exit(0);
$once=in_array('--once',$argv,true);
do {
    try {
        $journal=new PDO('sqlite:'.__DIR__.'/.data/sorteios.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $journal->exec('PRAGMA busy_timeout=5000');
        $cb=app_referral_cashback(app_service_source_env());
        $counts=app_referral_batch($journal,static fn(array $event):string=>app_referral_process($journal,$cb,$event));
        if ($once || array_sum($counts)>0) echo json_encode($counts),PHP_EOL;
        $cb=null; $journal=null;
    } catch (Throwable) { fwrite(STDERR,"App referral worker: retry needed (no private details logged).\n"); if ($once) exit(1); }
    if (!$once) sleep(15);
} while (!$once);

<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
require_once dirname(__DIR__).'/app-credit-schema.php';
$checks=0;
function check(bool $ok,string $label): void { global $checks;if (!$ok) throw new RuntimeException($label);$checks++; }
function rejected(callable $fn,string $label): void { try {$fn();} catch(Throwable) {check(true,$label);return;} throw new RuntimeException($label); }
function fixtureConnection(string $main,string $cb): PDO {
    if (!preg_match('/^lz_credit_test_[a-f0-9]{12}_main$/D',$main) || $cb!==substr($main,0,-5).'_cb') throw new RuntimeException('Not a synthetic schema');
    [$d]=lz_app_credit_writer();$d->exec("USE `$main`");
    if ($d->query('SELECT marker FROM fixture_marker')->fetchColumn()!=='app-credit-isolated-test') throw new RuntimeException('Missing fixture marker');
    return $d;
}
if (($argv[1]??'')==='--race') {
    if (getenv('LZ_APP_CREDIT_SQL_TESTS')!=='1') exit(2);
    try {
        $d=fixtureConnection($argv[2],$argv[3]);
        lz_app_credit_apply($d,$argv[3],(int)$argv[4],1,707,1980,10000,str_repeat($argv[5],32));
        echo 'applied';
    } catch (LzAppCreditError) { echo 'blocked'; }
    catch (Throwable) { echo 'error';exit(1); }
    exit;
}
if (($argv[1]??'')==='--legacy') {
    if (getenv('LZ_APP_CREDIT_SQL_TESTS')!=='1') exit(2);
    $GLOBALS['app_credit_fixture_db']=fixtureConnection($argv[2],$argv[3]);
    session_start();$t=str_repeat('a',64);
    $_SESSION=['id'=>'1','token_0102'=>'A12345','app_credit_csrf'=>$t];
    $_SERVER['REQUEST_METHOD']='POST';
    $_POST=['id'=>$argv[4],'cliente'=>'707','app_credit_csrf'=>$t,'pago'=>$argv[5]==='pay'?'Sim':'Não',
        'forma_pgto'=>'PIX','subtotal'=>'999,00','valor'=>'999,00','mao_obra'=>'999,00','val_entrada'=>'999,00',
        'desconto'=>'999','tipo_desconto'=>'%','frete'=>'999','vall'=>'999','modelo'=>'0','tecnico'=>'0','obs'=>'Synthetic saved observation'];
    // Execute the actual legacy source, replacing ONLY connection/bootstrap in memory.
    // __DIR__-based legacy bootstraps must never escape to a live connection in a fixture.
    $legacyRoot=getenv('LZ_ASSISTANCE_ROOT') ?: dirname(__DIR__,2);
    $source=file_get_contents($legacyRoot.'/painel/paginas/os/'.($argv[5]==='preview'?'totalizar.php':'salvar.php'));
    if ($argv[5]==='preview') {
        $start=strpos($source,'// bootstrap conexão');$end=strpos($source,'$data_atual =');
        if ($start===false || $end===false || $end<=$start) throw new RuntimeException('Unknown preview bootstrap');
        $source=substr_replace($source,'$pdo=$GLOBALS["app_credit_fixture_db"];' . "\n",$start,$end-$start);
    } else {
        $source=str_replace('require_once("../../../conexao.php");','$pdo=$GLOBALS["app_credit_fixture_db"];',$source,$count);
        if ($count!==1) throw new RuntimeException('Unknown save bootstrap');
    }
    $source=str_replace("require_once dirname(__DIR__,2).'/app-credit.php';",'require_once '.var_export(dirname(__DIR__).'/app-credit.php',true).';',$source,$count);
    if ($count!==1 || str_contains($source,'conexao.php')) throw new RuntimeException('Unisolated legacy fixture');
    eval('?>'.$source);
    exit;
}
foreach (['9.90'=>990,'19.80'=>1980,'0.01'=>1,'0'=>0] as $s=>$v) check(lz_app_credit_cents((string)$s)===$v,'exact cents');
foreach (['-1','1e3','9,90','NaN','1000000.00'] as $v) rejected(fn()=>lz_app_credit_cents($v),'reject invalid money');
check(lz_app_credit_decimal(990)==='9.90','format cents');
$base=['total_produtos'=>'100.00','total_servicos'=>'60.00','mao_obra'=>'20.00','vall'=>'10.00','frete'=>'15.00','val_entrada'=>'5.00','subtotal'=>'170.00'];
check(lz_app_credit_cap($base,10000,6000)===6000,'global discount consumes service first');
check(lz_app_credit_cap(array_replace($base,['subtotal'=>'50.00']),10000,6000)===0,'cannot consume products/freight');
rejected(fn()=>lz_app_credit_cap($base,10000,5900),'stale items');
rejected(fn()=>lz_app_credit_cap(array_replace($base,['subtotal'=>'999.00']),10000,6000),'invalid saved total');
check(!lz_app_credit_open(['status'=>'Finalizada','pago'=>'Não']),'closed status');
check(!lz_app_credit_open(['status'=>'Aberta','pago'=>'Sim']),'paid note');
check(lz_app_credit_open(['status'=>'Em Bancada','pago'=>'Não']),'open service');
$token=str_repeat('a',64);$session=['app_credit_csrf'=>$token];$server=['REQUEST_METHOD'=>'POST'];
lz_app_credit_csrf($session,$server,$token);check(true,'csrf match');
rejected(fn()=>lz_app_credit_csrf($session,$server,str_repeat('b',64)),'csrf mismatch');
rejected(fn()=>lz_app_credit_csrf($session,['REQUEST_METHOD'=>'GET'],$token),'get forbidden');
rejected(fn()=>lz_app_credit_csrf($session,$server+['HTTP_SEC_FETCH_SITE'=>'cross-site'],$token),'cross site forbidden');
if (getenv('LZ_APP_CREDIT_SQL_TESTS')!=='1') { echo "$checks unit checks passed; SQL tests opt-in.\n";exit; }

$root='lz_credit_test_'.bin2hex(random_bytes(6));$main=$root.'_main';$cb=$root.'_cb';$created=[];
try {
    [$d]=lz_app_credit_writer();
    foreach ([$main,$cb] as $schema) { $d->exec("CREATE DATABASE `$schema` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");$created[]=$schema; }
    $d->exec("USE `$main`");
    $d->exec("CREATE TABLE fixture_marker(marker VARCHAR(40) PRIMARY KEY) ENGINE=InnoDB;INSERT INTO fixture_marker VALUES('app-credit-isolated-test')");
    $d->exec("CREATE TABLE os(id INT PRIMARY KEY,cliente INT,cliente_id INT,valor DECIMAL(8,2),desconto INT DEFAULT 0,tipo_desconto VARCHAR(20) DEFAULT 'Valor',subtotal DECIMAL(8,2),total_produtos DECIMAL(8,2) DEFAULT 0,total_servicos DECIMAL(8,2) DEFAULT 0,frete DECIMAL(8,2) DEFAULT 0,mao_obra DECIMAL(8,2) DEFAULT 0,val_entrada DECIMAL(8,2) DEFAULT 0,vall DECIMAL(8,2) DEFAULT 0,orcamento INT DEFAULT 0,status VARCHAR(20) DEFAULT 'Aberta',pago VARCHAR(5) DEFAULT 'Não',obs VARCHAR(255)) ENGINE=InnoDB");
    $d->exec("CREATE TABLE servicos_orc(id INT AUTO_INCREMENT PRIMARY KEY,os INT,servico INT DEFAULT 1,orcamento INT DEFAULT 0,cliente INT,quantidade INT DEFAULT 1,valor DECIMAL(8,2),total DECIMAL(8,2),subtotal DECIMAL(8,2)) ENGINE=InnoDB");
    $d->exec("CREATE TABLE produtos_orc(id INT AUTO_INCREMENT PRIMARY KEY,os INT,produto INT DEFAULT 1,orcamento INT DEFAULT 0,quantidade INT DEFAULT 1,valor DECIMAL(8,2),total DECIMAL(8,2)) ENGINE=InnoDB");
    $d->exec("CREATE TABLE receber(id INT AUTO_INCREMENT PRIMARY KEY,id_ref INT,referencia VARCHAR(20),descricao VARCHAR(80),valor DECIMAL(8,2),pago VARCHAR(5)) ENGINE=InnoDB");
    $d->exec("ALTER TABLE os ADD COLUMN data DATE,ADD COLUMN data_entrega DATE,ADD COLUMN data_pagar DATE,ADD COLUMN previsao_de_pagar DATE,ADD COLUMN funcionario INT,ADD COLUMN tecnico INT,ADD COLUMN equipamento VARCHAR(255),ADD COLUMN marca VARCHAR(255),ADD COLUMN modelo VARCHAR(255),ADD COLUMN acessorios VARCHAR(255),ADD COLUMN condicoes VARCHAR(255),ADD COLUMN serie VARCHAR(255),ADD COLUMN rastreio VARCHAR(255),ADD COLUMN laudo VARCHAR(255),ADD COLUMN defeito VARCHAR(255),ADD COLUMN dias_garantia VARCHAR(50),ADD COLUMN senha_ap VARCHAR(255),ADD COLUMN cpfnt VARCHAR(255),ADD COLUMN cpfnt2 VARCHAR(255),ADD COLUMN forma_pgto VARCHAR(20)");
    $d->exec('ALTER TABLE servicos_orc ADD COLUMN funcionario INT DEFAULT 1,ADD COLUMN data DATE,ADD COLUMN tecnico INT;ALTER TABLE produtos_orc ADD COLUMN funcionario INT DEFAULT 1');
    $d->exec('ALTER TABLE receber ADD COLUMN data_venc DATE,ADD COLUMN data_lanc DATE,ADD COLUMN data_pgto DATE,ADD COLUMN usuario_lanc INT,ADD COLUMN usuario_pgto INT,ADD COLUMN arquivo VARCHAR(100),ADD COLUMN cliente INT,ADD COLUMN hora TIME,ADD COLUMN saida VARCHAR(20),ADD COLUMN frequencia INT');
    $d->exec("CREATE TABLE `$cb`.lz_app_referral_credits(id INT AUTO_INCREMENT PRIMARY KEY,beneficiary_id INT,amount_cents INT,usage_restriction VARCHAR(24)) ENGINE=InnoDB");
    $d->exec("CREATE TABLE usuarios(id INT PRIMARY KEY,nivel VARCHAR(30),ativo VARCHAR(5)) ENGINE=InnoDB;CREATE TABLE acessos(id INT PRIMARY KEY,chave VARCHAR(30)) ENGINE=InnoDB;CREATE TABLE usuarios_permissoes(usuario INT,permissao INT) ENGINE=InnoDB");
    $d->exec("INSERT INTO usuarios VALUES(1,'Administrador','Sim'),(2,'Atendente','Sim'),(3,'Cliente','Sim'),(4,'Administrador','Não');INSERT INTO acessos VALUES(1,'os'),(2,'receber');INSERT INTO usuarios_permissoes VALUES(2,1)");
    lz_app_credit_schema($d,$cb);lz_app_credit_install_triggers($d,$cb);lz_app_credit_install_triggers($d,$cb);check(true,'migration repeat preserves protections');
    $d->exec("UPDATE `$cb`.lz_app_referral_redemption_policy SET enabled=1 WHERE id=1");
    $s=['id'=>'1','token_0102'=>'A12345'];check(lz_app_credit_authorize($d,$s,[])===1,'active admin');
    foreach ([2,3,4,999] as $id) rejected(fn()=>lz_app_credit_authorize($d,array_replace($s,['id'=>(string)$id]),[]),'missing financial permission');
    $d->exec('INSERT INTO usuarios_permissoes VALUES(2,2)');check(lz_app_credit_authorize($d,array_replace($s,['id'=>'2']),[])===2,'office AND receivables');
    foreach ([10,11,12,13,14,15,16,17,18,19,20] as $id) {
        $d->prepare('INSERT INTO os(id,cliente,valor,subtotal,total_servicos) VALUES(?,707,100,100,100)')->execute([$id]);
        $d->prepare('INSERT INTO servicos_orc(os,cliente,valor,total) VALUES(?,707,100,100)')->execute([$id]);
    }
    $d->exec("INSERT INTO `$cb`.lz_app_referral_credits(beneficiary_id,amount_cents,usage_restriction) VALUES(707,990,'services_only'),(707,990,'services_only'),(808,990,'services_only')");
    $request=str_repeat('a',32);
    rejected(fn()=>lz_app_credit_apply($d,$cb,10,1,808,990,10000,$request),'another client wallet');
    rejected(fn()=>lz_app_credit_apply($d,$cb,10,1,707,990,9000,$request),'stale quote');
    rejected(fn()=>lz_app_credit_apply($d,$cb,10,1,707,1981,10000,$request),'insufficient balance');
    $d->exec("UPDATE os SET status='Finalizada' WHERE id=11");rejected(fn()=>lz_app_credit_apply($d,$cb,11,1,707,990,10000,$request),'no closed redemption');
    $d->exec("UPDATE os SET pago='Sim' WHERE id=12");rejected(fn()=>lz_app_credit_apply($d,$cb,12,1,707,990,10000,$request),'no paid redemption');
    $d->exec("INSERT INTO receber(id_ref,referencia,descricao,valor,pago) VALUES(13,'Serviço','Nova OS',100,'Não')");
    rejected(fn()=>lz_app_credit_apply($d,$cb,13,1,707,990,10000,$request),'prior invoice');
    $d->exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON lz_app_credit_os FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'");
    rejected(fn()=>lz_app_credit_apply($d,$cb,10,1,707,990,10000,$request),'rollback across schemas');
    check(lz_app_credit_balance($d,$cb,707)['available_cents']===1980 && (string)$d->query('SELECT subtotal FROM os WHERE id=10')->fetchColumn()==='100.00','no partial debit/note after failure');
    $d->exec('DROP TRIGGER fixture_failure');
    $result=lz_app_credit_apply($d,$cb,10,1,707,990,10000,$request);
    check($result['state']==='active','apply');check(lz_app_credit_balance($d,$cb,707)['available_cents']===990,'net available');
    check((string)$d->query('SELECT subtotal FROM os WHERE id=10')->fetchColumn()==='90.10','exact note reduction');
    foreach (['preview','save'] as $mode) {
        $proc=proc_open([PHP_BINARY,__FILE__,'--legacy',$main,$cb,'10',$mode],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
        $output=stream_get_contents($pipes[1]);fclose($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[2]);
        check(proc_close($proc)===0 && $err==='' && str_contains($output,$mode==='preview'?'100,00-90,10':'Salvo com Sucesso-10'),'actual legacy '.$mode.' with tampered posted money: '.$output.' '.$err);
        check((string)$d->query('SELECT subtotal FROM os WHERE id=10')->fetchColumn()==='90.10','legacy snapshot survives '.$mode);
    }
    check(lz_app_credit_apply($d,$cb,10,1,707,990,10000,$request)['replayed'],'duplicate request no new debit');
    rejected(fn()=>lz_app_credit_apply($d,$cb,10,1,707,990,9010,str_repeat('b',32)),'other request on same OS');
    rejected(fn()=>lz_app_credit_apply($d,$cb,14,1,707,990,10000,$request),'request cannot move notes');
    foreach (["UPDATE os SET subtotal=100 WHERE id=10","UPDATE os SET cliente=808 WHERE id=10","DELETE FROM os WHERE id=10","UPDATE servicos_orc SET total=200 WHERE os=10","DELETE FROM servicos_orc WHERE os=10","INSERT INTO servicos_orc(os,cliente,valor,total) VALUES(10,707,1,1)","INSERT INTO produtos_orc(os,valor,total) VALUES(10,1,1)","UPDATE servicos_orc SET os=10 WHERE os=14"] as $sql) rejected(fn()=>$d->exec($sql),'legacy write protected');
    $d->exec("UPDATE os SET obs='Synthetic technical observation' WHERE id=10;UPDATE servicos_orc SET subtotal=90.10 WHERE os=10");check(true,'technical fields remain editable');
    rejected(fn()=>$d->exec("INSERT INTO receber(id_ref,referencia,descricao,valor,pago) VALUES(10,'Serviço','Nova OS',100,'Sim')"),'old total cannot be billed');
    rejected(fn()=>$d->exec("INSERT INTO receber(id_ref,referencia,descricao,valor,pago) VALUES(10,'Serviço',NULL,90.10,'Sim')"),'null charge description cannot bypass checks');
    rejected(fn()=>$d->exec("DELETE FROM `$cb`.lz_app_referral_redemptions"),'audit cannot be deleted');
    rejected(fn()=>$d->exec("UPDATE `$cb`.lz_app_referral_redemptions SET amount_cents=500"),'audit cannot be rewritten');
    lz_app_credit_undo($d,$cb,10,1,707,$request,'Corrigir itens antes de finalizar');
    check(lz_app_credit_balance($d,$cb,707)['available_cents']===1980,'credit returned only to service wallet');
    check((string)$d->query('SELECT subtotal FROM os WHERE id=10')->fetchColumn()==='100.00','note restored');
    check(lz_app_credit_undo($d,$cb,10,1,707,$request,'Repetição da solicitação')['replayed'],'duplicate reversal');
    check(lz_app_credit_apply($d,$cb,10,1,707,990,10000,$request)['state']==='reversed','old replay cannot apply after reversal');
    // Two concurrent OS compete for the same R$ 19.80. Only one can consume it.
    $jobs=[];
    foreach ([[15,'c'],[16,'d']] as [$id,$key]) {
        $proc=proc_open([PHP_BINARY,__FILE__,'--race',$main,$cb,(string)$id,$key],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
        $jobs[]=[$proc,$pipes];
    }
    $out=[];foreach ($jobs as [$proc,$pipes]) { $out[]=stream_get_contents($pipes[1]);fclose($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[2]);check(proc_close($proc)===0 && $err==='','concurrency child'); }
    sort($out);check($out===['applied','blocked'],'one wallet cannot overspend across notes');
    check(lz_app_credit_balance($d,$cb,707)['available_cents']===0,'concurrent balance never negative');
    $q=$d->query('SELECT os_id,redemption_id FROM lz_app_credit_os');$winner=$q->fetch();
    $d->prepare("UPDATE os SET status='Finalizada' WHERE id=?")->execute([$winner['os_id']]);
    $d->prepare("UPDATE os SET status='Aberta' WHERE id=?")->execute([$winner['os_id']]);
    rejected(fn()=>lz_app_credit_undo($d,$cb,(int)$winner['os_id'],1,707,$winner['redemption_id'],'Reabrir não libera estorno'),'sealed note stays sealed after reopening');
    $d->prepare("UPDATE os SET pago='Sim' WHERE id=?")->execute([$winner['os_id']]);
    $d->prepare("INSERT INTO receber(id_ref,referencia,descricao,valor,pago) VALUES(?,'Serviço','Nova OS',80.20,'Sim')")->execute([$winner['os_id']]);
    rejected(fn()=>$d->exec('DELETE FROM receber WHERE valor=80.20'),'settled receipt protected');
    check(lz_app_credit_balance($d,$cb,808)['available_cents']===990,'unrelated wallet untouched');
    // Actual legacy save of an active note must book only the net due, once, not the posted gross total.
    $d->exec("INSERT INTO `$cb`.lz_app_referral_credits(beneficiary_id,amount_cents,usage_restriction) VALUES(707,990,'services_only')");
    lz_app_credit_apply($d,$cb,17,1,707,990,10000,str_repeat('e',32));
    foreach ([1,2] as $attempt) {
        $proc=proc_open([PHP_BINARY,__FILE__,'--legacy',$main,$cb,'17','pay'],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
        $output=stream_get_contents($pipes[1]);fclose($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[2]);
        check(proc_close($proc)===0 && $err==='' && str_contains($output,'Salvo com Sucesso-17'),'legacy net payment attempt '.$attempt);
    }
    check((int)$d->query('SELECT COUNT(*) FROM receber WHERE id_ref=17')->fetchColumn()===1,'one receipt despite payment retry');
    check((string)$d->query('SELECT valor FROM receber WHERE id_ref=17')->fetchColumn()==='90.10','only net cash received');
    echo "$checks checks passed, including isolated MySQL transactions, triggers, reversal and concurrent spending.\n";
} finally {
    // Only these newly created, random, empty-of-customer-data fixtures are removed. Never a production schema.
    if (isset($d)) {
        if ($d->inTransaction()) $d->rollBack();
        foreach (array_reverse($created) as $schema) {
            if (!preg_match('/^lz_credit_test_[a-f0-9]{12}_(main|cb)$/D',$schema) || !in_array($schema,[$main,$cb],true)) throw new LogicException('Unsafe cleanup target');
            $d->exec("DROP DATABASE `$schema`");
        }
    }
}

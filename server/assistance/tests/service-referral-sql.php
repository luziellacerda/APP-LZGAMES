<?php
declare(strict_types=1);
// Explicitly opt-in. All writes are to connection-local TEMPORARY fixture tables.
if(getenv('LZ_REFERRAL_PHP_FIXTURES')!=='1'){echo "SKIP: temporary MySQL fixtures not enabled.\n";exit(0);}
require dirname(__DIR__).'/service-referral.php';
$checks=0;
function check_fixture(bool $condition): void {global $checks;$checks++;if(!$condition)throw new RuntimeException('fixture_assertion_failed');}
try {
    $pdo=new PDO((string)getenv('LZ_REFERRAL_FIXTURE_DSN'),(string)getenv('LZ_REFERRAL_FIXTURE_USER'),(string)getenv('LZ_REFERRAL_FIXTURE_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
    $pdo->exec('CREATE TEMPORARY TABLE lz_service_referral_policy(id INT PRIMARY KEY,enabled INT,min_os_id INT,cutoff_set_at DATETIME(6),fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    $pdo->exec('CREATE TEMPORARY TABLE os(id INT PRIMARY KEY,cliente INT,tecnico INT,funcionario INT,status VARCHAR(20),subtotal DECIMAL(8,2),val_entrada DECIMAL(8,2),fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    $pdo->exec('CREATE TEMPORARY TABLE lz_service_referral_outbox(id INT AUTO_INCREMENT PRIMARY KEY,os_id INT,indicated_id INT,actor_id INT,base_cents BIGINT,outcome VARCHAR(64),occurred_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),processed_at DATETIME(6) NULL,fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    $pdo->exec('CREATE TEMPORARY TABLE usuarios(id INT PRIMARY KEY,nivel VARCHAR(40),ativo VARCHAR(10),fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    $pdo->exec('CREATE TEMPORARY TABLE acessos(id INT PRIMARY KEY,chave VARCHAR(30),fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    $pdo->exec('CREATE TEMPORARY TABLE usuarios_permissoes(usuario INT,permissao INT,fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    foreach(['lz_service_referral_policy','os','lz_service_referral_outbox','usuarios','acessos','usuarios_permissoes'] as $table)$pdo->query('SELECT fixture_marker FROM '.$table.' LIMIT 0');
    $pdo->exec("INSERT INTO lz_service_referral_policy(id,enabled,min_os_id,cutoff_set_at) VALUES(1,1,101,'2026-09-05 10:00:00')");
    $pdo->exec("INSERT INTO os(id,cliente,tecnico,status,subtotal,val_entrada) VALUES(101,202,402,'Iniciada',73.45,50.00)");
    $pdo->exec("INSERT INTO usuarios(id,nivel,ativo) VALUES(401,'Administrador','Sim'),(402,'Tecnico','Sim')");
    $pdo->exec("INSERT INTO acessos(id,chave) VALUES(1,'os_tecnico')");
    $pdo->exec('INSERT INTO usuarios_permissoes(usuario,permissao) VALUES(402,1)');
    $session=['id'=>'401','token_0102'=>'A12345'];
    $server=['HTTP_ORIGIN'=>'https://sistema2026.lzgames.com.br','HTTP_HOST'=>'sistema2026.lzgames.com.br'];
    check_fixture(lz_referral_authorize($pdo,$session,$server,'main',101)===401);
    $session['id']='402';check_fixture(lz_referral_authorize($pdo,$session,$server,'technician',101)===402);
    lz_referral_change_status($pdo,101,'Finalizada',402);
    $event=$pdo->query('SELECT * FROM lz_service_referral_outbox')->fetch(PDO::FETCH_ASSOC);
    check_fixture((int)$event['base_cents']===12345);
    check_fixture((int)$event['indicated_id']===202&&(int)$event['actor_id']===402);
    check_fixture($event['processed_at']===null&&$event['outcome']===null);
    lz_referral_change_status($pdo,101,'Finalizada',402);
    check_fixture((int)$pdo->query('SELECT COUNT(*) FROM lz_service_referral_outbox')->fetchColumn()===1);
    lz_referral_change_status($pdo,101,'Entregue',401);
    lz_referral_change_status($pdo,101,'Finalizada',401);
    check_fixture((int)$pdo->query('SELECT COUNT(*) FROM lz_service_referral_outbox')->fetchColumn()===1);
    lz_referral_change_status($pdo,101,'Iniciada',401);
    lz_referral_change_status($pdo,101,'Finalizada',401);
    check_fixture((int)$pdo->query('SELECT COUNT(*) FROM lz_service_referral_outbox')->fetchColumn()===2);
    $pdo->exec("INSERT INTO os(id,cliente,tecnico,status,subtotal,val_entrada) VALUES(102,202,402,'Iniciada',0,0)");
    lz_referral_change_status($pdo,102,'Finalizada',401);
    check_fixture($pdo->query('SELECT outcome FROM lz_service_referral_outbox WHERE os_id=102')->fetchColumn()==='invalid_note_total');
    $pdo->exec("INSERT INTO os(id,cliente,tecnico,status,subtotal,val_entrada) VALUES(100,202,402,'Iniciada',100,0)");
    lz_referral_change_status($pdo,100,'Finalizada',401);
    check_fixture((int)$pdo->query('SELECT COUNT(*) FROM lz_service_referral_outbox WHERE os_id=100')->fetchColumn()===0);
    $pdo=null; // Closing drops only these connection-local temporary fixtures.
    echo "PASS: $checks PDO/MySQL fixture checks; no real OS, customer, credit or WhatsApp.\n";
}catch(Throwable $error){$pdo=null;fwrite(STDERR,"FAIL: isolated PHP SQL fixtures.\n");exit(1);}

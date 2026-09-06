<?php
declare(strict_types=1);
require_once __DIR__.'/../booking-customer.php';
$checks=0;
function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
$own=['id'=>1,'nome'=>'Synthetic','telefone'=>'+55 (82) 98700-0501','cpf'=>'529.982.247-25'];
$other=['id'=>2,'nome'=>'Synthetic other','telefone'=>'+5582987000502','cpf'=>'52998224725'];
$result=agenda_customer_decision([$own,$other],'5582987000501','52998224725');
check($result['row']['id']===1&&!$result['setCpf'],'Masked CPF keeps original record without rewriting into a duplicate key');
foreach(['82987000501','(82) 98700-0501','+55 82 98700-0501'] as $alias)check(agenda_customer_decision([$own],$alias,'52998224725')['row']['id']===1,'Full normalized phone reuses customer');
check(agenda_customer_decision([$own],'+5582987000501',null)['row']['id']===1,'Optional CPF does not replace an existing document');
foreach([
    [[$own],'+5582987000503','52998224725','cpf_em_uso'],
    [[$own],'+5582987000501','11144477735','cpf_divergente'],
    [[$own,array_replace($own,['id'=>3])],'+5582987000501','52998224725','cadastro_ambiguo']
] as [$rows,$phone,$cpf,$reason]){
    try{agenda_customer_decision($rows,$phone,$cpf);check(false,'Unsafe reassignment');}catch(AgendaCustomerConflict $e){check($e->getMessage()===$reason,'Conflict is explicit and safe');}
}
if(getenv('LZ_AGENDA_SQL_FIXTURES')==='1'){
    require_once '/home/lz-servidor/apps/lzgames-sorteios/lib/app-service-source.php';
    $db=app_service_source_mysql(app_service_source_env(),'agenda');
    $db->rollBack();$db->exec('SET SESSION TRANSACTION READ WRITE');
    // Only the exact session's TEMPORARY usuarios is ever written. Never run the public booking endpoint here.
    $db->exec('CREATE TEMPORARY TABLE usuarios(id INT AUTO_INCREMENT PRIMARY KEY,nome VARCHAR(100),telefone VARCHAR(20) UNIQUE,cpf VARCHAR(20) UNIQUE,fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    $db->query('SELECT fixture_marker FROM usuarios LIMIT 0');
    $db->prepare('INSERT INTO usuarios(nome,telefone,cpf) VALUES(?,?,?),(?,?,?)')->execute(['Synthetic','+5582987000501','529.982.247-25','Synthetic other','+5582987000502','52998224725']);
    $db->beginTransaction();$id=agenda_booking_customer($db,'Synthetic','5582987000501','52998224725');
    check($id===1,'Real SQL uses original customer ID and does not violate CPF uniqueness');
    check($db->query('SELECT cpf FROM usuarios WHERE id=1')->fetchColumn()==='529.982.247-25','Original masked CPF remains unchanged');
    check((int)$db->query('SELECT COUNT(*) FROM usuarios')->fetchColumn()===2,'No duplicate customer');
    $db->rollBack();$db=null;
}
echo "Booking customer: $checks checks passed; no real appointments or WhatsApp sends.\n";

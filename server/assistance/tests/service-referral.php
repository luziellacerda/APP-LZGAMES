<?php
declare(strict_types=1);
require dirname(__DIR__).'/service-referral.php';
$checks=0;
function check($condition):void{global $checks;$checks++;if(!$condition)throw new RuntimeException('Fixture check failed '.$checks);}
function rejects(callable $fn):void{try{$fn();}catch(Throwable){check(true);return;}check(false);}
class FixtureStatement extends PDOStatement{
    private array $result=[];
    public function __construct(private FixturePDO $db,private string $sql){}
    public function execute(?array $params=null):bool{$this->result=$this->db->run($this->sql,$params??[]);return true;}
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0):mixed{return $this->result[0]??false;}
    public function fetchColumn(int $column=0):mixed{return isset($this->result[0])?(array_values($this->result[0])[$column]??false):false;}
}
class FixturePDO extends PDO{
    public array $note=['id'=>101,'cliente'=>202,'tecnico'=>404,'status'=>'Iniciada','subtotal'=>'73.45','val_entrada'=>'50.00'];
    public array $user=['id'=>404,'nivel'=>'Administrador','ativo'=>'Sim'];
    public array $events=[];public bool $enabled=true;public int $minimum=1;public bool $permission=true;public bool $failOutbox=false;
    private bool $transaction=false;private array $snapshot=[];
    public function __construct(){}
    public function beginTransaction():bool{$this->snapshot=[$this->note,$this->events];$this->transaction=true;return true;}
    public function inTransaction():bool{return $this->transaction;}
    public function commit():bool{$this->transaction=false;return true;}
    public function rollBack():bool{[$this->note,$this->events]=$this->snapshot;$this->transaction=false;return true;}
    public function prepare(string $query,array $options=[]):PDOStatement|false{return new FixtureStatement($this,$query);}
    public function query(string $query,?int $fetchMode=null,mixed ...$fetchModeArgs):PDOStatement|false{$s=$this->prepare($query);$s->execute();return $s;}
    public function run(string $sql,array $args):array{
        if(str_starts_with($sql,'SELECT enabled'))return [['enabled'=>$this->enabled?1:0,'min_os_id'=>$this->minimum,'cutoff_set_at'=>'2026-09-05 10:00:00']];
        if(str_starts_with($sql,'SELECT id,cliente'))return [$this->note];
        if(str_starts_with($sql,'SELECT id,nivel'))return [$this->user];
        if(str_starts_with($sql,'SELECT 1 FROM usuarios_permissoes'))return $this->permission?[['granted'=>1]]:[];
        if(str_starts_with($sql,'SELECT tecnico'))return [['tecnico'=>$this->note['tecnico']]];
        if(str_starts_with($sql,'UPDATE os')){$this->note['status']=$args[0];$this->note['funcionario']=$args[1];return [];}
        if(str_starts_with($sql,'INSERT INTO lz_service_referral_outbox')){if($this->failOutbox)throw new RuntimeException('fixture outbox failure');$this->events[]=$args;return [];}
        throw new RuntimeException('Unexpected fixture SQL');
    }
}
$session=['id'=>404,'token_0102'=>'A12345'];
$server=['HTTP_HOST'=>'sistema2026.lzgames.com.br','HTTP_ORIGIN'=>'https://sistema2026.lzgames.com.br','HTTP_SEC_FETCH_SITE'=>'same-origin'];
check(lz_referral_note_total(['subtotal'=>'73.45','val_entrada'=>'50.00'])===12345);
check(lz_referral_note_total(['subtotal'=>'123.45','val_entrada'=>null])===12345);
check(lz_referral_note_total(['subtotal'=>'-10.00','val_entrada'=>'110.00'])===10000);
foreach([null,'','1.234','12,45',1.23,'NaN','1e5'] as $value)rejects(fn()=>lz_referral_money_cents($value));
foreach(['https://evil.invalid','null','https://sistema2026.lzgames.com.br.evil.invalid','https://user@evil.invalid'] as $origin)check(!lz_referral_origin_allowed(array_merge($server,['HTTP_ORIGIN'=>$origin])));
check(!lz_referral_origin_allowed(array_merge($server,['HTTP_SEC_FETCH_SITE'=>'cross-site'])));
check(lz_referral_origin_allowed($server));
check(lz_referral_origin_allowed(['HTTP_HOST'=>'app.lzgames.com.br','HTTP_ORIGIN'=>'https://app.lzgames.com.br']));
$db=new FixturePDO();check(lz_referral_authorize($db,$session,$server,'main',101)===404);
foreach([[],['id'=>0],['id'=>404,'token_0102'=>'wrong']] as $s)rejects(fn()=>lz_referral_authorize($db,$s,$server,'main',101));
$db->user['ativo']='Não';rejects(fn()=>lz_referral_authorize($db,$session,$server,'main',101));$db->user['ativo']='Sim';
$db->user['nivel']='Cliente';rejects(fn()=>lz_referral_authorize($db,$session,$server,'main',101));
$db->user['nivel']='Técnico';$db->permission=false;rejects(fn()=>lz_referral_authorize($db,$session,$server,'technician',101));
$db->permission=true;check(lz_referral_authorize($db,$session,$server,'technician',101)===404);
$db->note['tecnico']=999;rejects(fn()=>lz_referral_authorize($db,$session,$server,'technician',101));
$db=new FixturePDO();lz_referral_change_status($db,101,'Finalizada',404);
check($db->note['status']==='Finalizada');check(count($db->events)===1);check($db->events[0][3]===12345);check($db->events[0][1]===202);
lz_referral_change_status($db,101,'Finalizada',404);check(count($db->events)===1);
lz_referral_change_status($db,101,'Entregue',404);check(count($db->events)===1);
lz_referral_change_status($db,101,'Finalizada',404);check(count($db->events)===1);
lz_referral_change_status($db,101,'Iniciada',404);lz_referral_change_status($db,101,'Finalizada',404);
check(count($db->events)===2); // Immutable second event. Cashback unique(OS/referral) still permits one credit only.
$db=new FixturePDO();$db->enabled=false;lz_referral_change_status($db,101,'Finalizada',404);check(count($db->events)===0);check($db->note['status']==='Finalizada');
$db=new FixturePDO();$db->minimum=102;lz_referral_change_status($db,101,'Finalizada',404);check(count($db->events)===0);check($db->note['status']==='Finalizada');
$db=new FixturePDO();$db->minimum=101;lz_referral_change_status($db,101,'Finalizada',404);check(count($db->events)===1);
$db=new FixturePDO();$db->failOutbox=true;rejects(fn()=>lz_referral_change_status($db,101,'Finalizada',404));check($db->note['status']==='Iniciada');check(count($db->events)===0);
$db=new FixturePDO();$db->note['subtotal']='0.00';$db->note['val_entrada']='0.00';lz_referral_change_status($db,101,'Finalizada',404);check($db->events[0][4]==='invalid_note_total');
echo "PASS: $checks isolated PHP checks; no database, status mutation or WhatsApp.\n";

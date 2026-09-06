<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'||getenv('LZ_MARKETPLACE_SQL_FIXTURES')!=='1'||!preg_match('/^lzmk_fixture_[a-f0-9]{12}_$/D',$argv[1]??''))exit(2);
require __DIR__.'/../admin/marketplace-admin.php';
final class MarketplaceFixturePDO extends PDO {
    public function __construct(private string $fixturePrefix){
        $pick=static function(array $keys): string {foreach($keys as $key)if(getenv($key)!==false&&getenv($key)!=='')return(string)getenv($key);return '';};
        $host=$pick(['DB5_HOST','DB_HOST','DB1_HOST']);$user=$pick(['DB5_USER','DB_USER','DB1_USER']);$pass=$pick(['DB5_PASS','DB5_PASSWORD','DB_PASS','DB_PASSWORD','DB1_PASS','DB1_PASSWORD']);$port=$pick(['DB5_PORT'])?:'3306';
        parent::__construct("mysql:host=$host;port=$port;dbname=u214656250_appgamesusados;charset=utf8mb4",$user,$pass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    }
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        $pattern='/\b(marketplace_profiles|products|product_media|purchase_requests|product_reports|marketplace_audit|marketplace_blocks|marketplace_notices)\b/';
        if(!preg_match($pattern,$query))throw new RuntimeException('SQL outside fixture allowlist');
        return parent::prepare(preg_replace_callback($pattern,fn($m)=>$this->fixturePrefix.$m[0],$query),$options);
    }
}
$db=new MarketplaceFixturePDO($argv[1]);$id=$argv[2];
$version=static fn()=>(string)marketplace_admin_query($db,'SELECT version FROM products WHERE public_id=?',[$id])[0]['version'];
$assert=static function(bool $value):void{if(!$value)throw new RuntimeException('Fixture assertion failed');};
marketplace_admin_moderate($db,$id,'hide','Fixture: suspeita analisada pela moderação.',$version());
$p=marketplace_admin_query($db,'SELECT * FROM products WHERE public_id=?',[$id])[0];$assert($p['moderation_status']==='hidden');
marketplace_admin_moderate($db,$id,'restore','Fixture: anúncio conferido, permitido novamente.',$version());
marketplace_admin_moderate($db,$id,'suspend','Fixture: conta suspensa para conferência.',$version());
$assert((int)marketplace_admin_query($db,'SELECT suspended FROM marketplace_profiles WHERE customer_id=?',[$p['seller_customer_id']])[0]['suspended']===1);
marketplace_admin_moderate($db,$id,'unsuspend','Fixture: cadastro conferido e reativado.',$version());
$assert((int)marketplace_admin_query($db,'SELECT COUNT(*) n FROM marketplace_audit WHERE actor_customer_id=0')[0]['n']===4);
echo "admin fixture passed\n";

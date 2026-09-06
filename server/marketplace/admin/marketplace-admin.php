<?php
declare(strict_types=1);
function marketplace_admin_db(array $env): PDO {
    $pick=static function(array $keys) use($env): string { foreach($keys as $key)if(isset($env[$key])&&trim((string)$env[$key])!=='')return(string)$env[$key];return ''; };
    $host=$pick(['DB5_HOST','DB_HOST','DB1_HOST']);$user=$pick(['DB5_USER','DB_USER','DB1_USER']);$pass=$pick(['DB5_PASS','DB5_PASSWORD','DB_PASS','DB_PASSWORD','DB1_PASS','DB1_PASSWORD']);$port=$pick(['DB5_PORT'])?:'3306';
    if(!preg_match('/^[A-Za-z0-9._:-]+$/D',$host)||!ctype_digit($port)||$user==='')throw new RuntimeException('Configuração indisponível.');
    // Deliberately fixed: this panel never connects to any of the customer's other databases.
    $db=new PDO("mysql:host=$host;port=$port;dbname=u214656250_appgamesusados;charset=utf8mb4",$user,$pass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_TIMEOUT=>5,PDO::ATTR_EMULATE_PREPARES=>false]);
    $db->exec("SET SESSION time_zone='+00:00'");return $db;
}
function marketplace_admin_query(PDO $db,string $sql,array $values=[]): array {$q=$db->prepare($sql);$q->execute($values);return $q->columnCount()?$q->fetchAll():[];}
function marketplace_admin_moderate(PDO $db,string $id,string $action,string $reason,string $version): void {
    if(!preg_match('/^[a-f0-9-]{36}$/D',$id)||!ctype_digit($version)||!in_array($action,['resolve','hide','restore','suspend','unsuspend'],true))throw new InvalidArgumentException('Ação inválida.');
    $reason=trim($reason);if(mb_strlen($reason)<10||mb_strlen($reason)>500)throw new InvalidArgumentException('Informe um motivo de 10 a 500 caracteres.');
    try{
        $db->beginTransaction();
        $rows=marketplace_admin_query($db,'SELECT * FROM products WHERE public_id=? AND deleted_at IS NULL FOR UPDATE',[$id]);$p=$rows[0]??null;
        if(!$p)throw new InvalidArgumentException('Anúncio não encontrado.');
        if((string)$p['version']!==$version)throw new InvalidArgumentException('O anúncio mudou. Atualize antes de decidir.');
        if(in_array($action,['hide','restore'],true))marketplace_admin_query($db,'UPDATE products SET moderation_status=?,moderation_reason=?,version=version+1 WHERE id=?',[$action==='hide'?'hidden':'visible',$reason,$p['id']]);
        if(in_array($action,['suspend','unsuspend'],true)){
            marketplace_admin_query($db,'UPDATE marketplace_profiles SET suspended=? WHERE customer_id=?',[$action==='suspend'?1:0,$p['seller_customer_id']]);
            marketplace_admin_query($db,'UPDATE products SET version=version+1 WHERE seller_customer_id=?',[$p['seller_customer_id']]);
        }
        if(in_array($action,['hide','suspend'],true)){
            $where=$action==='hide'?'product_id=?':'seller_customer_id=?';$target=$action==='hide'?$p['id']:$p['seller_customer_id'];
            $orders=marketplace_admin_query($db,"SELECT * FROM purchase_requests WHERE $where AND status='requested' FOR UPDATE",[$target]);
            foreach($orders as $order){
                marketplace_admin_query($db,"UPDATE purchase_requests SET status='cancelled' WHERE id=?",[$order['id']]);
                marketplace_admin_query($db,"UPDATE products SET status='active',version=version+1 WHERE id=? AND status='reserved'",[$order['product_id']]);
                marketplace_admin_query($db,'INSERT INTO marketplace_notices(customer_id,title,message,order_code) VALUES(?,?,?,?)',[$order['buyer_customer_id'],'Reserva cancelada pela moderação','O anúncio ou vendedor foi retirado da loja. Não realize pagamentos para esta reserva.',$order['public_code']]);
            }
        }
        marketplace_admin_query($db,'UPDATE product_reports SET resolved_at=UTC_TIMESTAMP(6),resolution=? WHERE product_id=? AND resolved_at IS NULL',[$reason,$p['id']]);
        $label=['resolve'=>'Análise concluída','hide'=>'Anúncio retirado','restore'=>'Anúncio restaurado','suspend'=>'Conta de vendas suspensa','unsuspend'=>'Conta de vendas reativada'][$action];
        marketplace_admin_query($db,'INSERT INTO marketplace_notices(customer_id,title,message) VALUES(?,?,?)',[$p['seller_customer_id'],$label,$reason]);
        // Actor 0 is explicitly administrative, never a forged consumer id.
        marketplace_admin_query($db,'INSERT INTO marketplace_audit(actor_customer_id,action,resource_type,resource_id,metadata_json) VALUES(0,?,?,?,?)',['admin_'.$action,'product',$id,json_encode(['realm'=>'sorteios-admin','reason'=>$reason,'version'=>$version],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

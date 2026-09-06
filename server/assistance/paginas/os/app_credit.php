<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once dirname(__DIR__,2).'/app-credit.php';
session_start();
try {
    lz_app_credit_csrf($_SESSION,$_SERVER,$_POST['csrf']??null);
    [$db,$cb]=lz_app_credit_writer();
    try { $actor=lz_app_credit_authorize($db,$_SESSION,$_SERVER); }
    catch (Throwable) { http_response_code(403);throw new LzAppCreditError('Entre no painel com acesso a OS e Contas a Receber.'); }
    session_write_close();
    $id=lz_app_credit_id($_POST['id']??null);$action=$_POST['action']??'';
    if ($action==='quote') {
        $db->beginTransaction();$data=lz_app_credit_quote($db,$cb,$id);$db->commit();
        $data['request_id']=bin2hex(random_bytes(16));
    } elseif ($action==='apply') {
        $amount=lz_app_credit_id($_POST['amount_cents']??null);
        $expected=$_POST['subtotal_cents']??null;
        if (!is_string($expected) || !preg_match('/^[0-9]{1,8}$/D',$expected)) throw new LzAppCreditError('Total inválido. Consulte a nota novamente.');
        $request=$_POST['request_id']??null;
        if (!is_string($request)) throw new LzAppCreditError('Pedido inválido.');
        $data=lz_app_credit_apply($db,$cb,$id,$actor,lz_app_credit_id($_POST['customer_id']??null),$amount,(int)$expected,$request);
    } elseif ($action==='undo') {
        if (!is_string($_POST['request_id']??null) || !is_string($_POST['reason']??null)) throw new LzAppCreditError('Informe o motivo do estorno.');
        $data=lz_app_credit_undo($db,$cb,$id,$actor,lz_app_credit_id($_POST['customer_id']??null),$_POST['request_id'],$_POST['reason']);
    } else throw new LzAppCreditError('Ação inválida.');
    echo json_encode(['ok'=>true,'data'=>$data],JSON_UNESCAPED_UNICODE);
} catch (LzAppCreditError $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    if (http_response_code()<400) http_response_code(409);
    echo json_encode(['ok'=>false,'message'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('App credit operation unavailable: '.get_class($e));
    http_response_code(503);
    echo json_encode(['ok'=>false,'message'=>'Não foi possível confirmar o crédito. Consulte a nota novamente; não repita com outro valor.'],JSON_UNESCAPED_UNICODE);
}

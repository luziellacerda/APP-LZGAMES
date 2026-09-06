<?php
declare(strict_types=1);
// Loaded by the existing admin router. Never accept a consumer JWT as admin.
if (!function_exists('need') || !function_exists('check')) { http_response_code(404); exit; }
need();
header('Cache-Control: private, no-store');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
require_once __DIR__.'/../lib/app-service-source.php';
require_once __DIR__.'/../lib/marketplace-admin.php';
try { $market = marketplace_admin_db(app_service_source_env()); }
catch (Throwable) { http_response_code(503); exit('O painel de vendas está temporariamente indisponível. Tente novamente.'); }
if (isset($_GET['media'])) {
    $file=(string)$_GET['media'];$id=(string)($_GET['product']??'');
    if (!preg_match('/^[a-f0-9-]{36}$/D',$id) || !preg_match('/^[a-f0-9-]{36}(?:-poster)?\.(?:jpg|mp4)$/D',$file)) { http_response_code(404); exit; }
    $media=marketplace_admin_query($market,'SELECT pm.id FROM product_media pm JOIN products p ON p.id=pm.product_id WHERE p.public_id=? AND (pm.storage_name=? OR pm.poster_name=?)',[$id,$file]);
    $root='/home/lz-servidor/.local/share/lzgames-marketplace/media';$full=realpath($root.'/'.$id.'/'.$file);
    if (!$media || !$full || !str_starts_with($full,$root.'/'.$id.'/') || !is_file($full)) { http_response_code(404); exit; }
    header('Content-Type: '.(str_ends_with($file,'.mp4')?'video/mp4':'image/jpeg'));
    header('Content-Length: '.filesize($full));readfile($full);exit;
}
$error='';
if ($_SERVER['REQUEST_METHOD']==='POST') {
    token();
    check();
    try {
        if(($_POST['confirm']??'')!=='yes')throw new InvalidArgumentException('Confirme a decisão antes de aplicar.');
        marketplace_admin_moderate($market,(string)($_POST['product']??''),(string)($_POST['action']??''),(string)($_POST['reason']??''),(string)($_POST['version']??''));
        msg('Ação registrada. O catálogo e os avisos do vendedor foram atualizados.');
        go('/admin/games-usados');
    } catch (InvalidArgumentException $e) { $error=$e->getMessage(); }
    catch (Throwable) { $error='Não foi possível salvar. Atualize e tente novamente.'; }
}
$filter=in_array($_GET['filter']??'',['reported','hidden','all'],true)?$_GET['filter']:'reported';
$search=mb_substr(trim((string)($_GET['q']??'')),0,80);$page=max(1,min(10000,(int)($_GET['page']??1)));
$where="p.deleted_at IS NULL";$values=[];
if ($filter==='reported') $where.=' AND EXISTS(SELECT 1 FROM product_reports r WHERE r.product_id=p.id AND r.resolved_at IS NULL)';
if ($filter==='hidden') $where.=" AND (p.moderation_status='hidden' OR mp.suspended=1)";
if ($search!=='') { $where.=" AND (p.title LIKE ? ESCAPE '=' OR mp.display_name LIKE ? ESCAPE '=')";$like='%'.str_replace(['=','%','_'],['==','=%','=_'],$search).'%';$values=[$like,$like]; }
$rows=marketplace_admin_query($market,"SELECT p.*,mp.display_name,mp.suspended,(SELECT COUNT(*) FROM product_reports r WHERE r.product_id=p.id AND r.resolved_at IS NULL) reports FROM products p JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE $where ORDER BY p.id DESC LIMIT 21 OFFSET ".(($page-1)*20),$values);
$more=count($rows)>20;$rows=array_slice($rows,0,20);
$stats=marketplace_admin_query($market,"SELECT (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) products,(SELECT COUNT(*) FROM product_reports WHERE resolved_at IS NULL) reports,(SELECT COUNT(*) FROM products WHERE moderation_status='hidden') hidden")[0];
head('Games Usados · Moderação','admin');
?><link rel="stylesheet" href="/marketplace-admin.css?v=20260906"><aside><div class="brand"><i>LZ</i><b>GAMES<small>MODERAÇÃO</small></b></div><nav><a href="/admin">← Painel principal</a><a href="/admin/app">Aplicativo e avisos</a><a href="/admin/games-usados">Games Usados</a></nav><a href="/admin/logout">Sair</a></aside><main class="admin-main market-admin"><header><div><h1>Games Usados</h1><p>Denúncias, anúncios e segurança dos clientes.</p></div></header><div class="market-stats"><span>Anúncios <b><?=e($stats['products'])?></b></span><span>Denúncias abertas <b><?=e($stats['reports'])?></b></span><span>Retirados <b><?=e($stats['hidden'])?></b></span></div><?php if($error):?><p role="alert" class="market-error"><?=e($error)?></p><?php endif; $feedback=msg();if($feedback):?><p role="status"><?=e($feedback)?></p><?php endif;?><form method="get" class="market-filter"><label>Exibir<select name="filter"><?php foreach(['reported'=>'Com denúncias','hidden'=>'Retirados / suspensos','all'=>'Todos os anúncios'] as $key=>$label):?><option value="<?=e($key)?>" <?=$filter===$key?'selected':''?>><?=e($label)?></option><?php endforeach;?></select></label><label>Buscar<input name="q" maxlength="80" value="<?=e($search)?>" placeholder="Produto ou vendedor"></label><button>Filtrar</button></form>
<?php if(!$rows):?><section class="market-empty">Nenhum anúncio neste filtro.</section><?php endif;foreach($rows as $row):$medias=marketplace_admin_query($market,'SELECT * FROM product_media WHERE product_id=? ORDER BY position',[$row['id']]);$reports=marketplace_admin_query($market,'SELECT reason,details,created_at,resolved_at,resolution FROM product_reports WHERE product_id=? ORDER BY id DESC LIMIT 30',[$row['id']]);?>
<article class="market-product"><div class="market-product-header"><h2><?=e($row['title'])?></h2><strong>R$ <?=number_format((int)$row['price_cents']/100,2,',','.')?></strong></div><p><?=e($row['display_name'])?> · <?=e($row['city'])?>/<?=e($row['state'])?> · <?=e($row['status'])?> · <?=$row['moderation_status']==='hidden'?'Retirado':'Visível'?><?=$row['suspended']?' · Vendedor suspenso':''?></p><small><?=e($row['public_id'])?></small><p class="market-description"><?=e($row['description'])?></p><div class="market-media"><?php foreach($medias as $m):$url='/admin/games-usados?product='.rawurlencode($row['public_id']).'&media='.rawurlencode($m['storage_name']);if($m['kind']==='image'):?><a href="<?=e($url)?>" target="_blank" rel="noopener"><img loading="lazy" src="<?=e($url)?>" alt="Foto do anúncio"></a><?php else:?><video controls preload="none" muted src="<?=e($url)?>"></video><?php endif;endforeach;?></div>
<?php if($reports):?><details <?=$row['reports']?'open':''?>><summary><?=e($row['reports'])?> denúncias abertas · histórico</summary><?php foreach($reports as $r):?><div class="market-report"><b><?=e($r['reason'])?></b> · <?=e($r['created_at'])?><p><?=e($r['details'])?></p><?php if($r['resolved_at']):?><small>Tratada: <?=e($r['resolution'])?></small><?php endif;?></div><?php endforeach;?></details><?php endif;?>
<form method="post" class="market-action"><input type="hidden" name="csrf" value="<?=e(token())?>"><input type="hidden" name="product" value="<?=e($row['public_id'])?>"><input type="hidden" name="version" value="<?=e($row['version'])?>"><label>Ação<select name="action"><option value="resolve">Encerrar análise sem retirar</option><option value="hide">Retirar anúncio</option><option value="restore">Restaurar anúncio</option><option value="suspend">Suspender vendedor e seus anúncios</option><option value="unsuspend">Reativar conta de vendas</option></select></label><label>Motivo da decisão<textarea name="reason" required minlength="10" maxlength="500" placeholder="Explique a decisão; o vendedor receberá um aviso no app."></textarea></label><label class="market-confirm"><input type="checkbox" name="confirm" value="yes" required> Conferi o anúncio e confirmo a ação selecionada.</label><button>Aplicar decisão</button></form></article>
<?php endforeach;?><nav class="market-pagination"><?php if($page>1):?><a href="?<?=e(http_build_query(['filter'=>$filter,'q'=>$search,'page'=>$page-1]))?>">← Anterior</a><?php endif;?><span>Página <?=$page?></span><?php if($more):?><a href="?<?=e(http_build_query(['filter'=>$filter,'q'=>$search,'page'=>$page+1]))?>">Próxima →</a><?php endif;?></nav><p class="market-note">A análise é humana e precisa ser acompanhada regularmente. Nenhum anúncio é removido automaticamente só por receber denúncias. Pagamento, entrega e disputas financeiras não são processados por este painel.</p></main><?php foot();

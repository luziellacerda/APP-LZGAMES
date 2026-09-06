<?php
declare(strict_types=1);

/** Read-only legacy sources. This file must never load bootstrap files that migrate a database. */
final class AppServiceSourceError extends RuntimeException
{
    public function __construct(public readonly string $phase)
    {
        parent::__construct('Não foi possível confirmar a fonte de serviços ('.$phase.').');
    }
}

/** Full Brazilian number, not a suffix. Only legacy mobile numbers gain a ninth digit. */
function app_service_source_phone(string $phone): string
{
    if ($phone === '' || strlen($phone) > 40 || preg_match('/[^0-9+().\s-]/', $phone)) return '';
    $digits = preg_replace('/\D/', '', $phone) ?? '';
    if (in_array(strlen($digits), [12,13], true) && str_starts_with($digits, '55')) $digits = substr($digits, 2);
    if (!preg_match('/^[1-9][0-9](?:[2-9][0-9]{7}|9[0-9]{8})$/D', $digits)) return '';
    if (strlen($digits) === 10 && preg_match('/^[1-9][0-9][6-9]/', $digits)) $digits = substr($digits,0,2).'9'.substr($digits,2);
    return '55'.$digits;
}

function app_service_source_phone_variants(string $canonical): array
{
    if ($canonical === '' || app_service_source_phone($canonical) !== $canonical) throw new AppServiceSourceError('identidade');
    $local = substr($canonical,2);
    $variants = [$canonical,$local];
    if (strlen($local) === 11 && $local[2] === '9' && preg_match('/^[6-9]$/D',$local[3])) {
        $legacy = substr($local,0,2).substr($local,3);
        array_push($variants,'55'.$legacy,$legacy);
    }
    return array_values(array_unique($variants));
}

function app_service_source_id(mixed $id): string
{
    if ((!is_string($id) && !is_int($id)) || !preg_match('/^[1-9][0-9]{0,18}$/D',(string)$id)) throw new AppServiceSourceError('identidade');
    return (string)$id;
}

function app_service_source_date(string $value): int
{
    if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/D',$value)) throw new AppServiceSourceError('agendamentos');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$value,new DateTimeZone('America/Maceio'));
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date || ($errors !== false && ($errors['warning_count'] || $errors['error_count'])) || $date->format('Y-m-d H:i:s') !== $value) throw new AppServiceSourceError('agendamentos');
    return $date->getTimestamp();
}

function app_service_source_order_active(string $status): bool
{
    // Verified current source labels. Unknown/terminal statuses do not receive periodic reminders.
    $key = mb_strtolower(trim($status),'UTF-8');
    return in_array($key,['aberta','aguardando peça','em bancada','iniciada'],true);
}

function app_service_source_status(mixed $status, string $phase): string
{
    if (!is_string($status) || trim($status) === '' || strlen($status) > 100 || preg_match('/[\x00-\x1f\x7f]/',$status)) throw new AppServiceSourceError($phase);
    return trim($status);
}

/** Identifiers are internal constants; values always use parameters and full-number equality. */
function app_service_source_phone_where(array $columns, int $count): string
{
    $parts = [];
    foreach ($columns as $column) {
        if (!preg_match('/^[a-z_][a-z0-9_.]*$/D',$column)) throw new AppServiceSourceError('consulta');
        $sql = "COALESCE($column,'')";
        foreach (['+',' ','(',')','-','.'] as $character) $sql = "REPLACE($sql,'$character','')";
        $parts[] = $sql.' IN ('.implode(',',array_fill(0,$count,'?')).')';
    }
    return '('.implode(' OR ',$parts).')';
}

function app_service_source_read(PDO $db, string $sql, array $parameters, string $phase): array
{
    try {
        $query = $db->prepare($sql);
        $query->execute($parameters);
        return $query->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable) {
        // Deliberately omit the original exception: it can contain SQL, contacts, or connection details.
        throw new AppServiceSourceError($phase);
    }
}

function app_service_source_owners(PDO $db, string $table, array $columns, string $phone, string $phase): array
{
    if (!in_array($table,['clientes','usuarios','users'],true)) throw new AppServiceSourceError('consulta');
    $variants = app_service_source_phone_variants($phone);
    $parameters = [];
    foreach ($columns as $_) array_push($parameters,...$variants);
    $extra = $table === 'users' ? " AND role='customer'" : '';
    $rows = app_service_source_read($db,'SELECT id FROM '.$table.' WHERE '.app_service_source_phone_where($columns,count($variants)).$extra.' LIMIT 3',$parameters,$phase);
    if (count($rows) > 1) throw new AppServiceSourceError('identidade');
    return $rows;
}

/** Injectable PDO connections for isolated fixtures; production callers use snapshot() below. */
function app_service_source_snapshot_from_connections(array $customer, PDO $main, PDO $agenda, ?PDO $box = null, ?int $now = null): array
{
    $provider = $customer['provider'] ?? null;
    if (!in_array($provider,['core','box'],true)) throw new AppServiceSourceError('identidade');
    $id = app_service_source_id($customer['id'] ?? null);
    $cached = is_string($customer['phone'] ?? null) ? app_service_source_phone($customer['phone']) : '';
    if ($cached === '') throw new AppServiceSourceError('identidade');

    if ($provider === 'core') {
        $identity = app_service_source_read($main,'SELECT id,telefone FROM clientes WHERE id=? LIMIT 2',[$id],'identidade');
        $phone = isset($identity[0]['telefone']) ? app_service_source_phone((string)$identity[0]['telefone']) : '';
    } else {
        if (!$box) throw new AppServiceSourceError('identidade');
        $identity = app_service_source_read($box,"SELECT id,phone FROM users WHERE id=? AND role='customer' AND status='active' LIMIT 2",[$id],'identidade');
        $phone = isset($identity[0]['phone']) ? app_service_source_phone((string)$identity[0]['phone']) : '';
    }
    if (count($identity) !== 1 || $phone === '' || !hash_equals($cached,$phone)) throw new AppServiceSourceError('identidade');
    if ($provider === 'box') {
        $boxOwners = app_service_source_owners($box,'users',['phone'],$phone,'identidade');
        if (count($boxOwners) !== 1 || (string)$boxOwners[0]['id'] !== $id) throw new AppServiceSourceError('identidade');
    }
    $owners = app_service_source_owners($main,'clientes',['telefone','telefone2'],$phone,'identidade');
    if ($provider === 'core' && (count($owners) !== 1 || (string)$owners[0]['id'] !== $id)) throw new AppServiceSourceError('identidade');
    $ownerId = $owners ? app_service_source_id($owners[0]['id']) : null;
    $result = ['service_order'=>[],'appointment'=>[]];

    if ($ownerId !== null) {
        // Same ownership relation as vw_os_portal_cliente: os.cliente, not the legacy cliente_id fallback.
        $orders = app_service_source_read($main,'SELECT os_id,cliente_id,telefone,status FROM vw_os_portal_cliente WHERE cliente_id=? ORDER BY data_entrada DESC,os_id DESC LIMIT 501',[$ownerId],'ordens');
        if (count($orders) > 500) throw new AppServiceSourceError('limite');
        $seen = [];
        foreach ($orders as $order) {
            $orderId = app_service_source_id($order['os_id'] ?? null);
            if (isset($seen[$orderId]) || (string)$order['cliente_id'] !== $ownerId || app_service_source_phone((string)$order['telefone']) !== $phone) throw new AppServiceSourceError('identidade');
            $seen[$orderId] = true;
            $status = app_service_source_status($order['status'] ?? null,'ordens');
            $result['service_order'][] = ['id'=>$orderId,'status'=>$status,'is_active'=>app_service_source_order_active($status)];
        }
    }

    $agendaOwners = app_service_source_owners($agenda,'usuarios',['telefone'],$phone,'identidade');
    if (!$agendaOwners) return $result;
    $agendaId = app_service_source_id($agendaOwners[0]['id']);
    $floor = (new DateTimeImmutable('@'.($now ?? time())))->setTimezone(new DateTimeZone('America/Maceio'))->modify('-1 day')->format('Y-m-d H:i:s');
    $appointments = app_service_source_read($agenda,'SELECT v.agendamento_id,v.usuario_id,v.telefone,v.status,v.data_hora,
        (SELECT MAX(h.id) FROM agendamento_historico h WHERE h.agendamento_id=v.agendamento_id) AS history_id
        FROM vw_agendamentos_full_tel v WHERE v.usuario_id=? AND v.data_hora>=? ORDER BY v.data_hora,v.agendamento_id LIMIT 2001',[$agendaId,$floor],'agendamentos');
    if (count($appointments) > 2000) throw new AppServiceSourceError('limite');
    $seen = [];
    foreach ($appointments as $appointment) {
        $appointmentId = app_service_source_id($appointment['agendamento_id'] ?? null);
        if (isset($seen[$appointmentId]) || (string)$appointment['usuario_id'] !== $agendaId || app_service_source_phone((string)$appointment['telefone']) !== $phone) throw new AppServiceSourceError('identidade');
        $seen[$appointmentId] = true;
        $date = (string)($appointment['data_hora'] ?? '');
        $history = $appointment['history_id'] === null ? '0' : app_service_source_id($appointment['history_id']);
        $result['appointment'][] = ['id'=>$appointmentId,'status'=>app_service_source_status($appointment['status'] ?? null,'agendamentos'),
            'starts_at'=>app_service_source_date($date),'revision'=>hash('sha256',$appointmentId."\n".$date."\n".$history)];
    }
    return $result;
}

/** Parse only key/value data; never source a shell file or expand variables. */
function app_service_source_parse_env(string $text): array
{
    $values = [];
    foreach (preg_split('/\r?\n/',$text) ?: [] as $line) {
        if (!preg_match('/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/D',$line,$match)) continue;
        $value = $match[2];
        if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value,'"')) || ($value[0] === "'" && str_ends_with($value,"'")))) $value = substr($value,1,-1);
        $values[$match[1]] = $value;
    }
    return $values;
}

function app_service_source_env(): array
{
    $values = [];
    foreach (['/etc/lzgames/agenda.env','/etc/lzgames/db.env','/etc/lzgames/db.systemd.env'] as $file) {
        if (!is_file($file)) continue;
        $text = @file_get_contents($file);
        if ($text === false) throw new AppServiceSourceError('configuração');
        $values = array_replace($values,app_service_source_parse_env($text));
    }
    return $values;
}

function app_service_source_mysql(array $env, string $kind): PDO
{
    $pick = static function (array $keys) use ($env): string {
        foreach ($keys as $key) if (isset($env[$key]) && trim((string)$env[$key]) !== '') return (string)$env[$key];
        return '';
    };
    $n = $kind === 'agenda' ? '2' : '1';
    $suffix = $kind === 'agenda' ? '_AGENDA' : '';
    $host = $pick(["DB{$n}_HOST",'DB_HOST'.$suffix,'DB_HOST','DB1_HOST']);
    $user = $pick(["DB{$n}_USER",'DB_USER'.$suffix,'DB_USER','DB1_USER']);
    $pass = $pick(["DB{$n}_PASS","DB{$n}_PASSWORD",'DB_PASS'.$suffix,'DB_PASSWORD'.$suffix,'DB_PASS','DB_PASSWORD','DB1_PASS']);
    $name = $pick(["DB{$n}_NAME","DB{$n}_DATABASE","DB{$n}_DB",'DB_NAME'.$suffix]);
    $port = $pick(["DB{$n}_PORT",'DB_PORT'.$suffix]) ?: '3306';
    if ($user === '' || !preg_match('/^[A-Za-z0-9._:-]+$/D',$host) || !preg_match('/^[A-Za-z0-9_-]+$/D',$name) || !ctype_digit($port) || (int)$port < 1 || (int)$port > 65535) throw new AppServiceSourceError('configuração');
    try {
        $db = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",$user,$pass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_TIMEOUT=>3,PDO::ATTR_EMULATE_PREPARES=>false]);
        $db->exec("SET SESSION time_zone = '+00:00'");
        $db->exec('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $db->exec('SET SESSION TRANSACTION READ ONLY');
        $db->beginTransaction();
        return $db;
    } catch (Throwable) {
        throw new AppServiceSourceError('conexão');
    }
}

function app_service_source_box(): PDO
{
    // Canonical target of the live TurboBox release's .data symlink, verified without loading tb_db().
    $path = '/home/lz-servidor/HOSTINGER SITE DOCUMENTOS/sistema2026.lzgames.com.br/public_html/turbobox/.data/turbobox.sqlite';
    if (!is_file($path) || !is_readable($path)) throw new AppServiceSourceError('conexão');
    try {
        $db = new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::SQLITE_ATTR_OPEN_FLAGS=>PDO::SQLITE_OPEN_READONLY]);
        $db->exec('PRAGMA query_only=ON');
        $db->exec('PRAGMA busy_timeout=3000');
        $db->beginTransaction();
        return $db;
    } catch (Throwable) {
        throw new AppServiceSourceError('conexão');
    }
}

/** Customer is server-authenticated/cached metadata, never request body data. No external writes. */
function app_service_source_snapshot(array $customer): array
{
    $connections = [];
    try {
        if (!in_array($customer['provider'] ?? null,['core','box'],true)) throw new AppServiceSourceError('identidade');
        app_service_source_id($customer['id'] ?? null);
        if (!is_string($customer['phone'] ?? null) || app_service_source_phone($customer['phone']) === '') throw new AppServiceSourceError('identidade');
        $env = app_service_source_env();
        $main = $connections[] = app_service_source_mysql($env,'main');
        $agenda = $connections[] = app_service_source_mysql($env,'agenda');
        $box = null;
        if ($customer['provider'] === 'box') $box = $connections[] = app_service_source_box();
        return app_service_source_snapshot_from_connections($customer,$main,$agenda,$box);
    } catch (AppServiceSourceError $error) {
        throw $error;
    } catch (Throwable) {
        throw new AppServiceSourceError('consulta');
    } finally {
        foreach ($connections as $connection) {
            try { if ($connection->inTransaction()) $connection->rollBack(); } catch (Throwable) { /* Read-only sessions are discarded. */ }
        }
    }
}

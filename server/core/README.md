# Indicação e cashback: autenticação e regra de serviços

**Atualização ativa:** [indicação única, convite de uso único e proteção dos processadores financeiros](../../docs/SEGURANCA-INDICACOES-AGENDA-CPF.md). `referralGuard.js`, `referralGuardSchema.js`, migração aditiva, testes e patches `referral-guard-integration.patch` / `referral-cpf-registration.patch` substituem a geração determinística e a restrição antiga apenas por par. Não aplicar patches históricos isoladamente para reabrir a lógica antiga. Não remover reservas de identidade ao cancelar ou excluir uma indicação.

Cópia auditável do middleware, da regra de cashback de serviços e dos testes da API CORE. Não contém configuração privada, credenciais ou dados de clientes. Está fora do pacote EAS pelo diretório `server/` já excluído. A implantação financeira posterior está descrita em [CASHBACK-SERVICOS-5.md](../../docs/CASHBACK-SERVICOS-5.md): 5% na conclusão da OS, somente da nota nº 480 em diante; notas anteriores e bônus do app de R$ 9,90 não participam dessa concessão.

`lib/serviceReferral.js`, scripts e testes são os novos arquivos do servidor. `service-referrals.patch` documenta as mudanças financeiras em `routes/referrals.js`; `snapshots/referrals.js` é apenas referência do arquivo reconciliado, não deve sobrescrever alterações novas. `integration.patch` abaixo continua documentando a integração anterior de autenticação.

Atualização posterior: `lib/appReferral.js`, testes e `app-referral990.patch` acrescentam a evidência temporal atômica do aceite e o resumo separado dos R$ 9,90. O processamento ocorre em `server/raffles/`; leia [BONUS-APP-990.md](../../docs/BONUS-APP-990.md) para a ordem da migração, ativação, dados, limites e pendências. O resumo não concede crédito. Não somar `app_referral_credit` ao cashback aprovado nem conectar o ledger novo aos saques antigos.

Depois foi ativado o [uso dos créditos nas OS](../../docs/USO-CREDITO-APP.md). `app-credit-redemption.patch` registra saldo líquido/usados no resumo e a leitura do abatimento por OS. `snapshots/orders.js` é referência, não substituto cego da rota. A aplicação/estorno acontece na assistência, em transação única com o DB4; estes leitores CORE não fazem pagamentos. Tabelas da migração de crédito precisam existir antes de carregar esses leitores. A liberação financeira dos 5% permanece fora dessa implantação.

## Escopo e contrato

Atualização de convite público: `lib/appInvite.js`, `config/appRelease.json`, `tests/appInvite.test.js` e o histórico `app-invite.patch`. A [página de download](../../docs/CONVITE-APP.md) está ativa e oferece o APK 26. Com convite, a rota pública valida a assinatura v2 e consulta somente sua emissão/consumo; não consulta nem expõe clientes, não consome o convite e não concede crédito. O snapshot foi reconciliado com as guardas novas. Não expor `REFERRAL_SECRET` nem publicar arquivos privados junto da página.

- Sem `X-LZ-Identity-Provider`, ou com valor `core`: mantém a autenticação JWT CORE existente.
- Com `X-LZ-Identity-Provider: box`: valida o Bearer exclusivamente em `https://turbobox.lzgames.com.br/api/mobile/v1/me`, sem redirecionamentos, com timeout e limites de cabeçalho/corpo. Esse endpoint já verifica cliente ativo, validade/revogação do token e versão de autenticação.
- Resolve um único `clientes.id` atual pelo telefone completo, com DDI brasileiro e compatibilidade restrita ao nono dígito móvel. Não aceita `LIKE`, sufixos curtos ou IDs/telefones do corpo da requisição.
- Não emite JWT, cria clientes, copia senhas, altera saldo ou concede cashback. Não tenta outro provedor depois de falha de autenticação/requisição.
- O pedido de identidade TurboBox tem prazo de 5 segundos. A leitura CORE tem prazo local de 3 segundos incluindo espera do pool, além do timeout passado à consulta. O pool global permanece inalterado; uma leitura que termine depois do prazo não avança a requisição nem altera sua resposta.
- A ponte de autenticação aplica-se somente a `GET /api/me/referrals/summary`, `GET /api/me/referrals/list`, `POST /api/me/referrals/link`, alias `POST /api/me/referrals/generate-link` e `POST /api/referrals/accept`. A administração antiga continua bloqueada; a confirmação por integração recebeu, separadamente, a proteção descrita na implantação dos 5%.

Erros: `401 BOX_SESSION_EXPIRED` exige novo login TurboBox; `422 REFERRAL_ACCOUNT_NOT_LINKED` pede conferência do cadastro pela loja; `409 REFERRAL_ACCOUNT_AMBIGUOUS` bloqueia associação não única; `502 REFERRAL_IDENTITY_INVALID_RESPONSE` ou `503 REFERRAL_IDENTITY_UNAVAILABLE` são falhas do serviço e não devem apagar a sessão. Cabeçalhos inválidos retornam `400`.

## Implantação e verificação

Destino: `/home/lz-servidor/Documentos/lzgames/api`. Preserve alterações alheias e reconcilie os dois arquivos novos deste diretório nos mesmos caminhos relativos. `integration.patch` documenta as únicas duas mudanças necessárias em arquivos existentes: import do middleware e cabeçalho CORS permitido. Não substitua `app.js` ou `routes/referrals.js` inteiros.

Antes da ativação:

```sh
cd /home/lz-servidor/Documentos/lzgames/api
node --check middleware/referralAuth.js
node --check routes/referrals.js
node --check app.js
node --test tests/referralAuth.test.js
```

Os testes usam fixtures, sem chamada ao serviço TurboBox, credenciais reais ou banco de produção. Rodar a cópia em `server/core/tests/` também executa os testes isolados; apenas a conferência de integração das rotas é marcada como pendente nessa cópia parcial e deve passar no CORE completo.

Somente após revisão do diff e dos testes, ativar o código já instalado com:

```sh
sudo systemctl restart lzgames-api.service
systemctl is-active lzgames-api.service
curl --fail --silent --show-error http://127.0.0.1:8083/api/health
curl --silent --show-error --include --request OPTIONS http://127.0.0.1:8083/api/me/referrals/summary \
  --header 'Origin: https://app.lzgames.com.br' \
  --header 'Access-Control-Request-Method: GET' \
  --header 'Access-Control-Request-Headers: authorization,x-lz-identity-provider'
```

Esperado: serviço `active`, saúde `ok/healthy`, preflight `204` com o cabeçalho adicional permitido. Não usar geração/aceite real de indicação como teste. A preparação original guardou os dois arquivos anteriores em `/tmp/lzgames-referral-auth.zUk0cv/`, diretório temporário privado; a alteração inicial não reiniciou a API.

## Regras existentes: limites da interface

Com a regra de serviços ativa, o resumo retorna um único nível de 5% e o limite mínimo de nota. A configuração antiga 0→0%, 5→5%, 10→10%, 20→20%, 30→30% é apenas o fallback da política desativada. Renderize os níveis recebidos, sem recalcular concessões históricas. `cashback_aprovado_centavos` é a soma das indicações concluídas, não saldo líquido disponível para saque. Use “cashback aprovado”; resgate e pagamentos não foram implementados.

A geração de link usa `/api/me/referrals/link` e retorna `{ok:true,data:{codigo_ref,link,indicador_id,indicador_nome}}`. Requisições autenticadas do app (`X-LZ-Identity-Provider: core|box`) recebem `https://app.lzgames.com.br/convite/?ref=...`; as do portal web preservam a configuração existente, com padrão `/login?ref=...`. Somente uma ação explícita de compartilhar deve solicitá-lo. O aceite usa `/api/referrals/accept` com `{codigo_ref}` e deve ser explícito no aplicativo. O legado web continua capturando `ref` na página de login.

O cadastro estabelece exclusividade global por cliente, telefone completo e CPF válido disponível, preservada após cancelamento/exclusão. Cada convite aceita somente um destinatário. Os processadores financeiros exigem vínculo íntegro e recusam legados ambíguos, preservando aprovações anteriores e sem chamar procedimentos legados de pontos/saque. OTP de posse e atestação nativa permanecem controles adicionais não implementados.

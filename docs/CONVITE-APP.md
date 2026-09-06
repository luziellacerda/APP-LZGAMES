# Convite público, histórico compacto e Lotties — VFX-13

**Estado atual (06/09/2026): [APK 26 concluído, verificado e publicado](BUILD-26.md).** A página de compartilhamento mantém seu endereço e oferece a versão mais recente, com detalhes da Agenda, Lotties maiores e convite novo por compartilhamento. As [guardas de indicação única](SEGURANCA-INDICACOES-AGENDA-CPF.md) seguem ativas no servidor.

O fingerprint `BUILD-26-sources.sha256` registra a fonte empacotada no APK 26. Foi feita uma compilação interna solicitada, sem publicação na loja ou compras.

## Como o cliente indica o aplicativo

1. No app, entrar em **Indique e ganhe → Convide alguém → Compartilhar convite**.
2. O novo link abre `https://app.lzgames.com.br/convite/?ref=...`: página pública, sem exigir login no portal.
3. A pessoa convidada copia o código na própria página e baixa o APK oficial para Android.
4. No aplicativo, toca em **Recebi um convite** e cola o código **antes de entrar ou criar sua conta**. Essa entrada já existe no APK 23.
5. O aceite autenticado e a comprovação de primeiro uso elegível seguem nas integrações existentes. A página, a cópia do código e o download não cadastram indicação nem concedem crédito.

O crédito de R$ 9,90 é do **indicador**, para serviços e sem saque, quando o servidor confirmar elegibilidade. Não é dinheiro automaticamente pago ao convidado. Regras de 5% por serviço, corte a partir da OS 480, saldos, histórico e autorizações não foram modificados. Veja [BONUS-APP-990.md](BONUS-APP-990.md) e [CASHBACK-SERVICOS-5.md](CASHBACK-SERVICOS-5.md).

Sem `ref`, a [página genérica](https://app.lzgames.com.br/convite/) também permite baixar e criar conta sem indicação. Código inválido mostra erro e oferece o caminho genérico. Não há rastreadores, fontes externas, leitura automática da área de transferência ou vínculo pelo simples acesso ao endereço.

**Compatibilidade:** o APK 23 já envia `X-LZ-Identity-Provider: core|box` e aceita o código no caminho público novo. Após a ativação, saia e entre novamente na tela de indicações e compartilhe um novo link, evitando reutilizar o resultado antigo em memória. Links já enviados com `/login?ref=...` não foram redirecionados: o fluxo de indicação do portal web foi preservado.

## API e publicação

| Componente | Fonte editável | Destino ativo |
| --- | --- | --- |
| Informações do convite | `server/core/lib/appInvite.js`, `config/appRelease.json`, `app-invite.patch` | `/home/lz-servidor/Documentos/lzgames/api` |
| Página independente | `server/web/public/convite/` | `/home/lz-servidor/Documentos/lzgames/frontend/public/convite/` e `/var/www/lzgames/convite/` |
| Testes de navegador | `server/web/tests/app-invite.browser.cjs` | `/home/lz-servidor/Documentos/lzgames/frontend/tests/` |

`GET /api/app/invite-info` é público e somente leitura. Sem código, retorna os metadados do APK. Com `ref`, verifica formato v2, HMAC com comparação constante, ID válido e emissão ainda não consumida no banco. Não consome o convite, não consulta/exibe clientes nem confirma vínculo, elegibilidade ou recompensa. Inválido/antigo retorna 400, indisponível/usado retorna 409 e falha temporária retorna 503, sem ecoar entrada. Não emite cookies; envia `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex, nofollow`.

A geração autenticada existente escolhe `/convite/` somente para o app; o cabeçalho de provedor não elimina sua autenticação. O portal web mantém `REFERRAL_BASE_URL`. A API foi reiniciada pelo serviço existente e conferida por HTTPS. Nginx/DNS não foram alterados. As tabelas aditivas e regras de integridade posteriores estão no registro de indicação única; valores e gatilhos financeiros foram preservados.

A página usa HTML/CSS/JS próprios, com CSP restrita ao mesmo domínio. A leitura da API tem prazo de oito segundos, erro visível e nova tentativa. O download só é exibido após validar a resposta e a URL oficial versionada; a alternativa sem JavaScript aponta explicitamente ao APK 26. A cópia é uma ação do usuário, com seleção manual de fallback se o navegador negar a área de transferência.

Arquivo publicado: `https://app.lzgames.com.br/convite/lz-games-26.apk`, **73.221.966 bytes**, SHA-256:

```text
90e5b0cd7ab63608fb147dc53a34e9917f710d4180ce505cb125041ca17e46a9
```

O APK é um artefato ignorado pelo Git. A pasta `server/` também é excluída do envio ao EAS. Não incluir `.env`, configuração privada, chaves FCM, bancos ou backups no repositório.

### Atualizar o APK oferecido no convite

Depois de uma nova compilação **solicitada e concluída**, conferir pacote `br.com.lzgames.app`, versão, assinatura original e integridade. Publicar o novo APK com outro nome versionado em `/var/www/lzgames/convite/`; não sobrescrever um arquivo já distribuído. Atualizar `config/appRelease.json` e a alternativa sem JavaScript em `index.html`, com versão, tamanho e hash reais. Ajustar as fixtures versionadas de `appInvite.test.js`, executar os testes e reiniciar a API pelo serviço existente. Atualizar a cópia auditável em `server/`. Se CSS/JS mudar, incrementar os nomes `invite-v1.*` e as referências no HTML para evitar cache antigo.

Conferir por HTTPS página, metadados e download, mantendo o APK anterior disponível durante a transição. **Não sincronizar o webroot com exclusão automática**: os APKs publicados não estão na pasta-fonte. O portal principal não precisa ser recompilado para publicar essa página independente.

Antes de reconciliar servidores, revisar o diff e preservar alterações locais. `server/core/app-invite.patch` contém só o import, a rota pública e a escolha do link; os snapshots são referência, não substitutos cegos. O backup desta etapa está no diretório privado `/home/lz-servidor/.config/lzgames/app-invite-backup-iLgvb7`. Para rollback, reverta apenas esses trechos, restaure metadados compatíveis e reinicie o serviço. Preserve a página enquanto houver convites públicos em circulação; não apague dados financeiros nem arquivos de outra entrega.

## Histórico de indicações no app

- Entrada compacta: mês atual da loja (`America/Maceio`), somente **concluídas**, cinco registros por vez.
- **Pesquisar** revela meses anterior/próximo, opção de todos os meses, estados concluídas/pendentes/canceladas/em análise/todas e pesquisa por nome, sem depender de maiúsculas ou acentos.
- O filtro usa a **data de criação** da indicação. A consulta existente é limitada aos últimos 365 dias e a até 200 registros recentes; “todos” não significa o histórico ilimitado do banco.
- **Mostrar mais** acrescenta cinco. Trocar filtros reinicia a paginação; **Limpar filtros** volta ao padrão.
- Pendentes/canceladas ficam fora da visualização inicial, mas não foram apagadas. Saldos e totais do resumo continuam independentes dos filtros.

Implementação: `src/referralHistory.ts`, `src/ReferralRewards.tsx` e `scripts/referrals.test.cjs`. A mensagem de compartilhamento explica copiar código, baixar o app Android e informar o convite antes do login/cadastro.

## Animações escolhidas

Os seis arquivos pedidos estão empacotados offline, com origem, autoria e termos completos em [assets/README.md](../src/effects/assets/README.md). `CardLottie.tsx` atende entradas e cartões pequenos; `menuLotties.ts` troca o calendário nos locais que já usavam esse ícone.

| Local | Animação escolhida |
| --- | --- |
| Entrada “Indique e ganhe”, em Início e Conta | [Money — manju](https://lottiefiles.com/free-animation/money-JAEyxMYTN2) |
| Valor de cashback aprovado | [Money — Mahendra Bhunwal](https://lottiefiles.com/free-animation/money-9Rs7JUzu1D) |
| Crédito de indicação por app | [Fake 3D vector coin — Christina Bublyk](https://lottiefiles.com/free-animation/fake-3d-vector-coin-0N5eblUHrK) |
| “Convide alguém” | [Payment Successful — Uzair S.](https://lottiefiles.com/free-animation/payment-successful-animation-cUEV8IuLNE) |
| Calendário da Agenda | [El calendario — Kevin Diestra Montero](https://lottiefiles.com/free-animation/el-calendario-jxFJ2FUhZx) |
| Cartão “Suite e licenças” | [rocket share — Pedro Lucas Gandara Santos](https://lottiefiles.com/free-animation/rocket-share-kQtY3BH2g7) |

Os espaços pequenos dos ícones e os botões foram preservados. O foguete escolhido altera somente a decoração do cartão Suite, não a nave independente no fundo espacial. Matrix, moedas dos sorteios, troféu, laser dos cartões e eletricidade do menu permanecem. Não há animação de confirmação financeira: os Lotties são decorativos e não alteram o estado dos dados.

Pausa fora da superfície visível, em segundo plano e com redução de movimento; pose estática ou emoji em caso de falha. Sem download em execução, dependência nova, timer JS por ícone, WebView adicional ou captura de toque pelas animações. Badge de desenvolvimento: **TESTE VFX-13**, oculto no APK de consumidor.

## Verificação e próximo APK

TypeScript e **125 testes do app** passaram: Agenda 14, indicações 27, OS/crédito 2, push/controles 39 e efeitos 43. Exportação Android/Hermes local concluída. No CORE, 37 testes isolados passaram; a página passou em 36 verificações de navegador com requisições interceptadas, incluindo 320/390/1200 px, códigos inválidos, cópia negada e nova tentativa após falha da API.

Testes CORE, no servidor completo e com fixtures (sem operações reais):

```bash
cd /home/lz-servidor/Documentos/lzgames/api
node --check routes/referrals.js
node --test tests/appInvite.test.js tests/referralAuth.test.js tests/appReferral.test.js tests/serviceReferral.test.js tests/serviceReferral.routes.test.js
```

O teste `server/web/tests/app-invite.browser.cjs` usa Playwright e Chrome. Pode ser executado com a dependência existente via `LZ_PLAYWRIGHT_PATH`, sem instalar nada no app. Intercepta todas as URLs e não utiliza um consumidor real. Também foram conferidos por HTTPS a página genérica, o erro de convite inválido e o arquivo oficial publicado; nenhum cadastro, aceite, crédito ou mensagem real foi disparado.

Prévia SVG offline confirma os desenhos e os espaços dos ícones; **não substitui validação no Android físico**, especialmente desempenho, acessibilidade e toques. Exportação local não é APK. Siga [COMPILACAO-ANDROID.md](COMPILACAO-ANDROID.md) quando for solicitado compilar, conferindo o próximo `versionCode` no histórico EAS. `app.json` permanece em 26, correspondente à última compilação concluída; conferir o histórico antes de incrementar para outro envio. Não reutilize um APK anterior para avaliar os detalhes da Agenda e não envie outro build apenas para consultar a compilação anterior.

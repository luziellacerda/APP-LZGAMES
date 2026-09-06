# Página pública de convite para o app

Cópia auditável da página independente em `public/convite/` e do teste de navegador em `tests/`. Mesma estrutura relativa do frontend em `/home/lz-servidor/Documentos/lzgames/frontend`; publicação em `/var/www/lzgames/convite/`. A página não exige login, cria clientes ou aceita indicações. Consome somente o endpoint público CORE `GET /api/app/invite-info`.

Leia [CONVITE-APP.md](../../docs/CONVITE-APP.md) antes de reconciliar ou publicar. Não substituir o portal React, modificar Nginx, excluir o webroot ou usar sincronização com exclusão. O APK versionado é instalado separadamente no destino após conferir assinatura/tamanho/hash; ele não entra no Git e não existe nesta cópia de código.

Teste offline com Playwright/Chrome disponíveis: `node tests/app-invite.browser.cjs`. A variável opcional `LZ_PLAYWRIGHT_PATH` aponta à instalação existente de Playwright. Nenhuma requisição real de cliente é enviada; o teste intercepta HTML/CSS/JS/API e usa fixtures. Verificar também a página genérica e o arquivo de download por HTTPS após publicar, sem efetuar cadastro ou indicação de teste em produção.

# Games Usados — entrega técnica 28

Branch: `feature/appgamesusados-marketplace`. A linha `main` e os módulos de OS, agenda, TurboRama, sorteios, cashback e push existentes foram preservados.

## O que foi implementado e implantado

- Catálogo responsivo em grade, pesquisa, filtros, paginação, fotos ampliáveis, vídeo sob demanda e publicação em três passos (revisão anterior, agora incluída no APK 28 concluído).
- Edição de título, descrição, preço, categoria, conservação, cidade, UF e foto de capa. Fotos e vídeo existentes são preservados; substituir os arquivos de um anúncio não faz parte desta edição.
- Concorrência protegida no servidor: um comprador por anúncio, até cinco reservas abertas por comprador mesmo em produtos diferentes, limite horário e diário rechecados sob bloqueio e repetição segura de reserva/status.
- Chave persistida no banco e impressão SHA-256 do conteúdo do envio: repetir a mesma publicação não cria outro anúncio; reutilizar a chave com conteúdo diferente é rejeitado. O app conserva a chave durante as tentativas do mesmo formulário. Sair do formulário cria um novo envio; sempre conferir Meus anúncios após uma resposta incerta.
- Termos de publicação versionados e aceitação exigida pelo servidor. APKs antigos sem essa confirmação precisam atualizar para publicar; leitura e negociações existentes permanecem compatíveis.
- Denúncia de anúncio/vendedor com cinco motivos e explicação, bloqueio bilateral para catálogo/novas negociações e desbloqueio pelo próprio cliente.
- Avisos internos transacionais de reserva, mudanças de negociação e decisões da moderação. O cabeçalho verifica avisos a cada minuto apenas com a loja aberta e o app ativo. **Não são push**; os avisos push anteriores de OS/agenda/sorteios não foram removidos.
- Moderação humana no [painel Games Usados](https://sorteios.lzgames.com.br/admin/games-usados), usando a sessão administrativa existente, CSRF, confirmação, versão do anúncio e auditoria. O menu do painel principal ganhou o link.
- Retirada/restauração de anúncio, suspensão/reativação de conta de vendas e resolução de denúncias. Retirada/suspensão cancela reservas ainda solicitadas e avisa os envolvidos. Negociações já aceitas são preservadas como histórico; não há estorno ou processamento financeiro.
- Mídias retiradas deixam de ser servidas pela API pública. A moderação pode conferi-las por uma rota administrativa autenticada. Respostas novas usam `no-store`; arquivos já salvos por terceiros não podem ser recolhidos remotamente.
- Até dois uploads/processamentos simultâneos, máximo de 45 MB por solicitação conferido durante a leitura, processamento com dois threads, restrição de protocolos/formatos e limite de resolução. Vídeo final até 30 segundos, H.264/AAC, até 720p.
- Contatos só são retornados aos envolvidos em negociações abertas/aceitas, sem bloqueio entre as partes. Histórico encerrado não expõe novamente o WhatsApp.

## Banco, servidor e backup

Somente `u214656250_appgamesusados` recebeu a migração aditiva `server/marketplace/migrate-production.sql`. Não foram alterados os outros bancos. Na implantação havia zero anúncios reais e a contagem foi preservada.

Backup privado anterior à implantação: `/home/lz-servidor/.config/lzgames/backups/marketplace-production-qbJwEx/`. Contém dump SQL e cópias dos arquivos anteriores; não versionar ou enviar esse diretório ao EAS.

Arquivos da API: `/home/lz-servidor/Documentos/lzgames/api/routes/marketplace.js`, `lib/marketplaceMedia.js`, `lib/marketplacePolicy.js`.

Painel: `/home/lz-servidor/apps/lzgames-sorteios/public/games-usados.php`, `public/marketplace-admin.css`, `lib/marketplace-admin.php`. O roteamento e o link estão descritos em `server/marketplace/admin/integration.patch`.

## Reprodução e verificação

```sh
cd /home/lz-servidor/projetos/APP-LZGAMES
npm ci
npm run typecheck
npm run check:push
npm run test:marketplace
# Somente no servidor configurado. Cria e remove tabelas fictícias com prefixo aleatório.
npm run test:marketplace:sql
# Backup privado seguido de migração aditiva; executar antes de trocar a API.
node server/marketplace/migrate-production.cjs --apply
```

Aplicar as três fontes da API com backup e sem sobrescrever mudanças divergentes. Copiar os três arquivos administrativos para os destinos acima; aplicar o patch de roteamento e navegação. Validar PHP/Node e reiniciar apenas `lzgames-api.service`. Não restaurar o dump sobre dados novos sem planejamento: a migração é aditiva e pode permanecer no banco. **Um rollback para a rota antiga deve desativar a loja até nova validação**, porque a versão antiga não aplica as decisões de moderação/bloqueio e poderia reexpor anúncios retirados.

Validação desta entrega: 155 testes automatizados gerais, mais 10 testes de integração HTTP/MariaDB/PHP com tabelas fictícias; nenhuma mensagem ou anúncio real criado. Cobrem disputa simultânea do mesmo anúncio, seis reservas concorrentes do mesmo comprador, publicação repetida, edição indevida, versão obsoleta, vencimento, bloqueios, denúncias, moderação e isolamento de avisos. Prévias de interface verificadas com dados sintéticos nas larguras 320/390/430/768; diálogos de avisos, regras, denúncia e edição também exercitados.

A API reiniciou e respondeu saudável; acesso anônimo ao catálogo retorna 401 e ao painel administrativo redireciona ao login. A página administrativa também foi renderizada em leitura local com o schema implantado. Isso não substitui testar a sessão de administrador no navegador do operador.

Também foram corrigidas as [dependências de execução da API compartilhada](../server/core/runtime/README.md), sem alterar regras de OS/agenda/cashback. A auditoria inicial tinha dez dependências sinalizadas (seis altas e quatro moderadas); após atualização, `npm audit --omit=dev` informou zero alertas conhecidos. Mais sete testes de compatibilidade passaram e os dez testes HTTP/SQL foram repetidos antes e depois da implantação. Isso não significa ausência de toda vulnerabilidade nem substitui revisão contínua.

## Limites de liberação — não ocultar

Esta é uma loja de anúncios e negociação direta. **Não é checkout de marketplace com pagamento protegido**. Conta de provedor, contratação, split/comissão, entrega/rastreamento, reembolsos e disputas financeiras não foram inventados ou contratados. Precisam de definição comercial e integração própria.

A moderação é reativa e humana, não uma promessa de aprovação automática, inteligência artificial ou vendedor verificado. A equipe precisa acompanhar as denúncias e o catálogo regularmente. Os textos de regras são operacionais e não substituem a revisão dos termos comerciais/privacidade para a operação final.

Antes de distribuição ampla: instalar o APK 28 em aparelho Android, testar seleção nativa de cinco fotos/vídeo, teclado/voltar/áreas seguras, login de comprador/vendedor, uma negociação controlada e moderação usando a sessão real do operador. A validação local de React Native Web e exportação Hermes não é teste físico de APK nem aprovação da Play Store.

Referências primárias utilizadas: [Google Play — conteúdo gerado pelo usuário](https://support.google.com/googleplay/android-developer/answer/9876937?hl=pt-BR) e [OWASP — segurança de uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

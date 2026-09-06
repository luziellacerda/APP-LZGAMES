# Games Usados — arquitetura e operação

**Revisão posterior ao APK 27:** veja [a nova experiência, testes, prévias e limites](GAMES-USADOS-UX.md). Essa revisão ainda requer novo APK e validação física; não aparece no APK 27 já compilado.

## Objetivo

Games Usados é um marketplace entre clientes autenticados do aplicativo. Ele foi desenvolvido na branch `feature/appgamesusados-marketplace` para não misturar o trabalho com a linha principal.

O cadastro e login continuam vindo do banco principal da LZ-GAMES. Todo dado novo da loja fica no banco separado `u214656250_appgamesusados`, exibido pelo agrupamento `u214656250` do phpMyAdmin como `appgamesusados`.

## Fluxo do cliente

1. O cliente entra no aplicativo com a conta já cadastrada.
2. Em **Games Usados**, pode pesquisar por texto e filtrar por categoria.
3. Em **Vender**, cadastra título, descrição, categoria, conservação, preço, cidade, UF, de uma a cinco fotos e um vídeo opcional de até 30 segundos.
4. Em **Meus**, pausa, reativa ou encerra seus próprios anúncios.
5. Ao reservar um item, o banco bloqueia o anúncio na mesma transação. Outro comprador não consegue reservar o mesmo produto.
6. Comprador e vendedor acompanham a solicitação em **Negociações**. O contato é liberado somente aos envolvidos.
7. A reserva expira em 24 horas se não for aceita; o produto volta ao catálogo. Cada comprador pode ter até cinco reservas abertas.

Esta versão não captura pagamento dentro do aplicativo. O botão cria uma reserva auditável e abre o WhatsApp para as partes combinarem pagamento e entrega. Uma integração financeira futura exigirá conta e contrato próprios com um provedor de pagamento.

## Mídias e segurança

- originais são recebidos em pasta temporária fora da raiz pública;
- nomes enviados pelo usuário nunca são usados como nomes finais;
- MIME é filtrado, mas a validação final ocorre por decodificação com `ffprobe`/`ffmpeg`;
- fotos viram JPEG de até 1600 px e têm metadados removidos;
- vídeo vira MP4 H.264/AAC de até 720p, 30 fps, 30 segundos e recebe `faststart`;
- o arquivo original é excluído ao final, inclusive quando a publicação falha;
- arquivos temporários abandonados por falha de processo são limpos depois de 24 horas;
- mídia só é servida se o nome aleatório estiver registrado no banco;
- catálogo não expõe WhatsApp, CPF, e-mail ou caminho do servidor;
- alterações usam IDs públicos aleatórios e checam propriedade no servidor;
- denúncias e ações relevantes ficam em trilha de auditoria.

## Instalação reproduzível

1. Execute `server/marketplace/schema.sql` no MariaDB.
2. Instale `multer@2.3.0` na API.
3. Copie `server/marketplace/routes/marketplace.js` para `api/routes/marketplace.js`.
4. Copie `server/marketplace/lib/marketplaceMedia.js` para `api/lib/marketplaceMedia.js`.
5. Configure o pool `dbMarketplace` usando `DB5_NAME=u214656250_appgamesusados` ou o fallback documentado em `server/marketplace/integration.patch`.
6. Monte `app.use('/api/marketplace', marketplaceRoutes)`.
7. Confirme que `/usr/bin/ffmpeg` e `/usr/bin/ffprobe` existem.
8. Rode `npm run typecheck`, `npm run test:marketplace` e os testes existentes antes de gerar um APK.

## Operação

As mídias ficam em `/home/lz-servidor/.local/share/lzgames-marketplace/media`. Faça backup do banco e dessa pasta juntos. Restaurar apenas um deles deixa anúncios sem arquivo ou arquivos órfãos.

Denúncias são gravadas em `product_reports`. Antes de escalar a loja, deve-se criar uma tela administrativa para moderação, definir termos comerciais e integrar notificações de nova negociação ao sistema de push existente.

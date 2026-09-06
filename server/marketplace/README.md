# App Games Usados

**Entrega 28:** a instalação inicial abaixo também requer `migrate-production.sql`, `lib/marketplacePolicy.js` e o painel em `admin/`. Veja [o procedimento e as limitações atuais](../../docs/GAMES-USADOS-PRODUCAO.md). Não implantar somente o cliente ou somente as novas rotas sem a migração.

Marketplace isolado do aplicativo LZ-GAMES. Os clientes continuam autenticados pelo cadastro principal, mas anúncios, mídias, negociações e auditoria usam somente o banco `u214656250_appgamesusados`.

## Instalação no servidor

```bash
mysql < server/marketplace/schema.sql
cd /home/lz-servidor/Documentos/lzgames/api
npm install multer@2.3.0 --save
```

Copie `routes/marketplace.js` e `lib/marketplaceMedia.js` mantendo a estrutura, configure `DB5_NAME=u214656250_appgamesusados`, exporte `dbMarketplace` em `db.js` e monte a rota em `app.js`:

```js
const marketplaceRoutes = require("./routes/marketplace");
app.use("/api/marketplace", marketplaceRoutes);
```

O servidor requer `ffmpeg` e `ffprobe`. Arquivos originais ficam apenas no diretório temporário; imagens e vídeos publicados são decodificados e reprocessados antes de serem persistidos. A pasta final padrão fica fora da raiz pública em `/home/lz-servidor/.local/share/lzgames-marketplace/media`.

## Regras entregues

- 1 a 5 fotos obrigatórias e 1 vídeo opcional de até 30 segundos;
- limite total de 45 MB por solicitação e vídeo final de até 24 MB;
- preço inteiro em centavos, condição de usado obrigatória e categorias permitidas;
- catálogo sem telefone; contato liberado somente aos envolvidos na negociação;
- reserva transacional que impede dois compradores no mesmo anúncio;
- reserva expira em 24 horas e cada comprador pode manter no máximo cinco reservas abertas;
- estados `active`, `paused`, `reserved`, `sold` e `closed`;
- trilha de auditoria, denúncia, limites de publicação e consulta;
- nomes de arquivo aleatórios, validação por decodificação e remoção de metadados.

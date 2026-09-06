# Games Usados — revisão da experiência após o APK 27

Atualização: a experiência abaixo foi incorporada à [entrega 28, com moderação e proteções de servidor](GAMES-USADOS-PRODUCAO.md). Este documento registra o estado da revisão visual anterior; consulte o documento da entrega 28 para o estado mais recente.

## Estado da entrega

Esta revisão está na branch `feature/appgamesusados-marketplace`. **Não faz parte do APK 27 já distribuído.** O código Android foi exportado localmente para validação; não houve nova compilação remota nem publicação na Play Store nesta revisão.

Não foram alterados bancos, anúncios reais, OS, agenda, sorteios, cashback, push ou regras financeiras. O banco isolado da loja e a autenticação existentes foram preservados.

## O que mudou

- Loja com tela própria, cabeçalho e quatro destinos: Explorar, Anunciar, Meus anúncios e Negociações. O botão de saída retorna ao início da LZ-GAMES.
- Catálogo em grade com fotos, preço, conservação e localização. Lista virtualizada, paginação real, cancelamento de leituras antigas, botão para carregar mais e recuperação de erro.
- Filtros por categoria e conservação. Resultados recentes primeiro, conforme a API existente; sem avaliações, contadores de vendas ou selos inventados.
- Em telas estreitas ou com texto ampliado, o conteúdo tem prioridade sobre a apresentação decorativa.
- Detalhe consultado novamente ao abrir. Galeria usa a largura disponível, possui contador, ampliação e navegação entre fotos. Vídeo só é montado quando solicitado, começa mudo e pausa quando o app vai ao fundo.
- Anúncio em três etapas: produto, mídia e revisão. Escolha da capa, validação de preço em centavos e tamanho de arquivos, tratamento de falha ao abrir a galeria e confirmação antes de descartar dados não publicados.
- Ações de reserva e publicação protegidas contra toques simultâneos; confirmação para aceitar, recusar, cancelar, encerrar e concluir.
- Painel de anúncios e negociações com filtros. Erro de leitura não é apresentado como catálogo vazio ou contagem zero confirmada.
- Mensagens deixam explícito que reservar não é pagar e que não há garantia financeira ou intermediação de pagamento nesta versão.

## Validação

- 150 testes automatizados aprovados: 137 dos módulos anteriores e 13 do marketplace.
- TypeScript sem erros e Firebase cliente verificado.
- Exportação Android/Hermes concluída. O tamanho do bundle não representa o tamanho final do APK.
- Prévia isolada usando o componente React Native via React Native Web, com dados inteiramente fictícios: catálogo, filtros, galeria, formulário de três etapas, anúncios, negociações, tela vazia e falha de conexão.
- Larguras verificadas: 320, 390, 430 e 768 px, sem transbordamento horizontal da página.
- Nenhuma conta, reserva, anúncio ou mensagem real foi criada pelos testes desta revisão.

### Prévias com dados fictícios

[Catálogo](previews/marketplace-catalog.png) · [Tela estreita](previews/marketplace-small.png) · [Detalhe](previews/marketplace-details.png) · [Publicação](previews/marketplace-publish.png).

As capturas são de uma prévia local, não de um APK instalado. A seleção nativa de fotos, o teclado, o botão Voltar, as áreas seguras e a reprodução de vídeo ainda precisam ser conferidos em aparelho físico antes da liberação ao consumidor.

## Referências utilizadas

- Áreas de toque de pelo menos 48 dp, conforme [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views?hl=en).
- Grade responsiva e espaçamento consistente, conforme [Android: grids and units](https://developer.android.com/design/ui/mobile/guides/layout-and-content/grids-and-units?hl=en).
- Virtualização e múltiplas colunas com [FlatList, React Native](https://reactnative.dev/docs/flatlist).
- Fotografias como informação central de anúncio, conforme [eBay: adding pictures to listings](https://www.ebay.com/help/listings/selling/adding-pictures-listings?id=4148). O limite próprio de cinco fotos foi mantido; não se copiou a identidade visual do eBay.

## O que ainda impede chamar a operação de marketplace completo

A revisão melhora apresentação, navegação e confiabilidade do cliente, mas não substitui uma operação comercial completa. Ainda faltam pagamento integrado/protegido, entrega/rastreamento, tratamento de disputa, painel de moderação, edição completa de anúncios e notificações específicas de negociação. Cadastro em provedor, contratos, comissões e decisões comerciais não foram presumidos.

Não anunciar compra garantida, vendedor verificado, avaliação de cliente ou saldo retido enquanto esses recursos não existirem de fato.

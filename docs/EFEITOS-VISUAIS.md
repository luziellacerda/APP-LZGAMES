# Efeitos do aplicativo

Este documento descreve os efeitos do app. A atualização independente do link/página de convite está registrada em [CONVITE-APP.md](CONVITE-APP.md); regras de OS/agendamento/sorteios permanecem preservadas.

## Atualização VFX-13 — Lotties escolhidos para indicações, calendário e Suite

Fonte posterior ao APK 23, ainda sem nova compilação. Entradas “Indique e ganhe” recebem Money de manju; cashback aprovado, Money de Mahendra; crédito por app, a moeda 3D de Christina; “Convide alguém”, Payment Successful de Uzair; Agenda, El calendario de Kevin; cartão “Suite e licenças”, rocket share de Pedro. Os links exatos, créditos e adaptações estão em [assets/README.md](../src/effects/assets/README.md).

`CardLottie.tsx` e `cardLotties.ts` acrescentam espaços decorativos limitados, sem capturar toque ou indicar aprovação financeira. `menuLotties.ts` troca apenas a fonte do calendário. Suite preserva seu espaço de 54 dp; o foguete do menu TurboRama e a nave de fundo são independentes. As animações são locais, pausam conforme visibilidade/segundo plano/redução de movimento e têm fallback estático. Sem novas dependências, downloads em execução ou WebViews. A licença completa acompanha cada fonte em `meta.credit`.

Badge atual: `TESTE VFX-13`, apenas em desenvolvimento. Validação: 43 testes de efeitos, 125 testes totais do app, TypeScript, exportação Android/Hermes e prévia SVG offline nos tamanhos compactos. Android físico permanece pendente. O APK 23 não contém esta atualização.

## Atualização VFX-12 — ícones da web e troféu menor

- Foguete de TurboRama, calendário de Agenda e chave inglesa de Minhas OS passam a usar arquivos Lottie obtidos na web, empacotados localmente com autor, origem e termos completos da licença. O mesmo mapeamento atende cards, linha de agendamento e ícones correspondentes do menu inferior.
- `src/effects/menuLotties.ts` centraliza fontes, escala, velocidade e pose estática. Os ícones mantêm seus espaços de 54/32/28 dp; navegação, dimensões dos cards e dados não mudam.
- `AnimatedIcon` mantém pausa conforme visibilidade, app em primeiro plano, movimento reduzido e aba ativa. Uma pose visível substitui a animação quando está parada; falha do renderer usa o emoji correspondente. Decorações não capturam toques.
- Troféu reduzido de player 1,7× para 1,5×: desenho aproximadamente 12% menor, nos mesmos slots de 86/88 dp e com o mesmo giro.
- Nenhuma dependência nova, download de animação em execução ou alteração na nave de fundo, moedas, Matrix, laser dos cards ou eletricidade do menu.

O badge de desenvolvimento identifica `TESTE VFX-12`; continua ausente na interface do APK de consumidor. `scripts/menu-lottie.test.cjs` acrescenta regressões das novas fontes e de sua integração ao player nativo.

## Atualização local VFX-11 — 05/09/2026

Estas alterações são posteriores ao APK 19 e estão no [APK 20](BUILD-20.md), concluído e verificado. É necessário instalar esse novo APK; elas não chegam automaticamente à versão anterior instalada.

- **Ativar avisos de sorteios (WhatsApp):** botão superior abaixo do texto, ocupando a largura do card, altura mínima de 52 dp, texto de 13 sp e margem adicional de toque de 6 dp. A altura pode crescer com a fonte do sistema. Mostra toque, espera e `SALVANDO…`; desabilita enquanto processa e informa falhas por alerta visível, permitindo nova tentativa. O consentimento segue opcional e independente do push. O botão inferior de notificações nativas mantém o layout anterior.
- **Fundo de Sorteios:** substitui a chuva de troféus por um único Lottie nativo com 12 moedas douradas e três desenhos vetoriais compartilhados, com aro, relevo, giro e reflexos. Ciclo de queda de 18 segundos a 24 fps. Não depende de WebView ou downloads; pausa com app em segundo plano/redução de movimento. As outras abas mantêm seus fundos.
- **Troféu maior nos cards:** animação [Trophy, de Mahendra Bhunwal](https://lottiefiles.com/free-animation/trophy-yEGPe40FVr), obtida na web. Giro em perspectiva já desenhado no Lottie; repete frames 24–50 (fim exclusivo 51) a velocidade 0,45, aproximadamente dois segundos por volta. O recorte elimina a entrada fora de quadro e preserva a taça inteira em slots de 86/88 dp, com player centralizado 1,7×. O card da página inicial mantém 112 dp de altura e reserva espaço para o texto; o card principal de Sorteios mantém cronômetro, dados e ações.
- **Leveza e acessibilidade:** sem dependências novas, sem temporizadores JS por moeda e sem camadas que interceptem toques. O troféu pausa fora do card visível e mostra uma pose frontal quando a animação está desativada. Licença e atribuição acompanham a animação empacotada em `meta.credit`; a cópia original do JSON permanece intacta.

Novos arquivos: `CoinRainBackground.tsx`, `coinRainAnimation.ts`, `TrophyLottie.tsx` e `assets/trophy-*`, dentro de `src/effects/`. Origem e licença completas em `src/effects/assets/README.md` e `trophy-license.json`. `TrophyRain.tsx`/`trophyRainScene.ts` permanecem somente como implementação anterior, sem montagem na tela atual.

`npm run test:push` inclui os testes dos botões; `npm run test:effects` inclui moedas e troféu. Os testes usam fixtures sem rede/consumidores reais. Renderização isolada de Lottie e exportação Android não substituem teste de toque/desempenho no celular.

Validação desta alteração: TypeScript sem erros, 18 testes de push/controles e 30 testes de efeitos aprovados, `git diff --check` limpo. Renderização SVG isolada do Lottie confirmou moedas em movimento e taça inteira nos frames 24/30/37/44/50, sem erros ou requisições de rede. Exportação Android/Hermes local concluída (bundle de 1.923.322 bytes), contendo o botão e os termos completos da licença. Após pedido explícito, foi enviado o APK 20 ao EAS; não houve envio de mensagens ou alteração de dados de clientes nesta etapa.

## Histórico dos efeitos preservados

- Cards principais, OS, agendamento, conta, pacotes, licenças e prêmios: uma luz percorre o contorno em 6 segundos, com uma única ponta branca e cauda contínua em gradiente de opacidade. Não usa os nove trechos repetidos anteriores. O halo compartilha a mesma cauda e relógio; transparência/cor têm paradas alinhadas para não criar máscaras vazias nas retas. Chanfro e sombra de contato permanecem. Não há barra pulsante acima das telas.
- Ícones principais: seis animações Lottie vetoriais locais (início, ferramentas, calendário, foguete, troféu e conta). Sem downloads adicionais. Mensagens de status continuam sendo texto.
- Menu inferior: o botão selecionado recebe plasma procedural ramificado com núcleo branco, halo aditivo e borda chanfrada. A cauda perde energia com a distância; um pequeno buffer auxiliar guarda o rastro temporal, que se dissipa exponencialmente e é limpo ao mudar a seleção/layout. Um único WebView transparente cobre o menu; o centro dos botões fica sem pintura. Reflexos/refração são simulados apenas na borda. Os outros botões têm acabamento estático. Se o renderer falhar, o contorno Lottie volta automaticamente.
- TurboRama: o desenho/tamanho aprovados da nave são preservados, agora com destinos laterais, alturas e profundidades variados a cada 4–6,5 segundos. Movimento com amortecimento crítico, inclinação suave e mudanças de direção sem teletransporte; não há mais a passagem quase estática com reset em profundidade. Os dois motores e a esteira de até 64 partículas acompanham a manobra com inércia. Casco, cockpit e iluminação permanecem. As 100 estrelas mantêm a câmera e velocidade constantes. Os cards continuam translúcidos com texto opaco.
- VFX-07 altera somente o acabamento das turbinas/chama/vapor: anéis metálicos, núcleo quente com halo e reflexos, chama curva que muda de largura/comprimento e ondas que avançam para a ponta. A mesma variação suave de pressão alimenta a luz do motor e da esteira. A fumaça tem volume simulado por três texturas locais de 96×96 com camadas sombreadas, expansão, pequenos redemoinhos, resfriamento e dissipação gradual. Até 64 partículas, sem blur de tela inteira, novas dependências ou novos WebViews. Trajetória, casco, câmera e efeitos aprovados de cards/menu não foram alterados.
- VFX-08: somente a aba Sorteios recebe chuva Matrix de troféus vetoriais, mantendo verde, brilho, dissipação e ritmo de queda (18 px a cada 66 ms). Dois símbolos são desenhados em texturas locais uma única vez, sem fontes de emojis nem downloads. Pausa em segundo plano/redução de movimento. O Matrix de letras das outras páginas, as turbinas e os efeitos dos menus/cards foram preservados.
- VFX-09: os troféus de Sorteios, seu halo e o rastro passam a dourado, com pontas claras e sombras âmbar. Apenas a paleta deste fundo mudou; desenho, velocidade, dissipação e demais páginas permanecem iguais.
- VFX-10: a barra inferior sobe 30 px e mantém uma área livre abaixo dela, evitando sobreposição pelos controles de navegação de aparelhos Android. Não muda o tamanho dos botões, as abas ou os efeitos.

## Arquivos

- `src/effects/animations.ts`: desenhos, cores, keyframes e contornos Lottie.
- `src/effects/cometAnimation.ts`: cauda contínua dos cards comuns, com gradiente móvel e um único ponto de luz. O renderer de energia do menu e seu fallback Lottie foram mantidos sem alterações em VFX-06.
- `src/effects/Neon.tsx`: cards, ícones e reprodução nativa. Decorações não interceptam toques nem entram na leitura de acessibilidade.
- `src/effects/Motion.tsx`: pausa dos novos efeitos fora da tela, em segundo plano e com a opção do sistema de reduzir movimento.
- `src/effects/spaceflightScene.ts`: câmera em perspectiva compartilhada por estrelas, malha da nave e motores/partículas; canvas limitado a aproximadamente 30 fps e densidade máxima de 1,5.
- `src/effects/engineVfx.ts`: somente os motores, chama deformável e vapor sombreado; fonte local literal, com texturas criadas uma única vez por WebView.
- `src/effects/TrophyRain.tsx` e `trophyRainScene.ts`: fundo exclusivo de Sorteios com chuva de troféus em um Canvas; não altera cronômetro, participantes ou ganhadores.
- `src/effects/Spaceflight.tsx`: integração da nave e do fundo à TurboRama.
- `src/effects/flightLayout.ts`: fonte JavaScript literal da câmera/simulação, compartilhada pelos testes e WebView. Não usa `Function.toString()` no Hermes de produção nem avaliação de código no lado nativo.
- `src/effects/ElectricMenu.tsx` e `electricMenuScene.ts`: renderer único do menu, alinhado aos botões pelo `onLayout`, com pausa em segundo plano/redução de movimento e limite de aproximadamente 30 fps.
- `src/effects/PreviewRevision.tsx`: identificação temporária `TESTE VFX-13` no login e na área autenticada da prévia, com estado ativo/pausado das animações. Usa `__DEV__`: não aparece no APK de produção. O diagnóstico não registra dados do consumidor.

O halo combina camadas de traço com [composição aditiva do Canvas](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation). A nave usa projeção 3D e partículas cinemáticas desenhadas em Canvas 2D; não é um simulador físico completo nem refração por ray tracing. A "fumaça" é vapor iônico estilizado, sem gravidade terrestre.

## Validação

```bash
npm run typecheck
npm run test:effects
npx expo-doctor
npx expo export --platform android
```

Os testes verificam dados Lottie, percurso/cauda do LED, filamentos confinados ao contorno, perspectiva/tamanho da nave, velocidade e limites das partículas, deformação real da chama com a nave parada, pressão luminosa sem saltos, expansão/resfriamento do vapor, pausa/retomada, rotação e ausência de loops duplicados. As renderizações de navegador e exportação Android não substituem a conferência em um Android real.

No aparelho, conferir:

1. Entrar normalmente e tocar em todas as seis abas.
2. Observar o laser no contorno, sem cobrir texto, e os ícones animados.
3. Abrir uma OS, pesquisar um serviço, selecionar data/horário e conferir os resultados de sorteios. Não confirmar agendamentos de teste em produção.
4. Na TurboRama, verificar a nave, as estrelas e todos os dados de acesso/licenças/compras.
5. Rolar listas longas, alternar de app e ativar “reduzir/remover animações” nas configurações do sistema.

O APK já instalado não muda com a edição do código: é necessária uma nova compilação para distribuir estes efeitos. O Expo Go pode carregar o código durante desenvolvimento, sem gerar APK.

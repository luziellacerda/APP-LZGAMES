# Efeitos do aplicativo

Somente o app foi alterado. Login, endpoints e regras de OS/agendamento/sorteios permanecem preservados.

- Cards principais, OS, agendamento, conta, pacotes, licenças e prêmios: uma luz percorre o contorno em 6 segundos, com uma única ponta branca e cauda contínua em gradiente de opacidade. Não usa os nove trechos repetidos anteriores. O halo compartilha a mesma cauda e relógio; transparência/cor têm paradas alinhadas para não criar máscaras vazias nas retas. Chanfro e sombra de contato permanecem. Não há barra pulsante acima das telas.
- Ícones principais: seis animações Lottie vetoriais locais (início, ferramentas, calendário, foguete, troféu e conta). Sem downloads adicionais. Mensagens de status continuam sendo texto.
- Menu inferior: o botão selecionado recebe plasma procedural ramificado com núcleo branco, halo aditivo e borda chanfrada. A cauda perde energia com a distância; um pequeno buffer auxiliar guarda o rastro temporal, que se dissipa exponencialmente e é limpo ao mudar a seleção/layout. Um único WebView transparente cobre o menu; o centro dos botões fica sem pintura. Reflexos/refração são simulados apenas na borda. Os outros botões têm acabamento estático. Se o renderer falhar, o contorno Lottie volta automaticamente.
- TurboRama: o desenho/tamanho aprovados da nave são preservados, agora com destinos laterais, alturas e profundidades variados a cada 4–6,5 segundos. Movimento com amortecimento crítico, inclinação suave e mudanças de direção sem teletransporte; não há mais a passagem quase estática com reset em profundidade. Os dois motores e a esteira de até 64 partículas acompanham a manobra com inércia. Casco, cockpit e iluminação permanecem. As 100 estrelas mantêm a câmera e velocidade constantes. Os cards continuam translúcidos com texto opaco.
- VFX-07 altera somente o acabamento das turbinas/chama/vapor: anéis metálicos, núcleo quente com halo e reflexos, chama curva que muda de largura/comprimento e ondas que avançam para a ponta. A mesma variação suave de pressão alimenta a luz do motor e da esteira. A fumaça tem volume simulado por três texturas locais de 96×96 com camadas sombreadas, expansão, pequenos redemoinhos, resfriamento e dissipação gradual. Até 64 partículas, sem blur de tela inteira, novas dependências ou novos WebViews. Trajetória, casco, câmera e efeitos aprovados de cards/menu não foram alterados.
- VFX-08: somente a aba Sorteios recebe chuva Matrix de troféus vetoriais, mantendo verde, brilho, dissipação e ritmo de queda (18 px a cada 66 ms). Dois símbolos são desenhados em texturas locais uma única vez, sem fontes de emojis nem downloads. Pausa em segundo plano/redução de movimento. O Matrix de letras das outras páginas, as turbinas e os efeitos dos menus/cards foram preservados.
- VFX-09: os troféus de Sorteios, seu halo e o rastro passam a dourado, com pontas claras e sombras âmbar. Apenas a paleta deste fundo mudou; desenho, velocidade, dissipação e demais páginas permanecem iguais.

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
- `src/effects/PreviewRevision.tsx`: identificação temporária `TESTE VFX-09` no login e na área autenticada da prévia, com estado ativo/pausado das animações. Usa `__DEV__`: não aparece no APK de produção. O diagnóstico não registra dados do consumidor.

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

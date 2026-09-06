# Handoff completo — LZ-GAMES, do código ao APK

**Atualização: Games Usados está na branch isolada `feature/appgamesusados-marketplace`, entrega [APK 28](BUILD-28.md).** Leia primeiro [produção, moderação, implantação, backup e limitações](GAMES-USADOS-PRODUCAO.md) e o [tutorial atualizado](COMPILACAO-ANDROID.md). Os números e a branch `main` citados no corpo histórico abaixo não incluem a loja. O banco da loja é separado dos demais; credenciais e dados reais não estão no GitHub. O painel administrativo está em `https://sorteios.lzgames.com.br/admin/games-usados`.

**APK atual da loja: [28, concluído e assinatura conferida](BUILD-28.md).** [Baixar APK 28](https://expo.dev/artifacts/eas/CrPbkiJmtDkOOf8T7neFCQC8flwLnxyYd4LMYPJ8urw.apk). As dependências da API também foram corrigidas; consulte [versões, backup, testes e reversão](../server/core/runtime/README.md). A página de compartilhamento do projeto anterior permanece no APK 26 e não foi substituída automaticamente pela branch da loja.

**Histórico do APK 26 / VFX-15:** [registro 26](BUILD-26.md), com [Agenda e confirmação pelo modelo de WhatsApp](AGENDA-DETALHES-E-WHATSAPP.md), Lotties maiores, foguete +30% e código novo a cada compartilhamento. Os 137 testes ali descritos pertencem àquela entrega, não ao total atual.

**Atualização ativa no servidor:** [indicação única global, convite de uso único e correção da agenda por CPF](SEGURANCA-INDICACOES-AGENDA-CPF.md). Leia esse registro para regras, migração, backups, validações e limites antifraude. A proteção de backend já atende aos APKs anteriores; alteração visual não aparece num APK sem nova compilação. Os parágrafos de versões antigas abaixo preservam o histórico.

Atualizações posteriores no servidor: [cashback de 5% pela conclusão da OS, com início na nota nº 480](CASHBACK-SERVICOS-5.md), [bônus de R$ 9,90 pelo primeiro acesso elegível ao app](BONUS-APP-990.md) e [uso do crédito nas notas de serviço](USO-CREDITO-APP.md), todos ativados em etapas distintas. Convite na entrada/cadastro, saldo disponível/usado do crédito sem saque e detalhe do abatimento integram o [APK 23](BUILD-23.md). **Compilação concluída (`FINISHED`), 45 conferências do APK aprovadas e assinatura igual ao APK 22; teste físico pendente.** A fonte passou em 115 testes, TypeScript e Expo Doctor (21/21). [Baixar APK 23](https://expo.dev/artifacts/eas/lmk9ZF4dCElUGq3-G0h3T0l1zIDoSYo96VKtbB9d5VM.apk). Os registros de builds abaixo são históricos.

**Guia histórico da entrega 17 / VFX-09, registrado em 5 de setembro de 2026.** O corpo deste documento preserva os números de versão, comandos de exemplo e resultados daquela entrega; eles não indicam o estado da compilação atual.

Para operar a entrega atual, leia [BUILD-28.md](BUILD-28.md), [operação da loja](GAMES-USADOS-PRODUCAO.md), o [guia de detalhes da Agenda](AGENDA-DETALHES-E-WHATSAPP.md), o [guia de notificações push](NOTIFICACOES-PUSH.md) e o [tutorial de compilação Android](COMPILACAO-ANDROID.md). O restante deste documento descreve a entrega histórica 17; versões, comandos e resultados históricos não substituem os registros atuais.

Consulta somente leitura do build atual: `npx --no-install eas-cli build:view f101a096-2892-48ba-8ce9-702a0975243d`. `versionCode 28` já foi concluído; conferir o histórico EAS antes de escolher outro número. Não compilar novamente apenas para consultar.

Ao preparar outro computador, restaure o `google-services.json` do projeto Firebase existente, pois ele é ignorado pelo Git. Não copie a chave privada FCM para o repositório ou pacote do app. Antes de compilar, execute `npm run check:push`, `npm run typecheck`, `npm run test:push` e os demais testes do tutorial atualizado. A validação local não comprova entrega no celular; os limites e o roteiro de teste físico estão no guia de push.

Este guia histórico ajuda uma pessoa a assumir o projeto, preparar outro computador, testar, modificar, salvar no GitHub, compilar e instalar o aplicativo. O produto descrito é **um aplicativo Android para clientes**. Ele reúne assistência/OS, agenda, TurboBox/TurboRama e sorteios; a branch atual acrescenta Games Usados. O repositório contém o aplicativo e integrações selecionadas em `server/`, não dados reais, credenciais ou todos os projetos completos dos servidores.

## 1. Comece entendendo os quatro lugares

| Lugar                         | O que fica nele                                    | O que ele não faz sozinho                                  |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Computador de desenvolvimento | Código editável, dependências e servidor de testes | Não atualiza um APK já instalado                           |
| GitHub                        | Histórico e cópia compartilhada do código          | Um `push` não instala o app no celular                     |
| Expo / EAS Build              | Compilação e assinatura do APK                     | Não publica na Play Store sem uma ação de envio            |
| Servidores LZ-GAMES           | Login, clientes, OS, agenda, pacotes e sorteios    | Não substituem a compilação de uma alteração visual do app |

Fluxo normal:

```text
Baixar código → instalar dependências → editar/testar → aumentar versionCode
→ commit e push → enviar ao EAS → aguardar FINISHED → baixar APK → instalar/testar
```

`APK` é o arquivo para instalar diretamente no Android. `AAB` é o arquivo destinado à Play Store, não à instalação direta. O perfil `preview` deste projeto produz **APK de distribuição interna**, sem depender do servidor de testes para abrir. [Referência oficial sobre APK/AAB](https://docs.expo.dev/build-reference/apk/).

## 2. Identificação que deve ser preservada

| Informação                                 | Valor desta entrega                                |
| ------------------------------------------ | -------------------------------------------------- |
| Nome no celular                            | `LZ-GAMES`                                         |
| Repositório                                | `https://github.com/luziellacerda/APP-LZGAMES.git` |
| Branch de entrega                          | `main`                                             |
| Projeto Expo                               | `@lzgames/lz-games`                                |
| Owner Expo                                 | `lzgames`                                          |
| Slug Expo                                  | `lz-games`                                         |
| EAS projectId                              | `e16e4972-a5ab-4e40-9b50-25eb952c889c`             |
| Pacote Android                             | `br.com.lzgames.app`                               |
| Versão visível                             | `1.0.0`                                            |
| Número interno enviado                     | `17`                                               |
| Identificação da prévia de desenvolvimento | `TESTE VFX-09`                                     |
| Diretório na máquina desta entrega         | `/home/lz-servidor/projetos/APP-LZGAMES`           |

O caminho local pode ser diferente no seu computador. Nome, owner, projectId, pacote e chave de assinatura **não devem ser trocados ao atualizar este mesmo aplicativo**.

O aviso `TESTE VFX-09` usa `__DEV__` e não aparece na interface do APK de produção. Ele não é a versão Android: a versão interna está em `app.json` → `expo.android.versionCode`.

## 3. O que está entregue

- Login/cadastro, navegação inferior e acesso aos serviços existentes.
- OS expansíveis, com dados da ordem, consumidor/nota, equipamento, valores e atendimento, conforme a resposta do servidor.
- Agenda com pesquisa de serviço, setores, calendário e horários consumidos das APIs existentes; preços não são apresentados na escolha do orçamento.
- TurboRama com dados de acesso, pacotes, licenças e histórico de compras.
- Sorteios com cronômetro, participação e ganhadores consumidos do servidor.
- Cards com uma luz percorrendo a borda, cauda contínua que desaparece e ícones Lottie locais.
- Eletricidade no contorno do botão selecionado do menu inferior.
- Nave pequena em voo variável no fundo da TurboRama, com turbinas luminosas, chama deformável e vapor sombreado.
- Chuva Matrix **de troféus dourados** somente na aba Sorteios. As outras páginas que usavam letras continuam usando letras; a Agenda mantém seu fundo de estrelas.
- Testes dos efeitos e documentação de manutenção.

Esta rodada alterou o aplicativo. Não alterou sites, DNS, bancos, contas de clientes nem enviou mensagens de WhatsApp de teste.

## 4. Preparar um computador do zero

### 4.1 Ferramentas

Instale Git, Node.js, um editor e tenha acesso às contas GitHub/Expo autorizadas:

- [Download oficial do Git](https://git-scm.com/downloads).
- [Download oficial do Node.js](https://nodejs.org/en/download). O npm acompanha o Node.
- Um editor de texto/código, por exemplo VS Code.
- Expo Go compatível com o SDK do projeto no celular, se for usar a prévia.

Ambiente efetivamente usado nesta entrega: **Node 24.20.0, npm 11.19.0 e EAS CLI 23.2.0**. As versões do app estão fixadas no `package-lock.json`: Expo 57.0.20, React Native 0.86.3, React 19.2.3, Lottie 7.3.8, WebView 13.16.1 e TypeScript 6.0.3.

Para reproduzir o ambiente, use Node 24 compatível. Não instale um Node antigo. O `engines.node` do React Native instalado aceita `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.0.0`; isso é uma exigência da dependência, não uma indicação para atualizar todo o projeto.

Abra o Terminal no Linux/macOS ou PowerShell no Windows. Digite um comando por vez, sem copiar os sinais de formatação do documento:

```bash
git --version
node --version
npm --version
```

Cada comando deve mostrar uma versão. Se disser que não foi encontrado, conclua a instalação e abra novamente o terminal. Android Studio/Java/Gradle locais não são necessários para o fluxo **de compilação em nuvem** descrito aqui; são necessários em outros fluxos, como emulador ou compilação nativa local.

### 4.2 Criar sua cópia de trabalho

Escolha uma pasta de projetos e execute:

```bash
git clone https://github.com/luziellacerda/APP-LZGAMES.git
cd APP-LZGAMES
git branch --show-current
git status --short
npm ci
```

Resultado esperado: branch `main`, código baixado e dependências instaladas. O `npm ci` usa o arquivo de versões já aprovado e recria **somente `node_modules`**; não recria o código-fonte.

Esse é o modo de “criar o app” em outro computador com todas as telas entregues. Não execute um gerador de projeto vazio por cima dessa pasta, nem copie só `App.tsx`: o app precisa de `src`, `assets`, configurações e dependências.

Se quiser começar um aplicativo diferente do zero, crie outro diretório/projeto e siga o [guia inicial oficial do Expo](https://docs.expo.dev/build/setup/). Ele não recriará automaticamente este produto. Não reutilize a identidade ou a assinatura da LZ-GAMES em um app diferente.

### 4.3 Quando você já possui uma cópia

```bash
cd APP-LZGAMES
git status --short
```

Se houver alterações que você quer manter, revise e salve-as antes de atualizar. **Não use `git reset --hard`, não apague arquivos e não force um pull para contornar conflito.** Se a árvore estiver limpa:

```bash
git switch main
git pull --ff-only origin main
npm ci
```

Se o `--ff-only` recusar, há divergência: examine o histórico antes de integrar. Não use `push --force`.

## 5. Contas, configuração e segurança

### Expo não é GitHub

Ter acesso ao GitHub não significa estar autenticado no Expo. Entre com a conta Expo autorizada ou com uma conta convidada ao projeto:

```bash
npx eas-cli login
npx eas-cli whoami
npx eas-cli project:info
```

Confira `@lzgames/lz-games` e o projectId da seção 2. Não crie um segundo projeto EAS por engano. O repositório já tem `eas.json` e o vínculo com o Expo; não é necessário reinicializá-los.

O comando `npx` executa a ferramenta sem exigir que ela esteja instalada globalmente. Para reproduzir especificamente a versão de CLI usada nesta entrega, substitua `npx eas-cli` por `npx eas-cli@23.2.0`.

### Assinatura Android

Esta entrega usa o **keystore remoto já existente no Expo**. Preserve-o: uma atualização precisa da mesma identidade e assinatura da instalação anterior.

Não gere uma chave nova para “resolver” um aviso. Se aparecer pedido de novas credenciais ou permissões, pare e peça ao responsável pelo projeto. Não publique chaves, senhas, tokens ou dados reais de clientes neste repositório.

### Ambiente e URLs

Para o APK normal, o perfil `preview` já define a API TurboBox de produção no `eas.json`. `src/api.ts` contém também as outras bases:

| Sistema         | Base utilizada pelo app                         | Uso principal                                           |
| --------------- | ----------------------------------------------- | ------------------------------------------------------- |
| TurboBox/mobile | `https://turbobox.lzgames.com.br/api/mobile/v1` | Login, home, compras, licenças e confirmação de reserva |
| Central/CORE    | `https://app.lzgames.com.br/api`                | Login/cadastro, OS e agendamentos do cliente            |
| Agenda do site  | `https://app.lzgames.com.br/sistema/agenda/`    | Catálogo de serviços e disponibilidade                  |
| Sorteios        | `https://sorteios.lzgames.com.br/api`           | Estado ao vivo, participantes e resultados públicos     |

`EXPO_PUBLIC_API_URL` troca a base TurboBox; `EXPO_PUBLIC_CORE_API_URL` troca a base CORE. **Essas variáveis não trocam automaticamente Agenda e Sorteios**, cujas bases estão definidas no código. Toda variável `EXPO_PUBLIC_*` é pública no aplicativo: não serve para guardar segredo.

Não é necessário criar `.env` para compilar a configuração atual. Se o responsável fornecer um ambiente de homologação, configure as bases correspondentes e confira a configuração antes de testar operações de escrita.

O app acessa **APIs HTTPS**, não bancos diretamente. Banco, SMTP, provedor WhatsApp e implementação das APIs precisam de um handoff separado do servidor. Nenhuma credencial dessas deve entrar no app.

## 6. Conhecer o código antes de alterar

| Arquivo/pasta                                                           | Responsabilidade                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `App.tsx`                                                               | Login/cadastro, navegação, sessão, carregamento, escolha do fundo por aba |
| `src/api.ts`                                                            | Requisições, duas sessões, normalização e contratos de dados              |
| `src/ServiceOrderCard.tsx`                                              | Abertura dos detalhes de cada OS                                          |
| `src/AgendaBooking.tsx`                                                 | Pesquisa de serviços, calendário, horários e confirmação                  |
| `src/TurboRamaDetails.tsx`                                              | Acesso, pacotes, licenças e compras                                       |
| `src/RaffleDetails.tsx`                                                 | Cronômetro, participação, prêmios e ganhadores                            |
| `src/MatrixRain.tsx`                                                    | Matrix de letras nas páginas originais                                    |
| `src/HyperspaceBackground.tsx`                                          | Estrelas da Agenda                                                        |
| `src/effects/Neon.tsx`, `animations.ts`, `cometAnimation.ts`            | Cards luminosos e ícones Lottie                                           |
| `src/effects/ElectricMenu.tsx`, `electricMenuScene.ts`                  | Eletricidade do menu inferior                                             |
| `src/effects/Spaceflight.tsx`, `spaceflightScene.ts`, `flightLayout.ts` | Integração, desenho, câmera e trajetória da nave                          |
| `src/effects/engineVfx.ts`                                              | Turbinas, chama e vapor; não controla a trajetória                        |
| `src/effects/TrophyRain.tsx`, `trophyRainScene.ts`                      | Matrix de troféus dourados exclusivo de Sorteios                          |
| `src/effects/Motion.tsx`                                                | Pausa dos novos efeitos por visibilidade/estado/redução de movimento      |
| `src/effects/PreviewRevision.tsx`                                       | Etiqueta de diagnóstico somente no desenvolvimento                        |
| `assets/`                                                               | Ícones do app e imagem de abertura                                        |
| `app.json`                                                              | Identidade, ícones, versão Android e projeto Expo                         |
| `eas.json`                                                              | Perfis APK/AAB e ambiente da compilação                                   |
| `package.json`, `package-lock.json`                                     | Comandos e versões das dependências                                       |
| `babel.config.js`, `tsconfig.json`                                      | Transformação do código e verificação TypeScript                          |
| `scripts/effects.test.cjs`                                              | 18 testes automatizados dos efeitos nesta entrega                         |
| `play-store/`                                                           | Materiais da loja; não é o código das APIs                                |

Edite somente a área solicitada. Por exemplo, a cor da chuva de troféus está em `trophyRainScene.ts`; não é necessário mudar o Matrix do login, as cores do menu, os dados dos sorteios ou a nave.

Os cenários Canvas usam JavaScript literal local, não `Function.toString()`: a serialização de função não é confiável no bytecode Hermes de produção. Preserve essa separação. Consulte [a documentação dos efeitos](EFEITOS-VISUAIS.md) para limites, aparência e testes.

### Dependência externa do login

Os ícones novos do menu são locais. Já o Lottie original do login continua vindo de `https://turbobox.lzgames.com.br/assets/lottie/login-original.json?v=20260826-8`. O funcionamento dessa animação depende desse recurso remoto. Não confunda esse JSON com uma atualização automática de todo o aplicativo.

## 7. Entender as integrações e seus limites

O login tenta a central CORE por telefone/WhatsApp e a API TurboBox com o login informado. As sessões ficam em chaves separadas no SecureStore. Uma autenticação pode funcionar e a outra não; entrar no app não prova acesso a todos os sistemas.

Rotas principais existentes no cliente:

| Ação                       | Chamada                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| Login CORE                 | `POST CORE/auth/login`                                               |
| Cadastro novo              | `POST CORE/auth/register`                                            |
| OS do consumidor           | `GET CORE/me/orders`                                                 |
| Agenda do consumidor       | `GET CORE/me/agenda`                                                 |
| Login TurboBox             | `POST BOX/auth/login`                                                |
| Home/pacotes/licenças      | `GET BOX/home`                                                       |
| Serviços da agenda         | `GET AGENDA?a=listServicos`                                          |
| Horários                   | `GET AGENDA?a=slots&data=AAAA-MM-DD&servico_id=ID`                   |
| Confirmação de agendamento | `POST BOX/agenda/book`                                               |
| Sorteios                   | `GET RAFFLE/live`, `/participantes-publicos`, `/resultados-publicos` |

Pontos importantes para o próximo responsável:

1. **Cadastro e reserva usam sessões diferentes.** O cadastro atual armazena a sessão CORE e limpa a sessão BOX; `bookAgenda` exige a sessão BOX. Um cliente apenas cadastrado no CORE pode precisar de vínculo/login no outro sistema para confirmar reserva. Isso precisa ser validado funcionalmente; não foi corrigido ou reconfigurado nesta rodada visual.
2. `loadHome` usa `Promise.allSettled` e fallbacks. Uma API com erro pode resultar em listas vazias enquanto outras áreas carregam. Investigue resposta/status e vínculo, não conclua automaticamente que o banco está vazio.
3. Disponibilidade, feriados, pausas e ocupação vêm do servidor da agenda. O texto “intervalos de 1 hora” no app não altera a regra do banco. Não libere horários manualmente no desenho da tela para mascarar um erro da API.
4. O componente exibe confirmação de WhatsApp após a resposta de reserva. **Essa mensagem de tela não é comprovante de entrega do WhatsApp**; entrega deve ser conferida no serviço do servidor.
5. A participação nos sorteios é correlacionada pelo nome normalizado no cliente atual. Homônimos e divergências de cadastro precisam de cuidado. Esse comportamento foi preservado, não refeito neste trabalho.
6. Campos como “vitalício” são apresentados pela interface atual em pacotes/licenças. A autorização real continua sendo do servidor. Não use uma alteração de texto como mecanismo de acesso.

Os testes desta entrega não criaram clientes, não reservaram vagas e não enviaram mensagens reais. Para teste de ponta a ponta, use contas e números de teste aprovados pelo responsável.

## 8. Abrir a prévia no celular

Na raiz do projeto:

```bash
npx expo start --tunnel --port 8082 --clear
```

O terminal deve apresentar QR code e um endereço `exp://...`. Deixe esse terminal e computador ligados. Abra o endereço no Expo Go compatível com o projeto. Na máquina desta entrega, a prévia estava em `exp://koz1rba-lzgames-8082.exp.direct`.

Esse endereço é **temporário**, não é o site de produção nem o APK. Pode mudar ao reiniciar o túnel; use sempre o endereço que o terminal exibir. Se a porta estiver ocupada, não inicie outro servidor com o mesmo endereço esperando substituir o anterior. Identifique o servidor existente ou use outra porta e o novo link.

Após editar, salve o arquivo. Se o telefone estiver com conteúdo antigo, confira o terminal, reabra a prévia e use o recarregamento do Expo Go. A etiqueta atual é `TESTE VFX-09`. Ela não aparecerá no APK release.

Para encerrar **o seu servidor de desenvolvimento**, use `Ctrl+C` no terminal que o iniciou. Isso não cancela um build remoto enviado ao EAS.

## 9. Testar antes de gastar uma compilação

```bash
npm run typecheck
npm run test:effects
npx expo-doctor
git diff --check
```

Execute um por vez e não prossiga se algum terminar com erro. Nesta entrega: TypeScript sem erros, **18 testes aprovados**, **21/21 verificações do Expo Doctor** e nenhuma falha de whitespace no diff.

O teste dos efeitos valida desenho/animação, pausas, limites e integração das abas; não substitui um teste de todas as funções com um consumidor real. Renderizações de navegador também foram verificadas, mas não são uma certificação de desempenho em todos os Androids.

Checklist manual antes de distribuir:

- Abrir login, digitar sem o teclado cobrir os campos e entrar com conta autorizada.
- Abrir e fechar detalhes de uma OS e conferir os campos retornados.
- Pesquisar serviço na Agenda; selecionar data; confirmar que horários ocupados não podem ser escolhidos e que preços não aparecem nessa escolha.
- Conferir dados de acesso, licenças e compras da TurboRama; senha não deve ser exibida.
- Conferir cronômetro e resultados de Sorteios; fundo com troféus dourados.
- Navegar pelas seis abas, rolar listas, voltar do segundo plano e testar a opção do Android de reduzir/remover animações.
- Conferir os ícones e margens da tela no aparelho de destino.
- Só efetuar cadastro/reserva/WhatsApp de ponta a ponta em um cenário autorizado de testes.

## 10. Preparar a próxima versão

O projeto usa `cli.appVersionSource: "local"` em `eas.json`. A numeração vem do `app.json`. O perfil APK `preview` não incrementa sozinho. [Referência oficial sobre versões](https://docs.expo.dev/build-reference/app-versions/).

Antes de mudar o número, consulte os builds recentes:

```bash
npx eas-cli build:list --platform android --limit 5 --non-interactive
```

Se a versão 17 estiver em andamento ou concluída, a próxima atualização deverá ter um número maior, por exemplo 18. Edite somente o campo correspondente em `app.json`:

```json
"android": {
  "package": "br.com.lzgames.app",
  "versionCode": 18
}
```

Esse é um **trecho ilustrativo**: não substitua o arquivo inteiro por ele, pois os ícones e demais opções também são necessários. A versão que acompanha este handoff ainda é a **17**; não reenvie outro 17 sem antes verificar a intenção e o histórico.

Também não é preciso aumentar a etiqueta VFX para cada build. VFX identifica a revisão visual de testes; `versionCode` identifica a atualização Android.

## 11. Salvar e enviar tudo que faz parte do projeto ao GitHub

“Tudo” significa código, configurações públicas, testes, assets e documentação. **Não** significa subir `node_modules`, credenciais, bancos de clientes ou APKs antigos.

Revise primeiro:

```bash
git status --short
git diff --stat
git diff
```

Depois selecione os arquivos do projeto:

```bash
git add App.tsx app.json eas.json package.json package-lock.json babel.config.js tsconfig.json .gitignore README.md src assets scripts docs play-store
git diff --cached --stat
git diff --cached --check
git diff --cached
```

As pastas `play-store` podem conter arquivos APK/AAB locais; a regra atual do `.gitignore` os exclui. Não use `git add -f` para contornar essa proteção. Confirme que não existe senha, token ou informação pessoal real no conteúdo selecionado.

Se tudo estiver correto:

```bash
git commit -m "Atualiza app e documentacao da nova versao"
git push origin main
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

O último hash do GitHub deve corresponder ao commit enviado. Se o push falhar por autenticação ou divergência, resolva o acesso/integração; não force o envio. Autenticação HTTPS pode usar o gerenciador de credenciais do GitHub/Git; nunca coloque token na URL do remote ou no texto do documento.

## 12. Conferir o que será enviado ao Expo

O build iniciado pelo CLI empacota os arquivos locais elegíveis; não basta olhar apenas o último commit. Arquivos novos precisam estar presentes e não podem estar excluídos por `.gitignore`/`.easignore`. Nesta entrega isso foi conferido antes do envio.

Para inspecionar sem iniciar um build remoto, use uma pasta de saída **nova e fora do projeto**:

```bash
npx eas-cli build:inspect --platform android --profile preview --stage archive --output ../lz-games-inspecao-build18
```

Confira `app.json`, `App.tsx`, `src/effects` e os assets nessa pasta. Não use `--force` sobre uma pasta com arquivos seus. Não coloque a pasta de inspeção dentro do projeto, para não incluí-la no próximo envio.

Exemplo de conferência da versão:

```bash
node -p "require('./app.json').expo.android.versionCode"
```

O `eas.json` deste repositório já contém:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": {
    "EXPO_PUBLIC_API_URL": "https://turbobox.lzgames.com.br/api/mobile/v1"
  }
}
```

Não altere esse perfil para `developmentClient` para gerar o APK normal do consumidor.

## 13. Enviar para compilar o APK

Confira a conta e se não há um envio duplicado em andamento:

```bash
npx eas-cli whoami
npx eas-cli build:list --platform android --limit 5 --non-interactive
```

Para enviar a atualização e liberar o terminal sem esperar a compilação terminar:

```bash
npx eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message "LZ-GAMES APK 18 - descreva a alteracao"
```

Use o número real preparado no `app.json`, não copie “18” automaticamente. O texto de `--message` é apenas a descrição do build, não muda a versão do app.

Você deve ver confirmação do uso da chave remota existente, upload do projeto e um **link do build no Expo**. Guarde esse link e o identificador. O comando terminar após o envio significa **enviado**, não **APK pronto**.

O `--freeze-credentials` evita alteração automática das credenciais no modo não interativo. Se o comando exigir novas credenciais, não recrie a assinatura: confira o acesso com o responsável.

Para acompanhar pelo próprio terminal, uma alternativa é omitir `--no-wait`. Não execute as duas alternativas para a mesma atualização. Fechar o terminal depois do envio não cancela o build remoto.

Compilações utilizam os limites/créditos/plano da conta Expo. Não foi contratado ou alterado plano nesta entrega. Se o serviço pedir pagamento, aumento de plano ou autorização financeira, confira isso com o responsável; não repita envios como tentativa de acelerar a fila.

## 14. Acompanhar, baixar e instalar

Consulta do build 17 desta entrega:

```bash
npx eas-cli build:view 9f77f237-9729-48b4-bea2-e79d385df26c
```

Para outros builds, substitua pelo ID retornado no seu envio. Não use o ID antigo para verificar uma atualização nova.

| Estado            | Significado         | Próxima ação                                            |
| ----------------- | ------------------- | ------------------------------------------------------- |
| `NEW`, `IN_QUEUE` | Recebido/aguardando | Aguardar; não enviar duplicado                          |
| `IN_PROGRESS`     | Compilando          | Abrir o link e acompanhar logs                          |
| `FINISHED`        | Artefato gerado     | Baixar o `.apk`                                         |
| `ERRORED`         | Falhou              | Ler o primeiro erro relevante antes de tentar novamente |
| `CANCELED`        | Cancelado           | Confirmar a intenção antes de reenviar                  |

Quando constar `FINISHED`, abra a página do build e use o download/instalação. O APK pode ser repassado aos testadores sem Play Store. Os links de artefatos podem expirar; isso não equivale a prazo de validade do arquivo APK já baixado.

Também é possível obter o endereço do artefato:

```bash
npx eas-cli build:view 9f77f237-9729-48b4-bea2-e79d385df26c --json
```

Procure `artifacts.buildUrl` ou `artifacts.applicationArchiveUrl`. Não confunda essas URLs com a página de logs. Não publique o JSON completo se ele contiver links temporários assinados ou metadados da conta.

No telefone:

1. Baixe o `.apk` concluído pelo navegador.
2. Se o Android pedir, autorize **esse navegador/gerenciador de arquivos** a instalar apps dessa origem.
3. Abra o arquivo e instale/atualize.
4. Abra LZ-GAMES, entre e execute o checklist da seção 9.

Não desinstale o app antigo como primeira tentativa: isso pode apagar a sessão/dados locais. Uma atualização normal depende de mesmo pacote, mesma assinatura e versão adequada.

Opcional, para técnico com ADB e aparelho autorizado:

```bash
adb devices
adb install -r LZ-GAMES-build17.apk
```

Esse nome presume que você salvou o APK baixado com esse nome. ADB não é obrigatório para instalar pelo navegador.

## 15. O que muda automaticamente e o que precisa de novo APK

- **Dados do servidor:** podem aparecer atualizados quando o app consulta/atualiza as APIs, conforme a implementação.
- **Código local e GitHub:** editar/commitar/enviar código não substitui o APK instalado.
- **Prévia Expo:** carrega o código do servidor de desenvolvimento ativo, por isso muda sem gerar APK.
- **APK distribuído:** este projeto não tem um fluxo de publicação OTA EAS Update configurado no `eas.json`/app entregue. Para distribuir a alteração visual atual, gere e instale um novo APK.
- **Login Lottie remoto:** é uma dependência específica; o fato de um recurso remoto mudar não significa que todo o app se atualiza por GitHub.

Não prometa a um consumidor que basta atualizar a página do site ou fazer `git push` para instalar uma nova versão do aplicativo.

## 16. Play Store é um fluxo separado e opcional

O pedido desta entrega foi um APK. **Não foi solicitada publicação na Play Store.**

Quando houver autorização específica e a conta estiver apta, o perfil `production` gera AAB e tem `autoIncrement: true`. Confira a versão antes/depois, pois o projeto usa versionamento local:

```bash
npm run build:android:production
```

O envio à loja é outra ação. O perfil de submissão atual aponta para a faixa interna em rascunho. Não execute `npm run submit:android` apenas para instalar no celular. Verifique ficha, documentos da conta, segurança de dados, acesso dos revisores e exigências atuais diretamente no Play Console. Este handoff não comprova aprovação cadastral ou publicação.

## 17. Erros comuns, sem destruir o projeto

| Problema                                | Conferência/ação segura                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `eas: command not found`                | Use `npx eas-cli ...`, como no guia                                                                                        |
| PowerShell bloqueia `npm.ps1`           | Use `npm.cmd`/`npx.cmd` ou o Prompt de Comando; não reduza políticas do sistema indiscriminadamente                        |
| Prévia mostra versão antiga             | Confira URL/porta e servidor ativo, salve, recarregue e confira a etiqueta VFX                                             |
| Túnel não abre                          | Veja se o processo ainda está ativo; use o novo link do terminal ao reiniciar                                              |
| Expo Go acusa SDK incompatível          | Confira compatibilidade do cliente com SDK 57; não atualize dependências do projeto às cegas                               |
| Android informa arquivo inválido        | Confira se baixou `.apk`, não `.aab` ou uma página HTML; baixe novamente                                                   |
| APK não atualiza sobre o anterior       | Confira assinatura, pacote e `versionCode`; não gere keystore novo                                                         |
| Tela abre, mas faltam OS/agenda/pacotes | Confira login/vínculo CORE e BOX e resposta das APIs; veja a seção 7                                                       |
| Todos os dias sem vaga                  | Selecione serviço, inspecione resposta de slots e regras do servidor; não pinte horários falsamente livres                 |
| Não chegou WhatsApp                     | Conferir resposta de reserva e logs de entrega no backend; o texto da tela não basta                                       |
| Efeito não anima                        | Confira estado ativo do app e redução de movimento do Android; não desative acessibilidade para esconder o problema        |
| Build falhou                            | Abra os logs, encontre o primeiro erro e preserve o ID antes de corrigir/repetir                                           |
| Suspeita de cache remoto                | Após confirmar código/arquivo enviado, use `--clear-cache` em uma nova tentativa necessária; não é requisito de todo build |
| Git recusa push                         | Resolva acesso ou divergência do branch sem `--force`                                                                      |

## 18. Registro desta compilação e fechamento

O registro factual do APK 17, concluído com sucesso, seu link de download, conteúdo e validações está em [BUILD-17.md](BUILD-17.md).

Nesta entrega, o pedido de subir ao GitHub chegou **depois** do envio ao EAS. Por isso a sequência real foi: testes → arquivo de envio conferido → upload do build 17 → documentação → commit/push. O CLI enviou os arquivos locais atuais, incluindo os efeitos novos ainda não commitados naquele instante. O campo de commit no Expo pode mostrar a base anterior `72e0e30`; ele, sozinho, não descreve as alterações locais incluídas no pacote. O registro do build contém uma conferência do conteúdo.

Documentação escrita depois do envio não altera a aparência do APK e não exige outra compilação. Para as próximas entregas, siga a ordem da seção 1 para associar o build ao commit já salvo.

Antes de passar o trabalho à próxima pessoa, entregue:

- Acesso autorizado ao repositório e ao projeto Expo, sem compartilhar senhas no documento.
- Link do commit/branch entregue e árvore local sem pendências não explicadas.
- Número da versão, ID/link e estado da compilação.
- APK concluído, quando disponível, e aparelho/fluxos em que foi testado.
- Lista do que ainda depende de validação funcional, especialmente integração CORE/BOX e entrega de WhatsApp.
- Este guia, [o tutorial de compilação](COMPILACAO-ANDROID.md) e [o mapa dos efeitos](EFEITOS-VISUAIS.md).

Não há garantia de “consumidor final aprovado” apenas por passar TypeScript, Expo Doctor ou compilação. A instalação e os testes funcionais no aparelho continuam sendo uma etapa de aceite.

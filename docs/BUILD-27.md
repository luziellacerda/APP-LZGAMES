# APK 27 — Games Usados

Preparado em 06/09/2026 por solicitação do usuário. Consulte o estado no EAS antes de repetir qualquer envio.

- Branch isolada: `feature/appgamesusados-marketplace`; `main` preservada.
- Android APK, perfil `preview`, versão `1.0.1`, `versionCode 27`.
- Nome/pacote preservados: `LZ-GAMES`, `br.com.lzgames.app`.
- Inclui Games Usados: catálogo, busca, painel do vendedor, até cinco fotos, vídeo curto, reservas e acompanhamento de pedidos. Mídia comprimida no servidor e banco independente dos sistemas existentes.
- Preserva Agenda, OS, TurboRama, sorteios, indicações e notificações.
- Pré-validação: 141 testes aprovados, TypeScript sem erros, Firebase cliente válido e Expo Doctor 21/21.
- Crédito de builds consultado antes do envio: 48% utilizado, cobrança adicional reportada igual a zero; sem compra ou alteração de plano.

## Compilar (somente para um novo envio autorizado)

```bash
npm run check:push
npx --no-install eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 27 - Games Usados com catalogo, anuncios, midia e reservas'
```

Este APK não é uma publicação na Play Store. Teste físico de interface, seleção de mídia e notificações continua necessário após a compilação.

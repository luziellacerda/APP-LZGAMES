# LZ Games Mobile

Aplicativo único para clientes dos serviços TurboBox e TurboRama.

## Executar

```bash
npm install
npm run android
```

A API padrão é `https://turbobox.lzgames.com.br/api/mobile/v1`. Para desenvolvimento:

```bash
EXPO_PUBLIC_API_URL=http://IP-DO-SERVIDOR:8080/api/mobile/v1 npm start
```

O aplicativo nunca acessa SQLite ou PostgreSQL diretamente. A autenticação usa token aleatório armazenado pelo SecureStore; no servidor apenas o hash do token é persistido.

# Dependências da API compartilhada — revisão 28

Este diretório registra `package.json` e `package-lock.json` da API Node em `/home/lz-servidor/Documentos/lzgames/api`. Não é um segundo backend completo nem o pacote npm do aplicativo Expo. Não trocar o `package.json` da raiz do app por este arquivo.

## Correção aplicada em 06/09/2026

A auditoria de dependências de produção indicou dez pacotes afetados: seis com severidade alta e quatro moderada. As correções foram preparadas numa pasta temporária isolada, mantendo as versões principais das dependências diretas:

| Dependência | Antes | Implantada |
| --- | --- | --- |
| axios | 1.13.2 | 1.20.0 |
| express | 4.21.2 | 4.22.2 |
| mysql2 | 3.15.3 | 3.24.3 |
| morgan | 1.10.1 | 1.12.0 |
| jws, transitiva | 3.2.2 | 3.2.3 |
| qs, transitiva | 6.13.0 | 6.16.0 |

Outras transitivas foram atualizadas conforme o lockfile. `multer` permaneceu em 2.3.0; React Native/Expo não foram atualizados. Existe um override explícito `qs: 6.16.0`, pois Express 4.22.2 ainda restringe essa dependência à faixa 6.15.x. A versão 6.16.0 contém a correção do problema de `isBuffer`; revisar o override quando o fornecedor incorporar a faixa corrigida. Referências: [Express 4.22.2](https://github.com/expressjs/express/releases/tag/v4.22.2), [qs 6.16.0](https://github.com/ljharb/qs/releases/tag/v6.16.0), [aviso de segurança](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).

Após a instalação e novamente após a implantação: `npm audit --omit=dev` retornou zero alertas conhecidos. Esse resultado corresponde à consulta desta data, não é garantia de ausência de vulnerabilidades e deve ser repetido periodicamente.

## Testes realizados

- Sete testes de compatibilidade do runtime: montagem das rotas atuais, recusa de acesso anônimo aos módulos, CORS, cabeçalhos, JWT válido/inválido/expirado, bcrypt/bcryptjs, parsing de filtros e JSON, limite de corpo, regressão de qs, requisição Axios local e carregamento de mysql2. Sem usuários, banco ou integrações reais nessa suíte.
- Dez testes de integração do marketplace com HTTP, MariaDB e PHP, usando somente tabelas fictícias com prefixo aleatório e cleanup. Repetidos com dependências isoladas e implantadas.
- Health público 200, rotas privadas de clientes/OS/agenda/benefícios/indicações/loja 401 sem token.
- Conexões dos cinco pools reais conferidas exclusivamente por `SELECT 1`; nenhum dado de cliente consultado ou modificado.

```sh
cd /home/lz-servidor/projetos/APP-LZGAMES
LZ_API_RUNTIME_FIXTURE=/home/lz-servidor/Documentos/lzgames/api node --test server/core/tests/runtime-smoke.cjs
npm run test:marketplace:sql
cd /home/lz-servidor/Documentos/lzgames/api
npm audit --omit=dev
```

Para testar outra instalação npm sem trocar a API ativa, informe seu diretório em `LZ_API_RUNTIME_FIXTURE` e `LZ_MARKETPLACE_RUNTIME`. O primeiro teste intercepta banco e configuração JWT com fixtures locais; não disponibilize esse harness como endpoint público. O segundo exige a configuração privada do servidor e usa somente tabelas isoladas.

## Instalação e reversão

Antes de outra instalação, comparar a fonte ativa com este snapshot. Preparar os dois manifests numa pasta nova e instalar com `npm ci --omit=dev --ignore-scripts`; o conjunto atual já inclui o binário bcrypt necessário e foi testado. Executar as suítes acima apontando para essa pasta. Não rodar `npm audit fix --force` diretamente na API ativa, nem atualizar para Express 5 incidentalmente.

Backup desta implantação: `/home/lz-servidor/.config/lzgames/backups/api-runtime-28-VCpi8T/`, privado. Conserva os dois manifests anteriores e o diretório `node_modules` anterior integral. Nenhum segredo desse backup deve ir para Git ou Expo.

Após os testes, foram aplicados os manifests, preservadas as dependências anteriores e movido para a API o diretório já instalado/testado. O processo de `lzgames-api.service`, pertencente ao próprio usuário e com `Restart=always`, recebeu SIGTERM no PID conferido; systemd reiniciou a API e as verificações foram repetidas. Regras de negócio e dados dos módulos existentes não foram alterados.

Em caso de regressão, o operador deve planejar uma janela curta, preservar a revisão nova, restaurar **juntos** os manifests e módulos do backup privado e reiniciar somente `lzgames-api.service`; depois conferir health, autenticação e conexões. Não restaurar bancos para reverter dependências. A versão anterior tem alertas de segurança conhecidos, portanto a reversão é contingência temporária.

Esta correção roda no servidor e não exige nova compilação Android. O APK 28 conserva seu commit de origem e sua assinatura.

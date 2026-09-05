# Registro — APK 17 / VFX-09

## Identificação

- Produto: LZ-GAMES, `br.com.lzgames.app`.
- Versão: `1.0.0`, Android `versionCode: 17`.
- Projeto: `@lzgames/lz-games`.
- Perfil: `preview`, distribuição interna, formato APK.
- Build ID: `9f77f237-9729-48b4-bea2-e79d385df26c`.
- [Acompanhar compilação no Expo](https://expo.dev/accounts/lzgames/projects/lz-games/builds/9f77f237-9729-48b4-bea2-e79d385df26c).
- Criado em: 05/09/2026 às 12:33:08 UTC, 09:33:08 em Maceió.
- Estado confirmado no fechamento: **`FINISHED`**, prioridade `HIGH`.
- Concluído em: 05/09/2026 às 12:41:24 UTC, 09:41:24 em Maceió.
- [Baixar o APK 17](https://expo.dev/artifacts/eas/38PNDWcJOega-N9tYycCjfcSDRbD7w-kRDm2HpFYtI0.apk).
- Usa a chave Android remota já existente; não houve troca de assinatura, compra de plano ou submissão à Play Store.

## Conteúdo enviado

Cards neon de cauda contínua, ícones locais animados, eletricidade no menu selecionado, nave com trajetória variável e turbinas/chama/vapor atualizados, troféus dourados em chuva Matrix na aba Sorteios. Integrações de OS, agenda, pacotes e sorteios existentes foram preservadas.

Comando efetivamente usado:

```bash
npx --yes eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message "LZ-GAMES APK 17 - VFX-09: trofeus dourados, turbinas e efeitos atualizados"
```

Não execute esse comando novamente apenas para consultar o resultado. Use:

```bash
npx eas-cli build:view 9f77f237-9729-48b4-bea2-e79d385df26c
```

## Validações

- `npm run typecheck`: aprovado.
- `npm run test:effects`: 18/18 aprovados.
- `npx expo-doctor`: 21/21 aprovados.
- `git diff --check`: aprovado.
- Arquivo de upload: 6,7 MB enviado ao EAS, com os novos arquivos de `src/effects` presentes.
- Inspeção prévia local: `/tmp/lz-apk17.U3OIEF/archive` na máquina desta entrega. É temporária e não é necessária para compilar em outra máquina.
- Renderização de navegador: nave/chama em movimento, chuva de troféus, pausa e redimensionamento verificados em suas revisões. Não equivale a teste completo do APK no aparelho.

## Artefato concluído

O APK do link acima foi baixado e a integridade dos dados compactados foi conferida com `unzip -tq`, sem erros.

- Tamanho: **70.793.347 bytes** (aproximadamente 67,51 MiB).
- SHA-256 do arquivo APK:

```text
6a3a2a2c017e967d37c4d1e01ba91229c554c2431dd8b8b1449f08c76552b874
```

O bundle contido no próprio APK também foi inspecionado: contém a chuva de troféus dourados, o halo dourado, o novo desenho dos motores e o efeito de eletricidade. Isso confirma a inclusão do código, não substitui a instalação e o teste visual/funcional no aparelho. O binário não é enviado ao Git: utilize o link do Expo e este checksum.

## Conferência do código enviado

Antes da documentação e do commit, o conteúdo executável/configuração/assets do arquivo inspecionado foi comparado com o diretório de trabalho: **30 arquivos, iguais**.

SHA-256 do manifesto desses arquivos:

```text
2da83e4a27e3edf187deaaca5bd6b1602123479ce8426f2ccb674cc8f46a8de2
```

Para reproduzir a conferência no terminal, na raiz deste commit:

```bash
node -e 'const fs=require("fs"),path=require("path"),crypto=require("crypto");let files=["App.tsx","app.json","eas.json","package.json","package-lock.json","babel.config.js","tsconfig.json"];function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);entry.isDirectory()?scan(p):files.push(p);}}scan("src");scan("assets");files.sort();const h=crypto.createHash("sha256");for(const file of files){h.update(file.split(path.sep).join("/")+"\n");h.update(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")+"\n");}console.log(files.length,h.digest("hex"));'
```

Esse digest não é o hash do APK nem o fingerprint interno do Expo. Ele identifica os arquivos locais relacionados acima. A conferência pressupõe os mesmos bytes/terminações de linha; uma cópia que converta LF para CRLF terá outro resultado. README, testes e documentação são excluídos desse manifesto porque não integram o código/assets do app.

O envio ocorreu antes do pedido de commit/push. A referência Git registrada pelo EAS pode ser a base `72e0e30`; os arquivos atuais foram incluídos pelo empacotamento local, não baixados daquele commit antigo. A documentação posterior não exige recompilar este mesmo APK.

## Próxima conferência no aparelho

O EAS confirmou `FINISHED`. Baixar o APK pelo link acima e validar instalação, login e fluxos com contas autorizadas. A conclusão da compilação não afirma teste ponta a ponta em Android, entrega de WhatsApp ou aprovação da Play Store.

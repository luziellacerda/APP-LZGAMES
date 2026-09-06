# APK 24 — Lotties escolhidos / VFX-13

Enviado após o usuário interromper o diagnóstico de consumo e pedir a entrega rápida das animações. **Compilação concluída (`FINISHED`), APK baixado, verificado e publicado no convite.** Os tamanhos maiores e o compartilhamento novo da [fonte 25 / VFX-14](BUILD-25.md) são posteriores e não estão neste APK.

- [Página da compilação 24](https://expo.dev/accounts/lzgames/projects/lz-games/builds/957b75c0-c269-4e12-9024-6bd69d37ee79).
- ID `957b75c0-c269-4e12-9024-6bd69d37ee79`, criado em `2026-09-05T22:49:31.801Z`, prioridade `HIGH`.
- Android, perfil `preview`, distribuição interna; `LZ-GAMES`, `br.com.lzgames.app`, versão `1.0.1`, `versionCode 24`.
- Projeto e assinatura remota existentes, com `--freeze-credentials`; nenhum AAB, envio à loja ou commit/push nesta etapa.
- Upload em dois segundos, arquivo de envio informado pelo EAS: 6,9 MB. Não é o tamanho do APK final.

## Conteúdo conferido no envio

| Local | Lottie escolhido |
| --- | --- |
| Entrada “Indique e ganhe”, Início e Conta | Money — `JAEyxMYTN2` |
| Cashback aprovado | Money — `9Rs7JUzu1D` |
| Indicação por app | Fake 3D vector coin — `0N5eblUHrK` |
| Convide alguém | Payment Successful — `cUEV8IuLNE` |
| Calendário da Agenda | El calendario — `jxFJ2FUhZx` |
| Suite e licenças | rocket share — `kQtY3BH2g7` |

Inclui também histórico de indicações com mês/status/pesquisa e cinco registros por vez. Fonte, origem/licença e regras preservadas: [CONVITE-APP.md](CONVITE-APP.md). Não altera a nave independente, Matrix, moedas dos sorteios, laser, eletricidade ou regras financeiras. O APK 23 inspecionado não contém esses arquivos novos; reinstalá-lo não atualiza os desenhos.

A fonte visual havia passado em TypeScript, 125 testes e exportação Android/Hermes. Por pedido do usuário, o diagnóstico de consumo foi interrompido; nenhuma otimização de efeitos foi implementada nessa investigação. Android físico permanece pendente.

Antes do envio: configuração cliente Firebase validada; arquivo inspecionado com **125 arquivos e 61 hashes** reconciliados com a fonte local. Os seis JSONs e suas licenças estão presentes. `server/`, bancos, APKs e credenciais privadas estão excluídos; cliente Firebase presente. [Hashes da fonte 24](BUILD-24-sources.sha256). Documentação escrita depois do envio não muda o aplicativo.

Histórico EAS conferido: último Android era o 23, concluído. Uso incluído antes de enviar: 42%, custo adicional de builds reportado igual a zero; nenhuma contratação ou compra de crédito. O comando abaixo já foi executado uma vez; **não repetir para consultar**:

```bash
npx --no-install eas-cli build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --message 'LZ-GAMES APK 24 - Lotties solicitados VFX-13, calendario, Suite e cashback com filtros'
```

Consulta somente leitura:

```bash
npx --no-install eas-cli build:view 957b75c0-c269-4e12-9024-6bd69d37ee79
```

## Artefato verificado e publicado

- [Baixar APK 24](https://app.lzgames.com.br/convite/lz-games-24.apk).
- [Artefato original EAS](https://expo.dev/artifacts/eas/v95-U60ZgkZMxA5_fgA2qPjqfOQnD5eaYfosZ2q_7cs.apk).
- Tamanho: **73.213.246 bytes**. AAPT confirmou `br.com.lzgames.app`, `versionCode 24`, versão `1.0.1`, target SDK 36.
- ZIP íntegro; assinatura Android válida, com o mesmo certificado SHA-256 do APK 23: `9b1ef548a90a075f2d8f95853b671819b8d53e9a074580a8272c2c0fcd716c9e`.
- As seis referências escolhidas foram encontradas no bundle Hermes do APK, além da conferência dos assets/hashes antes do envio.
- SHA-256 do arquivo: `74f81db1487274a190ff3f8b5a23f366ade0f94876812e6491b14a47e2c36ce7`.

Página pública, metadados e alternativa sem JavaScript atualizados para 24; download HTTPS respondeu 200 com o tamanho correto. APK 23 mantido disponível, sem sobrescrita. API saudável após recarga. Instale por cima da versão existente, sem desinstalar/apagar dados. Desenho/toque/desempenho em Android físico continuam pendentes.

As proteções de [indicação única e a correção da Agenda por CPF](SEGURANCA-INDICACOES-AGENDA-CPF.md) já estão no servidor e também se aplicam a este APK. Não confundir atualização de backend com os ajustes visuais da próxima compilação. Nenhum envio 25 foi feito.

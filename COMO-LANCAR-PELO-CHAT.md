# Como o Claude lança gastos no app Meus Gastos

O app (https://lucasviu10.github.io/meus-gastos/) lê o arquivo `chat.json` desta branch (`dados`)
sempre que é aberto. Para lançar um gasto pelo chat, edite `chat.json` na branch `dados`
do repositório `lucasviu10/meus-gastos` e faça commit.

## Formato
```json
{
  "gastos": [
    { "id": "c-20261107-mercado-45", "valor": 45, "descricao": "mercado", "categoria": "alimentacao", "data": "2026-11-07" }
  ],
  "apagar": [],
  "orcamento": 3000,
  "orcamentoEm": "2026-11-07T10:00:00Z"
}
```

- **Sempre ACRESCENTE** à lista `gastos`. Nunca apague nem altere itens antigos (o app usa o `id` para não duplicar).
- `id`: único, nunca repetido. Use `c-AAAAMMDD-descricao-valor` (+ um número se repetir).
- `valor`: número com ponto decimal (23.5), sem "R$".
- `data`: `AAAA-MM-DD`. "ontem" = dia anterior à data de hoje no Brasil (horário de Brasília).
- `categoria`: uma destas: `alimentacao`, `transporte`, `casa`, `saude`, `lazer`, `compras`, `contas`, `outros`.
- `descricao`: curta, minúscula, sem preposição ("mercado", não "no mercado").
- Para **apagar** um gasto: coloque o `id` dele em `apagar`.
- Para mudar o **limite do mês**: atualize `orcamento` e `orcamentoEm` (data e hora atual, ISO).
- Mensagem do commit: `Gasto: 45 mercado`.

Depois de gravar, responda curto: "Anotado: R$ 45,00 em Alimentação (mercado). Abra o app para ver."

## Contas fixas, parcelas e cartões (opcional)
Acrescente nas listas `contas`, `cartoes` ou `compras` de `chat.json` (crie a lista se não existir). Mesmas regras: só acrescentar, `id` único.

**Conta** (`contas`):
```json
{ "id": "k-financiamento-moto", "nome": "financiamento da moto", "tipo": "parcelada", "valor": 1011, "total": 48, "pagas": 12, "proxMes": "2026-12", "dia": 10, "categoria": "transporte" }
```
- `tipo`: `fixa` (todo mês, sem `total`), `parcelada` (com `total` e `pagas`) ou `unica` (`total`: 1).
- `proxMes`: mês (AAAA-MM) da próxima parcela ainda não paga.

**Cartão** (`cartoes`): `{ "id": "c-nubank", "nome": "Nubank", "limite": 2000, "fecha": 3, "vence": 10 }`

**Compra no cartão** (`compras`):
```json
{ "id": "b-20261107-celular", "cartaoId": "c-nubank", "descricao": "celular", "valor": 300, "parcelas": 10, "data": "2026-11-07", "categoria": "compras" }
```
- `valor` é o TOTAL da compra; `parcelas` = 1 para à vista. `cartaoId` precisa ser o id de um cartão cadastrado pelo chat.
- Pagamento de conta e de fatura é feito no app (botão "✓ Paguei").

## Categoria MC e detalhe escondido
- Categoria `mc`: use para maconha, seda e afins. `descricao` sempre `"MC"`.
- O que foi de verdade vai em `nota64` (texto em base64), nunca em texto aberto. No app, só aparece quando ele toca no gasto.
  Ex.: `{ "id": "c-20261107-mc-50", "valor": 50, "descricao": "MC", "categoria": "mc", "data": "2026-11-07", "nota64": "bWFjb25oYQ==" }`
- Para corrigir um gasto já lançado, acrescente em `atualizar`: `{ "uid": "u-unico", "id": "<id do gasto>", "categoria": "...", "descricao": "...", "nota64": "...", "data": "AAAA-MM-DD", "valor": 0 } (só os campos que mudam)` (`uid` nunca se repete).

## Entradas e saldo
- Dinheiro que entrou (comissão, salário, Pix recebido de outra pessoa): acrescente em `entradas`:
  `{ "id": "e-20261107-comissao-500", "valor": 500, "descricao": "comissão", "data": "2026-11-07" }`
- Transferência entre contas do próprio Lucas NÃO é entrada.
- Saldo inicial: `"saldoInicial": { "valor": 2770, "data": "2026-11-01" }` e `"saldoEm"` com a data/hora atual (ISO) sempre que mudar.
- Dinheiro que AINDA VAI cair ("falta entrar", "vai entrar"): acrescente em `aReceber`: `{ "id": "r-20261107-nestle-940", "valor": 940, "descricao": "Nestlé" }`. Ele toca em "✓ Recebi" no app quando cair.
- Reajuste de saldo ("meu saldo real é X"): acrescente em `ajustes`: `{ "id": "a-AAAAMMDD-valor", "alvo": 1129.86, "descricao": "alinhamento de valor (fictício)" }`. O app calcula e lança a diferença sozinho.

## Empresa (LM Serviços LTDA)
- Comissões da Ademicon entram na EMPRESA, não no pessoal. Em `empresa.aReceber` (ainda vai cair) ou `empresa.movs` (`tipo`: `entrada` ou `despesa`, com `data`).
- Dados: `empresa.nome`, `empresa.cnpj` (só números) e `empresa.dadosEm` (data/hora ISO ao mudar).
- "Liberar para mim" é feito no app (botão 💸), que tira da empresa e soma no saldo pessoal.
- Compras de cartão: `fixa: true` para cobrança mensal; `parcelaAtual` para compra que já está no meio.

## Negativações (Serasa)
- Ficam FORA do saldo e das despesas. Acrescente em `negativacoes`: `{ "id": "n-credor", "credor": "...", "valor": 1500, "obs": "desde 2024" }`.
- Só entram no plano se ele ligar "Somar no meu plano" no app.

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

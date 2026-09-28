# Meus Gastos

Controle financeiro pessoal: painel com entradas, saídas, sobra do mês e contas a pagar; gráficos dos últimos 6 meses e do gasto acumulado no mês; orçamento por categoria com alerta de estouro; lançamentos repetidos (parcelas); exportação em planilha (CSV) e backup (JSON).

## Como usar

- **Pelo link do claude.ai (recomendado):** os dados ficam salvos na nuvem, só você vê, e sincronizam entre celular e computador.
- **Arquivo `index.html`:** abra no navegador. Nesse modo os dados ficam só naquele navegador — faça backup em *Ajustes*.

## Arquivos

- `app/meus-gastos.html` — o aplicativo (fonte única).
- `index.html` — versão completa gerada com `node build.mjs`, para abrir direto ou publicar no GitHub Pages.

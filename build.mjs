// Gera index.html (página completa, para abrir direto no navegador ou no GitHub Pages)
// a partir de app/meus-gastos.html (versão publicada como Artifact no claude.ai).
import { readFileSync, writeFileSync } from "node:fs";
const body = readFileSync(new URL("./app/meus-gastos.html", import.meta.url), "utf8");
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d5c4c">
<style>[hidden]{display:none!important}img{max-width:100%}</style>
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(new URL("./index.html", import.meta.url), html);
console.log("index.html gerado");

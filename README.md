# Mosaico — MVP local

Aplicativo para dividir uma imagem em folhas de pôster. Processa a imagem no navegador, sem conta ou envio para servidor.

## Executar

```bash
npm install
npm run dev
```

Abra o endereço local mostrado pelo Vite. Para compilar: `npm run build`. Para verificar a geometria: `npm test`.

## Incluído

- Upload ou arraste de PNG, JPEG e WebP; imagem de exemplo para testar.
- Grade de até 6 × 6 folhas, formatos A5/A4/A3/A2/Carta/Legal e papel personalizado.
- Prévia montada e por folha, tamanho final e DPI efetivo.
- PDF A4 e outros formatos com a arte até as bordas digitais.
- Aba única de cola à esquerda e acima das novas folhas, para impressora sem bordas.
- Margens físicas independentes para modo de dobra sem corte, com linhas de dobra e guia opcional.
- Guia de montagem visual em página A4, com miniaturas sobre a imagem completa, numeração e coordenadas de cada folha.

## Limites deste MVP

Impressora comum não imprime até a borda física. No modo “Dobrar, sem tesoura”, dobre as margens brancas para trás antes de unir as áreas impressas. O modo de aba única exige impressora sem bordas. Na exportação, as páginas são renderizadas a 150 DPI; a qualidade visível depende da resolução da imagem original. Ainda não há editor de recorte, templates, ZIP, calibração da impressora ou efeitos avançados da especificação.

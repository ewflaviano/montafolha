# Contribuir com o MontaFolha

Obrigado por ajudar a melhorar o MontaFolha. Ele divide imagens em folhas e gera o PDF no navegador. A imagem e o PDF devem continuar fora do servidor.

## Antes de começar

1. Consulte as [issues](https://github.com/ewflaviano/montafolha/issues) existentes. Para uma mudança maior, descreva a proposta em uma issue antes de escrever código.
2. Ao relatar um erro, informe navegador, sistema, papel, grade, modo de encaixe e passos para reproduzir. Use uma imagem pública ou sintética; não publique fotos pessoais nem PDFs privados.
3. Para problemas que possam expor dados ou credenciais, siga [SECURITY.md](SECURITY.md) em vez de abrir uma issue pública.

## Executar e testar

Use Node.js 24 e npm. O projeto não exige conta AWS nem credenciais para desenvolver a interface e o gerador de PDFs.

```sh
npm ci
npm run dev
npm test
npm run build
```

O Vite mostra a URL local. `npm test` verifica a geometria e o contrato da API de diagnóstico. `npm run build` gera o site estático em `dist/`. O backend em `backend/` é uma função Lambda sem dependências externas e recebe apenas códigos fixos de diagnóstico; sua infraestrutura está em `infra/diagnostics.yml`.

## Onde alterar

| Área | Arquivos |
| --- | --- |
| Interface, prévias e exportação PDF | `src/main.js`, `src/style.css` |
| Medidas, margens e encaixes | `src/geometry.js`, `src/geometry.test.js` |
| Consentimento, GA4 e envio de diagnóstico | `src/usage.js` |
| Validação da API de diagnóstico | `backend/index.mjs`, `backend/index.test.mjs` |
| Deploy e infraestrutura | `.github/workflows/deploy.yml`, `infra/` |

## Enviar uma contribuição

Crie uma branch a partir da `main`, faça uma mudança focada e abra um pull request. Explique o comportamento, o motivo, os testes executados e qualquer limite conhecido. Inclua capturas apenas com imagens sintéticas. O CI verifica testes e build nos PRs. A publicação ocorre após integração na `main` pelo mantenedor.

Para alterações nas margens, cubra grades de uma e várias folhas, todos os lados e pelo menos dois tamanhos de papel. Confira visualmente o PDF em tamanho real. Para interface, confira celular, desktop, teclado e foco. Para consentimento, verifique que recusar impede o carregamento do GA4 e o envio de diagnósticos; revogar deve interromper ambos.

## Privacidade e segurança

- Nunca envie a imagem, o PDF, o nome do arquivo, mensagens de erro, stacks ou URLs para a API de diagnóstico.
- Não coloque chaves AWS ou outros segredos em `VITE_*`: essas variáveis ficam no JavaScript distribuído ao público. O ID de medição GA4 é público.
- Use somente códigos fixos e limitados para erros. Preserve o limite de tamanho e a validação estrita no servidor.
- Não inclua dados pessoais, imagens privadas, credenciais ou arquivos `.env` em commits, issues ou PRs.

O código original do projeto está sob [licença MIT](LICENSE). Dependências e materiais de terceiros mantêm suas próprias licenças.

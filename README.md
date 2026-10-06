# MontaFolha

Aplicativo gratuito e de código aberto para dividir uma imagem em folhas de pôster. Processa a imagem no navegador, sem conta ou envio para servidor.

Para colaborar, veja o [guia de contribuição](CONTRIBUTING.md). Falhas que possam expor dados devem seguir a [política de segurança](SECURITY.md).

## Privacidade e funcionamento

O navegador lê a imagem, monta as folhas com Canvas e gera o PDF com `pdf-lib`. O arquivo escolhido e o PDF não são enviados ao servidor. As configurações ficam no armazenamento local do navegador. A geração usa recursos do seu dispositivo, então imagens e grades grandes podem exigir mais memória.

Uma escolha opcional permite contar visitas com Google Analytics e enviar códigos técnicos fixos de erros ao backend. Sem aceite, o script do Analytics não carrega e os códigos não são enviados. O usuário pode rever ou revogar a escolha na página **Privacidade**. Os registros técnicos têm retenção de 30 dias no CloudWatch. A página **Apoiar** apresenta um Pix estático; nenhum pagamento é processado pelo app.

## Executar

```bash
npm install
npm run dev
```

Abra o endereço local mostrado pelo Vite. Para compilar: `npm run build`. Para verificar a geometria: `npm test`.

O resultado de `npm run build` fica em `dist/` e pode ser servido como site estático. Nenhum backend é necessário para as funções deste MVP.

## Deploy

O workflow em `.github/workflows/deploy.yml` executa os testes e a compilação em pull requests e em alterações na branch `main`. Após uma compilação bem-sucedida em `main`, o GitHub Actions assume uma função IAM via OIDC, atualiza a Lambda de diagnóstico, envia `dist/` para um bucket S3 privado e invalida o cache do CloudFront. O HTML e as imagens estáticas recebem cache curto; os arquivos com hash gerados pelo Vite recebem cache longo. Nenhuma chave AWS fica armazenada no GitHub.

O site é distribuído em `https://montafolha.com.br` e `https://www.montafolha.com.br`. A zona Route 53 contém registros A e AAAA de alias para o CloudFront. O certificado ACM cobre os dois nomes. A infraestrutura foi criada na conta AWS do profile CLI `vortex`; as variáveis de repositório `AWS_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET` e `CLOUDFRONT_DISTRIBUTION_ID` indicam os recursos usados pelo workflow.

## Incluído

- Upload ou arraste de PNG, JPEG e WebP; imagem de exemplo para testar.
- Grade de até 6 × 6 folhas, formatos A5/A4/A3/A2/Carta/Legal e papel personalizado.
- Prévia montada e por folha, tamanho final e DPI efetivo.
- Prévia ampliada das junções verticais e horizontais entre folhas, antes de imprimir.
- Imagem inteira por padrão, com áreas brancas quando necessário; opção de preencher o pôster com recorte ajustável.
- PDF A4 e outros formatos; no modo de preenchimento, a arte alcança as bordas digitais.
- Aba única de cola à esquerda e acima das novas folhas, para impressora sem bordas.
- Margens físicas independentes para modo de dobra sem corte, com linhas de dobra e guia opcional.
- Guia de montagem visual em página A4, com miniaturas sobre a imagem completa, numeração e coordenadas de cada folha.

## Limites deste MVP

Impressora comum não imprime até a borda física. No modo “Dobrar, sem tesoura”, dobre as margens brancas para trás antes de unir as áreas impressas. O modo de aba única exige impressora sem bordas. Na exportação, as páginas são renderizadas a 150 DPI; a qualidade visível depende da resolução da imagem original. Ainda não há zoom, rotação, recorte livre, templates, ZIP, calibração da impressora ou efeitos avançados da especificação.

# Infraestrutura de produção

O site está no S3 privado `montafolha-site-872515289365`, distribuído pelo CloudFront `E1HU4XLHXR9IQH`. O certificado ACM em `us-east-1` e a zona Route 53 atendem `montafolha.com.br` e `www.montafolha.com.br`. O deploy usa OIDC do GitHub Actions e a função `montafolha-github-deploy`, sem chave AWS no repositório.

O diagnóstico opcional usa uma API Gateway HTTP e a função `montafolha-diagnostics` em `sa-east-1`. O CloudFront encaminha `/api/*` para a API com cache desativado. A Lambda valida origem, método, tamanho e uma lista fechada de códigos. Somente códigos aceitos são registrados no CloudWatch, por 30 dias. A API não tem acesso às imagens nem ao bucket do site.

## Recriar a API

```sh
aws --profile vortex cloudformation deploy --region sa-east-1 \
  --stack-name montafolha-diagnostics \
  --template-file infra/diagnostics.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

Depois, obtenha `ApiDomain` nas saídas da stack e aplique a configuração do CloudFront:

```sh
python infra/configure-cloudfront.py \
  --profile vortex \
  --distribution-id E1HU4XLHXR9IQH \
  --api-domain SEU_API_DOMAIN
```

O template cria uma função inicial que responde `503`. O workflow de deploy empacota `backend/index.mjs` e a atualiza antes de publicar a interface. A função IAM de deploy tem permissão de atualização apenas dessa Lambda. Ao mudar o proprietário ou nome do repositório, atualize também o sujeito imutável OIDC na confiança da função IAM; o GitHub inclui os IDs de proprietário e repositório nesse sujeito.

## Verificar

`npm test` cobre os códigos aceitos e rejeitados. Um `POST` consentido e válido para `/api/diagnostics/errors` deve retornar `204`; campos extras ou origem estranha retornam erro. O console do CloudWatch deve conter só área, código, contagem e metadados técnicos gerados pela AWS. Não use dados reais de usuários em testes.

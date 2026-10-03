"""Attach the diagnostics API to an existing MontaFolha CloudFront distribution."""

import argparse
import boto3


def configure(profile: str, distribution_id: str, api_domain: str) -> bool:
    cf = boto3.Session(profile_name=profile).client('cloudfront')
    result = cf.get_distribution_config(Id=distribution_id)
    config = result['DistributionConfig']
    origin_id = 'montafolha-diagnostics-api'
    origin = {
        'Id': origin_id,
        'DomainName': api_domain,
        'OriginPath': '',
        'CustomHeaders': {'Quantity': 0},
        'CustomOriginConfig': {
            'HTTPPort': 80, 'HTTPSPort': 443, 'OriginProtocolPolicy': 'https-only',
            'OriginSslProtocols': {'Quantity': 1, 'Items': ['TLSv1.2']},
            'OriginReadTimeout': 10, 'OriginKeepaliveTimeout': 5,
        },
        'ConnectionAttempts': 3, 'ConnectionTimeout': 10, 'OriginShield': {'Enabled': False},
    }
    behavior = {
        'PathPattern': '/api/*', 'TargetOriginId': origin_id,
        'TrustedSigners': {'Enabled': False, 'Quantity': 0},
        'TrustedKeyGroups': {'Enabled': False, 'Quantity': 0},
        'ViewerProtocolPolicy': 'https-only',
        'AllowedMethods': {'Quantity': 7, 'Items': ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
                           'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']}},
        'SmoothStreaming': False, 'Compress': False,
        'LambdaFunctionAssociations': {'Quantity': 0}, 'FunctionAssociations': {'Quantity': 0},
        'FieldLevelEncryptionId': '',
        'CachePolicyId': '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
        'OriginRequestPolicyId': 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
    }
    origins = config['Origins']['Items']
    behaviors = config['CacheBehaviors'].get('Items', [])
    previous_origin = next((item for item in origins if item['Id'] == origin_id), None)
    previous_behavior = next((item for item in behaviors if item['PathPattern'] == '/api/*'), None)
    if (previous_origin and previous_origin['DomainName'] == api_domain and previous_behavior and
            previous_behavior['TargetOriginId'] == origin_id and
            previous_behavior['CachePolicyId'] == behavior['CachePolicyId'] and
            previous_behavior['OriginRequestPolicyId'] == behavior['OriginRequestPolicyId']):
        return False
    origins[:] = [item for item in origins if item['Id'] != origin_id] + [origin]
    behaviors[:] = [item for item in behaviors if item['PathPattern'] != '/api/*'] + [behavior]
    config['Origins']['Quantity'] = len(origins)
    config['CacheBehaviors'] = {'Quantity': len(behaviors), 'Items': behaviors}
    cf.update_distribution(Id=distribution_id, IfMatch=result['ETag'], DistributionConfig=config)
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', default='vortex')
    parser.add_argument('--distribution-id', required=True)
    parser.add_argument('--api-domain', required=True)
    args = parser.parse_args()
    print('CloudFront atualizado' if configure(args.profile, args.distribution_id, args.api_domain) else 'CloudFront já configurado')

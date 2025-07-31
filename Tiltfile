allow_k8s_contexts(k8s_context())

docker_compose(
    configPaths='./example/docker-compose.yml',
    project_name='mock-oidc-provider',
)

custom_build(
    ref='tpadrieza/mock-oidc-provider:latest',
    command='docker build -t $EXPECTED_REF -f Dockerfile .',
    deps=['./src']
)
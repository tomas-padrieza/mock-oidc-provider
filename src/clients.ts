import type { Adapter, ClientMetadata, Provider } from 'oidc-provider';

import type { ClientConfig } from './types';

export function clientAdapter(provider: Provider): Adapter {
    // oidc-provider exposes this adapter, but its upstream types omit it on Client.
    return (provider.Client as typeof provider.Client & { readonly adapter: Adapter }).adapter;
}

export async function saveClient(provider: Provider, client: ClientConfig): Promise<void> {
    const metadata: ClientMetadata = {
        ...client,
        response_types: ['code'],
        grant_types: ['authorization_code'],
    };

    await provider.Client.validate(metadata);
    await clientAdapter(provider).upsert(client.client_id, metadata);
}

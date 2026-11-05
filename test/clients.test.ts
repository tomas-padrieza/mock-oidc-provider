import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, it } from 'node:test';
import express from 'express';
import Provider from 'oidc-provider';

process.env.ISSUER = 'http://localhost:3000';
process.env.CLIENT_ID = 'startup-client';
process.env.CLIENT_SECRET = 'startup-secret';
process.env.REDIRECT_URIS = 'http://localhost:8080/callback';

const { config } = await import('../src/config');
const { saveClient } = await import('../src/clients');
const { env } = await import('../src/env');
const { default: routes } = await import('../src/routes');

const startupClient = {
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    redirect_uris: env.REDIRECT_URIS,
};
const newClient = {
    client_id: 'new-client',
    client_secret: 'new-secret',
    redirect_uris: ['http://localhost:8080/new-callback'],
};

describe('client management', () => {
    let provider: Provider;
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
        provider = new Provider(env.ISSUER, config);
        await saveClient(provider, startupClient);
        const app = express();
        app.use(express.json());
        routes(app, provider);
        app.use(provider.callback());
        server = app.listen(0, '127.0.0.1');
        await new Promise<void>((resolve) => server.once('listening', resolve));
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    async function request(method: string, path: string, data?: unknown) {
        return fetch(`${baseUrl}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: data === undefined ? undefined : JSON.stringify(data),
        });
    }

    async function tokenError(clientId: string, secret: string) {
        const response = await fetch(`${baseUrl}/token`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: 'nonexistent-code',
                redirect_uri: newClient.redirect_uris[0],
            }),
        });
        return (await response.json()).error;
    }

    async function authorize(clientId: string, redirectUri: string) {
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid',
            prompt: 'none',
            code_challenge: 'a'.repeat(43),
            code_challenge_method: 'S256',
        });
        return fetch(`${baseUrl}/auth?${params}`, { redirect: 'manual' });
    }

    it('creates a client that is immediately usable by OIDC', async () => {
        const response = await request('POST', '/client', newClient);
        assert.equal(response.status, 201);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { success: true, client_id: newClient.client_id });
        const client = await provider.Client.find(newClient.client_id);
        assert.ok(client);
        assert.ok(client.compareClientSecret(newClient.client_secret));
        assert.ok(client.redirectUriAllowed(newClient.redirect_uris[0]));
        assert.ok(client.grantTypeAllowed('authorization_code'));
        assert.equal(
            await tokenError(newClient.client_id, newClient.client_secret),
            'invalid_grant',
        );
        assert.equal(await tokenError(newClient.client_id, 'wrong-secret'), 'invalid_client');
        const authorization = await authorize(newClient.client_id, newClient.redirect_uris[0]);
        assert.equal(authorization.status, 303);
        assert.ok(authorization.headers.get('location')?.startsWith(newClient.redirect_uris[0]));
    });

    it('updates the startup client and invalidates cached secrets and redirect URIs', async () => {
        await provider.Client.find(startupClient.client_id);
        const response = await request('PUT', `/client/${startupClient.client_id}`, {
            client_secret: newClient.client_secret,
            redirect_uris: newClient.redirect_uris,
        });
        assert.equal(response.status, 200);
        const client = await provider.Client.find(startupClient.client_id);
        assert.ok(client);
        assert.ok(client.compareClientSecret(newClient.client_secret));
        assert.equal(client.compareClientSecret(startupClient.client_secret), false);
        assert.ok(client.redirectUriAllowed(newClient.redirect_uris[0]));
        assert.equal(client.redirectUriAllowed(startupClient.redirect_uris[0]), false);
        assert.equal(
            await tokenError(startupClient.client_id, newClient.client_secret),
            'invalid_grant',
        );
        assert.equal(
            await tokenError(startupClient.client_id, startupClient.client_secret),
            'invalid_client',
        );
        assert.equal(
            (await authorize(startupClient.client_id, startupClient.redirect_uris[0])).status,
            400,
        );
        const authorization = await authorize(startupClient.client_id, newClient.redirect_uris[0]);
        assert.equal(authorization.status, 303);
        assert.ok(authorization.headers.get('location')?.startsWith(newClient.redirect_uris[0]));
    });

    it('renames and deletes clients, including the startup client', async () => {
        const renamed = 'renamed-client';
        assert.equal(
            (await request('PUT', `/client/${startupClient.client_id}`, { client_id: renamed }))
                .status,
            200,
        );
        assert.equal(await provider.Client.find(startupClient.client_id), undefined);
        const client = await provider.Client.find(renamed);
        assert.ok(client);
        assert.ok(client.compareClientSecret(startupClient.client_secret));
        assert.equal((await request('DELETE', `/client/${renamed}`)).status, 200);
        assert.equal(await provider.Client.find(renamed), undefined);
        assert.equal(await tokenError(renamed, startupClient.client_secret), 'invalid_client');
        assert.equal((await request('DELETE', `/client/${renamed}`)).status, 404);
        assert.equal((await request('POST', '/client', startupClient)).status, 201);
        assert.equal((await request('DELETE', `/client/${startupClient.client_id}`)).status, 200);
        assert.equal(await provider.Client.find(startupClient.client_id), undefined);
    });

    it('rejects duplicate IDs and missing clients without changing existing clients', async () => {
        assert.equal((await request('POST', '/client', startupClient)).status, 409);
        assert.equal((await request('POST', '/client', newClient)).status, 201);
        assert.equal(
            (
                await request('PUT', `/client/${startupClient.client_id}`, {
                    client_id: newClient.client_id,
                })
            ).status,
            409,
        );
        assert.equal(
            (await request('PUT', '/client/missing', { client_secret: 'secret' })).status,
            404,
        );
        assert.equal((await request('DELETE', '/client/missing')).status, 404);
        assert.ok(
            (await provider.Client.find(startupClient.client_id))?.compareClientSecret(
                startupClient.client_secret,
            ),
        );
    });

    it('rejects malformed or invalid metadata and leaves the original client intact', async () => {
        for (const data of [
            {},
            { ...newClient, client_id: '' },
            { ...newClient, client_secret: '' },
            { ...newClient, redirect_uris: [] },
            { ...newClient, redirect_uris: 'http://localhost/callback' },
            { ...newClient, redirect_uris: ['not-a-url'] },
            { ...newClient, redirect_uris: ['http://localhost/callback#fragment'] },
            { ...newClient, grant_types: ['client_credentials'] },
        ]) {
            assert.equal((await request('POST', '/client', data)).status, 400);
        }
        for (const data of [
            {},
            { client_id: '' },
            { client_secret: '' },
            { redirect_uris: [] },
            { redirect_uris: ['http://localhost/callback#fragment'] },
        ]) {
            assert.equal(
                (await request('PUT', `/client/${startupClient.client_id}`, data)).status,
                400,
            );
        }
        assert.ok(
            (await provider.Client.find(startupClient.client_id))?.compareClientSecret(
                startupClient.client_secret,
            ),
        );
        assert.equal(await provider.Client.find(newClient.client_id), undefined);
    });

    it('restores only the environment client when the provider restarts', async () => {
        await request('POST', '/client', newClient);
        await request('DELETE', `/client/${startupClient.client_id}`);
        const restarted = new Provider(env.ISSUER, config);
        await saveClient(restarted, startupClient);
        assert.equal(await restarted.Client.find(newClient.client_id), undefined);
        const client = await restarted.Client.find(startupClient.client_id);
        assert.ok(client);
        assert.ok(client.compareClientSecret(startupClient.client_secret));
        assert.ok(client.redirectUriAllowed(startupClient.redirect_uris[0]));
    });
});

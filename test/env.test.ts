import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EnvSchema } from '../src/types';

const requiredEnv = {
    ISSUER: 'http://localhost:3000',
    CLIENT_ID: 'client-id',
    CLIENT_SECRET: 'client-secret',
    REDIRECT_URIS: 'http://localhost:8080/callback',
};

describe('token TTL environment settings', () => {
    it('leaves token TTLs unset to preserve the OIDC provider defaults', () => {
        const env = EnvSchema.parse(requiredEnv);

        assert.equal(env.ACCESS_TOKEN_TTL, undefined);
        assert.equal(env.ID_TOKEN_TTL, undefined);
        assert.equal(env.REFRESH_TOKEN_TTL, undefined);
    });

    it('parses positive whole-second TTLs', () => {
        const env = EnvSchema.parse({
            ...requiredEnv,
            ACCESS_TOKEN_TTL: '900',
            ID_TOKEN_TTL: '1200',
            REFRESH_TOKEN_TTL: '86400',
        });

        assert.equal(env.ACCESS_TOKEN_TTL, 900);
        assert.equal(env.ID_TOKEN_TTL, 1200);
        assert.equal(env.REFRESH_TOKEN_TTL, 86400);
    });

    it('rejects invalid TTL values', () => {
        for (const value of ['0', '-1', '1.5', 'not-a-number', '9007199254740992']) {
            assert.equal(
                EnvSchema.safeParse({ ...requiredEnv, ACCESS_TOKEN_TTL: value }).success,
                false,
                `expected ${value} to be rejected`,
            );
        }
    });
});

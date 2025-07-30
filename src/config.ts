import { type Configuration, interactionPolicy } from 'oidc-provider';

import { findAccount } from './accounts';
import { env } from './env';

const policy = interactionPolicy.base();
const selectAccount = new interactionPolicy.Prompt({
    name: 'select_account',
    requestable: true,
});
selectAccount.checks.add(
    new interactionPolicy.Check(
        'select_account_prompt',
        'Select Account prompt was not resolved',
        '',
        (ctx) => {
            const { oidc } = ctx;

            if (oidc.prompts.has('select_account') && oidc.promptPending('select_account')) {
                return true;
            }

            return false;
        },
    ),
);
policy.add(selectAccount, 1);

export const config: Configuration = {
    clients: [
        {
            client_id: env.CLIENT_ID,
            client_secret: env.CLIENT_SECRET,
            response_types: ['code'],
            grant_types: ['authorization_code'],
            redirect_uris: env.REDIRECT_URIS,
        },
    ],
    cookies: {
        keys: ['random_cookie_key'],
    },
    claims: {
        openid: ['sub'],
        email: ['email'],
        profile: ['firstName', 'lastName', 'email', 'username', 'roles'],
    },
    scopes: ['openid', 'email', 'profile'],
    features: {
        devInteractions: { enabled: false },
        deviceFlow: { enabled: false },
        revocation: { enabled: true },
    },
    conformIdTokenClaims: false,
    interactions: {
        policy,
    },
    pkce: {
        required: () => true,
    },
    async loadExistingGrant(ctx) {
        const grantId =
            ctx.oidc.result?.consent?.grantId ||
            ctx.oidc.session?.grantIdFor(ctx.oidc.client?.clientId || '');

        if (grantId) {
            const grant = await ctx.oidc.provider.Grant.find(grantId);

            if (
                ctx.oidc.account &&
                grant?.exp &&
                ctx.oidc?.session?.exp &&
                grant.exp < ctx.oidc?.session?.exp
            ) {
                grant.exp = ctx.oidc.session.exp;

                await grant.save();
            }

            return grant;
        }

        const grant = new ctx.oidc.provider.Grant({
            clientId: ctx.oidc.client?.clientId,
            accountId: ctx.oidc.session?.accountId,
        });

        grant.addOIDCScope('openid email profile');
        await grant.save();
        return grant;
    },
    findAccount: (_ctx, id) => {
        const result = findAccount(id);
        return result.isOk() ? result.value : undefined;
    },
};

import { type Express, type NextFunction, type Request, type Response, urlencoded } from 'express';
import { errors, type Provider } from 'oidc-provider';
import { ulid } from 'ulidx';

import { createMockAccount, findByLogin, updateUser, validateCredentials } from './accounts';
import { clientAdapter, saveClient } from './clients';
import { env } from './env';
import { ClientConfigSchema, ClientUpdateSchema, LoginSchema, UserProfileSchema } from './types';

const body = urlencoded({ extended: false });

export default (app: Express, provider: Provider): void => {
    function setNoCache(_req: Request, res: Response, next: NextFunction) {
        res.set('cache-control', 'no-store');
        next();
    }

    function checkUserManagementEnabled(_req: Request, res: Response, next: NextFunction) {
        if (!env.USER_MANAGEMENT_ENABLED) {
            res.status(403).send('User management is disabled');
            return;
        }
        next();
    }

    app.post('/client', setNoCache, body, async (req, res) => {
        const validation = ClientConfigSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ success: false, error: 'Invalid request' });
            return;
        }

        if (await provider.Client.find(validation.data.client_id)) {
            res.status(409).json({ success: false, error: 'Client already exists' });
            return;
        }

        try {
            await saveClient(provider, validation.data);
        } catch (error) {
            if (!(error instanceof errors.InvalidClientMetadata)) throw error;
            res.status(400).json({ success: false, error: error.error_description });
            return;
        }

        res.status(201).json({ success: true, client_id: validation.data.client_id });
    });

    app.put('/client/:clientId', setNoCache, body, async (req, res) => {
        const validation = ClientUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ success: false, error: 'Invalid request' });
            return;
        }

        const clientId = req.params.clientId;
        const existing = await provider.Client.find(clientId);
        if (!existing) {
            res.status(404).json({ success: false, error: 'Client not found' });
            return;
        }

        const updated = ClientConfigSchema.parse({
            client_id: existing.clientId,
            client_secret: existing.clientSecret,
            redirect_uris: existing.redirectUris,
            ...validation.data,
        });
        if (updated.client_id !== clientId && (await provider.Client.find(updated.client_id))) {
            res.status(409).json({ success: false, error: 'Client already exists' });
            return;
        }

        try {
            await saveClient(provider, updated);
        } catch (error) {
            if (!(error instanceof errors.InvalidClientMetadata)) throw error;
            res.status(400).json({ success: false, error: error.error_description });
            return;
        }

        if (updated.client_id !== clientId) {
            await clientAdapter(provider).destroy(clientId);
        }
        res.json({ success: true, client_id: updated.client_id });
    });

    app.delete('/client/:clientId', setNoCache, async (req, res) => {
        const clientId = req.params.clientId;
        if (!(await provider.Client.find(clientId))) {
            res.status(404).json({ success: false, error: 'Client not found' });
            return;
        }

        await clientAdapter(provider).destroy(clientId);
        res.json({ success: true });
    });

    app.get('/health', (_req, res) => {
        res.status(200).send('OK');
    });

    app.get('/interaction/:uid', setNoCache, async (req, res) => {
        const { uid, prompt, params, session } = await provider.interactionDetails(req, res);

        if (prompt.name === 'select_account' && session?.accountId) {
            await provider.interactionFinished(
                req,
                res,
                {
                    select_account: {
                        accountId: session.accountId,
                    },
                },
                {
                    mergeWithLastSubmission: false,
                },
            );
            return;
        }

        const client = await provider.Client.find(params.client_id as string);

        switch (prompt.name) {
            case 'select_account':
            case 'login': {
                return res.render('sign-in', {
                    client,
                    uid,
                    details: prompt.details,
                    params,
                    layout: './layout',
                });
            }
            default:
                return undefined;
        }
    });

    app.post('/interaction/:uid/login', setNoCache, body, async (req, res) => {
        const {
            uid,
            prompt: { name },
        } = await provider.interactionDetails(req, res);
        const validation = LoginSchema.safeParse(req.body);

        if (name !== 'login' || !validation.success) {
            return res.render('signin-error', {
                uid,
                layout: './layout',
            });
        }

        const foundAccount = validateCredentials(validation.data);

        foundAccount.match(
            async (account) => {
                await provider.interactionFinished(
                    req,
                    res,
                    {
                        login: {
                            accountId: account.accountId,
                        },
                    },
                    {
                        mergeWithLastSubmission: false,
                    },
                );
            },
            (_err) => {
                return res.render('signin-error', {
                    uid,
                    layout: './layout',
                });
            },
        );
    });

    app.put('/user/:sub', checkUserManagementEnabled, body, (req, res) => {
        const sub = req.params.sub;
        const validation = UserProfileSchema.partial().safeParse(req.body);

        if (!sub || !validation.success) {
            res.status(400).json({ success: false, error: 'Invalid request' });
            return;
        }

        updateUser(sub, validation.data).match(
            () => {
                res.json({ success: true });
            },
            () => {
                res.status(404).json({ success: false, error: 'User not found' });
            },
        );
    });

    app.post('/user', checkUserManagementEnabled, body, (req: Request, res: Response) => {
        const validation = UserProfileSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({ success: false, error: 'Invalid request' });
            return;
        }

        const existingAccount = findByLogin(validation.data.username);
        if (existingAccount.isOk()) {
            res.status(409).json({ success: false, error: 'User already exists' });
            return;
        }

        const sub = ulid();

        createMockAccount({ ...validation.data, sub });

        res.json({ success: true, sub });
    });

    app.get('/user/:username', checkUserManagementEnabled, body, (req: Request, res: Response) => {
        const username = req.params.username;

        findByLogin(username).match(
            (account) => {
                res.json(account);
            },
            () => {
                res.status(404).json({ error: 'User not found' });
            },
        );
    });
};

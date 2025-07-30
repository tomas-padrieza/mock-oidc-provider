import { type Express, type NextFunction, type Request, type Response, urlencoded } from 'express';
import type { Provider } from 'oidc-provider';

import { createMockAccount, findByLogin, updateUser, validateCredentials } from './accounts';
import { LoginSchema, UserProfileSchema } from './types';

const body = urlencoded({ extended: false });

export default (app: Express, provider: Provider): void => {
    function setNoCache(_req: Request, res: Response, next: NextFunction) {
        res.set('cache-control', 'no-store');
        next();
    }

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

    app.put('/user/:sub', body, (req, res) => {
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

    app.post('/user', body, (req: Request, res: Response) => {
        const validation = UserProfileSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({ success: false, error: 'Invalid request' });
            return;
        }

        createMockAccount({ ...validation.data, sub: validation.data.username });

        res.json({ success: true });
    });

    app.get('/user/:username', body, (req: Request, res: Response) => {
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

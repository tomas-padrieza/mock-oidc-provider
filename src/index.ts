import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import helmet from 'helmet';
import { default as Provider } from 'oidc-provider';

import { loadInitialUsers } from './accounts';
import { config } from './config';
import { env } from './env';
import routes from './routes';

loadInitialUsers(env.INITIAL_USERS_FILE);

const app = express();

app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));

app.set('views', path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

const provider = new Provider(env.ISSUER, config);

app.enable('trust proxy');
provider.proxy = true;

routes(app, provider);
app.use(provider.callback());

const server = app.listen(env.PORT, () => {
    console.log(
        `Server started on port ${env.PORT}, check ${env.ISSUER}/.well-known/openid-configuration`,
    );
});

function shutdown() {
    if (server?.listening) server.close();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import dotenv from 'dotenv';
import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { type Env, EnvSchema } from './types';
import { exit } from './utils';

dotenv.config();

function parseEnv(): Result<Env, z.ZodError> {
    const parsed = EnvSchema.safeParse(process.env);
    return parsed.success ? ok(parsed.data) : err(parsed.error);
}

export const env = parseEnv().match(
    (val) => val,
    (err) => {
        exit(z.prettifyError(err));
    },
);

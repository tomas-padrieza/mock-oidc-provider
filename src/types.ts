import z from 'zod';

export const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    ISSUER: z.url(),
    CLIENT_ID: z.string(),
    CLIENT_SECRET: z.string(),
    REDIRECT_URIS: z
        .union([
            z.string().transform((str) => {
                if (str.includes('\n')) {
                    return str
                        .split('\n')
                        .map((url) => url.trim())
                        .filter((url) => url.length > 0);
                }
                return [str.trim()];
            }),
            z.array(z.string()),
        ])
        .pipe(z.array(z.url())),
    INITIAL_USERS_FILE: z.string().default('./store/users.json'),
    USER_MANAGEMENT_ENABLED: z.stringbool().default(true),
});
export type Env = z.infer<typeof EnvSchema>;

export const UserProfileSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    username: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
    password: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const InitialUserProfilesSchema = z.array(UserProfileSchema.extend({ sub: z.string() }));

export const LoginSchema = z.object({
    login: z.string().min(1, 'Login is required'),
    password: z.string().min(1, 'Password is required'),
});

import * as fs from 'node:fs';
import { err, ok, Result } from 'neverthrow';
import type { Account, AccountClaims } from 'oidc-provider';

import { InitialUserProfilesSchema, type UserProfile } from './types';
import { exit } from './utils';

// In-memory accounts store
const accounts: Record<string, MockAccount> = {};

type Claims = AccountClaims & Omit<UserProfile, 'password'>;

class MockAccount implements Account {
    accountId: string;
    profile: UserProfile;
    [key: string]: unknown;

    constructor(id: string, profile: UserProfile) {
        this.accountId = id;
        this.profile = profile;
        accounts[id] = this;
    }

    updateProfile(profile: Partial<UserProfile>) {
        this.profile = { ...this.profile, ...profile };
    }

    claims(): Claims {
        const { password: _password, ...profileWithoutPassword } = this.profile;
        return {
            sub: this.accountId,
            ...profileWithoutPassword,
        };
    }
}

export function createMockAccount(userData: UserProfile & { sub: string }) {
    const { sub: id, ...profile } = userData;
    return new MockAccount(id, profile);
}

export function findAccount(id: string): Result<MockAccount, string> {
    if (accounts[id]) {
        return ok(accounts[id]);
    }
    return err(`Account with ID ${id} not found`);
}

export function findByLogin(login: string): Result<MockAccount, string> {
    const account = Object.values(accounts).find((account) => account.profile.username === login);
    if (account) {
        return ok(account);
    }
    return err(`Account with Login ${login} not found`);
}

export function validateCredentials({
    login,
    password,
}: {
    login: string;
    password: string;
}): Result<MockAccount, string> {
    const account = Object.values(accounts).find((account) => account.profile.username === login);
    if (account && account.profile.password === password) {
        return ok(account);
    }
    return err(`Invalid credentials for ${login}`);
}

export function updateUser(
    sub: string,
    profile: Partial<UserProfile>,
): Result<MockAccount, string> {
    if (accounts[sub]) {
        accounts[sub].updateProfile(profile);

        return ok(accounts[sub]);
    }
    return err(`Account with sub ${sub} not found`);
}

export function loadInitialUsers(filePath: string) {
    if (!fs.existsSync(filePath)) {
        exit(`Initial Users file not found: ${filePath}`);
    }

    const file = Result.fromThrowable(
        () => fs.readFileSync(filePath, 'utf-8'),
        (error) => `Failed to read initial users file: ${error}`,
    )();

    if (file.isErr()) {
        exit(file.error);
    }

    const userJson = Result.fromThrowable(
        () => JSON.parse(file.value),
        (error) => `Failed to parse users JSON: ${error}`,
    )();

    if (userJson.isErr()) {
        exit(`Failed to parse users JSON: ${userJson.error}`);
    }

    const validation = InitialUserProfilesSchema.safeParse(userJson.value);
    if (!validation.success) {
        exit(`Invalid users data format: ${validation.error.message}`);
    }

    validation.data.forEach(createMockAccount);
}

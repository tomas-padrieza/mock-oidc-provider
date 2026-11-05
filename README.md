# OIDC Mock Server

Basic OIDC mock server to use for development and testing purposes.

## Overview

This is a lightweight OpenID Connect (OIDC) provider implementation designed for development and testing environments. It provides OIDC authentication flows and user and client management endpoints.

## Getting Started

### Quick Start with Docker (Recommended)

The easiest way to get started is using Docker Compose:

1. Clone the repository
2. Navigate to the example directory:

   ```bash
   cd example
   ```
3. Start the service:

   ```bash
   docker-compose up -d
   ```

The server will be available at `http://localhost:3000` with pre-configured users from `store/users.json`.

### Local Development

#### Prerequisites

-   Node.js 22 or higher
-   pnpm (recommended) or npm

#### Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=development
PORT=3000
ISSUER=http://localhost:3000
CLIENT_ID=client-id
CLIENT_SECRET=client-secret
REDIRECT_URIS=http://localhost:8080/api/auth/callback/mock-oidc-provider
INITIAL_USERS_FILE=./store/users.json
```

#### Installation & Development

```bash
# Install dependencies
pnpm install
# or
npm install

# Start development server
pnpm dev
# or
npm run dev
```

The server will start on `http://localhost:3000` with hot reload enabled.

#### Build for Production

```bash
pnpm build
# or
npm run build
```

### Configuration

#### Environment Variables

| Variable             | Description                       | Default              | Required |
| -------------------- | --------------------------------- | -------------------- | -------- |
| `NODE_ENV`           | Environment mode                  | `development`        | No       |
| `PORT`               | Server port                       | `3000`               | No       |
| `ISSUER`             | OIDC issuer URL                   | -                    | Yes      |
| `CLIENT_ID`          | OAuth client ID                   | -                    | Yes      |
| `CLIENT_SECRET`      | OAuth client secret               | -                    | Yes      |
| `REDIRECT_URIS`      | Redirect URIs (see formats below) | -                    | Yes      |
| `INITIAL_USERS_FILE` | Path to initial users JSON file   | `./store/users.json` | No       |

##### REDIRECT_URIS Configuration

The `REDIRECT_URIS` environment variable supports multiple formats:

**String format (comma-separated):**

```env
REDIRECT_URIS=http://localhost:8080/callback,https://oidcdebugger.com/debug
```

**Multiline format (in docker-compose.yml):**

```yaml
environment:
    REDIRECT_URIS: |
        https://oidcdebugger.com/debug
        http://localhost:8080/callback
```

**Single URL:**

```env
REDIRECT_URIS=https://oidcdebugger.com/debug
```

#### User Store

The application loads initial users from a JSON file (default: `./store/users.json`). See `example/store/users.json` for the expected format:

```json
[
    {
        "sub": "john_doe",
        "email": "john.doe@acme.org",
        "username": "john_doe",
        "firstName": "John",
        "lastName": "Doe",
        "roles": ["administrator", "user"],
        "password": "password123"
    }
]
```

#### OIDC flow debugging

For testing and debugging OIDC flows, you can use the [OIDC Debugger](https://oidcdebugger.com/) website. This tool allows you to:

-   Test authorization code flows
-   Validate token responses
-   Debug OIDC configuration issues
-   Inspect JWT tokens and claims

Simply configure the OIDC Debugger with your mock server's issuer URL (`http://localhost:3000`) and client credentials to test the authentication flow.

## API Endpoints

### User Management

The mock OIDC provider includes several user management endpoints for creating, updating, and retrieving user information.

#### Create a New User

Creates a new user account with basic profile information and credentials.

**Endpoint:** `POST /user`

**Headers:**

-   `Content-Type: application/json`
-   `Accept: application/json`

**Request Body:**

```json
{
    "sub": "test_user",
    "email": "test.user@acme.org",
    "username": "test_user",
    "firstName": "Test",
    "lastName": "User",
    "roles": ["user"],
    "password": "password123"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/user \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "sub": "test_user",
    "email": "test.user@acme.org",
    "username": "test_user",
    "firstName": "Test",
    "lastName": "User",
    "roles": ["user"],
    "password": "password123"
  }'
```

#### Update User Profile

Updates the profile information for an existing user by username.

**Endpoint:** `PUT /user/{username}`

**Headers:**

-   `Content-Type: application/json`
-   `Accept: application/json`

**Request Body:**

```json
{
    "firstName": "John",
    "lastName": "Doe"
}
```

**Example:**

```bash
curl -X PUT http://localhost:3000/user/john_doe \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Get User Information

Retrieves user profile information by username.

**Endpoint:** `GET /user/{username}`

**Headers:**

-   `Content-Type: application/json`
-   `Accept: application/json`

**Example:**

```bash
curl -X GET http://localhost:3000/user/john_doe \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

### Client Management

The client configured by `CLIENT_ID`, `CLIENT_SECRET`, and `REDIRECT_URIS` is loaded at startup.
The following endpoints can manage that client and additional clients immediately, without restarting
the server. All clients use the authorization code flow.

Client changes are stored in memory only. Restarting the server discards API-created clients and
restores the environment-configured client. Renaming or deleting a client makes its old ID unavailable
for subsequent OIDC requests; existing tokens and grants are not explicitly revoked.

These endpoints are unauthenticated and intended only for trusted development and test environments.
Client management endpoints are always enabled.

Send request bodies with `Content-Type: application/json`.

#### Create a Client

**Endpoint:** `POST /client`

All three fields are required. `client_id` and `client_secret` must be non-empty strings, and
`redirect_uris` must be a non-empty array of valid redirect URIs.

```bash
curl -X POST http://localhost:3000/client \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "another-client",
    "client_secret": "another-secret",
    "redirect_uris": ["http://localhost:8080/callback"]
  }'
```

Returns `201` with `{"success":true,"client_id":"another-client"}`.

#### Update a Client

**Endpoint:** `PUT /client/{clientId}`

Provide one or more of `client_id`, `client_secret`, and `redirect_uris`. Omitted fields are preserved;
the redirect URI array replaces the existing array. Providing a different `client_id` renames the
client, and the old ID stops working. URL-encode the client ID in the path when necessary.

```bash
curl -X PUT http://localhost:3000/client/another-client \
  -H "Content-Type: application/json" \
  -d '{
    "client_secret": "updated-secret",
    "redirect_uris": ["http://localhost:8080/new-callback"]
  }'
```

Returns `200` with `{"success":true,"client_id":"another-client"}`.

#### Delete a Client

**Endpoint:** `DELETE /client/{clientId}`

```bash
curl -X DELETE http://localhost:3000/client/another-client
```

Returns `200` with `{"success":true}`.

Validation, conflict, and not-found errors return `{"success":false,"error":"..."}`. Invalid bodies or client
metadata return `400`; updating or deleting an unknown client returns `404`; creating a duplicate ID
or renaming to an existing ID returns `409`. Invalid updates leave the existing configuration intact.
Successful responses do not include client secrets.

### Health Check

**Endpoint:** `GET /health`

Returns server status.

**Example:**

```bash
curl http://localhost:3000/health
```

## OIDC Endpoints

The server provides standard OIDC endpoints for authentication flows:

-   `/interaction/:uid` - Interactive authentication
-   `/interaction/:uid/login` - Login form submission

## Development

### Scripts

-   `npm run dev` - Start development server with watch mode
-   `npm run build` - Build the project
-   `npm test` - Run API tests
-   `npm run format` - Format code using Biome

### Docker

A Dockerfile is included for containerized deployment. See the example directory for docker-compose configuration.

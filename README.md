# OIDC Mock Server

Basic OIDC mock server to use for development and testing purposes.

## Overview

This is a lightweight OpenID Connect (OIDC) provider implementation designed for development and testing environments. It provides OIDC authentication flows and user management endpoints.

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
-   `npm run format` - Format code using Biome

### Docker

A Dockerfile is included for containerized deployment. See the example directory for docker-compose configuration.

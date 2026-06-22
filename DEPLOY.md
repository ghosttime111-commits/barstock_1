# Deploy BarStock to Vercel Free

BarStock is a TanStack Start full-stack app. Do not deploy it as a static SPA:
the app uses server functions under `/_serverFn/...` for login, roles,
inventory changes, reports, and Supabase access.

## Tenant isolation

BarStock currently connects to Supabase from server functions with the service
role. Tenant isolation is therefore enforced by those server functions, not by
RLS policies on the application tables. For every request, the server resolves
the current user from `session_token` and takes `network_id` from
`public.users`. Client-provided network filters are honored only for
`super_admin`; other roles are always restricted to their stored network.

The service role key must never be exposed to the browser. Tenant-aware RLS can
be added later as defense in depth, but it is not enabled by the multi-tenant
migration.

## 1. Create the Vercel project

1. Push the repository to GitHub.
2. In Vercel, create a new project and import the GitHub repository.
3. Keep the framework/build detection for a Vite/TanStack Start project.

## 2. Environment variables

Add these variables in Vercel Project Settings -> Environment Variables:

```text
BARSTOCK_SUPABASE_URL=https://exyuzmknueidcwhjqpji.supabase.co
BARSTOCK_SUPABASE_SERVICE_ROLE_KEY=<your Supabase service role key>
BARSTOCK_SESSION_SECRET=<random 32+ character secret>
```

Do not add the service role key with a `VITE_` prefix. It must stay server-only.

## 3. Build settings

Use:

```text
Build Command: npm run build
Install Command: npm install
Output Directory: leave empty / use Vercel default
```

The project config pins Nitro to the Vercel preset in `vite.config.ts`, so the
server runtime for TanStack Start server functions is generated during build.

## 4. Production smoke test

After deployment, check:

1. Open the deployed URL and log in as a test bartender.
2. Create an inventory.
3. Enter actual quantities.
4. Close the inventory.
5. Log in as accountant and open the report.
6. Confirm requests to `/_serverFn/...` return normal responses in the browser
   network tab, not 404/static-file errors.

If login or inventory actions fail, first check the Vercel function logs and
verify that all three environment variables are present in the Production
environment.

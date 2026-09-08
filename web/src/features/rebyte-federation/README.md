# Embedding observability in Rebyte

Use HTTPS hosts under the same site, for example `https://app.rebyte.ai` for
Rebyte and `https://observability.rebyte.ai` for this application. The latter is
an example deployment hostname, not an automatically provisioned service.

## Build and hosting settings

Set `REBYTE_EMBED_ALLOWED_ORIGINS="*"` to allow any website to embed the app,
including localhost on any port. The Rebyte build workflow uses this setting.
Login and project access checks still apply. Parent messages use the actual
HTTP/HTTPS parent origin, never `*` as the message destination.

For restricted deployments, a comma-separated list of exact HTTPS parent
origins is also supported, plus exact HTTP localhost/loopback origins for
development. Empty disables embedding. Paths, credentials, and partial
wildcards such as `https://*.example.com` are rejected.

For a source build, set the variable when running `pnpm run build`. For Docker,
pass it as a build argument from the repository root:

```sh
docker build -f web/Dockerfile \
  --build-arg 'REBYTE_EMBED_ALLOWED_ORIGINS=*' \
  -t rebyte-observability:embed .
```

Next.js stores these response headers in its build output. Changing this setting
requires rebuilding and deploying the web image; setting it only in the running
container does not change the policy. During development, set it before starting
the dev server and restart after changes.

At runtime, set `NEXTAUTH_URL=https://observability.rebyte.ai` and retain the
existing `AUTH_CUSTOM_*` and `REBYTE_FEDERATION_SECRET` configuration. Register
`https://observability.rebyte.ai/api/auth/callback/custom` with the OIDC provider
(include the configured base path if used). The proxy must forward the original
host and HTTPS scheme.

The web response permits only the configured parents through CSP
`frame-ancestors` and omits the conflicting `X-Frame-Options` header. The rest of
the CSP stays enabled. Ensure the hosting proxy/CDN does not add its own
`X-Frame-Options` or a stricter `frame-ancestors`. If Rebyte has a CSP, its
`frame-src` must allow the observability origin too. CORS is not needed merely
to display an iframe.

## Login and iframe URL

1. Use the existing Rebyte federation launch flow in a **top-level tab**:
   `/auth/rebyte?assertion=<fresh-server-issued-assertion>`. It binds the OIDC
   identity to the Rebyte organization and establishes this app's session.
2. Once login finishes, use the authorized project's URL as the iframe source:

   ```html
   <iframe
     src="https://observability.rebyte.ai/project/PROJECT_ID/traces"
     title="Observability"
     style="width: 100%; height: 100%; border: 0"
   ></iframe>
   ```

The parent must give the iframe container a height. Embedding does not grant
project access or replace authentication. Launch federation again when switching
to a tenant that needs provisioning or after the session expires. Avoid using
the federation launch URL as the iframe source: it initiates OIDC login, and
identity providers can block framing their login pages.

## Embedded interface and parent bridge

The traces list and trace detail routes support `embed=1` together with
`parentOrigin=https://app.rebyte.ai`. The parent origin must match an entry in
`REBYTE_EMBED_ALLOWED_ORIGINS` exactly, unless the allowlist contains `*`.
The same validated build-time value is
compiled into the browser as `NEXT_PUBLIC_REBYTE_EMBED_ALLOWED_ORIGINS`; do not
configure a separate browser allowlist.

The embedded shell retains session and project access checks, hides application
navigation, and keeps time-range, refresh, and trace controls. An expired or
missing session shows a reconnect state instead of navigating the iframe to
SSO. Authenticated project members have the same data permissions as in the full
application: URL filters are user-editable and are not an authorization boundary.
Rebyte must restrict this initial integration to organization admins.

An Agent list URL can carry these query values (encode them with URLSearchParams):

```text
embed=1
parentOrigin=https://app.rebyte.ai
dateRange=All
filter=metadata;stringObject;workspaceId;=;AGENT_ID,isRootObservation;boolean;;=;true
```

`dateRange=All` is supported on embedded tables and is their initial default;
changing an embedded time range does not overwrite the full application's
project-wide default. To show only persisted Rebyte Run roots, append
`,metadata;stringObject;observationRole;=;agent_run` to the filter. Those roots
are emitted after a Run becomes terminal, so in-progress Runs may not appear
until finalization and ingestion complete. The root's observation name is
`agent-run`; its trace name remains `agent-loop`.

Embedded lists and detail views use the V4 events reader consistently, including
for users with a legacy full-application preference. Empty projects render an
empty table instead of the developer setup wizard. Charts need a bounded time
range and are available after choosing one; All time shows the table.

The iframe posts the following status messages to the exact parent origin:

```ts
{ type: "rebyte:observability", status: "ready" | "auth-required" | "forbidden" | "error", projectId: string }
```

`ready` means the main list or trace query has succeeded, including an empty
list. Core query failures send `error`, and successful retries send `ready`
again; failures in auxiliary queries do not hide the whole frame. The parent must validate `event.origin` against the Observability
origin, `event.source === iframe.contentWindow`, the message schema, and the
expected project ID. No credentials or trace content are sent. Authentication
recovery must launch a fresh federation URL in a top-level tab, followed by
reloading the iframe. CSP rejection cannot send a message, so the parent also
needs a load timeout with an external Observability link.

Trace detail and peek expansion retain the embed parameters and originating
list filters. Same-origin links to sessions, users, and other full application
routes open in a new tab. Full application routes do not gain embed mode. The mode is a
presentation option and does not change any API authorization checks.

With the two HTTPS hosts under `rebyte.ai`, existing `SameSite=Lax`, `Secure`,
host-only session cookies can be used; `NEXTAUTH_COOKIE_DOMAIN` does not need to
be widened. Unrelated sites, mixed HTTP/HTTPS, or an unrelated outer frame can
make this a cross-site context. That setup is not covered by this integration:
changing to `SameSite=None` alone cannot bypass browser third-party cookie
restrictions.

## Verify a deployment

Inspect the headers of an HTML page, then open the iframe from the configured
Rebyte origin with an authenticated test user. Confirm the project loads and
navigation works. With `*`, also verify a localhost parent on a different port.
For restricted allowlists, repeat from an origin absent from the list and
confirm the browser blocks the frame. Check login separately in a top-level tab.

References: [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors),
[SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value).

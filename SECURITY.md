# Security policy

## Supported version

Security fixes currently target the latest `0.1.x` release and the exact DeepSeek Harness version declared in `package.json`.

## Reporting a vulnerability

Please use GitHub Private Vulnerability Reporting when it is available for this repository. Otherwise, open a minimal issue asking the maintainer for a private contact channel. Do not include credentials, private session logs, personal content, or a working destructive exploit in a public issue.

Include the plugin version, Harness version, persistence backend, operating system, reproduction conditions, impact, and whether session data was modified or lost.

## Destructive behavior

The Delete action permanently removes the selected archived session. It is protected by an explicit confirmation dialog and runtime checks, but users should still back up important Harness data before testing deletion or upgrading either Harness or this plugin.

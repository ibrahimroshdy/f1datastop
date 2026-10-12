# Security Policy

## Supported versions

Only the `main` branch, which is what runs at https://www.f1datastop.com, receives security
fixes. Older tagged releases are not patched separately.

## Reporting a vulnerability

Please report suspected vulnerabilities privately. Do not open a public GitHub issue or pull
request for them.

Email **admin@f1datastop.com** with:

- a description of the issue and its impact,
- steps or a proof of concept to reproduce it,
- the affected URL, file or component.

Please do not access or modify data that is not yours, run automated scans that degrade the
service, or publish details before a fix is available.

## What to expect

- This is a community project maintained by volunteers, so response times are best effort.
  We aim to acknowledge a report within a few days.
- We will confirm whether the issue is accepted, keep you informed of progress, and credit you
  in the fix if you wish.
- Please allow a reasonable period to fix the issue before any public disclosure.

## Scope notes

- Secrets (service-role keys, R2 credentials, webhook tokens) must never be committed. If you
  find one in the repository or its history, report it the same way.
- The browser app only uses the Supabase publishable (anon) key; access is enforced by
  row-level security.

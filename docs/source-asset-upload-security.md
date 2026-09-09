# Source asset upload security

- Direct-to-Blob upload tokens are short-lived and project/path scoped.
- Arbitrary remote URLs are never fetched.
- Declared MIME, decoded image type, extension and SHA-256 must agree.
- Limits: `SOURCE_ASSET_MAX_MB` (default 20) and `SOURCE_ASSET_MAX_PIXELS` (default 40,000,000).
- Private read URLs are generated on demand and are not persisted.
- Filenames are sanitized and never determine object identity.
- Errors are sanitized; credentials, bytes and provider payloads are not logged.

Operational configuration is documented in `.env.example`. `SOURCE_ASSET_ALLOW_INMEMORY_STORAGE` must remain false in production.

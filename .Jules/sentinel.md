## 2024-05-23 - Hardcoded Database Credentials
**Vulnerability:** Found hardcoded credentials (username, password) and a public IP address for a CouchDB instance in `src/config/database.ts`.
**Learning:** These were likely leftover from a previous development phase or personal configuration intended to facilitate "automatic sync". Even if the sync feature is currently disabled via flags (`isSyncEnabled` returns false), the presence of valid credentials in the source code is a critical risk if the repository is public or shared.
**Prevention:**
1. Never commit real credentials, even for "development convenience".
2. Use environment variables exclusively for sensitive configuration.
3. Ensure "default" values in code are safe placeholders (like `localhost` or empty strings), not actual secrets.

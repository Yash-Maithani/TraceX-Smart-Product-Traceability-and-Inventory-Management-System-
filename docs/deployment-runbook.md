# TraceX — Deployment & Operations Runbook

## Setting the Initial Super-Admin in Production

In accordance with SPEC §2 and §3.5, **no API endpoint can set or promote a user to `isSuperAdmin: true`**. The super-admin flag exists outside the standard 5-value `role` enum.

In production environments, promote the initial administrator directly in MongoDB via `mongosh` or MongoDB Atlas Data Explorer.

### mongosh Command

Connect to your production MongoDB cluster:

```bash
mongosh "mongodb+srv://<cluster-url>/tracex_fresh" --username <db-admin>
```

Execute the update to promote an existing user:

```javascript
db.users.updateOne(
  { username: "target_admin_username" },
  { 
    $set: { 
      isSuperAdmin: true,
      updatedAt: new Date()
    } 
  }
);
```

Verify the update:

```javascript
db.users.findOne({ username: "target_admin_username" }, { username: 1, role: 1, isSuperAdmin: 1, isActive: 1 });
```

### Safety Rules

1. **Last Super-Admin Protection**: The application prevents deactivation or deletion of the last remaining super-admin.
2. **Audit Verification**: Every promotional action or direct database alteration must be documented in internal compliance logs.
3. **Profile and Seed Password Isolation**: The `dev` and `test` Spring profiles and their committed seed passwords (`DevPass123456!`, `TestPass123456!`) must **NEVER** be run against a shared, staging, or production database. Any test execution against non-test databases is strictly blocked by the global safety extension (`GlobalTestDatabaseSafetyExtension`), and production environments must strictly use the `prod` profile with `SEED_DEFAULT_PASSWORD` provided exclusively via environment variables.


4. **Rate-limit bucket isolation**: After deploy, verify that login attempts from two different networks produce separate rate-limit counters. Simulate: make 10 rapid login attempts from Network A (429 on attempt 11), then make 1 attempt from Network B (should return 401 not 429). If Network B gets 429, the rate limiter is using a shared or spoofed key — redeploy with the correct server.forward-headers-strategy.
5. **TRACE_TOKEN_SECRET Stability**: `TRACE_TOKEN_SECRET` must remain stable across deployments. It is used to generate HMAC-SHA256 signatures for QR trace tokens. Rotating or altering `TRACE_TOKEN_SECRET` invalidates every physically printed QR code in circulation, rendering them unresolvable (404 NOT_FOUND). In `prod`, `TRACE_TOKEN_SECRET` must be at least 32 characters long and must never be changed after production launch.

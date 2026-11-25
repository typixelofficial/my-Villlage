# Security Specification — TYPIXEL OPEN WORLD (Green Valley)

## 1. Data Invariants

1. **PII Isolation**: `/players/{uid}` stores only public gameplay state (display name, 3D avatar customization, economy balance, progression) and strictly forbids PII fields (`email`, `phone`, `address`). Private Google account PII (`email`, `googleName`) is isolated in `/players/{uid}/private/{docId}` readable and writable exclusively by `request.auth.uid == uid`.
2. **Identity Integrity**: Every player document, private account document, and wallet transaction must enforce `data.uid == uid && uid == request.auth.uid` with `request.auth.token.email_verified == true`.
3. **Economy Anti-Cheat Bounds**: New player profiles must start at exactly `1500` Green Coins, `level == 1`, `xp == 0`, and empty ownership arrays. Subsequent client syncs are strictly bounded (`greenCoins <= existing.greenCoins + 1000`, `greenCoins >= 0`, `greenCoins <= 10000000`) and paired with server-side Socket.IO validation.
4. **Master Gate Relational Sync**: Writing to `/players/{uid}/private/{docId}`, `/players/{uid}/transactions/{txId}`, or claiming `/properties/{propertyId}` requires the parent `/players/{uid}` document to exist.
5. **Immutable Audit Fields**: `createdAt`, `purchasedAt`, `uid`, and `ownerUid` are immutable after creation. Wallet transactions are append-only (updates and deletes denied).
6. **Zero Blanket List Queries**: Every `allow list` rule evaluates `resource.data` directly against `request.auth.uid` or `resource.data.isPublic == true`.

## 2. The Dirty Dozen Adversarial Payloads

1. **Identity Spoofing on Profile Create**: User A attempts to create `/players/userB` with `uid: "userB"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection**: User A attempts to create or update `/players/userA` with an undeclared field `{ isAdmin: true }`. Expected: `PERMISSION_DENIED`.
3. **Starting Balance Inflation**: User A attempts to create `/players/userA` with `greenCoins: 9999999`. Expected: `PERMISSION_DENIED`.
4. **Infinite Coin Minting on Update**: User A attempts to update `/players/userA` setting `greenCoins: existing + 500000`. Expected: `PERMISSION_DENIED`.
5. **PII Cross-User Read**: User B attempts `get(/players/userA/private/account)` to read User A's email. Expected: `PERMISSION_DENIED`.
6. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to write `/players/userA`. Expected: `PERMISSION_DENIED`.
7. **ID Poisoning Attack**: Attacker targets `/players/<200-char-junk-id>` or special characters `../admin`. Expected: `PERMISSION_DENIED`.
8. **Timestamp Forgery**: User A supplies a backdated `createdAt` or `updatedAt` instead of `request.time`. Expected: `PERMISSION_DENIED`.
9. **Immutable Field Tampering**: User A attempts to alter `createdAt` or `uid` on an existing `/players/userA` document. Expected: `PERMISSION_DENIED`.
10. **Transaction History Tampering**: User A attempts to `update` or `delete` `/players/userA/transactions/tx1`. Expected: `PERMISSION_DENIED`.
11. **Property Hijacking**: User B attempts to `update` `/properties/villa-1` owned by User A, or change `ownerUid`. Expected: `PERMISSION_DENIED`.
12. **Array Resource Exhaustion**: User A attempts to write 500 items into `inventory` or `friends`. Expected: `PERMISSION_DENIED`.

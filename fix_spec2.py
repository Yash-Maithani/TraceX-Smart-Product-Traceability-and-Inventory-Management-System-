# -*- coding: utf-8 -*-
with open('SPEC.md', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('### 3.1 Batch Freshness (FEFO Engine)', '### 3.1 Batch Freshness (FEFO Engine)\nNote: Freshness tiers (READY/WARNING/URGENT/EXPIRED) are computed on read, not stored. DISPATCHED and the soft-delete flag are stored states.')

text = text.replace('### 3.5 Dispatch & Recalls', '### 3.5 Dispatch & Recalls\nNote: DISPATCHED is a stored lifecycle state.')

text = text.replace('- `status` (Enum: READY, WARNING, URGENT, EXPIRED, DISPATCHED, ARCHIVED)', '- `lifecycleState` (Enum: ACTIVE, DISPATCHED) - Note: status is NOT a stored field for freshness, it is computed from expiryDate + Clock on every read, except DISPATCHED which is stored.')

text = text.replace('#### Required Variables', '#### Required Variables\n- `BUSINESS_TIME_ZONE` (optional, default `Asia/Kolkata`)')

with open('SPEC.md', 'w', encoding='utf-8') as f:
    f.write(text)

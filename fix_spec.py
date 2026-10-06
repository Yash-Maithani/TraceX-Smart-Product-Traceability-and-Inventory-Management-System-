import re

with open('SPEC.md', 'r', encoding='utf-8') as f:
    text = f.read()

decisions_insert = """| D-16 | Freshness status tier (READY/WARNING/URGENT/EXPIRED) is derived at runtime from expiryDate and the injected Clock bean. It is never stored in MongoDB. The status field is NOT stored on the Batch document for freshness. Exception: DISPATCHED and ARCHIVED are lifecycle states that ARE stored. The freshness compute logic lives exclusively in BatchFreshness.java. | RESOLVED |
| D-17 | All date-only display comparisons ("days until expiry") use the BUSINESS_TIME_ZONE env var (default Asia/Kolkata). The backend Clock bean is configured at this zone for ZonedDateTime computations. This does NOT affect stored UTC timestamps. | RESOLVED |"""

text = text.replace('| D-15', decisions_insert + '\n| D-15')

# I will just write this replacement back and do the rest manually if needed, or by appending.
with open('SPEC.md', 'w', encoding='utf-8') as f:
    f.write(text)

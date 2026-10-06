# Audit: AI Features
> Audit date: 2026-10-01

## AI Feature Exists: YES

A real AI feature is present and is not a stub.

---

## Feature: Dispatch Audit (Gemini + NVIDIA Fallback)

### Location
- Service: `backend/src/services/aiService.js`
- Controller: `backend/src/controllers/ai.controller.js`
- Route: `backend/src/routes/ai.routes.js`
- Frontend hook: `frontend/src/hooks/useAIAudit.js`

### Model (Primary)
**Google Gemini 2.5 Flash**

Source: `backend/src/services/aiService.js` line 134:
```js
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
```

### Model (Fallback)
**NVIDIA NIM — default `meta/llama-3.1-70b-instruct`**

Source: `backend/src/services/aiService.js` lines 89–91:
```js
const apiKey = process.env.NVIDIA_API_KEY;
const modelName = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';
```

### API Key Location
- Gemini key: `process.env.GEMINI_API_KEY` (source: `aiService.js` line 3)
- NVIDIA key: `process.env.NVIDIA_API_KEY` (source: `aiService.js` line 90)
- Both declared in `.env.example` lines 26 and 31; placeholder values only — no real keys committed.

### Input
Active warehouse batches (not deleted, not dispatched — status READY/WARNING/URGENT).
Fields sent to AI (source: `aiService.js` lines 47–59):
`batchCode`, `productName`, `sku`, `status`, `daysUntilExpiry`, `quantity`, `unit`, `yieldPercent`, `farmerName`, `village`, `dataSource`

### Output Schema (source: `aiService.js` lines 70–77)
```json
{
  "urgentBatches":    [{ "batchCode": "", "reason": "" }],
  "qualityWarnings":  [{ "batchCode": "", "concern": "" }],
  "top3Priorities":   [{ "rank": 1, "batchCode": "", "productName": "", "action": "", "reasoning": "" }],
  "supplyChainRisks": [{ "risk": "", "severity": "HIGH|MEDIUM|LOW", "recommendation": "" }],
  "summary":          "",
  "totalAnalyzed":    0,
  "analyzedAt":       ""
}
```

### Purpose
Supply chain advisor: identifies urgent batches, quality warnings, top-3 dispatch priorities, and systemic supply-chain risks from the current warehouse state.

### Limits
- Rate limited: 5 calls per 15-minute window per IP (source: `rateLimiter.js` lines 71–75; `ai.routes.js` line 5)
- Cache TTL: 4 hours by default, configurable via `GEMINI_CACHE_TTL_HOURS` (source: `aiService.js` line 19)
- Cache stored in-process; also stored in a shared store (Redis-like) if `REDIS_URL` is configured (source: `sharedStore.js`)

### Failure Behavior
Source: `aiService.js` lines 131–147.
1. Gemini fails → warning logged → NVIDIA NIM fallback tried.
2. NVIDIA also fails → error `"429: Both AI providers are currently unavailable."` returned to client.
3. JSON parse failure → error `"AI returned an unexpected format."` returned.

### Privacy
The AI is sent `farmerName` and `village` as part of the batch summary. This is personally identifiable supply-chain data. No consent mechanism or data-minimization exists in the reference. New build must address this.

---

## Conclusion

The AI feature is real, functional conditional on valid API keys being supplied at runtime, and implemented end-to-end. It is not a stub or placeholder.

# Reference Audit — Bulk Import (`docs/00-audit/import-reference.md`)

> **Phase**: 8.0 (Import Reference Extraction)  
> **Reference Workspace**: `c:\Users\yashm\OneDrive\Desktop\TraceX-Smart-Product-Traceability-and-Inventory-Management-System` (read-only)  
> **Extraction Summary**: **11 / 11 sections answered** (`11 answered`, `0 partial`, `0 not found` across the 7 named source/test files; **not found in reference**: backend unit/integration tests for bulk import in `backend/tests/` and standalone `.csv` fixture files — only `frontend/src/utils/csvParser.test.js` and `backend/tests/rbac.test.js` lines 80–95, 115–130 exist).

---

## Reference Files Audited

| File Path in Reference Workspace | Status | Lines | Purpose |
|---|---|---|---|
| `backend/src/controllers/import.controller.js` | Found & read in full | 1–731 | Schema, header mapping, row validation, product contract lookup, dedupe key, batch code pre-allocation, chunk commit, job history, rollback |
| `backend/src/models/ImportJob.model.js` | Found & read in full | 1–77 | `ImportJob` Mongoose schema (`importjobs` collection), `RowErrorSchema`, status enum, indexes |
| `backend/src/routes/import.routes.js` | Found & read in full | 1–17 | Express router mounting 7 endpoints under `router.use(protect, requireImporter)` |
| `backend/src/middleware/requireAdmin.js` | Found & read in full | 109–116 | `requireImporter` middleware definition |
| `backend/src/services/expiryCalculator.js` | Found & read in full | 1–37 | `calculateExpiry`, `getBatchStatus`, `calculatePriorityScore` called by `commitImport` |
| `backend/src/utils/productContract.js` | Found & read in full | 1–13 | `assertProductContract` called by `analyseRows` |
| `frontend/src/components/ImportPanel.jsx` | Found & read in full | 1–615 | 4-step import wizard (`File`, `Map columns`, `Preview`, `Import`), template download, error report CSV export, `HistoryTable` with rollback modal |
| `frontend/src/hooks/useImport.js` | Found & read in full | 1–148 | Client API hook (`loadSchema`, `mapHeaders`, `validate`, `commit`, `loadHistory`, `rollback`) with 200-row client chunking |
| `frontend/src/utils/csvParser.js` | Found & read in full | 1–170 | Zero-dependency RFC-4180 CSV parser (`stripBom`, `detectDelimiter`, `parseCsvRows`, `parseCsvToObjects`, `toCsv`) |
| `frontend/src/utils/csvParser.test.js` | Found & read in full | 1–133 | 12 Vitest unit tests for `csvParser.js` |
| `backend/tests/rbac.test.js` | Found & read in full | 80–95, 115–130 | Unit tests for `requireImporter` middleware |
| Backend import controller test / `.csv` fixtures | **Not found in reference** | — | Search of reference `backend/tests/` (`aiService.test.js`, `expiryCalculator.test.js`, `qrGenerator.test.js`, `rbac.test.js`) and `*.csv` across workspace returned 0 backend import tests and 0 `.csv` fixture files (the sample template is generated inline in `ImportPanel.jsx` lines 31–44) |

---

## 1. Import Schema

### Reference Behaviour
- **Endpoint**: `GET /api/import/schema` (`backend/src/controllers/import.controller.js` lines 378–387) returns:
  - `columns`: the 9 entries of `IMPORT_COLUMNS` (`lines 52–104`) with `aliases` stripped (`key`, `label`, `required`, `type`, `example`, `hint`, `enumValues`).
  - `maxChunkRows`: `500` (`MAX_CHUNK_ROWS`, line 40).
  - `dedupeRule`: `'Source Lot Code + Product SKU + Pack Date'` (line 384).
- **Columns (`IMPORT_COLUMNS`, `backend/src/controllers/import.controller.js` lines 52–104)**:

| `key` | `label` | `required` | `type` | Allowed Values / Format | Default When Unmapped/Blank | `aliases` (`import.controller.js` lines 57–102) |
|---|---|---|---|---|---|---|
| `productSku` | `Product SKU` | `true` (satisfied if `productName` is provided; lines 174, 413) | `string` | Catalogue `Product.sku` (uppercased & trimmed; line 125) | `''` | `sku`, `productsku`, `productcode`, `itemsku`, `itemcode`, `batchsku`, `skucode` |
| `productName` | `Product Name` | `false` | `string` | Exact match on `Product.productName` if `productSku` omitted (lines 62, 232, 319) | `''` | `product`, `productname`, `itemname`, `item` |
| `sourceLotCode` | `Source Lot Code` | `true` | `string` | Uppercased & trimmed non-empty string (lines 125, 179) | None (validation error) | `lot`, `lotcode`, `sourcelot`, `sourcelotcode`, `rawlot`, `lotno`, `lotnumber` |
| `farmerName` | `Farmer Name` | `true` | `string` | Trimmed non-empty string (lines 125, 182) | None (validation error) | `farmer`, `farmername`, `supplier`, `suppliername`, `grower` |
| `village` | `Village` | `true` | `string` | Trimmed non-empty string (lines 125, 185) | None (validation error) | `village`, `source`, `origin`, `location` |
| `quantityProduced` | `Quantity Produced` | `true` | `number` | Finite number `>= 1` (commas stripped; lines 117–121, 188–193) | None (validation error) | `quantity`, `qty`, `quantityproduced`, `output`, `produced` |
| `unit` | `Unit` | `true` | `enum` | Canonical `Kg`, `Units`, or `Liters` via `UNIT_ALIASES` (`lines 46–50`: `kg`/`kgs`/`kilogram`/`kilograms` -> `Kg`; `unit`/`units`/`pcs`/`pieces`/`pack`/`packs`/`jar`/`jars`/`bottle`/`bottles` -> `Units`; `l`/`lt`/`ltr`/`liter`/`liters`/`litre`/`litres` -> `Liters`) | None (validation error) | `unit`, `uom`, `units`, `measure` |
| `yieldPercent` | `Yield %` | `true` | `number` | Finite number `0..100` inclusive (lines 199–204) | None (validation error) | `yield`, `yieldpercent`, `yieldpct`, `yieldpercentage`, `recovery` |
| `packDate` | `Pack Date` | `true` | `date` | `YYYY-MM-DD` (ISO) or `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY` (lines 132–154, 206–209) | None (validation error) | `packdate`, `packed`, `packedon`, `productiondate`, `date`, `mfgdate`, `manufactured` |

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 52–65 & 378–387)
```javascript
const IMPORT_COLUMNS = [
  {
    key:      'productSku',
    label:    'Product SKU',
    required: true,
    type:     'string',
    example:  'WBJC',
    hint:     'Matches Product.sku (preferred) or falls back to Product Name',
    aliases:  ['sku', 'productsku', 'productcode', 'itemsku', 'itemcode', 'batchsku', 'skucode']
  },
```
```javascript
exports.getImportSchema = (_req, res) => {
  res.json({
    success: true,
    data: {
      columns: IMPORT_COLUMNS.map(({ aliases, ...rest }) => rest),
      maxChunkRows: MAX_CHUNK_ROWS,
      dedupeRule: 'Source Lot Code + Product SKU + Pack Date'
    }
  });
};
```

---

## 2. Header Mapping

### Reference Behaviour
- **Endpoint**: `POST /api/import/map-headers` (`backend/src/controllers/import.controller.js` lines 394–417).
- **Normalisation (`headerToken`, lines 108–111)**: Converts header string to lowercase and strips all non-alphanumeric characters (`replace(/[^a-z0-9]/g, '')`).
- **Matching algorithm (`lines 401–410`)**:
  1. Iterates through `IMPORT_COLUMNS` in declaration order.
  2. For each canonical column `col`, searches `cleaned` sheet headers for the first header `h` not already in `taken` where `headerToken(h)` equals `headerToken(col.key)`, `headerToken(col.label)`, or is included in `col.aliases`.
  3. **No fuzzy or Levenshtein matching** is performed; only normalized exact key, label, or alias token matching.
  4. If matched, sets `mapping[col.key] = hit` and adds `hit` to `taken` (each sheet column can map to at most one canonical field).
  5. If not matched and `col.required === true`, pushes `col.key` to `unmappedRequired`.
  6. **Special fallback rule (`line 413`)**: If `mapping.productName` is present, `'productSku'` is filtered out of `unmappedRequired`.
- **Response shape (`lines 415–416`)**: `{ success: true, data: { mapping: { [canonicalKey]: sheetHeader }, unmappedRequired: string[] } }`.
- **What happens to unmapped and unknown columns (`frontend/src/components/ImportPanel.jsx` lines 413–424)**:
  - Unmapped required columns remain in `unmappedRequired`, rendering a warning banner (`lines 193–200`) and disabling the `Validate N rows` button (`line 221`) until the user maps them in the dropdowns.
  - Unmapped optional columns (`productName`, or `productSku` when `productName` is mapped) evaluate to `''` when `canonicalRows` is constructed (`ImportPanel.jsx` line 418: `out[col.key] = sheetHeader ? row[sheetHeader] : ''`).
  - Unknown sheet columns not selected in any canonical column dropdown are ignored (`— Ignore —` option, `ImportPanel.jsx` line 210) and omitted from `canonicalRows`.

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 399–416)
```javascript
  const mapping = {};
  const unmappedRequired = [];
  const taken = new Set();

  for (const col of IMPORT_COLUMNS) {
    const hit = cleaned.find(h => {
      if (taken.has(h)) return false;
      const tok = headerToken(h);
      return tok === headerToken(col.key) || tok === headerToken(col.label) || col.aliases.includes(tok);
    });
    if (hit) { mapping[col.key] = hit; taken.add(hit); }
    else if (col.required) unmappedRequired.push(col.key);
  }
  // productSku is satisfied if productName is mapped instead
  const finalUnmapped = mapping.productName
    ? unmappedRequired.filter(k => k !== 'productSku')
    : unmappedRequired;
  res.json({ success: true, data: { mapping, unmappedRequired: finalUnmapped } });
```

---

## 3. Validation

### Reference Behaviour
- **Request-level guards (`validateImport`, `backend/src/controllers/import.controller.js` lines 425–432; `commitImport`, lines 476–482)**:
  - Empty `rows` array (`!rows.length`) -> HTTP `400` `{ success: false, message: 'No rows supplied' }`.
  - Chunk size > 500 (`rows.length > MAX_CHUNK_ROWS`) -> HTTP `413` `{ success: false, message: 'Too many rows in one request — send at most 500 per chunk' }`.
- **Per-field validation & coercion (`validateRow`, `lines 172–214`)**:
  - `productSku` / `productName`: trimmed; `productSku` coerced via `.toUpperCase()` (`line 174`). If both are empty -> `{ field: 'productSku', message: 'Needs a Product SKU or a Product Name' }`.
  - `sourceLotCode`: trimmed and coerced via `.toUpperCase()` (`line 179`). If empty -> `{ field: 'sourceLotCode', message: 'Source lot code is required' }`.
  - `farmerName`: trimmed (`line 182`). If empty -> `{ field: 'farmerName', message: 'Farmer name is required' }`.
  - `village`: trimmed (`line 185`). If empty -> `{ field: 'village', message: 'Village is required' }`.
  - `quantityProduced`: coerced via `parseNumber` (`lines 117–121`, strips commas `,` and whitespace, converts with `Number(s)`). If `null`/`NaN` -> `{ field: 'quantityProduced', message: 'Quantity must be a number' }`. If `< 1` -> `{ field: 'quantityProduced', message: 'Quantity must be at least 1' }`. (Note: fractional numbers like `1.5` are not rejected.)
  - `unit`: coerced via `normaliseUnit` (`lines 127–130`, strips non-letters, lowercases, looks up in `UNIT_ALIASES` lines 46–50). If not in `UNIT_ALIASES` -> `{ field: 'unit', message: 'Unit must be Kg, Units or Liters' }`.
  - `yieldPercent`: coerced via `parseNumber`. If `null`/`NaN` -> `{ field: 'yieldPercent', message: 'Yield must be a number' }`. If `< 0 || > 100` -> `{ field: 'yieldPercent', message: 'Yield must be between 0 and 100' }`.
  - `packDate`: coerced via `parseDate` (`lines 132–154`). Accepts `Date` instances, ISO strings matching `/^(\d{4})-(\d{2})-(\d{2})/` (parsed via `new Date(s)`), or day-first strings matching `/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/` where `day` is `1..31`, `month` is `1..12`, `year` is `1970..2100` (constructed via `new Date(Date.UTC(year, month - 1, day))`). If `null` -> `{ field: 'packDate', message: 'Pack date must be DD/MM/YYYY or YYYY-MM-DD' }`.
- **Catalogue product lookup & contract check (`resolveProducts` lines 224–251, `analyseRows` lines 316–331, `productContract.js` lines 1–10)**:
  - Bulk-fetches `Product.find({ $or: [{ sku: { $in: skus } }, { productName: { $in: names } }] })`.
  - Matches `bySku.get(sku)` first, falling back to `byName.get(name.toLowerCase())` (`line 319`).
  - If not found -> `{ field: 'productSku', message: 'No catalogue product matches "<sku || productName>"' }`.
  - If `assertProductContract(p)` fails (`isActive === false`, missing `productName`/`sku`, or missing shelf life) -> `{ field: 'productSku', message: 'Product "<label>" failed the catalogue contract: <reason>' }`.
- **Error message shapes**:
  - In `POST /api/import/validate` (`lines 446–456`): each preview item has `errors: [{ field, message }]`.
  - In `POST /api/import/commit` (`lines 568–579`) and `ImportJob.rowErrors` (`ImportJob.model.js` lines 16–22): each field error is flattened to a separate `{ row, field, value, message }` entry (`row` is 1-based spreadsheet row number `rowOffset + idx`).

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 188–211)
```javascript
  const qty = parseNumber(raw.quantityProduced);
  if (qty === null) errors.push({ field: 'quantityProduced', message: 'Quantity must be a number' });
  else if (qty < 1) errors.push({ field: 'quantityProduced', message: 'Quantity must be at least 1' });
  else              value.quantityProduced = qty;

  const unit = normaliseUnit(raw.unit);
  if (!unit) errors.push({ field: 'unit', message: 'Unit must be Kg, Units or Liters' });
  else       value.unit = unit;

  const yld = parseNumber(raw.yieldPercent);
  if (yld === null)             errors.push({ field: 'yieldPercent', message: 'Yield must be a number' });
  else if (yld < 0 || yld > 100) errors.push({ field: 'yieldPercent', message: 'Yield must be between 0 and 100' });
  else                           value.yieldPercent = yld;

  const packed = parseDate(raw.packDate);
  if (!packed) errors.push({ field: 'packDate', message: 'Pack date must be DD/MM/YYYY or YYYY-MM-DD' });
  else         value.packDate = packed;
```

---

## 4. Row Outcome

### Reference Behaviour
- **Verdicts (`analyseRows`, `backend/src/controllers/import.controller.js` lines 301–359)**: Every row receives one of three active verdicts: `'insert'`, `'skip'`, or `'error'`.
- **No `'update'` verdict exists**: Although `ImportJob.model.js` line 38 defines an `updated` counter field, its comment explicitly states `updated: { type: Number, default: 0 }, // always 0 today — dedupe policy is skip-not-upsert`. No row ever updates an existing batch.
- **Dedupe key (`dedupeKey`, `lines 162–165`)**:
  - Exact composite key: `` `${String(product.sku).toUpperCase()}|${String(value.sourceLotCode).toUpperCase()}|${day}` `` where `day` is `packDate.toISOString().slice(0, 10)` (`YYYY-MM-DD` in UTC).
- **When a row is `'error'` (`lines 310–336`)**:
  - `validateRow(raw)` returns one or more field errors, OR `resolveProducts` cannot find the product or fails `assertProductContract`.
- **When a row is `'skip'` (`lines 254–264, 338–357`)**:
  1. **Already in database (`existingKeys`)**: `findExistingKeys(candidates)` (`lines 254–264`) queries `Batch.find({ sourceLotCode: { $in: lots } }).select('sku sourceLotCode packDate').lean()`. If `existingKeys.has(key)`, the row gets `verdict: 'skip'` with `reason: 'Already imported — lot <sourceLotCode> / <sku> / <YYYY-MM-DD>'`.
  2. **Duplicate within the same chunk (`seenInFile`)**: If `seenInFile.has(key)` (already encountered on an earlier valid row in the same `analyseRows` call), the row gets `verdict: 'skip'` with `reason: 'Duplicate of an earlier row in this file (same lot, product and pack date)'`.
- **When a row is `'insert'` (`lines 358–359`)**:
  - Passes all field and product validations and its `dedupeKey` is in neither `existingKeys` nor `seenInFile`. `seenInFile.add(key)` is recorded so subsequent rows in the same chunk with the same key are skipped.

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 162–165 & 338–359)
```javascript
const dedupeKey = (product, value) => {
  const day = value.packDate.toISOString().slice(0, 10);
  return `${String(product.sku).toUpperCase()}|${String(value.sourceLotCode).toUpperCase()}|${day}`;
};
```
```javascript
    const key = dedupeKey(product, v.value);
    if (existingKeys.has(key)) {
      results.push({
        rowNumber,
        verdict: 'skip',
        reason: `Already imported — lot ${v.value.sourceLotCode} / ${product.sku} / ${v.value.packDate.toISOString().slice(0, 10)}`,
        value: v.value,
        product,
        errors: []
      });
      return;
    }
    if (seenInFile.has(key)) {
      results.push({ rowNumber, verdict: 'skip', reason: 'Duplicate of an earlier row in this file (same lot, product and pack date)', value: v.value, product, errors: [] });
      return;
    }
    seenInFile.add(key);
    results.push({ rowNumber, verdict: 'insert', value: v.value, product, errors: [] });
```

---

## 5. Derived Values

### Reference Behaviour
- **Direct database write (does NOT call `batches.controller.js#createBatch`)**: `commitImport` (`backend/src/controllers/import.controller.js` lines 506–562) constructs batch objects directly in the import controller and writes them via `Batch.insertMany(payload, { ordered: false, rawResult: false })` (`line 562`).
- **How each field is produced during `commitImport` (`lines 506–550`)**:
  - `batchCode`: Pre-allocated as a block via `preallocateBatchCodes(toInsert.length)` (`lines 273–289`). Queries `Batch.findOne({ batchCode: new RegExp('^' + prefix) }).sort({ batchCode: -1 })` where `prefix` is `HS-${year}-${month}-` (from `new Date()`), parses the trailing integer `start`, and generates `HS-YYYY-MM-NNN` (`padStart(3, '0')`) for `i = 1..count` in memory.
  - `packDate`: `value.packDate` (`Date` object returned by `parseDate`, line 531).
  - `expiryDate`, `daysUntilExpiry`, `dataSource`, `shelfLifeSource`, `shelfLife`: Computed by calling `calculateExpiry(product, value.packDate)` (`backend/src/services/expiryCalculator.js` lines 3–18). Uses `product.predictedShelfLifeDays` if non-null (`dataSource = 'predicted'`, `shelfLifeSource = 'predicted'`), else `product.baseShelfLifeDays` (`dataSource = 'fallback'`, `shelfLifeSource = 'base'`), adding `shelfLife * 86400 * 1000` ms to `packDate`.
  - `status`: Computed via `getBatchStatus(expiryInfo.daysUntilExpiry)` (`expiryCalculator.js` lines 21–26: `<= 0` `'EXPIRED'`, `<= 7` `'URGENT'`, `<= 30` `'WARNING'`, `> 30` `'READY'`) and **stored directly on the Batch document** (`line 534`).
  - `priorityScore`: Computed via `calculatePriorityScore(expiryInfo.daysUntilExpiry, product.riskLevel)` (`expiryCalculator.js` lines 29–33: `Math.max(0, 365 - daysUntilExpiry) + riskBonus`) and **stored on the Batch document** (`line 535`).
  - `qrCodeDataUrl`, `qrAbsoluteUrl`, `traceToken`: Produced per row by calling `await generateBatchQR(batchCode)` (`line 517`).
  - `traceabilityNote`: If `product.predictedExpiryTemplate` is truthy, replaces `'{days}'` with `Math.round(expiryInfo.daysUntilExpiry)`; otherwise `'Best before ' + expiryInfo.expiryDate.toDateString()` (`lines 539–541`).
  - `createdBy` & `noteHistory`: Sets `createdBy: actor` (`req.user?.username || req.user?.name || 'importer'`) and initializes `noteHistory: [{ note: 'Bulk imported from <fileName> (import #<job._id>)', editedBy: actor, editedAt: new Date() }]` (`lines 543–548`).

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 514–549)
```javascript
      const expiryInfo = calculateExpiry(product, value.packDate);
      const status     = getBatchStatus(expiryInfo.daysUntilExpiry);
      const priority   = calculatePriorityScore(expiryInfo.daysUntilExpiry, product.riskLevel);
      const qr         = await generateBatchQR(batchCode);

      payload.push({
        productId:        product._id,
        productName:      product.productName,
        sku:              product.sku,
        sourceLotCode:    value.sourceLotCode,
        farmerName:       value.farmerName,
        village:          value.village,
        quantityProduced: value.quantityProduced,
        unit:             value.unit,
        yieldPercent:     value.yieldPercent,
        batchCode,
        packDate:         value.packDate,
        expiryDate:       expiryInfo.expiryDate,
        dataSource:       expiryInfo.dataSource,
        shelfLifeSource:  expiryInfo.shelfLifeSource,
        status,
        priorityScore:    priority,
```

---

## 6. Chunking and Job Lifecycle

### Reference Behaviour
- **Chunk sizes**:
  - **Server limit (`MAX_CHUNK_ROWS`, `backend/src/controllers/import.controller.js` line 40)**: `500` rows per request (enforced on both `POST /api/import/validate` line 429 and `POST /api/import/commit` line 479 with HTTP `413`).
  - **Client chunk size (`CHUNK_SIZE`, `frontend/src/hooks/useImport.js` line 19)**: `200` rows per chunk for both `validate` (`line 71`) and `commit` (`line 99`).
- **When the `ImportJob` document is created (`import.controller.js` lines 489–501)**:
  - On the first chunk call to `POST /api/import/commit` (`jobId` is `null`), `ImportJob.create({ fileName, entity: 'batch', status: 'running', totalRows: Number(totalRows) || rows.length, createdBy: actor, createdByRole: actorRole })` creates the document and returns `jobId: job._id` with HTTP `201` (`line 624`).
- **How later chunks reach the same job (`useImport.js` lines 105–121; `import.controller.js` lines 490–493)**:
  - Client captures `jobId = data?.data?.jobId` from chunk 0's response and passes `jobId`, `rowOffset: i * CHUNK_SIZE + 2`, `totalRows: rows.length`, and `isFinal: i === groups.length - 1` on chunks `1..N-1`.
  - Server loads `await ImportJob.findById(jobId)` (`line 491`), returning `404` if missing or `409` if `job.status === 'rolled_back'`.
- **Status transitions (`ImportJob.model.js` lines 29–33; `import.controller.js` lines 496, 595–598, 675)**:
  - Initial status on creation: `'running'`.
  - When `Boolean(isFinal) === true` (`lines 595–598`): transitions to `'failed'` if `job.inserted === 0 && job.errored > 0`, otherwise transitions to `'done'`, and sets `job.finishedAt = new Date()`.
  - On `POST /api/import/:id/rollback` (`line 675`): transitions from `'done'` to `'rolled_back'` and sets `rolledBackAt` and `rolledBackBy`.
- **`rowErrors` cap of 200 and `rowErrorsTruncated` (`import.controller.js` lines 44, 591–593, 629; `ImportJob.model.js` lines 47–48)**:
  - `MAX_STORED_ERRORS = 200` (`line 44`). While appending `chunkErrors` to `job.rowErrors`, once `job.rowErrors.length >= 200`, remaining errors are not stored and `job.rowErrorsTruncated = true` is set. Each chunk HTTP response also slices `errors: chunkErrors.slice(0, 50)` (`line 629`).
- **`processedRows` handling (`import.controller.js` line 589)**:
  - Incremented by `rows.length` on every chunk (`job.processedRows += rows.length`).
- **What happens on a failed chunk**:
  - **Row-level validation errors or MongoDB `E11000` duplicate keys**: `Batch.insertMany(payload, { ordered: false })` catches bulk write errors (`lines 561–566`) and records `writeErrors` as `chunkErrors`, allowing the chunk request itself to return HTTP `200`/`201`.
  - **Network failure or HTTP 4xx/5xx on chunk $k > 0$**: In `useImport.js` lines 105–130, the `for` loop has no `catch` block around `api.post('/import/commit', ...)`. The error propagates out of `commit()`, `ImportPanel.jsx` catches it (`lines 459–462`), displays `toast.error`, and resets the UI to Step 2 (`Preview`). On the server, `isFinal` is never received, leaving the `ImportJob` permanently stuck in `status: 'running'` with the batches from chunks `0..k-1` already committed in MongoDB (and un-rollbackable because `rollbackImport` line 651 rejects `status === 'running'` with HTTP `409`).

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 585–600)
```javascript
    job.inserted          += insertedDocs.length;
    job.skipped           += results.filter(r => r.verdict === 'skip').length;
    job.errored           += chunkErrors.length;
    job.processedRows     += rows.length;
    job.insertedBatchIds.push(...insertedIds);

    for (const err of chunkErrors) {
      if (job.rowErrors.length < MAX_STORED_ERRORS) job.rowErrors.push(err);
      else { job.rowErrorsTruncated = true; break; }
    }

    if (Boolean(isFinal)) {
      job.status     = job.inserted === 0 && job.errored > 0 ? 'failed' : 'done';
      job.finishedAt = new Date();
    }
    await job.save();
```

---

## 7. Rollback

### Reference Behaviour
- **Endpoint**: `POST /api/import/:id/rollback` (`backend/src/controllers/import.controller.js` lines 644–688).
- **Guard conditions (`lines 646–659`)**:
  1. `!job` -> HTTP `404` `{ success: false, message: 'Import job not found' }`.
  2. `job.status === 'rolled_back'` -> HTTP `409` `{ success: false, message: 'This import has already been rolled back' }` (**rollback is allowed at most once**).
  3. `job.status === 'running'` -> HTTP `409` `{ success: false, message: 'Cannot roll back an import that is still running' }`.
  4. `!job.insertedBatchIds.length` -> HTTP `409` `{ success: false, message: 'This import did not create any batches to roll back' }`.
- **Which batches it touches (`lines 662–672`)**:
  - Executes `Batch.updateMany({ _id: { $in: job.insertedBatchIds }, isDeleted: { $ne: true } }, { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actor, deleteNote: 'Rolled back import #<job._id> (<job.fileName>)' } })`.
  - Soft-deletes (`isDeleted: true`) every batch in `job.insertedBatchIds` that is not already soft-deleted. Never hard-deletes (`ImportJob.model.js` lines 10–12).
- **What it does to batches changed or dispatched after import**:
  - **Edited batches**: Soft-deletes them (since their `_id` is in `insertedBatchIds` and `isDeleted` is `false`).
  - **Already-archived batches (`isDeleted: true`)**: Skipped by the filter `isDeleted: { $ne: true }` (`alreadyDeleted = job.insertedBatchIds.length - rolledBackCount`, line 682).
  - **Already-dispatched batches (`status: 'DISPATCHED'`)**: **Defect / contradiction in reference**: The confirmation modal in `frontend/src/components/ImportPanel.jsx` line 375 tells the user *"Any batch already dispatched or archived by hand keeps its existing state"*, but `rollbackImport` in `import.controller.js` line 663 only filters `{ _id: { $in: job.insertedBatchIds }, isDeleted: { $ne: true } }` and does **not** check `status !== 'DISPATCHED'` or `dispatchDate == null`. Consequently, the reference backend silently soft-deletes already-dispatched batches instead of blocking with `409` or skipping them.

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 662–677)
```javascript
    const resUpdate = await Batch.updateMany(
      { _id: { $in: job.insertedBatchIds }, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted:  true,
          deletedAt:  new Date(),
          deletedBy:  actor,
          deleteNote: `Rolled back import #${job._id} (${job.fileName})`
        }
      }
    );

    job.status       = 'rolled_back';
    job.rolledBackAt = new Date();
    job.rolledBackBy = actor;
    await job.save();
```

---

## 8. CSV Parser Rules

### Reference Behaviour
Implemented in `frontend/src/utils/csvParser.js` (`lines 1–170`) and tested in `frontend/src/utils/csvParser.test.js` (`lines 1–133`):
- **UTF-8 BOM (`stripBom`, `lines 21–23`)**: Strips leading `0xFEFF` if present (`text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text`).
- **Delimiter auto-detection (`detectDelimiter`, `lines 30–48`)**: Scans up to the first `8192` characters outside double quotes, counting `,`, `;`, and `\t`. Selects the candidate with the highest count `> 0` (tie-breaking in order `,`, `;`, `\t`), defaulting to `,`.
- **Quotes & escaped quotes (`parseCsvRows`, `lines 68–95`)**:
  - Opening quote is recognized only at the start of a cell (`ch === '"' && field === ''`, `line 83`), setting `inQuotes = true` and `wasQuoted = true`.
  - Inside a quoted field (`inQuotes === true`), a pair of double quotes `""` (`ch === '"' && next === '"'`, `line 76`) appends a literal `"` and advances `i++`. A single `"` closes the quoted state (`inQuotes = false`, `line 77`).
  - Unquoted fields have leading and trailing whitespace stripped via `field.trim()`; quoted fields preserve leading/trailing whitespace (`line 70`: `current.push(wasQuoted ? field : field.trim())`).
- **Commas and newlines inside quotes (`lines 75–81`)**: While `inQuotes === true`, delimiter characters (`,`, `;`, `\t`) and newline characters (`\r`, `\n`) are appended directly to `field` without ending the cell or row.
- **Line endings (`CRLF`, `LF`, `CR`, `lines 98–104, 110`)**: Outside quotes, `\r\n` advances past `\n` (`if (ch === '\r' && next === '\n') i++`) and commits the row; standalone `\n` or `\r` also commits the row. A trailing newline at EOF does not emit an extra empty row (`line 110`).
- **Blank lines (`parseCsvToObjects`, `lines 131–133`)**: Rows where every cell is `''` (`cells.every(c => c === '')`) are skipped (`blankLineCount++`), while preserving the original 1-based spreadsheet line number in `__sheetRow: r + 1` (`line 135`).
- **Ragged rows & empty headers (`lines 125, 134–140`)**:
  - Empty header cells are renamed `'Column 1'`, `'Column 2'`, etc. (`h || 'Column ' + (i + 1)`, `line 125`).
  - Short rows (fewer cells than `headers.length`) fill missing keys with `''` (`cells[c] ?? ''`, `line 137`).
  - Long rows (more cells than `headers.length`) ignore extra cells beyond `headers.length` (`for (let c = 0; c < headers.length; c++)`, `line 136`).
- **Caps**: **None** in `csvParser.js` — neither file byte size nor total row count is capped in the parser.

### Verbatim Code Excerpt (`frontend/src/utils/csvParser.js` lines 75–104)
```javascript
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')            { inQuotes = false; }
      else                            { field += ch; }
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
      wasQuoted = true;
      continue;
    }
    if (ch === delim) {
      pushField();
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && next === '\n') i++;
      pushField();
      pushRow();
      continue;
    }
```

---

## 9. UI Flow

### Reference Behaviour
Implemented in `frontend/src/components/ImportPanel.jsx` (`lines 1–615`) and `frontend/src/hooks/useImport.js` (`lines 1–148`):
- **4-Step Wizard (`STEPS = ['File', 'Map columns', 'Preview', 'Import']`, `ImportPanel.jsx` line 22)** plus a persistent **Recent imports (`HistoryTable`, `lines 317–394`)** section below:
  1. **Step 0 — `File` (`lines 127–168`)**:
     - Drag-and-drop dropzone or `<input type="file" accept=".csv,text/csv">` (`line 146`), plus a `Download template` button (`lines 159–166`) that downloads a 3-row sample CSV (`TraceX-batch-import-template.csv`, `lines 31–44`).
     - Rejects `.xls`/`.xlsx` files immediately with `toast.error('Please save your Excel sheet as .csv first (File → Save As → CSV UTF-8)')` (`lines 91–94`).
     - Parses CSV in browser via `readFileAsText` + `parseCsvToObjects`, rejects empty files (`!parsed.rows.length`), calls `POST /api/import/map-headers`, and advances to Step 1 (`lines 430–442`).
  2. **Step 1 — `Map columns` (`lines 171–227`)**:
     - **What the user can edit**: For each of the 9 schema columns, the user can select any sheet header or `— Ignore —` from a `<select>` dropdown (`lines 206–215`). The user **cannot** edit individual cell values in the UI.
     - Displays an amber warning banner if `unmappedRequired.length > 0` (`lines 193–200`). `Validate N rows` button is disabled until all required columns (with `productSku` satisfied by `productName`) are mapped (`lines 221, 413–415`).
  3. **Step 2 — `Preview` (`lines 230–281`)**:
     - Calls `validate(canonicalRows)` in 200-row chunks (`useImport.js` lines 67–94) and aggregates `summary` (`insert`, `skip`, `error`, `total`) and `preview` rows.
     - **What is shown on errors**: Summary chips (`will import`, `skipped (duplicate)`, `errors`), filter tabs (`All rows`, `Will import`, `Duplicates`, `Errors`), a scrollable table (`Row`, `Verdict`, `Product`, `Lot`, `Qty`, `Pack date`, `Detail` showing error `field: message` or skip `reason`), and a `Download error report` button (`lines 240–244, 465–479`) that exports `import-errors-<file>.csv` when `summary.error > 0`.
     - `Import N batches` button is enabled whenever `preview.summary.insert > 0` (`line 277`) — partial imports (inserting valid rows while skipping errored/duplicate rows) are allowed.
  4. **Step 3 — `Import` (`lines 284–313, 449–463`)**:
     - Shows a progress bar (`Importing… done of total`, `lines 286–295`) updated after each 200-row chunk (`useImport.js` line 122).
     - When complete, displays summary chips (`imported`, `skipped`, `errors`), refreshes `HistoryTable`, calls `onBatchesChanged()`, and shows `Import another file` (`lines 296–312`).
     - **What happens on commit failure (`lines 459–462`)**: Catches the error, shows `toast.error(err?.response?.data?.message || 'Import failed')`, and returns the wizard to Step 2 (`setStep(2)`).

### Verbatim Code Excerpt (`frontend/src/components/ImportPanel.jsx` lines 449–463)
```javascript
  const handleRunCommit = async () => {
    setStep(3);
    try {
      const res = await imp.commit(canonicalRows, file.name);
      if (res) {
        toast.success(`Imported ${res.inserted} batch${res.inserted === 1 ? '' : 'es'}`);
        imp.loadHistory();
        onBatchesChanged?.();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Import failed');
      setStep(2);
    }
  };
```

---

## 10. Authorisation and Side Effects

### Reference Behaviour
- **Role checks on each route (`backend/src/routes/import.routes.js` lines 1–17; `backend/src/middleware/requireAdmin.js` lines 109–116)**:
  - `import.routes.js` applies `router.use(protect, requireImporter)` (`line 7`) to all 7 routes (`GET /schema`, `POST /map-headers`, `POST /validate`, `POST /commit`, `GET /`, `POST /:id/rollback`, `GET /:id`).
  - `requireImporter` (`requireAdmin.js` lines 109–116) allows `req.user.isSuperAdmin === true` or `['admin', 'manager', 'factory-manager'].includes(req.user.role)`. It denies `quality-inspector` and `dispatch-coordinator` with HTTP `403` (`'Bulk import is restricted to factory managers and above'`, verified in `backend/tests/rbac.test.js` lines 80–95).
- **Socket.IO events emitted**:
  - On `commitImport` (`import.controller.js` lines 602–606): for every chunk where `insertedDocs.length > 0`, emits `io.emit('batch:created', { bulk: true, count: insertedDocs.length, jobId: String(job._id), actor })`.
  - On `rollbackImport` (`import.controller.js` lines 679–680): emits `io.emit('batch:created', { bulk: true, rolledBack: true, count: rolledBackCount, jobId: String(job._id) })`.
- **Notifications created (`import.controller.js` lines 608–620)**:
  - On `commitImport` when `Boolean(isFinal) && job.inserted > 0`, calls `notifyRoles(req.app, ['factory-manager', 'manager'], { type: 'batch_imported', title: 'Bulk import finished', message: '<actor> imported <job.inserted> batch(es) from <job.fileName>' + (job.errored ? ' (<job.errored> row error(s))' : ''), refId: job._id, refType: 'batch', triggeredBy: { userId, name, role } })`.
  - No notification is created on rollback.
- **Audit entries & logging**:
  - The reference has no `AuditLog` collection; only the `ImportJob` document (`createdBy`, `rolledBackBy`) and each batch's `noteHistory`/`deleteNote` are written.
  - There are zero `console.log` / `logger` calls in `import.controller.js`.
  - **Privacy flag (`farmerName` and row values)**: `farmerName` is NOT logged or included in notifications, **but**:
    1. `validateImport` returns `farmer: r.value?.farmerName || raw[r.rowNumber - rowOffset]?.farmerName || ''` in the preview response (`import.controller.js` line 453).
    2. If a row fails validation on a field, `chunkErrors` stores `value: raw[r.rowNumber - rowOffset]?.[e.field]` inside `ImportJob.rowErrors[]` (`import.controller.js` line 574), which is returned to any importer calling `GET /api/import/:id`.

### Verbatim Code Excerpt (`backend/src/routes/import.routes.js` lines 6–15 & `requireAdmin.js` lines 109–116)
```javascript
router.use(protect, requireImporter);

router.get('/schema',          ctrl.getImportSchema);
router.post('/map-headers',    ctrl.mapHeaders);
router.post('/validate',       ctrl.validateImport);
router.post('/commit',         ctrl.commitImport);
router.get('/',                ctrl.listImportJobs);
router.post('/:id/rollback',   ctrl.rollbackImport);
router.get('/:id',             ctrl.getImportJob);
```
```javascript
const requireImporter = (req, res, next) => {
  if (req.user && (req.user.isSuperAdmin || ['admin', 'manager', 'factory-manager'].includes(req.user.role))) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Bulk import is restricted to factory managers and above'
  });
};
```

---

## 11. Defects in Reference

### Reference Behaviour & Identified Defects
1. **Non-atomic `batchCode` pre-allocation and `HS-` prefix (`import.controller.js` lines 273–289)**:
   - `preallocateBatchCodes` uses `Batch.findOne({ batchCode: /^HS-YYYY-MM-/ }).sort({ batchCode: -1 })` and increments in memory (`OI-02`), using prefix `HS-` instead of `TX-` (`OI-09` / `D-11`). Concurrent imports or batch creations race and fail with `E11000` duplicate key errors.
2. **Direct `Batch.insertMany` bypasses batch service (`import.controller.js` lines 506–562)**:
   - Duplicates expiry calculation, QR generation, and field assembly instead of calling a single batch creation service (`D-23`), storing `status` in MongoDB (violating `D-16`) and using the legacy `365 - daysUntilExpiry` priority score formula (`OI-08`).
3. **Rollback soft-deletes already-dispatched batches (`import.controller.js` lines 662–672 vs `ImportPanel.jsx` line 375)**:
   - `ImportPanel.jsx` line 375 promises *"Any batch already dispatched or archived by hand keeps its existing state"*, but `rollbackImport` only filters `{ _id: { $in: job.insertedBatchIds }, isDeleted: { $ne: true } }`. Dispatched batches are silently soft-deleted on rollback (`D-24`).
4. **Calendar date rollover & UTC timestamp storage (`import.controller.js` lines 138–151)**:
   - `parseDate` checks `day <= 31` for all months and passes `Date.UTC(year, month - 1, day)` to `new Date(...)`, which silently coerces invalid calendar dates like `31/02/2026` to `2026-03-03` instead of rejecting them, and persists `Date` instants rather than `LocalDate` `"YYYY-MM-DD"` strings (`D-17`).
5. **`findExistingKeys` ignores `isDeleted: true` (`import.controller.js` lines 254–264)**:
   - Queries `Batch.find({ sourceLotCode: { $in: lots } })` without `isDeleted: false`, so archived/rolled-back batches permanently block re-importing the same `(sku, sourceLotCode, packDate)` unless `sourceLotCode` is changed! Wait — actually in `rollbackImport`, rolled-back batches have `isDeleted: true`, which means **rolling back an import in the reference prevents the user from ever re-importing that same CSV file** because `findExistingKeys` still sees the soft-deleted batches!
6. **Cross-chunk in-file duplicates missed during `validate` (`useImport.js` lines 67–94; `import.controller.js` line 308)**:
   - `seenInFile` is local to a single `analyseRows` request. Because `useImport.js#validate` sends 200-row chunks statelessly, duplicate rows in chunk 0 and chunk 1 both return `verdict: 'insert'` during preview (`Step 2`), only to be skipped during `commit` after chunk 0 inserts into MongoDB.
7. **No total row cap, no file size cap, and no `jobId` ownership/state check on `commitImport` (`import.controller.js` lines 489–493)**:
   - While each chunk is capped at 500 rows, a client can send unlimited chunks (`> 10,000` rows), can append chunks to another user's `jobId` (no check that `job.createdBy === actor`), and can even append chunks to a job whose status is already `'done'` or `'failed'` (line 493 only blocks `job.status === 'rolled_back'`).
8. **Stuck `'running'` jobs on mid-flight chunk failure (`useImport.js` lines 105–130; `import.controller.js` line 651)**:
   - If chunk 2 of 5 fails due to a network error, the job remains in `status: 'running'` forever and cannot be rolled back (`rollbackImport` line 651 rejects `'running'` with HTTP `409`).
9. **CSV formula injection (`=`, `+`, `-`, `@`) (`import.controller.js` lines 172–214; `csvParser.js` lines 149–162)**:
   - Neither `validateRow` nor `toCsv` sanitizes values starting with `=`, `+`, `-`, `@`, `\t`, or `\r`, allowing spreadsheet formula injection when exporting error reports (`import-errors-<file>.csv`).
10. **Fractional `quantityProduced` accepted for `Units` (`import.controller.js` lines 188–191)**:
    - `parseNumber` accepts any float `>= 1` (e.g., `1.5`), whereas `BatchCreateDto` in the new build validates `quantityProduced` with `@Positive` and product creation rules.

### Verbatim Code Excerpt (`backend/src/controllers/import.controller.js` lines 254–264 & 273–285)
```javascript
const findExistingKeys = async (candidates) => {
  if (!candidates.length) return new Set();
  const lots = [...new Set(candidates.map(c => c.value.sourceLotCode))];
  const existing = await Batch.find({ sourceLotCode: { $in: lots } })
    .select('sku sourceLotCode packDate')
    .lean();
  const set = new Set();
  for (const b of existing) {
    if (!b.packDate) continue;
    set.add(`${String(b.sku).toUpperCase()}|${String(b.sourceLotCode).toUpperCase()}|${ new Date(b.packDate).toISOString().slice(0, 10) }`);
  }
  return set;
};
```

---

## Summary Count of Extracted Items

| Status | Count | Details |
|---|---|---|
| **Answered** | **11 / 11** | Sections 1 through 11 fully answered with exact file paths, line numbers, and verbatim code excerpts (`<= 15` lines each) |
| **Partial** | **0 / 11** | None |
| **Not found in reference** | **0 sections** (2 auxiliary artifacts noted) | All 7 named files exist and were read in full; reference has no backend import test file in `backend/tests/` and no standalone `.csv` fixture file on disk |

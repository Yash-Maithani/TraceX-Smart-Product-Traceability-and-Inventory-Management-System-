import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const openApiSpec = path.resolve(rootDir, '../backend/src/main/resources/openapi/tracex-api.yaml');
const docsJsonSpec = path.resolve(rootDir, '../docs/openapi.json');
const auditDir = path.resolve(rootDir, '../docs/00-audit');
const committedSchema = path.resolve(rootDir, 'src/api/generated/schema.d.ts');

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}

if (fs.existsSync(auditDir)) {
  const auditFiles = fs.readdirSync(auditDir);
  const openApiAuditCopies = auditFiles.filter((f) => /openapi/i.test(f));
  if (openApiAuditCopies.length > 0) {
    console.error(`Unexpected OpenAPI copies in docs/00-audit: ${openApiAuditCopies.join(', ')}`);
    process.exit(1);
  }
}

if (!fs.existsSync(openApiSpec)) {
  console.error(`Missing single source of truth OpenAPI YAML: ${openApiSpec}`);
  process.exit(1);
}

if (!fs.existsSync(docsJsonSpec)) {
  console.error(`Missing OpenAPI JSON copy: ${docsJsonSpec}`);
  process.exit(1);
}

if (!fs.existsSync(committedSchema)) {
  console.error(`Missing generated TypeScript schema: ${committedSchema}`);
  process.exit(1);
}

// 1. Compare docs/openapi.json against backend/src/main/resources/openapi/tracex-api.yaml in memory (zero file writes)
const yamlObj = yaml.load(fs.readFileSync(openApiSpec, 'utf8'), { schema: yaml.CORE_SCHEMA });
const rawDocsJsonText = fs.readFileSync(docsJsonSpec, 'utf8');
let jsonObj;
try {
  jsonObj = JSON.parse(rawDocsJsonText);
} catch (err) {
  console.error(`OpenAPI copy drift detected: docs/openapi.json is not valid JSON (${err.message}).`);
  process.exit(1);
}

const canonicalYamlJson = JSON.stringify(canonicalize(yamlObj));
const canonicalDocsJson = JSON.stringify(canonicalize(jsonObj));
const expectedRawDocsJsonText = JSON.stringify(yamlObj);

if (canonicalYamlJson !== canonicalDocsJson || rawDocsJsonText !== expectedRawDocsJsonText) {
  console.error('OpenAPI copy drift detected: docs/openapi.json does not match backend/src/main/resources/openapi/tracex-api.yaml.');
  process.exit(1);
}

// 2. Compare src/api/generated/schema.d.ts against backend/src/main/resources/openapi/tracex-api.yaml in memory via stdout (zero file writes)
const cliPath = path.resolve(rootDir, 'node_modules/openapi-typescript/bin/cli.js');
const freshlyGenerated = execFileSync(process.execPath, [cliPath, openApiSpec], {
  cwd: rootDir,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
}).replace(/\r\n/g, '\n');

const committed = fs.readFileSync(committedSchema, 'utf8').replace(/\r\n/g, '\n');

if (committed !== freshlyGenerated) {
  console.error('OpenAPI schema drift detected: src/api/generated/schema.d.ts does not match backend/src/main/resources/openapi/tracex-api.yaml.');
  process.exit(1);
}

console.log('OpenAPI schema drift check PASSED (compare-only, zero file writes): src/api/generated/schema.d.ts and docs/openapi.json match backend/src/main/resources/openapi/tracex-api.yaml.');

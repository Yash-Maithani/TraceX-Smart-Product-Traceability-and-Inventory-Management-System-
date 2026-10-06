import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const openApiYamlPath = path.resolve(rootDir, '../backend/src/main/resources/openapi/tracex-api.yaml');
const docsJsonPath = path.resolve(rootDir, '../docs/openapi.json');
const schemaDtsPath = path.resolve(rootDir, 'src/api/generated/schema.d.ts');
const cliPath = path.resolve(rootDir, 'node_modules/openapi-typescript/bin/cli.js');

if (!fs.existsSync(openApiYamlPath)) {
  console.error(`Single source of truth not found: ${openApiYamlPath}`);
  process.exit(1);
}

// 1. Generate docs/openapi.json from backend/src/main/resources/openapi/tracex-api.yaml
const yamlContent = fs.readFileSync(openApiYamlPath, 'utf8');
const parsedSpec = yaml.load(yamlContent, { schema: yaml.CORE_SCHEMA });
fs.mkdirSync(path.dirname(docsJsonPath), { recursive: true });
fs.writeFileSync(docsJsonPath, JSON.stringify(parsedSpec), 'utf8');

// 2. Generate frontend/src/api/generated/schema.d.ts from backend/src/main/resources/openapi/tracex-api.yaml
const generatedDts = execFileSync(process.execPath, [cliPath, openApiYamlPath], {
  cwd: rootDir,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
fs.mkdirSync(path.dirname(schemaDtsPath), { recursive: true });
fs.writeFileSync(schemaDtsPath, generatedDts, 'utf8');

console.log('Generated docs/openapi.json and frontend/src/api/generated/schema.d.ts from backend/src/main/resources/openapi/tracex-api.yaml.');

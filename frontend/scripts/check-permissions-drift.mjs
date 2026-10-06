import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPermissionsTypeScript } from './generate-permissions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const matrixPath = path.resolve(frontendRoot, '../docs/permission-matrix.csv');
const committedPath = path.resolve(frontendRoot, 'src/auth/permissions.generated.ts');

if (!fs.existsSync(matrixPath)) {
  console.error(`Missing docs/permission-matrix.csv: ${matrixPath}`);
  process.exit(1);
}

if (!fs.existsSync(committedPath)) {
  console.error(`Missing generated permissions file: ${committedPath}. Run 'npm run gen:permissions'.`);
  process.exit(1);
}

const csvContent = fs.readFileSync(matrixPath, 'utf8');
const expectedTs = buildPermissionsTypeScript(csvContent).replace(/\r\n/g, '\n');
const committedTs = fs.readFileSync(committedPath, 'utf8').replace(/\r\n/g, '\n');

if (committedTs !== expectedTs) {
  console.error(
    'Permissions drift detected: src/auth/permissions.generated.ts does not match docs/permission-matrix.csv. Run `npm run gen:permissions` to synchronize.'
  );
  process.exit(1);
}

console.log(
  'Permissions drift check PASSED (compare-only, zero file writes): src/auth/permissions.generated.ts matches docs/permission-matrix.csv.'
);

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const defaultManifestPath = path.resolve(frontendRoot, 'design-assets/backdrops.json');
const defaultRoutesTsPath = path.resolve(frontendRoot, 'src/routes/backdrops.ts');
const defaultOutputDir = path.resolve(frontendRoot, 'src/assets/backdrops');

export const REQUIRED_BACKDROP_KEYS = [
  'auth',
  'auth-recovery',
  'dashboard',
  'batches',
  'fefo',
  'inspections',
  'dispatch',
  'qr',
  'trace-public',
  'team',
  'import',
  'notifications',
  'settings',
  'default'
];

export function extractRouteKeysFromSource(routesTsContent) {
  const keysWithRoutes = new Set();
  const blockMatch = routesTsContent.match(/BACKDROP_KEY_ROUTES[^=]*=\s*\{([\s\S]*?)\};/);
  if (!blockMatch) return keysWithRoutes;
  const lineRegex = /['"]([a-z-]+)['"]\s*:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = lineRegex.exec(blockMatch[1])) !== null) {
    const key = m[1];
    const items = m[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) {
      keysWithRoutes.add(key);
    }
  }
  return keysWithRoutes;
}

export function validateBackdropManifest(manifest, routeMapKeys = null, checkGeneratedDir = null) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(manifest)) {
    errors.push('Manifest root must be a JSON array.');
    return { valid: false, errors, warnings };
  }

  const seenKeys = new Set();

  for (const entry of manifest) {
    if (!entry || typeof entry.key !== 'string' || !entry.key.trim()) {
      errors.push('Manifest entry is missing a valid string "key".');
      continue;
    }
    const key = entry.key.trim();
    if (seenKeys.has(key)) {
      errors.push(`Duplicate backdrop key '${key}' in manifest.`);
    }
    seenKeys.add(key);

    if (!Array.isArray(entry.routes) || entry.routes.length === 0) {
      errors.push(`Key '${key}' has no route mappings in manifest (routes must be a non-empty array).`);
    } else if (entry.routes.some((r) => typeof r !== 'string' || !r.trim())) {
      errors.push(`Key '${key}' contains an empty or non-string route mapping.`);
    }

    if (routeMapKeys && !routeMapKeys.has(key)) {
      errors.push(`Key '${key}' is missing a route mapping in src/routes/backdrops.ts.`);
    }

    if ( typeof entry.objectPosition !== 'string' || !entry.objectPosition.trim()) {
      errors.push(`Key '${key}' is missing a non-empty "objectPosition".`);
    }

    if (typeof entry.placeholder !== 'boolean') {
      errors.push(`Key '${key}' must specify boolean "placeholder" (true or false).`);
    } else if (entry.placeholder === true) {
      warnings.push(
        `[PLACEHOLDER WARNING] Key '${key}' (routes: ${(entry.routes || []).join(', ')}) uses a generated token placeholder (placeholder: true). Replace with an owner-approved licensed photo before launch (OI-11).`
      );
    } else {
      // Non-placeholder entry: must have source, author, licence, licenceUrl, and approvedByOwner === true
      const source = typeof entry.source === 'string' ? entry.source.trim() : '';
      const author = typeof entry.author === 'string' ? entry.author.trim() : '';
      const licence =
        typeof entry.licence === 'string'
          ? entry.licence.trim()
          : typeof entry.licenceName === 'string'
            ? entry.licenceName.trim()
            : '';
      const licenceUrl = typeof entry.licenceUrl === 'string' ? entry.licenceUrl.trim() : '';

      if (!source) {
        errors.push(`Non-placeholder key '${key}' is missing a non-empty "source".`);
      }
      if (!author) {
        errors.push(`Non-placeholder key '${key}' is missing a non-empty "author".`);
      }
      if (!licence) {
        errors.push(`Non-placeholder key '${key}' is missing a non-empty "licence".`);
      }
      if (!licenceUrl || !/^https?:\/\/\S+/i.test(licenceUrl)) {
        errors.push(`Non-placeholder key '${key}' is missing a valid "licenceUrl" (http/https URL required).`);
      }
      if (entry.approvedByOwner !== true) {
        errors.push(`Non-placeholder key '${key}' must have "approvedByOwner": true.`);
      }
    }

    if (checkGeneratedDir) {
      for (const width of [640, 1280, 1920]) {
        for (const ext of ['avif', 'webp', 'jpg']) {
          const expectedFile = path.join(checkGeneratedDir, `${key}-${width}.${ext}`);
          if (!fs.existsSync(expectedFile)) {
            errors.push(`Missing generated asset file: src/assets/backdrops/${key}-${width}.${ext}`);
          }
        }
      }
    }
  }

  for (const reqKey of REQUIRED_BACKDROP_KEYS) {
    if (!seenKeys.has(reqKey)) {
      errors.push(`Required backdrop key '${reqKey}' is missing from design-assets/backdrops.json.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const customManifestPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultManifestPath;
  if (!fs.existsSync(customManifestPath)) {
    console.error(`Backdrop manifest not found: ${customManifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(customManifestPath, 'utf8'));
  const routesContent = fs.existsSync(defaultRoutesTsPath)
    ? fs.readFileSync(defaultRoutesTsPath, 'utf8')
    : '';
  const routeMapKeys = extractRouteKeysFromSource(routesContent);

  const result = validateBackdropManifest(manifest, routeMapKeys, defaultOutputDir);

  console.log(`=== TraceX Backdrop Manifest Verification (${manifest.length} keys) ===`);
  if (result.warnings.length > 0) {
    console.log(`Placeholder warnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.warn(`  ${w}`);
    }
  }

  if (!result.valid) {
    console.error(`\nBackdrop check FAILED with ${result.errors.length} error(s):`);
    for (const err of result.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `\nBackdrop check PASSED: all ${manifest.length} keys have valid route mappings and metadata (${result.warnings.length} placeholder warning(s) recorded under OI-11).`
  );
}

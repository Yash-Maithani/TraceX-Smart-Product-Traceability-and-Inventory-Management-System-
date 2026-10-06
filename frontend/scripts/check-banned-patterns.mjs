import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function walkFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'generated'
      ) {
        continue;
      }
      walkFiles(full, fileList);
    } else if (! /\.(avif|webp|jpg|jpeg|png|gif|ico)$/i.test(entry.name)) {
      fileList.push(full);
    }
  }
  return fileList;
}

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;
const HOTLINK_IMAGE_URL_REGEX =
  /https?:\/\/(?:[^\s"'`)>]+\.(?:jpg|jpeg|png|webp|avif|gif|svg|bmp|ico)\b|(?:images\.unsplash\.com|plus\.unsplash\.com|unsplash\.com\/photos|picsum\.photos|placehold\.co|via\.placeholder\.com|placekitten\.com|loremflickr\.com)\b)/i;

export function scanDirectoryForBannedPatterns(baseDir = rootDir) {
  const srcDir = path.join(baseDir, 'src');
  const indexHtmlPath = path.join(baseDir, 'index.html');
  const manifestPath = path.join(baseDir, 'design-assets', 'backdrops.json');
  const files = walkFiles(srcDir);
  if (fs.existsSync(indexHtmlPath)) {
    files.push(indexHtmlPath);
  }
  if (fs.existsSync(manifestPath)) {
    files.push(manifestPath);
  }

  const violations = [];

  for (const filePath of files) {
    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    const isTestFile =
      relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx') || relPath.startsWith('src/test/');
    const isManifest = relPath === 'design-assets/backdrops.json';
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // 1. Check for banned "TODO" or "lorem ipsum" anywhere (including comments, except in test files)
      if (!isTestFile && /\bTODO\b/.test(line)) {
        violations.push(`${relPath}:${lineNum} - Banned 'TODO' marker found`);
      }
      if (!isTestFile && /lorem\s+ipsum/i.test(line)) {
        violations.push(`${relPath}:${lineNum} - Banned 'lorem ipsum' placeholder text found`);
      }

      // 2. Check for emoji characters
      if (!isTestFile && EMOJI_REGEX.test(line)) {
        violations.push(`${relPath}:${lineNum} - Banned emoji character found (use Lucide icons instead)`);
      }

      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      // 3. CSS gradients are banned (linear-gradient, radial-gradient, conic-gradient)
      if (/(linear|radial|conic)-gradient\s*\(/i.test(line) && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned CSS gradient usage`);
      }

      // 4. border-radius values above 6px (or > 0.375rem) are banned
      if (relPath.endsWith('.css')) {
        const pxMatch = line.match(/(?:border-radius|--radius-[a-z0-9-]+)\s*:\s*([0-9.]+)px/i);
        if (pxMatch && parseFloat(pxMatch[1]) > 6) {
          violations.push(
            `${relPath}:${lineNum} - Banned border-radius above 6px (${pxMatch[1]}px exceeds 6px max)`
          );
        }
        const remMatch = line.match(/(?:border-radius|--radius-[a-z0-9-]+)\s*:\s*([0-9.]+)rem/i);
        if (remMatch && parseFloat(remMatch[1]) * 16 > 6) {
          violations.push(
            `${relPath}:${lineNum} - Banned border-radius above 6px (${remMatch[1]}rem exceeds 6px max)`
          );
        }
      }

      // 5. localStorage is banned everywhere except src/lib/prefs.ts
      if (/\blocalStorage\b/.test(line) && relPath !== 'src/lib/prefs.ts' && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned 'localStorage' usage outside src/lib/prefs.ts`);
      }

      // 6. sessionStorage is banned everywhere except src/auth/tokenStore.ts
      if (/\bsessionStorage\b/.test(line) && relPath !== 'src/auth/tokenStore.ts' && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned 'sessionStorage' usage outside src/auth/tokenStore.ts`);
      }

      // 7. dangerouslySetInnerHTML is banned
      if (/\bdangerouslySetInnerHTML\b/.test(line) && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned 'dangerouslySetInnerHTML' usage`);
      }

      // 8. eval() and new Function() are banned
      if ((/\beval\s*\(/.test(line) || /\bnew\s+Function\s*\(/.test(line)) && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned 'eval' or 'new Function' usage`);
      }

      // 9. console.log and console.debug are banned outside src/lib/logger.ts
      if (/\bconsole\.(log|debug|info|warn|error)\s*\(/.test(line) && relPath !== 'src/lib/logger.ts' && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned 'console.*' usage outside src/lib/logger.ts`);
      }

      // 10. Hardcoded http://localhost is banned in src/
      if (/http:\/\/localhost\b/i.test(line) && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned hardcoded 'http://localhost' in source code`);
      }

      // 11. Inline style={{ ... }} is banned except for CSS custom properties
      if (/\bstyle=\{\{/.test(line) && !isTestFile) {
        const innerMatch = line.match(/style=\{\{([^}]+)\}\}/);
        const isOnlyCustomProps =
          innerMatch &&
          innerMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .every((pair) => /^['"]?--[a-zA-Z0-9-]+['"]?\s*:/.test(pair));
        if (!isOnlyCustomProps) {
          violations.push(
            `${relPath}:${lineNum} - Banned inline 'style={{...}}' usage (only CSS custom properties allowed)`
          );
        }
      }

      // 12. External font CDNs are banned per D-21
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(line) && !isTestFile) {
        violations.push(`${relPath}:${lineNum} - Banned external font CDN reference (D-21 system font stack only)`);
      }

      // 13. Raw hex colors in .module.css files (must use tokens from tokens.css)
      if (relPath.endsWith('.module.css') && /#[0-9a-fA-F]{3,8}\b/.test(line)) {
        violations.push(
          `${relPath}:${lineNum} - Banned raw hex color in CSS Module (must use var(--...) token from tokens.css)`
        );
      }

      // 14. Hotlinked http/https image URLs in src/ or design-assets/backdrops.json (Phase 5.1 Part D)
      if (!isTestFile) {
        if (
          HOTLINK_IMAGE_URL_REGEX.test(line) ||
          /\b(?:src|srcSet)\s*=\s*["']https?:\/\//i.test(line) ||
          /url\(\s*["']?https?:\/\//i.test(line) ||
          (isManifest && /"(?:url|imageUrl|src)"\s*:\s*"https?:\/\//i.test(line))
        ) {
          violations.push(
            `${relPath}:${lineNum} - Banned hotlinked http/https image URL in source or manifest`
          );
        }
      }

      // 15. Glass/blur panels (backdrop-filter, filter: blur) and parallax/scroll-linked animations (Phase 5.1 Part A & Check 10)
      if (!isTestFile && (relPath.endsWith('.css') || relPath.endsWith('.tsx') || relPath.endsWith('.ts'))) {
        if (/backdrop-filter\s*:/i.test(line) || /filter\s*:\s*blur\s*\(/i.test(line)) {
          violations.push(`${relPath}:${lineNum} - Banned glass/blur effect (backdrop-filter or filter: blur)`);
        }
        if (/background-attachment\s*:\s*fixed/i.test(line) || /animation-timeline\s*:\s*(?:scroll|view)/i.test(line)) {
          violations.push(`${relPath}:${lineNum} - Banned parallax or scroll-linked animation`);
        }
      }

      // 16. Client-side freshness or FEFO threshold comparisons (Phase 6 Part E & Check 6)
      if (!isTestFile && (relPath.endsWith('.tsx') || relPath.endsWith('.ts'))) {
        if (
          /\bdaysUntilExpiry\b\s*(?:<=|>=|<|>|===|!==|==|!=)/.test(line) ||
          /(?:<=|>=|===|!==|==|!=)\s*\bdaysUntilExpiry\b/.test(line) ||
          /\b(?:[0-9]+|[a-zA-Z_$][\w$]*)\s*(?:<|>)\s*[\w$.]*\bdaysUntilExpiry\b/.test(line)
        ) {
          violations.push(
            `${relPath}:${lineNum} - Banned client-side comparison on 'daysUntilExpiry' (freshness and FEFO logic must come from the server)`
          );
        }
        if (/(?:<=|>=|<|>)\s*(?:7|30)\b|\b(?:7|30)\s*(?:<=|>=|<|>)/.test(line)) {
          violations.push(
            `${relPath}:${lineNum} - Banned hardcoded 7 or 30 day freshness threshold comparison`
          );
        }
      }
    });
  }

  return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : rootDir;
  const violations = scanDirectoryForBannedPatterns(targetDir);
  if (violations.length > 0) {
    console.error(`Banned pattern check FAILED with ${violations.length} violation(s):`);
    for (const v of violations) {
      console.error(`  [VIOLATION] ${v}`);
    }
    process.exit(1);
  }
  console.log('Banned pattern check PASSED: 0 violations found across src/, index.html, and design-assets/backdrops.json.');
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultTokensPath = path.resolve(__dirname, '../src/styles/tokens.css');

export function parseHex(hex) {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex([r, g, b]) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Parses either a hex string (#rrggbb) or an rgba(r, g, b, a) / rgb(r, g, b) token string
 * and composites it over a solid background RGB pixel (default pure white [255, 255, 255]).
 */
export function compositeScrimOverPixel(scrimValue, underPixelRgb = [255, 255, 255]) {
  if (!scrimValue) {
    throw new Error('Missing --backdrop-scrim token value');
  }
  const trimmed = scrimValue.trim();
  if (trimmed.startsWith('#')) {
    return rgbToHex(parseHex(trimmed));
  }
  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i
  );
  if (!rgbaMatch) {
    throw new Error(`Unsupported scrim color format: ${scrimValue}`);
  }
  const sr = Number(rgbaMatch[1]);
  const sg = Number(rgbaMatch[2]);
  const sb = Number(rgbaMatch[3]);
  const alpha = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;

  const r = Math.round(alpha * sr + (1 - alpha) * underPixelRgb[0]);
  const g = Math.round(alpha * sg + (1 - alpha) * underPixelRgb[1]);
  const b = Math.round(alpha * sb + (1 - alpha) * underPixelRgb[2]);
  return rgbToHex([r, g, b]);
}

export function relativeLuminance([r, g, b]) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(parseHex(hex1));
  const l2 = relativeLuminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractBlockVars(css, selectorSubstring) {
  const escaped = selectorSubstring.replace(/[[\]"]/g, '\\$&');
  const regex = new RegExp(`${escaped}[^{]*\\{([^}]+)\\}`, 'm');
  const match = css.match(regex);
  if (!match) {
    throw new Error(`Could not find selector block matching: ${selectorSubstring}`);
  }
  const vars = {};
  const propRegex = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = propRegex.exec(match[1])) !== null) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

export function runContrastChecks(css) {
  const palettes = ['editorial', 'obsidian', 'emerald'];
  const modes = ['light', 'dark'];
  const accents = ['cobalt', 'emerald', 'amber', 'rose'];

  const results = [];
  let failures = 0;

  function checkPair(context, label, fg, bg, minRatio = 4.5) {
    const ratio = contrastRatio(fg, bg);
    const pass = ratio >= minRatio;
    if (!pass) failures++;
    results.push({
      context,
      label,
      fg,
      bg,
      ratio: ratio.toFixed(2),
      minRatio: minRatio.toFixed(1),
      status: pass ? 'PASS' : 'FAIL'
    });
  }

  for (const palette of palettes) {
    for (const mode of modes) {
      const pVars = extractBlockVars(css, `html[data-palette="${palette}"][data-theme="${mode}"]`);
      const ctx = `${palette} (${mode})`;
      // Normal text >= 4.5:1
      checkPair(ctx, 'text-primary on bg-canvas (text)', pVars['--text-primary'], pVars['--bg-canvas'], 4.5);
      checkPair(ctx, 'text-primary on bg-surface (text)', pVars['--text-primary'], pVars['--bg-surface'], 4.5);
      checkPair(ctx, 'text-primary on bg-elevated (text)', pVars['--text-primary'], pVars['--bg-elevated'], 4.5);
      checkPair(ctx, 'text-secondary on bg-canvas (text)', pVars['--text-secondary'], pVars['--bg-canvas'], 4.5);
      checkPair(ctx, 'text-secondary on bg-surface (text)', pVars['--text-secondary'], pVars['--bg-surface'], 4.5);
      checkPair(ctx, 'text-muted on bg-canvas (text)', pVars['--text-muted'], pVars['--bg-canvas'], 4.5);
      checkPair(ctx, 'text-muted on bg-surface (text)', pVars['--text-muted'], pVars['--bg-surface'], 4.5);
      // Large text, input borders, icons >= 3.0:1
      checkPair(ctx, 'text-secondary on bg-elevated (icons/large)', pVars['--text-secondary'], pVars['--bg-elevated'], 3.0);
      checkPair(ctx, 'border-strong on bg-surface (input border)', pVars['--border-strong'], pVars['--bg-surface'], 3.0);
      checkPair(ctx, 'border-strong on bg-canvas (input border)', pVars['--border-strong'], pVars['--bg-canvas'], 3.0);

      // Phase 5.1 Part D: Worst-case pure white image pixel (#ffffff) under --backdrop-scrim
      const worstCaseScrimHex = compositeScrimOverPixel(pVars['--backdrop-scrim'], [255, 255, 255]);
      const fallbackBgHex = pVars['--backdrop-fallback-bg'];
      checkPair(
        `${ctx} [scrim/white]`,
        'banner-title on scrim over #ffffff (>=4.5:1)',
        pVars['--banner-title'],
        worstCaseScrimHex,
        4.5
      );
      checkPair(
        `${ctx} [scrim/white]`,
        'banner-subtitle on scrim over #ffffff (>=4.5:1)',
        pVars['--banner-subtitle'],
        worstCaseScrimHex,
        4.5
      );
      checkPair(
        `${ctx} [scrim/white]`,
        'banner-control-border on scrim over #ffffff (>=3:1)',
        pVars['--banner-control-border'],
        worstCaseScrimHex,
        3.0
      );
      checkPair(
        `${ctx} [scrim/white]`,
        'banner-control-text on banner-control-bg (>=4.5:1)',
        pVars['--banner-control-text'],
        pVars['--banner-control-bg'],
        4.5
      );
      checkPair(
        `${ctx} [fallback]`,
        'banner-title on backdrop-fallback-bg (>=4.5:1)',
        pVars['--banner-title'],
        fallbackBgHex,
        4.5
      );
      checkPair(
        `${ctx} [fallback]`,
        'banner-subtitle on backdrop-fallback-bg (>=4.5:1)',
        pVars['--banner-subtitle'],
        fallbackBgHex,
        4.5
      );

      // Every palette + mode + accent combination for focus-ring >= 3.0:1 (surface, canvas, and banner scrim over white)
      for (const accent of accents) {
        const aVars = extractBlockVars(css, `html[data-accent="${accent}"][data-theme="${mode}"]`);
        const comboCtx = `${palette}+${accent} (${mode})`;
        checkPair(comboCtx, 'focus-ring on bg-surface (focus >= 3:1)', aVars['--focus-ring'], pVars['--bg-surface'], 3.0);
        checkPair(comboCtx, 'focus-ring on bg-canvas (focus >= 3:1)', aVars['--focus-ring'], pVars['--bg-canvas'], 3.0);
        checkPair(
          `${comboCtx} [scrim/white]`,
          'banner-focus-ring on scrim over #ffffff (>=3:1)',
          aVars['--banner-focus-ring'],
          worstCaseScrimHex,
          3.0
        );
      }
    }
  }

  for (const accent of accents) {
    for (const mode of modes) {
      const aVars = extractBlockVars(css, `html[data-accent="${accent}"][data-theme="${mode}"]`);
      const ctx = `accent:${accent} (${mode})`;
      checkPair(ctx, 'accent-on-primary on accent-primary', aVars['--accent-on-primary'], aVars['--accent-primary'], 4.5);
      checkPair(ctx, 'accent-subtle-text on accent-subtle-bg', aVars['--accent-subtle-text'], aVars['--accent-subtle-bg'], 4.5);
    }
  }

  for (const mode of modes) {
    const sVars = extractBlockVars(css, `html[data-theme="${mode}"]`);
    const ctx = `status (${mode})`;
    checkPair(ctx, 'danger-text on danger-bg', sVars['--status-danger-text'], sVars['--status-danger-bg'], 4.5);
    checkPair(ctx, 'btn-danger-text on btn-danger-bg', sVars['--btn-danger-text'], sVars['--btn-danger-bg'], 4.5);
    checkPair(ctx, 'urgent-text on urgent-bg', sVars['--status-urgent-text'], sVars['--status-urgent-bg'], 4.5);
    checkPair(ctx, 'warning-text on warning-bg', sVars['--status-warning-text'], sVars['--status-warning-bg'], 4.5);
    checkPair(ctx, 'success-text on success-bg', sVars['--status-success-text'], sVars['--status-success-bg'], 4.5);
    checkPair(ctx, 'info-text on info-bg', sVars['--status-info-text'], sVars['--status-info-bg'], 4.5);
    checkPair(ctx, 'neutral-text on neutral-bg', sVars['--status-neutral-text'], sVars['--status-neutral-bg'], 4.5);
  }

  return { results, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const customTokensPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultTokensPath;
  const css = fs.readFileSync(customTokensPath, 'utf8');
  const { results, failures } = runContrastChecks(css);

  console.log(`WCAG Contrast Verification across ${results.length} token pairs (including worst-case pure white #ffffff under --backdrop-scrim):`);
  for (const r of results) {
    console.log(
      `[${r.status}] ${r.context.padEnd(36)} | ${r.label.padEnd(48)} | ${r.fg} on ${r.bg} => ${r.ratio}:1 (min ${r.minRatio}:1)`
    );
  }

  if (failures > 0) {
    console.error(`Contrast check FAILED: ${failures} pair(s) below WCAG threshold.`);
    process.exit(1);
  }
  console.log(`Contrast check PASSED: all ${results.length} pairs meet or exceed WCAG AA thresholds.`);
}

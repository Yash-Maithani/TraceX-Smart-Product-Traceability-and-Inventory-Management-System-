import { spawn, execSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '../../backend');
const HEALTH_URL = 'http://localhost:8083/actuator/health';

let backendProc: ChildProcess | null = null;

async function isBackendUp(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL);
    return res.ok;
  } catch {
    return false;
  }
}

export async function stopE2eBackend(): Promise<void> {
  if (backendProc && backendProc.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${backendProc.pid} /T /F`, { stdio: 'ignore' });
      } else {
        backendProc.kill('SIGTERM');
      }
    } catch {
      // Ignore if process already exited
    }
    backendProc = null;
  }

  // Also ensure nothing else is listening on port 8083
  if (process.platform === 'win32') {
    try {
      execSync(
        'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8083 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"',
        { stdio: 'ignore' }
      );
    } catch {
      // Ignore
    }
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!(await isBackendUp())) {
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function startE2eBackend(): Promise<void> {
  if (await isBackendUp()) {
    return;
  }

  backendProc = spawn(
    'java',
    [
      '-jar',
      'target/tracex-backend-1.0.0-SNAPSHOT.jar',
      '--spring.profiles.active=e2e',
      '--management.health.mail.enabled=false'
    ],
    {
      cwd: BACKEND_DIR,
      stdio: 'ignore',
      env: {
        ...process.env,
        SPRING_PROFILES_ACTIVE: 'e2e'
      }
    }
  );

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isBackendUp()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error('Timed out waiting for E2E backend on http://localhost:8083/actuator/health');
}

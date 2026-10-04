// Secure local setup for OPENROUTER_API_KEY. Run with: npm run setup:openrouter
//
// Never pastes, logs, or echoes the key — this script never prints any
// portion of it, even on error. Stores it only in the project's root .env
// (the same file ANTHROPIC_API_KEY already lives in, per .env.example),
// confirms .env is .gitignore-excluded before writing, sets restrictive
// file permissions where supported, and never overwrites an existing key
// without asking first. See docs/ai-orchestrator-setup.md.
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const GITIGNORE_PATH = path.join(ROOT, '.gitignore');
const KEYS_URL = 'https://openrouter.ai/keys';
// Confirmed via OpenRouter's own privacy docs as the dashboard page for the
// "deny data collection for training" / Zero Data Retention toggle.
const PRIVACY_URL = 'https://openrouter.ai/workspaces/default/settings';
// Smallest documented request that validates a key: GET /api/v1/key.
const VALIDATE_URL = 'https://openrouter.ai/api/v1/key';

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askMaskedSecret(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Non-interactive stdin (e.g. piped input) — readline without masking
      // is the best available fallback; still never echoed by this script.
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }
    process.stdout.write(prompt);
    let value = '';
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (char) => {
      const c = char.toString();
      if (c === '\n' || c === '\r' || c === '') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value.trim());
        return;
      }
      if (c === '') {
        process.stdout.write('\n');
        process.exit(1);
      }
      if (c === '' || c === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += c;
    };
    stdin.on('data', onData);
  });
}

function openBrowser(url) {
  return new Promise((resolve) => {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    try {
      const child = spawn(cmd, [url], {
        shell: platform === 'win32',
        stdio: 'ignore',
        detached: true,
      });
      child.on('error', () => resolve(false));
      child.unref();
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

async function confirmGitignoreCoversEnv() {
  if (!existsSync(GITIGNORE_PATH)) {
    console.error('No .gitignore found at the project root — aborting for safety.');
    process.exit(1);
  }
  const gitignore = readFileSync(GITIGNORE_PATH, 'utf8');
  const coversEnv = gitignore
    .split('\n')
    .map((l) => l.trim())
    .some((l) => l === '.env' || l === '.env.*' || l === '.env*');
  if (!coversEnv) {
    console.error('.gitignore does not appear to exclude .env — aborting for safety.');
    console.error('Add ".env" to .gitignore, then run this script again.');
    process.exit(1);
  }
  console.log('Confirmed: .env is excluded by .gitignore.\n');
}

async function main() {
  console.log('OpenRouter API key setup for Own My Budget\n');
  console.log(
    'This stores OPENROUTER_API_KEY in your local .env file only (server-side secret —\n' +
      'never shipped to the browser or mobile app bundle). Two rules, always:\n' +
      '  1. Never paste this key into a chat with Claude or any AI assistant.\n' +
      '  2. Never commit it to GitHub.\n' +
      'This script never displays, logs, or echoes the key, at any step.\n'
  );

  await confirmGitignoreCoversEnv();

  let existingEnv = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const hasExistingKey = /^OPENROUTER_API_KEY=.+$/m.test(existingEnv);
  if (hasExistingKey) {
    const answer = await ask('An OPENROUTER_API_KEY already exists in .env. Overwrite it? [y/N] ');
    if (answer.toLowerCase() !== 'y') {
      console.log('Keeping the existing key. No changes made.');
      return;
    }
  }

  const openKeysAnswer = await ask(`Open ${KEYS_URL} in your browser to create/copy a key? [y/N] `);
  if (openKeysAnswer.toLowerCase() === 'y') {
    const opened = await openBrowser(KEYS_URL);
    if (!opened) {
      console.log(`Could not open a browser automatically. Open this link manually:\n  ${KEYS_URL}`);
    }
  } else {
    console.log(`Open this link whenever you're ready:\n  ${KEYS_URL}`);
  }

  const openPrivacyAnswer = await ask(
    `\nOpen OpenRouter's privacy settings (to enable Zero Data Retention / deny data\ncollection for training) at ${PRIVACY_URL}? [y/N] `
  );
  if (openPrivacyAnswer.toLowerCase() === 'y') {
    const opened = await openBrowser(PRIVACY_URL);
    if (!opened) {
      console.log(
        `Could not open a browser automatically. Open this link manually:\n  ${PRIVACY_URL}`
      );
    }
  } else {
    console.log(`You can review privacy settings later at:\n  ${PRIVACY_URL}`);
  }

  console.log('\nPaste your OpenRouter API key below. It will not be displayed or logged.');
  let key = await askMaskedSecret('API key: ');

  if (!key) {
    console.log('No key entered. No changes made.');
    return;
  }

  console.log('\nValidating the key with a minimal request to OpenRouter...');
  let validated = false;
  try {
    const res = await fetch(VALIDATE_URL, { headers: { Authorization: `Bearer ${key}` } });
    validated = res.ok;
    if (!validated) {
      console.error(`Validation failed: OpenRouter rejected the key (HTTP ${res.status}).`);
    }
  } catch {
    console.error('Validation failed: could not reach OpenRouter. Check your network and try again.');
  }
  if (!validated) {
    key = undefined;
    process.exitCode = 1;
    return;
  }
  console.log('Key validated successfully.');

  const lines = existingEnv.length > 0 ? existingEnv.split('\n') : [];
  const withoutOldKey = lines.filter((line) => !/^OPENROUTER_API_KEY=/.test(line));
  if (withoutOldKey.length > 0 && withoutOldKey[withoutOldKey.length - 1] === '') {
    withoutOldKey.pop();
  }
  withoutOldKey.push(`OPENROUTER_API_KEY=${key}`);
  writeFileSync(ENV_PATH, withoutOldKey.join('\n') + '\n', { encoding: 'utf8' });
  key = undefined; // best-effort clear of the in-memory value now that it's written

  try {
    chmodSync(ENV_PATH, 0o600);
    console.log('Set .env permissions to 600 (owner read/write only).');
  } catch {
    console.log('Could not set restrictive file permissions on this platform — continuing.');
  }

  console.log('\nDone. OPENROUTER_API_KEY is saved to .env (gitignored — never committed).');
  console.log(
    'Every orchestration feature flag still defaults to OFF: JEV_ORCHESTRATOR_ENABLED,\n' +
      'JEV_VOICE_ROUTING_ENABLED, JEV_ONBOARDING_ENABLED. See docs/ai-orchestrator-setup.md\n' +
      'for how to turn one on locally and what each one does.'
  );
}

main().catch((error) => {
  console.error('Setup failed:', error instanceof Error ? error.message : 'an unknown error occurred');
  process.exitCode = 1;
});

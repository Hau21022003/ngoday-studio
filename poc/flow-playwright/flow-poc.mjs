import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir, readFile, stat, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import {
  DOWNLOAD_DIR,
  EVENTS_PATH,
  FLOW_URL,
  PROFILE_DIR,
  RUNTIME_DIR,
  STATE_PATH,
  browserChannel,
} from './poc-config.mjs';

await Promise.all([
  mkdir(RUNTIME_DIR, { recursive: true }),
  mkdir(DOWNLOAD_DIR, { recursive: true }),
  mkdir(PROFILE_DIR, { recursive: true }),
]);

function redact(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function safeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}${url.hash}`;
  } catch {
    return redact(rawUrl);
  }
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

async function updateState(patch) {
  const next = { ...(await readState()), ...patch, updatedAt: new Date().toISOString() };
  await writeFile(STATE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

async function record(event, outcome, details = {}) {
  const cleanDetails = Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === 'boolean' || typeof value === 'number' || value == null
        ? value
        : key.toLowerCase().includes('url')
          ? safeUrl(value)
          : redact(value),
    ]),
  );
  await appendFile(
    EVENTS_PATH,
    `${JSON.stringify({ at: new Date().toISOString(), event, outcome, ...cleanDetails })}\n`,
    'utf8',
  );
}

async function currentPage(context) {
  const pages = context.pages().filter((candidate) => !candidate.isClosed());
  if (pages.length === 0) return context.newPage();
  return pages.at(-1);
}

async function pageSummary(page) {
  const url = safeUrl(page.url());
  const title = redact(await page.title().catch(() => ''));
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
  const signInControls = await visibleCount([
    page.getByRole('button', { name: /^\s*(sign in|đăng nhập)\s*$/i }),
    page.getByRole('link', { name: /^\s*(sign in|đăng nhập)\s*$/i }),
  ]);
  const signedOut = new URL(page.url()).hostname === 'accounts.google.com' || signInControls > 0;
  const securityChallenge = /captcha|verify it'?s you|xác minh danh tính|2-step verification|unusual activity/i.test(
    bodyText,
  );
  const likelyProject = /\/project\/[^/]+/i.test(url) || /\/tools\/flow\//i.test(url) || /project/i.test(title);
  return { url, title, signedOut, securityChallenge, likelyProject };
}

async function visibleCount(locators) {
  let total = 0;
  for (const locator of locators) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) total += 1;
    }
  }
  return total;
}

async function flowAppMarkerCount(page) {
  return visibleCount([
    page.getByRole('button', { name: /new project|dự án mới/i }),
    page.getByText(/^\s*\+?\s*(new project|dự án mới)\s*$/i),
    page.getByText(/^\s*(your projects|all projects|dự án của bạn|tất cả dự án)\s*$/i),
  ]);
}

async function clickFlowEntryIfPresent(page) {
  const candidates = [
    page.getByRole('link', {
      name: /create with google flow|try google flow|try flow|open flow|bắt đầu|tạo bằng google flow/i,
    }),
    page.getByRole('button', {
      name: /create with google flow|try google flow|try flow|open flow|bắt đầu|tạo bằng google flow/i,
    }),
  ];

  for (const locator of candidates) {
    const visible = [];
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) visible.push(item);
    }
    if (visible.length === 1) {
      await visible[0].click();
      await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(1_500);
      return true;
    }
    if (visible.length > 1) {
      throw new Error('Multiple Flow entry controls found; refusing to guess');
    }
  }
  return false;
}

async function verifyReusedFlowSession(page) {
  await page.goto(FLOW_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2_000);

  let summary = await pageSummary(page);
  if (summary.signedOut || summary.securityChallenge) {
    return { ok: false, reason: 'AUTH_REQUIRED', summary };
  }

  if (/\/about(?:$|[?#])/i.test(page.url())) {
    await clickFlowEntryIfPresent(page);
    summary = await pageSummary(page);
    if (summary.signedOut || summary.securityChallenge) {
      return { ok: false, reason: 'AUTH_REQUIRED', summary };
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await flowAppMarkerCount(page)) > 0) {
      return { ok: true, reason: 'FLOW_APP_VERIFIED', summary: await pageSummary(page) };
    }
    summary = await pageSummary(page);
    if (summary.signedOut || summary.securityChallenge) {
      return { ok: false, reason: 'AUTH_REQUIRED', summary };
    }
    await page.waitForTimeout(1_000);
  }

  return { ok: false, reason: 'FLOW_APP_UNVERIFIED', summary: await pageSummary(page) };
}

async function inspectControls(page) {
  const controls = await page
    .locator(
      'button, a, input, textarea, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="textbox"]',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        })
        .slice(0, 120)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || '',
          role: element.getAttribute('role') || '',
          contenteditable: element.getAttribute('contenteditable') || '',
          href: element instanceof HTMLAnchorElement ? element.href : '',
          ariaLabel: element.getAttribute('aria-label') || '',
          titleAttr: element.getAttribute('title') || '',
          placeholder: element.getAttribute('placeholder') || '',
          value: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : '',
          name:
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.getAttribute('placeholder') ||
            element.innerText ||
            '',
        })),
    );

  return controls.map((control) => ({
    ...control,
    href: control.href ? safeUrl(control.href) : '',
    ariaLabel: redact(control.ariaLabel),
    titleAttr: redact(control.titleAttr),
    placeholder: redact(control.placeholder),
    value: redact(control.value),
    name: redact(control.name),
  }));
}

async function uniqueVisibleLocator(candidates) {
  for (const { label, locator } of candidates) {
    await locator.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    const matches = [];
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) matches.push({ label, locator: item });
    }
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(`Expected one visible ${label} control; found ${matches.length}`);
    }
  }
  throw new Error('No supported visible control found');
}

async function createProject(page, expectedName) {
  const beforeUrl = page.url();
  const match = await uniqueVisibleLocator([
    { label: 'role button / new project', locator: page.getByRole('button', { name: /new project|dự án mới/i }) },
    { label: 'text / new project', locator: page.getByText(/^\s*\+?\s*(new project|dự án mới)\s*$/i) },
  ]);

  await Promise.all([
    page.waitForURL(
      (url) => url.href !== beforeUrl && /\/project\/[^/]+/i.test(url.pathname),
      { waitUntil: 'domcontentloaded', timeout: 30_000 },
    ),
    match.locator.click(),
  ]);
  const after = await pageSummary(page);
  if (page.url() === beforeUrl && !after.likelyProject) {
    throw new Error('New project click had no verifiable navigation or project state');
  }

  await updateState({
    projectUrl: safeUrl(page.url()),
    requestedProjectName: expectedName || null,
    expectedProjectName: null,
    observedProjectName: null,
    projectCreatedAt: new Date().toISOString(),
  });
  await record('project.create', 'observed', {
    locator: match.label,
    beforeUrl,
    afterUrl: page.url(),
    expectedName: expectedName || '',
  });
  return after;
}

async function saveCurrentProject(page, expectedName) {
  const summary = await pageSummary(page);
  if (!summary.likelyProject) {
    throw new Error('Current page does not look like a Flow project; state was not saved');
  }
  return updateState({
    projectUrl: summary.url,
    expectedProjectName: expectedName || (await readState()).expectedProjectName || null,
    projectSavedAt: new Date().toISOString(),
  });
}

function isSameSafeUrl(left, right) {
  return safeUrl(left).replace(/\/$/, '') === safeUrl(right).replace(/\/$/, '');
}

async function assertManagedTestProject(page) {
  const state = await readState();
  if (!state.projectUrl || !state.projectCreatedAt) {
    throw new Error('No PoC-created project is recorded in state');
  }
  if (!isSameSafeUrl(page.url(), state.projectUrl)) {
    throw new Error('Current page is not the recorded PoC-created project; refusing to edit');
  }
  return state;
}

async function projectTitleLocator(page) {
  const inputs = page.locator('input[type="text"][aria-label]');
  await inputs.filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 20_000 });
  const matches = [];
  const observed = [];

  for (let index = 0; index < (await inputs.count()); index += 1) {
    const input = inputs.nth(index);
    const ariaLabel = ((await input.getAttribute('aria-label')) || '').normalize('NFC').trim();
    const visible = await input.isVisible().catch(() => false);
    observed.push({ ariaLabel: redact(ariaLabel), visible });

    if (visible && !/^(search|tìm kiếm)$/iu.test(ariaLabel)) {
      matches.push(input);
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one visible non-search title input; found ${matches.length}; observed: ${JSON.stringify(observed)}`,
    );
  }

  return {
    label: 'unique visible non-search text input identified by aria-label',
    locator: matches[0],
  };
}

async function promptEditorLocator(page) {
  return uniqueVisibleLocator([
    {
      label: 'prompt editor textbox',
      locator: page.getByRole('textbox', {
        name: /what do you want to create|bạn muốn tạo những gì/i,
      }),
    },
  ]);
}

async function readProjectTitle(page) {
  await assertManagedTestProject(page);
  const match = await projectTitleLocator(page);
  return redact(await match.locator.inputValue());
}

async function setCurrentProjectTitle(page, expectedName) {
  const state = await assertManagedTestProject(page);
  if (!expectedName || !/^ngoday-poc-ui-[a-z0-9-]+$/i.test(expectedName)) {
    throw new Error('Test project name must match ngoday-poc-ui-[a-z0-9-]+');
  }

  const match = await projectTitleLocator(page);
  const before = redact(await match.locator.inputValue());
  await match.locator.fill(expectedName);
  await match.locator.blur();

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  const reloaded = await projectTitleLocator(page);
  await reloaded.locator.waitFor({ state: 'visible', timeout: 20_000 });
  const afterReload = redact(await reloaded.locator.inputValue());
  if (afterReload !== expectedName) {
    await updateState({
      ...state,
      requestedProjectName: expectedName,
      expectedProjectName: null,
      observedProjectName: afterReload,
      projectTitleSaveStatus: 'failed',
      projectTitleCheckedAt: new Date().toISOString(),
    });
    await record('project.title', 'failed', {
      projectUrl: state.projectUrl,
      before,
      expectedName,
      afterReload,
      locator: match.label,
    });
    throw new Error(`Project title did not persist after reload; observed: ${afterReload || '[empty]'}`);
  }

  await updateState({
    ...state,
    expectedProjectName: expectedName,
    observedProjectName: afterReload,
    projectTitleSaveStatus: 'verified',
    projectTitleVerifiedAt: new Date().toISOString(),
  });
  await record('project.title', 'verified', {
    projectUrl: state.projectUrl,
    before,
    afterReload,
    locator: match.label,
  });
  return { before, afterReload, verified: true };
}

async function fillPromptWithoutGenerate(page, prompt) {
  const state = await assertManagedTestProject(page);
  if (!prompt.startsWith('POC_NO_GENERATE:')) {
    throw new Error('PoC prompt must start with POC_NO_GENERATE:');
  }
  if (prompt.length > 500) throw new Error('PoC prompt must be 500 characters or fewer');

  const match = await promptEditorLocator(page);
  const before = redact(await match.locator.innerText().catch(() => ''));
  await match.locator.fill(prompt);
  const after = redact(await match.locator.innerText());
  if (after !== prompt) {
    throw new Error('Prompt editor content did not match the requested text');
  }

  const submitControls = await visibleCount([
    page.getByRole('button', { name: /generate|start creating|bắt đầu tạo/i }),
  ]);
  await record('prompt.fill-only', 'verified', {
    projectUrl: state.projectUrl,
    before,
    after,
    locator: match.label,
    submitControlsObserved: submitControls,
    submitClicked: false,
  });
  return { before, after, submitControlsObserved: submitControls, submitClicked: false };
}

async function openSavedProjectFromList(page) {
  const state = await readState();
  if (!state.projectUrl || !state.projectCreatedAt) {
    throw new Error('No PoC-created project is recorded in state');
  }

  await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const projectPath = new URL(state.projectUrl).pathname;
  const projectLink = page.locator(`a[href$="${projectPath}"]`);
  await projectLink.waitFor({ state: 'visible', timeout: 20_000 });
  const visibleLinks = [];
  for (let index = 0; index < (await projectLink.count()); index += 1) {
    const item = projectLink.nth(index);
    if (await item.isVisible().catch(() => false)) visibleLinks.push(item);
  }
  if (visibleLinks.length !== 1) {
    throw new Error(`Expected one saved project link on dashboard; found ${visibleLinks.length}`);
  }

  await visibleLinks[0].click();
  await page.waitForURL((url) => isSameSafeUrl(url.href, state.projectUrl), { timeout: 30_000 });
  const observedName = await readProjectTitle(page);
  const titleMatches = !state.expectedProjectName || observedName === state.expectedProjectName;
  await record('project.open-from-list', titleMatches ? 'verified' : 'partial', {
    projectUrl: state.projectUrl,
    observedName,
    titleMatches,
    locator: `a[href="${projectPath}"]`,
  });
  if (!titleMatches) {
    throw new Error(`Opened the recorded project, but title mismatched; observed: ${observedName || '[empty]'}`);
  }
  return { url: safeUrl(page.url()), observedName, verified: true };
}

async function reopenProject(page) {
  const state = await readState();
  if (!state.projectUrl) throw new Error('No projectUrl saved. Use save-project first.');
  await page.goto(state.projectUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const summary = await pageSummary(page);
  await record('project.reopen', summary.likelyProject ? 'observed' : 'unverified', {
    projectUrl: state.projectUrl,
    currentUrl: summary.url,
    title: summary.title,
  });
  return summary;
}

function printHelp() {
  console.log(`
Commands:
  help                       Show this help
  status                     Show safe page/session summary
  inspect                    List visible controls (email-redacted)
  create-project [name]      Click one unambiguous New project control
  set-project-title <name>   Name only the project created by this PoC; verify after reload
  verify-project             Read title of the recorded PoC-created project
  open-saved-project         Open the recorded project from its dashboard href
  fill-prompt <text>         Fill only; requires POC_NO_GENERATE: prefix; never submits
  save-project [name]        Save current project URL for reopen test
  reopen-project             Open saved project URL
  reload                     Reload current page
  goto-flow                  Navigate to Google Flow landing page
  show-state                 Print non-secret local PoC state
  hash <file>                Print size and SHA-256 of a downloaded file
  quit                       Close browser cleanly and persist session

There is intentionally no generate command before explicit credit approval.
`);
}

console.log(`Launching ${browserChannel} headful with dedicated profile:`);
console.log(`  ${PROFILE_DIR}`);
console.log('This mode never performs Google login. Run npm run auth first when authentication is required.');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: browserChannel,
  headless: false,
  chromiumSandbox: true,
  acceptDownloads: true,
  viewport: { width: 1440, height: 960 },
  slowMo: 80,
});

let page = await currentPage(context);
const sessionCheck = await verifyReusedFlowSession(page);
await record('session.reuse', sessionCheck.ok ? 'verified' : 'blocked', {
  reason: sessionCheck.reason,
  currentUrl: sessionCheck.summary.url,
  title: sessionCheck.summary.title,
});

if (!sessionCheck.ok) {
  console.error(`STOPPED: ${sessionCheck.reason}`);
  console.error('Close this browser, run npm run auth, sign in manually, close it, then run npm start again.');
  await context.close();
  process.exit(2);
} else {
  console.log('VERIFIED: existing Google session opened the Flow app without a Playwright login.');
}

context.on('page', async (newPage) => {
  page = newPage;
  await newPage.waitForLoadState('domcontentloaded').catch(() => {});
  console.log(`New page: ${safeUrl(newPage.url())}`);
});

await record('session.launch', 'observed', {
  browser: browserChannel,
  currentUrl: page.url(),
});

const rl = createInterface({ input, output });
printHelp();

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await record('session.close', 'observed', { currentUrl: page?.url?.() || '' }).catch(() => {});
  rl.close();
  await context.close().catch(() => {});
}

process.once('SIGINT', async () => {
  await close();
  process.exit(130);
});

try {
  while (!closing) {
    const raw = (await rl.question('flow-poc> ')).trim();
    if (!raw) continue;
    const [command, ...args] = raw.split(/\s+/);
    page = await currentPage(context);

    try {
      if (command === 'help') {
        printHelp();
      } else if (command === 'status') {
        const summary = await pageSummary(page);
        console.log(JSON.stringify(summary, null, 2));
        await record('page.status', 'observed', summary);
      } else if (command === 'inspect') {
        const controls = await inspectControls(page);
        console.log(JSON.stringify(controls, null, 2));
        await record('page.inspect', 'observed', { controlCount: controls.length, currentUrl: page.url() });
      } else if (command === 'create-project') {
        const expectedName = args.join(' ').trim();
        console.log(JSON.stringify(await createProject(page, expectedName), null, 2));
      } else if (command === 'set-project-title') {
        console.log(JSON.stringify(await setCurrentProjectTitle(page, args.join(' ').trim()), null, 2));
      } else if (command === 'verify-project') {
        console.log(JSON.stringify({ observedName: await readProjectTitle(page), verified: true }, null, 2));
      } else if (command === 'open-saved-project') {
        console.log(JSON.stringify(await openSavedProjectFromList(page), null, 2));
      } else if (command === 'fill-prompt') {
        console.log(JSON.stringify(await fillPromptWithoutGenerate(page, args.join(' ').trim()), null, 2));
      } else if (command === 'save-project') {
        console.log(JSON.stringify(await saveCurrentProject(page, args.join(' ').trim()), null, 2));
      } else if (command === 'reopen-project') {
        console.log(JSON.stringify(await reopenProject(page), null, 2));
      } else if (command === 'reload') {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
        console.log(JSON.stringify(await pageSummary(page), null, 2));
      } else if (command === 'goto-flow') {
        await page.goto(FLOW_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        console.log(JSON.stringify(await pageSummary(page), null, 2));
      } else if (command === 'show-state') {
        console.log(JSON.stringify(await readState(), null, 2));
      } else if (command === 'hash') {
        const filePath = args.join(' ').trim();
        if (!filePath) throw new Error('Usage: hash <file>');
        const resolved = path.resolve(filePath);
        const bytes = await readFile(resolved);
        const info = await stat(resolved);
        console.log(
          JSON.stringify(
            { path: resolved, bytes: info.size, sha256: createHash('sha256').update(bytes).digest('hex') },
            null,
            2,
          ),
        );
      } else if (command === 'quit' || command === 'exit') {
        await close();
      } else if (command === 'generate' || command === 'submit') {
        console.log('BLOCKED: generation is not implemented before explicit credit approval in chat.');
        await record('generation.submit', 'blocked', { reason: 'credit approval required' });
      } else {
        console.log(`Unknown command: ${command}. Type help.`);
      }
    } catch (error) {
      console.error(`ERROR: ${redact(error?.message || error)}`);
      await record(`command.${command}`, 'failed', { message: error?.message || error, currentUrl: page.url() });
    }
  }
} finally {
  await close();
}

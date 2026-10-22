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

const APPROVED_IMAGE_PROMPT =
  'scene-01-01: A single red origami paper boat centered on a plain matte white tabletop, soft daylight from the left, clean minimal composition, no people, no text, 16:9.';

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
  if (!expectedName || !/^ngoday-poc-ui-[a-z0-9-]+$/i.test(expectedName)) {
    throw new Error('Test project name must match ngoday-poc-ui-[a-z0-9-]+');
  }

  const { state, card, editButton } = await savedProjectCard(page);
  const alreadyNamed = (await card.innerText()).includes(expectedName);
  let before = expectedName;
  if (!alreadyNamed) {
    await editButton.click();
    const editorInput = card.locator('input[type="text"]');
    await editorInput.waitFor({ state: 'visible', timeout: 10_000 });
    const saveButton = card.getByRole('button', { name: /save project title|lưu tiêu đề dự án/i });
    if ((await editorInput.count()) !== 1 || (await saveButton.count()) !== 1) {
      throw new Error('Recorded project title editor is ambiguous; refusing to save');
    }

    before = redact(await editorInput.inputValue());
    await editorInput.fill(expectedName);
    if ((await editorInput.inputValue()) !== expectedName) {
      throw new Error('Project title editor did not contain the requested value');
    }

    await Promise.all([
      editorInput.waitFor({ state: 'hidden', timeout: 20_000 }),
      saveButton.click(),
    ]);
    await card.filter({ hasText: expectedName }).waitFor({ state: 'visible', timeout: 20_000 });
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  const reloadedCard = await savedProjectCard(page);
  await reloadedCard.card.filter({ hasText: expectedName }).waitFor({ state: 'visible', timeout: 20_000 });
  await reloadedCard.projectLink.click();
  await page.waitForURL((url) => isSameSafeUrl(url.href, state.projectUrl), { timeout: 30_000 });
  const afterReload = await readProjectTitle(page);
  if (afterReload !== expectedName) {
    throw new Error(`Project title mismatch after dashboard reload and reopen: ${afterReload || '[empty]'}`);
  }

  await updateState({
    requestedProjectName: expectedName,
    expectedProjectName: expectedName,
    observedProjectName: afterReload,
    projectTitleSaveStatus: 'verified',
    projectTitleVerifiedAt: new Date().toISOString(),
  });
  await record('project.title', 'verified', {
    projectUrl: state.projectUrl,
    before,
    afterReload,
    alreadyNamed,
    locator: 'exact project href -> direct card parent -> accessible Edit/Save buttons',
  });
  return { before, afterReload, alreadyNamed, verified: true };
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

async function inspectPromptArea(page) {
  await assertManagedTestProject(page);
  const { locator: editor } = await promptEditorLocator(page);
  const candidates = await editor.evaluate((element) => {
    const rows = [];
    let current = element;
    for (let depth = 0; current && depth <= 6; depth += 1, current = current.parentElement) {
      const controls = [...current.querySelectorAll('button, input, [role], [contenteditable="true"]')].map(
        (control) => ({
          tag: control.tagName.toLowerCase(),
          type: control.getAttribute('type') || '',
          role: control.getAttribute('role') || '',
          ariaLabel: control.getAttribute('aria-label') || '',
          ariaHaspopup: control.getAttribute('aria-haspopup') || '',
          ariaExpanded: control.getAttribute('aria-expanded') || '',
          ariaPressed: control.getAttribute('aria-pressed') || '',
          ariaChecked: control.getAttribute('aria-checked') || '',
          disabled: control instanceof HTMLButtonElement || control instanceof HTMLInputElement ? control.disabled : false,
          text: control.textContent || '',
        }),
      );
      rows.push({ depth, tag: current.tagName.toLowerCase(), controls });
    }
    return rows;
  });

  return candidates.map((candidate) => ({
    depth: candidate.depth,
    tag: candidate.tag,
    controls: candidate.controls.map((control) => ({
      ...control,
      ariaLabel: redact(control.ariaLabel),
      text: redact(control.text),
    })),
  }));
}

async function openGenerationSettings(page) {
  await assertManagedTestProject(page);
  const { locator: editor } = await promptEditorLocator(page);
  const promptBox = editor.locator('xpath=ancestor::flow-base-prompt-box[1]');
  const settingsButton = promptBox.getByRole('button', {
    name: /settings|cài đặt|điều kiện kích hoạt cài đặt/i,
  });
  if ((await settingsButton.count()) !== 1) {
    throw new Error(`Expected one generation settings button; found ${await settingsButton.count()}`);
  }
  const before = redact(await settingsButton.innerText());
  await settingsButton.click();
  await record('generation.settings.open', 'observed', {
    projectUrl: page.url(),
    before,
  });
  return { before, clicked: true, submitClicked: false };
}

async function configureSingleImage(page) {
  await openGenerationSettings(page);
  const imageRadio = page.getByRole('radio', { name: /image|hình ảnh/i });
  const singleOutputRadio = page.getByRole('radio', { name: /^x1$/i });
  if ((await imageRadio.count()) !== 1 || (await singleOutputRadio.count()) !== 1) {
    throw new Error('Image or x1 setting is ambiguous; refusing to change generation settings');
  }

  if ((await imageRadio.getAttribute('aria-checked')) !== 'true') await imageRadio.click();
  if ((await singleOutputRadio.getAttribute('aria-checked')) !== 'true') await singleOutputRadio.click();
  const imageChecked = await imageRadio.getAttribute('aria-checked');
  const singleOutputChecked = await singleOutputRadio.getAttribute('aria-checked');
  if (imageChecked !== 'true' || singleOutputChecked !== 'true') {
    throw new Error(`Generation settings did not persist in the open menu: image=${imageChecked}, x1=${singleOutputChecked}`);
  }

  const creditLabels = [];
  const creditLinks = page.locator('a').filter({ hasText: /credits?|tín dụng/i });
  for (let index = 0; index < (await creditLinks.count()); index += 1) {
    const link = creditLinks.nth(index);
    if (await link.isVisible().catch(() => false)) creditLabels.push(redact(await link.innerText()));
  }

  await page.keyboard.press('Escape');
  const { locator: editor } = await promptEditorLocator(page);
  const promptBox = editor.locator('xpath=ancestor::flow-base-prompt-box[1]');
  const settingsButton = promptBox.getByRole('button', {
    name: /settings|cài đặt|điều kiện kích hoạt cài đặt/i,
  });
  const summary = redact(await settingsButton.innerText());
  if (!/x1\b/i.test(summary)) {
    throw new Error(`Prompt settings summary does not confirm x1: ${summary}`);
  }
  await record('generation.settings.single-image', 'verified', {
    projectUrl: page.url(),
    imageChecked,
    singleOutputChecked,
    summary,
    creditLabels: creditLabels.join(', '),
    submitClicked: false,
  });
  return { imageChecked, singleOutputChecked, summary, creditLabels, submitClicked: false };
}

async function readMediaSnapshot(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const customTagCounts = {};
    const identityAttributeCounts = {};
    for (const element of document.querySelectorAll('*')) {
      const tag = element.tagName.toLowerCase();
      if (tag.includes('-')) customTagCounts[tag] = (customTagCounts[tag] || 0) + 1;
      for (const attribute of element.getAttributeNames()) {
        if (/(?:asset|media|generation)[-_]?id/i.test(attribute)) {
          identityAttributeCounts[attribute] = (identityAttributeCounts[attribute] || 0) + 1;
        }
      }
    }
    return {
      customTagCounts: Object.fromEntries(Object.entries(customTagCounts).sort(([left], [right]) => left.localeCompare(right))),
      identityAttributeCounts,
      visibleImages: [...document.querySelectorAll('img')].filter(visible).length,
      visibleVideos: [...document.querySelectorAll('video')].filter(visible).length,
      visibleCanvases: [...document.querySelectorAll('canvas')].filter(visible).length,
    };
  });
}

async function captureMediaBaseline(page) {
  const state = await assertManagedTestProject(page);
  const snapshot = await readMediaSnapshot(page);
  await updateState({
    mediaBaseline: snapshot,
    mediaBaselineAt: new Date().toISOString(),
  });
  await record('media.baseline', 'observed', {
    projectUrl: state.projectUrl,
    visibleImages: snapshot.visibleImages,
    visibleVideos: snapshot.visibleVideos,
    visibleCanvases: snapshot.visibleCanvases,
    customTagKinds: Object.keys(snapshot.customTagCounts).length,
  });
  return snapshot;
}

async function inspectCurrentMedia(page) {
  await assertManagedTestProject(page);
  return readMediaSnapshot(page);
}

async function generateOneApprovedImage(page) {
  const state = await assertManagedTestProject(page);
  if (state.expectedProjectName !== 'ngoday-poc-ui-20261022-01' || state.projectTitleSaveStatus !== 'verified') {
    throw new Error('Recorded project name is not verified; generation is blocked');
  }
  if (state.generationAttempt) {
    throw new Error('A generation attempt is already recorded; automatic retry is forbidden');
  }
  if (!state.mediaBaseline) {
    throw new Error('No media baseline is recorded; generation is blocked');
  }

  const settings = await configureSingleImage(page);
  if (settings.creditLabels.length !== 1 || !/^0\s*(?:credits?|tín dụng)$/iu.test(settings.creditLabels[0])) {
    await record('generation.submit', 'blocked', {
      reason: 'credit label changed or became ambiguous',
      creditLabels: settings.creditLabels.join(', '),
    });
    throw new Error(`Credit label differs from approved value: ${settings.creditLabels.join(', ') || '[missing]'}`);
  }
  if (!/nano banana 2\.1/i.test(settings.summary) || !/crop_16_9/i.test(settings.summary) || !/x1\b/i.test(settings.summary)) {
    throw new Error(`Generation settings differ from the approved configuration: ${settings.summary}`);
  }

  const currentMedia = await readMediaSnapshot(page);
  if (
    Object.keys(currentMedia.identityAttributeCounts).length !== 0 ||
    currentMedia.visibleVideos !== state.mediaBaseline.visibleVideos ||
    currentMedia.visibleCanvases !== state.mediaBaseline.visibleCanvases ||
    currentMedia.visibleImages !== state.mediaBaseline.visibleImages
  ) {
    throw new Error('Current media state differs from the approved empty-project baseline; generation is blocked');
  }

  const { locator: editor } = await promptEditorLocator(page);
  const promptBox = editor.locator('xpath=ancestor::flow-base-prompt-box[1]');
  const agentButton = promptBox.getByRole('button', { name: /^(?:agent|tác nhân)$/i });
  if ((await agentButton.count()) !== 1 || (await agentButton.getAttribute('aria-pressed')) !== 'false') {
    throw new Error('Agent state is not unambiguously off; generation is blocked');
  }
  await editor.fill(APPROVED_IMAGE_PROMPT);
  if ((await editor.innerText()) !== APPROVED_IMAGE_PROMPT) {
    throw new Error('Prompt verification failed; generation is blocked');
  }

  const submitButton = promptBox.getByRole('button', { name: /start creating|generate|bắt đầu tạo/i });
  if ((await submitButton.count()) !== 1) {
    throw new Error(`Expected one submit button; found ${await submitButton.count()}`);
  }
  await submitButton.click({ trial: true, timeout: 20_000 });

  const attempt = {
    id: `scene-01-01-${new Date().toISOString()}`,
    sceneId: 'scene-01-01',
    prompt: APPROVED_IMAGE_PROMPT,
    settingsSummary: settings.summary,
    creditLabel: settings.creditLabels[0],
    status: 'armed',
    submitClicks: 0,
    armedAt: new Date().toISOString(),
  };
  await updateState({ generationAttempt: attempt });
  await record('generation.submit', 'armed', {
    attemptId: attempt.id,
    sceneId: attempt.sceneId,
    settingsSummary: attempt.settingsSummary,
    creditLabel: attempt.creditLabel,
    submitClicks: 0,
  });

  await submitButton.click();
  const submitted = {
    ...attempt,
    status: 'submitted',
    submitClicks: 1,
    submittedAt: new Date().toISOString(),
  };
  await updateState({ generationAttempt: submitted });
  await record('generation.submit', 'submitted', {
    attemptId: submitted.id,
    sceneId: submitted.sceneId,
    submitClicks: submitted.submitClicks,
    creditLabel: submitted.creditLabel,
  });
  return submitted;
}

async function uniqueElementByMediaId(page, mediaId) {
  const tiles = page.locator('[data-media-id]');
  await tiles.first().waitFor({ state: 'attached', timeout: 180_000 });
  const matches = [];
  for (let index = 0; index < (await tiles.count()); index += 1) {
    const tile = tiles.nth(index);
    if ((await tile.getAttribute('data-media-id')) === mediaId) matches.push(tile);
  }
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one element for recorded media ID; found ${matches.length}`);
  }
  return matches[0];
}

async function mapSingleGeneratedImage(page) {
  const state = await assertManagedTestProject(page);
  if (state.generationAttempt?.status !== 'submitted' || state.generationAttempt?.submitClicks !== 1) {
    throw new Error('Exactly one submitted generation attempt is not recorded');
  }

  const tiles = page.locator('[data-media-id]');
  await tiles.first().waitFor({ state: 'attached', timeout: 180_000 });
  if ((await tiles.count()) !== 1) {
    throw new Error(`Expected exactly one generated media identity; found ${await tiles.count()}`);
  }
  const mediaId = await tiles.first().getAttribute('data-media-id');
  if (!mediaId) throw new Error('Generated image tile has no data-media-id');
  const identityTag = await tiles.first().evaluate((element) => element.tagName.toLowerCase());

  const mappedAsset = {
    sceneId: state.generationAttempt.sceneId,
    attemptId: state.generationAttempt.id,
    mediaId,
    identityTag,
    type: 'image',
    status: 'observed',
    observedAt: new Date().toISOString(),
  };
  await updateState({ mappedAsset });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  const reloadedTile = await uniqueElementByMediaId(page, mediaId);
  await reloadedTile.waitFor({ state: 'attached', timeout: 60_000 });
  const mappedAfterReload = {
    ...mappedAsset,
    status: 'verified-after-reload',
    verifiedAt: new Date().toISOString(),
  };
  await updateState({ mappedAsset: mappedAfterReload });
  await record('media.mapping', 'verified', {
    sceneId: mappedAfterReload.sceneId,
    attemptId: mappedAfterReload.attemptId,
    mediaId,
    identityCount: 1,
    verifiedAfterReload: true,
  });
  return { ...mappedAfterReload, identityCount: 1, verifiedAfterReload: true };
}

async function inspectMappedAsset(page) {
  const state = await assertManagedTestProject(page);
  if (!state.mappedAsset?.mediaId) throw new Error('No mapped asset is recorded');
  const tile = await uniqueElementByMediaId(page, state.mappedAsset.mediaId);
  await tile.waitFor({ state: 'attached', timeout: 30_000 });
  const identityTag = await tile.evaluate((element) => element.tagName.toLowerCase());
  const image = identityTag === 'img' ? tile : tile.locator('img').first();
  await image.waitFor({ state: 'visible', timeout: 30_000 });
  await image.hover();
  await page.locator('flow-image-hotbar').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  const details = await tile.evaluate((element) => {
    const rows = [];
    let current = element;
    for (let depth = 0; current && depth <= 3; depth += 1, current = current.parentElement) {
      const controls = [...current.querySelectorAll('button, a, input, [role]')].map((control) => {
        const style = window.getComputedStyle(control);
        const rect = control.getBoundingClientRect();
        return {
          tag: control.tagName.toLowerCase(),
          role: control.getAttribute('role') || '',
          ariaLabel: control.getAttribute('aria-label') || '',
          title: control.getAttribute('title') || '',
          type: control.getAttribute('type') || '',
          text: control.textContent || '',
          visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
        };
      });
      rows.push({
        depth,
        tag: current.tagName.toLowerCase(),
        dataMediaId: current.getAttribute('data-media-id') || '',
        text: current.textContent || '',
        controls,
      });
    }
    return rows;
  });
  const safeDetails = details.map((row) => ({
    ...row,
    dataMediaId: redact(row.dataMediaId),
    text: redact(row.text),
    controls: row.controls.map((control) => ({
      ...control,
      ariaLabel: redact(control.ariaLabel),
      title: redact(control.title),
      text: redact(control.text),
    })),
  }));
  await record('media.inspect', 'observed', {
    mediaId: state.mappedAsset.mediaId,
    rowCount: safeDetails.length,
  });
  return safeDetails;
}

async function mappedAssetElements(page) {
  const state = await assertManagedTestProject(page);
  if (!state.mappedAsset?.mediaId) throw new Error('No mapped asset is recorded');

  const identity = await uniqueElementByMediaId(page, state.mappedAsset.mediaId);
  await identity.waitFor({ state: 'attached', timeout: 30_000 });
  const identityTag = await identity.evaluate((element) => element.tagName.toLowerCase());
  const image = identityTag === 'img' ? identity : identity.locator('img').first();
  await image.waitFor({ state: 'visible', timeout: 30_000 });

  const tile = identity.locator('xpath=ancestor::flow-image-tile[1]');
  if ((await tile.count()) !== 1) {
    throw new Error(`Expected one flow-image-tile for mapped media ID; found ${await tile.count()}`);
  }
  return { state, identity, image, tile };
}

async function openMappedAssetMenu(page) {
  const { state, image, tile } = await mappedAssetElements(page);
  await image.hover();

  const moreButton = tile.getByRole('button', { name: /^(?:more options|tuỳ chọn khác)$/i });
  if ((await moreButton.count()) !== 1) {
    throw new Error(`Expected one More options button on the mapped asset; found ${await moreButton.count()}`);
  }
  await moreButton.click();

  const menuControls = page.locator(
    '[role="menuitem"], [role="option"], [role="menu"] button, [role="listbox"] button',
  );
  await menuControls.first().waitFor({ state: 'visible', timeout: 10_000 });
  const observed = [];
  for (let index = 0; index < (await menuControls.count()); index += 1) {
    const control = menuControls.nth(index);
    if (!(await control.isVisible().catch(() => false))) continue;
    observed.push({
      tag: await control.evaluate((element) => element.tagName.toLowerCase()),
      role: (await control.getAttribute('role')) || '',
      ariaLabel: redact(await control.getAttribute('aria-label')),
      title: redact(await control.getAttribute('title')),
      text: redact(await control.innerText().catch(() => '')),
    });
  }
  if (observed.length === 0) throw new Error('Mapped asset menu opened, but no visible menu controls were identified');

  await record('media.menu.inspect', 'observed', {
    mediaId: state.mappedAsset.mediaId,
    controlCount: observed.length,
    controls: observed.map((control) => control.text || control.ariaLabel).join(' | '),
  });
  return observed;
}

async function openMappedAssetRenameInput(page, state) {
  await page.keyboard.press('Escape').catch(() => {});
  const { image, tile } = await mappedAssetElements(page);
  await image.hover();

  const moreButton = tile.getByRole('button', { name: /^(?:more options|tuỳ chọn khác)$/i });
  if ((await moreButton.count()) !== 1) {
    throw new Error(`Expected one More options button on the mapped asset; found ${await moreButton.count()}`);
  }
  await moreButton.click();

  const renameItems = page.getByRole('menuitem', { name: /(?:rename|đổi tên)/i });
  const visibleRenameItems = [];
  for (let index = 0; index < (await renameItems.count()); index += 1) {
    const item = renameItems.nth(index);
    if (await item.isVisible().catch(() => false)) visibleRenameItems.push(item);
  }
  if (visibleRenameItems.length !== 1) {
    throw new Error(`Expected one visible Rename menu item; found ${visibleRenameItems.length}`);
  }
  await visibleRenameItems[0].click();

  const visibleTextInputs = page.locator('input[type="text"]:visible');
  await visibleTextInputs.first().waitFor({ state: 'visible', timeout: 10_000 });
  const matchingEditors = [];
  for (let index = 0; index < (await visibleTextInputs.count()); index += 1) {
    const candidate = visibleTextInputs.nth(index);
    const value = (await candidate.inputValue()).normalize('NFC').trim();
    const ariaLabel = ((await candidate.getAttribute('aria-label')) || '').normalize('NFC').trim();
    if (value && value !== state.expectedProjectName && !/^(?:search|tìm kiếm)$/iu.test(ariaLabel)) {
      matchingEditors.push(candidate);
    }
  }
  if (matchingEditors.length !== 1) {
    throw new Error(`Expected one non-project inline asset rename input; found ${matchingEditors.length}`);
  }

  const editor = matchingEditors[0];
  const editorContainer = editor.locator('xpath=ancestor::flow-editable-text[1]');
  if ((await editorContainer.count()) !== 1) {
    throw new Error(`Expected one editable-text container for mapped asset; found ${await editorContainer.count()}`);
  }
  return { editor, editorContainer };
}

async function openMappedAssetRenameEditor(page) {
  const { state, image, tile } = await mappedAssetElements(page);
  await page.keyboard.press('Escape').catch(() => {});
  await image.hover();

  const moreButton = tile.getByRole('button', { name: /^(?:more options|tuỳ chọn khác)$/i });
  if ((await moreButton.count()) !== 1) {
    throw new Error(`Expected one More options button on the mapped asset; found ${await moreButton.count()}`);
  }
  await moreButton.click();

  const renameItems = page.getByRole('menuitem', { name: /(?:rename|đổi tên)/i });
  const visibleRenameItems = [];
  for (let index = 0; index < (await renameItems.count()); index += 1) {
    const item = renameItems.nth(index);
    if (await item.isVisible().catch(() => false)) visibleRenameItems.push(item);
  }
  if (visibleRenameItems.length !== 1) {
    throw new Error(`Expected one visible Rename menu item; found ${visibleRenameItems.length}`);
  }
  await visibleRenameItems[0].click();

  const editors = page.locator('input:visible, textarea:visible, [contenteditable="true"]:visible');
  await editors.first().waitFor({ state: 'visible', timeout: 10_000 });
  const observedEditors = [];
  const assetEditorCandidates = [];
  for (let index = 0; index < (await editors.count()); index += 1) {
    const editor = editors.nth(index);
    const value = await editor.inputValue().catch(() => editor.innerText().catch(() => ''));
    const ariaLabel = (await editor.getAttribute('aria-label')) || '';
    observedEditors.push({
      tag: await editor.evaluate((element) => element.tagName.toLowerCase()),
      type: (await editor.getAttribute('type')) || '',
      ariaLabel: redact(ariaLabel),
      placeholder: redact(await editor.getAttribute('placeholder')),
      value: redact(value),
    });
    if (
      value.normalize('NFC').trim() &&
      value.normalize('NFC').trim() !== state.expectedProjectName &&
      !/^(?:search|tìm kiếm)$/iu.test(ariaLabel.normalize('NFC').trim()) &&
      (await editor.evaluate((element) => element.tagName.toLowerCase())) === 'input'
    ) {
      assetEditorCandidates.push(editor);
    }
  }

  let editorHierarchy = [];
  if (assetEditorCandidates.length === 1) {
    editorHierarchy = await assetEditorCandidates[0].evaluate((element) => {
      const rows = [];
      let current = element;
      for (let depth = 0; current && depth <= 4; depth += 1, current = current.parentElement) {
        const controls = [...current.querySelectorAll('button, input, [role]')].map((control) => {
          const rect = control.getBoundingClientRect();
          const style = window.getComputedStyle(control);
          return {
            tag: control.tagName.toLowerCase(),
            role: control.getAttribute('role') || '',
            ariaLabel: control.getAttribute('aria-label') || '',
            title: control.getAttribute('title') || '',
            text: control.textContent || '',
            value: control instanceof HTMLInputElement ? control.value : '',
            visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
          };
        });
        rows.push({ depth, tag: current.tagName.toLowerCase(), controls });
      }
      return rows;
    });
    editorHierarchy = editorHierarchy.map((row) => ({
      ...row,
      controls: row.controls.map((control) => ({
        ...control,
        ariaLabel: redact(control.ariaLabel),
        title: redact(control.title),
        text: redact(control.text),
        value: redact(control.value),
      })),
    }));
  }

  const actionButtons = page.getByRole('button', { name: /(?:save|lưu|cancel|hủy|huỷ)/i });
  const observedActions = [];
  for (let index = 0; index < (await actionButtons.count()); index += 1) {
    const button = actionButtons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    observedActions.push({
      ariaLabel: redact(await button.getAttribute('aria-label')),
      text: redact(await button.innerText().catch(() => '')),
      disabled: await button.isDisabled().catch(() => false),
    });
  }

  await record('media.rename-editor.inspect', 'observed', {
    mediaId: state.mappedAsset.mediaId,
    editorCount: observedEditors.length,
    actionCount: observedActions.length,
  });
  return { editors: observedEditors, assetEditorCandidates: assetEditorCandidates.length, editorHierarchy, actions: observedActions, saved: false };
}

async function renameMappedAsset(page, targetName) {
  const state = await assertManagedTestProject(page);
  if (!state.mappedAsset?.mediaId || !state.mappedAsset?.sceneId) {
    throw new Error('No mapped asset is recorded');
  }
  if (targetName !== state.mappedAsset.sceneId || !/^scene-\d{2}-\d{2}$/i.test(targetName)) {
    throw new Error(`Rename target must exactly match the mapped scene ID: ${state.mappedAsset.sceneId}`);
  }
  if (state.mappedAsset.renameStatus === 'verified-after-reload') {
    throw new Error('Mapped asset rename is already verified; refusing to rename again');
  }

  const { editor, editorContainer } = await openMappedAssetRenameInput(page, state);
  const before = (await editor.inputValue()).normalize('NFC').trim();
  if (before !== targetName) {
    await editor.fill(targetName);
    if ((await editor.inputValue()).normalize('NFC').trim() !== targetName) {
      throw new Error('Inline rename input did not contain the exact target name');
    }
    const doneButton = editorContainer.getByRole('button', { name: /^(?:done|xong)$/i });
    if ((await doneButton.count()) !== 1) {
      throw new Error(`Expected one Done button for mapped asset rename; found ${await doneButton.count()}`);
    }
    await doneButton.click();
  } else {
    const cancelButton = editorContainer.getByRole('button', { name: /^(?:cancel|hủy|huỷ)$/i });
    if ((await cancelButton.count()) !== 1) {
      throw new Error(`Expected one Cancel button for already-renamed asset; found ${await cancelButton.count()}`);
    }
    await cancelButton.click();
  }
  await editor.waitFor({ state: 'hidden', timeout: 20_000 });

  return verifyMappedAssetName(page, targetName, {
    previousName: before,
    renameMethod:
      before === targetName
        ? 'already persisted; read-only verification'
        : 'asset More options -> Rename -> inline input -> Done',
  });
}

async function verifyMappedAssetName(page, targetName, evidence = {}) {
  let state = await assertManagedTestProject(page);
  if (!state.mappedAsset?.mediaId || targetName !== state.mappedAsset.sceneId) {
    throw new Error('Rename verification target must exactly match the mapped scene ID');
  }
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await uniqueElementByMediaId(page, state.mappedAsset.mediaId);
  const { editor, editorContainer } = await openMappedAssetRenameInput(page, state);
  const observedName = (await editor.inputValue()).normalize('NFC').trim();
  const cancelButton = editorContainer.getByRole('button', { name: /^(?:cancel|hủy|huỷ)$/i });
  if ((await cancelButton.count()) !== 1) {
    throw new Error(`Expected one Cancel button after rename verification; found ${await cancelButton.count()}`);
  }
  await cancelButton.click();
  await editor.waitFor({ state: 'hidden', timeout: 20_000 });
  if (observedName !== targetName) {
    throw new Error(`Mapped asset rename did not persist after reload; observed: ${observedName || '[empty]'}`);
  }

  state = await readState();
  const renamedAsset = {
    ...state.mappedAsset,
    flowNameBefore: evidence.previousName ?? state.mappedAsset.flowNameBefore ?? null,
    flowName: targetName,
    renameMethod: evidence.renameMethod ?? state.mappedAsset.renameMethod ?? 'verified by re-opening Rename after reload',
    renameStatus: 'verified-after-reload',
    renamedAt: state.mappedAsset.renamedAt ?? new Date().toISOString(),
    renameVerifiedAt: new Date().toISOString(),
  };
  await updateState({ mappedAsset: renamedAsset });
  await record('media.rename', 'verified', {
    mediaId: state.mappedAsset.mediaId,
    observedName,
    verifiedAfterReload: true,
  });
  return {
    observedName,
    mediaIdUnchanged: true,
    verifiedAfterReload: true,
  };
}

function detectDownloadedImageFormat(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  if (bytes.length >= 12 && bytes.subarray(4, 12).toString('ascii').includes('ftypavif')) return 'avif';
  return 'unknown';
}

async function downloadMappedAsset(page) {
  const state = await assertManagedTestProject(page);
  if (!state.mappedAsset?.mediaId || state.mappedAsset.renameStatus !== 'verified-after-reload') {
    throw new Error('Mapped asset rename must be verified after reload before download');
  }
  if (state.downloadAttempt) {
    throw new Error('A download attempt is already recorded; refusing an automatic retry');
  }

  await page.keyboard.press('Escape').catch(() => {});
  const { image, tile } = await mappedAssetElements(page);
  await image.hover();
  const moreButton = tile.getByRole('button', { name: /^(?:more options|tuỳ chọn khác)$/i });
  if ((await moreButton.count()) !== 1) {
    throw new Error(`Expected one More options button on the mapped asset; found ${await moreButton.count()}`);
  }
  await moreButton.click();

  const downloadItems = page.getByRole('menuitem', { name: /(?:download|tải xuống)/i });
  const visibleDownloadItems = [];
  for (let index = 0; index < (await downloadItems.count()); index += 1) {
    const item = downloadItems.nth(index);
    if (await item.isVisible().catch(() => false)) visibleDownloadItems.push(item);
  }
  if (visibleDownloadItems.length !== 1) {
    throw new Error(`Expected one visible Download menu item; found ${visibleDownloadItems.length}`);
  }
  await visibleDownloadItems[0].click({ trial: true, timeout: 20_000 });

  const attempt = {
    sceneId: state.mappedAsset.sceneId,
    mediaId: state.mappedAsset.mediaId,
    flowName: state.mappedAsset.flowName,
    status: 'armed',
    clicks: 0,
    armedAt: new Date().toISOString(),
  };
  await updateState({ downloadAttempt: attempt });
  await record('media.download', 'armed', {
    sceneId: attempt.sceneId,
    mediaId: attempt.mediaId,
    clicks: 0,
  });

  await visibleDownloadItems[0].click();
  const menuOpenedAttempt = {
    ...attempt,
    status: 'resolution-menu-open',
    menuClicks: 1,
  };
  await updateState({ downloadAttempt: menuOpenedAttempt });
  return completeArmedDownload(page, menuOpenedAttempt);
}

async function completeArmedDownload(page, suppliedAttempt = null) {
  const state = await assertManagedTestProject(page);
  const attempt = suppliedAttempt ?? state.downloadAttempt;
  if (!attempt || !['armed', 'resolution-menu-open'].includes(attempt.status)) {
    throw new Error('No incomplete mapped-asset download attempt is available');
  }
  if (attempt.mediaId !== state.mappedAsset?.mediaId || state.mappedAsset.renameStatus !== 'verified-after-reload') {
    throw new Error('Download attempt no longer matches the verified renamed asset');
  }

  const findVisibleOriginalSizeItems = async () => {
    const candidates = page.getByRole('menuitem', { name: /1K/i });
    const matches = [];
    for (let index = 0; index < (await candidates.count()); index += 1) {
      const candidate = candidates.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      const name = (await candidate.innerText()).normalize('NFC').replace(/\s+/g, ' ').trim();
      if (/\b1K\b/i.test(name) && /(?:original size|kích thước gốc)/iu.test(name)) matches.push(candidate);
    }
    return matches;
  };

  let originalSizeItems = await findVisibleOriginalSizeItems();
  if (originalSizeItems.length === 0) {
    await page.keyboard.press('Escape').catch(() => {});
    const { image, tile } = await mappedAssetElements(page);
    await image.hover();
    const moreButton = tile.getByRole('button', { name: /^(?:more options|tuỳ chọn khác)$/i });
    if ((await moreButton.count()) !== 1) {
      throw new Error(`Expected one More options button on the mapped asset; found ${await moreButton.count()}`);
    }
    await moreButton.click();
    const downloadItems = page.getByRole('menuitem', { name: /(?:download|tải xuống)/i });
    const visibleDownloadItems = [];
    for (let index = 0; index < (await downloadItems.count()); index += 1) {
      const item = downloadItems.nth(index);
      if (await item.isVisible().catch(() => false)) visibleDownloadItems.push(item);
    }
    if (visibleDownloadItems.length !== 1) {
      throw new Error(`Expected one visible Download menu item; found ${visibleDownloadItems.length}`);
    }
    await visibleDownloadItems[0].click();
    originalSizeItems = await findVisibleOriginalSizeItems();
  }
  if (originalSizeItems.length !== 1) {
    throw new Error(`Expected one visible 1K original-size item; found ${originalSizeItems.length}`);
  }
  await originalSizeItems[0].click({ trial: true, timeout: 20_000 });

  const triggerArmed = {
    ...attempt,
    status: 'original-size-armed',
    menuClicks: Math.max(attempt.menuClicks || 0, 1),
    resolution: '1K original',
    triggerClicks: 0,
    triggerArmedAt: new Date().toISOString(),
  };
  await updateState({ downloadAttempt: triggerArmed });
  await record('media.download-resolution', 'armed', {
    sceneId: attempt.sceneId,
    mediaId: attempt.mediaId,
    resolution: triggerArmed.resolution,
    triggerClicks: 0,
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await originalSizeItems[0].click();
  const download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  const safeFilename = path.basename(suggestedFilename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  if (!safeFilename) throw new Error('Flow returned an empty or unsafe suggested download filename');
  const localPath = path.join(DOWNLOAD_DIR, safeFilename);
  await download.saveAs(localPath);
  const failure = await download.failure();
  if (failure) throw new Error(`Browser download failed: ${failure}`);

  const bytes = await readFile(localPath);
  const info = await stat(localPath);
  const detectedFormat = detectDownloadedImageFormat(bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const expectedName = attempt.sceneId.normalize('NFC');
  const filenamePreserved = path.parse(safeFilename).name.normalize('NFC') === expectedName;
  const validImage = info.size > 0 && detectedFormat !== 'unknown';
  const completed = {
    ...attempt,
    status: 'completed',
    clicks: 1,
    triggerClicks: 1,
    resolution: '1K original',
    suggestedFilename: safeFilename,
    localPath,
    bytes: info.size,
    detectedFormat,
    sha256,
    filenamePreserved,
    validImage,
    completedAt: new Date().toISOString(),
  };
  await updateState({ downloadAttempt: completed });
  await record('media.download', validImage ? 'verified' : 'failed', {
    sceneId: completed.sceneId,
    mediaId: completed.mediaId,
    clicks: completed.clicks,
    suggestedFilename: completed.suggestedFilename,
    bytes: completed.bytes,
    detectedFormat: completed.detectedFormat,
    sha256: completed.sha256,
    filenamePreserved: completed.filenamePreserved,
    validImage: completed.validImage,
  });
  return {
    suggestedFilename: completed.suggestedFilename,
    localPath: completed.localPath,
    bytes: completed.bytes,
    detectedFormat: completed.detectedFormat,
    sha256: completed.sha256,
    filenamePreserved: completed.filenamePreserved,
    validImage: completed.validImage,
  };
}

async function inspectSavedProjectCard(page) {
  const state = await readState();
  if (!state.projectUrl || !state.projectCreatedAt) {
    throw new Error('No PoC-created project is recorded in state');
  }

  await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const projectPath = new URL(state.projectUrl).pathname;
  const projectLink = page.locator(`a[href$="${projectPath}"]`);
  await projectLink.waitFor({ state: 'visible', timeout: 20_000 });
  if ((await projectLink.count()) !== 1) {
    throw new Error(`Expected exactly one recorded project link; found ${await projectLink.count()}`);
  }

  const candidates = await projectLink.evaluate((link) => {
    const rows = [];
    let current = link;
    for (let depth = 0; current && depth <= 6; depth += 1, current = current.parentElement) {
      const controls = [...current.querySelectorAll('a, button, input')].map((element) => ({
        tag: element.tagName.toLowerCase(),
        ariaLabel: element.getAttribute('aria-label') || '',
        type: element.getAttribute('type') || '',
        href: element instanceof HTMLAnchorElement ? element.href : '',
        value: element instanceof HTMLInputElement ? element.value : '',
        text: element.textContent || '',
      }));
      rows.push({
        depth,
        tag: current.tagName.toLowerCase(),
        text: current.textContent || '',
        controls,
      });
    }
    return rows;
  });

  const safeCandidates = candidates.map((candidate) => ({
    depth: candidate.depth,
    tag: candidate.tag,
    text: redact(candidate.text),
    controls: candidate.controls.map((control) => ({
      ...control,
      ariaLabel: redact(control.ariaLabel),
      href: control.href ? safeUrl(control.href) : '',
      value: redact(control.value),
      text: redact(control.text),
    })),
  }));
  await record('project.card.inspect', 'observed', {
    projectUrl: state.projectUrl,
    candidateCount: safeCandidates.length,
  });
  return safeCandidates;
}

async function savedProjectCard(page) {
  const state = await readState();
  if (!state.projectUrl || !state.projectCreatedAt) {
    throw new Error('No PoC-created project is recorded in state');
  }

  await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const projectPath = new URL(state.projectUrl).pathname;
  const projectLink = page.locator(`a[href$="${projectPath}"]`);
  await projectLink.waitFor({ state: 'visible', timeout: 20_000 });
  if ((await projectLink.count()) !== 1) {
    throw new Error(`Expected exactly one recorded project link; found ${await projectLink.count()}`);
  }

  const card = projectLink.locator('..');
  const linksInCard = card.locator(`a[href$="${projectPath}"]`);
  const editButtons = card.getByRole('button', {
    name: /edit project|edit project title|chỉnh sửa (?:tiêu đề )?dự án/i,
  });
  const deleteButtons = card.getByRole('button', { name: /delete project|xoá dự án|xóa dự án/i });
  if ((await linksInCard.count()) !== 1 || (await editButtons.count()) !== 1 || (await deleteButtons.count()) !== 1) {
    throw new Error('Recorded project card structure changed; refusing to select an edit control');
  }
  return { state, projectPath, projectLink, card, editButton: editButtons.first() };
}

async function inspectSavedProjectTitleEditor(page) {
  const { state, card, editButton } = await savedProjectCard(page);
  await editButton.click();
  const editorInput = card.locator('input[type="text"]');
  await editorInput.waitFor({ state: 'visible', timeout: 10_000 });

  const controls = await card.locator('button, input').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type') || '',
        ariaLabel: element.getAttribute('aria-label') || '',
        value: element instanceof HTMLInputElement ? element.value : '',
        text: element.textContent || '',
      })),
  );
  const safeControls = controls.map((control) => ({
    ...control,
    ariaLabel: redact(control.ariaLabel),
    value: redact(control.value),
    text: redact(control.text),
  }));
  await record('project.title-editor.inspect', 'observed', {
    projectUrl: state.projectUrl,
    controlCount: safeControls.length,
  });
  return safeControls;
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
  inspect-project-card       Read DOM relationships around the recorded dashboard card
  inspect-title-editor       Open and inspect only the recorded project's title editor
  open-saved-project         Open the recorded project from its dashboard href
  fill-prompt <text>         Fill only; requires POC_NO_GENERATE: prefix; never submits
  inspect-prompt-area        Read ARIA/state around prompt controls without clicking
  open-generation-settings  Open prompt settings only; never submits
  configure-single-image    Select Image and x1 output; never submits
  capture-media-baseline    Record DOM counts before the one approved generation
  inspect-current-media     Read current DOM media counts without changing state
  generate-one-image        One-shot approved scene-01-01 submit; no retry
  map-single-output         Map the sole image tile and verify its media ID after reload
  inspect-mapped-asset      Hover only the mapped tile and list its controls
  open-mapped-asset-menu   Open only the mapped tile's More options menu and inspect it
  inspect-asset-rename     Open Rename for the mapped asset and inspect the editor; never saves
  rename-mapped-asset <id> Rename only the mapped asset to its exact scene ID and verify reload
  verify-asset-name <id>   Reload and verify the mapped asset's exact Rename value; never saves
  download-mapped-asset    Download the same renamed asset once and verify the local file
  complete-armed-download  Continue an armed Download menu at 1K original; never generates/upscales
  save-project [name]        Save current project URL for reopen test
  reopen-project             Open saved project URL
  reload                     Reload current page
  goto-flow                  Navigate to Google Flow landing page
  show-state                 Print non-secret local PoC state
  hash <file>                Print size and SHA-256 of a downloaded file
  quit                       Close browser cleanly and persist session

Generic generate/submit commands are blocked; the guarded one-shot command requires its approved preconditions.
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
      } else if (command === 'inspect-project-card') {
        console.log(JSON.stringify(await inspectSavedProjectCard(page), null, 2));
      } else if (command === 'inspect-title-editor') {
        console.log(JSON.stringify(await inspectSavedProjectTitleEditor(page), null, 2));
      } else if (command === 'open-saved-project') {
        console.log(JSON.stringify(await openSavedProjectFromList(page), null, 2));
      } else if (command === 'fill-prompt') {
        console.log(JSON.stringify(await fillPromptWithoutGenerate(page, args.join(' ').trim()), null, 2));
      } else if (command === 'inspect-prompt-area') {
        console.log(JSON.stringify(await inspectPromptArea(page), null, 2));
      } else if (command === 'open-generation-settings') {
        console.log(JSON.stringify(await openGenerationSettings(page), null, 2));
      } else if (command === 'configure-single-image') {
        console.log(JSON.stringify(await configureSingleImage(page), null, 2));
      } else if (command === 'capture-media-baseline') {
        console.log(JSON.stringify(await captureMediaBaseline(page), null, 2));
      } else if (command === 'inspect-current-media') {
        console.log(JSON.stringify(await inspectCurrentMedia(page), null, 2));
      } else if (command === 'generate-one-image') {
        console.log(JSON.stringify(await generateOneApprovedImage(page), null, 2));
      } else if (command === 'map-single-output') {
        console.log(JSON.stringify(await mapSingleGeneratedImage(page), null, 2));
      } else if (command === 'inspect-mapped-asset') {
        console.log(JSON.stringify(await inspectMappedAsset(page), null, 2));
      } else if (command === 'open-mapped-asset-menu') {
        console.log(JSON.stringify(await openMappedAssetMenu(page), null, 2));
      } else if (command === 'inspect-asset-rename') {
        console.log(JSON.stringify(await openMappedAssetRenameEditor(page), null, 2));
      } else if (command === 'rename-mapped-asset') {
        console.log(JSON.stringify(await renameMappedAsset(page, args.join(' ').trim()), null, 2));
      } else if (command === 'verify-asset-name') {
        console.log(JSON.stringify(await verifyMappedAssetName(page, args.join(' ').trim()), null, 2));
      } else if (command === 'download-mapped-asset') {
        console.log(JSON.stringify(await downloadMappedAsset(page), null, 2));
      } else if (command === 'complete-armed-download') {
        console.log(JSON.stringify(await completeArmedDownload(page), null, 2));
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
        console.log('BLOCKED: use only the guarded generate-one-image command for the approved PoC attempt.');
        await record('generation.submit', 'blocked', { reason: 'unguarded generation command' });
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

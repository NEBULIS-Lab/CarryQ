import { chromium } from 'playwright';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';

// Capture the existing saved-pose task illustration, without changing robot states.
const url = process.argv[2] || 'http://127.0.0.1:38126/CarryQ/';
const output = process.argv[3];
if (!output) throw new Error('Usage: node scripts/export-readme-preview.mjs URL OUTPUT_DIRECTORY [FPS]');
const fps = +(process.argv[4] || 8);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1050, height: 850 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#playback-view')?.disabled === false, null, { timeout: 120000 });
  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    .recorded-canvas { width: 860px !important; height: 530px !important; border-radius: 0 !important; }
    .recorded-scene { display: block !important; }
    .play-overlay,.orbit-hint { display: none !important; }
    .readme-task { position:absolute; top:17px; left:19px; z-index:7; padding:9px 14px; border:1px solid #8080ff66; border-radius:8px; background:#101521df; color:#f1f2f8; font:500 17px/1.4 system-ui,sans-serif; }
    .readme-task span { color:#aaaaff; margin-right:9px; }
  ` });
  const canvas = page.locator('.recorded-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await canvas.evaluate(element => {
    const label = document.createElement('div');
    label.className = 'readme-task';
    label.innerHTML = '<span>CarryQ</span> USB-C insertion';
    element.appendChild(label);
  });
  const duration = +await page.locator('#scene-time').getAttribute('max');
  const count = Math.ceil(duration * fps) + 1;
  const frames = [];
  let previousView = '';
  let previousTask = '';
  for (let i = 0; i < count; i++) {
    const time = Math.min(i / fps, duration);
    const task = time < 14.514 ? 'usb' : 'charger';
    const view = time < 4.75 || (time >= 14.514 && time < 18.5) ? 'overview' : task;
    const file = `${String(i).padStart(4, '0')}.png`;
    if (process.env.CARRYQ_CAPTURE_RESUME === 'true' && await access(output + '/' + file).then(() => true, () => false)) {
      frames.push({file, time, view});
      continue;
    }
    if (view !== previousView) {
      await page.locator('#playback-view').selectOption(view);
      previousView = view;
    }
    if (task !== previousTask) {
      await page.locator('.readme-task').evaluate((element, name) => {
        element.innerHTML = '<span>CarryQ</span> ' + name;
      }, task === 'usb' ? 'USB-C insertion' : 'Charger insertion');
      previousTask = task;
    }
    // Use the native setter so an exact floating-point duration is accepted.
    await page.locator('#scene-time').evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
    }, time);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await canvas.screenshot({ path: output + '/' + file, animations: 'disabled' });
    frames.push({ file, time, view });
    if (i % 24 === 0 || i === count - 1) console.log(`Captured ${i + 1}/${count}: ${time.toFixed(2)} s, ${task}`);
    if (process.env.CARRYQ_PREVIEW_ONLY === 'true') break;
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const firstFrame = await readFile(output + '/' + frames[0].file);
  const width = firstFrame.readUInt32BE(16), height = firstFrame.readUInt32BE(20);
  await writeFile(output + '/capture.json', JSON.stringify({ source: 'Recorded MuJoCo pose interpolation from the project application; scripted task illustration.', duration, fps, width, height, frames }, null, 2));
} finally { await browser.close(); }

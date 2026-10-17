// Budget Missions page: carousel, mission preview dialog and the sample
// "Build Your First Savings Plan" checklist. Copy comes from the design file
// (src/data/missions.json, extracted verbatim from the approved design).
import './feature';

import missions from '../data/missions.json';
import { $, $all, esc } from '../lib/dom';

interface Mission {
  age: string;
  cat: string;
  profile: string;
  title: string;
  scenario: string;
  steps: string[];
  goal: string;
  badge: string;
  tint: string;
}

const MISSIONS = missions as Mission[];
const GAP = 20;

// ---- Carousel -------------------------------------------------------------
const track = $('#mission-track');
const prev = $('[data-carousel="prev"]') as HTMLButtonElement | null;
const next = $('[data-carousel="next"]') as HTMLButtonElement | null;
const dotsHost = $('[data-carousel="dots"]');
const pos = $('[data-carousel="pos"]');

function step(): number {
  const first = track?.firstElementChild as HTMLElement | null;
  return first ? first.offsetWidth + GAP : 1;
}

function styleNav(button: HTMLButtonElement | null, enabled: boolean, on: [string, string]): void {
  if (!button) return;
  button.disabled = !enabled;
  button.style.background = enabled ? on[0] : '#EEF2F5';
  button.style.color = enabled ? on[1] : '#9AA5B5';
  button.style.cursor = enabled ? 'pointer' : 'default';
}

function update(): void {
  if (!track) return;
  const idx = Math.max(0, Math.min(MISSIONS.length - 1, Math.round(track.scrollLeft / step())));
  const atStart = track.scrollLeft <= 2;
  const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  styleNav(prev, !atStart, ['#0E2C52', '#FFFFFF']);
  styleNav(next, !atEnd, ['#2FC6A4', '#0E2C52']);
  $all('button', dotsHost ?? document.createElement('div')).forEach((dot, i) => {
    const current = i === idx;
    if (current) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
    dot.style.width = current ? '28px' : '10px';
    dot.style.background = current ? '#0E2C52' : '#C9D3DE';
  });
  if (pos) pos.textContent = `Mission ${idx + 1} of ${MISSIONS.length}`;
}

if (track) {
  if (dotsHost) {
    dotsHost.innerHTML = MISSIONS.map(
      (_, i) =>
        `<button type="button" aria-label="Go to mission ${i + 1}" style="width: 10px; height: 10px; padding: 0; border: none; border-radius: 999px; background: #C9D3DE; cursor: pointer; transition: width 200ms ease, background 200ms ease;"></button>`
    ).join('');
    $all('button', dotsHost).forEach((dot, i) =>
      dot.addEventListener('click', () => track.scrollTo({ left: i * step(), behavior: 'smooth' }))
    );
  }
  // Re-sync once the smooth scroll settles, in case scroll events were throttled.
  const settle = () => window.setTimeout(update, 450);
  prev?.addEventListener('click', () => (track.scrollBy({ left: -step(), behavior: 'smooth' }), settle()));
  next?.addEventListener('click', () => (track.scrollBy({ left: step(), behavior: 'smooth' }), settle()));
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('scrollend', update);
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') track.scrollBy({ left: step(), behavior: 'smooth' });
    if (e.key === 'ArrowLeft') track.scrollBy({ left: -step(), behavior: 'smooth' });
  });
  window.addEventListener('resize', update);
  update();
}

// ---- Mission preview dialog ----------------------------------------------
const dialog = $('#mission-modal') as HTMLDialogElement | null;
let opener: HTMLElement | null = null;

function fill(key: string, value: string): void {
  const el = dialog?.querySelector<HTMLElement>(`[data-m="${key}"]`);
  if (el) el.textContent = value;
}

function openMission(i: number, trigger: HTMLElement): void {
  const m = MISSIONS[i];
  if (!dialog || !m) return;
  opener = trigger;
  for (const key of ['age', 'cat', 'profile', 'title', 'scenario', 'goal', 'badge'] as const) fill(key, m[key]);
  const tint = dialog.querySelector<HTMLElement>('[data-m="tint-bg"]');
  if (tint) tint.style.background = m.tint;
  const steps = dialog.querySelector<HTMLElement>('[data-m="steps"]');
  if (steps) {
    steps.innerHTML = m.steps
      .map(
        (t, n) =>
          `<div style="display: flex; gap: 12px; align-items: flex-start; font-size: 14px; line-height: 1.5;"><span style="width: 26px; height: 26px; border-radius: 999px; background: #EAF1FB; color: #1C6FE6; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;">${n + 1}</span><span style="padding-top: 2px;">${esc(t)}</span></div>`
      )
      .join('');
  }
  dialog.showModal();
}

if (dialog) {
  for (const b of $all('[data-mission]')) {
    b.addEventListener('click', () => openMission(Number(b.dataset.mission), b));
  }
  for (const b of $all('[data-close]', dialog)) b.addEventListener('click', () => dialog.close());
  // Clicking the dimmed backdrop (the dialog element itself) closes it.
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  dialog.addEventListener('close', () => opener?.focus());
}

// ---- Sample mission checklist --------------------------------------------
const SAMPLE_STEPS = [
  'Name something you want to save for.',
  'Set a target amount.',
  'Review the expenses your income needs to cover.',
  'Choose a contribution amount to practice with.',
  'Record your first step.',
];
const done = [true, true, false, false, false];
const list = $('[data-steps]');
const doneCard = $('[data-done-card]');
const doneLabel = $('[data-done-label]');

function renderSteps(): void {
  if (!list) return;
  list.innerHTML = SAMPLE_STEPS.map((text, i) => {
    const c = done[i];
    return `<li>
      <button type="button" role="checkbox" aria-checked="${c}" data-step="${i}" style="width: 100%; min-height: 52px; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 16px; border: ${c ? '1.5px solid #2FC6A4' : '1.5px solid #E6EBF2'}; background: ${c ? '#E4F6F1' : '#FFFFFF'}; font-family: inherit; font-size: 15px; color: #0E2C52; text-align: left; cursor: pointer; transition: background 160ms ease;">
        <span aria-hidden="true" style="width: 28px; height: 28px; border-radius: 999px; background: ${c ? '#21B85C' : '#FFFFFF'}; border: ${c ? '2px solid #21B85C' : '2px solid #C0CBDB'}; color: ${c ? '#FFFFFF' : '#3A4A63'}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0;">${c ? '✓' : i + 1}</span>
        <span>${esc(text)}</span>
      </button>
    </li>`;
  }).join('');
  const complete = done.every(Boolean);
  if (doneCard) doneCard.style.opacity = complete ? '1' : '0.55';
  if (doneLabel) doneLabel.textContent = complete ? 'Sample completion' : 'Complete all steps to see this';
}

list?.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-step]');
  if (!button) return;
  const i = Number(button.dataset.step);
  done[i] = !done[i];
  renderSteps();
  list.querySelector<HTMLElement>(`[data-step="${i}"]`)?.focus();
});
renderSteps();

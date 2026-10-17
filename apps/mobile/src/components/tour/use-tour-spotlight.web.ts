import { useEffect, useRef } from 'react';

import type { TourSpotlightOptions } from './use-tour-spotlight';

export type { TourSpotlightOptions } from './use-tour-spotlight';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAD = 6;
const FOCUSABLE =
  'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[role="button"],[role="tab"],[role="link"]';
const BLOCKED_EVENTS = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
  'touchstart',
] as const;

/** The visible element with this id. Tabs stay mounted, so hidden copies are skipped. */
function findVisible(id: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(`[id="${id}"]`));
  for (let i = matches.length - 1; i >= 0; i--) {
    const rect = matches[i].getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return matches[i];
  }
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && !el.hasAttribute('disabled');
}

/**
 * Web: a page-wide dim with bright cutouts around the tour's targets (the tab
 * being explained and its content). The overlay itself ignores the pointer;
 * clicks and keyboard focus on dimmed parts of the page are stopped in the
 * capture phase, while the targets and Budget Buddy's panel keep working.
 * Cutouts follow scrolling and resizing. Everything is removed on exit.
 */
export function useTourSpotlight({
  active,
  targetIds,
  panelId,
  reducedMotion,
  onEscape,
}: TourSpotlightOptions): void {
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  const targetKey = targetIds.join('|');

  useEffect(() => {
    if (!active) return;
    const ids = targetKey ? targetKey.split('|') : [];
    const panel = () => findVisible(panelId);
    const targets = () => ids.map(findVisible).filter((el): el is HTMLElement => el !== null);

    // --- overlay: one SVG, dimmed except where the mask cuts holes ---
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '49',
      pointerEvents: 'none',
    });
    const maskId = `tour-mask-${Math.random().toString(36).slice(2)}`;
    const defs = document.createElementNS(SVG_NS, 'defs');
    const mask = document.createElementNS(SVG_NS, 'mask');
    mask.setAttribute('id', maskId);
    const base = document.createElementNS(SVG_NS, 'rect');
    Object.entries({ x: '0', y: '0', width: '100%', height: '100%', fill: 'white' }).forEach(
      ([k, v]) => base.setAttribute(k, v)
    );
    mask.appendChild(base);
    defs.appendChild(mask);
    const dim = document.createElementNS(SVG_NS, 'rect');
    Object.entries({
      x: '0',
      y: '0',
      width: '100%',
      height: '100%',
      fill: 'rgba(0, 18, 40, 0.55)',
      mask: `url(#${maskId})`,
    }).forEach(([k, v]) => dim.setAttribute(k, v));
    svg.append(defs, dim);

    // Same stacking context as the panel (inserted just before it), so the
    // panel (zIndex 50) stays above the dim (49).
    const anchor = panel();
    if (anchor?.parentElement) anchor.parentElement.insertBefore(svg, anchor);
    else document.body.appendChild(svg);

    const holes: SVGRectElement[] = [];
    const draw = () => {
      const found = targets();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      found.forEach((el, i) => {
        let hole = holes[i];
        if (!hole) {
          hole = document.createElementNS(SVG_NS, 'rect');
          hole.setAttribute('rx', '14');
          hole.setAttribute('fill', 'black');
          if (!reducedMotion) {
            hole.style.transition =
              'x 180ms ease, y 180ms ease, width 180ms ease, height 180ms ease';
          }
          mask.appendChild(hole);
          holes[i] = hole;
        }
        const r = el.getBoundingClientRect();
        const x = Math.max(0, r.left - PAD);
        const y = Math.max(0, r.top - PAD);
        const w = Math.max(0, Math.min(vw, r.right + PAD) - x);
        const h = Math.max(0, Math.min(vh, r.bottom + PAD) - y);
        hole.style.setProperty('x', `${x}px`);
        hole.style.setProperty('y', `${y}px`);
        hole.style.setProperty('width', `${w}px`);
        hole.style.setProperty('height', `${h}px`);
      });
      for (let i = found.length; i < holes.length; i++) holes[i].style.setProperty('width', '0px');
    };

    let frame = 0;
    const loop = () => {
      draw();
      frame = window.requestAnimationFrame(loop);
    };
    loop();

    // Bring a specific card into view (the whole-screen target needs no scroll).
    const scrollTimer = window.setTimeout(() => {
      const specific = targets().find((el) => el.id !== 'tour-screen' && !el.id.startsWith('nav-'));
      specific?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    }, 120);

    // --- interaction: only the targets and the panel ---
    const allowed = (node: EventTarget | null) => {
      if (!(node instanceof Node)) return false;
      if (panel()?.contains(node)) return true;
      return targets().some((el) => el.contains(node));
    };
    const block = (e: Event) => {
      if (allowed(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const focusables = () =>
      [panel(), ...targets()]
        .filter((el): el is HTMLElement => el !== null)
        .flatMap((el) => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)))
        .filter(isVisible);
    const onFocusIn = (e: FocusEvent) => {
      if (allowed(e.target)) return;
      e.stopPropagation();
      focusables()[0]?.focus();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      e.preventDefault();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? list[(index <= 0 ? list.length : index) - 1]
        : list[(index + 1) % list.length];
      next.focus();
    };

    BLOCKED_EVENTS.forEach((type) => window.addEventListener(type, block, true));
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(scrollTimer);
      BLOCKED_EVENTS.forEach((type) => window.removeEventListener(type, block, true));
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('keydown', onKeyDown, true);
      svg.remove();
    };
  }, [active, targetKey, panelId, reducedMotion]);
}

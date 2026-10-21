/* Phase artwork only: never changes Issue data, dates, progress or row heights. */
(() => {
  'use strict';
  const root = document.getElementById('timeline-view');
  const phases = window.DASHBOARD_CONFIG?.phases;
  if (!root || !Array.isArray(phases)) return;
  const outputs=Object.freeze(Object.fromEntries(
    phases.filter(phase=>phase.id!=='00').map(phase=>[phase.id,phase.deliverable||'단계 산출물'])
  ));
  let entries = [];
  let frame = 0;
  function positionIcons() {
    frame = 0;
    for (const {track, bar, marker} of entries) {
      const width = track.clientWidth;
      if (!width) continue;
      const size = marker.offsetWidth;
      const limit = Math.max(4, width - size - 4);
      let left = limit;
      if (bar) {
        bar.classList.remove('phase-bar--deliverable-inset');
        bar.style.removeProperty('--deliverable-inset');
        const start = parseFloat(bar.style.left) / 100 * width;
        const end = start + parseFloat(bar.style.width) / 100 * width;
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        left = Math.min(limit, Math.max(4, end + 6));
        if (left < end) {
          // At the final date, keep the icon inside the row without covering text.
          if (bar.offsetWidth >= size + 60) {
            bar.classList.add('phase-bar--deliverable-inset');
            bar.style.setProperty('--deliverable-inset', `${end - left + 8}px`);
          } else {
            // A very short bar at the right edge cannot hold both text and artwork.
            left = Math.min(limit, Math.max(4, start - size - 6));
          }
        }
      }
      marker.style.left = `${left}px`;
    }
  }
  function schedulePosition() {
    if (!frame) frame = requestAnimationFrame(positionIcons);
  }
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedulePosition) : null;
  function decorateTimeline() {
    resize?.disconnect();
    entries = [];
    for (const cell of root.querySelectorAll('.phase-cell[data-phase]')) {
      const id = cell.dataset.phase;
      const phase = phases.find(item => item.id === id);
      const track = cell.nextElementSibling;
      if (!Object.hasOwn(outputs, id) || !phase || !track?.classList.contains('gantt-track')) continue;
      const bar = track.querySelector('.phase-bar');
      let marker = track.querySelector('.phase-deliverable');
      if (!marker) {
        marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'phase-deliverable';
        marker.dataset.phase = id;
        const image = document.createElement('img');
        image.src = `./assets/timeline-icons/${id}.webp`;
        image.alt = '';
        image.width = 96;
        image.height = 96;
        image.draggable = false;
        image.decoding = 'async';
        marker.append(image);
        track.append(marker);
      }
      const expanded = cell.getAttribute('aria-expanded') === 'true';
      const note = bar ? '일정 막대 끝' : (track.querySelector('.gantt-unscheduled')?.textContent || '일정 미정');
      marker.dataset.placement = bar ? 'bar-end' : 'row-end';
      marker.title = `${phase.title} · 산출물: ${outputs[id]} · ${note}`;
      marker.setAttribute('aria-label', `${phase.title} 산출물: ${outputs[id]} · 단계 ${expanded ? '접기' : '펼치기'}`);
      marker.setAttribute('aria-expanded', String(expanded));
      entries.push({track, bar, marker});
      resize?.observe(track);
    }
    positionIcons();
  }
  // The main renderer replaces only root's direct children. Do not observe our
  // descendant artwork mutations, which would otherwise create an update loop.
  new MutationObserver(decorateTimeline).observe(root, {childList: true});
  window.addEventListener('resize', schedulePosition, {passive: true});
  decorateTimeline();
})();

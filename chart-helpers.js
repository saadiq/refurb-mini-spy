// Shared constants and helpers used across dashboard modules

const CHIP_ORDER = ['M4 Pro', 'M4', 'M2 Pro', 'M2', 'M1', 'Intel'];

const CHIP_COLORS = {
  'M4 Pro': '#2196f3',
  'M4': '#4caf50',
  'M2 Pro': '#e91e63',
  'M2': '#ff9800',
  'M1': '#9c27b0',
  'Intel': '#607d8b',
};

const ACTIVE_CHIPS = ['M4 Pro', 'M4', 'M2 Pro', 'M2'];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function freshnessInfo(lastSeen, today) {
  const days = daysBetween(lastSeen, today);
  if (days <= 0) return { label: 'In Stock', cls: 'fresh-now', days };
  if (days <= 3) return { label: `${days}d ago`, cls: 'fresh-recent', days };
  if (days <= 14) return { label: `${days}d ago`, cls: 'fresh-stale', days };
  return { label: `${days}d ago`, cls: 'fresh-old', days };
}

function availabilityPct(p) {
  if (!p.firstSeen || !p.lastSeen || !p.sightings) return 0;
  const span = daysBetween(p.firstSeen, p.lastSeen) + 1;
  if (span <= 0) return 100;
  return Math.min(100, Math.round((p.sightings.length / span) * 100));
}

function sparklineSVG(sightings, color) {
  if (!sightings || sightings.length < 2) return '';
  const prices = sightings.map(s => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 60, h = 20, pad = 2;
  const points = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
}

function configLabel(p) {
  return `${p.ram} / ${p.storage} / ${p.ethernet}`;
}

/**
 * Build a row of chip filter buttons that toggle a draw() callback.
 * @param {HTMLElement} container - Element to append buttons to
 * @param {string[]} chips - Chip names to show
 * @param {string} initialChip - Initially active chip
 * @param {function(string): void} onSelect - Callback when a chip is selected
 */
function buildChipFilterButtons(container, chips, initialChip, onSelect) {
  chips.forEach(chip => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn' + (chip === initialChip ? ' active' : '');
    btn.textContent = chip;
    btn.onclick = () => {
      container.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(chip);
    };
    container.appendChild(btn);
  });
}

function availabilityBarColor(avail) {
  if (avail > 50) return '#34c759';
  if (avail > 20) return '#ff9500';
  return '#ff3b30';
}

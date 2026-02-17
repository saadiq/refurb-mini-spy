// Main entry point — loads data and renders all dashboard sections.
// Shared helpers are in chart-helpers.js; Chart.js renderers are in charts.js.

fetch('data/refurb-history.json').then(r => r.json()).then(function (history) {
  const DATA = history.products;
  const today = history.collectedAt;

  document.getElementById('subtitle').textContent =
    `${DATA.length} products — updated ${today}`;

  DATA.forEach(p => { p._avail = availabilityPct(p); });

  renderCatalogCharts(DATA);
  renderConfigHeatmap(DATA);
  renderTable(DATA, today);
  renderTimeline(DATA, today);
  renderPriceHistory(DATA, today);
});

// --- Data table with sorting and chip filters ---

function renderTable(DATA, today) {
  const columns = [
    { key: 'chip', label: 'Chip' },
    { key: 'ref', label: 'Ref' },
    { key: 'ram', label: 'RAM' },
    { key: 'storage', label: 'Storage' },
    { key: 'ethernet', label: 'Network' },
    { key: 'refurbPrice', label: 'Refurb $' },
    { key: 'retailPrice', label: 'Retail $' },
    { key: 'discount', label: 'Savings' },
    { key: '_avail', label: 'Avail %' },
    { key: 'freshness', label: 'Status' },
    { key: 'sparkline', label: 'Price Trend' },
    { key: 'firstSeen', label: 'First Seen' },
    { key: 'lastSeen', label: 'Last Seen' },
  ];

  let activeFilter = 'All';
  let sortCol = 'refurbPrice';
  let sortAsc = true;

  function sortValue(p, col) {
    if (col === 'ram') return parseInt(p.ram) || 0;
    if (col === 'storage') {
      const n = parseInt(p.storage) || 0;
      return p.storage && p.storage.includes('TB') ? n * 1024 : n;
    }
    if (col === 'chip') return CHIP_ORDER.indexOf(p.chip);
    if (col === 'freshness') return freshnessInfo(p.lastSeen, today).days;
    return p[col];
  }

  function sortData(data) {
    return [...data].sort((a, b) => {
      let va = sortValue(a, sortCol);
      let vb = sortValue(b, sortCol);
      if (va == null) va = sortAsc ? Infinity : -Infinity;
      if (vb == null) vb = sortAsc ? Infinity : -Infinity;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
  }

  function renderTableRow(p) {
    const chipCls = 'chip-' + p.chip.replace(' ', '-');
    const fresh = freshnessInfo(p.lastSeen, today);
    const avail = p._avail;
    const barColor = availabilityBarColor(avail);
    const spark = sparklineSVG(p.sightings, CHIP_COLORS[p.chip] || '#999');
    const retailStr = p.retailPrice ? '$' + p.retailPrice.toLocaleString() : '—';
    const discountStr = p.discount
      ? `<span class="savings">-${Math.abs(p.discount).toFixed(1)}%</span>`
      : '—';

    return `<tr>
      <td><span class="chip-tag ${chipCls}">${p.chip}</span></td>
      <td>${p.ref}</td>
      <td>${p.ram || '—'}</td>
      <td>${p.storage}</td>
      <td>${p.ethernet}</td>
      <td>$${p.refurbPrice.toLocaleString()}</td>
      <td>${retailStr}</td>
      <td>${discountStr}</td>
      <td><span class="avail-bar"><span class="avail-bar-track"><span class="avail-bar-fill" style="width:${avail}%;background:${barColor}"></span></span>${avail}%</span></td>
      <td><span class="fresh-badge ${fresh.cls}">${fresh.label}</span></td>
      <td>${spark || '—'}</td>
      <td>${p.firstSeen || '—'}</td>
      <td>${p.lastSeen}</td>
    </tr>`;
  }

  function render() {
    const filtered = activeFilter === 'All'
      ? DATA
      : DATA.filter(p => p.chip === activeFilter);
    const sorted = sortData(filtered);

    const head = document.getElementById('tableHead');
    head.innerHTML = columns.map(c => {
      const arrow = sortCol === c.key ? (sortAsc ? ' ▲' : ' ▼') : '';
      return `<th data-col="${c.key}">${c.label}<span class="arrow">${arrow}</span></th>`;
    }).join('');

    head.querySelectorAll('th').forEach(th => {
      th.onclick = () => {
        const col = th.dataset.col;
        if (col === 'sparkline') return;
        if (sortCol === col) {
          sortAsc = !sortAsc;
        } else {
          sortCol = col;
          sortAsc = true;
        }
        render();
      };
    });

    document.getElementById('tableBody').innerHTML = sorted.map(renderTableRow).join('');
  }

  // Build chip filter buttons with SKU counts
  const skuCounts = {};
  CHIP_ORDER.forEach(c => skuCounts[c] = 0);
  DATA.forEach(p => skuCounts[p.chip] = (skuCounts[p.chip] || 0) + 1);

  const filtersEl = document.getElementById('filters');
  ['All', ...CHIP_ORDER].forEach(chip => {
    const count = chip === 'All' ? DATA.length : (skuCounts[chip] || 0);
    const btn = document.createElement('button');
    btn.className = 'chip-btn' + (chip === 'All' ? ' active' : '');
    btn.textContent = `${chip} (${count})`;
    btn.onclick = () => {
      activeFilter = chip;
      filtersEl.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    };
    filtersEl.appendChild(btn);
  });

  render();
}

// --- Availability timeline heatmap ---

function renderTimeline(DATA, today) {
  const container = document.getElementById('timelineContainer');
  let activeChip = ACTIVE_CHIPS[0];

  function draw() {
    const products = DATA
      .filter(p => p.chip === activeChip && p.sightings && p.sightings.length > 0)
      .sort((a, b) => a.refurbPrice - b.refurbPrice);

    if (products.length === 0) {
      container.innerHTML = '<p class="price-no-data">No sighting data for this chip.</p>';
      return;
    }

    const allDates = new Set();
    products.forEach(p => p.sightings.forEach(s => allDates.add(s.date)));
    const dates = [...allDates].sort();

    if (dates.length < 2) {
      container.innerHTML = '<p class="price-no-data">Only one date recorded so far. Timeline will populate as data accumulates.</p>';
      return;
    }

    const dateRange = buildDateRange(dates[0], dates[dates.length - 1]);
    const sightingSets = products.map(p => new Set(p.sightings.map(s => s.date)));
    const color = CHIP_COLORS[activeChip];
    const step = Math.max(1, Math.floor(dateRange.length / 30));

    let html = '<div class="timeline-grid"><table><thead><tr><th></th>';
    dateRange.forEach((d, i) => {
      const label = (i % step === 0) ? d.slice(5) : '';
      html += `<th title="${d}">${label}</th>`;
    });
    html += '</tr></thead><tbody>';

    products.forEach((p, pi) => {
      const sightSet = sightingSets[pi];
      html += `<tr><td class="tl-label" title="${p.ref}">${configLabel(p)} — $${p.refurbPrice}</td>`;
      dateRange.forEach(d => {
        const present = sightSet.has(d);
        const bg = present ? color : '#f0f0f0';
        const opacity = present ? '1' : '0.3';
        html += `<td class="tl-cell" style="background:${bg};opacity:${opacity}" title="${p.ref} — ${d}${present ? ' ✓' : ''}"></td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  buildChipFilterButtons(
    document.getElementById('timelineFilters'),
    ACTIVE_CHIPS,
    activeChip,
    chip => { activeChip = chip; draw(); }
  );
  draw();
}

// --- Price history line charts ---

function renderPriceHistory(DATA, today) {
  const container = document.getElementById('priceHistoryContainer');
  let activeChip = ACTIVE_CHIPS[0];

  function draw() {
    const products = DATA
      .filter(p => p.chip === activeChip && p.sightings && p.sightings.length >= 2)
      .sort((a, b) => a.refurbPrice - b.refurbPrice);

    if (products.length === 0) {
      container.innerHTML = '<p class="price-no-data">No price changes recorded yet. Charts appear once configs have sightings on multiple days.</p>';
      return;
    }

    container.innerHTML = '';
    const color = CHIP_COLORS[activeChip];

    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'price-card';
      card.innerHTML = `<h3>${p.ref} — ${configLabel(p)}</h3><canvas></canvas>`;
      container.appendChild(card);

      new Chart(card.querySelector('canvas'), {
        type: 'line',
        data: {
          labels: p.sightings.map(s => s.date),
          datasets: [{
            data: p.sightings.map(s => s.price),
            borderColor: color,
            backgroundColor: color + '22',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: color,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `$${ctx.raw.toLocaleString()}` } },
          },
          scales: {
            x: { ticks: { maxTicksLimit: 10, font: { size: 10 } } },
            y: { ticks: { callback: v => '$' + v.toLocaleString() }, beginAtZero: false },
          },
        },
      });
    });
  }

  buildChipFilterButtons(
    document.getElementById('priceHistoryFilters'),
    ACTIVE_CHIPS,
    activeChip,
    chip => { activeChip = chip; draw(); }
  );
  draw();
}

// --- Utility: fill all dates between start and end ---

function buildDateRange(startStr, endStr) {
  const range = [];
  const end = new Date(endStr);
  for (let d = new Date(startStr); d <= end; d.setDate(d.getDate() + 1)) {
    range.push(d.toISOString().slice(0, 10));
  }
  return range;
}

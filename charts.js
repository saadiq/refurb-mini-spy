// Chart.js catalog charts and configuration heatmap

function renderCatalogCharts(DATA) {
  renderSkuChart(DATA);
  renderPriceRangeChart(DATA);
  renderRamChart(DATA);
  renderStorageChart(DATA);
}

function renderSkuChart(DATA) {
  const skuCounts = {};
  CHIP_ORDER.forEach(c => skuCounts[c] = 0);
  DATA.forEach(p => skuCounts[p.chip] = (skuCounts[p.chip] || 0) + 1);

  new Chart(document.getElementById('skuChart'), {
    type: 'bar',
    data: {
      labels: CHIP_ORDER,
      datasets: [{
        data: CHIP_ORDER.map(c => skuCounts[c]),
        backgroundColor: CHIP_ORDER.map(c => CHIP_COLORS[c]),
        borderRadius: 6,
        barPercentage: 0.7,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.raw} SKUs` } },
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Distinct SKUs' } },
      },
    },
  });
}

function renderPriceRangeChart(DATA) {
  const stats = {};
  CHIP_ORDER.forEach(c => stats[c] = { min: Infinity, max: -Infinity, sum: 0, count: 0 });
  DATA.forEach(p => {
    const s = stats[p.chip];
    if (!s) return;
    s.min = Math.min(s.min, p.refurbPrice);
    s.max = Math.max(s.max, p.refurbPrice);
    s.sum += p.refurbPrice;
    s.count++;
  });

  function priceData(label, valueFn, opacity) {
    return {
      label,
      data: CHIP_ORDER.map(c => valueFn(stats[c])),
      backgroundColor: CHIP_ORDER.map(c => CHIP_COLORS[c] + opacity),
      borderRadius: 6,
      barPercentage: 0.7,
    };
  }

  new Chart(document.getElementById('priceChart'), {
    type: 'bar',
    data: {
      labels: CHIP_ORDER,
      datasets: [
        priceData('Min', s => s.min === Infinity ? 0 : s.min, '66'),
        priceData('Avg', s => s.count ? Math.round(s.sum / s.count) : 0, 'aa'),
        priceData('Max', s => s.max === -Infinity ? 0 : s.max, ''),
      ],
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: $${ctx.raw.toLocaleString()}` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => '$' + v.toLocaleString() },
        },
      },
    },
  });
}

function buildDistribution(DATA, field, order) {
  const dist = {};
  ACTIVE_CHIPS.forEach(c => {
    dist[c] = {};
    order.forEach(v => dist[c][v] = 0);
  });
  DATA.forEach(p => {
    if (dist[p.chip]) {
      const v = p[field];
      if (order.includes(v)) dist[p.chip][v]++;
    }
  });
  return dist;
}

function renderStackedDistChart(canvasId, DATA, field, order, colors) {
  const dist = buildDistribution(DATA, field, order);

  new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels: ACTIVE_CHIPS,
      datasets: order.map((val, i) => ({
        label: val,
        data: ACTIVE_CHIPS.map(c => dist[c][val] || 0),
        backgroundColor: colors[i],
        borderRadius: 2,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw} SKUs` } },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'SKUs' } },
      },
    },
  });
}

function renderRamChart(DATA) {
  const RAM_ORDER = ['8GB', '16GB', '24GB', '32GB', '48GB', '64GB'];
  const RAM_COLORS = ['#ffcdd2', '#ef9a9a', '#ef5350', '#e53935', '#c62828', '#b71c1c'];
  renderStackedDistChart('ramChart', DATA, 'ram', RAM_ORDER, RAM_COLORS);
}

function renderStorageChart(DATA) {
  const STOR_ORDER = ['256GB', '512GB', '1TB', '2TB', '4TB', '8TB'];
  const STOR_COLORS = ['#bbdefb', '#64b5f6', '#2196f3', '#1976d2', '#0d47a1', '#01579b'];
  renderStackedDistChart('storageChart', DATA, 'storage', STOR_ORDER, STOR_COLORS);
}

function renderConfigHeatmap(DATA) {
  const container = document.getElementById('heatmapContainer');
  const html = ['<div class="heatmap">'];

  ACTIVE_CHIPS.forEach(chip => {
    const products = DATA.filter(p => p.chip === chip);
    const rams = [...new Set(products.map(p => p.ram))]
      .filter(Boolean)
      .sort((a, b) => parseInt(a) - parseInt(b));
    const storages = [...new Set(products.map(p => p.storage))].sort((a, b) => {
      const na = parseInt(a) * (a.includes('TB') ? 1024 : 1);
      const nb = parseInt(b) * (b.includes('TB') ? 1024 : 1);
      return na - nb;
    });

    const counts = {};
    products.forEach(p => {
      const k = `${p.ram}|${p.storage}`;
      counts[k] = (counts[k] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts), 1);

    html.push(`<div class="heatmap-chip">`);
    html.push(`<h3>${chip} <span style="color:#86868b;font-weight:400">(${products.length} SKUs)</span></h3>`);
    html.push(`<div class="hm-grid" style="grid-template-columns: auto repeat(${storages.length}, 1fr)">`);
    html.push('<div class="hm-cell hm-header"></div>');
    storages.forEach(s => html.push(`<div class="hm-cell hm-header">${s}</div>`));

    rams.forEach(ram => {
      html.push(`<div class="hm-cell hm-row-label">${ram}</div>`);
      storages.forEach(stor => {
        const count = counts[`${ram}|${stor}`] || 0;
        if (count > 0) {
          const opacity = 0.25 + 0.75 * (count / maxCount);
          html.push(`<div class="hm-cell" style="background:${CHIP_COLORS[chip]};opacity:${opacity.toFixed(2)};color:#fff;font-weight:600">${count}</div>`);
        } else {
          html.push('<div class="hm-cell hm-empty">-</div>');
        }
      });
    });

    html.push('</div></div>');
  });

  html.push('</div>');
  container.innerHTML = html.join('');
}

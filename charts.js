// Temporal insight charts and configuration heatmap

function renderCatalogCharts(DATA) {
  renderStockVolumeChart(DATA);
  renderNewSkuChart(DATA);
  renderChipTimelineChart(DATA);
  renderScrapeCalendar(DATA);
}

function formatDateLabel(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${parseInt(d)}`;
}

function renderStockVolumeChart(DATA) {
  const dateCounts = {};
  DATA.forEach(p => {
    if (!p.sightings) return;
    p.sightings.forEach(s => {
      if (!dateCounts[s.date]) dateCounts[s.date] = {};
      dateCounts[s.date][p.chip] = (dateCounts[s.date][p.chip] || 0) + 1;
    });
  });

  const dates = Object.keys(dateCounts).sort();
  const datasets = CHIP_ORDER
    .filter(chip => dates.some(d => dateCounts[d][chip]))
    .map(chip => ({
      label: chip,
      data: dates.map(d => dateCounts[d][chip] || 0),
      backgroundColor: CHIP_COLORS[chip],
      borderRadius: 2,
    }));

  new Chart(document.getElementById('stockVolumeChart'), {
    type: 'bar',
    data: { labels: dates.map(formatDateLabel), datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } },
        tooltip: {
          callbacks: {
            title: ctx => dates[ctx[0].dataIndex],
            label: ctx => `${ctx.dataset.label}: ${ctx.raw} products`,
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { maxTicksLimit: 15, font: { size: 10 } } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Products in stock' } },
      },
    },
  });
}

function renderNewSkuChart(DATA) {
  const monthCounts = {};
  DATA.forEach(p => {
    if (!p.firstSeen) return;
    const month = p.firstSeen.slice(0, 7);
    if (!monthCounts[month]) monthCounts[month] = {};
    monthCounts[month][p.chip] = (monthCounts[month][p.chip] || 0) + 1;
  });

  const months = Object.keys(monthCounts).sort();
  const monthLabels = months.map(m => {
    const [y, mo] = m.split('-');
    return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`;
  });

  const datasets = CHIP_ORDER
    .filter(chip => months.some(m => monthCounts[m][chip]))
    .map(chip => ({
      label: chip,
      data: months.map(m => monthCounts[m][chip] || 0),
      backgroundColor: CHIP_COLORS[chip],
      borderRadius: 2,
    }));

  new Chart(document.getElementById('newSkuChart'), {
    type: 'bar',
    data: { labels: monthLabels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } },
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw} new SKUs` },
        },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'New SKUs' } },
      },
    },
  });
}

function renderChipTimelineChart(DATA) {
  const chipRanges = {};
  DATA.forEach(p => {
    if (!p.firstSeen || !p.lastSeen) return;
    if (!chipRanges[p.chip]) {
      chipRanges[p.chip] = { min: p.firstSeen, max: p.lastSeen };
    } else {
      if (p.firstSeen < chipRanges[p.chip].min) chipRanges[p.chip].min = p.firstSeen;
      if (p.lastSeen > chipRanges[p.chip].max) chipRanges[p.chip].max = p.lastSeen;
    }
  });

  const chips = CHIP_ORDER.filter(c => chipRanges[c]);
  const labels = chips.slice().reverse();

  const allMins = labels.map(c => new Date(chipRanges[c].min).getTime());
  const allMaxs = labels.map(c => new Date(chipRanges[c].max).getTime());
  const axisMin = Math.min(...allMins);
  const axisMax = Math.max(...allMaxs);
  const pad = (axisMax - axisMin) * 0.05 || 86400000;

  new Chart(document.getElementById('chipTimelineChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: labels.map(c => [new Date(chipRanges[c].min).getTime(), new Date(chipRanges[c].max).getTime()]),
        backgroundColor: labels.map(c => CHIP_COLORS[c]),
        borderRadius: 4,
        barPercentage: 0.6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const [start, end] = ctx.raw;
              const fmt = ts => new Date(ts).toISOString().slice(0, 10);
              return `${fmt(start)} → ${fmt(end)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          min: axisMin - pad,
          max: axisMax + pad,
          time: { unit: 'month', tooltipFormat: 'MMM yyyy' },
          title: { display: true, text: 'Date' },
        },
        y: { grid: { display: false } },
      },
    },
  });
}

function renderScrapeCalendar(DATA) {
  const container = document.getElementById('scrapeCalendarContainer');
  const dateCounts = {};
  DATA.forEach(p => {
    if (!p.sightings) return;
    p.sightings.forEach(s => {
      dateCounts[s.date] = (dateCounts[s.date] || 0) + 1;
    });
  });

  const allDates = Object.keys(dateCounts).sort();
  if (allDates.length === 0) {
    container.innerHTML = '<p class="price-no-data">No scrape data available.</p>';
    return;
  }

  const maxCount = Math.max(...Object.values(dateCounts));
  const startDate = new Date(allDates[0]);
  const endDate = new Date(allDates[allDates.length - 1]);

  // Collect months between start and end
  const months = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cur <= last) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }

  const html = ['<div class="scrape-calendar">'];

  // Header row: month labels
  html.push('<div class="sc-row sc-header">');
  html.push('<div class="sc-day-label"></div>');
  months.forEach(m => {
    const label = months.length > 12
      ? MONTH_NAMES[m.month].charAt(0)
      : `${MONTH_NAMES[m.month]} ${String(m.year).slice(2)}`;
    html.push(`<div class="sc-month-label">${label}</div>`);
  });
  html.push('</div>');

  function calendarCell(m, day) {
    const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
    if (day > daysInMonth) return '<div class="sc-cell sc-na"></div>';

    const dateStr = `${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = dateCounts[dateStr] || 0;
    if (count === 0) return `<div class="sc-cell sc-empty" title="${dateStr}: no data"></div>`;

    const intensity = (0.2 + 0.8 * (count / maxCount)).toFixed(2);
    return `<div class="sc-cell" style="background:rgba(33,150,243,${intensity})" title="${dateStr}: ${count} products"></div>`;
  }

  // Rows for days 1-31
  for (let day = 1; day <= 31; day++) {
    html.push('<div class="sc-row">');
    html.push(`<div class="sc-day-label">${day}</div>`);
    months.forEach(m => html.push(calendarCell(m, day)));
    html.push('</div>');
  }

  html.push('</div>');
  container.innerHTML = html.join('');
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

    const configDays = {};
    products.forEach(p => {
      const k = `${p.ram}|${p.storage}`;
      if (!configDays[k]) configDays[k] = new Set();
      if (p.sightings) p.sightings.forEach(s => configDays[k].add(s.date));
    });
    const counts = Object.fromEntries(
      Object.entries(configDays).map(([k, days]) => [k, days.size])
    );
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

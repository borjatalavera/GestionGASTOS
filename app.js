/* ============================================
   GASTOS DEL HOGAR — App Logic
   ============================================ */

// ——— DATA LAYER ———
const STORAGE_KEY = 'gastos_hogar_db';

function getGastos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveGastos(gastos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gastos));
}

function addGasto(gasto) {
  const gastos = getGastos();
  gasto.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  gasto.fecha = new Date().toISOString();
  gastos.unshift(gasto); // newest first
  saveGastos(gastos);
  return gasto;
}

function deleteGasto(id) {
  const gastos = getGastos().filter(g => g.id !== id);
  saveGastos(gastos);
}

// ——— HELPERS ———
function formatMoney(n) {
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getMonthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function getMonthLabel(key) {
  const [y, m] = key.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function getUniqueValues(gastos, field) {
  return [...new Set(gastos.map(g => g[field]).filter(Boolean))].sort();
}

function getUniqueMonths(gastos) {
  return [...new Set(gastos.map(g => getMonthKey(g.fecha)))].sort().reverse();
}

// ——— DOM REFS ———
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const formGasto = $('#form-gasto');
const inputMonto = $('#input-monto');
const inputTarjeta = $('#input-tarjeta');
const inputDesc = $('#input-desc');
const inputNota = $('#input-nota');
const inputResponsable = $('#input-responsable');
const chipGroupTarjeta = $('#chip-group-tarjeta');
const chipGroupResp = $('#chip-group-responsable');
const listaGastos = $('#lista-gastos');
const toast = $('#toast');

// Resumen
const filterMes = $('#filter-mes');
const filterTarjeta = $('#filter-tarjeta');
const filterResponsable = $('#filter-responsable');
const resumenTotal = $('#resumen-total');
const resumenTarjetas = $('#resumen-tarjetas');
const resumenResponsables = $('#resumen-responsables');
const resumenCantidad = $('#resumen-cantidad');
const btnExportar = $('#btn-exportar');

// Historial date filters
const filterDesde = $('#filter-desde');
const filterHasta = $('#filter-hasta');
const btnClearDates = $('#btn-clear-dates');
const dateShortcuts = $$('.date-shortcut');

// Modal
const modalDelete = $('#modal-delete');
const modalCancel = $('#modal-cancel');
const modalConfirm = $('#modal-confirm');
let pendingDeleteId = null;

// ——— TABS ———
const tabBtns = $$('.tab-btn');
const tabPanels = $$('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#${target}`).classList.add('active');
    // Re-render relevant tab
    if (target === 'tab-historial') renderHistorial();
    if (target === 'tab-fijos') renderFijos();
    if (target === 'tab-resumen') renderResumen();
  });
});

// ——— CHIPS (quick-select for tarjeta & responsable) ———
function renderChips() {
  const gastos = getGastos();
  const tarjetas = getUniqueValues(gastos, 'tarjeta');
  const responsables = getUniqueValues(gastos, 'responsable');

  chipGroupTarjeta.innerHTML = tarjetas.map(t =>
    `<button type="button" class="chip" data-value="${t}">${t}</button>`
  ).join('');

  chipGroupResp.innerHTML = responsables.map(r =>
    `<button type="button" class="chip" data-value="${r}">${r}</button>`
  ).join('');

  // Chip click handlers
  chipGroupTarjeta.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      // Toggle: if already selected, deselect
      const isSelected = chip.classList.contains('selected');
      chipGroupTarjeta.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      if (!isSelected) {
        chip.classList.add('selected');
        inputTarjeta.value = chip.dataset.value;
      } else {
        inputTarjeta.value = '';
      }
    });
  });

  chipGroupResp.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const isSelected = chip.classList.contains('selected');
      chipGroupResp.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      if (!isSelected) {
        chip.classList.add('selected');
        inputResponsable.value = chip.dataset.value;
      } else {
        inputResponsable.value = '';
      }
    });
  });
}

// ——— FORM SUBMISSION ———
formGasto.addEventListener('submit', (e) => {
  e.preventDefault();

  const monto = parseFloat(inputMonto.value);
  if (isNaN(monto) || monto <= 0) return;

  const tarjeta = inputTarjeta.value.trim();
  if (!tarjeta) {
    inputTarjeta.focus();
    return;
  }

  const gasto = {
    monto,
    tarjeta,
    descripcion: inputDesc.value.trim(),
    nota: inputNota.value.trim() || null,
    responsable: inputResponsable.value.trim() || null
  };

  addGasto(gasto);

  // Reset form
  formGasto.reset();
  chipGroupTarjeta.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  chipGroupResp.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  inputMonto.focus();

  // Refresh chips (in case new tarjeta/responsable was entered)
  renderChips();

  // Show toast
  showToast(`✓ Gasto de ${formatMoney(monto)} guardado`);
});

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ——— HELPER: get local date string (YYYY-MM-DD) from ISO ———
function getLocalDateStr(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ——— HISTORIAL ———
function renderHistorial() {
  const gastos = getGastos();
  const desde = filterDesde.value; // YYYY-MM-DD or ""
  const hasta = filterHasta.value;

  let filtered = gastos;

  if (desde) {
    filtered = filtered.filter(g => getLocalDateStr(g.fecha) >= desde);
  }
  if (hasta) {
    filtered = filtered.filter(g => getLocalDateStr(g.fecha) <= hasta);
  }

  if (filtered.length === 0) {
    listaGastos.innerHTML = '<p class="empty-state">No hay gastos para mostrar.</p>';
    return;
  }

  listaGastos.innerHTML = filtered.map(g => {
    const responsableTag = g.responsable
      ? `<span class="gasto-tag">${g.responsable}</span>`
      : '';
    const notaInfo = g.nota ? ` · ${g.nota}` : '';
    return `
      <div class="gasto-item" data-id="${g.id}">
        <span class="gasto-icon">🧾</span>
        <div class="gasto-info">
          <div class="gasto-desc">${g.descripcion}</div>
          <div class="gasto-meta">${formatDate(g.fecha)} · ${g.tarjeta}${responsableTag}${notaInfo}</div>
        </div>
        <span class="gasto-amount">${formatMoney(g.monto)}</span>
        <button class="gasto-delete" data-id="${g.id}" aria-label="Eliminar gasto">🗑️</button>
      </div>
    `;
  }).join('');

  // Delete buttons
  listaGastos.querySelectorAll('.gasto-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingDeleteId = btn.dataset.id;
      modalDelete.hidden = false;
    });
  });
}

// Date filter listeners
filterDesde.addEventListener('change', renderHistorial);
filterHasta.addEventListener('change', renderHistorial);

// Clear dates
btnClearDates.addEventListener('click', () => {
  filterDesde.value = '';
  filterHasta.value = '';
  dateShortcuts.forEach(s => s.classList.remove('selected'));
  renderHistorial();
});

// Date shortcuts
dateShortcuts.forEach(btn => {
  btn.addEventListener('click', () => {
    dateShortcuts.forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');

    const today = new Date();
    const todayStr = getLocalDateStr(today.toISOString());

    switch (btn.dataset.range) {
      case 'today':
        filterDesde.value = todayStr;
        filterHasta.value = todayStr;
        break;
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filterDesde.value = getLocalDateStr(weekAgo.toISOString());
        filterHasta.value = todayStr;
        break;
      }
      case 'month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        filterDesde.value = getLocalDateStr(firstDay.toISOString());
        filterHasta.value = todayStr;
        break;
      }
      case 'all':
        filterDesde.value = '';
        filterHasta.value = '';
        break;
    }
    renderHistorial();
  });
});

// ——— DELETE MODAL ———
modalCancel.addEventListener('click', () => {
  modalDelete.hidden = true;
  pendingDeleteId = null;
});
modalConfirm.addEventListener('click', () => {
  if (pendingDeleteId) {
    deleteGasto(pendingDeleteId);
    pendingDeleteId = null;
    modalDelete.hidden = true;
    renderHistorial();
    renderChips();
    showToast('Gasto eliminado');
  }
});

// ——— RESUMEN ———
function renderResumen() {
  const gastos = getGastos();
  const meses = getUniqueMonths(gastos);
  const tarjetas = getUniqueValues(gastos, 'tarjeta');
  const responsables = getUniqueValues(gastos, 'responsable');

  // Populate filters (preserve selection if possible)
  const prevMes = filterMes.value;
  const prevTarj = filterTarjeta.value;
  const prevResp = filterResponsable.value;

  filterMes.innerHTML = '<option value="todos">Todos los meses</option>' +
    meses.map(m => `<option value="${m}"${m === prevMes ? ' selected' : ''}>${getMonthLabel(m)}</option>`).join('');

  filterTarjeta.innerHTML = '<option value="todas">Todas las tarjetas</option>' +
    tarjetas.map(t => `<option value="${t}"${t === prevTarj ? ' selected' : ''}>${t}</option>`).join('');

  filterResponsable.innerHTML = '<option value="todos">Todos</option>' +
    responsables.map(r => `<option value="${r}"${r === prevResp ? ' selected' : ''}>${r}</option>`).join('');

  // Apply filters
  let filtered = gastos;
  if (filterMes.value !== 'todos') {
    filtered = filtered.filter(g => getMonthKey(g.fecha) === filterMes.value);
  }
  if (filterTarjeta.value !== 'todas') {
    filtered = filtered.filter(g => g.tarjeta === filterTarjeta.value);
  }
  if (filterResponsable.value !== 'todos') {
    filtered = filtered.filter(g => g.responsable === filterResponsable.value);
  }

  // Total
  const total = filtered.reduce((sum, g) => sum + g.monto, 0);
  resumenTotal.textContent = formatMoney(total);

  // Desglose por tarjeta
  const byTarjeta = {};
  filtered.forEach(g => {
    byTarjeta[g.tarjeta] = (byTarjeta[g.tarjeta] || 0) + g.monto;
  });
  resumenTarjetas.innerHTML = Object.keys(byTarjeta).length > 0
    ? '<div class="breakdown-title" style="font-size:.78rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:6px;padding-left:4px;">Por Tarjeta</div>' +
    Object.entries(byTarjeta).sort((a, b) => b[1] - a[1]).map(([name, val]) =>
      `<div class="breakdown-item">
          <span class="breakdown-name">💳 ${name}</span>
          <span class="breakdown-value">${formatMoney(val)}</span>
        </div>`
    ).join('')
    : '';

  // Desglose por responsable (solo si hay gastos con responsable)
  const byResp = {};
  filtered.forEach(g => {
    if (g.responsable) byResp[g.responsable] = (byResp[g.responsable] || 0) + g.monto;
  });
  resumenResponsables.innerHTML = Object.keys(byResp).length > 0
    ? '<div class="breakdown-title" style="font-size:.78rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:6px;margin-top:8px;padding-left:4px;">Por Persona</div>' +
    Object.entries(byResp).sort((a, b) => b[1] - a[1]).map(([name, val]) =>
      `<div class="breakdown-item">
          <span class="breakdown-name">👤 ${name}</span>
          <span class="breakdown-value">${formatMoney(val)}</span>
        </div>`
    ).join('')
    : '';

  // Cantidad
  resumenCantidad.textContent = filtered.length > 0
    ? `${filtered.length} gasto${filtered.length !== 1 ? 's' : ''} registrado${filtered.length !== 1 ? 's' : ''}`
    : 'Sin gastos para estos filtros.';
}

filterMes.addEventListener('change', renderResumen);
filterTarjeta.addEventListener('change', renderResumen);
filterResponsable.addEventListener('change', renderResumen);

// ——— EXPORTAR CSV ———
btnExportar.addEventListener('click', () => {
  const gastos = getGastos();
  if (gastos.length === 0) {
    showToast('No hay gastos para exportar');
    return;
  }

  // Apply same filters as resumen
  let filtered = gastos;
  if (filterMes.value !== 'todos') {
    filtered = filtered.filter(g => getMonthKey(g.fecha) === filterMes.value);
  }
  if (filterTarjeta.value !== 'todas') {
    filtered = filtered.filter(g => g.tarjeta === filterTarjeta.value);
  }
  if (filterResponsable.value !== 'todos') {
    filtered = filtered.filter(g => g.responsable === filterResponsable.value);
  }

  const header = 'Fecha,Monto,Tarjeta,Descripción,Nota,Responsable\n';
  const rows = filtered.map(g =>
    `"${formatDate(g.fecha)}","${g.monto}","${g.tarjeta}","${g.descripcion}","${g.nota || ''}","${g.responsable || ''}"`
  ).join('\n');

  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gastos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV descargado');
});

// ——— COMPARTIR / EXPORTAR PDF ———
const btnExportarPdf = $('#btn-exportar-pdf');

btnExportarPdf.addEventListener('click', () => {
  const gastos = getGastos();
  if (gastos.length === 0) {
    showToast('No hay gastos para compartir');
    return;
  }

  // Apply same filters as resumen
  let filtered = gastos;
  if (filterMes.value !== 'todos') {
    filtered = filtered.filter(g => getMonthKey(g.fecha) === filterMes.value);
  }
  if (filterTarjeta.value !== 'todas') {
    filtered = filtered.filter(g => g.tarjeta === filterTarjeta.value);
  }
  if (filterResponsable.value !== 'todos') {
    filtered = filtered.filter(g => g.responsable === filterResponsable.value);
  }

  if (filtered.length === 0) {
    showToast('No hay gastos con esos filtros');
    return;
  }

  // Calculate summary
  const total = filtered.reduce((sum, g) => sum + g.monto, 0);
  const byTarjeta = {};
  const byResp = {};
  filtered.forEach(g => {
    byTarjeta[g.tarjeta] = (byTarjeta[g.tarjeta] || 0) + g.monto;
    if (g.responsable) byResp[g.responsable] = (byResp[g.responsable] || 0) + g.monto;
  });

  // Build filter description
  const filterParts = [];
  if (filterMes.value !== 'todos') filterParts.push(getMonthLabel(filterMes.value));
  if (filterTarjeta.value !== 'todas') filterParts.push('Tarjeta: ' + filterTarjeta.value);
  if (filterResponsable.value !== 'todos') filterParts.push(filterResponsable.value);
  const subtitle = filterParts.length > 0 ? filterParts.join(' · ') : 'Todos los gastos';

  // Build tarjeta rows
  const tarjetaRows = Object.entries(byTarjeta).sort((a, b) => b[1] - a[1]).map(([name, val]) =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">💳 ${name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatMoney(val)}</td></tr>`
  ).join('');

  // Build responsable rows
  const respRows = Object.entries(byResp).sort((a, b) => b[1] - a[1]).map(([name, val]) =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">👤 ${name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatMoney(val)}</td></tr>`
  ).join('');

  // Build expense rows
  const expenseRows = filtered.map(g =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${formatDate(g.fecha)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${g.descripcion}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${g.tarjeta}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${g.responsable || '-'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-weight:600;">${formatMoney(g.monto)}</td>
    </tr>`
  ).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gastos - ${subtitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #222; padding: 20px; max-width: 700px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header p { font-size: 13px; color: #888; }
    .total-box { background: #f4f2ff; border: 2px solid #7c6aff; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .total-box .amount { font-size: 28px; font-weight: 800; color: #7c6aff; }
    .total-box .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .section-title { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin: 16px 0 8px 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #7c6aff; color: #fff; padding: 8px; font-size: 12px; text-align: left; }
    th:last-child { text-align: right; }
    .footer { text-align: center; font-size: 11px; color: #aaa; margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; }
    .print-btn { display: block; width: 100%; padding: 14px; margin-top: 20px; font-size: 16px; font-weight: 700; color: #fff; background: #7c6aff; border: none; border-radius: 10px; cursor: pointer; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>💰 Gastos del Hogar</h1>
    <p>${subtitle}</p>
  </div>

  <div class="total-box">
    <div class="label">Total</div>
    <div class="amount">${formatMoney(total)}</div>
  </div>

  ${tarjetaRows ? `
    <div class="section-title">Por Tarjeta</div>
    <table>${tarjetaRows}</table>
  ` : ''}

  ${respRows ? `
    <div class="section-title">Por Persona</div>
    <table>${respRows}</table>
  ` : ''}

  <div class="section-title">Detalle de Gastos (${filtered.length})</div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Descripción</th>
        <th>Tarjeta</th>
        <th>Quién</th>
        <th style="text-align:right;">Monto</th>
      </tr>
    </thead>
    <tbody>${expenseRows}</tbody>
  </table>

  <div class="footer">Generado el ${new Date().toLocaleDateString('es-AR')}</div>

  <button class="print-btn no-print" onclick="window.print()">📤 Guardar PDF / Compartir</button>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    showToast('Permití las ventanas emergentes');
  }
});

// ——— IMPORTAR ARCHIVO DEL BANCO ———
const btnImportar = $('#btn-importar');
const inputFileImport = $('#input-file-import');
const modalImport = $('#modal-import');
const importColMonto = $('#import-col-monto');
const importColDesc = $('#import-col-desc');
const importColFecha = $('#import-col-fecha');
const importTarjeta = $('#import-tarjeta');
const importPreview = $('#import-preview');
const importCancel = $('#import-cancel');
const importConfirm = $('#import-confirm');
const importStepConfig = $('#import-step-config');
const importStepResult = $('#import-step-result');
const importResultText = $('#import-result-text');
const importDone = $('#import-done');

let importedRows = []; // parsed rows from file
let importedHeaders = []; // column headers

btnImportar.addEventListener('click', () => {
  inputFileImport.value = '';
  inputFileImport.click();
});

inputFileImport.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (json.length < 2) {
        showToast('El archivo está vacío o no tiene datos');
        return;
      }

      // First row as headers, rest as data
      importedHeaders = json[0].map((h, i) => String(h || `Columna ${i + 1}`).trim());
      importedRows = json.slice(1).filter(row => row.some(cell => cell !== ''));

      if (importedRows.length === 0) {
        showToast('No se encontraron filas con datos');
        return;
      }

      openImportModal();
    } catch (err) {
      showToast('Error al leer el archivo');
      console.error('Import error:', err);
    }
  };
  reader.readAsArrayBuffer(file);
});

function openImportModal() {
  // Reset modal state
  importStepConfig.hidden = false;
  importStepResult.hidden = true;

  // Populate column selectors
  const options = importedHeaders.map((h, i) => `<option value="${i}">${h}</option>`).join('');

  importColMonto.innerHTML = options;
  importColDesc.innerHTML = options;
  importColFecha.innerHTML = `<option value="_none">No importar (usar fecha de hoy)</option>${options}`;

  // Auto-detect columns by header name
  autoSelectColumn(importColMonto, ['monto', 'importe', 'amount', 'total', 'valor', 'débito', 'debito', 'cargo', 'pesos']);
  autoSelectColumn(importColDesc, ['descripcion', 'descripción', 'concepto', 'detalle', 'description', 'comercio', 'referencia', 'movimiento']);
  autoSelectColumn(importColFecha, ['fecha', 'date', 'dia', 'día', 'fec']);

  // Pre-fill tarjeta from known tarjetas
  const gastos = getGastos();
  const tarjetas = getUniqueValues(gastos, 'tarjeta');
  importTarjeta.value = tarjetas.length > 0 ? tarjetas[0] : '';

  // Render preview
  renderImportPreview();

  // Show modal
  modalImport.hidden = false;
}

function autoSelectColumn(selectEl, keywords) {
  for (let i = 0; i < importedHeaders.length; i++) {
    const header = importedHeaders[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const kw of keywords) {
      if (header.includes(kw)) {
        selectEl.value = String(i);
        return;
      }
    }
  }
}

function renderImportPreview() {
  const montoIdx = parseInt(importColMonto.value);
  const descIdx = parseInt(importColDesc.value);
  const fechaIdx = importColFecha.value !== '_none' ? parseInt(importColFecha.value) : null;

  const previewCount = Math.min(importedRows.length, 5);
  const previewRows = importedRows.slice(0, previewCount);

  let html = `<p class="preview-label">Vista previa (${previewCount} de ${importedRows.length} filas):</p>`;
  html += '<table><thead><tr>';
  if (fechaIdx !== null) html += '<th>Fecha</th>';
  html += '<th>Descripción</th><th>Monto</th></tr></thead><tbody>';

  previewRows.forEach(row => {
    const monto = parseMonto(row[montoIdx]);
    const desc = String(row[descIdx] || '');
    const fecha = fechaIdx !== null ? formatImportDate(row[fechaIdx]) : 'Hoy';
    html += '<tr>';
    if (fechaIdx !== null) html += `<td>${fecha}</td>`;
    html += `<td>${desc}</td><td>${monto !== null ? formatMoney(monto) : '⚠️'}</td></tr>`;
  });

  html += '</tbody></table>';
  importPreview.innerHTML = html;
}

// Update preview when column selectors change
importColMonto.addEventListener('change', renderImportPreview);
importColDesc.addEventListener('change', renderImportPreview);
importColFecha.addEventListener('change', renderImportPreview);

function parseMonto(val) {
  if (val === null || val === undefined || val === '') return null;
  // If it's already a number
  if (typeof val === 'number') return Math.abs(val);
  // Clean string: remove currency symbols, spaces, and handle Argentine format
  let str = String(val).trim();
  str = str.replace(/[$ ARS]/gi, '').replace(/\s/g, '');
  // Handle negative (enclosed in parens or with minus)
  const isNeg = str.startsWith('-') || str.startsWith('(');
  str = str.replace(/[()\\-]/g, '');
  // Argentine format: 1.234,56 → 1234.56
  if (str.includes(',') && str.includes('.')) {
    // Determine which is decimal separator
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // 1.234,56 → Argentine
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 → US
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Could be "1234,56" (decimal comma) or "1,234" (thousand separator)
    const parts = str.split(',');
    if (parts[parts.length - 1].length <= 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(',', '');
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.abs(num);
}

function formatImportDate(val) {
  if (!val) return null;
  // If it's a JS Date object (from xlsx cellDates)
  if (val instanceof Date) {
    return val.toISOString();
  }
  const str = String(val).trim();
  // Try DD/MM/YYYY or DD-MM-YYYY
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    let [, d, m, y] = match;
    if (y.length === 2) y = '20' + y;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
  }
  // Try YYYY-MM-DD
  const match2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match2) {
    const [, y, m, d] = match2;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
  }
  // Fallback
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Cancel import
importCancel.addEventListener('click', () => {
  modalImport.hidden = true;
  importedRows = [];
  importedHeaders = [];
});

// Confirm import
importConfirm.addEventListener('click', () => {
  const tarjeta = importTarjeta.value.trim();
  if (!tarjeta) {
    showToast('Escribí de qué tarjeta es');
    importTarjeta.focus();
    return;
  }

  const montoIdx = parseInt(importColMonto.value);
  const descIdx = parseInt(importColDesc.value);
  const fechaIdx = importColFecha.value !== '_none' ? parseInt(importColFecha.value) : null;

  let imported = 0;
  let skipped = 0;
  const gastos = getGastos();

  importedRows.forEach(row => {
    const monto = parseMonto(row[montoIdx]);
    const desc = String(row[descIdx] || '').trim();

    if (monto === null || monto === 0 || !desc) {
      skipped++;
      return;
    }

    let fecha;
    if (fechaIdx !== null) {
      fecha = formatImportDate(row[fechaIdx]);
    }
    if (!fecha) {
      fecha = new Date().toISOString();
    }

    gastos.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + imported,
      fecha,
      monto,
      tarjeta,
      descripcion: desc,
      nota: 'Importado',
      responsable: null
    });

    imported++;
  });

  saveGastos(gastos);

  // Show result
  importStepConfig.hidden = true;
  importStepResult.hidden = false;
  importResultText.innerHTML = `✅ <strong>${imported} gastos importados</strong> a la tarjeta <strong>${tarjeta}</strong>` +
    (skipped > 0 ? `<br><span style="color:var(--text-dim);font-size:.85rem;">${skipped} fila${skipped !== 1 ? 's' : ''} omitida${skipped !== 1 ? 's' : ''} (sin monto o descripción)</span>` : '');

  // Refresh everything
  renderChips();
  renderHistorial();
  renderResumen();
});

// Done
importDone.addEventListener('click', () => {
  modalImport.hidden = true;
  importedRows = [];
  importedHeaders = [];
});

// ——— GASTOS FIJOS ———
const btnNuevoFijo = $('#btn-nuevo-fijo');
const listaFijos = $('#lista-fijos');
const modalFijo = $('#modal-fijo');
const formFijo = $('#form-fijo');
const btnFijoCancel = $('#btn-fijo-cancel');
const fijosApplyContainer = $('#fijos-apply-container');
const btnAplicarFijos = $('#btn-aplicar-fijos');

function getFijos() {
  return JSON.parse(localStorage.getItem('gastos_fijos') || '[]');
}
function saveFijos(fijos) {
  localStorage.setItem('gastos_fijos', JSON.stringify(fijos));
}

function renderFijos() {
  const fijos = getFijos();

  if (fijos.length === 0) {
    listaFijos.innerHTML = '<p class="empty-state">No hay gastos fijos configurados aún. 🏠</p>';
    fijosApplyContainer.hidden = true;
    return;
  }

  fijosApplyContainer.hidden = false;
  listaFijos.innerHTML = fijos.map(f => `
    <div class="gasto-item">
      <span class="gasto-icon">📌</span>
      <div class="gasto-info">
        <div class="gasto-desc">${f.descripcion}</div>
        <div class="gasto-meta">${f.tarjeta}</div>
      </div>
      <span class="gasto-amount">${formatMoney(f.monto)}</span>
      <div class="fijo-actions">
        <button class="btn-edit-small" onclick="editarFijo('${f.id}')" title="Editar">✏️</button>
        <button class="gasto-delete" onclick="borrarFijo('${f.id}')" title="Borrar">🗑️</button>
      </div>
    </div>
  `).join('');
}

btnNuevoFijo.addEventListener('click', () => {
  $('#modal-fijo-title').textContent = 'Nuevo Gasto Fijo';
  $('#input-fijo-id').value = '';
  formFijo.reset();
  modalFijo.hidden = false;
});

btnFijoCancel.addEventListener('click', () => {
  modalFijo.hidden = true;
});

formFijo.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('#input-fijo-id').value;
  const descripcion = $('#input-fijo-desc').value.trim();
  const monto = parseFloat($('#input-fijo-monto').value);
  const tarjeta = $('#input-fijo-tarjeta').value.trim();

  if (!descripcion || isNaN(monto) || !tarjeta) return;

  let fijos = getFijos();
  if (id) {
    // Editar
    fijos = fijos.map(f => f.id === id ? { ...f, descripcion, monto, tarjeta } : f);
  } else {
    // Nuevo
    fijos.push({
      id: Date.now().toString(36),
      descripcion,
      monto,
      tarjeta
    });
  }

  saveFijos(fijos);
  modalFijo.hidden = true;
  renderFijos();
  showToast('Gasto fijo guardado');
});

window.editarFijo = (id) => {
  const fijos = getFijos();
  const fijo = fijos.find(f => f.id === id);
  if (!fijo) return;

  $('#modal-fijo-title').textContent = 'Editar Gasto Fijo';
  $('#input-fijo-id').value = fijo.id;
  $('#input-fijo-desc').value = fijo.descripcion;
  $('#input-fijo-monto').value = fijo.monto;
  $('#input-fijo-tarjeta').value = fijo.tarjeta;
  modalFijo.hidden = false;
};

window.borrarFijo = (id) => {
  if (confirm('¿Eliminar este gasto fijo?')) {
    const fijos = getFijos().filter(f => f.id !== id);
    saveFijos(fijos);
    renderFijos();
  }
};

btnAplicarFijos.addEventListener('click', () => {
  const fijos = getFijos();
  if (fijos.length === 0) return;

  const gastos = getGastos();
  const hoy = new Date().toISOString();

  fijos.forEach(f => {
    gastos.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      fecha: hoy,
      monto: f.monto,
      tarjeta: f.tarjeta,
      descripcion: f.descripcion,
      nota: 'Gasto Fijo',
      responsable: null
    });
  });

  saveGastos(gastos);
  showToast(`✅ ${fijos.length} gastos fijos aplicados al historial`);

  // Refresh and switch to history to show results
  renderHistorial();
  renderResumen();

  // Optional: Auto-switch to history tab
  setTimeout(() => {
    const tabHist = $('#btn-tab-historial');
    if (tabHist) tabHist.click();
  }, 1000);
});

// ——— INIT ———
function init() {
  renderChips();
  renderHistorial();
  renderResumen();
  renderFijos();
}

init();


/**
 * Fiber Tools – Script Google Sheets v3
 * -------------------------------------
 * Archivio condiviso della squadra: ribattiture ottici, posizioni PFS, foto e storico.
 *
 *  GET   ?key=CODICE                         -> tutto l'archivio (ribattiture + posizioni)
 *  GET   ?key=CODICE&action=history&pfs=..&splitter=..  -> storico di uno splitter / PFS
 *  POST  { action: "save",      pfs, splitter, timestamp, tecnico, ottici[], photo?, fotoId? }
 *        { action: "delete",    pfs, splitter, adminKey }
 *        { action: "savePos",   pfs, anello, lat, lng, note, tecnico, timestamp, photo?, fotoId? }
 *        { action: "deletePos", pfs, adminKey }
 *        { action: "savePosBatch", items: [{ pfs, anello, lat, lng, note, tecnico, timestamp }] }  (importazione)
 *
 * Fogli (creati in automatico):
 *   Ribattiture   : PFS | SPLITTER | DATA | TECNICO | O1 PERMUTA | O1 ID | ... | O16 ID | FOTO
 *   PFS_Posizioni : ANELLO | PFS | LAT | LNG | NOTE | TECNICO | DATA | FOTO | MAPPA
 *   Storico       : DATA | AZIONE | PFS | SPLITTER | TECNICO | DETTAGLIO
 *
 * Protezione (facoltativa ma consigliata), in Impostazioni progetto → Proprietà script:
 *   TEAM_KEY  = codice squadra: senza, nessuno può leggere o scrivere
 *   ADMIN_KEY = password admin: senza, nessuno può eliminare
 * Le foto finiscono nella cartella Drive "Fiber Tools Foto" (creata in automatico).
 */

const SCRIPT_VERSION = 3;
const N_OTTICI = 16;
const SH_RIB = 'Ribattiture', SH_POS = 'PFS_Posizioni', SH_LOG = 'Storico';
const RIB_FOTO_COL = 4 + N_OTTICI * 2 + 1;   // colonna 37

const norm_ = v => String(v == null ? '' : v).trim().toUpperCase();
const json_ = obj => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
const props_ = () => PropertiesService.getScriptProperties();

/* ------------------------------------------------------------------ fogli */
function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#e0f2fe');
    sh.setFrozenRows(1);
    // tutto come testo: "05" resta "05", un ID non diventa una data
    sh.getRange(1, 1, sh.getMaxRows(), header.length).setNumberFormat('@');
  }
  return sh;
}

function ribSheet_() {
  const header = ['PFS', 'SPLITTER', 'DATA', 'TECNICO'];
  for (let i = 1; i <= N_OTTICI; i++) header.push('O' + i + ' PERMUTA', 'O' + i + ' ID');
  header.push('FOTO');
  const sh = sheet_(SH_RIB, header);
  // foglio creato dalla v2: aggiunge l'intestazione FOTO se manca
  if (!sh.getRange(1, RIB_FOTO_COL).getValue()) sh.getRange(1, RIB_FOTO_COL).setValue('FOTO').setFontWeight('bold').setBackground('#e0f2fe');
  return sh;
}
const posSheet_ = () => sheet_(SH_POS, ['ANELLO', 'PFS', 'LAT', 'LNG', 'NOTE', 'TECNICO', 'DATA', 'FOTO', 'MAPPA']);
const logSheet_ = () => sheet_(SH_LOG, ['DATA', 'AZIONE', 'PFS', 'SPLITTER', 'TECNICO', 'DETTAGLIO']);

function findRow_(values, match) {
  for (let r = 1; r < values.length; r++) if (match(values[r])) return r + 1;   // riga del foglio (1-based)
  return -1;
}

function nowIt_() {
  return Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm');
}

function log_(azione, pfs, splitter, tecnico, dettaglio) {
  logSheet_().appendRow([nowIt_(), azione, pfs, splitter || '', norm_(tecnico), String(dettaglio || '').slice(0, 1500)]);
}

/* ------------------------------------------------------------------ sicurezza */
function teamOk_(key) {
  const k = props_().getProperty('TEAM_KEY');
  return !k || String(key || '') === k;
}
function adminOk_(key) {
  const k = props_().getProperty('ADMIN_KEY');
  return !k || String(key || '') === k;
}

/* ------------------------------------------------------------------ foto */
function fotoFolder_() {
  const p = props_();
  const id = p.getProperty('FOTO_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* cartella eliminata: la ricrea */ } }
  const f = DriveApp.createFolder('Fiber Tools Foto');
  p.setProperty('FOTO_FOLDER_ID', f.getId());
  return f;
}

/** Salva un'immagine "data:image/jpeg;base64,..." su Drive e restituisce l'ID del file. */
function saveFoto_(dataUrl, name) {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return '';
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name + '.jpg');
  const file = fotoFolder_().createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* dominio che non lo consente */ }
  return file.getId();
}
const fotoName_ = (...parts) => parts.map(p => norm_(p).replace(/[^\w-]+/g, '_')).join('__') + '__' + Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyyMMdd_HHmmss');

/* ------------------------------------------------------------------ lettura */
function readRib_() {
  const values = ribSheet_().getDataRange().getValues();
  const data = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const pfs = norm_(row[0]), spl = norm_(row[1]);
    if (!pfs || !spl) continue;
    const ottici = [];
    for (let i = 0; i < N_OTTICI; i++) ottici.push({ ottico: i + 1, pte: String(row[4 + i * 2] || ''), fibra: String(row[5 + i * 2] || '') });
    (data[pfs] = data[pfs] || {})[spl] = { updatedAt: String(row[2] || ''), tecnico: String(row[3] || ''), ottici: ottici, fotoId: String(row[RIB_FOTO_COL - 1] || '') };
  }
  return data;
}

function readPos_() {
  const values = posSheet_().getDataRange().getValues();
  const out = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const pfs = norm_(row[1]);
    const lat = Number(String(row[2]).replace(',', '.')), lng = Number(String(row[3]).replace(',', '.'));
    if (!pfs || !isFinite(lat) || !isFinite(lng)) continue;
    out[pfs] = { anello: norm_(row[0]), pfs: pfs, lat: lat, lng: lng, note: String(row[4] || ''), tecnico: String(row[5] || ''), updatedAt: String(row[6] || ''), fotoId: String(row[7] || '') };
  }
  return out;
}

function history_(pfs, splitter) {
  const values = logSheet_().getDataRange().getValues();
  const out = [];
  for (let r = values.length - 1; r >= 1 && out.length < 50; r--) {
    const row = values[r];
    if (norm_(row[2]) === pfs && norm_(row[3]) === splitter) out.push({ data: String(row[0]), azione: String(row[1]), tecnico: String(row[4]), dettaglio: String(row[5]) });
  }
  return out;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!teamOk_(p.key)) return json_({ status: 'error', code: 'auth', message: 'Codice squadra mancante o errato' });
  if (p.action === 'history') return json_({ status: 'success', version: SCRIPT_VERSION, history: history_(norm_(p.pfs), norm_(p.splitter)) });
  return json_({ status: 'success', version: SCRIPT_VERSION, data: readRib_(), positions: readPos_() });
}

/* ------------------------------------------------------------------ scrittura */
function diffOttici_(oldRow, newRow) {
  const changes = [];
  for (let i = 0; i < N_OTTICI; i++) {
    const op = String(oldRow[4 + i * 2] || ''), np = String(newRow[4 + i * 2] || '');
    const oi = String(oldRow[5 + i * 2] || ''), ni = String(newRow[5 + i * 2] || '');
    if (op !== np) changes.push('O' + (i + 1) + ' permuta ' + (op || '—') + ' → ' + (np || '—'));
    if (oi !== ni) changes.push('O' + (i + 1) + ' ID ' + (oi || '—') + ' → ' + (ni || '—'));
  }
  return changes;
}

function saveRib_(b) {
  const pfs = norm_(b.pfs), splitter = norm_(b.splitter);
  if (!pfs || !splitter) return { status: 'error', message: 'PFS o splitter mancante' };
  const sh = ribSheet_();
  const values = sh.getDataRange().getValues();
  const rowNum = findRow_(values, row => norm_(row[0]) === pfs && norm_(row[1]) === splitter);
  const oldRow = rowNum > 0 ? values[rowNum - 1] : null;

  let fotoId = oldRow ? String(oldRow[RIB_FOTO_COL - 1] || '') : '';
  if (b.photo) fotoId = saveFoto_(b.photo, fotoName_(pfs, splitter)) || fotoId;
  else if (b.fotoId !== undefined) fotoId = String(b.fotoId || '');

  const row = [pfs, splitter, String(b.timestamp || nowIt_()), norm_(b.tecnico)];
  const byNum = {};
  (b.ottici || []).forEach(o => { byNum[Number(o.ottico)] = o; });
  for (let i = 1; i <= N_OTTICI; i++) { const o = byNum[i] || {}; row.push(norm_(o.pte), norm_(o.fibra)); }
  row.push(fotoId);

  if (rowNum > 0) {
    const ch = diffOttici_(oldRow, row);
    if (b.photo) ch.push('nuova foto');
    sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
    log_('Modificata', pfs, splitter, b.tecnico, ch.length ? ch.join('; ') : 'Nessuna modifica agli ottici');
  } else {
    sh.appendRow(row);
    let n = 0; for (let i = 0; i < N_OTTICI; i++) if (row[4 + i * 2] || row[5 + i * 2]) n++;
    log_('Creata', pfs, splitter, b.tecnico, n + ' ottici compilati' + (b.photo ? ', con foto' : ''));
  }
  return { status: 'success', saved: true, fotoId: fotoId };
}

function deleteRib_(b) {
  if (!adminOk_(b.adminKey)) return { status: 'error', code: 'admin', message: 'Solo l’amministratore può eliminare' };
  const pfs = norm_(b.pfs), splitter = norm_(b.splitter);
  const sh = ribSheet_();
  const rowNum = findRow_(sh.getDataRange().getValues(), row => norm_(row[0]) === pfs && norm_(row[1]) === splitter);
  if (rowNum > 0) { sh.deleteRow(rowNum); log_('Eliminata', pfs, splitter, b.tecnico, 'Ribattitura eliminata'); }
  return { status: 'success', deleted: rowNum > 0 };
}

function distM_(a, b) {
  const R = 6371000, t = x => x * Math.PI / 180;
  const h = Math.pow(Math.sin(t(b.lat - a.lat) / 2), 2) + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.pow(Math.sin(t(b.lng - a.lng) / 2), 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function savePos_(b) {
  const pfs = norm_(b.pfs);
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!pfs || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { status: 'error', message: 'PFS o coordinate non validi' };
  const anello = norm_(b.anello) || (/^([A-Z]+_\d+)/.exec(pfs) || [, pfs.split('/')[0]])[1];
  const sh = posSheet_();
  const values = sh.getDataRange().getValues();
  const rowNum = findRow_(values, row => norm_(row[1]) === pfs);
  const oldRow = rowNum > 0 ? values[rowNum - 1] : null;

  let fotoId = oldRow ? String(oldRow[7] || '') : '';
  if (b.photo) fotoId = saveFoto_(b.photo, fotoName_(pfs, 'PFS')) || fotoId;
  else if (b.fotoId !== undefined) fotoId = String(b.fotoId || '');

  const row = [anello, pfs, lat.toFixed(6), lng.toFixed(6), String(b.note || ''), norm_(b.tecnico), String(b.timestamp || nowIt_()), fotoId,
    'https://www.google.com/maps/search/?api=1&query=' + lat.toFixed(6) + ',' + lng.toFixed(6)];
  if (rowNum > 0) {
    const moved = distM_({ lat: Number(oldRow[2]), lng: Number(oldRow[3]) }, { lat: lat, lng: lng });
    const ch = [];
    if (moved >= 1) ch.push('spostato di ' + Math.round(moved) + ' m');
    if (String(oldRow[4] || '') !== row[4]) ch.push('note aggiornate');
    if (norm_(oldRow[0]) !== anello) ch.push('anello ' + norm_(oldRow[0]) + ' → ' + anello);
    if (b.photo) ch.push('nuova foto');
    sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
    log_('Posizione modificata', pfs, '', b.tecnico, ch.length ? ch.join('; ') : 'Nessuna modifica');
  } else {
    sh.appendRow(row);
    log_('Posizione salvata', pfs, '', b.tecnico, row[2] + ', ' + row[3] + (b.photo ? ', con foto' : ''));
  }
  return { status: 'success', saved: true, fotoId: fotoId };
}

/** Salvataggio di molte posizioni in una volta sola (importazione da Google My Maps). */
function savePosBatch_(b) {
  const items = Array.isArray(b.items) ? b.items : [];
  const sh = posSheet_();
  const values = sh.getDataRange().getValues();
  const body = values.slice(1).map(r => { const row = r.slice(0, 9); while (row.length < 9) row.push(''); return row; });
  const index = {};
  body.forEach((r, i) => { const k = norm_(r[1]); if (k) index[k] = i; });
  let added = 0, updated = 0, skipped = 0;
  items.forEach(it => {
    const pfs = norm_(it.pfs), lat = Number(it.lat), lng = Number(it.lng);
    if (!pfs || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { skipped++; return; }
    const anello = norm_(it.anello) || (/^([A-Z]+_\d+)/.exec(pfs) || [, pfs.split('/')[0]])[1];
    const i = index[pfs];
    const fotoId = i !== undefined ? String(body[i][7] || '') : '';
    const row = [anello, pfs, lat.toFixed(6), lng.toFixed(6), String(it.note || ''), norm_(it.tecnico), String(it.timestamp || nowIt_()), fotoId,
      'https://www.google.com/maps/search/?api=1&query=' + lat.toFixed(6) + ',' + lng.toFixed(6)];
    if (i !== undefined) { if (it.note === undefined || it.note === '') row[4] = body[i][4]; body[i] = row; updated++; }
    else { index[pfs] = body.length; body.push(row); added++; }
  });
  if (body.length) sh.getRange(2, 1, body.length, 9).setValues(body);
  if (added || updated) log_('Importazione posizioni', 'IMPORTAZIONE', '', b.tecnico, added + ' nuove, ' + updated + ' aggiornate' + (skipped ? ', ' + skipped + ' scartate' : ''));
  return { status: 'success', added: added, updated: updated, skipped: skipped };
}

function deletePos_(b) {
  if (!adminOk_(b.adminKey)) return { status: 'error', code: 'admin', message: 'Solo l’amministratore può eliminare' };
  const pfs = norm_(b.pfs);
  const sh = posSheet_();
  const rowNum = findRow_(sh.getDataRange().getValues(), row => norm_(row[1]) === pfs);
  if (rowNum > 0) { sh.deleteRow(rowNum); log_('Posizione eliminata', pfs, '', b.tecnico, ''); }
  return { status: 'success', deleted: rowNum > 0 };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!teamOk_(b.key)) return json_({ status: 'error', code: 'auth', message: 'Codice squadra mancante o errato' });
    const action = b.action || 'save';
    if (action === 'save') return json_(saveRib_(b));
    if (action === 'delete') return json_(deleteRib_(b));
    if (action === 'savePos') return json_(savePos_(b));
    if (action === 'deletePos') return json_(deletePos_(b));
    if (action === 'savePosBatch') return json_(savePosBatch_(b));
    return json_({ status: 'error', message: 'Azione sconosciuta: ' + action });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

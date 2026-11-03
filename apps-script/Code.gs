/**
 * Fiber Tools – Script Google Sheets v2
 * -------------------------------------
 * Archivio condiviso delle ribattiture ottici.
 *  - GET  : restituisce tutto l'archivio
 *  - POST : { action: "save", pfs, splitter, timestamp, tecnico, ottici: [{ottico, pte, fibra}] }
 *           { action: "delete", pfs, splitter }
 *
 * I dati vengono scritti nel foglio "Ribattiture" (creato in automatico),
 * una riga per ogni coppia PFS + SPLITTER, leggibile anche a mano:
 *   PFS | SPLITTER | DATA | TECNICO | O1 PERMUTA | O1 ID | ... | O16 PERMUTA | O16 ID
 *
 * Installazione: vedi README del progetto (sezione "Script Google Sheets v2").
 */

const SHEET_NAME = 'Ribattiture';
const N_OTTICI = 16;
const SCRIPT_VERSION = 2;

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    const header = ['PFS', 'SPLITTER', 'DATA', 'TECNICO'];
    for (let i = 1; i <= N_OTTICI; i++) header.push('O' + i + ' PERMUTA', 'O' + i + ' ID');
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#e0f2fe');
    sh.setFrozenRows(1);
    // Tutte le colonne come testo: evita che "05" diventi 5 o che un ID diventi una data
    sh.getRange(1, 1, sh.getMaxRows(), header.length).setNumberFormat('@');
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const norm_ = v => String(v == null ? '' : v).trim().toUpperCase();

function findRow_(values, pfs, splitter) {
  for (let r = 1; r < values.length; r++) {
    if (norm_(values[r][0]) === pfs && norm_(values[r][1]) === splitter) return r + 1; // riga del foglio (1-based)
  }
  return -1;
}

function doGet() {
  const values = getSheet_().getDataRange().getValues();
  const data = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const pfs = norm_(row[0]), spl = norm_(row[1]);
    if (!pfs || !spl) continue;
    const ottici = [];
    for (let i = 0; i < N_OTTICI; i++) {
      ottici.push({ ottico: i + 1, pte: String(row[4 + i * 2] || ''), fibra: String(row[5 + i * 2] || '') });
    }
    if (!data[pfs]) data[pfs] = {};
    data[pfs][spl] = { updatedAt: String(row[2] || ''), tecnico: String(row[3] || ''), ottici: ottici };
  }
  return json_({ status: 'success', version: SCRIPT_VERSION, data: data });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = body.action || 'save';
    const pfs = norm_(body.pfs), splitter = norm_(body.splitter);
    if (!pfs || !splitter) return json_({ status: 'error', message: 'PFS o splitter mancante' });

    const sh = getSheet_();
    const values = sh.getDataRange().getValues();
    const rowNum = findRow_(values, pfs, splitter);

    if (action === 'delete') {
      if (rowNum > 0) sh.deleteRow(rowNum);
      return json_({ status: 'success', deleted: rowNum > 0 });
    }

    const row = [pfs, splitter, String(body.timestamp || ''), norm_(body.tecnico)];
    const byNum = {};
    (body.ottici || []).forEach(o => { byNum[Number(o.ottico)] = o; });
    for (let i = 1; i <= N_OTTICI; i++) {
      const o = byNum[i] || {};
      row.push(norm_(o.pte), norm_(o.fibra));
    }
    if (rowNum > 0) sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    return json_({ status: 'success', saved: true });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

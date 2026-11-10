/**
 * Fiber Tools – Script Google Sheets v6
 * -------------------------------------
 * Archivio condiviso della squadra: ribattiture ottici, posizioni PFS, foto, storico e ACCOUNT.
 *
 * Vedere i dati (ribattiture, posizioni PFS, storico) richiede un account approvato.
 * Per salvare serve un account approvato; per eliminare un amministratore.
 *  POST  { action: "register", email, nome, societa, password } -> richiesta di accesso (il 1° account è il proprietario)
 *        { action: "data", token }                          -> tutto l'archivio (ribattiture + posizioni)
 *        { action: "history", token, pfs, splitter }        -> storico di uno splitter / PFS
 *        { action: "setProfile", token, societa }           -> società per cui lavora l'utente
 *        { action: "stats", token }                         -> statistiche per tecnico / società / giorno (admin)
 *        { action: "backupInfo", token }                    -> stato del backup automatico (admin)
 *        { action: "backupNow", token }                     -> copia del foglio in Drive adesso (admin)
 * Backup settimanale: eseguire una volta "attivaBackupSettimanale" dall'editor (chiede l'autorizzazione).
 *        { action: "login", email, password }               -> { token, user }
 *        { action: "me", token }                            -> dati aggiornati dell'account (+ richieste in attesa per gli admin)
 *        { action: "changePassword", token, old, password }
 *        { action: "users", token }                         -> elenco utenti (admin)
 *        { action: "manageUser", token, email, op, ruolo?, societa? } -> approva | rifiuta | blocca | riattiva | elimina | ruolo | societa (admin)
 *  Tutte le azioni di scrittura qui sotto richiedono anche "token".
 *
 *  GET   -> solo la versione dello script: i dati si leggono con POST "data" (serve il token).
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
 *   Utenti        : EMAIL | NOME | STATO | RUOLO | ... | SOCIETA (le password sono salvate solo come impronta con sale)
 *                   STATO: in attesa | attivo | bloccato | rifiutato — RUOLO: tecnico | admin | proprietario
 *                   Il proprietario può sempre correggere STATO e RUOLO anche a mano in questo foglio.
 *
 * Protezione (facoltativa ma consigliata), in Impostazioni progetto → Proprietà script:
 *   TEAM_KEY  = codice squadra: senza, nessuno può leggere o scrivere
 *   ADMIN_KEY = password admin: senza, nessuno può eliminare
 * Le foto finiscono nella cartella Drive "Fiber Tools Foto" (creata in automatico).
 */

const SCRIPT_VERSION = 6;
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

/* ------------------------------------------------------------------ account */
const SH_USERS = 'Utenti';
const U = { EMAIL: 0, NOME: 1, STATO: 2, RUOLO: 3, HASH: 4, SALT: 5, NEW_HASH: 6, NEW_SALT: 7, REG: 8, LAST: 9, BY: 10, SOC: 11 };
const USER_COLS = 12;
const ROLE_LEVEL = { tecnico: 1, admin: 2, proprietario: 3 };
const TOKEN_DAYS = 180;
const USER_HEADER = ['EMAIL', 'NOME', 'STATO', 'RUOLO', 'HASH', 'SALT', 'NUOVA_PASSWORD_HASH', 'NUOVA_PASSWORD_SALT', 'REGISTRATO', 'ULTIMO_ACCESSO', 'APPROVATO_DA', 'SOCIETA'];
function usersSheet_() {
  const sh = sheet_(SH_USERS, USER_HEADER);
  // fogli creati con la v4: aggiunge l'intestazione della colonna SOCIETA
  if (String(sh.getRange(1, U.SOC + 1).getValue()) !== 'SOCIETA') {
    sh.getRange(1, U.SOC + 1).setValue('SOCIETA').setFontWeight('bold').setBackground('#e0f2fe');
    sh.getRange(1, U.SOC + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  }
  return sh;
}
const normSoc_ = v => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toUpperCase();
const normEmail_ = v => String(v == null ? '' : v).trim().toLowerCase();
const err_ = (code, message) => ({ status: 'error', code: code, message: message });

function secret_() {
  const p = props_();
  let s = p.getProperty('AUTH_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('AUTH_SECRET', s); }
  return s;
}
const b64_ = bytes => Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
function unb64_(str) { let s = String(str || ''); while (s.length % 4) s += '='; return Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString(); }
const newSalt_ = () => Utilities.getUuid().replace(/-/g, '');

/** Impronta della password: HMAC-SHA256 ripetuto, con sale personale. */
function hashPwd_(pwd, salt) {
  const key = Utilities.newBlob('fibertools:' + salt).getBytes();
  let h = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(pwd)).getBytes(), key);
  for (let i = 0; i < 400; i++) h = Utilities.computeHmacSha256Signature(h, key);
  return b64_(h);
}

function readUsers_() {
  const sh = usersSheet_();
  const values = sh.getDataRange().getValues();
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r].slice(0, USER_COLS);
    while (row.length < USER_COLS) row.push('');
    if (normEmail_(row[U.EMAIL])) rows.push({ rowNum: r + 1, row: row });
  }
  return { sh: sh, rows: rows };
}
const findUser_ = (users, email) => users.rows.find(u => normEmail_(u.row[U.EMAIL]) === email) || null;
const writeUser_ = (users, u) => users.sh.getRange(u.rowNum, 1, 1, USER_COLS).setValues([u.row]);
const stato_ = row => String(row[U.STATO] || '').trim().toLowerCase();
const ruolo_ = row => { const r = String(row[U.RUOLO] || '').trim().toLowerCase(); return ROLE_LEVEL[r] ? r : 'tecnico'; };
const publicUser_ = row => ({ email: normEmail_(row[U.EMAIL]), nome: String(row[U.NOME] || ''), societa: String(row[U.SOC] || ''), stato: stato_(row), ruolo: ruolo_(row) });

function makeToken_(row) {
  const exp = Date.now() + TOKEN_DAYS * 86400000;
  const payload = normEmail_(row[U.EMAIL]) + '|' + exp + '|' + String(row[U.SALT]).slice(0, 8);
  const sig = b64_(Utilities.computeHmacSha256Signature(payload, secret_()));
  return b64_(Utilities.newBlob(payload).getBytes()) + '.' + sig;
}

/** Verifica il token e restituisce l'utente, oppure un errore. Lo stato e il ruolo vengono riletti ogni volta dal foglio. */
function authUser_(token, minLevel) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return { error: err_('login', 'Accedi con il tuo account per continuare') };
  let payload;
  try { payload = unb64_(parts[0]); } catch (e) { return { error: err_('login', 'Sessione non valida: accedi di nuovo') }; }
  if (b64_(Utilities.computeHmacSha256Signature(payload, secret_())) !== parts[1]) return { error: err_('login', 'Sessione non valida: accedi di nuovo') };
  const [email, exp, saltPart] = payload.split('|');
  if (!(Number(exp) > Date.now())) return { error: err_('login', 'Sessione scaduta: accedi di nuovo') };
  const users = readUsers_();
  const u = findUser_(users, email);
  if (!u || String(u.row[U.SALT]).slice(0, 8) !== saltPart) return { error: err_('login', 'Sessione non valida: accedi di nuovo') };
  const st = stato_(u.row);
  if (st === 'in attesa') return { error: err_('pending', 'Il tuo account è in attesa di approvazione') };
  if (st !== 'attivo') return { error: err_('blocked', 'Il tuo account non è attivo: contatta il responsabile') };
  if (ROLE_LEVEL[ruolo_(u.row)] < (minLevel || 1)) return { error: err_('forbidden', 'Operazione riservata agli amministratori') };
  return { user: u, users: users };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function register_(b) {
  const email = normEmail_(b.email), nome = String(b.nome || '').trim().replace(/\s+/g, ' ').toUpperCase(), pwd = String(b.password || '');
  const societa = normSoc_(b.societa);
  if (!EMAIL_RE.test(email)) return err_('input', 'Email non valida');
  if (nome.length < 2 || nome.length > 60) return err_('input', 'Inserisci nome e cognome');
  if (societa.length < 2 || societa.length > 60) return err_('input', 'Indica la società per cui lavori');
  if (pwd.length < 8) return err_('input', 'La password deve avere almeno 8 caratteri');
  const users = readUsers_();
  const salt = newSalt_(), hash = hashPwd_(pwd, salt), now = nowIt_();
  const ex = findUser_(users, email);
  if (!users.rows.length) {
    // il primo account registrato è il proprietario dell'app
    const row = [email, nome, 'attivo', 'proprietario', hash, salt, '', '', now, now, 'PRIMO ACCOUNT', societa];
    users.sh.appendRow(row);
    log_('Account creato', 'ACCOUNT', email, nome, 'Proprietario dell’app');
    return { status: 'success', stato: 'attivo', token: makeToken_(row), user: publicUser_(row) };
  }
  if (ex) {
    const st = stato_(ex.row);
    if (st === 'bloccato') return err_('blocked', 'Questo account è bloccato: contatta il responsabile');
    if (st === 'attivo') {
      // password dimenticata: la nuova password si attiva dopo l'approvazione, quella vecchia resta valida
      ex.row[U.NEW_HASH] = hash; ex.row[U.NEW_SALT] = salt;
      if (!ex.row[U.SOC]) ex.row[U.SOC] = societa;
      writeUser_(users, ex);
      log_('Richiesta nuova password', 'ACCOUNT', email, ex.row[U.NOME], '');
      return { status: 'success', stato: 'password in attesa' };
    }
    ex.row[U.NOME] = nome; ex.row[U.SOC] = societa; ex.row[U.STATO] = 'in attesa'; ex.row[U.HASH] = hash; ex.row[U.SALT] = salt; ex.row[U.REG] = now;
    writeUser_(users, ex);
    log_('Richiesta di accesso', 'ACCOUNT', email, nome, 'Ripresentata');
    return { status: 'success', stato: 'in attesa' };
  }
  users.sh.appendRow([email, nome, 'in attesa', 'tecnico', hash, salt, '', '', now, '', '', societa]);
  log_('Richiesta di accesso', 'ACCOUNT', email, nome, societa);
  return { status: 'success', stato: 'in attesa' };
}

function login_(b) {
  const email = normEmail_(b.email), pwd = String(b.password || '');
  const cache = CacheService.getScriptCache(), ck = 'fail_' + email;
  const fails = Number(cache.get(ck) || 0);
  if (fails >= 8) return err_('locked', 'Troppi tentativi sbagliati: riprova tra 15 minuti');
  const users = readUsers_();
  const u = findUser_(users, email);
  if (!u || hashPwd_(pwd, u.row[U.SALT]) !== String(u.row[U.HASH])) {
    cache.put(ck, String(fails + 1), 900);
    return err_('credentials', 'Email o password errate');
  }
  cache.remove(ck);
  const st = stato_(u.row);
  if (st === 'in attesa') return err_('pending', 'Il tuo account è in attesa di approvazione da parte di un amministratore');
  if (st !== 'attivo') return err_('blocked', 'Il tuo account non è attivo: contatta il responsabile');
  u.row[U.LAST] = nowIt_(); writeUser_(users, u);
  return { status: 'success', token: makeToken_(u.row), user: publicUser_(u.row) };
}

const pendingCount_ = users => users.rows.filter(u => stato_(u.row) === 'in attesa' || (stato_(u.row) === 'attivo' && u.row[U.NEW_HASH])).length;

function me_(b) {
  const a = authUser_(b.token, 1);
  if (a.error) return a.error;
  const res = { status: 'success', user: publicUser_(a.user.row) };
  if (ROLE_LEVEL[res.user.ruolo] >= 2) res.pendingCount = pendingCount_(a.users);
  return res;
}

function changePassword_(b) {
  const a = authUser_(b.token, 1);
  if (a.error) return a.error;
  const u = a.user;
  if (hashPwd_(String(b.old || ''), u.row[U.SALT]) !== String(u.row[U.HASH])) return err_('credentials', 'La password attuale non è corretta');
  if (String(b.password || '').length < 8) return err_('input', 'La nuova password deve avere almeno 8 caratteri');
  const salt = newSalt_();
  u.row[U.SALT] = salt; u.row[U.HASH] = hashPwd_(b.password, salt); u.row[U.NEW_HASH] = ''; u.row[U.NEW_SALT] = '';
  writeUser_(a.users, u);
  log_('Password cambiata', 'ACCOUNT', normEmail_(u.row[U.EMAIL]), u.row[U.NOME], '');
  return { status: 'success', token: makeToken_(u.row), user: publicUser_(u.row) };
}

function setProfile_(b) {
  const a = authUser_(b.token, 1);
  if (a.error) return a.error;
  const societa = normSoc_(b.societa);
  if (societa.length < 2 || societa.length > 60) return err_('input', 'Indica la società per cui lavori');
  a.user.row[U.SOC] = societa; writeUser_(a.users, a.user);
  log_('Società indicata', 'ACCOUNT', normEmail_(a.user.row[U.EMAIL]), a.user.row[U.NOME], societa);
  return { status: 'success', user: publicUser_(a.user.row) };
}

function listUsers_(b) {
  const a = authUser_(b.token, 2);
  if (a.error) return a.error;
  return { status: 'success', users: a.users.rows.map(u => Object.assign(publicUser_(u.row), {
    registrato: String(u.row[U.REG] || ''), ultimoAccesso: String(u.row[U.LAST] || ''), approvatoDa: String(u.row[U.BY] || ''),
    nuovaPassword: !!u.row[U.NEW_HASH] })) };
}

function manageUser_(b) {
  const a = authUser_(b.token, 2);
  if (a.error) return a.error;
  const me = a.user, myRole = ruolo_(me.row), myEmail = normEmail_(me.row[U.EMAIL]);
  const target = findUser_(a.users, normEmail_(b.email));
  if (!target) return err_('input', 'Utente non trovato');
  const tEmail = normEmail_(target.row[U.EMAIL]), tRole = ruolo_(target.row);
  if (tEmail === myEmail) return err_('forbidden', 'Non puoi modificare il tuo stesso account da qui');
  if (tRole === 'proprietario') return err_('forbidden', 'Il proprietario non può essere modificato');
  if (myRole !== 'proprietario' && tRole === 'admin') return err_('forbidden', 'Solo il proprietario può gestire gli amministratori');
  const op = String(b.op || ''), who = String(me.row[U.NOME] || myEmail);
  let detail = '';
  if (op === 'approva') {
    if (stato_(target.row) === 'attivo' && target.row[U.NEW_HASH]) {
      target.row[U.HASH] = target.row[U.NEW_HASH]; target.row[U.SALT] = target.row[U.NEW_SALT]; detail = 'Nuova password approvata';
    } else { detail = 'Accesso approvato'; }
    target.row[U.NEW_HASH] = ''; target.row[U.NEW_SALT] = '';
    target.row[U.STATO] = 'attivo'; target.row[U.BY] = who;
  } else if (op === 'rifiuta') {
    if (stato_(target.row) === 'attivo' && target.row[U.NEW_HASH]) { target.row[U.NEW_HASH] = ''; target.row[U.NEW_SALT] = ''; detail = 'Nuova password rifiutata'; }
    else { target.row[U.STATO] = 'rifiutato'; detail = 'Richiesta rifiutata'; }
  } else if (op === 'blocca') {
    target.row[U.STATO] = 'bloccato'; detail = 'Account bloccato';
  } else if (op === 'riattiva') {
    target.row[U.STATO] = 'attivo'; target.row[U.BY] = who; detail = 'Account riattivato';
  } else if (op === 'ruolo') {
    const r = String(b.ruolo || '').toLowerCase();
    if (r !== 'tecnico' && r !== 'admin') return err_('input', 'Ruolo non valido');
    if (myRole !== 'proprietario') return err_('forbidden', 'Solo il proprietario può nominare gli amministratori');
    target.row[U.RUOLO] = r; detail = r === 'admin' ? 'Nominato amministratore' : 'Ruolo: tecnico';
  } else if (op === 'societa') {
    const soc = normSoc_(b.societa);
    if (soc.length < 2 || soc.length > 60) return err_('input', 'Società non valida');
    target.row[U.SOC] = soc; detail = 'Società: ' + soc;
  } else if (op === 'elimina') {
    a.users.sh.deleteRow(target.rowNum);
    log_('Account eliminato', 'ACCOUNT', tEmail, who, '');
    return { status: 'success', deleted: true };
  } else {
    return err_('input', 'Operazione sconosciuta');
  }
  writeUser_(a.users, target);
  log_(detail, 'ACCOUNT', tEmail, who, '');
  return { status: 'success', user: publicUser_(target.row) };
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
  // i dati non sono più leggibili senza account: si chiedono con POST { action: "data", token }
  return json_({ status: 'error', code: 'login', version: SCRIPT_VERSION, message: 'Accedi con un account approvato per vedere PFS, posizioni e ribattiture' });
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
  const pfs = norm_(b.pfs);
  const sh = posSheet_();
  const rowNum = findRow_(sh.getDataRange().getValues(), row => norm_(row[1]) === pfs);
  if (rowNum > 0) { sh.deleteRow(rowNum); log_('Posizione eliminata', pfs, '', b.tecnico, ''); }
  return { status: 'success', deleted: rowNum > 0 };
}

/* ------------------------------------------------------------------ statistiche */
const STAT_CAT = { 'Creata': 'ribNew', 'Modificata': 'ribMod', 'Eliminata': 'ribDel', 'Posizione salvata': 'posNew', 'Posizione modificata': 'posMod', 'Posizione eliminata': 'posDel', 'Importazione posizioni': 'imp' };
function dayOf_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Europe/Rome', 'yyyy-MM-dd');
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || ''));
  return m ? `${m[3]}-${('0' + m[2]).slice(-2)}-${('0' + m[1]).slice(-2)}` : '';
}
function stats_(users) {
  const agg = {};
  const log = logSheet_().getDataRange().getValues();
  for (let r = 1; r < log.length; r++) {
    const cat = STAT_CAT[String(log[r][1] || '')];
    if (!cat) continue;
    const day = dayOf_(log[r][0]); if (!day) continue;
    const k = day + '|' + norm_(log[r][4]) + '|' + cat;
    agg[k] = (agg[k] || 0) + 1;
  }
  const rows = Object.keys(agg).map(k => { const p = k.split('|'); return [p[0], p[1], p[2], agg[k]]; });
  const soc = {};
  users.rows.forEach(u => { const n = norm_(u.row[U.NOME]); if (n) soc[n] = String(u.row[U.SOC] || ''); });
  const ribBy = {}, posBy = {};
  const rib = ribSheet_().getDataRange().getValues();
  for (let r = 1; r < rib.length; r++) if (rib[r][0]) { const t = norm_(rib[r][3]) || '—'; ribBy[t] = (ribBy[t] || 0) + 1; }
  const pos = posSheet_().getDataRange().getValues();
  for (let r = 1; r < pos.length; r++) if (pos[r][1]) { const t = norm_(pos[r][5]) || '—'; posBy[t] = (posBy[t] || 0) + 1; }
  return { status: 'success', rows: rows, societa: soc, archivio: { ribattiture: ribBy, posizioni: posBy } };
}

/* ------------------------------------------------------------------ backup in Drive */
const BACKUP_FOLDER = 'Fiber Tools Backup', BACKUP_KEEP = 8;
function backupFolder_() {
  const id = props_().getProperty('BACKUP_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* cartella eliminata: la ricrea */ } }
  const f = DriveApp.createFolder(BACKUP_FOLDER);
  props_().setProperty('BACKUP_FOLDER_ID', f.getId());
  return f;
}
function backupNow_(who) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folder = backupFolder_();
  const name = 'Backup Fiber Tools ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd HH.mm');
  const copy = DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  // tiene solo le ultime copie
  const files = [], it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^Backup Fiber Tools /.test(f.getName())) files.push(f); }
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  files.slice(BACKUP_KEEP).forEach(f => { try { f.setTrashed(true); } catch (e) {} });
  const info = { at: nowIt_(), name: name, url: copy.getUrl(), folderUrl: folder.getUrl(), who: String(who || ''), kept: Math.min(files.length, BACKUP_KEEP) };
  props_().setProperty('LAST_BACKUP', JSON.stringify(info));
  props_().deleteProperty('LAST_BACKUP_ERROR');
  log_('Backup', 'BACKUP', '', who, name);
  return info;
}
/** Eseguito ogni settimana dal trigger. */
function backupSettimanale() {
  try { backupNow_('AUTOMATICO'); }
  catch (e) { props_().setProperty('LAST_BACKUP_ERROR', nowIt_() + ' – ' + String(e)); throw e; }
}
/** Da eseguire UNA volta dall'editor: chiede l'autorizzazione e attiva il backup ogni domenica alle 3. */
function attivaBackupSettimanale() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'backupSettimanale').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupSettimanale').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone('Europe/Rome').create();
  props_().setProperty('BACKUP_WEEKLY', 'domenica alle 3:00');
  const info = backupNow_('PRIMO BACKUP');
  Logger.log('Backup settimanale attivo. Primo backup: ' + info.name + ' – ' + info.folderUrl);
}
function backupInfo_() {
  let last = null; try { last = JSON.parse(props_().getProperty('LAST_BACKUP') || 'null'); } catch (e) {}
  return { status: 'success', weekly: props_().getProperty('BACKUP_WEEKLY') || '', last: last, error: props_().getProperty('LAST_BACKUP_ERROR') || '' };
}

/** Letture: servono un account approvato (qualsiasi ruolo). Non bloccano gli altri utenti. */
function readAction_(b) {
  if (b.action === 'stats' || b.action === 'backupInfo' || b.action === 'backupNow') {
    const ad = authUser_(b.token, 2);
    if (ad.error) return ad.error;
    if (b.action === 'stats') return stats_(ad.users);
    if (b.action === 'backupInfo') return backupInfo_();
    try { return { status: 'success', info: backupNow_(String(ad.user.row[U.NOME] || '')) }; }
    catch (e) { return { status: 'error', code: 'drive', message: /permission|autorizz|authoriz/i.test(String(e)) ? 'Lo script non è ancora autorizzato a usare Google Drive: il proprietario deve eseguire "attivaBackupSettimanale" una volta.' : String(e) }; }
  }
  const a = authUser_(b.token, 1);
  if (a.error) return a.error;
  if (b.action === 'history') return { status: 'success', version: SCRIPT_VERSION, history: history_(norm_(b.pfs), norm_(b.splitter)) };
  return { status: 'success', version: SCRIPT_VERSION, data: readRib_(), positions: readPos_() };
}

function doPost(e) {
  let b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ status: 'error', message: 'Richiesta non valida' }); }
  if (!teamOk_(b.key)) return json_({ status: 'error', code: 'auth', message: 'Codice squadra mancante o errato' });
  if (['data', 'history', 'stats', 'backupInfo', 'backupNow'].includes(b.action)) {
    try { return json_(readAction_(b)); } catch (err) { return json_({ status: 'error', message: String(err) }); }
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const action = b.action || 'save';
    // account
    if (action === 'register') return json_(register_(b));
    if (action === 'login') return json_(login_(b));
    if (action === 'me') return json_(me_(b));
    if (action === 'changePassword') return json_(changePassword_(b));
    if (action === 'setProfile') return json_(setProfile_(b));
    if (action === 'users') return json_(listUsers_(b));
    if (action === 'manageUser') return json_(manageUser_(b));
    // archivio: salvare richiede un account approvato, eliminare un amministratore
    const WRITE = { save: [saveRib_, 1], savePos: [savePos_, 1], savePosBatch: [savePosBatch_, 1], delete: [deleteRib_, 2], deletePos: [deletePos_, 2] };
    const w = WRITE[action];
    if (!w) return json_({ status: 'error', message: 'Azione sconosciuta: ' + action });
    const a = authUser_(b.token, w[1]);
    if (a.error) return json_(a.error);
    b.tecnico = String(a.user.row[U.NOME] || normEmail_(a.user.row[U.EMAIL]));   // il nome lo decide l'account, non il telefono
    return json_(w[0](b));
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

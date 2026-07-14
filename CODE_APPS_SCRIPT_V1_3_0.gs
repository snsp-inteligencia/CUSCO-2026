const SPREADSHEET_ID = '1sJDfmG1GaFryedHgv_PPJd7Xe64OPIi9mh7e1ujKmRg';
const SHEET_REGISTROS = 'REGISTROS';
const SHEET_USUARIOS = 'Capturistas';
const AUTH_EXPIRES_AT = '2026-12-31T23:59:59-06:00';

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizarClave(valor) {
  return String(valor || '').trim().toUpperCase();
}

function login(clave, pin) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) return { ok: false, message: 'No existe la hoja Capturistas' };

  const data = sheet.getDataRange().getDisplayValues();
  const claveBuscada = normalizarClave(clave);
  const pinBuscado = String(pin || '').trim();

  for (let i = 1; i < data.length; i++) {
    const c = normalizarClave(data[i][0]);
    const nombre = String(data[i][1] || '').trim();
    const storedPin = String(data[i][2] || '').trim();
    const perfil = String(data[i][3] || 'Capturista').trim();
    const activo = data[i].length > 4 ? String(data[i][4] || 'Sí').trim().toLowerCase() : 'sí';

    if (c === claveBuscada && storedPin === pinBuscado) {
      if (['no', '0', 'false', 'inactivo'].includes(activo)) {
        return { ok: false, message: 'Usuario inactivo' };
      }
      return {
        ok: true,
        clave: c,
        nombre: nombre,
        perfil: perfil,
        expires_at: AUTH_EXPIRES_AT
      };
    }
  }
  return { ok: false, message: 'Capturista o PIN incorrecto' };
}

function guardarRegistro(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_REGISTROS);
    if (!sheet) return { ok: false, message: 'No existe la hoja REGISTROS' };

    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) return { ok: false, message: 'La hoja REGISTROS no tiene encabezados' };
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const row = headers.map(header => {
      const value = data[header];
      if (value === undefined || value === null) return '';
      return (typeof value === 'object') ? JSON.stringify(value) : value;
    });
    sheet.appendRow(row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function parseRequest(e) {
  if (!e) return {};
  if (e.parameter && Object.keys(e.parameter).length && e.parameter.action) return e.parameter;
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); }
    catch (err) { return e.parameter || {}; }
  }
  return e.parameter || {};
}

function doPost(e) {
  try {
    const data = parseRequest(e);
    if (data.action === 'login') return json(login(data.clave, data.pin));
    if (data.action === 'registro' || data['No.'] || data.ID) return json(guardarRegistro(data));
    return json({ ok: false, message: 'Acción no válida' });
  } catch (err) {
    return json({ ok: false, message: err.message });
  }
}

function doGet() {
  return json({ ok: true, message: 'CUSCO API v1.3.0 activa' });
}

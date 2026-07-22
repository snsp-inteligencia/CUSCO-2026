const SPREADSHEET_ID = '1sJDfmG1GaFryedHgv_PPJd7Xe64OPIi9mh7e1ujKmRg';

const SHEET_REGISTROS = 'REGISTROS';
const SHEET_USUARIOS = 'Capturistas';
const AUTH_EXPIRES_AT = '2026-12-31T23:59:59-06:00';

const FOLIO_PREFIX = 'CUSCO-QRO-';
const FOLIO_DIGITS = 5;
const PROPERTY_LAST_FOLIO = 'CUSCO_LAST_FOLIO_NUMBER';

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizarClave(valor) {
  return String(valor || '').trim().toUpperCase();
}

function login(clave, pin, deviceId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USUARIOS);

  if (!sheet) return {ok:false,message:'No existe la hoja Capturistas'};

  const data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) return {ok:false,message:'No existen capturistas registrados'};

  const encabezados = data[0].map(function(valor) {
    return String(valor || '').trim().toLowerCase();
  });

  const columnaClave = encabezados.indexOf('clave');
  const columnaNombre = encabezados.indexOf('nombre');
  const columnaPin = encabezados.indexOf('pin');
  const columnaPerfil = encabezados.indexOf('perfil');
  const columnaActivo = encabezados.indexOf('activo');
  const columnaUltimoAcceso = encabezados.indexOf('ultimo_acceso');
  const columnaDispositivo = encabezados.indexOf('dispositivo_autorizado');

  if (columnaClave === -1 || columnaNombre === -1 || columnaPin === -1 || columnaPerfil === -1) {
    return {ok:false,message:'Faltan columnas obligatorias en la hoja Capturistas'};
  }

  const claveBuscada = normalizarClave(clave);
  const pinBuscado = String(pin || '').trim();

  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    const claveRegistrada = normalizarClave(fila[columnaClave]);
    const nombre = String(fila[columnaNombre] || '').trim();
    const pinRegistrado = String(fila[columnaPin] || '').trim();
    const perfil = String(fila[columnaPerfil] || 'Capturista').trim();
    const activo = columnaActivo >= 0
      ? String(fila[columnaActivo] || 'SI').trim().toLowerCase()
      : 'si';

    if (claveRegistrada === claveBuscada && pinRegistrado === pinBuscado) {
      if (['no','0','false','inactivo'].includes(activo)) {
        return {ok:false,message:'Usuario inactivo'};
      }

      const numeroFila = i + 1;

      if (columnaUltimoAcceso >= 0) {
        sheet.getRange(numeroFila, columnaUltimoAcceso + 1)
          .setValue(new Date())
          .setNumberFormat('dd/MM/yyyy HH:mm:ss');
      }

      if (columnaDispositivo >= 0) {
        sheet.getRange(numeroFila, columnaDispositivo + 1).setValue('SI');
      }

      SpreadsheetApp.flush();

      return {
        ok:true,
        clave:claveRegistrada,
        nombre:nombre,
        perfil:perfil,
        device_id:String(deviceId || ''),
        expires_at:AUTH_EXPIRES_AT
      };
    }
  }

  return {ok:false,message:'Capturista o PIN incorrecto'};
}

/**
 * Revisa la hoja únicamente cuando todavía no existe el contador interno.
 * Después, el consecutivo se obtiene desde PropertiesService y ya no recorre
 * la columna Folio en cada registro.
 */
function inicializarConsecutivoSiHaceFalta(sheet, headers) {
  const properties = PropertiesService.getScriptProperties();
  const guardado = properties.getProperty(PROPERTY_LAST_FOLIO);

  if (guardado !== null && guardado !== '') {
    const numero = Number(guardado);
    if (Number.isInteger(numero) && numero >= 0) return numero;
  }

  const columnaFolio = headers.findIndex(function(header) {
    return String(header || '').trim().toLowerCase() === 'folio';
  });

  if (columnaFolio === -1) {
    throw new Error('No existe la columna Folio en la hoja REGISTROS');
  }

  let maximo = 0;
  const ultimaFila = sheet.getLastRow();

  if (ultimaFila >= 2) {
    const valores = sheet
      .getRange(2, columnaFolio + 1, ultimaFila - 1, 1)
      .getDisplayValues()
      .flat();

    valores.forEach(function(valor) {
      const match = String(valor || '').trim().match(/^CUSCO-QRO-(\d{5})$/i);
      if (match) maximo = Math.max(maximo, Number(match[1]));
    });
  }

  properties.setProperty(PROPERTY_LAST_FOLIO, String(maximo));
  return maximo;
}

function reservarSiguienteFolio(sheet, headers) {
  const properties = PropertiesService.getScriptProperties();
  const actual = inicializarConsecutivoSiHaceFalta(sheet, headers);
  const siguiente = actual + 1;

  if (siguiente > 99999) {
    throw new Error('Se agotó el consecutivo de cinco dígitos');
  }

  properties.setProperty(PROPERTY_LAST_FOLIO, String(siguiente));
  return FOLIO_PREFIX + String(siguiente).padStart(FOLIO_DIGITS, '0');
}

/**
 * Utilidad administrativa:
 * vuelve a calcular el contador interno tomando como referencia la hoja.
 * Se ejecuta manualmente desde Apps Script solo cuando se editan folios
 * directamente en Google Sheets o se reemplaza la base.
 */
function sincronizarConsecutivoDesdeHoja() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_REGISTROS);
    if (!sheet) throw new Error('No existe la hoja REGISTROS');

    const lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const columnaFolio = headers.findIndex(function(header) {
      return String(header || '').trim().toLowerCase() === 'folio';
    });

    if (columnaFolio === -1) {
      throw new Error('No existe la columna Folio en la hoja REGISTROS');
    }

    let maximo = 0;
    const ultimaFila = sheet.getLastRow();

    if (ultimaFila >= 2) {
      const valores = sheet
        .getRange(2, columnaFolio + 1, ultimaFila - 1, 1)
        .getDisplayValues()
        .flat();

      valores.forEach(function(valor) {
        const match = String(valor || '').trim().match(/^CUSCO-QRO-(\d{5})$/i);
        if (match) maximo = Math.max(maximo, Number(match[1]));
      });
    }

    PropertiesService.getScriptProperties()
      .setProperty(PROPERTY_LAST_FOLIO, String(maximo));

    return {
      ok:true,
      ultimoNumero:maximo,
      siguienteFolio:FOLIO_PREFIX + String(maximo + 1).padStart(FOLIO_DIGITS, '0')
    };
  } finally {
    lock.releaseLock();
  }
}

function obtenerTotalEncuestas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_REGISTROS);
  if (!sheet) return 0;
  return Math.max(sheet.getLastRow() - 1, 0);
}

function guardarRegistro(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_REGISTROS);

    if (!sheet) return {ok:false,message:'No existe la hoja REGISTROS'};

    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) return {ok:false,message:'La hoja REGISTROS no tiene encabezados'};

    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const folio = reservarSiguienteFolio(sheet, headers);

    const registro = Object.assign({}, data, {
      Folio: folio,
      CURP: data.CURP || data.ID || ''
    });

    const row = headers.map(function(header) {
      const value = registro[header];
      if (value === undefined || value === null) return '';
      return typeof value === 'object' ? JSON.stringify(value) : value;
    });

    try {
      sheet.appendRow(row);
      SpreadsheetApp.flush();
    } catch (errorGuardado) {
      // Si falló la escritura, devuelve el consecutivo para que pueda reutilizarse.
      const properties = PropertiesService.getScriptProperties();
      const actual = Number(properties.getProperty(PROPERTY_LAST_FOLIO) || 0);
      const numeroReservado = Number(folio.replace(FOLIO_PREFIX, ''));
      if (actual === numeroReservado) {
        properties.setProperty(PROPERTY_LAST_FOLIO, String(Math.max(numeroReservado - 1, 0)));
      }
      throw errorGuardado;
    }

    return {
      ok:true,
      folio:folio,
      total:Math.max(sheet.getLastRow() - 1, 0)
    };
  } finally {
    lock.releaseLock();
  }
}

function parseRequest(e) {
  if (!e) return {};

  if (e.parameter && Object.keys(e.parameter).length && e.parameter.action) {
    return e.parameter;
  }

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      return e.parameter || {};
    }
  }

  return e.parameter || {};
}

function doPost(e) {
  try {
    const data = parseRequest(e);

    if (data.action === 'login') {
      return json(login(data.clave, data.pin, data.device_id));
    }

    if (data.action === 'contador') {
      return json({ok:true,total:obtenerTotalEncuestas()});
    }

    if (data.action === 'registro' || data.Folio !== undefined || data.CURP !== undefined || data.ID) {
      return json(guardarRegistro(data));
    }

    return json({ok:false,message:'Acción no válida'});
  } catch (err) {
    return json({ok:false,message:err.message});
  }
}

function doGet() {
  return json({
    ok:true,
    message:'CUSCO API v1.3.7 activa',
    total:obtenerTotalEncuestas()
  });
}

// ===== GOOGLE APPS SCRIPT PARA ARQUEODENUNCIA =====
// Compatible con el formulario actualizado
// 
// INSTRUCCIONES:
// 1. Abre https://script.google.com/
// 2. Reemplaza el código existente con este
// 3. Configura EMAIL_ADMIN
// 4. IMPORTANTE: Ejecuta la función "testEnvioEmail" para autorizar permisos
// 5. Despliega como "Aplicación web" (Implementar > Nueva implementación)

// ===== CONFIGURACIÓN =====
const SHEET_ID = "18QnC_guIZsmiq-c81AS0T3NaKVgiFDLD2nJKS2WmYMc";
const SHEET_NAME = "Respuestas";
const EMAIL_ADMIN = "arqueotimes@gmail.com";

// ===== FUNCIÓN DE PRUEBA - EJECUTAR PRIMERO PARA AUTORIZAR =====
function testEnvioEmail() {
  MailApp.sendEmail({
    to: EMAIL_ADMIN,
    subject: "[ArqueoDenuncia] Test de conexión",
    body: "Si recibes este email, el sistema de notificaciones está funcionando correctamente.\n\nFecha: " + new Date().toLocaleString("es-ES")
  });
  Logger.log("Email de prueba enviado a: " + EMAIL_ADMIN);
}

function doGet() {
  return ContentService
    .createTextOutput("OK ArqueoDenuncia WebApp")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    let payload = {};

    // FormData: payload=...
    if (e?.parameter?.payload) {
      payload = JSON.parse(e.parameter.payload);
    }
    // JSON puro
    else if (e?.postData?.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    Logger.log("Payload recibido: " + JSON.stringify(payload));

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Añadir cabeceras
      sheet.appendRow([
        "Fecha", "Hora", "Anónimo", "Seguimiento", "Contacto", "Relación",
        "Categorías", "Tipo Dónde", "Ref Dónde", "Tipo Cuándo", "Ref Cuándo",
        "Resumen", "Fuentes", "Tiene Evidencia", "Tipos Acoso", "Narrativa Acoso",
        "Tipo Patrimonio", "Riesgo Patrimonio", "Narrativa Patrimonio"
      ]);
    }

    const now = new Date();
    const fecha = Utilities.formatDate(now, "Europe/Madrid", "yyyy-MM-dd");
    const hora  = Utilities.formatDate(now, "Europe/Madrid", "HH:mm:ss");

    // role ahora es un array
    const roleStr = Array.isArray(payload.role) ? payload.role.join(", ") : (payload.role || "");

    const row = [
      fecha, hora,
      payload.anon || "",
      payload.followup || "",
      payload.contact || "",
      roleStr,
      (payload.categories || []).join(", "),
      payload.whereType || "",
      payload.whereRef || "",
      payload.whenType || "",
      payload.whenRef || "",
      payload.summary || "",
      payload.sourcesText || "",
      (payload.hasEvidence || []).join(", "),
      (payload.harassmentKinds || []).join(", "),
      payload.harassmentNarrative || "",
      payload.heritageType || "",
      (payload.heritageRisk || []).join(", "),
      payload.heritageNarrative || ""
    ];

    sheet.appendRow(row);
    Logger.log("Fila añadida correctamente");

    // Enviar email de respaldo al admin - SIEMPRE
    try {
      Logger.log("Intentando enviar email a: " + EMAIL_ADMIN);
      enviarEmailAdmin(payload, fecha, hora);
      Logger.log("Email enviado correctamente");
    } catch (emailErr) {
      Logger.log("Error al enviar email: " + emailErr.toString());
    }

    // Enviar confirmación al usuario si dejó email (siempre que haya contacto)
    if (payload.contact) {
      try {
        enviarEmailUsuario(payload, fecha, hora);
        Logger.log("Email al usuario enviado");
      } catch (userEmailErr) {
        Logger.log("Error email usuario: " + userEmailErr.toString());
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error general: " + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, status: "error", error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function enviarEmailAdmin(payload, fecha, hora) {
  const categorias = (payload.categories || []).join(", ") || "No especificadas";
  const roleStr = Array.isArray(payload.role) ? payload.role.join(", ") : (payload.role || "No especificada");
  
  const cuerpo = `
NUEVA DENUNCIA RECIBIDA - ArqueoDenuncia
========================================
Fecha: ${fecha} ${hora}

CONFIGURACIÓN DEL INFORMANTE
- Anónimo: ${payload.anon === "si" ? "Sí" : "No"}
- Quiere seguimiento: ${payload.followup === "si" ? "Sí" : "No"}
- Contacto: ${payload.contact || "No proporcionado"}
- Relación con el caso: ${roleStr}

CLASIFICACIÓN
- Categorías: ${categorias}

CONTEXTO
- Dónde: ${payload.whereType || "—"} ${payload.whereRef ? "(" + payload.whereRef + ")" : ""}
- Cuándo: ${payload.whenType || "—"} ${payload.whenRef ? "(" + payload.whenRef + ")" : ""}

RESUMEN
${payload.summary || "(Sin resumen)"}

${payload.harassmentKinds && payload.harassmentKinds.length > 0 ? `
BLOQUE: ACOSO/DISCRIMINACIÓN
- Tipos: ${payload.harassmentKinds.join(", ")}
- Narrativa: ${payload.harassmentNarrative || "(Sin detalle)"}
` : ""}

${payload.heritageType ? `
BLOQUE: PATRIMONIO
- Tipo de lugar: ${payload.heritageType}
- Riesgos: ${(payload.heritageRisk || []).join(", ")}
- Narrativa: ${payload.heritageNarrative || "(Sin detalle)"}
` : ""}

FUENTES Y EVIDENCIAS
- Tipos de evidencia: ${(payload.hasEvidence || []).join(", ") || "Ninguna"}
- Descripción: ${payload.sourcesText || "(Sin descripción)"}

========================================
Este email es un respaldo automático del formulario ArqueoDenuncia.
  `;
  
  MailApp.sendEmail({
    to: EMAIL_ADMIN,
    subject: `[ArqueoDenuncia] Nueva comunicación - ${categorias}`,
    body: cuerpo
  });
}

function enviarEmailUsuario(payload, fecha, hora) {
  if (!payload.contact) return;
  
  const categorias = (payload.categories || []).join(", ") || "No especificadas";
  const roleStr = Array.isArray(payload.role) ? payload.role.join(", ") : (payload.role || "No especificada");
  
  const cuerpo = `
Hola,

Hemos recibido tu comunicación a través de ArqueoDenuncia.

Este es un acuse de recibo automático. ${payload.followup === "si" ? "Como solicitaste seguimiento, el equipo de ArqueoTimes revisará tu caso y se pondrá en contacto contigo." : ""}

========================================
RESUMEN DE TU COMUNICACIÓN
========================================

Fecha de envío: ${fecha} ${hora}

CONFIGURACIÓN
- Anónimo: ${payload.anon === "si" ? "Sí" : "No"}
- Seguimiento solicitado: ${payload.followup === "si" ? "Sí" : "No"}
- Tu relación con el caso: ${roleStr}

CLASIFICACIÓN
- Categorías: ${categorias}

CONTEXTO
- Dónde: ${payload.whereType || "—"} ${payload.whereRef ? "(" + payload.whereRef + ")" : ""}
- Cuándo: ${payload.whenType || "—"} ${payload.whenRef ? "(" + payload.whenRef + ")" : ""}

TU RESUMEN
${payload.summary || "(Sin resumen)"}

${payload.harassmentKinds && payload.harassmentKinds.length > 0 ? `
ACOSO/DISCRIMINACIÓN
- Tipos: ${payload.harassmentKinds.join(", ")}
- Detalle: ${payload.harassmentNarrative || "(Sin detalle)"}
` : ""}

${payload.heritageType ? `
PATRIMONIO
- Tipo de lugar: ${payload.heritageType}
- Riesgos: ${(payload.heritageRisk || []).join(", ")}
- Detalle: ${payload.heritageNarrative || "(Sin detalle)"}
` : ""}

FUENTES Y EVIDENCIAS
- Tipos: ${(payload.hasEvidence || []).join(", ") || "Ninguna"}
- Descripción: ${payload.sourcesText || "(Sin descripción)"}

========================================

Gracias por ayudarnos a proteger el patrimonio arqueológico y a defender los derechos de los profesionales del sector.

Si tienes alguna duda o necesitas añadir información, puedes responder a este correo.

---
ArqueoTimes · ArqueoDenuncia
https://arqueotimes.es
  `;
  
  MailApp.sendEmail({
    to: payload.contact,
    subject: "ArqueoDenuncia - Hemos recibido tu comunicación",
    body: cuerpo
  });
}

const ALLOWED_HOST = 'smai-support.jo3.org';

function doPost(e) {
  try {
    const input = JSON.parse((e.postData && e.postData.contents) || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('SMAI_MAIL_SECRET');
    if (!secret || input.secret !== secret) return output({ ok: false, error: 'unauthorized' });
    if (!/^\S+@\S+\.\S+$/.test(String(input.to || ''))) return output({ ok: false, error: 'recipient' });
    if (!input.subject || !input.html || input.html.length > 100000) return output({ ok: false, error: 'payload' });
    if (String(input.html).includes('<script') || !String(input.html).includes(ALLOWED_HOST)) return output({ ok: false, error: 'content' });
    GmailApp.sendEmail(String(input.to), String(input.subject).slice(0, 180), 'לצפייה בהודעה יש לפתוח אותה ביישום דואר התומך ב-HTML.', {
      htmlBody: String(input.html),
      name: String(input.fromName || 'SMAI Sytem').slice(0, 80)
    });
    return output({ ok: true });
  } catch (error) {
    return output({ ok: false, error: 'failed' });
  }
}

function output(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

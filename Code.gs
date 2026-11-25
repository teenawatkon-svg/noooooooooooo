/**
 * Bami Bowl — รับออเดอร์จากเว็บแล้วบันทึกลง Google Sheet
 *
 * วิธีใช้: เปิดชีต > ส่วนขยาย > Apps Script > วางโค้ดนี้
 * แล้ว Deploy > New deployment > Web app
 *   Execute as: Me | Who has access: Anyone
 * (ถ้าใช้ URL เดิมอยู่ ให้ Manage deployments > แก้ไข > New version)
 *
 * แถวแรกของชีตต้องเป็นหัวคอลัมน์ (ตัวพิมพ์ตรงตามนี้):
 * timestamp | orderId | customerName | contact | address | items | skuList | total | note
 */

const SHEET_NAME = 'Sheet1';
const HEADERS = ['timestamp', 'orderId', 'customerName', 'contact', 'address', 'items', 'skuList', 'total', 'note'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });

    const now = new Date();
    const nextRow = sheet.getLastRow() + 1;
    data.timestamp = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    data.orderId = 'ORD-' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyMMdd') + '-' +
      String(nextRow - 1).padStart(4, '0');

    // เรียงค่าตามหัวคอลัมน์ในชีต (คอลัมน์ไหนไม่มีข้อมูลจะเว้นว่าง)
    const row = headers.map(function (h) {
      return data[h] === undefined || data[h] === null ? '' : String(data[h]).slice(0, 2000);
    });

    // ตั้งเป็นข้อความทั้งแถว: เบอร์โทรไม่ถูกตัดเลข 0 ตัวหน้า และกันสูตรที่ขึ้นต้นด้วย = + - @
    sheet.getRange(nextRow, 1, 1, row.length).setNumberFormat('@').setValues([row]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, orderId: data.orderId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Bami Bowl order endpoint is running.');
}

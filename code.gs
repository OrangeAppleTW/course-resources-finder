/**
 * 這是一個 GET 請求的處理函式。
 * 當 Web App 的 URL 被訪問時，這個函式會被觸發。
 * e: 事件物件，包含了請求的相關資訊，例如 URL 參數。
 */
function doGet(e) {
  // 1. 從 URL 取得查詢參數
  const params = e.parameter;
  const action = params.action; // 新增：用於取得清單資料
  const course = params.課程;
  const lesson = params.課堂;
  const chapter = params.章節;
  const providedPin = String(params['密碼'] || params['pin'] || '').trim();
  const uuid = String(params['uuid'] || '').trim();

  // A) 若為清單查詢，提早回傳
  if (action === 'list') {
    try {
      const level = params.level; // course | lesson | chapter
      const data = getSheetData_();

      // 去掉表頭
      const header = data.shift();

      // 以標題名稱建立欄位索引（容錯：不論是否仍存在舊的「密碼」欄位）
      const idx = makeHeaderIndex_(header);
  const idxCourse = idx['課程'];
  const idxLesson = idx['課堂'];
  const idxChapter = idx['章節'];
  const idxLink = idx['連結'];

      // 幫助函式：安全地比對（以字串比較）
      const eq = (a, b) => String(a) === String(b);

      if (level === 'course') {
        // 取出課程
        const items = [...new Set(
          data.map(r => String(r[idxCourse])).filter(Boolean)
        )].sort();
        return createJsonResponse({ status: 'success', items });
      }

      if (level === 'lesson') {
        if (!course) {
          return createJsonResponse({ status: 'error', message: "缺少參數：課程" });
        }
        // 取出指定課程的課堂
        const items = [...new Set(
          data
            .filter(r => eq(r[idxCourse], course))
            .map(r => String(r[idxLesson]))
            .filter(Boolean)
        )].sort((a, b) => Number(a) - Number(b));
        return createJsonResponse({ status: 'success', items });
      }

  if (level === 'chapter') {
        if (!course || !lesson) {
          return createJsonResponse({ status: 'error', message: "缺少參數：課程 或 課堂" });
        }
        // 取出指定課程+課堂的章節
        const items = [...new Set(
          data
    .filter(r => eq(r[idxCourse], course) && eq(r[idxLesson], lesson))
    .filter(r => String(r[idxLink] || '').trim() !== '') // 僅保留有連結的章節
    .map(r => String(r[idxChapter]))
            .filter(Boolean)
        )].sort((a, b) => Number(a) - Number(b));
        return createJsonResponse({ status: 'success', items });
      }

      return createJsonResponse({ status: 'error', message: "未知的 level，請使用 course | lesson | chapter" });
    } catch (error) {
      return createJsonResponse({ status: 'error', message: '伺服器發生錯誤：' + error.message });
    }
  }

  // B) 若為 PIN 查詢（教師端用於顯示當日 PIN），提早回傳
  if (action === 'pin') {
    if (!course || !lesson || !chapter) {
      return createJsonResponse({ status: 'error', message: "缺少參數：課程/課堂/章節" });
    }
    // 需要教師邀請碼驗證
    if (!uuid) {
      return createJsonResponse({ status: 'forbidden', message: '缺少邀請碼。' });
    }
    if (!checkTeacherUUID_(uuid)) {
      return createJsonResponse({ status: 'forbidden', message: '邀請碼錯誤，無法取得 PIN。' });
    }
    try {
      const pin = computePin_(course, lesson, chapter);
  // 不再回傳 salt，避免外洩
  return createJsonResponse({ status: 'success', pin });
    } catch (error) {
      return createJsonResponse({ status: 'error', message: '伺服器發生錯誤：' + error.message });
    }
  }

  // C) 教師端 UUID 驗證（保護教師介面）
  if (action === 'teacher_auth') {
    try {
      if (!uuid) {
        return createJsonResponse({ status: 'forbidden', message: '缺少邀請碼。' });
      }
      const ok = checkTeacherUUID_(uuid);
      if (!ok) {
        return createJsonResponse({ status: 'forbidden', message: '邀請碼錯誤，請確認後重試。' });
      }
      return createJsonResponse({ status: 'success' });
    } catch (error) {
      return createJsonResponse({ status: 'error', message: '伺服器發生錯誤：' + error.message });
    }
  }

  // 2. 檢查是否所有必要的參數都提供了
  if (!course || !lesson || !chapter) {
    return createJsonResponse({
      "status": "error",
      "message": "請求錯誤：請確認提供了 '課程', '課堂', '章節' 參數。"
    });
  }

  try {
    // 3. 存取 Google Sheet 的資料
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
    // 取得工作表中除了標題列以外的所有資料
    const data = sheet.getDataRange().getValues();
    const header = data.shift(); // 取出並移除標題列

    // 以標題建立索引（支援移除「密碼」欄位後的新結構）
    const idx = makeHeaderIndex_(header);
    const idxCourse = idx['課程'];
    const idxLesson = idx['課堂'];
    const idxChapter = idx['章節'];
    const idxLink = idx['連結'];

    // 3.5 最終 PIN 驗證（以課程/課堂/章節產生 4 位數並比對）
  const expectedPin = computePin_(course, lesson, chapter);
    if (providedPin !== expectedPin) {
      return createJsonResponse({
        status: 'forbidden',
        message: '密碼錯誤或缺少密碼。'
      });
    }

    // 4. 遍歷資料，尋找符合條件的所有行（不再驗證密碼）
    const links = [];
    for (const row of data) {
      const matchCourse = String(row[idxCourse]) === String(course);
      const matchLesson = String(row[idxLesson]) === String(lesson);
      const matchChapter = String(row[idxChapter]) === String(chapter);

      if (!(matchCourse && matchLesson && matchChapter)) continue;
      const link = row[idxLink];
      if (link) links.push(String(link));
    }
    // 去重
    const uniqueLinks = Array.from(new Set(links));
    if (uniqueLinks.length > 0) {
      return createJsonResponse({
        status: 'success',
        link: uniqueLinks[0], // 相容舊前端
        links: uniqueLinks
      });
    }

    // 7. 如果迴圈跑完都沒找到，回傳找不到資料的訊息
    return createJsonResponse({
      "status": "not_found",
      "message": "找不到對應的資料。"
    });

  } catch (error) {
    // 7. 如果過程中發生任何錯誤，回傳錯誤訊息
    return createJsonResponse({
      "status": "error",
      "message": "伺服器發生錯誤：" + error.message
    });
  }
}

/**
 * 輔助函式：建立一個 JSON 格式的回應
 * @param {Object} obj - 要轉換成 JSON 字串的物件
 * @return {GoogleAppsScript.Content.TextOutput} - JSON 格式的回應
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 讀取整個工作表內容
 * @return {any[][]}
 */
function getSheetData_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
  return sheet.getDataRange().getValues();
}

/**
 * 依據標題列建立欄位索引對照表
 * 支援任意欄位順序與是否存在舊的「密碼」欄位
 * @param {any[]} header
 * @return {Object<string, number>}
 */
function makeHeaderIndex_(header) {
  const map = {};
  header.forEach((h, i) => {
    const key = String(h).trim();
    map[key] = i;
  });
  // 基本欄位檢查
  const required = ['課程', '課堂', '章節', '連結'];
  for (const k of required) {
    if (typeof map[k] !== 'number') {
      throw new Error('工作表缺少必要欄位：' + k);
    }
  }
  return map;
}

/**
 * 以課程/課堂/章節組合產生穩定 6 位數 PIN（FNV-1a 32-bit mod 1,000,000）
 */
function computePin_(course, lesson, chapter) {
  const s = String(course) + '|' + String(lesson) + '|' + String(chapter) + '|' + getAdminSalt_();
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    // 乘以 FNV prime 0x01000193 並保留 32-bit 無號
    hash = (hash >>> 0) * 0x01000193 >>> 0;
  }
  const pin = ((hash % 1000000) + 1000000) % 1000000; // 0..999999
  return ('000000' + pin).slice(-6);
}

/**
 * 取得當日的鹽值（依 Apps Script 腳本時區取 yyyy-MM-dd）
 * 確保每天 00:00 該時區切換 PIN。
 */
function currentSalt_() {
  var tz = Session.getScriptTimeZone() || 'Asia/Taipei';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

/**
 * 從 admin 工作表讀取 salt 欄位（第一列為標題，欄名為 'salt'），
 * 取第一個非空資料列的值並「原樣回傳」。
 * 不做任何日期格式化或字串正規化；若缺失或無值，直接拋出錯誤。
 */
function getAdminSalt_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('admin');
  if (!sheet) throw new Error('找不到工作表：admin');
  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) throw new Error('admin 工作表沒有資料列可用');
  const header = values[0].map(v => String(v).trim());
  const idx = header.indexOf('salt');
  if (idx === -1) throw new Error('admin 工作表缺少欄位：salt');
  for (let i = 1; i < values.length; i++) {
    const raw = values[i][idx];
    if (raw === null || raw === undefined) continue;
    if (String(raw).trim() === '') continue;
    return raw; // 原樣回傳
  }
  throw new Error('admin 工作表 salt 欄位沒有有效值');
}

/**
 * 檢查教師端邀請碼是否存在於試算表的 teacher 工作表中
 * 需有一欄名為「教師端介面邀請碼」，逐列比對
 * @param {string} uuid
 * @return {boolean}
 */
function checkTeacherUUID_(uuid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('admin');
  if (!sheet) {
    throw new Error('找不到工作表：admin');
  }
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return false;
  const header = values[0].map(v => String(v).trim());
  const colIdx = header.indexOf('教師端介面邀請碼');
  if (colIdx === -1) throw new Error('admin 工作表缺少欄位：教師端介面邀請碼');
  for (let i = 1; i < values.length; i++) {
    const val = String(values[i][colIdx]).trim();
    if (val && val === uuid) return true;
  }
  return false;
}

// === Google Apps Script 後端 API (code.gs) ===
// 用途：部署為 Web App 後，作為本機前端管理系統與 Google Sheet 試算表之間的同步橋樑。

const SHEET_NAME = 'Sheet1';
const TODOS_SHEET_NAME = 'Todos';
const CUSTOMERS_SHEET_NAME = 'Customers';

// 取得或初始化試算表與表頭
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  const targetHeaders = [
    "客戶姓名", "客戶ID", "邀約議題", "險種分類", "預計議題", "ＳＡ", "是否已讀", "是否已回覆", 
    "約定狀態", "已約定", "約定時段", "ＯＡ", "ＯＡ已面談", "ＯＡ時段", "ＯＡ訪前規劃狀態", 
    "ＯＡ訪前演練狀態", "ＯＡ訪後討論狀態", "ＯＡ訪前規劃備忘", "ＯＡ訪後討論備忘", "ＯＡ改期歷史",
    "ＯＡ訪前規劃日期", "ＯＡ訪前演練日期", "ＯＡ訪後討論日期", "ＯＡ訪前演練備忘",
    "ＰＣ", "ＰＣ已遞送", "ＰＣ時段", "ＰＣ訪前規劃狀態", "ＰＣ訪前演練狀態", 
    "ＰＣ訪後討論狀態", "ＰＣ訪後討論備忘", "ＰＣ改期歷史",
    "ＰＣ規劃建議日期", "ＰＣ講解演練日期", "ＰＣ已傳建議日期", "ＰＣ規劃建議備忘", "ＰＣ講解演練備忘",
    "Ｃ", "Ｃ已成交", "Ｃ文件準備狀態", 
    "Ｃ文件準備備忘", "Ｃ文件準備日期", "Ｃ簽約狀態", "Ｃ簽約日期", "Ｃ補件狀態", "Ｃ補件日期", "Ｃ送件狀態", "Ｃ送件日期", "Ｃ送件已處理", "Ｃ要保簽署狀態", "Ｃ要保簽署日期", "Ｃ保費首扣狀態", "Ｃ保費首扣日期", "Ｃ保費首扣備忘", "Ｃ改期歷史",
    "Ｓ", "Ｓ保單送達狀態", "Ｓ保單送達備忘", "Ｓ契撤追蹤狀態", "Ｓ週年服務狀態", 
    "Ｓ週年服務備忘", "當前階段", "開拓管道", "客戶來源", "介紹人", "緣故標籤", "ＳＡ備忘", "是否封存", "聯絡資訊", "備註", "議題發想備忘", "Ｃ時段", "Ｓ時段",
    "ＯＡ現場任務", "ＰＣ現場任務", "Ｃ現場任務", "Ｓ現場任務", "訪談類型", "最後更新時間"
  ];
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(targetHeaders);
    // 凍結第一行表頭
    sheet.setFrozenRows(1);
  } else {
    // 讀取目前現有的表頭
    const lastCol = sheet.getLastColumn() || 1;
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    let existingHeaders = headerRange.getValues()[0];
    
    // 清理並標準化現有表頭字串
    existingHeaders = existingHeaders.map(h => (h || "").toString().trim());
    
    // 1. 自動把舊的「Ｃ照會防範...」欄位更名為「Ｃ文件準備...」
    const oldStateIdx = existingHeaders.indexOf("Ｃ照會防範狀態");
    if (oldStateIdx !== -1) {
      sheet.getRange(1, oldStateIdx + 1).setValue("Ｃ文件準備狀態");
      existingHeaders[oldStateIdx] = "Ｃ文件準備狀態";
    }
    const oldMemoIdx = existingHeaders.indexOf("Ｃ照會防範備忘");
    if (oldMemoIdx !== -1) {
      sheet.getRange(1, oldMemoIdx + 1).setValue("Ｃ文件準備備忘");
      existingHeaders[oldMemoIdx] = "Ｃ文件準備備忘";
    }

    // 2. 檢查追加其他可能缺少的欄位，使用變數 nextCol 防止重複覆蓋最後一欄
    let nextCol = lastCol + 1;
    const columnsToCheck = [
      "客戶ID",
      "ＳＡ備忘", "是否封存", "聯絡資訊", "備註", "議題發想備忘", "Ｃ時段", "Ｓ時段",
      "Ｃ文件準備狀態", "Ｃ文件準備備忘", "Ｃ文件準備日期", "Ｃ簽約狀態", "Ｃ簽約日期", "Ｃ補件狀態", "Ｃ補件日期", "Ｃ送件狀態", "Ｃ送件日期", "Ｃ送件已處理", "Ｃ要保簽署狀態", "Ｃ要保簽署日期", "Ｃ保費首扣狀態", "Ｃ保費首扣日期", "Ｃ保費首扣備忘", "Ｃ改期歷史",
      "ＯＡ訪前規劃日期", "ＯＡ訪前演練日期", "ＯＡ訪後討論日期", "ＯＡ訪前演練備忘",
      "ＰＣ規劃建議日期", "ＰＣ講解演練日期", "ＰＣ已傳建議日期", "ＰＣ規劃建議備忘", "ＰＣ講解演練備忘",
      "ＯＡ現場任務", "ＰＣ現場任務", "Ｃ現場任務", "Ｓ現場任務"
    ];

    columnsToCheck.forEach(colName => {
      if (existingHeaders.indexOf(colName) === -1) {
        sheet.getRange(1, nextCol).setValue(colName);
        existingHeaders.push(colName);
        nextCol++;
      }
    });
  }
  return sheet;
}


// 取得或建立「客戶基本資料」Sheet
function getOrCreateCustomersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CUSTOMERS_SHEET_NAME);
  const headers = ["id", "name", "phone", "family", "framework", "campaigns", "lastUpdated"];
  if (!sheet) {
    sheet = ss.insertSheet(CUSTOMERS_SHEET_NAME);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// 取得或建立「待辦事項」Sheet
function getOrCreateTodosSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TODOS_SHEET_NAME);
  const headers = ["id", "title", "caseId", "stage", "subTag", "dueDate", "note", "done", "createdAt", "urgent", "important", "totalTimeSpent", "timeLog"];
  if (!sheet) {
    sheet = ss.insertSheet(TODOS_SHEET_NAME);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    // 強制用最新表頭覆蓋第一行，自動把欄位擴展，保證欄位完整存在且順序正確
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// 處理 GET 請求：讀取資料並以 JSON 回傳
function doGet(e) {
  try {
    // === 客戶基本資料讀取 ===
    if (e && e.parameter && e.parameter.type === 'customers') {
      const customersSheet = getOrCreateCustomersSheet();
      const cValues = customersSheet.getDataRange().getValues();
      if (cValues.length <= 1) {
        return jsonResponse({ status: 'success', customers: [] });
      }
      const cHeaders = cValues[0];
      const customersList = [];
      for (let i = 1; i < cValues.length; i++) {
        const row = cValues[i];
        const item = {};
        cHeaders.forEach((h, ci) => {
          let v = row[ci];
          if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          item[h] = v;
        });
        customersList.push(item);
      }
      return jsonResponse({ status: 'success', customers: customersList });
    }

    // === 待辦事項讀取 ===
    if (e && e.parameter && e.parameter.type === 'todos') {
      const todosSheet = getOrCreateTodosSheet();
      const tValues = todosSheet.getDataRange().getValues();
      if (tValues.length <= 1) {
        return jsonResponse({ status: 'success', todos: [] });
      }
      const tHeaders = tValues[0];
      const todosList = [];
      for (let i = 1; i < tValues.length; i++) {
        const row = tValues[i];
        const item = {};
        tHeaders.forEach((h, ci) => {
          let v = row[ci];
          if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
          item[h] = v;
        });
        // 類型轉回布林
        if (typeof item.done === 'string') item.done = item.done === 'true';
        if (item.urgent !== undefined && item.urgent !== '') {
          item.urgent = (item.urgent === true || item.urgent === 'true');
        } else {
          item.urgent = undefined;
        }
        if (item.important !== undefined && item.important !== '') {
          item.important = (item.important === true || item.important === 'true');
        } else {
          item.important = undefined;
        }
        todosList.push(item);
      }
      return jsonResponse({ status: 'success', todos: todosList });
    }

    // === 案件資料讀取（原有邏輯）===
    const isNoCache = e && e.parameter && e.parameter.nocache === 'true';
    if (isNoCache) {
      clearCachedData();
    }

    // 嘗試從快取讀取
    const cachedJSON = isNoCache ? null : getCachedData();
    if (cachedJSON) {
      return ContentService.createTextOutput(cachedJSON)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    const sheet = getOrCreateSheet();
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      const respObj = { status: 'success', data: [] };
      return jsonResponse(respObj);
    }
    
    const headers = values[0];
    const casesList = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const caseItem = {};
      headers.forEach((header, colIndex) => {
        let val = row[colIndex];
        // 格式化日期，防止 Google Sheet 預設的 Date 物件轉為 JSON 時出現時區偏差或格式錯亂
        if (val instanceof Date) {
          // 轉為 YYYY-MM-DD
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        caseItem[header] = val;
      });
      casesList.push(caseItem);
    }
    
    const responseObj = { status: 'success', data: casesList };
    const responseString = JSON.stringify(responseObj);
    
    // 寫入快取
    setCachedData(responseString);
    
    return ContentService.createTextOutput(responseString)
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// 處理 POST 請求：寫入、更新與刪除資料
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // === 客戶基本資料覆蓋式同步 ===
    if (action === 'saveCustomers') {
      const customersSheet = getOrCreateCustomersSheet();
      const customersList = payload.customers || [];
      const headers = ["id", "name", "phone", "family", "framework", "campaigns", "lastUpdated"];
      
      const lastRow = customersSheet.getLastRow();
      if (lastRow > 1) {
        customersSheet.deleteRows(2, lastRow - 1);
      }
      
      if (customersList.length > 0) {
        const rows = customersList.map(c => headers.map(h => {
          return c[h] !== undefined && c[h] !== null ? c[h] : '';
        }));
        customersSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
      return jsonResponse({ status: 'success', message: '客戶基本資料已同步 (' + customersList.length + ' 筆)' });
    }

    // === 待辦事項覆蓋式同步 ===
    if (action === 'saveTodos') {
      const todosSheet = getOrCreateTodosSheet();
      const todosList = payload.todos || [];
      const headers = ["id", "title", "caseId", "stage", "subTag", "dueDate", "note", "done", "createdAt", "urgent", "important", "totalTimeSpent", "timeLog"];
      
      // 清除舊資料（保留第一列表頭）
      const lastRow = todosSheet.getLastRow();
      if (lastRow > 1) {
        todosSheet.deleteRows(2, lastRow - 1);
      }
      
      // 整批寫入新資料
      if (todosList.length > 0) {
        const rows = todosList.map(t => headers.map(h => {
          const v = t[h];
          // done, urgent, important 布林轉為字串儲存
          if (h === 'done' || h === 'urgent' || h === 'important') {
            if (v === true || v === 'true') return 'true';
            if (v === false || v === 'false') return 'false';
            return '';
          }
          return v !== undefined && v !== null ? v : '';
        }));
        todosSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
      return jsonResponse({ status: 'success', message: '待辦事項已同步 (' + todosList.length + ' 筆)' });
    }

    // === 案件資料原有邏輯 ===
    const sheet = getOrCreateSheet();
    const customerName = payload.customerName;
    const data = payload.data;
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // 尋找「客戶姓名」所在的欄位 index
    const nameColIndex = headers.indexOf("客戶姓名");
    if (nameColIndex === -1) {
      throw new Error("試算表中缺少「客戶姓名」欄位！");
    }
    
    // 尋找對應名稱的資料列 (1-indexed for Sheet rows, 使用 trim 防止空格不對齊)
    let targetRowIndex = -1;
    const searchName = customerName ? customerName.toString().trim() : "";
    for (let i = 1; i < values.length; i++) {
      const cellValue = values[i][nameColIndex] ? values[i][nameColIndex].toString().trim() : "";
      if (cellValue === searchName) {
        targetRowIndex = i + 1; // 加上 1 補回 header，再加 1 轉為 1-indexed
        break;
      }
    }
    
    if (action === 'delete') {
      if (targetRowIndex !== -1) {
        sheet.deleteRow(targetRowIndex);
        // 資料變更，清除快取
        clearCachedData();
        return jsonResponse({ status: 'success', message: '已成功刪除案件' });
      } else {
        return jsonResponse({ status: 'error', message: '在試算表中找不到客戶姓名「' + searchName + '」的資料列' });
      }
    }
    
    if (action === 'create' || action === 'add' || action === 'update') {
      if (!data) throw new Error("無資料內容無法寫入");
      
      // 根據 headers 的順序，拼湊出寫入資料列的 rowData
      const rowData = headers.map(header => {
        return data[header] !== undefined ? data[header] : '';
      });
      
      if (action === 'create' || action === 'add') {
        // 如果案件已存在，則轉為更新
        if (targetRowIndex !== -1) {
          sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
      } else if (action === 'update') {
        if (targetRowIndex !== -1) {
          sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([rowData]);
        } else {
          // 若找不到該客戶姓名，但動作是更新，則自動防呆建立新列
          sheet.appendRow(rowData);
        }
      }
      
      // 資料變更，清除快取
      clearCachedData();
      return jsonResponse({ status: 'success', message: '資料寫入/更新成功' });
    }
    
    throw new Error("無效的 action 指令");
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// 封裝 JSON 與 CORS 的 Response
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.TEXT);
}

// === 快取輔助函式 (CacheService) ===
const CACHE_KEY_PREFIX = 'cases_data_';
const CACHE_CHUNKS_KEY = 'cases_data_chunks';

// 取得快取資料 (支援分塊合併)
function getCachedData() {
  const cache = CacheService.getScriptCache();
  const chunksCountStr = cache.get(CACHE_CHUNKS_KEY);
  if (!chunksCountStr) return null;
  
  const chunksCount = parseInt(chunksCountStr, 10);
  let jsonStr = '';
  for (let i = 0; i < chunksCount; i++) {
    const chunk = cache.get(CACHE_KEY_PREFIX + i);
    if (!chunk) return null; // 快取已過期或不完整
    jsonStr += chunk;
  }
  return jsonStr;
}

// 寫入快取資料 (支援分塊防爆，限制為 90KB 以避開 GAS 100KB 上限)
function setCachedData(jsonStr) {
  const cache = CacheService.getScriptCache();
  // 寫入前先清理舊的快取
  clearCachedData();
  
  const chunkSize = 90 * 1024;
  const chunks = [];
  for (let i = 0; i < jsonStr.length; i += chunkSize) {
    chunks.push(jsonStr.substring(i, i + chunkSize));
  }
  
  try {
    for (let i = 0; i < chunks.length; i++) {
      cache.put(CACHE_KEY_PREFIX + i, chunks[i], 21600); // 快取保留 6 小時
    }
    cache.put(CACHE_CHUNKS_KEY, chunks.length.toString(), 21600);
  } catch (e) {
    // 寫入失敗時做優雅降級，防呆清空快取
    clearCachedData();
  }
}

// 清除所有快取資料 (無條件且強制清理 30 個區塊，確保快取 100% 釋放)
function clearCachedData() {
  const cache = CacheService.getScriptCache();
  const keysToRemove = [CACHE_CHUNKS_KEY];
  for (let i = 0; i < 30; i++) {
    keysToRemove.push(CACHE_KEY_PREFIX + i);
  }
  try {
    cache.removeAll(keysToRemove);
  } catch (e) {
    // 忽略潛在的系統層清除異常
  }
}

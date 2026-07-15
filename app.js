// Ｃ送件階段專屬紅黃綠亮燈邏輯與未來呼吸預警樣式輔助
    function getSubmitBtnClass(c) {
      let baseClass = 'sub-tag-btn';
      if (!c || !c.cDetails) return baseClass;
      if (c.cDetails.submitState === 'active') {
        baseClass += ' active c-submit';
      } else if (c.cDetails.submitState === 'ongoing') {
        baseClass += ' ongoing-magenta';
      }
      
      // 若已送件處理，回傳預設樣式
      if (c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        
        // 取得預告天數限制
        const limitDays = (window.crmSettings && window.crmSettings.reminderDaysLimit) ? window.crmSettings.reminderDaysLimit : 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;
        
        // 核心修正：將日期的斜線 / 統一轉換為橫線 -，防範 ASCII 字串大小判定錯亂
        const sDate = c.cDetails.submitDate.replace(/\//g, '-');
        if (sDate < todayStr) {
          return baseClass + ' submit-light-expired'; // 🔴 過期紅燈
        } else if (sDate === todayStr) {
          return baseClass + ' submit-light-today'; // 🟡 當天黃燈
        } else if (sDate > todayStr && sDate <= limitDateStr) {
          return baseClass + ' submit-light-future'; // 🟢 未來綠燈（呼吸發光）
        }
      }
      return baseClass;
    }

    // 定義 debugLog 函數將除錯資訊導向 console.log
    function debugLog(msg) {
      console.log("[DEBUG]", msg);
    }

    // 定義動態 Toast 提示訊息系統
    function showToast(message, type = 'success') {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:100000; display:flex; flex-direction:column; gap:10px;';
        document.body.appendChild(container);
      }
      
      const toast = document.createElement('div');
      toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 8px;
        color: #fff;
        font-size: 0.85rem;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 200px;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      `;
      
      if (type === 'success') {
        toast.style.background = 'rgba(34, 197, 94, 0.9)'; // 亮綠色
        toast.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        toast.innerHTML = `<span>🟢</span> <span>${message}</span>`;
      } else {
        toast.style.background = 'rgba(239, 68, 68, 0.9)'; // 亮紅色
        toast.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        toast.innerHTML = `<span>🔴</span> <span>${message}</span>`;
      }
      
      container.appendChild(toast);
      
      // 動畫切入
      setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
      }, 10);
      
      // 自動淡出銷毀
      setTimeout(() => {
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = '0';
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 3000);
    }

    // window.onerror 已移至 <head> 最頂層 (見頁面頂部)
    // 全域變數用以追蹤並恢復當前開啟的抽屜狀態
    let activeDrawerState = {
      caseId: null,
      section: null
    };

    // 系統連線設定 (存於 LocalStorage)
    let crmSettings;
    try {
      const _crmRaw = localStorage.getItem('crm_settings');
      crmSettings = _crmRaw ? JSON.parse(_crmRaw) : null;
      if (!crmSettings || typeof crmSettings !== 'object') throw new Error('invalid');
    } catch(e) {
      console.warn('crm_settings 快取損毀，已重置', e);
      crmSettings = { apiUrl: '', isOffline: true };
    }

    // 補齊自訂規則與排序模式之預設值
    if (!crmSettings.currentSortMode) {
      crmSettings.currentSortMode = 'manual';
    }
    if (!crmSettings.customSubTagPriority) {
      crmSettings.customSubTagPriority = {
        "sa_send": 5, "sa_reply": 4, "sa_agree": 3,
        "sa_pending": 3, "sa_intent_pending": 2, "sa_intent_no": 0,
        "oa_plan": 8, "oa_practice": 7, "oa_discuss": 10, "oa_pending": 3,
        "pc_plan": 7, "pc_discuss": 6, "pc_practice": 8, "pc_pending": 3,
        "c_plan": 9, "c_sign": 7, "c_practice": 6, "c_remedy": 10, "c_submit": 8, "c_discuss": 5, "c_pending": 3,
        "s_plan": 4, "s_practice": 3, "s_discuss": 3, "s_pending": 3
      };
    }
    if (!crmSettings.activeNotificationRules) {
      crmSettings.activeNotificationRules = {
        "rules-notify-due": true,
        "rules-notify-stuck": true
      };
    }

    // 預設常規議題維護清單 (存於 LocalStorage)
    let globalTopics;
    try {
      const _topicsRaw = localStorage.getItem('global_topics');
      globalTopics = _topicsRaw ? JSON.parse(_topicsRaw) : null;
      if (!Array.isArray(globalTopics)) throw new Error('invalid');
    } catch(e) {
      console.warn('global_topics 快取損毀，已重置', e);
      localStorage.removeItem('global_topics');
      globalTopics = [
        "新生兒主附約比較",
        "退休金儲蓄規劃",
        "實支實付醫療變革",
        "汽機車強制險與任意險",
        "家庭經濟支柱保障"
      ];
    }

    // 搜尋狀態與歷史
    let searchQuery = "";
    let filterWeeklyDate = "";
    let searchHistory;
    try {
      const _histRaw = localStorage.getItem('crm_search_history');
      searchHistory = _histRaw ? JSON.parse(_histRaw) : [];
      if (!Array.isArray(searchHistory)) throw new Error('invalid');
    } catch(e) {
      console.warn('crm_search_history 快取損毀，已重置', e);
      localStorage.removeItem('crm_search_history');
      searchHistory = [];
    }

    // 模擬案件資料
    let currentViewMode = "case";
    let customers = [];
    let cases = [
      {
        id: "case-1",
        visitType: "issue", // life=生活訪, issue=議題訪
        preparedIssues: [], // 生活訪預備議題 (生活訪用)
        type: "life", // life=壽, property=產
        caseSource: "inbound", // inbound=自來, outbound=開發
        source: "referral", // relative=緣故, referral=轉介, cold=陌開
        referrerName: "張大明", // 轉介紹人
        relativeTags: ["同學"], // 緣故標籤
        clientName: "陳小明",
        contactMethods: ["LINE"], // 聯絡方式
        contactDetail: "xiaoming123", // 聯絡方式細節
        issueName: "新生兒主附約比較",
        issueDate: "2026-06-25",
        issueNote: "客戶剛生第一胎，想規劃完整的醫療與意外實支實付。",
        currentPhase: "SA",
        saDetails: {
          sendState: "active",
          sendDate: "2026-06-25",
          replyState: "active",
          replyDate: "2026-06-26",
          intentState: "intent-pending", // intent-yes, intent-no, intent-pending, dim
          intentDate: "2026-06-26",
          agreeState: "active",
          agreeDate: "2026-06-27",
          meetTimeSlot: "afternoon_1" // 午餐前、午餐、下午一、下午二、晚餐、晚餐後
        },
        oaDetails: {
          meetDate: "2026-06-30",
          meetState: "pending", // pending=時間喬定中, confirmed=已確定
          meetTimeSlot: "before_lunch",
          planState: "dim",
          planDate: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: ""
        },
        pcDetails: {
          meetDate: "", // 預計遞送日期
          meetState: "", // 遞送時間狀態: pending=喬時間中, confirmed=已確定
          meetTimeSlot: "",
          planState: "dim",
          planDate: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: ""
        },
        cDetails: {
          planState: "dim",
          planDate: "",
          submitState: "dim",
          submitDate: "",
          submitProcessed: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: ""
        },
        sDetails: {
          planState: "dim",
          planDate: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: ""
        }
      }
    ];

    // 依據各階段狀態判斷亮燈大燈 (active / preparing / '')
    function getNodeStatus(c, phase) {
      const sa = c.saDetails || {};
      const oa = c.oaDetails || {};
      const pc = c.pcDetails || {};
      const cc = c.cDetails || { planState: "dim", practiceState: "dim", discussState: "dim" };
      const s = c.sDetails || { planState: "dim", practiceState: "dim", discussState: "dim" };

      if (phase === 'SA') {
        if (sa.agreeState === 'active') return 'active';
        if (sa.sendState === 'active') return 'preparing';
        return '';
      }
      if (phase === 'OA') {
        if (oa.discussState === 'active') return 'active';
        if (oa.meetDate || oa.meetTimeSlot || oa.planState === 'active' || oa.practiceState === 'active' || c.currentPhase === 'OA') return 'preparing';
        return '';
      }
      if (phase === 'PC') {
        if (pc.discussState === 'active') return 'active';
        if (
          pc.meetDate || 
          pc.meetTimeSlot || 
          pc.meetState ||
          pc.planState === 'active' || 
          pc.practiceState === 'active' || 
          pc.planDate ||
          pc.discussDate ||
          pc.practiceDate ||
          pc.planNotes ||
          pc.discussNotes ||
          (pc.rescheduleHistory && pc.rescheduleHistory.length > 0) ||
          c.currentPhase === 'PC'
        ) return 'preparing';
        return '';
      }
      if (phase === 'C') {
        const hasNextPhase = c.currentPhase === 'S';
        if (cc.discussState === 'active' || hasNextPhase) return 'active';
        if (cc.meetDate || c.currentPhase === 'C' || cc.meetTimeSlot || cc.planState === 'active' || cc.practiceState === 'active') return 'preparing';
        return '';
      }
      if (phase === 'S') {
        if (s.discussState === 'active') return 'active';
        if (s.meetDate || c.currentPhase === 'S' || s.meetTimeSlot || s.planState === 'active' || s.practiceState === 'active') return 'preparing';
        return '';
      }
      return '';
    }


    // 局部重繪抽屜主內容，防範 header 上的完成按鈕消失
    function refreshDrawerContent(caseId, phase, c) {
      const mainContainer = document.getElementById(`drawer-main-${caseId}`);
      const container = mainContainer || document.getElementById(`drawer-content-${caseId}`);
      if (!container) return;
      
      if (phase === 'SA') renderSADrawer(c, container);
      else if (phase === 'OA') renderOADrawer(c, container);
      else if (phase === 'PC') renderPCDrawer(c, container);
      else if (phase === 'C') renderCDrawer(c, container);
      else if (phase === 'S') renderSDrawer(c, container);
    }

    function sortCasesBySavedOrder(targetArray = cases) {
      const orderStr = localStorage.getItem('crm_cases_order');
      debugLog("🔄 sortCasesBySavedOrder 偵測到目前本機排序快取為: " + orderStr);
      if (orderStr) {
        try {
          const order = JSON.parse(orderStr);
          if (Array.isArray(order) && targetArray && typeof targetArray.sort === 'function') {
            targetArray.sort((a, b) => {
              if (!a || !b) return 0;
              const idxA = order.indexOf(a.id);
              const idxB = order.indexOf(b.id);
              debugLog("📊 [Sort] 比對 " + a.clientName + " (id: " + a.id + ", index: " + idxA + ") vs " + b.clientName + " (id: " + b.id + ", index: " + idxB + ")");
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
          }
        } catch (e) {
          console.error("排序資料解析失敗，自動重置排序快取:", e);
          localStorage.removeItem('crm_cases_order');
        }
      }
    }

    function saveCasesToStorage(updateOrderCache = false) {
      localStorage.setItem('crm_cases', JSON.stringify(cases));
      if (updateOrderCache) {
        const order = cases.map(c => c.id);
        localStorage.setItem('crm_cases_order', JSON.stringify(order));
      }
    }


    // --- 智慧自動歸戶：只要案件有出現姓名就自動整理匯入 ---
    function autoSyncCustomersFromCases() {
      let changed = false;
      const twTime = new Date(new Date().getTime() + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
      
      cases.forEach(c => {
        if (!c.clientName) return;
        let cust = customers.find(cust => cust.name === c.clientName);
        if (!cust) {
          customers.push({
            id: 'cust_' + Math.random().toString(36).substr(2, 9),
            name: c.clientName,
            phone: c.phone || '',
            family: '[]',
            framework: '{}',
            campaigns: '{}',
            lastUpdated: twTime
          });
          changed = true;
        }
      });
      
      if (changed) {
        saveCustomers();
      }
    }

    // --- 客戶資料同步與儲存管理 ---
    function loadCustomers() {
      try {
        const local = localStorage.getItem('crm_customers');
        customers = local ? JSON.parse(local) : [];
        if (!Array.isArray(customers)) customers = [];
      } catch(e) {
        customers = [];
      }
    }

    function saveCustomers() {
      localStorage.setItem('crm_customers', JSON.stringify(customers));
      saveCustomersToCloud();
    }

    async function fetchCustomersFromCloud() {
      if (crmSettings.isOffline || !crmSettings.apiUrl) return;
      try {
        const response = await fetch(crmSettings.apiUrl + '?type=customers');
        const resObj = await response.json();
        if (resObj.status === 'success') {
          customers = resObj.customers || [];
          localStorage.setItem('crm_customers', JSON.stringify(customers));
        }
      } catch(e) {
        console.error("載入客戶資料失敗：", e);
      }
    }

    async function saveCustomersToCloud() {
      if (crmSettings.isOffline || !crmSettings.apiUrl) return;
      try {
        await fetch(crmSettings.apiUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'saveCustomers',
            customers: customers
          })
        });
      } catch(e) {
        console.error("同步客戶資料失敗：", e);
      }
    }

    function loadCasesFromStorage() {
      const stored = localStorage.getItem('crm_cases');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            cases = parsed;
            sortCasesBySavedOrder();
            return;
          }
        } catch (e) {
          console.error("快取案件解析失敗，改載入預設資料:", e);
        }
      }
      cases = [
        {
          id: "case-1",
          visitType: "issue",
          preparedIssues: [],
          type: "life",
          caseSource: "inbound",
          source: "referral",
          referrerName: "張大明",
          relativeTags: ["同學"],
          clientName: "陳小明",
          contactMethods: ["LINE"],
          contactDetail: "xiaoming123",
          issueName: "新生兒主附約比較",
          issueDate: "2026-06-25",
          issueNote: "客戶剛生第一胎，想規劃完整的醫療與意外實支實付。",
          currentPhase: "SA",
          saDetails: {
            sendState: "active",
            sendDate: "2026-06-25",
            replyState: "active",
            replyDate: "2026-06-26",
            intentState: "intent-pending",
            intentDate: "2026-06-26",
            agreeState: "active",
            agreeDate: "2026-06-27",
            meetTimeSlot: "afternoon_1"
          },
          oaDetails: {
            meetDate: "2026-06-30",
            meetState: "pending",
            meetTimeSlot: "before_lunch",
            planState: "dim",
            planDate: "",
            practiceState: "dim",
            practiceDate: "",
            discussState: "dim",
            discussDate: ""
          },
          pcDetails: {
            meetDate: "",
            meetState: "",
            meetTimeSlot: "",
            planState: "dim",
            planDate: "",
            practiceState: "dim",
            practiceDate: "",
            discussState: "dim",
            discussDate: ""
          },
          cDetails: {
            planState: "dim",
            planDate: "",
            practiceState: "dim",
            practiceDate: "",
            discussState: "dim",
            discussDate: ""
          },
          sDetails: {
            planState: "dim",
            planDate: "",
            practiceState: "dim",
            practiceDate: "",
            discussState: "dim",
            discussDate: ""
          }
        }
      ];
    }

    // === 雲端與本機資料 CRUD 整合 ===
    async function updateCase(caseId, updateFn, skipRender = false) {
      const c = cases.find(item => item.id === caseId);
      if (!c) return;
      
      const originalName = c.clientName;
      updateFn(c);
      
      // 更新最後更新時間
      const tw = new Date(new Date().getTime() + 3600000 * 8); // 台灣時間
      c.lastUpdated = tw.toISOString().slice(0,10) + ' ' + tw.toISOString().slice(11,19);
      
      saveCasesToStorage();
      if (!skipRender) {
        renderCases();
      }
      
      if (!crmSettings.isOffline && crmSettings.apiUrl) {
        const mappedData = mapCaseToSheetData(c);
        // 背景非同步同步至雲端，不阻塞 UI 介面
        syncChange('update', originalName, mappedData);
      }
    }

    async function addCase(newCase) {
      const tw = new Date(new Date().getTime() + 3600000 * 8); // 台灣時間
      newCase.lastUpdated = tw.toISOString().slice(0,10) + ' ' + tw.toISOString().slice(11,19);
      cases.push(newCase);
      saveCasesToStorage();
      renderCases();
      
      if (!crmSettings.isOffline && crmSettings.apiUrl) {
        const mappedData = mapCaseToSheetData(newCase);
        syncChange('add', null, mappedData);
      }
    }

    async function deleteCase(caseId) {
      const index = cases.findIndex(c => c.id === caseId);
      if (index === -1) return;
      const clientName = cases[index].clientName ? cases[index].clientName.trim() : "";
      cases.splice(index, 1);
      saveCasesToStorage();
      renderCases();
      
      if (!crmSettings.isOffline && crmSettings.apiUrl) {
        syncChange('delete', clientName, null);
      }
    }

    function parseJsonSafe(str) {
      try {
        return str ? JSON.parse(str) : [];
      } catch (e) {
        return [];
      }
    }

    // === Google Sheet Column Mappers ===
    function mapSheetDataToCases(sheetData) {
      const mapped = sheetData.map((row, index) => {
        const preparedIssues = row["預計議題"] ? row["預計議題"].split(',') : [];
        const isLifeVisit = row["預計議題"] && row["預計議題"].includes(',');
        
        return {
          id: row["客戶姓名"] || ("case-" + Date.now() + "-" + index),
          visitType: row["訪談類型"] || (isLifeVisit ? 'life' : 'issue'),
          preparedIssues: preparedIssues,
          type: row["險種分類"] === '壽' ? 'life' : 'property',
          caseSource: row["開拓管道"] === '開發' ? 'outbound' : 'inbound',
          source: row["客戶來源"] === '緣故' ? 'relative' : (row["客戶來源"] === '轉介紹' ? 'referral' : 'cold'),
          referrerName: row["介紹人"] || '',
          relativeTags: row["緣故標籤"] ? row["緣故標籤"].split(',') : [],
          clientName: row["客戶姓名"] || '未知',
          note: row["備註"] || '',
          issueNote: row["議題發想備忘"] || '',
          issueName: row["邀約議題"] || '新議題',
          issueDate: row["ＳＡ"] || '',
          currentPhase: row["當前階段"] || 'SA',
          archived: row["是否封存"] === '已封存',
          lastUpdated: row["最後更新時間"] || '',
          contactMethods: (() => {
            try {
              return row["聯絡資訊"] ? (JSON.parse(row["聯絡資訊"]).methods || []) : ["LINE"];
            } catch (e) { return ["LINE"]; }
          })(),
          contactDetails: (() => {
            try {
              return row["聯絡資訊"] ? (JSON.parse(row["聯絡資訊"]).details || {}) : {};
            } catch (e) { return {}; }
          })(),
          saDetails: {
            sendState: row["是否已讀"] === '已讀' ? 'active' : 'dim',
            sendDate: row["ＳＡ"] || '',
            replyState: row["是否已回覆"] === '已回覆' ? 'active' : 'dim',
            replyDate: row["ＳＡ"] || '',
            intentState: row["約定狀態"] || '',
            agreeState: row["已約定"] ? 'active' : 'dim',
            agreeDate: row["已約定"] || '',
            meetTimeSlot: row["約定時段"] || '',
            notes: row["ＳＡ備忘"] || ''
          },
          oaDetails: {
            meetDate: row["ＯＡ"] || '',
            meetState: row["ＯＡ已面談"] === '已面談' ? 'confirmed' : (row["ＯＡ已面談"] === '喬時間中' ? 'pending' : ''),
            meetTimeSlot: row["ＯＡ時段"] || '',
            planState: row["ＯＡ訪前規劃狀態"] || 'dim',
            planDate: row["ＯＡ訪前規劃日期"] || '',
            practiceState: row["ＯＡ訪前演練狀態"] || 'dim',
            practiceDate: row["ＯＡ訪前演練日期"] || '',
            discussState: row["ＯＡ訪後討論狀態"] || 'dim',
            discussDate: row["ＯＡ訪後討論日期"] || '',
            planNotes: row["ＯＡ訪前規劃備忘"] || '',
            practiceNotes: row["ＯＡ訪前演練備忘"] || '',
            discussNotes: row["ＯＡ訪後討論備忘"] || '',
            rescheduleHistory: row["ＯＡ改期歷史"] ? parseJsonSafe(row["ＯＡ改期歷史"]) : [],
            visitTasks: row["ＯＡ現場任務"] ? parseJsonSafe(row["ＯＡ現場任務"]) : []
          },
          pcDetails: {
            meetDate: row["ＰＣ"] || '',
            meetState: row["ＰＣ已遞送"] === '已遞送' ? 'confirmed' : '',
            meetTimeSlot: row["ＰＣ時段"] || '',
            planState: row["ＰＣ訪前規劃狀態"] || 'dim',
            planDate: row["ＰＣ規劃建議日期"] || '',
            practiceState: row["ＰＣ訪前演練狀態"] || 'dim',
            practiceDate: row["ＰＣ講解演練日期"] || '',
            discussState: row["ＰＣ訪後討論狀態"] || 'dim',
            discussDate: row["ＰＣ已傳建議日期"] || '',
            planNotes: row["ＰＣ規劃建議備忘"] || '',
            practiceNotes: row["ＰＣ講解演練備忘"] || '',
            discussNotes: row["ＰＣ訪後討論備忘"] || '',
            rescheduleHistory: row["ＰＣ改期歷史"] ? parseJsonSafe(row["ＰＣ改期歷史"]) : [],
            visitTasks: row["ＰＣ現場任務"] ? parseJsonSafe(row["ＰＣ現場任務"]) : []
          },
          cDetails: {
            meetDate: row["Ｃ"] || '',
            meetState: row["Ｃ已成交"] === '已成交' ? 'confirmed' : '',
            meetTimeSlot: row["Ｃ時段"] || '',
            planState: row["Ｃ文件準備狀態"] || 'dim',
            planDate: row["Ｃ文件準備日期"] || '',
            planNotes: row["Ｃ文件準備備忘"] || '',
            signState: row["Ｃ簽約狀態"] || 'dim',
            signDate: row["Ｃ簽約日期"] || '',
            remedyState: row["Ｃ補件狀態"] || 'dim',
            remedyDate: row["Ｃ補件日期"] || '',
            submitState: row["Ｃ送件狀態"] || 'dim',
            submitDate: row["Ｃ送件日期"] || '',
            submitProcessed: row["Ｃ送件已處理"] || '',
            practiceState: row["Ｃ要保簽署狀態"] || 'dim',
            practiceDate: row["Ｃ要保簽署日期"] || '',
            discussState: row["Ｃ保費首扣狀態"] || 'dim',
            discussDate: row["Ｃ保費首扣日期"] || '',
            discussNotes: row["Ｃ保費首扣備忘"] || '',
            rescheduleHistory: row["Ｃ改期歷史"] ? parseJsonSafe(row["Ｃ改期歷史"]) : [],
            visitTasks: row["Ｃ現場任務"] ? parseJsonSafe(row["Ｃ現場任務"]) : []
          },
          sDetails: {
            meetDate: row["Ｓ"] || '',
            meetTimeSlot: row["Ｓ時段"] || '',
            planState: row["Ｓ保單送達狀態"] || 'dim',
            planDate: row["Ｓ"] || '',
            planNotes: row["Ｓ保單送達備忘"] || '',
            practiceState: row["Ｓ契撤追蹤狀態"] || 'dim',
            practiceDate: row["Ｓ"] || '',
            discussState: row["Ｓ週年服務狀態"] || 'dim',
            discussDate: row["Ｓ"] || '',
            discussNotes: row["Ｓ週年服務備忘"] || '',
            visitTasks: row["Ｓ現場任務"] ? parseJsonSafe(row["Ｓ現場任務"]) : []
          }
        };
      });
      sortCasesBySavedOrder(mapped);
      return mapped;
    }

    function mapCaseToSheetData(c) {
      const sa = c.saDetails || {};
      const oa = c.oaDetails || {};
      const pc = c.pcDetails || {};
      const cc = c.cDetails || {};
      const s = c.sDetails || {};
      
      return {
        "險種分類": c.type === 'life' ? '壽' : '產',
        "客戶姓名": c.clientName || '',
        "預計議題": c.preparedIssues ? c.preparedIssues.join(',') : '',
        "訪談類型": c.visitType || 'issue',
        "ＳＡ": c.issueDate || sa.sendDate || '',
        "邀約議題": c.issueName || '',
        "是否已讀": sa.sendState === 'active' ? '已讀' : '未讀',
        "是否已回覆": sa.replyState === 'active' ? '已回覆' : '未回覆',
        "約定狀態": sa.intentState || 'intent-pending',
        "已約定": sa.agreeDate || '',
        "約定時段": sa.meetTimeSlot || '',
        "ＯＡ": oa.meetDate || '',
        "ＯＡ已面談": oa.meetState === 'confirmed' ? '已面談' : (oa.meetState === 'pending' ? '喬時間中' : '未面談'),
        "ＯＡ時段": oa.meetTimeSlot || '',
        "ＯＡ訪前規劃狀態": oa.planState || 'dim',
        "ＯＡ訪前演練狀態": oa.practiceState || 'dim',
        "ＯＡ訪後討論狀態": oa.discussState || 'dim',
        "ＯＡ訪前規劃備忘": oa.planNotes || '',
        "ＯＡ訪前演練備忘": oa.practiceNotes || '',
        "ＯＡ訪後討論備忘": oa.discussNotes || '',
        "ＯＡ改期歷史": JSON.stringify(oa.rescheduleHistory || []),
        "ＯＡ訪前規劃日期": oa.planDate || '',
        "ＯＡ訪前演練日期": oa.practiceDate || '',
        "ＯＡ訪後討論日期": oa.discussDate || '',
        "ＰＣ": pc.meetDate || '',
        "ＰＣ已遞送": pc.meetState === 'confirmed' ? '已遞送' : '未遞送',
        "ＰＣ時段": pc.meetTimeSlot || '',
        "ＰＣ訪前規劃狀態": pc.planState || 'dim',
        "ＰＣ訪前演練狀態": pc.practiceState || 'dim',
        "ＰＣ訪後討論狀態": pc.discussState || 'dim',
        "ＰＣ規劃建議備忘": pc.planNotes || '',
        "ＰＣ講解演練備忘": pc.practiceNotes || '',
        "ＰＣ訪後討論備忘": pc.discussNotes || '',
        "ＰＣ改期歷史": JSON.stringify(pc.rescheduleHistory || []),
        "ＰＣ規劃建議日期": pc.planDate || '',
        "ＰＣ講解演練日期": pc.practiceDate || '',
        "ＰＣ已傳建議日期": pc.discussDate || '',
        "Ｃ": cc.meetDate || '',
        "Ｃ已成交": cc.meetState === 'confirmed' ? '已成交' : '未成交',
        "Ｃ文件準備狀態": cc.planState || 'dim',
        "Ｃ文件準備備忘": cc.planNotes || '',
        "Ｃ文件準備日期": cc.planDate || '',
        "Ｃ簽約狀態": cc.signState || 'dim',
        "Ｃ簽約日期": cc.signDate || '',
        "Ｃ補件狀態": cc.remedyState || 'dim',
        "Ｃ補件日期": cc.remedyDate || '',
        "Ｃ送件狀態": cc.submitState || 'dim',
        "Ｃ送件日期": cc.submitDate || '',
        "Ｃ送件已處理": cc.submitProcessed || '',
        "Ｃ要保簽署狀態": cc.practiceState || 'dim',
        "Ｃ要保簽署日期": cc.practiceDate || '',
        "Ｃ保費首扣狀態": cc.discussState || 'dim',
        "Ｃ保費首扣日期": cc.discussDate || '',
        "Ｃ保費首扣備忘": cc.discussNotes || '',
        "Ｃ改期歷史": JSON.stringify(cc.rescheduleHistory || []),
        "Ｓ": s.meetDate || '',
        "Ｓ保單送達狀態": s.planState || 'dim',
        "Ｓ保單送達備忘": s.planNotes || '',
        "Ｓ契撤追蹤狀態": s.practiceState || 'dim',
        "Ｓ週年服務狀態": s.discussState || 'dim',
        "Ｓ週年服務備忘": s.discussNotes || '',
        "當前階段": c.currentPhase || 'SA',
        "開拓管道": c.caseSource === 'outbound' ? '開發' : '自來',
        "客戶來源": c.source === 'relative' ? '緣故' : (c.source === 'referral' ? '轉介紹' : '陌生開發'),
        "介紹人": c.referrerName || '',
        "緣故標籤": c.relativeTags ? c.relativeTags.join(',') : '',
        "ＳＡ備忘": sa.notes || '',
        "是否封存": c.archived ? '已封存' : '未封存',
        "聯絡資訊": JSON.stringify({ methods: c.contactMethods || [], details: c.contactDetails || {} }),
        "備註": c.note || '',
        "議題發想備忘": c.issueNote || '',
        "Ｃ時段": (c.cDetails ? c.cDetails.meetTimeSlot : '') || '',
        "Ｓ時段": (c.sDetails ? c.sDetails.meetTimeSlot : '') || '',
        "ＯＡ現場任務": JSON.stringify(oa.visitTasks || []),
        "ＰＣ現場任務": JSON.stringify(pc.visitTasks || []),
        "Ｃ現場任務": JSON.stringify(cc.visitTasks || []),
        "Ｓ現場任務": JSON.stringify(s.visitTasks || []),
        "最後更新時間": c.lastUpdated || ''
      };
    }

    // === 雲端 Background API 請求與同步佇列 ===
    let syncQueue = JSON.parse(localStorage.getItem('crm_sync_queue')) || [];

    function saveSyncQueue() {
      localStorage.setItem('crm_sync_queue', JSON.stringify(syncQueue));
    }

    async function processSyncQueue() {
      if (crmSettings.isOffline || !crmSettings.apiUrl || syncQueue.length === 0) return;
      
      updateConnectionStatus('syncing');
      showToast(`正在同步離線暫存資料 (${syncQueue.length} 筆)...`, 'success');
      
      let successCount = 0;
      let failCount = 0;
      const currentQueue = [...syncQueue];
      syncQueue = []; 
      saveSyncQueue();

      for (let i = 0; i < currentQueue.length; i++) {
        const item = currentQueue[i];
        try {
          const payload = {
            action: item.action,
            customerName: item.customerName,
            data: item.data
          };
          
          const response = await fetch(crmSettings.apiUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) throw new Error('雲端回應異常');
          const result = await response.json();
          if (result.status === 'success') {
            successCount++;
          } else {
            throw new Error(result.message || '雲端同步錯誤');
          }
        } catch (err) {
          console.error("同步佇列單筆同步失敗:", err);
          failCount++;
          syncQueue.push(item); 
        }
      }
      
      saveSyncQueue();
      
      if (successCount > 0) {
        showToast(`成功同步 ${successCount} 筆暫存資料至雲端！`, 'success');
      }
      if (failCount > 0) {
        showToast(`${failCount} 筆暫存同步失敗，保留至下次連線`, 'error');
        updateConnectionStatus('error');
      } else {
        updateConnectionStatus('connected');
      }
    }

    async function syncChange(action, originalName, mappedData) {
      const queueItem = {
        action: action,
        customerName: originalName || (mappedData ? mappedData["客戶姓名"] : ""),
        data: mappedData
      };

      if (crmSettings.isOffline || !crmSettings.apiUrl) {
        syncQueue.push(queueItem);
        saveSyncQueue();
        updateConnectionStatus();
        return;
      }

      updateConnectionStatus('syncing');
      
      try {
        const response = await fetch(crmSettings.apiUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(queueItem)
        });
        
        if (!response.ok) throw new Error('雲端回應異常');
        const result = await response.json();
        
        if (result.status === 'success') {
          updateConnectionStatus('connected');
          if (syncQueue.length > 0) {
            setTimeout(processSyncQueue, 500);
          }
        } else {
          throw new Error(result.message || '雲端同步錯誤');
        }
      } catch (err) {
        window.lastConnectionError = err;
        console.error("雲端背景備份失敗，寫入暫存佇列:", err);
        updateConnectionStatus('error');
        syncQueue.push(queueItem);
        saveSyncQueue();
        showToast("雲端同步失敗，已儲存至本機暫存", "error");
      }
    }

    async function fetchCases(forceRefresh = false) {
      debugLog("fetchCases() 內部執行中...");
      if (crmSettings.isOffline || !crmSettings.apiUrl) {
        loadCasesFromStorage();
        renderCases();
        updateConnectionStatus();
        return;
      }
      
      // 先從 LocalStorage 載入並渲染，達到秒開效果
      loadCasesFromStorage();
      const hasCachedData = (cases && cases.length > 0);
      if (hasCachedData) {
        renderCases();
      } else {
        // 沒有快取資料時，才顯示全螢幕阻塞式遮罩
        toggleLoading(true, "正在載入雲端客戶資料...");
      }

      // === 核心安全防線：如果有未同步的離線資料，先嘗試同步，失敗則中斷下載，防止雲端覆蓋本機新資料 ===
      if (syncQueue.length > 0) {
        updateConnectionStatus('syncing');
        try {
          await processSyncQueue(); // 執行同步
        } catch (e) {
          console.error("同步離線資料失敗，中斷雲端拉取:", e);
          updateConnectionStatus('error');
          if (!hasCachedData) toggleLoading(false);
          return; // 終止流程，留存本機最新資料
        }
        
        // 若同步後佇列依然有剩餘（代表有單筆失敗），同樣中斷拉取
        if (syncQueue.length > 0) {
          updateConnectionStatus('error');
          if (!hasCachedData) toggleLoading(false);
          return;
        }
      }
      
      try {
        // 加入時間戳記避免瀏覽器快取 GET 請求
        let cacheBusterUrl = crmSettings.apiUrl + (crmSettings.apiUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
        if (forceRefresh) {
          cacheBusterUrl += '&nocache=true';
        }
        debugLog("發送雲端 GET 請求到: " + cacheBusterUrl);
        const response = await fetch(cacheBusterUrl, { method: 'GET', mode: 'cors' });
        debugLog("雲端 HTTP 狀態碼: " + response.status);
        if (!response.ok) throw new Error('雲端回應異常');
        const result = await response.json();
        
        debugLog("接收到雲端資料，案件數: " + (result.data ? result.data.length : 0));
        if (result.status === 'success' && Array.isArray(result.data)) {
          cases = mapSheetDataToCases(result.data);
          saveCasesToStorage();
          renderCases();
          updateConnectionStatus('connected');
          if (!hasCachedData) {
            showToast("雲端資料同步成功！", "success");
          }
        } else {
          throw new Error(result.message || '資料格式不正確');
        }
      } catch (err) {
        window.lastConnectionError = err;
        console.error("讀取雲端資料失敗:", err);
        // 如果原本就沒有快取資料才需要警告，不然只是背景同步失敗，顯示連線異常即可
        if (!hasCachedData) {
          showToast("無法連線至雲端，改載入本機快取資料", "error");
          loadCasesFromStorage();
          renderCases();
        } else {
          showToast("雲端同步失敗，目前顯示本機快取資料", "error");
        }
        updateConnectionStatus('error');
      } finally {
        if (!hasCachedData) {
          toggleLoading(false);
        }
      }
    }

    // === 介面指示燈 & 遮罩控制 ===
    function updateConnectionStatus(state) {
      const dot = document.getElementById('connection-dot');
      const text = document.getElementById('connection-text');
      if (!dot || !text) return;
      
      dot.className = '';
      const parentBar = document.getElementById('connection-status-bar');
      
      if (crmSettings.isOffline) {
        dot.style.background = '#eab308';
        text.innerText = '離線模擬中';
        text.style.color = '#eab308';
        if (parentBar) parentBar.setAttribute('title', '目前處於離線模擬模式下，所有操作僅暫存於本機。');
      } else {
        const current = state || 'connected';
        if (current === 'syncing') {
          dot.style.background = '#eab308';
          dot.classList.add('dot-syncing');
          text.innerText = '背景備份中...';
          text.style.color = '#eab308';
          if (parentBar) parentBar.setAttribute('title', '正在與雲端同步資料中，請稍候。');
        } else if (current === 'connected') {
          dot.style.background = '#22c55e';
          dot.classList.add('dot-connected');
          text.innerText = '雲端已連線';
          text.style.color = '#22c55e';
          if (parentBar) parentBar.setAttribute('title', '已成功與 Google Sheet 雲端連線，資料即時同步中。');
        } else {
          dot.style.background = '#ef4444';
          text.innerText = '連線異常 (本機執行)';
          text.style.color = '#ef4444';
          const errorMsg = "原因：\n1. 尚未設定 Google Apps Script Web App API 網址，或網址有誤。\n2. 您的網路連線中斷。\n\n建議操作步驟：\n1. 點擊右上角 ⚙️ 設定按鈕檢查 API 網址。\n2. 確認您的網路連線狀態。\n3. 您可繼續使用，所有變更將存於本機，並於連線恢復時自動後台備份。";
          if (parentBar) parentBar.setAttribute('title', errorMsg);
        }
      }
    }

    function toggleLoading(show, text = '載入中，請稍候...') {
      const overlay = document.getElementById('loading-overlay');
      const textEl = document.getElementById('loading-text');
      if (!overlay) return;
      
      if (show) {
        textEl.innerText = text;
        overlay.classList.add('active');
      } else {
        overlay.classList.remove('active');
      }
    }

    // === 設定彈窗控制與連線測試 ===
    function switchSettingsTab(tab) {
      document.getElementById('settings-pane-sync').style.display = tab === 'sync' ? 'block' : 'none';
      document.getElementById('settings-pane-reminder').style.display = tab === 'reminder' ? 'block' : 'none';
      document.getElementById('settings-pane-issues').style.display = tab === 'issues' ? 'block' : 'none';
      document.getElementById('settings-pane-groups').style.display = tab === 'groups' ? 'block' : 'none';
      document.getElementById('settings-pane-rules').style.display = tab === 'rules' ? 'block' : 'none';
      
      document.getElementById('settings-tab-sync').classList.toggle('active', tab === 'sync');
      document.getElementById('settings-tab-reminder').classList.toggle('active', tab === 'reminder');
      document.getElementById('settings-tab-issues').classList.toggle('active', tab === 'issues');
      document.getElementById('settings-tab-groups').classList.toggle('active', tab === 'groups');
      document.getElementById('settings-tab-rules').classList.toggle('active', tab === 'rules');
      
      const actionBox = document.getElementById('settings-global-actions');
      if (actionBox) {
        actionBox.style.display = (tab === 'sync' || tab === 'reminder' || tab === 'rules') ? 'flex' : 'none';
      }
      
      if (tab === 'issues') renderIssueList();
      if (tab === 'groups') renderGroupList();
      if (tab === 'rules') renderRulesPriorityList();
    }

    function toggleSettingsModal(show) {
      const modal = document.getElementById('settings-modal');
      if (!modal) return;
      
      if (show) {
        document.getElementById('settings-api-url').value = crmSettings.apiUrl || '';
        document.getElementById('settings-mode-offline').checked = crmSettings.isOffline;
        document.getElementById('settings-mode-cloud').checked = !crmSettings.isOffline;
        
        // 綁定自訂通知勾選狀態
        const notifyRules = crmSettings.activeNotificationRules || {};
        document.getElementById('rules-notify-due').checked = notifyRules['rules-notify-due'] !== false;
        document.getElementById('rules-notify-stuck').checked = notifyRules['rules-notify-stuck'] !== false;

        switchSettingsTab('sync');
        modal.classList.add('active');
        rebuildGroupSelect();
        
        // 更新並顯示離線佇列狀態
        updateSettingsSyncQueueUI();
        
        // 如果先前有發生錯誤，主動展示診斷區塊
        if (window.lastConnectionError) {
          showDiagnosticInfo(window.lastConnectionError);
        } else {
          document.getElementById('settings-diagnostic-log').style.display = 'none';
        }
      } else {
        modal.classList.remove('active');
      }
      
      // 自動聚焦優化：彈窗開啟時，游標自動聚焦於「客戶姓名」欄位中
      if (show) {
        setTimeout(() => {
          const nameInput = document.getElementById('add-client-name');
          if (nameInput) nameInput.focus();
        }, 100);
      }
    }

    // 輔助函數：更新設定介面中的離線佇列資訊
    function updateSettingsSyncQueueUI() {
      const queueBox = document.getElementById('settings-sync-status-box');
      const queueCount = document.getElementById('settings-sync-queue-count');
      if (!queueBox || !queueCount) return;
      
      if (syncQueue && syncQueue.length > 0) {
        queueCount.innerText = `${syncQueue.length} 筆`;
        queueBox.style.display = 'flex';
      } else {
        queueBox.style.display = 'none';
      }
    }

    // 輔助函數：顯示詳細的診斷說明
    function showDiagnosticInfo(err) {
      const diagLog = document.getElementById('settings-diagnostic-log');
      const diagText = document.getElementById('settings-diagnostic-text');
      if (!diagLog || !diagText) return;
      
      diagLog.style.display = 'block';
      let errStr = (err instanceof Error) ? `${err.name}: ${err.message}` : String(err);
      
      // 分析錯誤並給予白話引導
      let hint = "";
      const url = document.getElementById('settings-api-url').value.trim();
      
      if (errStr.includes("Failed to fetch") || errStr.includes("NetworkError")) {
        hint = `【診斷分析】CORS 跨網域阻擋 或 網路中斷\n` +
               `💡 最可能原因：您的 GAS 部署設定「存取權限 (Who has access)」忘記設為「任何人 (Anyone)」，因而導致 Google 要求登入授權，瀏覽器將此授權轉向判定為跨網域安全性錯誤 (CORS)。\n` +
               `👉 解決方法：請開啟 GAS 編輯器，重新按右上角「部署」->「管理部署」，將存取權修改為「任何人」，並複製新的網址貼回來。`;
      } else if (errStr.includes("Unexpected token") || errStr.includes("is not valid JSON") || errStr.includes("連線回應異常")) {
        hint = `【診斷分析】GAS 回應格式錯誤\n` +
               `💡 最可能原因：GAS 腳本在執行時發生致命錯誤崩潰，或是回傳了 Google 登入的 HTML 頁面而不是 JSON 資料。\n` +
               `👉 解決方法：確認您輸入的是以 /exec 結尾的「網頁應用程式網址」，而非 /edit 結尾的編輯器網址。`;
      } else {
        hint = `【診斷分析】未知連線或指令碼錯誤\n` +
               `👉 請確認您的 GAS 後端 code.gs 是否部署成功，且試算表沒有被移至垃圾桶。`;
      }
      
      diagText.innerText = `錯誤紀錄：\n${errStr}\n\n${hint}`;
    }

    // 手動強制同步佇列
    async function forceSyncQueue() {
      if (syncQueue.length === 0) {
        showToast("目前沒有需要同步的離線資料！", "success");
        updateSettingsSyncQueueUI();
        return;
      }
      
      toggleLoading(true, `正在手動同步 ${syncQueue.length} 筆資料...`);
      try {
        await processSyncQueue();
        updateSettingsSyncQueueUI();
        if (syncQueue.length === 0) {
          showToast("所有本機暫存資料已成功同步至雲端！", "success");
          document.getElementById('settings-diagnostic-log').style.display = 'none';
        } else {
          showToast(`同步未完成，仍有 ${syncQueue.length} 筆資料保留在暫存`, "error");
        }
      } catch (err) {
        window.lastConnectionError = err;
        showDiagnosticInfo(err);
        showToast("同步失敗，請參考下方診斷報告", "error");
      } finally {
        toggleLoading(false);
      }
    }

    function saveSettings() {
      const apiUrl = document.getElementById('settings-api-url').value.trim();
      const isOffline = document.getElementById('settings-mode-offline').checked;
      
      if (!isOffline && apiUrl.includes('/edit')) {
        showToast('儲存失敗：您輸入的是 Apps Script 編輯器網址，請部署為「網頁應用程式」並提供 /exec 結尾的部署網址！', 'error');
        return;
      }

      crmSettings.apiUrl = apiUrl;
      crmSettings.isOffline = isOffline;
      
      // 儲存訂閱通知設定
      crmSettings.activeNotificationRules = {
        "rules-notify-due": document.getElementById('rules-notify-due').checked,
        "rules-notify-stuck": document.getElementById('rules-notify-stuck').checked
      };

      localStorage.setItem('crm_settings', JSON.stringify(crmSettings));
      
      toggleSettingsModal(false);
      showToast("系統設定已儲存！", "success");
      
      fetchCases();
    }

    async function testSettingsConnection() {
      const url = document.getElementById('settings-api-url').value.trim();
      if (!url) {
        showToast('請輸入 URL 以利測試！', 'error');
        return;
      }
      
      if (url.includes('/edit')) {
        showToast('提示：您貼上的是編輯器網址，連線必會失敗。請部署為「網頁應用程式」並複製以 /exec 結尾的部署網址！', 'error');
        return;
      }

      toggleLoading(true, '正在測試雲端連線...');
      try {
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        
        let responseText = "";
        if (!response.ok) {
          try {
            responseText = await response.text();
          } catch(e){}
          throw new Error(`伺服器回應錯誤 (狀態碼 ${response.status} ${response.statusText}): ${responseText.substring(0, 100)}`);
        }
        
        const result = await response.json();
        if (result.status === 'success') {
          showToast('連線測試成功！伺服器回應正常。', 'success');
          // 成功後隱藏診斷 log
          document.getElementById('settings-diagnostic-log').style.display = 'none';
          window.lastConnectionError = null;
        } else {
          throw new Error(result.message || '伺服器執行錯誤，未成功取得資料');
        }
      } catch (err) {
        console.error(err);
        window.lastConnectionError = err;
        showDiagnosticInfo(err);
        showToast('連線測試失敗：請查閱下方的「連線診斷報告」進行排查。', 'error');
      } finally {
        toggleLoading(false);
      }
    }

    // 初始化載入
    // === 客製化非同步確認彈窗元件 ===
    let confirmCallback = null;
    function showConfirm(options = {}) {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const bodyEl = document.getElementById('confirm-modal-body');
      const btnOk = document.getElementById('confirm-modal-btn-ok');
      const btnCancel = document.getElementById('confirm-modal-btn-cancel');
      
      if (!modal || !titleEl || !bodyEl || !btnOk || !btnCancel) {
        // 退回原生 confirm 防呆
        if (confirm(options.title || '確定操作？')) {
          if (options.onOk) options.onOk();
        }
        return;
      }

      titleEl.innerHTML = (options.icon ? options.icon + ' ' : '') + (options.title || '確認操作');
      bodyEl.innerHTML = options.body || '確定要執行此操作嗎？';
      
      btnOk.innerText = options.okText || '確定';
      btnOk.style = options.okStyle || '';
      btnOk.className = 'btn btn-primary';

      const cleanup = () => {
        modal.classList.remove('active');
        btnOk.removeEventListener('click', handleOk);
        btnCancel.removeEventListener('click', handleCancel);
      };

      const handleOk = () => {
        cleanup();
        if (options.onOk) options.onOk();
      };

      const handleCancel = () => {
        cleanup();
        if (options.onCancel) options.onCancel();
      };

      btnOk.addEventListener('click', handleOk);
      btnCancel.addEventListener('click', handleCancel);
      
      modal.classList.add('active');
    }

    // === 鍵盤快捷鍵配置 (ADHD 減法高效優化) ===
    function initKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        // Reminders Enter-to-close removed for ADHD focus workflow

        // 1. Cmd + I (Mac) 或 Ctrl + I (Win) -> 快速開啟建案彈窗 (避開 Raycast 衝突)
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
          e.preventDefault();
          toggleAddCaseModal(true);
        }

        // 2. Cmd + Enter (Mac) 或 Ctrl + Enter (Win) -> 快速送出建案或儲存關閉抽屜
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          const addCaseModal = document.getElementById('add-case-modal');
          
          // 情境 A：若「新增客戶與議題」對話框處於開啟狀態
          if (addCaseModal && addCaseModal.classList.contains('active')) {
            e.preventDefault();
            const form = document.getElementById('add-case-form');
            if (form) {
              // 觸發 submit，同時保留並觸發 HTML5 原生必填驗證，安全防呆
              form.requestSubmit();
            }
          } 
          // 情境 B：若有開啟中的側邊抽屜
          else {
            // 尋找當前有顯示 display 為 block 的 drawer-row 元素
            const openDrawerEl = Array.from(document.querySelectorAll('.drawer-row')).find(el => el.style.display === 'block');
            if (openDrawerEl) {
              e.preventDefault();
              closeAllDrawers();
              showToast("抽屜修改已安全儲存 💾", "success");
            }
          }
        }
      });
    }

    async function init() {
      // 偵測是否為觸控平板/行動裝置，若是則加上 is-touch-device class
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      if (isTouch) {
        document.body.classList.add('is-touch-device');
      }
      initKeyboardShortcuts();
      debugLog("init() 流程啟動");
      try {
        updateConnectionStatus();
        debugLog("連線狀態更新完畢");

        rebuildIssueSelects();
        debugLog("議題選單初始化完畢");
        
        loadTodos();
        debugLog("待辦事項本機快取載入完畢");

      const modalCloseMap = {
        'add-case-modal':   () => toggleAddCaseModal(false),
        'settings-modal':   () => toggleSettingsModal(false),
        'risk-lock-modal':  () => toggleRiskLockModal(false),
        'weekly-report-modal': () => toggleWeeklyReport(false),
        'add-todo-modal':   () => closeTodoModal(),
        'reminder-modal':   () => toggleReminderModal(false),
        'todo-notify-modal':() => toggleTodoNotifyModal(false),
        'add-customer-modal':() => closeAddCustomerModal(),
        'add-family-modal': () => closeAddFamilyModal(),
        'add-note-modal':   () => closeAddNoteModal(),
      };
      Object.entries(modalCloseMap).forEach(([id, closeFn]) => {
        const overlay = document.getElementById(id);
        if (overlay) {
          overlay.addEventListener('click', (e) => {
            // 只有點到 overlay 本身（非內部 modal-box）才關閉
            if (e.target === overlay) closeFn();
          });
        }
      });

      // 初始化與綁定全站字體大小縮放 (A- / A+)
      let currentFontSize = parseInt(localStorage.getItem('crm_font_size')) || 18;
      document.documentElement.style.fontSize = currentFontSize + 'px';

      document.getElementById('btn-font-dec').addEventListener('click', () => {
        if (currentFontSize > 12) {
          currentFontSize--;
          document.documentElement.style.fontSize = currentFontSize + 'px';
          localStorage.setItem('crm_font_size', currentFontSize);
        }
      });
      document.getElementById('btn-font-inc').addEventListener('click', () => {
        if (currentFontSize < 22) {
          currentFontSize++;
          document.documentElement.style.fontSize = currentFontSize + 'px';
          localStorage.setItem('crm_font_size', currentFontSize);
        }
      });
      
      // 連線狀態欄點擊強制重新整理並清除快取
      const connectionBar = document.getElementById('connection-status-bar');
      if (connectionBar) {
        connectionBar.style.cursor = 'pointer';
        connectionBar.addEventListener('click', async () => {
          if (crmSettings.isOffline || !crmSettings.apiUrl) {
            showToast("目前為離線模式，無法重新整理雲端資料", "warning");
            return;
          }
          if (confirm("確定要強制從雲端重新整理（清除快取並同步最新試算表）嗎？")) {
            toggleLoading(true, "正在強制拉取雲端最新資料並重置快取...");
            try {
              await fetchCases(true);
              showToast("已成功清除快取並同步最新試算表！", "success");
            } catch (err) {
              showToast("強制同步失敗: " + err.message, "error");
            } finally {
              toggleLoading(false);
            }
          }
        });
        
        // 雙擊連線狀態欄彈出偵錯詳細資訊
        connectionBar.addEventListener('dblclick', () => {
          if (window.lastConnectionError) {
            alert("⚠️ 偵錯連線錯誤詳細資訊：\n\n" + (window.lastConnectionError.stack || window.lastConnectionError.message || window.lastConnectionError));
          } else {
            alert("✅ 目前無記錄到任何連線或資料解析錯誤。");
          }
        });
      }

      // 綁定按鈕事件監聽器
      document.getElementById('btn-add-case').addEventListener('click', () => {
        toggleAddCaseModal(true);
      });
      document.getElementById('btn-settings').addEventListener('click', () => {
        toggleSettingsModal(true);
      });
      // 綁定喚醒提醒彈窗事件監聽器
      document.getElementById('btn-open-reminder').addEventListener('click', () => {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        
        const limitDays = crmSettings.reminderDaysLimit || 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;

        const expired = [];
        const today = [];
        const future = [];

        cases.forEach(c => {
          if (c.cDetails && c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
            const sDate = c.cDetails.submitDate.replace(/\//g, '-');
            if (sDate < todayStr) {
              expired.push(c);
            } else if (sDate === todayStr) {
              today.push(c);
            } else if (sDate > todayStr && sDate <= limitDateStr) {
              future.push(c);
            }
          }
        });

        renderReminderBoard(expired, today, future);
        toggleReminderModal(true);
      });
      // 綁定喚醒提醒彈窗事件監聽器
      document.getElementById('btn-open-reminder').addEventListener('click', () => {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        
        const limitDays = crmSettings.reminderDaysLimit || 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;

        const expired = [];
        const today = [];
        const future = [];

        cases.forEach(c => {
          if (c.cDetails && c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
            const sDate = c.cDetails.submitDate.replace(/\//g, '-');
            if (sDate < todayStr) {
              expired.push(c);
            } else if (sDate === todayStr) {
              today.push(c);
            } else if (sDate > todayStr && sDate <= limitDateStr) {
              future.push(c);
            }
          }
        });

        renderReminderBoard(expired, today, future);
        toggleReminderModal(true);
      });
      // 綁定喚醒提醒彈窗事件監聽器
      document.getElementById('btn-open-reminder').addEventListener('click', () => {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        
        const limitDays = crmSettings.reminderDaysLimit || 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;

        const expired = [];
        const today = [];
        const future = [];

        cases.forEach(c => {
          if (c.cDetails && c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
            const sDate = c.cDetails.submitDate.replace(/\//g, '-');
            if (sDate < todayStr) {
              expired.push(c);
            } else if (sDate === todayStr) {
              today.push(c);
            } else if (sDate > todayStr && sDate <= limitDateStr) {
              future.push(c);
            }
          }
        });

        renderReminderBoard(expired, today, future);
        toggleReminderModal(true);
      });
      document.getElementById('btn-close-settings-modal').addEventListener('click', () => {
        toggleSettingsModal(false);
      });
      // 綁定時程看板的關閉按鈕
      const btnCloseReminder = document.getElementById('btn-close-reminder-modal');
      if (btnCloseReminder) {
        btnCloseReminder.addEventListener('click', () => {
          toggleReminderModal(false);
        });
      }
      document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
      document.getElementById('btn-test-connection').addEventListener('click', testSettingsConnection);
      
      const forceSyncBtn = document.getElementById('btn-force-sync');
      if (forceSyncBtn) {
        forceSyncBtn.addEventListener('click', forceSyncQueue);
      }
      
      const clearDiagBtn = document.getElementById('btn-clear-diagnostic');
      if (clearDiagBtn) {
        clearDiagBtn.addEventListener('click', () => {
          document.getElementById('settings-diagnostic-log').style.display = 'none';
          window.lastConnectionError = null;
        });
      }

      // Tablet Fix: 啟用行動裝置 Drag & Drop Polyfill，設定 holdToDrag 以避免與頁面滾動衝突
      if (typeof MobileDragDrop !== 'undefined') {
        MobileDragDrop.polyfill({
          holdToDrag: 200
        });
      }

      // 初始化拖曳排序
      debugLog("準備初始化拖曳排序...");
      initDragAndDrop();
      debugLog("拖曳排序初始化完畢");

      // 搜尋欄位事件綁定
      const searchTrigger = document.getElementById('search-trigger-btn');
      const searchContainer = document.getElementById('search-container');
      const searchInput = document.getElementById('global-search-input');
      const searchClear = document.getElementById('search-clear-btn');

      if (searchTrigger && searchContainer && searchInput) {
        searchTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          searchContainer.classList.toggle('active');
          if (searchContainer.classList.contains('active')) {
            searchInput.focus();
            showSearchDropdown();
          }
        });
      }

      // 點擊輸入框內部防止冒泡收合
      if (searchInput) {
        searchInput.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
      if (searchInput) {
        searchInput.addEventListener('focus', showSearchDropdown);
        searchInput.addEventListener('click', (e) => {
          e.stopPropagation();
          showSearchDropdown();
        });
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            saveSearchHistory(searchInput.value);
            hideSearchDropdown();
          }
        });
      }
      if (searchClear) {
        searchClear.addEventListener('click', (e) => {
          e.stopPropagation();
          searchInput.value = '';
          searchQuery = '';
          searchClear.style.display = 'none';
          renderCases();
          searchInput.focus();
          showSearchDropdown();
        });
      }
      // 點擊外部收合搜尋選單
      document.addEventListener('click', (e) => {
        const container = document.getElementById('search-container');
        const dropdown = document.getElementById('search-dropdown');
        if (container && dropdown && !container.contains(e.target)) {
          dropdown.style.display = 'none';
          if (container) container.classList.remove('active'); // 移除 active 狀態
        }
      });

      debugLog("連線模式判定中... 離線模式: " + crmSettings.isOffline + ", API網址: " + crmSettings.apiUrl);
      if (!crmSettings.isOffline && crmSettings.apiUrl) {
        debugLog("啟動雲端同步載入 (fetchCases)...");
        await fetchCustomersFromCloud();
        await fetchCases();
      } else {
        debugLog("啟動本機快取載入...");
        loadCustomers();
        loadCasesFromStorage();
        debugLog("本機快取載入完畢，準備渲染 (renderCases)...");
        renderCases();
        renderSidebarList(); // 同步渲染側欄案件清單
        debugLog("本機案件渲染完畢");
      }
      startADHDStartupFlow();
      checkTodayVisits();
      // 啟動時從雲端同步待辦事項（非同步，不影響主流程）
      fetchTodosFromCloud();
      } catch (e) {
        debugLog("<span style='color:#ff4444;'>💥 init() 過程中崩潰：" + e.message + "</span>");
        console.error(e);
      }
    }

    // 短日期格式化輔助函數 (例如將 2026-06-28 轉為 06/28)
    function formatShortDate(dateStr) {
      if (!dateStr || dateStr.trim() === '' || dateStr === '&nbsp;') return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return parts[1] + '/' + parts[2];
      }
      return dateStr;
    }

    // 渲染案件列表
    // 控制是否顯示已封存案件（預設僅顯示未封存）
    let showingArchived = false;

    function toggleArchivedView() {
      showingArchived = !showingArchived;
      const btn = document.getElementById('btn-show-archived');
      if (btn) {
        btn.style.opacity = showingArchived ? '1' : '0.65';
        btn.style.background = showingArchived ? 'rgba(245,158,11,0.15)' : '';
        btn.style.borderColor = showingArchived ? 'rgba(245,158,11,0.5)' : '';
        btn.style.color = showingArchived ? 'var(--accent-amber)' : '';
        btn.textContent = showingArchived ? '📦 已封存（顯示中）' : '📦 已封存';
      }
      renderCases();
    }

    // --- 搜尋功能邏輯 ---

    // 遞迴取案件內所有屬性值
    function getCaseValuesString(obj) {
      if (obj === null || obj === undefined) return '';
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'number') return String(obj);
      if (Array.isArray(obj)) return obj.map(getCaseValuesString).join(' ');
      if (typeof obj === 'object') {
        return Object.values(obj).map(getCaseValuesString).join(' ');
      }
      return '';
    }

    // 建立案件文字搜尋索引
    function buildCaseSearchString(c) {
      let extra = [];
      extra.push(c.type === 'life' ? '壽 壽險' : '產 產險');
      extra.push(c.caseSource === 'inbound' ? '自 自來' : '開 開發');
      if (c.source === 'relative') extra.push('緣 緣故');
      else if (c.source === 'referral') extra.push('轉 轉介');
      else extra.push('陌 陌開');
      
      return (getCaseValuesString(c) + ' ' + extra.join(' ')).toLowerCase();
    }

    // 儲存搜尋歷史
    function saveSearchHistory(query) {
      if (!query || query.trim() === '') return;
      const trimmed = query.trim();
      // 移除重複並推入最前端
      searchHistory = searchHistory.filter(q => q !== trimmed);
      searchHistory.unshift(trimmed);
      if (searchHistory.length > 5) {
        searchHistory = searchHistory.slice(0, 5);
      }
      localStorage.setItem('crm_search_history', JSON.stringify(searchHistory));
      renderSearchDropdown();
    }

    // 刪除特定搜尋歷史
    function deleteSearchHistory(index, event) {
      if (event) event.stopPropagation(); // 阻止氣泡事件，防止觸發輸入框搜尋
      searchHistory.splice(index, 1);
      localStorage.setItem('crm_search_history', JSON.stringify(searchHistory));
      renderSearchDropdown();
      document.getElementById('global-search-input').focus();
    }

    // 渲染搜尋下拉選單
    function renderSearchDropdown() {
      const historyList = document.getElementById('search-history-list');
      const tagsList = document.getElementById('search-tags-list');
      if (!historyList || !tagsList) return;

      // 1. 渲染歷史紀錄
      if (searchHistory.length === 0) {
        historyList.innerHTML = `<div style="font-size: 0.78rem; color: var(--text-secondary); padding: 6px 8px; opacity: 0.6;">（尚無搜尋紀錄）</div>`;
      } else {
        historyList.innerHTML = searchHistory.map((q, idx) => `
          <div class="search-history-item" onclick="selectSearchItem('${q.replace(/'/g, "\\'")}')">
            <span>⏱️ ${q}</span>
            <button class="delete-history-btn" onclick="deleteSearchHistory(${idx}, event)">✕</button>
          </div>
        `).join('');
      }

      // 2. 渲染議題標籤 (抓取 getCustomIssues() 的前 12 個，避免版面過大)
      const issues = getCustomIssues();
      if (issues.length === 0) {
        tagsList.innerHTML = `<div style="font-size: 0.78rem; color: var(--text-secondary); padding: 4px; opacity: 0.6;">（尚無議題）</div>`;
      } else {
        const uniqueNames = [...new Set(issues.map(item => item.name))].slice(0, 12);
        tagsList.innerHTML = uniqueNames.map(name => `
          <span class="search-tag-item" onclick="selectSearchItem('${name.replace(/'/g, "\\'")}')">${name}</span>
        `).join('');
      }
    }

    // 選擇搜尋項目 (點擊歷史或標籤時)
    function selectSearchItem(query) {
      const input = document.getElementById('global-search-input');
      if (!input) return;
      input.value = query;
      searchQuery = query;
      
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn) clearBtn.style.display = 'block';

      saveSearchHistory(query);
      renderCases();
      hideSearchDropdown();
    }

    // 顯示與隱藏下拉選單
    function showSearchDropdown() {
      const dropdown = document.getElementById('search-dropdown');
      if (dropdown) {
        renderSearchDropdown();
        dropdown.style.display = 'flex';
      }
    }

    function hideSearchDropdown() {
      // 延遲隱藏，確保點擊項目的事件能被優先觸發
      setTimeout(() => {
        const dropdown = document.getElementById('search-dropdown');
        if (dropdown) dropdown.style.display = 'none';
      }, 200);
    }

    // 搜尋防抖
    let searchDebounceTimer = null;
    function handleSearchInput(e) {
      const value = e.target.value;
      searchQuery = value;

      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn) {
        clearBtn.style.display = value ? 'block' : 'none';
      }

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        renderCases();
        if (e.key === 'Enter') {
          saveSearchHistory(value);
          hideSearchDropdown();
        }
      }, 200);
    }

    // 拖曳排序事件綁定 (一次性綁定)
    function initDragAndDrop() {
      const container = document.getElementById('case-list-body');
      if (!container) return;

      container.addEventListener('dragstart', (e) => {
        if (crmSettings.currentSortMode && crmSettings.currentSortMode !== 'manual') {
          e.preventDefault();
          return;
        }
        const row = e.target.closest('.case-row');
        if (!row) return;
        row.classList.add('dragging');
        e.dataTransfer.setData('text/plain', row.dataset.id);
        
        // 拖曳時關閉所有抽屜，避免版面跳動
        closeAllDrawers();
      });

      container.addEventListener('dragend', (e) => {
        if (crmSettings.currentSortMode && crmSettings.currentSortMode !== 'manual') {
          e.preventDefault();
          return;
        }
        const row = e.target.closest('.case-row');
        if (!row) return;
        row.classList.remove('dragging');
        
        // 清理所有過渡的 drag-over 樣式
        document.querySelectorAll('.case-row').forEach(el => el.classList.remove('drag-over'));

        // 更新資料庫中的順序
        updateCasesOrderFromDOM();
      });

      container.addEventListener('dragover', (e) => {
        if (crmSettings.currentSortMode && crmSettings.currentSortMode !== 'manual') {
          return;
        }
        e.preventDefault();
        const draggingRow = document.querySelector('.case-row.dragging');
        if (!draggingRow) return;

        const row = e.target.closest('.case-row');
        if (!row || row === draggingRow) return;

        const bounding = row.getBoundingClientRect();
        const offset = e.clientY - bounding.top;
        const isAfter = offset > bounding.height / 2;

        // 清理其他行的 drag-over
        document.querySelectorAll('.case-row').forEach(el => el.classList.remove('drag-over'));
        
        row.classList.add('drag-over');

        if (isAfter) {
          if (row.nextSibling) {
            container.insertBefore(draggingRow, row.nextSibling);
          } else {
            container.appendChild(draggingRow);
          }
        } else {
          container.insertBefore(draggingRow, row);
        }
        
        // 拖曳過程中動態調整對應 drawer-row 的 DOM 位置 (使其緊隨 case-row)
        const drawerId = `drawer-row-${draggingRow.dataset.id}`;
        const drawerDom = document.getElementById(drawerId);
        if (drawerDom) {
          draggingRow.after(drawerDom);
        }
      });
      
      container.addEventListener('dragleave', (e) => {
        const row = e.target.closest('.case-row');
        if (row) row.classList.remove('drag-over');
      });
    }

    // 將 DOM 目前的順序對應回 cases 陣列並儲存
    function updateCasesOrderFromDOM() {
      const container = document.getElementById('case-list-body');
      if (!container) return;

      const rowElements = container.querySelectorAll('.case-row');
      const newOrderIds = Array.from(rowElements).map(el => el.dataset.id);

      // 重新整理 cases 陣列
      const orderedCases = [];
      newOrderIds.forEach(id => {
        const c = cases.find(item => item.id === id);
        if (c) orderedCases.push(c);
      });

      // 把那些不在 DOM 中的案件（例如被過濾掉或已封存的）也保留並加到後面，防止遺失
      cases.forEach(c => {
        if (!orderedCases.some(item => item.id === c.id)) {
          orderedCases.push(c);
        }
      });

      cases = orderedCases;
      saveCasesToStorage(true); // 只有拖曳排序時，才更新順序快取排序檔案！
      debugLog("💾 拖曳重排已寫入本機排序快取! 目前順序陣列: " + JSON.stringify(cases.map(c => c.id)));
      
      // 若開啟了雲端同步，則進行備份
      if (!crmSettings.isOffline && crmSettings.apiUrl) {
        // 調用背景同步 update
        cases.forEach(c => {
          const mappedData = mapCaseToSheetData(c);
          syncChange('update', c.clientName, mappedData);
        });
      }
    }

    // ===== 週約訪看板 =====
    function renderWeeklyCalendar() {
      const bar = document.getElementById('weekly-calendar-bar');
      if (!bar) return;

      // 取得台灣時間今日
      const now = new Date();
      const twOffset = 8 * 60 * 60 * 1000;
      const twNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + twOffset);

      const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
      const days = [];

      for (let i = 0; i < 14; i++) {
        const d = new Date(twNow);
        d.setDate(twNow.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        days.push({
          dateStr: `${yyyy}-${mm}-${dd}`,
          label: i === 0 ? '今天' : dayLabels[d.getDay()],
          display: `${mm}/${dd}`,
          isToday: i === 0,
          cases: []
        });
      }

      // 掃描所有未封存案件，收集其在所有已確認階段的約訪日期，使日曆能準確顯示所有排定行程
      const activeCases = cases.filter(c => !c.archived);
      activeCases.forEach(c => {
        const targetDates = [];
        if (c.oaDetails && c.oaDetails.meetState === 'confirmed') {
          if (c.oaDetails.meetDate) targetDates.push(c.oaDetails.meetDate);
        }
        if (c.pcDetails && c.pcDetails.meetState === 'confirmed') {
          if (c.pcDetails.meetDate) targetDates.push(c.pcDetails.meetDate);
        }
        if (c.cDetails && c.cDetails.meetState === 'confirmed') {
          if (c.cDetails.meetDate) targetDates.push(c.cDetails.meetDate);
        }
        if (c.sDetails && c.sDetails.meetState === 'confirmed') {
          if (c.sDetails.meetDate) targetDates.push(c.sDetails.meetDate);
        }

        // 去重並計入行事曆對應日期
        const uniqueDates = [...new Set(targetDates)];
        uniqueDates.forEach(dStr => {
          const normalized = dStr.replace(/\//g, '-');
          const dayObj = days.find(d => d.dateStr === normalized);
          if (dayObj) {
            if (!dayObj.cases.some(item => item.id === c.id)) {
              dayObj.cases.push(c);
            }
          }
        });
      });

      // 渲染卡片
      bar.innerHTML = days.map(day => {
        const hasVisit = day.cases.length > 0;
        const isSelected = filterWeeklyDate === day.dateStr;
        const classes = [
          'week-day-card',
          hasVisit ? 'has-visit' : '',
          day.isToday ? 'is-today' : '',
          isSelected ? 'selected-filter' : ''
        ].filter(Boolean).join(' ');

        const tooltipItems = day.cases.map(c =>
          `<div class="week-tooltip-item">
            <span style="color:${getPhaseColor(c.currentPhase)}; font-weight:700; font-size:0.6rem;">${c.currentPhase}</span>
            <span>${(c.clientName || '').slice(0, 6)}</span>
          </div>`
        ).join('');

        const tooltip = hasVisit ? `
          <div class="week-tooltip">
            <div class="week-tooltip-title">📋 ${day.display} 約訪名單</div>
            ${tooltipItems}
          </div>` : '';

        // 單擊滾動高亮，雙擊進行篩選
        const clickAttr = hasVisit
          ? `onclick="onWeeklyCardClick('${day.dateStr}', event)" ondblclick="onWeeklyCardDblClick('${day.dateStr}', event)"`
          : '';

        return `
          <div class="${classes}" ${clickAttr}>
            <div class="week-day-label">${day.label}</div>
            <div class="week-day-date">${day.display}</div>
            <div class="week-day-count">${hasVisit ? day.cases.length : '—'}</div>
            ${tooltip}
          </div>`;
      }).join('');
    }

    // 取得各階段顏色，供週看板 tooltip 使用
    function getPhaseColor(phase) {
      const colors = { SA: '#f59e0b', OA: '#f97316', PC: '#a855f7', C: '#22c55e', S: '#3b82f6' };
      return colors[phase] || '#a6adc8';
    }

    // 取得篩選匹配的階段樣式類別
    function getFilterMatchedClass(c, phase) {
      if (!filterWeeklyDate) return '';
      let targetDate = '';
      if (phase === 'OA') {
        if (c.oaDetails && c.oaDetails.meetState === 'confirmed') targetDate = c.oaDetails.meetDate || '';
      } else if (phase === 'PC') {
        if (c.pcDetails && c.pcDetails.meetState === 'confirmed') targetDate = c.pcDetails.meetDate || '';
      } else if (phase === 'C') {
        if (c.cDetails && c.cDetails.meetState === 'confirmed') targetDate = c.cDetails.meetDate || '';
      } else if (phase === 'S') {
        if (c.sDetails && c.sDetails.meetState === 'confirmed') targetDate = c.sDetails.meetDate || '';
      }
      return targetDate.replace(/\//g, '-') === filterWeeklyDate ? 'filter-matched-node' : '';
    }

    // 點擊週看板卡片：滾動至第一個符合日期的案件列並霓虹閃爍
    function scrollToFirstCaseOnDay(dateStr) {
      const activeCases = cases.filter(c => !c.archived);
      let targetCase = null;
      for (const c of activeCases) {
        let targetDate = '';
        const phase = c.currentPhase || 'SA';
        if (phase === 'SA') {
          if (c.saDetails && c.saDetails.agreeState === 'active') targetDate = c.saDetails.agreeDate || '';
        } else if (phase === 'OA') {
          if (c.oaDetails && c.oaDetails.meetState === 'confirmed') targetDate = c.oaDetails.meetDate || '';
        } else if (phase === 'PC') {
          if (c.pcDetails && c.pcDetails.meetState === 'confirmed') targetDate = c.pcDetails.meetDate || '';
        } else if (phase === 'C') {
          if (c.cDetails && c.cDetails.meetState === 'confirmed') targetDate = c.cDetails.meetDate || '';
        } else if (phase === 'S') {
          if (c.sDetails && c.sDetails.meetState === 'confirmed') targetDate = c.sDetails.meetDate || '';
        }
        if (targetDate.replace(/\//g, '-') === dateStr) { targetCase = c; break; }
      }
      if (!targetCase) return;
      const row = document.querySelector(`.case-row[data-id="${targetCase.id}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        row.classList.add('neon-flash');
        setTimeout(() => row.classList.remove('neon-flash'), 2100);
      }, 300);
    }

    window.onWeeklyCardClick = function(dateStr, event) {
      scrollToFirstCaseOnDay(dateStr);
    };

    window.onWeeklyCardDblClick = function(dateStr, event) {
      if (event) event.stopPropagation();
      if (filterWeeklyDate === dateStr) {
        filterWeeklyDate = '';
        showToast('已清除日期篩選', 'success');
      } else {
        filterWeeklyDate = dateStr;
        showToast(`已篩選出 ${dateStr.slice(5)} 的約訪案件`, 'success');
      }
      renderCases();
    };

    window.clearWeeklyDateFilter = function() {
      filterWeeklyDate = '';
      renderCases();
    };

    function renderCases() {
      const body = document.getElementById('case-list-body');
      body.innerHTML = '';

      // 每次重繪時同步刷新週約訪看板
      renderWeeklyCalendar();
      checkTodayVisits();

      autoSyncCustomersFromCases();
      // 根據 currentSortMode 對案件進行排序
      const sortMode = crmSettings.currentSortMode || 'manual';
      
      // 更新搜尋欄右側按鈕的 UI 狀態與文字
      const toggleBtn = document.getElementById('btn-sort-toggle');
      if (toggleBtn) {
        toggleBtn.className = `sort-toggle-btn mode-${sortMode}`;
        if (sortMode === 'manual') toggleBtn.innerHTML = '<span>🖐️ 手動排序</span>';
        else if (sortMode === 'status') toggleBtn.innerHTML = '<span>⚡ 智能狀態</span>';
        else if (sortMode === 'time') toggleBtn.innerHTML = '<span>⏳ 冷案追蹤</span>';
      }

      // 根據封存狀態過濾案件
      let visibleCases = cases.filter(c => showingArchived ? c.archived === true : !c.archived);

      // 根據搜尋關鍵字過濾案件
      if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.trim().toLowerCase();
        visibleCases = visibleCases.filter(c => buildCaseSearchString(c).includes(query));
      }

      // 根據週看板雙擊日期進行篩選
      if (filterWeeklyDate) {
        visibleCases = visibleCases.filter(c => {
          const targetDates = [];
          if (c.oaDetails && c.oaDetails.meetState === 'confirmed') {
            if (c.oaDetails.meetDate) targetDates.push(c.oaDetails.meetDate);
          }
          if (c.pcDetails && c.pcDetails.meetState === 'confirmed') {
            if (c.pcDetails.meetDate) targetDates.push(c.pcDetails.meetDate);
          }
          if (c.cDetails && c.cDetails.meetState === 'confirmed') {
            if (c.cDetails.meetDate) targetDates.push(c.cDetails.meetDate);
          }
          if (c.sDetails && c.sDetails.meetState === 'confirmed') {
            if (c.sDetails.meetDate) targetDates.push(c.sDetails.meetDate);
          }
          return targetDates.some(dStr => dStr.replace(/\//g, '-') === filterWeeklyDate);
        });

        // 建立並顯示篩選狀態提示列
        const filterBar = document.createElement('div');
        filterBar.style = 'background: rgba(245,158,11,0.08); border-bottom: 1px solid rgba(245,158,11,0.2); padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: #f59e0b; font-weight: 600; border-radius: 6px; margin-bottom: 10px;';
        filterBar.innerHTML = `
          <span>📅 正在顯示 ${filterWeeklyDate} 的約訪案件 (${visibleCases.length} 件)</span>
          <span onclick="clearWeeklyDateFilter()" style="cursor: pointer; text-decoration: underline; color: #a6adc8;">清除篩選</span>
        `;
        body.appendChild(filterBar);
      }

      // 執行排序
      if (sortMode === 'status') {
        const priorityMap = crmSettings.customSubTagPriority || {};
        visibleCases.sort((a, b) => {
          const getCaseWeight = (c) => {
            let maxW = 0;
            // expectedStates 預設為 active 和 ongoing
            const check = (state, tagKey, expectedStates = ['active', 'ongoing']) => {
              if (expectedStates.includes(state)) {
                // 優先使用自訂權重，設為 0 表示不參與排序
                const w = priorityMap[tagKey] !== undefined ? priorityMap[tagKey] : 5;
                if (w > 0 && w > maxW) maxW = w;
              }
            };
            // SA
            if (c.saDetails) {
              if (c.saDetails.sendState === 'active') check('active', 'sa_send');
              if (c.saDetails.replyState === 'active' || c.saDetails.replyState === 'ongoing') check('active', 'sa_reply');
              if (c.saDetails.agreeState === 'active') check('active', 'sa_agree');
              // 新增：SA 喬時間中、考慮中、沒意願的排序權重判斷
              if (c.saDetails.intentState === 'pending') check('pending', 'sa_pending', ['pending']);
              if (c.saDetails.intentState === 'intent-pending') check('intent-pending', 'sa_intent_pending', ['intent-pending']);
              if (c.saDetails.intentState === 'intent-no') check('intent-no', 'sa_intent_no', ['intent-no']);
            }
            // OA
            if (c.oaDetails) {
              check(c.oaDetails.planState, 'oa_plan');
              check(c.oaDetails.practiceState, 'oa_practice');
              check(c.oaDetails.discussState, 'oa_discuss');
              // 新增：OA 喬時間中
              if (c.oaDetails.meetState === 'pending') check('pending', 'oa_pending', ['pending']);
            }
            // PC
            if (c.pcDetails) {
              check(c.pcDetails.planState, 'pc_plan');
              check(c.pcDetails.discussState, 'pc_discuss');
              check(c.pcDetails.practiceState, 'pc_practice');
              // 新增：PC 喬時間中
              if (c.pcDetails.meetState === 'pending') check('pending', 'pc_pending', ['pending']);
            }
            // C
            if (c.cDetails) {
              check(c.cDetails.planState, 'c_plan');
              check(c.cDetails.signState, 'c_sign');
              check(c.cDetails.practiceState, 'c_practice');
              check(c.cDetails.remedyState, 'c_remedy');
              check(c.cDetails.submitState, 'c_submit');
              check(c.cDetails.discussState, 'c_discuss');
              // 新增：C 喬時間中
              if (c.cDetails.meetState === 'pending') check('pending', 'c_pending', ['pending']);
            }
            // S
            if (c.sDetails) {
              check(c.sDetails.planState, 's_plan');
              check(c.sDetails.practiceState, 's_practice');
              check(c.sDetails.discussState, 's_discuss');
              // 新增：S 喬時間中
              if (c.sDetails.meetState === 'pending') check('pending', 's_pending', ['pending']);
            }
            return maxW;
          };
          return getCaseWeight(b) - getCaseWeight(a);
        });
      } else if (sortMode === 'time') {
        visibleCases.sort((a, b) => {
          const tA = a.lastUpdated || '9999-99-99 99:99:99';
          const tB = b.lastUpdated || '9999-99-99 99:99:99';
          return tA.localeCompare(tB);
        });
      } else {
        sortCasesBySavedOrder(visibleCases);
      }

      visibleCases.forEach((c) => {
        // 確保所有案件子屬性結構完整，相容舊有本機快取資料，防止 TypeError 崩潰
        c.saDetails = Object.assign({ sendState: "dim", sendDate: "", replyState: "dim", replyDate: "", intentState: "intent-pending", agreeState: "dim", agreeDate: "", meetTimeSlot: "" }, c.saDetails || {});
        c.oaDetails = Object.assign({ meetDate: "", meetState: "", meetTimeSlot: "", planState: "dim", planDate: "", practiceState: "dim", practiceDate: "", discussState: "dim", discussDate: "", planNotes: "", discussNotes: "", rescheduleHistory: [] }, c.oaDetails || {});
        c.pcDetails = Object.assign({ meetDate: "", meetState: "", meetTimeSlot: "", planState: "dim", planDate: "", practiceState: "dim", practiceDate: "", discussState: "dim", discussDate: "", discussNotes: "", rescheduleHistory: [] }, c.pcDetails || {});
        c.cDetails = Object.assign({ meetDate: "", meetState: "", planState: "dim", planDate: "", signState: "dim", signDate: "", remedyState: "dim", remedyDate: "", submitState: "dim", submitDate: "", submitProcessed: "", practiceState: "dim", practiceDate: "", discussState: "dim", discussDate: "", planNotes: "", discussNotes: "", rescheduleHistory: [] }, c.cDetails || {});
        c.sDetails = Object.assign({ meetDate: "", meetState: "", planState: "dim", planDate: "", practiceState: "dim", practiceDate: "", discussState: "dim", discussDate: "", planNotes: "", discussNotes: "" }, c.sDetails || {});

        // 建立卡片列
        const row = document.createElement('div');
        row.className = 'case-row';
        row.id = `case-row-${c.id}`;
        row.dataset.id = c.id;
        row.ondblclick = (event) => handleRowDblClick(event, c.id);
        row.setAttribute('draggable', sortMode === 'manual' ? 'true' : 'false');
        if (sortMode !== 'manual') {
          row.style.cursor = 'default';
          row.title = '請切換至手動排序模式即可進行拖曳排序';
        } else {
          row.style.cursor = 'grab';
          row.title = '拖曳即可調整案件先後順序';
        }

        // 1. 險種 (壽/產)
        const typeText = c.type === 'life' ? '壽' : '產';
        const typeClass = c.type === 'life' ? 'life' : 'property';
        const typeBadge = `<span class="type-badge ${typeClass}">${typeText}</span>`;

        // 2. 案源 (自/開)
        const caseSourceText = c.caseSource === 'inbound' ? '自' : '開';
        const caseSourceClass = c.caseSource === 'inbound' ? 'inbound' : 'outbound';
        const caseSourceBadge = `<span class="source-badge ${caseSourceClass}" title="案源: ${c.caseSource === 'inbound' ? '自來' : '開發'}">${caseSourceText}</span>`;

        // 3. 來源 (緣/轉/陌)
        let sourceBadge = '';
        if (c.source === 'relative') {
          const tagsText = (c.relativeTags && c.relativeTags.length > 0) ? c.relativeTags.join(', ') : '無標籤';
          sourceBadge = `<span class="source-badge relative" title="緣故 (${tagsText})">緣</span>`;
        } else if (c.source === 'referral') {
          const refText = c.referrerName || '未填寫介紹人';
          sourceBadge = `<span class="source-badge referral" title="轉介人: ${refText}">轉</span>`;
        } else {
          sourceBadge = `<span class="source-badge cold" title="陌開開發">陌</span>`;
        }

        // 動態計算 SA 回覆與意願標籤狀態
        let replyText = '未回覆';
        let replyClass = '';
        if (c.saDetails.replyState === 'active') {
          if (c.saDetails.intentState === 'intent-pending') {
            replyText = '互動中';
            replyClass = 'active intent-pending';
          } else if (c.saDetails.intentState === 'intent-no') {
            replyText = '無意願';
            replyClass = 'active intent-no';
          } else {
            replyText = '互動中';
            replyClass = 'active intent-pending';
          }
        }

        // 算出 SA 第三個按鈕「約定」的四種狀態 (未約定、喬時間、擱置中、已約定) - 不顯示日期
        let agreeText = '未約定';
        let agreeClass = '';
        if (c.saDetails.agreeState === 'active') {
          agreeText = '已約定';
          agreeClass = 'active agree';
        } else if (c.saDetails.intentState === 'intent-hold') {
          agreeText = '擱置中';
          agreeClass = 'active agree-hold';
        } else if (c.oaDetails.meetState === 'pending' || c.saDetails.intentState === 'intent-pending') {
          agreeText = '喬時間';
          agreeClass = 'active pending';
        } else {
          agreeText = '未約定';
          agreeClass = '';
        }

        const saDateText = formatShortDate(c.saDetails.sendDate || '');
        const oaDateText = formatShortDate(c.oaDetails.meetDate || '');
        const pcDateText = formatShortDate((c.pcDetails && c.pcDetails.meetDate) || '');
        const cDateText = formatShortDate((c.cDetails && c.cDetails.practiceDate) || '');
        const sDateText = formatShortDate((c.sDetails && c.sDetails.meetDate) || '');

        let visitTypeText = '議';
        let visitTypeClass = 'issue-visit';
        let visitTypeTitle = '議題訪';
        if (c.visitType === 'life') {
          visitTypeText = '生';
          visitTypeClass = 'life-visit';
          visitTypeTitle = '生活訪';
        } else if (c.visitType === 'service') {
          visitTypeText = '服';
          visitTypeClass = 'service-visit';
          visitTypeTitle = '服務訪';
        } else if (c.visitType === 'coffee') {
          visitTypeText = '咖';
          visitTypeClass = 'coffee-visit';
          visitTypeTitle = '咖啡訪';
        }
        const visitTypeBadge = `<span class="source-badge ${visitTypeClass}" title="訪談類型: ${visitTypeTitle}">${visitTypeText}</span>`;

        // 迫切度微章 (今日約訪與喬時間中)
        let urgencyBadge = '';
        const todayStr = new Date().toISOString().split('T')[0];
        const sa = c.saDetails || {};
        const oa = c.oaDetails || {};
        const pc = c.pcDetails || {};
        const cc = c.cDetails || {};
        const s = c.sDetails || {};
        
        let hasTodayMeet = false;
        let hasPendingMeet = false;
        
        if (c.currentPhase === 'SA' && sa.agreeDate === todayStr) hasTodayMeet = true;
        if (c.currentPhase === 'OA' && oa.meetDate === todayStr) hasTodayMeet = true;
        if (c.currentPhase === 'PC' && pc.meetDate === todayStr) hasTodayMeet = true;
        if (c.currentPhase === 'C' && cc.meetDate === todayStr) hasTodayMeet = true;
        if (c.currentPhase === 'S' && s.meetDate === todayStr) hasTodayMeet = true;
        
        if (c.currentPhase === 'OA' && oa.meetState === 'pending') hasPendingMeet = true;
        if (c.currentPhase === 'PC' && pc.meetState === 'pending') hasPendingMeet = true;
        if (c.currentPhase === 'C' && cc.meetState === 'pending') hasPendingMeet = true;
        if (c.currentPhase === 'S' && s.meetState === 'pending') hasPendingMeet = true;
        
        if (hasTodayMeet) {
          urgencyBadge = `<span class="urgency-badge today-visit" title="今日有約訪流程！">🔥 今日約訪</span>`;
        } else if (hasPendingMeet) {
          urgencyBadge = `<span class="urgency-badge pending-visit" title="時間喬定中">待確認</span>`;
        }

        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 4px; min-width: 0; flex-shrink: 0;">
            <div style="display: flex; gap: 2px; flex-shrink: 0; align-items: center;">
              ${typeBadge}
              ${visitTypeBadge}
              ${sourceBadge}
              ${caseSourceBadge}
            </div>
            <span style="color:rgba(255,255,255,0.2); margin: 0 4px; font-size:0.75rem; font-weight:bold; flex-shrink:0;">｜</span>
            <div class="client-name" onclick="openC360FromCaseRow('${c.clientName}')">${(c.clientName || '').slice(0, 5)}</div>
            <span style="color:rgba(255,255,255,0.2); margin: 0 4px; font-size:0.75rem; font-weight:bold; flex-shrink:0;">｜</span>
            <div class="issue-start" onclick="openDrawer('${c.id}', 'issue')">${(c.issueName || '').slice(0, 5)}</div>
          </div>
          <div class="flow-track">
            <!-- SA (以發出日期為主亮燈) -->
            <div class="flow-node ${getNodeStatus(c, 'SA')} ${getFilterMatchedClass(c, 'SA')}" data-phase="SA" 
                 onclick="onNodeClick(event, '${c.id}', 'SA')">
              <div class="node-core-container">
                <div class="node-date" style="width: 44px; text-align: right; font-size: 0.65rem; color: var(--text-secondary); font-family: monospace; white-space: nowrap; flex-shrink: 0;">${saDateText}</div>
                <div class="node-dot">SA</div>
                <div class="sub-tag-group" onclick="event.stopPropagation()">
                  <span class="sub-tag-btn ${c.saDetails.sendState === 'active' ? 'active send' : ''}" onclick="toggleSASendDirect('${c.id}', event)">${c.saDetails.sendState === 'active' ? '已發出' : '未發出'}</span>
                  <span class="sub-tag-btn ${replyClass}" onclick="cycleSAReplyDirect('${c.id}', event)">${replyText}</span>
                  <span class="sub-tag-btn ${agreeClass}" onclick="toggleSAAgreeDirect('${c.id}', event)">${agreeText}</span>
                </div>
              </div>
            </div>
            <!-- OA (以會面日期為主亮燈) -->
            <div class="flow-node ${getNodeStatus(c, 'OA')} ${getFilterMatchedClass(c, 'OA')}" data-phase="OA" onclick="onNodeClick(event, '${c.id}', 'OA')">
              <div class="node-core-container">
                <div class="node-date" style="width: 44px; text-align: right; font-size: 0.65rem; color: var(--text-secondary); font-family: monospace; white-space: nowrap; flex-shrink: 0;">${oaDateText}</div>
                <div class="node-dot">OA</div>
                <div class="sub-tag-group" onclick="event.stopPropagation()">
                  <span class="sub-tag-btn ${c.oaDetails.planState === 'active' ? 'active plan' : (c.oaDetails.planState === 'ongoing' ? 'ongoing-oa' : '')}" onclick="toggleOAPlanDirect('${c.id}', event)">${c.oaDetails.planState === 'active' ? fmtSubLabel('訪前規劃', c.oaDetails.planDate) : (c.oaDetails.planState === 'ongoing' ? fmtSubLabel('訪前規劃', c.oaDetails.planDate) : '訪前規劃')}</span>
                  <span class="sub-tag-btn ${c.oaDetails.practiceState === 'active' ? 'active practice' : (c.oaDetails.practiceState === 'ongoing' ? 'ongoing-oa' : '')}" onclick="toggleOAPracticeDirect('${c.id}', event)">${c.oaDetails.practiceState === 'active' ? fmtSubLabel('訪前演練', c.oaDetails.practiceDate) : (c.oaDetails.practiceState === 'ongoing' ? fmtSubLabel('訪前演練', c.oaDetails.practiceDate) : '訪前演練')}</span>
                  <span class="sub-tag-btn ${c.oaDetails.discussState === 'active' ? 'active discuss' : (c.oaDetails.discussState === 'ongoing' ? 'ongoing-oa' : '')}" onclick="toggleOADiscussDirect('${c.id}', event)">${c.oaDetails.discussState === 'active' ? fmtSubLabel('訪後討論', c.oaDetails.discussDate) : (c.oaDetails.discussState === 'ongoing' ? fmtSubLabel('訪後討論', c.oaDetails.discussDate) : '訪後討論')}</span>
                </div>
              </div>
            </div>
            <!-- PC (以遞送日期為主亮燈) -->
            <div class="flow-node ${getNodeStatus(c, 'PC')} ${getFilterMatchedClass(c, 'PC')}" data-phase="PC" onclick="onNodeClick(event, '${c.id}', 'PC')">
              <div class="node-core-container">
                <div class="node-date" style="width: 44px; text-align: right; font-size: 0.65rem; color: var(--text-secondary); font-family: monospace; white-space: nowrap; flex-shrink: 0;">${pcDateText}</div>
                <div class="node-dot">PC</div>
                <div class="sub-tag-group" onclick="event.stopPropagation()">
                  <span class="sub-tag-btn ${c.pcDetails.planState === 'active' ? 'active pc-plan' : (c.pcDetails.planState === 'ongoing' ? 'ongoing-pc' : '')}" onclick="togglePCPlanDirect('${c.id}', event)">${c.pcDetails.planState === 'active' ? fmtSubLabel('規劃建議', c.pcDetails.planDate) : (c.pcDetails.planState === 'ongoing' ? fmtSubLabel('規劃建議', c.pcDetails.planDate) : '規劃建議')}</span>
                  <span class="sub-tag-btn ${c.pcDetails.discussState === 'active' ? 'active pc-discuss' : (c.pcDetails.discussState === 'ongoing' ? 'ongoing-pc' : '')}" onclick="togglePCDiscussDirect('${c.id}', event)">${c.pcDetails.discussState === 'active' ? fmtSubLabel('已傳建議', c.pcDetails.discussDate) : (c.pcDetails.discussState === 'ongoing' ? fmtSubLabel('已傳建議', c.pcDetails.discussDate) : '已傳建議')}</span>
                  <span class="sub-tag-btn ${c.pcDetails.practiceState === 'active' ? 'active pc-practice' : (c.pcDetails.practiceState === 'ongoing' ? 'ongoing-pc' : '')}" onclick="togglePCPracticeDirect('${c.id}', event)">${c.pcDetails.practiceState === 'active' ? fmtSubLabel('講解演練', c.pcDetails.practiceDate) : (c.pcDetails.practiceState === 'ongoing' ? fmtSubLabel('講解演練', c.pcDetails.practiceDate) : '講解演練')}</span>
                </div>
              </div>
            </div>
            <!-- C -->
            <div class="flow-node ${getNodeStatus(c, 'C')} ${getFilterMatchedClass(c, 'C')}" data-phase="C" onclick="onNodeClick(event, '${c.id}', 'C')" style="width: 260px;">
              <div class="node-core-container">
                <div class="node-date" style="width: 44px; text-align: right; font-size: 0.65rem; color: var(--text-secondary); font-family: monospace; white-space: nowrap; flex-shrink: 0;">${cDateText}</div>
                <div class="node-dot">C</div>
                <div class="sub-tag-group c-grid" onclick="event.stopPropagation()">
                  <span class="sub-tag-btn ${c.cDetails.planState === 'active' ? 'active c-plan' : (c.cDetails.planState === 'ongoing' ? 'ongoing-c' : '')}" style="grid-column: 1; grid-row: 1;" onclick="toggleCPlanDirect('${c.id}', event)">${c.cDetails.planState === 'active' ? fmtSubLabel('文件準備', c.cDetails.planDate) : (c.cDetails.planState === 'ongoing' ? fmtSubLabel('文件準備', c.cDetails.planDate) : '文件準備')}</span>
                  <span class="sub-tag-btn ${c.cDetails.signState === 'active' ? 'active c-sign' : (c.cDetails.signState === 'ongoing' ? 'ongoing-c' : '')}" style="grid-column: 2; grid-row: 1;" onclick="toggleCSignDirect('${c.id}', event)">${c.cDetails.signState === 'active' ? fmtSubLabel('簽約', c.cDetails.signDate) : (c.cDetails.signState === 'ongoing' ? fmtSubLabel('簽約', c.cDetails.signDate) : '簽約')}</span>
                  <span class="sub-tag-btn ${c.cDetails.practiceState === 'active' ? 'active c-practice' : (c.cDetails.practiceState === 'ongoing' ? 'ongoing-c' : '')}" style="grid-column: 1; grid-row: 2;" onclick="toggleCPracticeDirect('${c.id}', event)">${c.cDetails.practiceState === 'active' ? fmtSubLabel('要保簽署', c.cDetails.practiceDate) : (c.cDetails.practiceState === 'ongoing' ? fmtSubLabel('要保簽署', c.cDetails.practiceDate) : '要保簽署')}</span>
                  <span class="sub-tag-btn ${c.cDetails.remedyState === 'active' ? 'active c-remedy' : (c.cDetails.remedyState === 'ongoing' ? 'ongoing-c' : '')}" style="grid-column: 2; grid-row: 2;" onclick="toggleCRemedyDirect('${c.id}', event)">${c.cDetails.remedyState === 'active' ? fmtSubLabel('補件', c.cDetails.remedyDate) : (c.cDetails.remedyState === 'ongoing' ? fmtSubLabel('補件', c.cDetails.remedyDate) : '補件')}</span>
                  <span class="sub-tag-btn ${c.cDetails.discussState === 'active' ? 'active c-discuss' : (c.cDetails.discussState === 'ongoing' ? 'ongoing-c' : '')}" style="grid-column: 1; grid-row: 3;" onclick="toggleCDiscussDirect('${c.id}', event)">${c.cDetails.discussState === 'active' ? fmtSubLabel('保費首扣', c.cDetails.discussDate) : (c.cDetails.discussState === 'ongoing' ? fmtSubLabel('保費首扣', c.cDetails.discussDate) : '保費首扣')}</span>
                  <span class="${getSubmitBtnClass(c)}" style="grid-column: 2; grid-row: 3;" onclick="toggleCSubmitDirect('${c.id}', event)">${c.cDetails.submitState === 'active' ? fmtSubLabel('送件', c.cDetails.submitDate) : (c.cDetails.submitState === 'ongoing' ? fmtSubLabel('送件', c.cDetails.submitDate) : '送件')}</span>
                </div>
              </div>
            </div>
            <!-- S -->
            <div class="flow-node ${getNodeStatus(c, 'S')} ${getFilterMatchedClass(c, 'S')}" data-phase="S" onclick="onNodeClick(event, '${c.id}', 'S')">
              <div class="node-core-container">
                <div class="node-date" style="width: 44px; text-align: right; font-size: 0.65rem; color: var(--text-secondary); font-family: monospace; white-space: nowrap; flex-shrink: 0;">${sDateText}</div>
                <div class="node-dot">S</div>
                <div class="sub-tag-group" onclick="event.stopPropagation()">
                  <span class="sub-tag-btn ${c.sDetails.planState === 'active' ? 'active s-plan' : (c.sDetails.planState === 'ongoing' ? 'ongoing-s' : '')}" onclick="toggleSPlanDirect('${c.id}', event)">${c.sDetails.planState === 'active' ? fmtSubLabel('保單送達', c.sDetails.planDate) : (c.sDetails.planState === 'ongoing' ? fmtSubLabel('保單送達', c.sDetails.planDate) : '保單送達')}</span>
                  <span class="sub-tag-btn ${c.sDetails.practiceState === 'active' ? 'active s-practice' : (c.sDetails.practiceState === 'ongoing' ? 'ongoing-s' : '')}" onclick="toggleSPracticeDirect('${c.id}', event)">${c.sDetails.practiceState === 'active' ? fmtSubLabel('契撤追蹤', c.sDetails.practiceDate) : (c.sDetails.practiceState === 'ongoing' ? fmtSubLabel('契撤追蹤', c.sDetails.practiceDate) : '契撤追蹤')}</span>
                  <span class="sub-tag-btn ${c.sDetails.discussState === 'active' ? 'active s-discuss' : (c.sDetails.discussState === 'ongoing' ? 'ongoing-s' : '')}" onclick="toggleSDiscussDirect('${c.id}', event)">${c.sDetails.discussState === 'active' ? fmtSubLabel('週年服務', c.sDetails.discussDate) : (c.sDetails.discussState === 'ongoing' ? fmtSubLabel('週年服務', c.sDetails.discussDate) : '週年服務')}</span>
                </div>
              </div>
            </div>
          </div>
        `;

        body.appendChild(row);

        // 建立對應的抽屜列
        const drawerRow = document.createElement('div');
        drawerRow.className = 'drawer-row';
        drawerRow.id = `drawer-row-${c.id}`;
        drawerRow.innerHTML = `
          <div class="drawer-handle" onclick="closeAllDrawers()"></div>
          <div class="drawer-arrow" id="drawer-arrow-${c.id}"></div>
          <div class="drawer-container" id="drawer-content-${c.id}"></div>
        `;
        body.appendChild(drawerRow);
      });

      // 恢復先前開啟的抽屜狀態 (防止更新時關閉，並防呆已刪除案件)
      if (activeDrawerState.caseId && activeDrawerState.section) {
        const caseExists = cases.some(item => item.id === activeDrawerState.caseId);
        if (caseExists) {
          openDrawer(activeDrawerState.caseId, activeDrawerState.section, true);
        } else {
          activeDrawerState.caseId = null;
          activeDrawerState.section = null;
        }
      }

    }

    // 全域關閉所有抽屜的方法
    function closeAllDrawers() {
      document.querySelectorAll('.drawer-row').forEach(row => {
        row.style.display = 'none';
        row.dataset.activeSection = '';
      });
      activeDrawerState.caseId = null;
      activeDrawerState.section = null;
    }

    // 開啟抽屜，動態定位箭頭並渲染特定內容
    function openDrawer(caseId, section, forceOpen = false) {
      const c = cases.find(item => item.id === caseId);
      const drawerRow = document.getElementById(`drawer-row-${caseId}`);
      const drawerContent = document.getElementById(`drawer-content-${caseId}`);
      const arrow = document.getElementById(`drawer-arrow-${caseId}`);
      
      // 如果已經點擊了同一個 section，且不是強制開啟，則關閉抽屜
      if (!forceOpen && drawerRow.style.display === 'block' && drawerRow.dataset.activeSection === section) {
        drawerRow.style.display = 'none';
        drawerRow.dataset.activeSection = '';
        activeDrawerState.caseId = null;
        activeDrawerState.section = null;
        return;
      }

      // 關閉所有其他抽屜
      document.querySelectorAll('.drawer-row').forEach(row => {
        if (row.id !== `drawer-row-${caseId}`) {
          row.style.display = 'none';
          row.dataset.activeSection = '';
        }
      });

      // 記錄當前開啟的狀態
      activeDrawerState.caseId = caseId;
      activeDrawerState.section = section;

      const rowElement = document.querySelector(`.case-row[data-id="${caseId}"]`);
      if (!rowElement) return; // 防呆安全退出，防止 JS 崩潰中斷後續代碼
      let targetElement;
      if (section === 'issue') {
        targetElement = rowElement.querySelector('.issue-start');
      } else if (section === 'client') {
        targetElement = rowElement.querySelector('.client-name');
      } else {
        targetElement = rowElement.querySelector(`.flow-node[data-phase="${section}"]`);
      }

      const rowRect = rowElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const elementLeft = targetRect.left - rowRect.left;
      const elementWidth = targetRect.width;
      const rowWidth = rowRect.width;

      // 依據不同階段與裝置設定檔決定抽屜總寬度 (drawerWidth)
      let drawerWidth = 800;
      if (section === 'client' || section === 'SA') {
        drawerWidth = 900;
      } else if (section === 'S') {
        drawerWidth = 820;
      } else if (section === 'OA' || section === 'PC') {
        drawerWidth = 1050; // 進一步加大寬度，提供三個超寬面板與大文字框
      } else if (section === 'C') {
        drawerWidth = 920;
      } else if (section === 'issue') {
        drawerWidth = 680;
      }
      
      let alignOffset = 300;

      // Tablet Fix: 重新調整平板與桌機之 RWD 斷點，並做響應式定位與對齊，防止橫向溢出
      if (window.innerWidth >= 1024) {
        // 設定為 row 滿寬，但不能小於各階段原定之最低橫寬 (drawerWidth)
        const finalWidth = ['OA', 'PC', 'C', 'S'].includes(section)
          ? Math.max(drawerWidth, rowWidth - 20)
          : drawerWidth;

        const lightCenter = elementLeft + elementWidth / 2;
        let computedLeft = lightCenter - (finalWidth / 2);
        
        // 避免超出右邊界
        if (computedLeft + finalWidth > rowWidth - 20) {
          computedLeft = rowWidth - 20 - finalWidth;
        }
        
        // 避免超出左邊界
        if (computedLeft < 10) computedLeft = 10;

        drawerContent.style.marginLeft = `${computedLeft}px`;
        drawerContent.style.width = `${finalWidth}px`;
        
        // 箭頭定位在亮燈中心
        const arrowLeft = (targetRect.left + targetRect.width / 2) - rowRect.left;
        arrow.style.left = `${arrowLeft - 8}px`;
      } else if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        // Tablet Fix: 平板裝置 (768px ~ 1024px)，寬度動態計算，避免超出邊界
        const padding = 20;
        const dynamicWidth = rowWidth - padding * 2;
        const computedLeft = padding; // 置中對齊

        drawerContent.style.marginLeft = `${computedLeft}px`;
        drawerContent.style.width = `${dynamicWidth}px`;

        // 箭頭定位在亮燈中心
        const arrowLeft = (targetRect.left + targetRect.width / 2) - rowRect.left;
        arrow.style.left = `${arrowLeft - 8}px`;
      } else {
        // 手機版寬度滿格、無 margin
        drawerContent.style.marginLeft = '0';
        drawerContent.style.width = '100%';
        arrow.style.left = '50%';
      }

      // 初始化抽屜內容容器，並渲染頂部統一控制列
      drawerContent.innerHTML = '';

      // 為了與 SA 抽屜一樣俐落，OA, PC, C, S 不渲染頂部統一控制列與標籤
      if (['issue'].includes(section)) {
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:6px; margin-bottom:10px;';

        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'font-size:0.82rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;';
        
        let titlePrefix = '📋 邀約議題設定';
        
        titleSpan.innerHTML = titlePrefix;
        headerDiv.appendChild(titleSpan);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex; gap:6px; align-items:center;';

        // 完成按鈕
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn btn-primary';
        doneBtn.style.cssText = 'padding: 2px 6px; font-size: 0.72rem; height: 22px; background:var(--color-c); color:#000; font-weight:700;';
        doneBtn.innerHTML = '✓ 完成';
        doneBtn.onclick = () => {
          drawerRow.style.display = 'none';
          drawerRow.dataset.activeSection = '';
          activeDrawerState.caseId = null;
          activeDrawerState.section = null;
        };
        btnGroup.appendChild(doneBtn);

        headerDiv.appendChild(btnGroup);
        drawerContent.appendChild(headerDiv);
      }

      // 建立抽屜主體容器
      const mainContainer = document.createElement('div');
      mainContainer.id = `drawer-main-${caseId}`;
      drawerContent.appendChild(mainContainer);

      if (section === 'issue') {
        renderIssueDrawer(c, mainContainer);
      } else if (section === 'client') {
        renderClientDrawer(c, mainContainer);
      } else if (section === 'SA') {
        renderSADrawer(c, mainContainer);
      } else if (section === 'OA') {
        renderOADrawer(c, mainContainer);
      } else if (section === 'PC') {
        renderPCDrawer(c, mainContainer);
      } else if (section === 'C') {
        renderCDrawer(c, mainContainer);
      } else if (section === 'S') {
        renderSDrawer(c, mainContainer);
      } else {
        mainContainer.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding: 20px 0;">此階段 [${section}] 的小流程設計正在對齊中...<br><span style="font-size:0.75rem; color:var(--color-sa);">[提示] 雙擊節點可以直接切換至該進度階段</span></div>`;
      }

      // 顯示抽屜
      drawerRow.style.display = 'block';
      drawerRow.dataset.activeSection = section;

      // 自動聚焦輸入欄位 (Auto-focus) - ADHD UX
      if (section === 'issue') {
        const input = document.getElementById(`input-issue-name-${c.id}`);
        if (input) {
          input.focus();
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      } else if (section === 'client') {
        const input = document.getElementById(`input-client-name-${c.id}`);
        if (input) {
          input.focus();
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      }
      // 當開啟抽屜時，平滑滾動到最上方 (ADHD UX)
      setTimeout(() => {
        const rowEl = document.getElementById(`case-row-${caseId}`);
        if (rowEl) {
          // 計算案件行距離網頁頂端的絕對高度，並扣除 header 高度（約 75px），以防被 Navbar 遮擋
          const rect = rowEl.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const targetY = rect.top + scrollTop - 75;
          
          window.scrollTo({
            top: targetY,
            behavior: 'smooth'
          });
        }
      }, 150);
    }

    // 雙擊主幹道空白區域 - 快速為該案建立待辦任務 (ADHD UX)
    function handleRowDblClick(event, caseId) {
      // 如果雙擊事件的目標是互動按鈕、次標籤、大階段點點、客戶姓名、議題標題等，則直接略過
      if (
        event.target.closest('.sub-tag-btn') || 
        event.target.closest('.node-dot') || 
        event.target.closest('.client-name') || 
        event.target.closest('.issue-start') ||
        event.target.closest('button') ||
        event.target.closest('input') ||
        event.target.closest('textarea') ||
        event.target.closest('.source-badge') ||
        event.target.closest('.type-badge')
      ) {
        return;
      }
      
      // 否則，這代表使用者雙擊了案件行的空白區域，自動調用待辦 Modal 並預填案件 ID
      openTodoModal(null, caseId);
    }

    function closeCaseDrawer(caseId) {
      const drawerRow = document.getElementById(`drawer-row-${caseId}`);
      if (drawerRow) {
        drawerRow.style.display = 'none';
        drawerRow.dataset.activeSection = '';
        activeDrawerState.caseId = null;
        activeDrawerState.section = null;
      }
    }

    // 登記新改期紀錄
    function showRescheduleRegisterForm(caseId, phase) {
      const c = cases.find(item => item.id === caseId);
      if (!c) return;
      
      const phaseKey = phase + 'Details';
      const details = c[phaseKey];
      if (!details) return;

      const dateFieldPlaceholder = "請選擇新改期日期";
      const htmlBody = `
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <div class="form-group">
            <label style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap;">⏰ 新的預定日期</label>
            <input type="text" id="reschedule-new-date" readonly placeholder="${dateFieldPlaceholder}" onclick="showCustomDatePicker(this, '${caseId}', '', 'none')" style="height: 28px; font-size:0.8rem; padding: 4px; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; width:100%; cursor:pointer;">
          </div>
          <div class="form-group">
            <label style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap;">📝 改期原因備忘</label>
            <textarea id="reschedule-reason" placeholder="請輸入本次改期的原因或約定細節..." style="height:50px; resize:none; font-size:0.8rem; padding:4px; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; width:100%;"></textarea>
          </div>
        </div>
      `;

      showConfirm({
        icon: '📅',
        title: '登記新的改期紀錄',
        body: htmlBody,
        okText: '登記送出',
        okStyle: 'background:var(--color-sa); color:#000; font-weight:700; border-color:var(--color-sa);',
        onOk: () => {
          const newDate = document.getElementById('reschedule-new-date').value;
          const reason = document.getElementById('reschedule-reason').value;
          if (!newDate) {
            showToast("未選擇改期日期，登記失敗", "error");
            return;
          }

          if (!details.rescheduleHistory) details.rescheduleHistory = [];
          
          updateCase(caseId, item => {
            const itemDetails = item[phase + 'Details'];
            if (!itemDetails.rescheduleHistory) itemDetails.rescheduleHistory = [];
            itemDetails.rescheduleHistory.push({
              newDate: newDate,
              reason: reason,
              recordedAt: new Date().toISOString().split('T')[0]
            });
            itemDetails.meetDate = newDate;
          });
          showToast("已登記改期紀錄", "success");

          // 重新整理抽屜內容
          const drawerContent = document.getElementById(`drawer-content-${caseId}`);
          if (drawerContent) {
            const activeSection = document.getElementById(`drawer-row-${caseId}`).dataset.activeSection;
            openDrawer(caseId, activeSection, true);
          }
        }
      });
    }

    // 顯示與管理改期細節 (支援刪除)
    function showRescheduleDetail(caseId, phase, index) {
      const c = cases.find(item => item.id === caseId);
      if (!c) return;
      const phaseKey = phase + 'Details';
      const details = c[phaseKey];
      if (!details || !details.rescheduleHistory) return;
      const item = details.rescheduleHistory[index];
      if (!item) return;

      showConfirm({
        icon: '📝',
        title: `第 ${index + 1} 次改期詳情`,
        body: `
          <div style="font-size:0.8rem; line-height:1.5;">
            <div><b>登記時間：</b>${item.recordedAt || '無紀錄'}</div>
            <div style="margin-top:4px;"><b>改期至：</b><span style="color:#fb923c; font-weight:700;">${item.newDate}</span></div>
            <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.06); padding-top:6px;">
              <b>原因備忘：</b><br>
              <div style="color:var(--text-secondary); white-space:pre-wrap; margin-top:4px; background:rgba(0,0,0,0.15); padding:6px; border-radius:4px; max-height:120px; overflow-y:auto;">${item.reason || '未填寫原因'}</div>
            </div>
          </div>
        `,
        okText: '刪除此紀錄',
        okStyle: 'background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.4); color:#ef4444;',
        onOk: () => {
          updateCase(caseId, item => {
            const itemDetails = item[phase + 'Details'];
            itemDetails.rescheduleHistory.splice(index, 1);
          });
          showToast("已刪除該筆改期紀錄", "success");
          
          // 重新整理抽屜內容
          const drawerContent = document.getElementById(`drawer-content-${caseId}`);
          if (drawerContent) {
            const activeSection = document.getElementById(`drawer-row-${caseId}`).dataset.activeSection;
            openDrawer(caseId, activeSection, true);
          }
        }
      });
    }


    // === NBS Risk Lock & Confetti ===
    // === Canvas Confetti 粒子紙花動畫 ===
    function triggerConfetti() {
      let canvas = document.getElementById('confetti-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);
      }
      
      const ctx = canvas.getContext('2d');
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      
      const particles = [];
      const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
      
      for (let i = 0; i < 120; i++) {
        particles.push({
          x: width / 2 + (Math.random() - 0.5) * 50,
          y: height + 20,
          vx: (Math.random() - 0.5) * 15,
          vy: -Math.random() * 20 - 10,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 6 + 4,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10
        });
      }
      
      let animationFrameId;
      function update() {
        ctx.clearRect(0, 0, width, height);
        let active = false;
        
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.4;
          p.vx *= 0.98;
          p.rotation += p.rotationSpeed;
          
          if (p.y < height + 20) {
            active = true;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
          }
        });
        
        if (active) {
          animationFrameId = requestAnimationFrame(update);
        } else {
          cancelAnimationFrame(animationFrameId);
          canvas.remove();
        }
      }
      
      update();
    }

    // 雙擊主幹道節點 - 直接變更案件當前階段 (誤觸防呆)
    function changePhaseDirect(caseId, phase) {
      const c = cases.find(item => item.id === caseId);
      if (c) {
        const stageOrder = ['SA', 'OA', 'PC', 'C', 'S'];
        const currentIdx = stageOrder.indexOf(c.currentPhase);
        const newIdx = stageOrder.indexOf(phase);
        
        updateCase(caseId, c => {
          c.currentPhase = phase;
        });
        
        if (newIdx > currentIdx) {
          showToast(`已推移至 [${phase}] 階段！`, 'success');
          triggerConfetti();
        } else {
          showToast(`已變更！案件進度調整至 [${phase}] 階段`, 'success');
        }
        openDrawer(caseId, phase, true);
      }
    }

    // 雙擊「時間已確定」按鈕 - 聯動推移至 OA 階段 (防呆)
    function triggerOAPhaseDirect(caseId) {
      const c = cases.find(item => item.id === caseId);
      if (c) {
        showConfirm({
          icon: '🤝',
          title: '切換至 OA 階段',
          body: '您即將設定 OA 需求面談，是否確認將案件進度推移至需求分析 (OA) 階段？',
          okText: '確認切換',
          okStyle: 'background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.4); color: #34d399;',
          onOk: () => {
            c.currentPhase = 'OA';
            c.oaDetails.meetState = 'confirmed';
            showToast('已雙擊時間已確定！進度已切換至需求分析 (OA)', 'success');
            renderCases();
            openDrawer(caseId, 'SA'); // 保持 SA 抽屜觀察聯動
          }
        });
      }
    }

    // 取得統一的案件基本管理區塊 HTML (左半部)
    function getUnifiedLeftColumnHTML(c, isClientDrawer = false) {
      if (!c.contactMethods) c.contactMethods = [];
      if (!c.contactDetails) c.contactDetails = {};
      
      const contactItems = [
        { key: 'LINE',  label: 'LINE',  placeholder: '輸入 LINE 帳號', inputLabel: '名稱' },
        { key: 'FB',    label: 'FB',    placeholder: '輸入 FB 帳號', inputLabel: '帳號' },
        { key: 'IG',    label: 'IG',    placeholder: '輸入 IG 帳號', inputLabel: '帳號' },
      ];

      const contactHTML = contactItems.map(item => {
        const isChecked = c.contactMethods.includes(item.key);
        const val = c.contactDetails[item.key] || '';
        return `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,${isChecked ? '0.12' : '0.04'}); border-radius: 6px; padding: 4px 6px; display: flex; align-items: center; gap: 8px;">
            <label class="checkbox-tag-label" style="margin: 0; min-width: 44px; text-align: center; font-size: 0.72rem; padding: 2px 4px;">
              <input type="checkbox" value="${item.key}" ${isChecked ? 'checked' : ''} onchange="toggleContactMethod('${c.id}', '${item.key}')" style="display:none;">
              ${item.label}
            </label>
            <div style="flex: 1; display: flex; align-items: center;">
              <input type="text" value="${val}" placeholder="${item.placeholder}" style="flex:1; font-size: 0.78rem; padding: 2px 6px; height: 22px; ${!isChecked ? 'opacity:0.35; pointer-events:none;' : ''}" onchange="updateContactDetail('${c.id}', '${item.key}', this.value)">
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="drawer-left-column">
          
          <div class="form-group">
            <label style="font-size: 0.75rem;">客戶姓名</label>
            <input type="text" id="input-client-name-${c.id}" value="${c.clientName}" onchange="updateCaseField('${c.id}', 'clientName', this.value)" style="height: 26px; font-size: 0.78rem; padding: 4px 6px;">
          </div>

          <div class="form-group">
            <label style="font-size: 0.75rem;">聯絡管道與帳號</label>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${contactHTML}
            </div>
          </div>

          ${isClientDrawer ? `
          <!-- 移到右面版底部，此處保留空白以利視覺延伸 -->
          ` : `
          <div style="margin-top: auto; padding-top: 10px; display: flex; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn" onclick="deleteCase('${c.id}')" style="flex: 1; padding: 4px 6px; font-size: 0.72rem; justify-content: center; height: 26px; color: #ef4444; border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.05);">
              🗑️ 刪除案件
            </button>
          </div>
          `}
        </div>
      `;
    }



    // 渲染「客戶資料維護」抽屜內容
    function renderClientDrawer(c, container) {
      container.innerHTML = `
        <div class="drawer-grid-horizontal">
          ${getUnifiedLeftColumnHTML(c, true)}
          
          <!-- 中面版：案件分類 -->
          <div style="flex: 1.1; display: flex; flex-direction: column; gap: 10px; border-right: 1px solid var(--border-color); padding-right: 20px; min-width: 0; justify-content: center;">
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px; width: 100%;">
              <div>
                <label style="display: block; font-size: 0.75rem; margin-bottom: 4px; color: var(--text-secondary); font-weight: 600;">訪談類型</label>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; width: 100%;">
                  <button type="button" class="btn btn-tab ${(c.visitType === 'issue' || !c.visitType) ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'visitType', 'issue')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">議題訪</button>
                  <button type="button" class="btn btn-tab ${c.visitType === 'life' ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'visitType', 'life')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">生活訪</button>
                  <button type="button" class="btn btn-tab ${c.visitType === 'service' ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'visitType', 'service')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">服務訪</button>
                  <button type="button" class="btn btn-tab ${c.visitType === 'coffee' ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'visitType', 'coffee')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">咖啡訪</button>
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; margin-bottom: 4px; color: var(--text-secondary); font-weight: 600;">險種分類</label>
                <div style="display: flex; gap: 6px; width: 100%;">
                  <button type="button" class="btn btn-tab ${c.type === 'life' ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'type', 'life')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">壽險</button>
                  <button type="button" class="btn btn-tab ${c.type === 'property' ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'type', 'property')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">產險</button>
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; margin-bottom: 4px; color: var(--text-secondary); font-weight: 600;">開拓管道</label>
                <div style="display: flex; gap: 6px; width: 100%;">
                  <button type="button" class="btn btn-tab ${c.caseSource === 'outbound' ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'caseSource', 'outbound')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">開發客</button>
                  <button type="button" class="btn btn-tab ${c.caseSource === 'inbound' ? 'active' : ''}" onclick="updateCaseField('${c.id}', 'caseSource', 'inbound')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">自來客</button>
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; margin-bottom: 4px; color: var(--text-secondary); font-weight: 600;">客戶來源</label>
                <div style="display: flex; gap: 6px; width: 100%;">
                  <button type="button" class="btn btn-tab ${c.source === 'relative' ? 'active' : ''}" onclick="updateClientSource('${c.id}', 'relative')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">緣故</button>
                  <button type="button" class="btn btn-tab ${c.source === 'referral' ? 'active' : ''}" onclick="updateClientSource('${c.id}', 'referral')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">轉介</button>
                  <button type="button" class="btn btn-tab ${c.source === 'cold' ? 'active' : ''}" onclick="updateClientSource('${c.id}', 'cold')" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 4px 6px; min-width: max-content; white-space: nowrap;">陌開</button>
                </div>
              </div>
            </div>
            <div id="referral-field-${c.id}" class="form-group" style="display: ${c.source === 'referral' ? 'flex' : 'none'}; margin-top: 4px;">
              <label style="font-size: 0.75rem;">介紹人姓名</label>
              <input type="text" value="${c.referrerName || ''}" placeholder="是誰介紹來的？" onchange="updateCaseField('${c.id}', 'referrerName', this.value)" style="height: 24px; font-size: 0.78rem; padding: 4px 6px;">
            </div>
          </div>

          <!-- 右面版：備忘備註 -->
          <div style="flex: 1.2; display: flex; flex-direction: column; gap: 10px; min-width: 0; justify-content: space-between;">
            <div class="form-group" style="margin-top: 6px; flex: 1; display: flex; flex-direction: column;">
              <label style="font-size: 0.75rem;">全局備忘備註</label>
              <textarea placeholder="記下此客戶的性格特色、拜訪偏好或家庭狀況..." style="flex: 1; min-height: 100px; font-size: 0.78rem; resize: none; padding: 6px; width: 100%; box-sizing: border-box;" onchange="updateCaseField('${c.id}', 'note', this.value)">${c.note || ''}</textarea>
            </div>
            <div style="margin-top: auto; padding-top: 10px; display: flex; gap: 5px; border-top: 1px solid var(--border-color); width: 100%;">
              <button type="button" class="btn" onclick="deleteCase('${c.id}')" style="flex: 1; padding: 4px 5px; font-size: 0.65rem; justify-content: center; height: 24px; color: #ef4444; border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.05);">🗑️ 刪除</button>
              <button type="button" class="btn" onclick="toggleArchive('${c.id}')" style="flex: 1; padding: 4px 5px; font-size: 0.65rem; justify-content: center; height: 24px;">${c.archived ? '🔓 解除' : '📦 封存'}</button>
              <button type="button" class="btn btn-primary" onclick="closeCaseDrawer('${c.id}')" style="flex: 1; padding: 4px 5px; font-size: 0.65rem; justify-content: center; height: 24px; background:var(--color-c); color:#000; font-weight:700;">✓ 儲存</button>
            </div>
          </div>
        </div>
      `;
    }





    // 封存 / 解除封存
    function toggleArchive(caseId) {
      const c = cases.find(item => item.id === caseId);
      if (!c) return;

      if (!c.archived) {
        // 封存確認
        showConfirm({
          icon: '📦',
          title: '確認封存此案件',
          body: `<b>${c.clientName}</b> 的案件將從主列表中隱藏。<br>所有資料完整保留，可隨時解除封存。`,
          okText: '確定封存',
          okStyle: 'background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); color: #ef4444;',
          onOk: () => {
            updateCase(caseId, item => {
              item.archived = true;
            });
            showToast(`已封存：${c.clientName}`, 'success');
          }
        });
      } else {
        // 解除封存確認
        showConfirm({
          icon: '🔓',
          title: '確認解除封存',
          body: `<b>${c.clientName}</b> 的案件將重新顯示於主列表中。`,
          okText: '確定解除',
          okStyle: 'background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.4); color: #818cf8;',
          onOk: () => {
            updateCase(caseId, item => {
              item.archived = false;
            });
            showToast(`已解除封存：${c.clientName}`, 'success');
          }
        });
      }
    }

    // 更新客戶來源類型
    function updateClientSource(caseId, sourceValue) {
      updateCase(caseId, item => {
        item.source = sourceValue;
        if (sourceValue !== 'referral') item.referrerName = '';
        if (sourceValue !== 'relative') item.relativeTags = [];
      });
      const drawerRow = document.getElementById(`drawer-row-${caseId}`);
      if (drawerRow && drawerRow.style.display === 'block') {
        const activeSection = drawerRow.dataset.activeSection;
        openDrawer(caseId, activeSection, true);
      }
    }




    // 複選聯絡方式
    function toggleContactMethod(caseId, method) {
      updateCase(caseId, item => {
        if (!item.contactMethods) item.contactMethods = [];
        const index = item.contactMethods.indexOf(method);
        if (index > -1) {
          item.contactMethods.splice(index, 1);
        } else {
          item.contactMethods.push(method);
        }
      });
      const drawerContent = document.getElementById(`drawer-content-${caseId}`);
      if (drawerContent) {
        const c = cases.find(item => item.id === caseId);
        renderClientDrawer(c, drawerContent);
      }
    }

    // 儲存各聯絡方式的個別帳號/名稱
    function updateContactDetail(caseId, key, value) {
      updateCase(caseId, item => {
        if (!item.contactDetails) item.contactDetails = {};
        item.contactDetails[key] = value;
      }, true); // 跳過重新渲染以利輸入流暢
    }


    // 渲染「議題起點」抽屜內容
    function renderIssueDrawer(c, container) {
      container.innerHTML = `
        <div class="drawer-grid-horizontal">
          
          <!-- 左面版：基本資訊 -->
          <div class="drawer-left-column" style="gap: 10px; justify-content: center; min-width: 0; border-right: 1px solid var(--border-color); padding-right: 20px;">
            <div class="form-group autocomplete-wrapper" style="margin: 0; width: 100%;">
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">輸入或選擇議題名稱</label>
              <div style="position: relative; display: flex; align-items: center; width: 100%;">
                <input type="text" id="input-issue-name-${c.id}" value="${c.issueName}" 
                       placeholder="請輸入或點選議題名稱..." 
                       oninput="showTopicAutocomplete('${c.id}', this.value)"
                       onfocus="showTopicAutocomplete('${c.id}', this.value)"
                       onchange="updateCaseField('${c.id}', 'issueName', this.value)"
                       style="padding-right: 28px; height: 26px; font-size: 0.78rem; width: 100%;">
                <span class="dropdown-arrow-icon" style="position: absolute; right: 10px; cursor: pointer; pointer-events: none;">▼</span>
              </div>
              <div class="autocomplete-dropdown" id="dropdown-${c.id}"></div>
            </div>
            
            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px; width: 100%; margin-top: 4px;">
              <label style="font-size: 0.75rem; font-weight: 600; color: #b4befe;">議題想法產出日期</label>
              <input type="text" readonly value="${c.issueDate}" placeholder="點擊選擇日期..." onclick="showCustomDatePicker(this, '${c.id}', 'issueDate', 'case')" style="width: 100%; padding: 0 10px; font-size: 0.78rem; height: 26px; line-height: 26px; cursor: pointer; background: #11111b; color: #fff; border: 1px solid #45475a; border-radius: 6px; text-align: center; outline: none; transition: var(--transition-smooth); box-sizing: border-box;">
            </div>
          </div>
          
          <!-- 右面版：發想備忘與確認按鈕 -->
          <div style="flex: 1.2; display: flex; flex-direction: column; gap: 10px; min-width: 0;">
            <div class="form-group" style="margin: 0; display: flex; flex-direction: column; gap: 4px; width: 100%; flex: 1;">
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">議題發想備忘</label>
              <textarea style="flex: 1; min-height: 54px; resize: none; font-size: 0.78rem; padding: 6px; box-sizing: border-box; width: 100%;" placeholder="簡單記下為什麼會有這個想法..." onchange="updateCaseField('${c.id}', 'issueNote', this.value)">${c.issueNote || ''}</textarea>
            </div>
            
            <div style="margin-top: auto; padding-top: 10px; display: flex; gap: 6px; border-top: 1px solid var(--border-color); width: 100%;">
              <button onclick="closeCaseDrawer('${c.id}')" class="btn btn-primary" style="flex: 1; justify-content: center; height: 24px; font-size: 0.68rem; font-weight: 700;">✓ 完成</button>
            </div>
          </div>
        </div>
      `;
    }    function renderSADrawer(c, container) {
      const sa = c.saDetails;
      container.innerHTML = `
        <div class="drawer-grid-horizontal">
          <div class="drawer-left-column" style="gap: 10px; justify-content: center; min-width: 0; border-right: 1px solid var(--border-color); padding-right: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; height: 32px; flex-shrink: 0; width: 100%;">
              <span style="font-size: 0.8rem; font-weight: 600; color: #b4befe; width: 72px; white-space: nowrap;">發出日期</span>
              <input type="text" readonly value="${sa.sendDate}" onclick="showCustomDatePicker(this, '${c.id}', 'sendDate', 'sa')" style="flex: 1; min-width: 0; padding: 0 10px; font-size: 0.8rem; height: 30px; line-height: 30px; cursor: pointer; background: #11111b; color: #fff; border: 1px solid #45475a; border-radius: 6px; text-align: center; transition: var(--transition-smooth); outline: none; box-sizing: border-box;">
            </div>
            <div style="display: flex; align-items: center; gap: 8px; height: 32px; flex-shrink: 0; width: 100%;">
              <span style="font-size: 0.8rem; font-weight: 600; color: #b4befe; width: 72px; white-space: nowrap;">回覆日期</span>
              <input type="text" readonly value="${sa.replyDate}" onclick="showCustomDatePicker(this, '${c.id}', 'replyDate', 'sa')" style="flex: 1; min-width: 0; padding: 0 10px; font-size: 0.8rem; height: 30px; line-height: 30px; cursor: pointer; background: #11111b; color: #fff; border: 1px solid #45475a; border-radius: 6px; text-align: center; transition: var(--transition-smooth); outline: none; box-sizing: border-box;">
            </div>
            <div style="display: flex; align-items: center; gap: 8px; height: 32px; flex-shrink: 0; width: 100%;">
              <span style="font-size: 0.8rem; font-weight: 600; color: #b4befe; width: 72px; white-space: nowrap;">約定日期</span>
              <input type="text" readonly value="${sa.agreeDate}" onclick="showCustomDatePicker(this, '${c.id}', 'agreeDate', 'sa')" style="flex: 1; min-width: 0; padding: 0 10px; font-size: 0.8rem; height: 30px; line-height: 30px; cursor: pointer; background: #11111b; color: #fff; border: 1px solid #45475a; border-radius: 6px; text-align: center; transition: var(--transition-smooth); outline: none; box-sizing: border-box;">
            </div>
          </div>
          <div style="flex: 1.1; display: flex; flex-direction: column; gap: 10px; border-right: 1px solid var(--border-color); padding-right: 20px; min-width: 0; justify-content: center;">
            <button class="status-badge-btn" onclick="updateOAField('${c.id}', 'meetState', 'pending')" style="width: 100%; height: 30px; justify-content: center; font-size: 0.75rem; font-weight: 700; border-radius: 6px; cursor: pointer; transition: all 0.2s; border: 1px solid ${c.oaDetails.meetState === 'pending' ? '#f38ba8' : '#313244'}; background: ${c.oaDetails.meetState === 'pending' ? 'rgba(243, 139, 168, 0.15)' : '#313244'}; color: ${c.oaDetails.meetState === 'pending' ? '#f38ba8' : '#a6adc8'};">喬時間中</button>
            <button class="status-badge-btn" onclick="updateOAField('${c.id}', 'meetState', 'confirmed')" ondblclick="triggerOAPhaseDirect('${c.id}')" style="width: 100%; height: 30px; justify-content: center; font-size: 0.75rem; font-weight: 700; border-radius: 6px; cursor: pointer; transition: all 0.2s; border: 1px solid ${c.oaDetails.meetState === 'confirmed' ? '#a6e3a1' : '#313244'}; background: ${c.oaDetails.meetState === 'confirmed' ? 'rgba(166, 227, 161, 0.15)' : '#313244'}; color: ${c.oaDetails.meetState === 'confirmed' ? '#a6e3a1' : '#a6adc8'};" title="雙擊此按鈕以直接切換進度至 OA 階段">時間已確定 🚀</button>
            <div class="form-group" style="margin-top: 4px; display: flex; flex-direction: column; gap: 4px; width: 100%;">
              <label style="font-size: 0.75rem; color: #a6adc8; width: 100%;">預計會面日期</label>
              <input type="text" readonly value="${c.oaDetails.meetDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'meetDate', 'oa')" style="width: 100%; padding: 0 10px; font-size: 0.8rem; height: 30px; line-height: 30px; cursor: pointer; background: #11111b; color: #fff; border: 1px solid #45475a; border-radius: 6px; text-align: center; transition: var(--transition-smooth); outline: none; box-sizing: border-box;">
            </div>
          </div>
          <div style="flex: 1.2; display: flex; flex-direction: column; gap: 10px; min-width: 0;">
            <div class="form-group" style="margin-top: 6px; flex: 1; display: flex; flex-direction: column;">
              <label style="font-size: 0.75rem;">約定階段備忘</label>
              <textarea placeholder="" style="flex: 1; min-height: 70px; font-size: 0.78rem; resize: none; padding: 6px; width: 100%; box-sizing: border-box;" onchange="updateSADate('${c.id}', 'notes', this.value)">${sa.notes || ''}</textarea>
            </div>
            <div style="margin-top: auto; padding-top: 10px; display: flex; gap: 6px; border-top: 1px solid var(--border-color); width: 100%;">
              <button onclick="closeCaseDrawer('${c.id}')" class="btn btn-primary" style="flex: 1; justify-content: center; height: 24px; font-size: 0.68rem; font-weight: 700;">✓ 完成</button>
            </div>
          </div>
        </div>
      `;
    }



    function renderModalTopicList() {
      const list = document.getElementById('modal-topic-list');
      list.innerHTML = '';
      globalTopics.forEach((t, index) => {
        const item = document.createElement('div');
        item.className = 'topic-list-item';
        item.innerHTML = `
          <span>${t}</span>
          <button class="btn-delete-topic" onclick="deleteGlobalTopic(${index})">刪除</button>
        `;
        list.appendChild(item);
      });
    }

    // 新增常規議題
    function addGlobalTopic() {
      const input = document.getElementById('new-topic-input');
      const val = input.value.trim();
      if (val) {
        globalTopics.push(val);
        localStorage.setItem('global_topics', JSON.stringify(globalTopics));
        input.value = '';
        renderModalTopicList();
      }
    }

    // 刪除常規議題
    function deleteGlobalTopic(index) {
      globalTopics.splice(index, 1);
      localStorage.setItem('global_topics', JSON.stringify(globalTopics));
      renderModalTopicList();
    }

    let subTagClickTimeout = null;

    // === 子流程按燈與抽屜引導連動邏輯 ===
    function handleSubTagToggle(caseId, phase, stateKey, dateKey, dateFieldForSelector, event, forcePhase = null) {
      if (event) event.stopPropagation();
      const c = cases.find(item => item.id === caseId);
      if (!c) return;
      
      const details = phase === 'oa' ? c.oaDetails :
                      phase === 'pc' ? c.pcDetails :
                      phase === 'c' ? c.cDetails : c.sDetails;
                      
      // 照會後重新送件機制：點擊或重設送件按鈕時，自動清除 processed 鎖定
      if (phase === 'c' && stateKey === 'submitState') {
        details.submitProcessed = '';
      }
      
      const curState = details[stateKey] || 'dim';

      if (curState === 'dim') {
        // 未亮燈點擊：永久標記為 ongoing (進行中) 呼吸，並儲存，然後打開抽屜彈出日曆
        updateCase(caseId, item => {
          const itemDetails = phase === 'oa' ? item.oaDetails :
                              phase === 'pc' ? item.pcDetails :
                              phase === 'c' ? item.cDetails : item.sDetails;
          itemDetails[stateKey] = 'ongoing';
        });
        
        openDrawer(caseId, phase.toUpperCase());
        setTimeout(() => {
          const drawerContent = document.getElementById(`drawer-content-${caseId}`);
          if (drawerContent) {
            if (phase === 'oa') renderOADrawer(c, drawerContent);
            else if (phase === 'pc') renderPCDrawer(c, drawerContent);
            else if (phase === 'c') renderCDrawer(c, drawerContent);
            else if (phase === 's') renderSDrawer(c, drawerContent);
          }
          
          setTimeout(() => {
            const dateInput = document.getElementById(`date-input-${caseId}-${stateKey}`);
            if (dateInput) {
              dateInput.click();
            }
          }, 100);
        }, 100);
      } else {
        // 已經是進行中 (ongoing) 或已完成 (active)，單擊直接開啟抽屜並彈出日曆
        openDrawer(caseId, phase.toUpperCase());
        setTimeout(() => {
          const dateInput = document.getElementById(`date-input-${caseId}-${stateKey}`);
          if (dateInput) dateInput.click();
        }, 150);
      }
    }

    function toggleOAPlanDirect(caseId, event) {
      handleSubTagToggle(caseId, 'oa', 'planState', 'planDate', 'planDate', event);
    }
    function toggleOAPracticeDirect(caseId, event) {
      handleSubTagToggle(caseId, 'oa', 'practiceState', 'practiceDate', 'practiceDate', event);
    }
    function toggleOADiscussDirect(caseId, event) {
      handleSubTagToggle(caseId, 'oa', 'discussState', 'discussDate', 'discussDate', event, 'OA');
    }

    function togglePCPlanDirect(caseId, event) {
      handleSubTagToggle(caseId, 'pc', 'planState', 'planDate', 'planDate', event);
    }
    function togglePCPracticeDirect(caseId, event) {
      handleSubTagToggle(caseId, 'pc', 'practiceState', 'practiceDate', 'practiceDate', event);
    }
    function togglePCDiscussDirect(caseId, event) {
      handleSubTagToggle(caseId, 'pc', 'discussState', 'discussDate', 'discussDate', event, 'PC');
    }

    function toggleCPlanDirect(caseId, event) {
      handleSubTagToggle(caseId, 'c', 'planState', 'planDate', 'planDate', event);
    }
    function toggleCSignDirect(caseId, event) {
      handleSubTagToggle(caseId, 'c', 'signState', 'signDate', 'signDate', event);
    }
    function toggleCRemedyDirect(caseId, event) {
      handleSubTagToggle(caseId, 'c', 'remedyState', 'remedyDate', 'remedyDate', event);
    }
    function toggleCSubmitDirect(caseId, event) {
      handleSubTagToggle(caseId, 'c', 'submitState', 'submitDate', 'submitDate', event);
    }
    function toggleCPracticeDirect(caseId, event) {
      handleSubTagToggle(caseId, 'c', 'practiceState', 'practiceDate', 'practiceDate', event);
    }
    function toggleCDiscussDirect(caseId, event) {
      handleSubTagToggle(caseId, 'c', 'discussState', 'discussDate', 'discussDate', event, 'C');
    }

    function toggleSPlanDirect(caseId, event) {
      handleSubTagToggle(caseId, 's', 'planState', 'planDate', 'planDate', event);
    }
    function toggleSPracticeDirect(caseId, event) {
      handleSubTagToggle(caseId, 's', 'practiceState', 'practiceDate', 'practiceDate', event);
    }
    function toggleSDiscussDirect(caseId, event) {
      handleSubTagToggle(caseId, 's', 'discussState', 'discussDate', 'discussDate', event, 'S');
    }

    function updateCField(caseId, field, value) {
      const isNote = field.endsWith('Notes') || field.endsWith('Note');
      const isStateOrSlot = field === 'meetState' || field === 'meetTimeSlot';
      updateCase(caseId, c => {
        if (!c.cDetails) c.cDetails = {};
        if (field === 'meetState') {
          const targetValue = (c.cDetails.meetState === value) ? '' : value;
          c.cDetails.meetState = targetValue;
          if (targetValue === '') {
            c.cDetails.meetDate = '';
          }
        } else {
          c.cDetails[field] = value;
          
          const subTagFields = ['planDate', 'signDate', 'remedyDate', 'submitDate', 'practiceDate', 'discussDate'];
          if (subTagFields.includes(field)) {
            const stateKey = field.replace('Date', 'State');
            if (value === '') {
              // 防呆：如果清除次標籤的日期，自動將其狀態還原為 'dim'
              c.cDetails[stateKey] = 'dim';
            } else {
              // 防呆：如果填入日期且原本非 'active'，自動強制為 'ongoing' 進行中
              if (c.cDetails[stateKey] !== 'active') {
                c.cDetails[stateKey] = 'ongoing';
              }
            }
          }
        }
        if (field === 'meetDate') {
          c.cDetails.meetState = value ? 'confirmed' : '';
        }
        // 照會後重新送件機制：修改送件日期後，自動重設 processed 為未處理
        if (field === 'submitDate') {
          c.cDetails.submitProcessed = '';
        }
      }, isNote);
      
      // 動態同步：重設日期後，後台立即重新計算提醒狀態並更新右上角 ⚠️ 按鈕計數！
      if (field === 'submitDate') {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        
        const limitDays = crmSettings.reminderDaysLimit || 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;

        const expired = [];
        const today = [];
        const future = [];

        cases.forEach(item => {
          if (item.cDetails && item.cDetails.submitDate && item.cDetails.submitProcessed !== 'processed') {
            const sDate = item.cDetails.submitDate.replace(/\//g, '-');
            if (sDate < todayStr) {
              expired.push(item);
            } else if (sDate === todayStr) {
              today.push(item);
            } else if (sDate > todayStr && sDate <= limitDateStr) {
              future.push(item);
            }
          }
        });
        updateGlobalReminderIcon(expired.length, today.length, future.length, expired, today, future);
      }
      if (!isNote && !isStateOrSlot) {
        openDrawer(caseId, 'C', true);
      } else if (isStateOrSlot) {
        saveCasesToStorage();
        const drawerRow = document.getElementById(`drawer-row-${caseId}`);
        if (drawerRow && drawerRow.style.display === 'block') {
          const activeSection = drawerRow.dataset.activeSection || 'C';
          const c = cases.find(item => item.id === caseId);
          refreshDrawerContent(caseId, activeSection, c);
        }
      }
    }

    function updateSField(caseId, field, value) {
      const isNote = field.endsWith('Notes') || field.endsWith('Note');
      const isStateOrSlot = field === 'meetState' || field === 'meetTimeSlot';
      updateCase(caseId, c => {
        if (!c.sDetails) c.sDetails = {};
        if (field === 'meetState') {
          const targetValue = (c.sDetails.meetState === value) ? '' : value;
          c.sDetails.meetState = targetValue;
          if (targetValue === '') {
            c.sDetails.meetDate = '';
          }
        } else {
          c.sDetails[field] = value;
          
          const subTagFields = ['planDate', 'practiceDate', 'discussDate'];
          if (subTagFields.includes(field)) {
            const stateKey = field.replace('Date', 'State');
            if (value === '') {
              c.sDetails[stateKey] = 'dim';
            } else {
              if (c.sDetails[stateKey] !== 'active') {
                c.sDetails[stateKey] = 'ongoing';
              }
            }
          }
        }
        if (field === 'meetDate') {
          c.sDetails.meetState = value ? 'confirmed' : '';
        }
      }, isNote);
      if (!isNote && !isStateOrSlot) {
        openDrawer(caseId, 'S', true);
      } else if (isStateOrSlot) {
        saveCasesToStorage();
        const drawerRow = document.getElementById(`drawer-row-${caseId}`);
        if (drawerRow && drawerRow.style.display === 'block') {
          const activeSection = drawerRow.dataset.activeSection || 'S';
          const c = cases.find(item => item.id === caseId);
          refreshDrawerContent(caseId, activeSection, c);
        }
      }
    }

    function updatePCField(caseId, field, value) {
      const isNote = field.endsWith('Notes') || field.endsWith('Note');
      const isStateOrSlot = field === 'meetState' || field === 'meetTimeSlot';
      updateCase(caseId, c => {
        if (!c.pcDetails) c.pcDetails = {};
        if (field === 'meetState') {
          const targetValue = (c.pcDetails.meetState === value) ? '' : value;
          c.pcDetails.meetState = targetValue;
          if (targetValue === '') {
            c.pcDetails.meetDate = '';
          }
        } else {
          c.pcDetails[field] = value;
          
          const subTagFields = ['planDate', 'practiceDate', 'discussDate'];
          if (subTagFields.includes(field)) {
            const stateKey = field.replace('Date', 'State');
            if (value === '') {
              c.pcDetails[stateKey] = 'dim';
            } else {
              if (c.pcDetails[stateKey] !== 'active') {
                c.pcDetails[stateKey] = 'ongoing';
              }
            }
          }
        }
        if (field === 'meetDate') {
          c.pcDetails.meetState = value ? 'confirmed' : '';
        }
      }, isNote);
      if (!isNote && !isStateOrSlot) {
        openDrawer(caseId, 'PC', true);
      } else if (isStateOrSlot) {
        saveCasesToStorage();
        const drawerRow = document.getElementById(`drawer-row-${caseId}`);
        if (drawerRow && drawerRow.style.display === 'block') {
          const activeSection = drawerRow.dataset.activeSection || 'PC';
          const c = cases.find(item => item.id === caseId);
          refreshDrawerContent(caseId, activeSection, c);
        }
      }
    }

    // 渲染「OA 需求分析」抽屜內容
    function renderOADrawer(c, container) {
      const oa = c.oaDetails;
      if (!oa.rescheduleHistory) oa.rescheduleHistory = [];

      let historyListHtml = '';
      if (oa.rescheduleHistory.length === 0) {
        historyListHtml = `<div style="color:var(--text-secondary); font-size:0.72rem; text-align:center; padding:15px 0;">無改期歷史紀錄</div>`;
      } else {
        historyListHtml = oa.rescheduleHistory.map((item, idx) => {
          return `
            <div onclick="showRescheduleDetail('${c.id}', 'oa', ${idx})" style="cursor:pointer; padding:4px 6px; border-radius:4px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); margin-bottom:4px; transition:var(--transition-smooth); display:flex; justify-content:space-between; align-items:center; font-size:0.68rem;">
              <span style="font-weight:600; color:rgba(255,255,255,0.8);">第 ${idx + 1} 次</span>
              <span style="color:#fb923c; font-weight:700;">${item.newDate}</span>
            </div>
          `;
        }).join('');
      }

      const isPlanDone = oa.planState === 'active';
      const isPlanOngoing = oa.planState === 'ongoing';
      const isPracticeDone = oa.practiceState === 'active';
      const isPracticeOngoing = oa.practiceState === 'ongoing';
      const isDiscussDone = oa.discussState === 'active';
      const isDiscussOngoing = oa.discussState === 'ongoing';

      container.innerHTML = `
        <div class="drawer-grid-horizontal">
          <div style="flex: 1.2; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; justify-content:space-between; min-width: 0;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:6px; white-space:nowrap;">改期歷史 (${oa.rescheduleHistory.length})</div>
              <div style="max-height: 140px; overflow-y: auto; padding-right: 2px;">
                ${historyListHtml}
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px; width:100%;">
              <button class="status-badge-btn" onclick="showRescheduleRegisterForm('${c.id}', 'oa')" style="width:100%; justify-content:center; padding:4px 0; border-radius:4px; font-weight:700; border:1px dashed var(--color-oa); color:var(--color-oa); font-size:0.7rem;">登記新改期</button>
              <button onclick="closeCaseDrawer('${c.id}')" class="btn btn-primary" style="width:100%; justify-content:center; height:24px; font-size:0.68rem; font-weight:700; background:var(--color-c); color:#000;">✓ 完成</button>
            </div>
          </div>

          <div style="flex: 1.4; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; gap:6px; min-width: 0;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:2px;">📅 會面時間與時段</div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.04);">
              <input type="text" readonly value="${oa.meetDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'meetDate', 'oa')" placeholder="選擇會面日期" style="width:100%; text-align:center; padding:2px 4px; font-size:0.75rem; height:22px; cursor:pointer; background:transparent; border:none; color:#fff;">
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:0.7rem; color:var(--text-secondary);">會面時間狀態</span>
              <div style="display:flex; gap:4px;">
                <button class="status-badge-btn ${oa.meetState === 'pending' ? 'active' : ''}" data-type="intent-pending" onclick="updateOAField('${c.id}', 'meetState', 'pending')" style="flex:1; justify-content:center; padding: 3px 0; font-size:0.68rem; border-radius:4px;">喬時間中</button>
                <button class="status-badge-btn ${oa.meetState === 'confirmed' ? 'active' : ''}" data-type="agree" onclick="updateOAField('${c.id}', 'meetState', 'confirmed')" style="flex:1; justify-content:center; padding: 3px 0; font-size:0.68rem; border-radius:4px;">時間已確定</button>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:0.7rem; color:var(--text-secondary);">約定時間時段</span>
              <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:3px;">
                <button type="button" class="status-badge-btn ${oa.meetTimeSlot === 'before_lunch' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'oa', 'before_lunch')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">午餐前</button>
                <button type="button" class="status-badge-btn ${oa.meetTimeSlot === 'lunch' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'oa', 'lunch')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">午餐</button>
                <button type="button" class="status-badge-btn ${oa.meetTimeSlot === 'afternoon_1' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'oa', 'afternoon_1')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">下午一</button>
                <button type="button" class="status-badge-btn ${oa.meetTimeSlot === 'afternoon_2' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'oa', 'afternoon_2')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">下午二</button>
                <button type="button" class="status-badge-btn ${oa.meetTimeSlot === 'dinner' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'oa', 'dinner')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">晚餐</button>
                <button type="button" class="status-badge-btn ${oa.meetTimeSlot === 'after_dinner' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'oa', 'after_dinner')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">晚餐後</button>
              </div>
            </div>
          </div>

          ${renderVisitTasksSection(c, 'OA')}

          <div style="flex: 4.2; min-width: 0; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
            <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">🛠️ 訪前訪後準備工作</div>
              <div style="flex:1; padding-right: 2px; display:flex; flex-direction:column; justify-content:stretch;">
                <div class="drawer-right-split-3" style="height:100%;">
                  <div>
                    <div style="height:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPlanDone ? '0.18' : (isPlanOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; justify-content:space-between;">
                      <div style="display:flex; flex-direction:column; gap:4px; flex:1; justify-content:space-between;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                          <span style="font-size:0.72rem; color:#c084fc; font-weight:700;">訪前規劃</span>
                          <button class="status-badge-btn ${isPlanDone ? 'active agree' : (isPlanOngoing ? 'ongoing-oa' : '')}" 
                                  onclick="handleCBtnClick('${c.id}', 'planState', 'oa')" 
                                  ondblclick="handleCBtnDblClick('${c.id}', 'planState', 'oa')"
                                  style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                            ${isPlanDone ? `✓ (${formatShortDate(oa.planDate)})` : (isPlanOngoing ? `進行中` : '標記進行中')}
                          </button>
                        </div>
                        <input type="text" readonly id="date-input-${c.id}-planState" value="${oa.planDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'planDate', 'oa')" placeholder="規劃日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                        <textarea style="height:150px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px; width:100%; box-sizing:border-box;" placeholder="備忘或討論要點..." onchange="updateOAField('${c.id}', 'planNotes', this.value)">${oa.planNotes || ''}</textarea>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style="height:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPracticeDone ? '0.18' : (isPracticeOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; justify-content:space-between;">
                      <div style="display:flex; flex-direction:column; gap:4px; flex:1; justify-content:space-between;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                          <span style="font-size:0.72rem; color:#60a5fa; font-weight:700;">訪前演練</span>
                          <button class="status-badge-btn ${isPracticeDone ? 'active agree' : (isPracticeOngoing ? 'ongoing-oa' : '')}" 
                                  onclick="handleCBtnClick('${c.id}', 'practiceState', 'oa')" 
                                  ondblclick="handleCBtnDblClick('${c.id}', 'practiceState', 'oa')"
                                  style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                            ${isPracticeDone ? `✓ (${formatShortDate(oa.practiceDate)})` : (isPracticeOngoing ? `進行中` : '標記進行中')}
                          </button>
                        </div>
                        <input type="text" readonly id="date-input-${c.id}-practiceState" value="${oa.practiceDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'practiceDate', 'oa')" placeholder="演練日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                        <textarea style="height:150px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px; width:100%; box-sizing:border-box;" placeholder="演練備忘與討論要點..." onchange="updateOAField('${c.id}', 'practiceNotes', this.value)">${oa.practiceNotes || ''}</textarea>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style="height:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isDiscussDone ? '0.18' : (isDiscussOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; justify-content:space-between;">
                      <div style="display:flex; flex-direction:column; gap:4px; flex:1; justify-content:space-between;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                          <span style="font-size:0.72rem; color:#34d399; font-weight:700;">訪後討論</span>
                          <button class="status-badge-btn ${isDiscussDone ? 'active agree' : (isDiscussOngoing ? 'ongoing-oa' : '')}" 
                                  onclick="handleCBtnClick('${c.id}', 'discussState', 'oa')" 
                                  ondblclick="handleCBtnDblClick('${c.id}', 'discussState', 'oa')"
                                  style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                            ${isDiscussDone ? `✓ (${formatShortDate(oa.discussDate)})` : (isDiscussOngoing ? `進行中` : '標記進行中')}
                          </button>
                        </div>
                        <input type="text" readonly id="date-input-${c.id}-discussState" value="${oa.discussDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'discussDate', 'oa')" placeholder="討論日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                        <textarea style="height:150px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px; width:100%; box-sizing:border-box;" placeholder="心得或邀約方向..." onchange="updateOAField('${c.id}', 'discussNotes', this.value)">${oa.discussNotes || ''}</textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }    function renderPCDrawer(c, container) {
      const pc = c.pcDetails;
      if (!pc.rescheduleHistory) pc.rescheduleHistory = [];
      
      let historyListHtml = '';
      if (pc.rescheduleHistory.length === 0) {
        historyListHtml = `<div style="color:var(--text-secondary); font-size:0.72rem; text-align:center; padding:15px 0;">無改期歷史紀錄</div>`;
      } else {
        historyListHtml = pc.rescheduleHistory.map((item, idx) => {
          return `
            <div onclick="showRescheduleDetail('${c.id}', 'pc', ${idx})" style="cursor:pointer; padding:4px 6px; border-radius:4px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); margin-bottom:4px; transition:var(--transition-smooth); display:flex; justify-content:space-between; align-items:center; font-size:0.68rem;">
              <span style="font-weight:600; color:rgba(255,255,255,0.8);">第 ${idx + 1} 次</span>
              <span style="color:#fb923c; font-weight:700;">${item.newDate}</span>
            </div>
          `;
        }).join('');
      }

      const isPlanDone = pc.planState === 'active';
      const isPlanOngoing = pc.planState === 'ongoing';
      const isDiscussDone = pc.discussState === 'active';
      const isDiscussOngoing = pc.discussState === 'ongoing';
      const isPracticeDone = pc.practiceState === 'active';
      const isPracticeOngoing = pc.practiceState === 'ongoing';

      container.innerHTML = `
        <div class="drawer-grid-horizontal">
          <div style="flex: 1.2; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; justify-content:space-between; min-width: 0;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:6px; white-space:nowrap;">改期歷史 (${pc.rescheduleHistory.length})</div>
              <div style="max-height: 140px; overflow-y: auto; padding-right: 2px;">
                ${historyListHtml}
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px; width:100%;">
              <button class="status-badge-btn" onclick="showRescheduleRegisterForm('${c.id}', 'pc')" style="width:100%; justify-content:center; padding:4px 0; border-radius:4px; font-weight:700; border:1px dashed var(--color-pc); color:var(--color-pc); font-size:0.7rem;">登記新改期</button>
              <button onclick="closeCaseDrawer('${c.id}')" class="btn btn-primary" style="width:100%; justify-content:center; height:24px; font-size:0.68rem; font-weight:700; background:var(--color-c); color:#000;">✓ 完成</button>
            </div>
          </div>

          <div style="flex: 1.4; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; gap:6px; min-width: 0;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:2px;">📅 講解時間與時段</div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.04);">
              <input type="text" readonly value="${pc.meetDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'meetDate', 'pc')" placeholder="選擇講解日期" style="width:100%; text-align:center; padding:2px 4px; font-size:0.75rem; height:22px; cursor:pointer; background:transparent; border:none; color:#fff;">
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:0.7rem; color:var(--text-secondary);">講解時間狀態</span>
              <div style="display:flex; gap:4px;">
                <button class="status-badge-btn ${pc.meetState === 'pending' ? 'active' : ''}" data-type="intent-pending" onclick="updatePCField('${c.id}', 'meetState', 'pending')" style="flex:1; justify-content:center; padding: 3px 0; font-size:0.68rem; border-radius:4px;">喬時間中</button>
                <button class="status-badge-btn ${pc.meetState === 'confirmed' ? 'active' : ''}" data-type="agree" onclick="updatePCField('${c.id}', 'meetState', 'confirmed')" style="flex:1; justify-content:center; padding: 3px 0; font-size:0.68rem; border-radius:4px;">時間已確定</button>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:0.7rem; color:var(--text-secondary);">約定時間時段</span>
              <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:3px;">
                <button type="button" class="status-badge-btn ${pc.meetTimeSlot === 'before_lunch' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'pc', 'before_lunch')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">午餐前</button>
                <button type="button" class="status-badge-btn ${pc.meetTimeSlot === 'lunch' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'pc', 'lunch')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">午餐</button>
                <button type="button" class="status-badge-btn ${pc.meetTimeSlot === 'afternoon_1' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'pc', 'afternoon_1')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">下午一</button>
                <button type="button" class="status-badge-btn ${pc.meetTimeSlot === 'afternoon_2' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'pc', 'afternoon_2')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">下午二</button>
                <button type="button" class="status-badge-btn ${pc.meetTimeSlot === 'dinner' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'pc', 'dinner')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">晚餐</button>
                <button type="button" class="status-badge-btn ${pc.meetTimeSlot === 'after_dinner' ? 'active' : ''}" onclick="updateTimeSlot('${c.id}', 'pc', 'after_dinner')" style="justify-content:center; padding: 2px 0; font-size:0.66rem; border-radius:4px;">晚餐後</button>
              </div>
            </div>
          </div>

          ${renderVisitTasksSection(c, 'PC')}

          <div style="flex: 4.2; min-width: 0; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
            <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">🛠️ 建議草案規劃與演練</div>
              <div style="flex:1; padding-right: 2px; display:flex; flex-direction:column; justify-content:stretch;">
                <div class="drawer-right-split-3" style="height:100%;">
                  <div>
                    <div style="height:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPlanDone ? '0.18' : (isPlanOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; justify-content:space-between;">
                      <div style="display:flex; flex-direction:column; gap:4px; flex:1; justify-content:space-between;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                          <span style="font-size:0.72rem; color:#c084fc; font-weight:700;">規劃建議</span>
                          <button class="status-badge-btn ${isPlanDone ? 'active agree' : (isPlanOngoing ? 'ongoing-pc' : '')}" 
                                  onclick="handleCBtnClick('${c.id}', 'planState', 'pc')" 
                                  ondblclick="handleCBtnDblClick('${c.id}', 'planState', 'pc')"
                                  style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                            ${isPlanDone ? `✓ (${formatShortDate(pc.planDate)})` : (isPlanOngoing ? `進行中` : '標記進行中')}
                          </button>
                        </div>
                        <input type="text" readonly id="date-input-${c.id}-planState" value="${pc.planDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'planDate', 'pc')" placeholder="製作日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                        <textarea style="height:150px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px; width:100%; box-sizing:border-box;" placeholder="要點與搭配險種..." onchange="updatePCField('${c.id}', 'planNotes', this.value)">${pc.planNotes || ''}</textarea>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style="height:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isDiscussDone ? '0.18' : (isDiscussOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; justify-content:space-between;">
                      <div style="display:flex; flex-direction:column; gap:4px; flex:1; justify-content:space-between;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                          <span style="font-size:0.72rem; color:#60a5fa; font-weight:700;">已傳建議</span>
                          <button class="status-badge-btn ${isDiscussDone ? 'active agree' : (isDiscussOngoing ? 'ongoing-pc' : '')}" 
                                  onclick="handleCBtnClick('${c.id}', 'discussState', 'pc')" 
                                  ondblclick="handleCBtnDblClick('${c.id}', 'discussState', 'pc')"
                                  style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                            ${isDiscussDone ? `✓ (${formatShortDate(pc.discussDate)})` : (isDiscussOngoing ? `進行中` : '標記進行中')}
                          </button>
                        </div>
                        <input type="text" readonly id="date-input-${c.id}-discussState" value="${pc.discussDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'discussDate', 'pc')" placeholder="遞交日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                        <textarea style="height:150px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px; width:100%; box-sizing:border-box;" placeholder="回饋與備忘..." onchange="updatePCField('${c.id}', 'discussNotes', this.value)">${pc.discussNotes || ''}</textarea>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style="height:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPracticeDone ? '0.18' : (isPracticeOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; justify-content:space-between;">
                      <div style="display:flex; flex-direction:column; gap:4px; flex:1; justify-content:space-between;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                          <span style="font-size:0.72rem; color:#f59e0b; font-weight:700;">說明演練</span>
                          <button class="status-badge-btn ${isPracticeDone ? 'active agree' : (isPracticeOngoing ? 'ongoing-pc' : '')}" 
                                  onclick="handleCBtnClick('${c.id}', 'practiceState', 'pc')" 
                                  ondblclick="handleCBtnDblClick('${c.id}', 'practiceState', 'pc')"
                                  style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                            ${isPracticeDone ? `✓ (${formatShortDate(pc.practiceDate)})` : (isPracticeOngoing ? `進行中` : '標記進行中')}
                          </button>
                        </div>
                        <input type="text" readonly id="date-input-${c.id}-practiceState" value="${pc.practiceDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'practiceDate', 'pc')" placeholder="演練日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                        <textarea style="height:150px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px; width:100%; box-sizing:border-box;" placeholder="演練備忘與討論要點..." onchange="updatePCField('${c.id}', 'practiceNotes', this.value)">${pc.practiceNotes || ''}</textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderCDrawer(c, container) {
      const cc = c.cDetails;
      if (!cc.rescheduleHistory) cc.rescheduleHistory = [];

      let historyListHtml = '';
      if (cc.rescheduleHistory.length === 0) {
        historyListHtml = `<div style="color:var(--text-secondary); font-size:0.72rem; text-align:center; padding:15px 0;">無改期歷史紀錄</div>`;
      } else {
        historyListHtml = cc.rescheduleHistory.map((item, idx) => {
          return `
            <div onclick="showRescheduleDetail('${c.id}', 'c', ${idx})" style="cursor:pointer; padding:4px 6px; border-radius:4px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); margin-bottom:4px; transition:var(--transition-smooth); display:flex; justify-content:space-between; align-items:center; font-size:0.68rem;">
              <span style="font-weight:600; color:rgba(255,255,255,0.8);">第 ${idx + 1} 次</span>
              <span style="color:#fb923c; font-weight:700;">${item.newDate}</span>
            </div>
          `;
        }).join('');
      }

      const isPlanDone = cc.planState === 'active';
      const isSignDone = cc.signState === 'active';
      const isRemedyDone = cc.remedyState === 'active';
      const isSubmitDone = cc.submitState === 'active';
      const isPracticeDone = cc.practiceState === 'active';
      const isDiscussDone = cc.discussState === 'active';

      const isPlanOngoing = cc.planState === 'ongoing';
      const isSignOngoing = cc.signState === 'ongoing';
      const isRemedyOngoing = cc.remedyState === 'ongoing';
      const isSubmitOngoing = cc.submitState === 'ongoing';
      const isPracticeOngoing = cc.practiceState === 'ongoing';
      const isDiscussOngoing = cc.discussState === 'ongoing';

      container.innerHTML = `
        <div class="drawer-grid-horizontal">
          <div style="flex: 1.2; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; justify-content:space-between; min-width: 0;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:6px; white-space:nowrap;">改期歷史 (${cc.rescheduleHistory.length})</div>
              <div style="max-height: 140px; overflow-y: auto; padding-right: 2px;">
                ${historyListHtml}
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px; width:100%;">
              <button class="status-badge-btn" onclick="showRescheduleRegisterForm('${c.id}', 'c')" style="width:100%; justify-content:center; padding:4px 0; border-radius:4px; font-weight:700; border:1px dashed var(--color-c); color:var(--color-c); font-size:0.7rem;">登記新改期</button>
              <button onclick="closeCaseDrawer('${c.id}')" class="btn btn-primary" style="width:100%; justify-content:center; height:24px; font-size:0.68rem; font-weight:700; background:var(--color-c); color:#000;">✓ 完成</button>
            </div>
          </div>

          <div style="flex: 1.4; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; gap:6px; min-width: 0;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:2px;">📅 成交簽約設定</div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.04);">
              <input type="text" readonly value="${cc.meetDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'meetDate', 'c')" placeholder="選擇成交日期" style="width:100%; text-align:center; padding:2px 4px; font-size:0.75rem; height:22px; cursor:pointer; background:transparent; border:none; color:#fff;">
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:0.7rem; color:var(--text-secondary);">成交簽署狀態</span>
              <div style="display:flex; gap:4px;">
                <button class="status-badge-btn ${cc.meetState === 'pending' ? 'active' : ''}" data-type="intent-pending" onclick="updateCField('${c.id}', 'meetState', 'pending')" style="flex:1; justify-content:center; padding: 3px 0; font-size:0.68rem; border-radius:4px;">簽單處理中</button>
                <button class="status-badge-btn ${cc.meetState === 'confirmed' ? 'active' : ''}" data-type="agree" onclick="updateCField('${c.id}', 'meetState', 'confirmed')" style="flex:1; justify-content:center; padding: 3px 0; font-size:0.68rem; border-radius:4px;">已送件簽署</button>
              </div>
            </div>
          </div>

          ${renderVisitTasksSection(c, 'C')}

          <div style="flex: 4.2; min-width: 0; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
            <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">🛠️ 成交及核保追蹤</div>
              <div style="flex:1; padding-right: 2px; display:flex; flex-direction:column; justify-content:stretch;">
                <div class="drawer-right-split-3" style="height:100%; gap:8px;">
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPlanDone ? '0.18' : (isPlanOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:5px; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.7rem; color:#c084fc; font-weight:700;">文件準備</span>
                        <button class="status-badge-btn ${isPlanDone ? 'active agree' : (isPlanOngoing ? 'ongoing-c' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'planState', 'c')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'planState', 'c')"
                                style="font-size:0.6rem; padding:1px 4px; border-radius:4px; height:16px; width:85px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isPlanDone ? `✓ (${formatShortDate(cc.planDate)})` : (isPlanOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-planState" value="${cc.planDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'planDate', 'c')" placeholder="完成日期" style="width:100%; padding:2px 4px; font-size:0.7rem; height:18px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                      <textarea style="height:75px; resize:none; font-size:0.7rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:3px; width:100%; box-sizing:border-box;" placeholder="體檢或財務說明..." onchange="updateCField('${c.id}', 'planNotes', this.value)">${cc.planNotes || ''}</textarea>
                    </div>
                    
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isSignDone ? '0.18' : (isSignOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:5px; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.7rem; color:#fb923c; font-weight:700;">簽約</span>
                        <button class="status-badge-btn ${isSignDone ? 'active agree' : (isSignOngoing ? 'ongoing-c' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'signState', 'c')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'signState', 'c')"
                                style="font-size:0.6rem; padding:1px 4px; border-radius:4px; height:16px; width:85px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isSignDone ? `✓ (${formatShortDate(cc.signDate)})` : (isSignOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-signState" value="${cc.signDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'signDate', 'c')" placeholder="簽約日期" style="width:100%; padding:2px 4px; font-size:0.7rem; height:18px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                    </div>
                  </div>

                  <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPracticeDone ? '0.18' : (isPracticeOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:5px; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.7rem; color:#60a5fa; font-weight:700;">要保簽署</span>
                        <button class="status-badge-btn ${isPracticeDone ? 'active agree' : (isPracticeOngoing ? 'ongoing-c' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'practiceState', 'c')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'practiceState', 'c')"
                                style="font-size:0.6rem; padding:1px 4px; border-radius:4px; height:16px; width:85px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isPracticeDone ? `✓ (${formatShortDate(cc.practiceDate)})` : (isPracticeOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-practiceState" value="${cc.practiceDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'practiceDate', 'c')" placeholder="投保日期" style="width:100%; padding:2px 4px; font-size:0.7rem; height:18px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                    </div>

                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isRemedyDone ? '0.18' : (isRemedyOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:5px; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.7rem; color:#f43f5e; font-weight:700;">補件</span>
                        <button class="status-badge-btn ${isRemedyDone ? 'active agree' : (isRemedyOngoing ? 'ongoing-c' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'remedyState', 'c')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'remedyState', 'c')"
                                style="font-size:0.6rem; padding:1px 4px; border-radius:4px; height:16px; width:85px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isRemedyDone ? `✓ (${formatShortDate(cc.remedyDate)})` : (isRemedyOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-remedyState" value="${cc.remedyDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'remedyDate', 'c')" placeholder="補件日期" style="width:100%; padding:2px 4px; font-size:0.7rem; height:18px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                    </div>
                  </div>

                  <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isSubmitDone ? '0.18' : (isSubmitOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:5px; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.7rem; color:#e879f9; font-weight:700;">送件</span>
                        <button class="status-badge-btn ${isSubmitDone ? 'active agree' : (isSubmitOngoing ? 'ongoing-c' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'submitState', 'c')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'submitState', 'c')"
                                style="font-size:0.6rem; padding:1px 4px; border-radius:4px; height:16px; width:85px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isSubmitDone ? `✓ (${formatShortDate(cc.submitDate)})` : (isSubmitOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-submitState" value="${cc.submitDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'submitDate', 'c')" placeholder="送件日期" style="width:100%; padding:2px 4px; font-size:0.7rem; height:18px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                    </div>

                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isDiscussDone ? '0.18' : (isDiscussOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:5px; display:flex; flex-direction:column; gap:3px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.7rem; color:#34d399; font-weight:700;">保費首扣</span>
                        <button class="status-badge-btn ${isDiscussDone ? 'active agree' : (isDiscussOngoing ? 'ongoing-c' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'discussState', 'c')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'discussState', 'c')"
                                style="font-size:0.6rem; padding:1px 4px; border-radius:4px; height:16px; width:85px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isDiscussDone ? `✓ (${formatShortDate(cc.discussDate)})` : (isDiscussOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-discussState" value="${cc.discussDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'discussDate', 'c')" placeholder="首扣日期" style="width:100%; padding:2px 4px; font-size:0.7rem; height:18px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                      <textarea style="height:75px; resize:none; font-size:0.7rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:3px; width:100%; box-sizing:border-box;" placeholder="扣帳備忘..." onchange="updateCField('${c.id}', 'discussNotes', this.value)">${cc.discussNotes || ''}</textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }    function renderSDrawer(c, container) {
      const s = c.sDetails;
      
      const isPlanDone = s.planState === 'active';
      const isPlanOngoing = s.planState === 'ongoing';
      const isPracticeDone = s.practiceState === 'active';
      const isPracticeOngoing = s.practiceState === 'ongoing';
      const isDiscussDone = s.discussState === 'active';
      const isDiscussOngoing = s.discussState === 'ongoing';

      container.innerHTML = `
        <div class="drawer-grid-horizontal">
          <div style="flex: 1.2; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; justify-content:space-between; min-width: 0;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:2px;">📅 售後服務設定</div>
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.04); width:100%; box-sizing:border-box;">
                <input type="text" readonly value="${s.meetDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'meetDate', 's')" placeholder="選擇服務日期" style="width:100%; text-align:center; padding:2px 4px; font-size:0.75rem; height:22px; cursor:pointer; background:transparent; border:none; color:#fff;">
              </div>
            </div>
            <button onclick="closeCaseDrawer('${c.id}')" class="btn btn-primary" style="width:100%; justify-content:center; height:24px; font-size:0.68rem; font-weight:700; background:var(--color-c); color:#000; margin-top: 12px;">✓ 完成</button>
          </div>

          ${renderVisitTasksSection(c, 'S')}

          <div style="flex: 3.4; min-width: 0; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">🛠️ 售後服務工作項目</div>
              <div style="max-height: 350px; overflow-y: auto; padding-right: 2px;">
                <div class="drawer-right-split">
                  <div>
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPlanDone ? '0.18' : (isPlanOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.72rem; color:#c084fc; font-weight:700;">保單送達</span>
                        <button class="status-badge-btn ${isPlanDone ? 'active agree' : (isPlanOngoing ? 'ongoing-s' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'planState', 's')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'planState', 's')"
                                style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isPlanDone ? `✓ (${formatShortDate(s.planDate)})` : (isPlanOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-planState" value="${s.planDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'planDate', 's')" placeholder="送達日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                      <textarea style="height:110px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px;" placeholder="保單回條狀態..." onchange="updateSField('${c.id}', 'planNotes', this.value)">${s.planNotes || ''}</textarea>
                    </div>
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isPracticeDone ? '0.18' : (isPracticeOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.72rem; color:#60a5fa; font-weight:700;">契撤追蹤</span>
                        <button class="status-badge-btn ${isPracticeDone ? 'active agree' : (isPracticeOngoing ? 'ongoing-s' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'practiceState', 's')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'practiceState', 's')"
                                style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isPracticeDone ? `✓ (${formatShortDate(s.practiceDate)})` : (isPracticeOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-practiceState" value="${s.practiceDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'practiceDate', 's')" placeholder="契撤期確認日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                    </div>
                  </div>
                  <div>
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,${isDiscussDone ? '0.18' : (isDiscussOngoing ? '0.3' : '0.04')}); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px;">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.72rem; color:#34d399; font-weight:700;">週年服務</span>
                        <button class="status-badge-btn ${isDiscussDone ? 'active agree' : (isDiscussOngoing ? 'ongoing-s' : '')}" 
                                onclick="handleCBtnClick('${c.id}', 'discussState', 's')" 
                                ondblclick="handleCBtnDblClick('${c.id}', 'discussState', 's')"
                                style="font-size:0.62rem; padding:1px 6px; border-radius:4px; height:18px; width:100px; justify-content:center; user-select:none; white-space:nowrap;">
                          ${isDiscussDone ? `✓ (${formatShortDate(s.discussDate)})` : (isDiscussOngoing ? `進行中` : '標記進行中')}
                        </button>
                      </div>
                      <input type="text" readonly id="date-input-${c.id}-discussState" value="${s.discussDate || ''}" onclick="showCustomDatePicker(this, '${c.id}', 'discussDate', 's')" placeholder="定期維繫日期" style="width:100%; padding:2px 4px; font-size:0.72rem; height:20px; cursor:pointer; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;">
                      <textarea style="height:110px; resize:none; font-size:0.72rem; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px; padding:4px;" placeholder="週年聯絡記錄..." onchange="updateSField('${c.id}', 'discussNotes', this.value)">${s.discussNotes || ''}</textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }




    function renderDatePicker(dp) {
      const year = datePickerCurrentDate.getFullYear();
      const month = datePickerCurrentDate.getMonth();

      const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      
      const firstDayIndex = new Date(year, month, 1).getDay(); // 0 是週日
      const totalDays = new Date(year, month + 1, 0).getDate();

      let html = `
        <div class="datepicker-header">
          <button type="button" class="datepicker-btn" onclick="changeDatePickerMonth(-1, event)">◄</button>
          <span class="datepicker-title">${year}年 ${monthNames[month]}</span>
          <button type="button" class="datepicker-btn" onclick="changeDatePickerMonth(1, event)">►</button>
        </div>
        <div class="datepicker-weekdays">
          <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
        </div>
        <div class="datepicker-days">
      `;

      // 填充空白
      for (let i = 0; i < firstDayIndex; i++) {
        html += `<div class="datepicker-day empty"></div>`;
      }

      // 比對並亮燈當前日期
      const targetVal = currentDatePickerTarget.element.value;
      const targetDate = targetVal ? new Date(targetVal) : null;
      const isSameMonthYear = targetDate && targetDate.getFullYear() === year && targetDate.getMonth() === month;

      for (let day = 1; day <= totalDays; day++) {
        const isActive = isSameMonthYear && targetDate.getDate() === day ? 'active' : '';
        html += `<div class="datepicker-day ${isActive}" onclick="selectDatePickerDate(${year}, ${month}, ${day})">${day}</div>`;
      }

      html += `</div>`;
      
      // 新增清除日期按鈕區塊
      html += `
        <div style="display: flex; justify-content: center; padding: 6px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.15); margin-top: 4px; border-radius: 0 0 8px 8px;">
          <button type="button" class="btn" onclick="clearDatePickerDate(event)" style="padding: 2px 8px; font-size: 0.72rem; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; width: 100%; height: 22px; justify-content: center; border-radius: 4px; cursor: pointer;">✕ 清除日期</button>
        </div>
      `;
      dp.innerHTML = html;
    }

    // 全域清除日期處理函式
    function clearDatePickerDate(event) {
      if (event) event.stopPropagation();
      const dp = document.getElementById('custom-datepicker');
      if (dp) dp.style.display = 'none';

      const target = currentDatePickerTarget;
      if (!target) return;
      target.element.value = '';

      if (target.type === 'case') {
        updateCaseField(target.caseId, target.field, '');
      } else if (target.type === 'sa') {
        updateSADate(target.caseId, target.field, '');
      } else if (target.type === 'oa') {
        updateOAField(target.caseId, target.field, '');
      } else if (target.type === 'pc') {
        updatePCField(target.caseId, target.field, '');
      } else if (target.type === 'c') {
        updateCField(target.caseId, target.field, '');
      } else if (target.type === 's') {
        updateSField(target.caseId, target.field, '');
      }
    }

    function selectQuickDatePickerDate(daysOffset) {
      const today = new Date();
      today.setDate(today.getDate() + daysOffset);
      selectDatePickerDate(today.getFullYear(), today.getMonth(), today.getDate());
    }

    // 依據傳入偏移量變更月份，並重新渲染 (阻擋冒泡事件防範關閉)
    function changeDatePickerMonth(offset, event) {
      if (event) event.stopPropagation();
      datePickerCurrentDate.setMonth(datePickerCurrentDate.getMonth() + offset);
      const dp = document.getElementById('custom-datepicker');
      if (dp) renderDatePicker(dp);
    }

    function selectDatePickerDate(year, month, day) {
      const dp = document.getElementById('custom-datepicker');
      if (dp) dp.style.display = 'none';

      const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const target = currentDatePickerTarget;
      target.element.value = formattedDate;

      if (target.type === 'case') {
        updateCaseField(target.caseId, target.field, formattedDate);
      } else if (target.type === 'sa') {
        updateSADate(target.caseId, target.field, formattedDate);
      } else if (target.type === 'oa') {
        updateOAField(target.caseId, target.field, formattedDate);
      } else if (target.type === 'pc') {
        updatePCField(target.caseId, target.field, formattedDate);
      } else if (target.type === 'c') {
        updateCField(target.caseId, target.field, formattedDate);
      } else if (target.type === 's') {
        updateSField(target.caseId, target.field, formattedDate);
      }
    }

    // 格式化子標籤（加日期後綴 MM/D，接續在文字後面不換行）
    function fmtSubLabel(label, dateStr) {
      if (!dateStr) return label;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return label;
      return `${label} ${d.getMonth()+1}/${d.getDate()}`;
    }

    // === 新增約訪時段、漏斗看板與案件建立輔助函式 ===
    function updateTimeSlot(caseId, phase, slot) {
      const c = cases.find(item => item.id === caseId);
      if (!c) return;
      const lowerPhase = phase.toLowerCase();
      updateCase(caseId, item => {
        if (lowerPhase === 'sa') {
          item.saDetails.meetTimeSlot = item.saDetails.meetTimeSlot === slot ? '' : slot;
        } else if (lowerPhase === 'oa') {
          item.oaDetails.meetTimeSlot = item.oaDetails.meetTimeSlot === slot ? '' : slot;
        } else if (lowerPhase === 'pc') {
          item.pcDetails.meetTimeSlot = item.pcDetails.meetTimeSlot === slot ? '' : slot;
        } else if (lowerPhase === 'c') {
          if (!item.cDetails) item.cDetails = {};
          item.cDetails.meetTimeSlot = item.cDetails.meetTimeSlot === slot ? '' : slot;
        } else if (lowerPhase === 's') {
          if (!item.sDetails) item.sDetails = {};
          item.sDetails.meetTimeSlot = item.sDetails.meetTimeSlot === slot ? '' : slot;
        }
      });
      
      // 直接更新所有時段按鈕 class，避免重建整個抽屜 DOM
      const drawerRow = document.getElementById(`drawer-row-${caseId}`);
      if (drawerRow && drawerRow.style.display === 'block') {
        const currentSlotValue =
          lowerPhase === 'oa' ? c.oaDetails.meetTimeSlot :
          lowerPhase === 'pc' ? c.pcDetails.meetTimeSlot :
          lowerPhase === 'c' ? (c.cDetails ? c.cDetails.meetTimeSlot : '') :
          lowerPhase === 's' ? (c.sDetails ? c.sDetails.meetTimeSlot : '') :
          c.saDetails.meetTimeSlot;
        // 找到所有時段按鈕，更新 active class
        const allSlots = ['before_lunch','lunch','afternoon_1','afternoon_2','dinner','after_dinner'];
        allSlots.forEach(s => {
          const btns = drawerRow.querySelectorAll(`[onclick*="updateTimeSlot('${caseId}', '${phase}', '${s}')"]`);
          btns.forEach(btn => {
            if (s === currentSlotValue) btn.classList.add('active');
            else btn.classList.remove('active');
          });
        });
      }
    }

    // === 議題維護相關函數 ===
    const DEFAULT_GROUPS = [
      { key: 'family',  emoji: '👶', label: '家庭與兒女' },
      { key: 'life',    emoji: '🚗', label: '生活與財產' },
      { key: 'service', emoji: '🔍', label: '專業檢視服務' },
    ];
    const DEFAULT_ISSUES = [
      { name: '新生兒保單', group: 'family' },
      { name: '子女教育基金', group: 'family' },
      { name: '車險', group: 'life' },
      { name: '旅平卡', group: 'life' },
      { name: '保單檢視', group: 'service' },
      { name: '財務檢視', group: 'service' },
    ];

    // 分群資料存取
    function getCustomGroups() {
      return JSON.parse(localStorage.getItem('crm_groups') || 'null') || DEFAULT_GROUPS;
    }
    function saveCustomGroups(groups) {
      localStorage.setItem('crm_groups', JSON.stringify(groups));
    }

    // 議題資料存取
    function getCustomIssues() {
      return JSON.parse(localStorage.getItem('crm_issues') || 'null') || DEFAULT_ISSUES;
    }
    function saveCustomIssues(issues) {
      localStorage.setItem('crm_issues', JSON.stringify(issues));
    }

    // 取得分群完整 label（含 emoji）
    function getGroupLabel(key) {
      const g = getCustomGroups().find(g => g.key === key);
      return g ? `${g.emoji} ${g.label}` : key;
    }

    // --- 議題列表渲染 ---
    function renderIssueList() {
      const container = document.getElementById('issue-list-container');
      if (!container) return;
      const issues = getCustomIssues();
      const groups = getCustomGroups();
      const grouped = {};
      issues.forEach((item, idx) => {
        if (!grouped[item.group]) grouped[item.group] = [];
        grouped[item.group].push({ ...item, idx });
      });
      let html = '';
      groups.forEach(g => {
        const items = grouped[g.key] || [];
        const label = `${g.emoji} ${g.label}`;
        html += `<div style="margin-bottom: 1rem;">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--color-sa); margin-bottom: 6px;">${label}</div>`;
        if (items.length === 0) {
          html += `<div style="font-size: 0.78rem; color: var(--text-secondary); padding: 4px 8px; opacity: 0.6;">（尚無議題）</div>`;
        } else {
          items.forEach(item => {
            html += `<div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--bg-input); border-radius: 4px; margin-bottom: 4px;">
              <span style="font-size: 0.85rem;">${item.name}</span>
              <button class="btn" onclick="deleteCustomIssue(${item.idx})" style="padding: 2px 8px; font-size: 0.72rem; color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08);">刪除</button>
            </div>`;
          });
        }
        html += `</div>`;
      });
      container.innerHTML = html;
    }

    // --- 分群選單渲染（Modal 內的 select）---
    function rebuildGroupSelect() {
      const sel = document.getElementById('issue-new-group');
      if (!sel) return;
      const groups = getCustomGroups();
      sel.innerHTML = groups.map(g => `<option value="${g.key}">${g.emoji} ${g.label}</option>`).join('');
    }

    // --- 分群清單渲染 ---
    function renderGroupList() {
      const container = document.getElementById('group-list-container');
      if (!container) return;
      const groups = getCustomGroups();
      if (groups.length === 0) {
        container.innerHTML = `<div style="font-size:0.82rem;color:var(--text-secondary);padding:8px;">（尚無分群）</div>`;
        return;
      }
      let html = '';
      groups.forEach((g, idx) => {
        html += `<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--bg-input); border-radius: 6px; margin-bottom: 6px;">
          <span style="font-size: 0.9rem;">${g.emoji} <strong>${g.label}</strong></span>
          <button class="btn" onclick="deleteCustomGroup(${idx})" style="padding: 2px 8px; font-size: 0.72rem; color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08);">刪除</button>
        </div>`;
      });
      container.innerHTML = html;
    }

    // --- 新增議題 ---
    function addCustomIssue() {
      const name = document.getElementById('issue-new-name').value.trim();
      const group = document.getElementById('issue-new-group').value;
      if (!name) { showToast('請輸入議題名稱', 'error'); return; }
      const issues = getCustomIssues();
      if (issues.some(i => i.name === name)) { showToast('此議題已存在', 'error'); return; }
      issues.push({ name, group });
      saveCustomIssues(issues);
      document.getElementById('issue-new-name').value = '';
      renderIssueList();
      showToast(`已新增議題：${name}`, 'success');
    }

    // --- 刪除議題 ---
    function deleteCustomIssue(idx) {
      const issues = getCustomIssues();
      const removed = issues.splice(idx, 1);
      saveCustomIssues(issues);
      renderIssueList();
      if (removed.length) showToast(`已刪除議題：${removed[0].name}`, 'success');
    }

    // --- 新增分群 ---
    function addCustomGroup() {
      const emoji = document.getElementById('group-new-emoji').value.trim() || '📌';
      const label = document.getElementById('group-new-label').value.trim();
      if (!label) { showToast('請輸入分群名稱', 'error'); return; }
      const groups = getCustomGroups();
      // 用 label 文字產生 key
      const key = 'grp_' + Date.now();
      if (groups.some(g => g.label === label)) { showToast('此分群已存在', 'error'); return; }
      groups.push({ key, emoji, label });
      saveCustomGroups(groups);
      document.getElementById('group-new-emoji').value = '';
      document.getElementById('group-new-label').value = '';
      renderGroupList();
      rebuildGroupSelect(); // 同步新增議題的分群選單
      showToast(`已新增分群：${emoji} ${label}`, 'success');
    }

    // --- 刪除分群（連帶移除該分群下所有議題）---
    function deleteCustomGroup(idx) {
      const groups = getCustomGroups();
      const removed = groups.splice(idx, 1);
      saveCustomGroups(groups);
      if (removed.length) {
        // 移除屬於該分群的所有議題
        const deletedKey = removed[0].key;
        const issues = getCustomIssues().filter(i => i.group !== deletedKey);
        saveCustomIssues(issues);
        showToast(`已刪除分群：${removed[0].emoji} ${removed[0].label}`, 'success');
      }
      renderGroupList();
      rebuildGroupSelect();
    }

    // --- 同步快速選取下拉選單 ---
    function rebuildIssueSelects() {
      const issues = getCustomIssues();
      const groups = getCustomGroups();
      const buildOptions = () => {
        const grouped = {};
        issues.forEach(i => {
          if (!grouped[i.group]) grouped[i.group] = [];
          grouped[i.group].push(i.name);
        });
        let html = '<option value=""></option>';
        groups.forEach(g => {
          if (!grouped[g.key] || !grouped[g.key].length) return;
          html += `<optgroup label="${g.emoji} ${g.label}">`;
          grouped[g.key].forEach(name => { html += `<option value="${name}">${name}</option>`; });
          html += `</optgroup>`;
        });
        return html;
      };
      const opts = buildOptions();
      ['add-issue-select', 'add-issue-select-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
      });
    }


    let reminderModalCallback = null;
    function toggleReminderModal(show, callback) {
      const modal = document.getElementById('reminder-modal');
      if (!modal) return;
      if (show) {
        reminderModalCallback = callback || null;
        modal.classList.add('active');
      } else {
        modal.classList.remove('active');
        if (reminderModalCallback) {
          const cb = reminderModalCallback;
          reminderModalCallback = null;
          cb();
        } else {
          // 如果是一般手動點開（非啟動引導流），維持原有的關閉後自動跳出待辦任務通知
          setTimeout(() => { checkAndShowTodoReminders(); }, 400);
        }
      }
    }

// 計算與更新全域提醒喚醒按鈕狀態
    function updateGlobalReminderIcon(expiredCount, todayCount, futureCount, expiredList, todayList, futureList) {
      const btn = document.getElementById('btn-open-reminder');
      const badge = document.getElementById('reminder-global-badge');
      if (!btn || !badge) return;

      const urgentCount = expiredCount + todayCount;
      const totalCount = urgentCount + futureCount;

      if (totalCount > 0) {
        btn.style.display = 'inline-block';
        badge.innerText = totalCount;
        
        // 如果有「已過期」或「今天」等需要立刻被解決的案件，按鈕變更為呼吸發光
        if (urgentCount > 0) {
          btn.classList.add('reminder-active-glow');
          btn.title = "⚠️ 有 " + urgentCount + " 筆送件已過期或今天到期！點擊查看看板";
        } else {
          btn.classList.remove('reminder-active-glow');
          btn.title = "💡 有 " + futureCount + " 筆未來送件預告。點擊查看看板";
        }
      } else {
        btn.style.display = 'none';
      }
    }

// Ｃ送件階段專屬紅黃綠亮燈邏輯與未來呼吸預警樣式輔助
    function getSubmitBtnClass(c) {
      let baseClass = 'sub-tag-btn';
      if (!c || !c.cDetails) return baseClass;
      if (c.cDetails.submitState === 'active') {
        baseClass += ' active c-submit';
      } else if (c.cDetails.submitState === 'ongoing') {
        baseClass += ' ongoing-magenta';
      }
      
      // 若已送件處理，回傳預設樣式
      if (c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        
        // 取得預告天數限制
        const limitDays = (window.crmSettings && window.crmSettings.reminderDaysLimit) ? window.crmSettings.reminderDaysLimit : 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;
        
        // 核心修正：將日期的斜線 / 統一轉換為橫線 -，防範 ASCII 字串大小判定錯亂
        const sDate = c.cDetails.submitDate.replace(/\//g, '-');
        if (sDate < todayStr) {
          return baseClass + ' submit-light-expired'; // 🔴 過期紅燈
        } else if (sDate === todayStr) {
          return baseClass + ' submit-light-today'; // 🟡 當天黃燈
        } else if (sDate > todayStr && sDate <= limitDateStr) {
          return baseClass + ' submit-light-future'; // 🟢 未來綠燈（呼吸發光）
        }
      }
      return baseClass;
    }

    // 計算與更新全域提醒喚醒按鈕狀態
    function updateGlobalReminderIcon(expiredCount, todayCount, futureCount, expiredList, todayList, futureList) {
      const btn = document.getElementById('btn-open-reminder');
      const badge = document.getElementById('reminder-global-badge');
      if (!btn || !badge) return;

      const urgentCount = expiredCount + todayCount;
      const totalCount = urgentCount + futureCount;

      if (totalCount > 0) {
        btn.style.display = 'inline-block';
        badge.innerText = totalCount;
        
        // 如果有「已過期」或「今天」等需要立刻被解決的案件，按鈕變更為呼吸發光
        if (urgentCount > 0) {
          btn.classList.add('reminder-active-glow');
          btn.title = "⚠️ 有 " + urgentCount + " 筆送件已過期或今天到期！點擊查看看板";
        } else {
          btn.classList.remove('reminder-active-glow');
          btn.title = "💡 有 " + futureCount + " 筆未來送件預告。點擊查看看板";
        }
      } else {
        btn.style.display = 'none';
      }
    }

// Ｃ送件階段專屬紅黃綠亮燈邏輯與未來呼吸預警樣式輔助
    function getSubmitBtnClass(c) {
      let baseClass = 'sub-tag-btn';
      if (!c || !c.cDetails) return baseClass;
      if (c.cDetails.submitState === 'active') {
        baseClass += ' active c-submit';
      } else if (c.cDetails.submitState === 'ongoing') {
        baseClass += ' ongoing-magenta';
      }
      
      // 若已送件處理，回傳預設樣式
      if (c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        
        // 取得預告天數限制
        const limitDays = (window.crmSettings && window.crmSettings.reminderDaysLimit) ? window.crmSettings.reminderDaysLimit : 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;
        
        // 核心修正：將日期的斜線 / 統一轉換為橫線 -，防範 ASCII 字串大小判定錯亂
        const sDate = c.cDetails.submitDate.replace(/\//g, '-');
        if (sDate < todayStr) {
          return baseClass + ' submit-light-expired'; // 🔴 過期紅燈
        } else if (sDate === todayStr) {
          return baseClass + ' submit-light-today'; // 🟡 當天黃燈
        } else if (sDate > todayStr && sDate <= limitDateStr) {
          return baseClass + ' submit-light-future'; // 🟢 未來綠燈（呼吸發光）
        }
      }
      return baseClass;
    }

    // 計算與更新全域提醒喚醒按鈕狀態
    function updateGlobalReminderIcon(expiredCount, todayCount, futureCount, expiredList, todayList, futureList) {
      const btn = document.getElementById('btn-open-reminder');
      const badge = document.getElementById('reminder-global-badge');
      if (!btn || !badge) return;

      const urgentCount = expiredCount + todayCount;
      const totalCount = urgentCount + futureCount;

      // 即使 totalCount 為 0，按鈕也要常駐顯示以供使用者點選叫出通知畫面
      btn.style.display = 'inline-block';
      badge.innerText = totalCount;
      
      // 如果有「已過期」或「今天」等需要立刻被解決的案件，按鈕變更為呼吸發光
      if (urgentCount > 0) {
        btn.classList.add('reminder-active-glow');
        btn.title = "⚠️ 有 " + urgentCount + " 筆送件已過期或今天到期！點擊查看看板";
      } else {
        btn.classList.remove('reminder-active-glow');
        btn.title = "💡 時程提醒看板。點擊查看看板";
      }
    }

    function checkAndShowDailyReminders() {
      debugLog("🔔 checkAndShowDailyReminders 開始執行！目前 cases 數量: " + (cases ? cases.length : 0));
      
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const twDate = new Date(utc + (3600000 * 8));
      const yyyy = twDate.getFullYear();
      const mm = String(twDate.getMonth() + 1).padStart(2, '0');
      const dd = String(twDate.getDate()).padStart(2, '0');
      const todayStr = yyyy + "-" + mm + "-" + dd;
      debugLog("📅 提醒系統今天判定基準日: " + todayStr);
      
      // 計算預告天數截止日
      const limitDays = crmSettings.reminderDaysLimit || 14;
      const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
      const ly = limitDate.getFullYear();
      const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
      const ld = String(limitDate.getDate()).padStart(2, '0');
      const limitDateStr = ly + "-" + lm + "-" + ld;
      debugLog("🔮 預告範圍截止日: " + limitDateStr + " (限制天數: " + limitDays + ")");
      
      const expired = [];
      const today = [];
      const future = [];

      if (cases && cases.length > 0) {
        cases.forEach(c => {
          if (c.cDetails) {
            debugLog("🔍 客戶: " + c.clientName + " | 送件日: '" + c.cDetails.submitDate + "' | 已處理狀態: '" + c.cDetails.submitProcessed + "'");
          }
          if (c.cDetails && c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
            const sDate = c.cDetails.submitDate.replace(/\//g, '-');
            if (sDate < todayStr) {
              expired.push(c);
            } else if (sDate === todayStr) {
              today.push(c);
            } else if (sDate > todayStr && sDate <= limitDateStr) {
              future.push(c);
            }
          }
        });
      }
      
      debugLog("📊 提醒系統統計成果 -> 已過期: " + expired.length + " 筆, 今天送件: " + today.length + " 筆, 未來預告: " + future.length + " 筆");
      
      // 更新主畫面喚醒按鈕狀態
      updateGlobalReminderIcon(expired.length, today.length, future.length, expired, today, future);
      
      // 核心修正：即便全部是 0 筆，重新整理也依然彈出三欄看板畫面！
      renderReminderBoard(expired, today, future);
      toggleReminderModal(true);
    }

    function renderReminderBoard(expired, today, future) {
      const expiredList = document.getElementById('reminder-expired-list');
      const todayList = document.getElementById('reminder-today-list');
      const futureList = document.getElementById('reminder-future-list');
      
      const expiredCount = document.getElementById('reminder-expired-count');
      const todayCount = document.getElementById('reminder-today-count');
      const futureCount = document.getElementById('reminder-future-count');

      if (expiredCount) expiredCount.innerText = expired.length;
      if (todayCount) todayCount.innerText = today.length;
      if (futureCount) futureCount.innerText = future.length;

      const renderItemHtml = (c, isActionable, colorVar, btnText) => {
        const typeText = c.type === 'life' ? '壽' : '產';
        const typeClass = c.type === 'life' ? 'life' : 'property';
        const issueText = c.issueName || '無議題';
        
        // 過濾短日期格式為 MM-DD 格式，徹底防範年份折行
        let submitDateText = c.cDetails.submitDate || '';
        if (submitDateText.includes('-')) {
          const parts = submitDateText.split('-');
          if (parts.length === 3) {
            submitDateText = parts[1] + "-" + parts[2];
          }
        } else if (submitDateText.includes('/')) {
          const parts = submitDateText.split('/');
          if (parts.length === 3) {
            submitDateText = parts[1] + "-" + parts[2];
          }
        }
        
        return `<div class="reminder-row" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); border:1px solid rgba(255, 255, 255, 0.05); padding:8px 10px; border-radius:6px; margin-bottom:8px; gap:8px; transition: all 0.4s ease; transform-origin: left center;">
            <div style="display:flex; flex-direction:column; gap:4px; min-width: 0; flex: 1;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="type-badge ${typeClass}">${typeText}</span>
                <span style="font-weight:700; font-size:0.8rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.clientName}</span>
              </div>
              <div style="font-size:0.7rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                議題：${issueText}
              </div>
              <div style="font-size:0.65rem; color:${colorVar}; font-family:monospace; white-space:nowrap;">
                送件：${submitDateText}
              </div>
            </div>
            ${isActionable ? `
              <button class="status-badge-btn active agree" 
                      ondblclick="markReminderProcessed('${c.id}', this)" 
                      title="雙擊此按鈕結案" 
                      style="height:22px; font-size:0.65rem; padding:0 6px; border-radius:3px; flex-shrink:0; background:${colorVar}; border-color:${colorVar}; color:#000; font-weight:700; cursor:pointer; user-select:none; transition: all 0.2s;">
                ${btnText}
              </button>
            ` : `
              <span style="font-size: 0.65rem; color: var(--text-secondary); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 3px; flex-shrink:0;">預告</span>
            `}
          </div>`;
      };

      // 載入多件時配置 max-height 與 overflow 確保完美上下捲動
      if (expiredList) {
        expiredList.style.maxHeight = '350px';
        expiredList.style.overflowY = 'auto';
        if (expired.length === 0) {
          expiredList.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding:30px 10px; font-size:0.75rem;">🎉 無過期未送件！</div>`;
        } else {
          expiredList.innerHTML = expired.map(c => renderItemHtml(c, true, '#ef4444', '雙擊銷帳 📤')).join('');
        }
      }

      if (todayList) {
        todayList.style.maxHeight = '350px';
        todayList.style.overflowY = 'auto';
        if (today.length === 0) {
          todayList.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding:30px 10px; font-size:0.75rem;">🎉 今日皆已處理！</div>`;
        } else {
          todayList.innerHTML = today.map(c => renderItemHtml(c, true, '#f59e0b', '雙擊結案 📤')).join('');
        }
      }

      if (futureList) {
        futureList.style.maxHeight = '350px';
        futureList.style.overflowY = 'auto';
        if (future.length === 0) {
          futureList.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding:30px 10px; font-size:0.75rem;">暫無未來送件預告</div>`;
        } else {
          const sortedFuture = [...future].sort((a, b) => a.cDetails.submitDate.localeCompare(b.cDetails.submitDate));
          futureList.innerHTML = sortedFuture.map(c => renderItemHtml(c, false, '#22c55e', '')).join('');
        }
      }
    }

    function markReminderProcessed(caseId, btnEl) {
      const rowEl = btnEl ? btnEl.closest('.reminder-row') : null;
      if (rowEl) {
        rowEl.style.transform = 'translateX(30px)';
        rowEl.style.opacity = '0';
      }

      setTimeout(() => {
        updateCase(caseId, c => {
          if (!c.cDetails) c.cDetails = {};
          c.cDetails.submitProcessed = 'processed';
        });

        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;

        // 計算預告天數截止日
        const limitDays = crmSettings.reminderDaysLimit || 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;

        const expired = [];
        const today = [];
        const future = [];

        cases.forEach(c => {
          if (c.cDetails && c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
            const sDate = c.cDetails.submitDate.replace(/\//g, '-');
            if (sDate < todayStr) {
              expired.push(c);
            } else if (sDate === todayStr) {
              today.push(c);
            } else if (sDate > todayStr && sDate <= limitDateStr) {
              future.push(c);
            }
          }
        });

        // 動態連動同步更新頂部喚醒按鈕狀態
        updateGlobalReminderIcon(expired.length, today.length, future.length, expired, today, future);
        renderReminderBoard(expired, today, future);
        
        if (expired.length === 0 && today.length === 0) {
          setTimeout(() => {
            toggleReminderModal(false);
          }, 400);
        }
      }, 400);
    }

    
    let addCaseModalCallback = null;
    function toggleAddCaseModal(show, callback) {
      const modal = document.getElementById('add-case-modal');
      if (show) {
        addCaseModalCallback = callback || null;
        modal.classList.add('active');
        document.getElementById('add-client-name').value = '';
        document.getElementById('add-visit-type').value = 'issue';
        document.getElementById('add-case-type').value = 'life';
        document.getElementById('add-case-source').value = 'outbound'; // 規格預設為開發客 (outbound)
        document.getElementById('add-source').value = 'relative';
        document.getElementById('add-issue-name').value = '';
        document.getElementById('add-issue-name-2').value = '';
        document.getElementById('add-second-issue-row').style.display = 'none';
        document.getElementById('add-contact-detail').value = '';

        // 重置轉介紹連動欄位
        document.getElementById('add-referrer-name').value = '';
        document.getElementById('add-referrer-row').style.display = 'none';
        document.getElementById('add-referrer-name').required = false;

        // 重置次標籤按鈕的 active 狀態
        modal.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
        modal.querySelectorAll('[onclick*="\'add-visit-type\', \'issue\'"]').forEach(btn => btn.classList.add('active'));
        modal.querySelectorAll('[onclick*="\'add-case-type\', \'life\'"]').forEach(btn => btn.classList.add('active'));
        modal.querySelectorAll('[onclick*="\'add-case-source\', \'outbound\'"]').forEach(btn => btn.classList.add('active'));
        modal.querySelectorAll('[onclick*="\'add-source\', \'relative\'"]').forEach(btn => btn.classList.add('active'));
      } else {
        modal.classList.remove('active');
        if (addCaseModalCallback) {
          const cb = addCaseModalCallback;
          addCaseModalCallback = null;
          cb();
        }
      }
    }

    function selectFormTab(inputId, value, element) {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.value = value;

      // 切換 class
      const buttons = element.parentElement.querySelectorAll('.btn-tab');
      buttons.forEach(btn => btn.classList.remove('active'));
      element.classList.add('active');

      // 連動生活約訪準備議題
      if (inputId === 'add-visit-type') {
        toggleAddPreparedIssues(value);
      }

      // 連動轉介紹人姓名輸入框
      if (inputId === 'add-source') {
        toggleReferrerInput(value);
      }
    }

    function toggleReferrerInput(value) {
      const row = document.getElementById('add-referrer-row');
      if (row) {
        row.style.display = value === 'referral' ? 'block' : 'none';
        const input = document.getElementById('add-referrer-name');
        if (input) {
          input.required = (value === 'referral');
        }
      }
    }

    // 從雲端讀取待辦事項，並以雲端為準覆蓋本機（啟動時呼叫一次）
    async function fetchTodosFromCloud() {
      if (!crmSettings || crmSettings.isOffline || !crmSettings.apiUrl) return;
      try {
        const url = crmSettings.apiUrl + (crmSettings.apiUrl.includes('?') ? '&' : '?') + 'type=todos&nocache=true';
        const resp = await fetch(url);
        if (!resp.ok) return;
        const json = await resp.json();
        if (json.status === 'success' && Array.isArray(json.todos)) {
          // 以雲端資料為主，覆蓋本機（空陣列也覆蓋，維持一致性）
          todos = json.todos;
          localStorage.setItem('crm_todos', JSON.stringify(todos));
          debugLog('☁️ 待辦事項已從雲端更新：' + todos.length + ' 筆');
          updateTodoBadge();
          
          // 重新渲染待辦清單分頁
          renderTodoPage();
          renderCases();

          // 重新計算當日提醒參數，若通知看板正在開啟，同步更新看板內容
          const d = new Date();
          const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
          const tw = new Date(utc + 3600000 * 8);
          const todayStr = tw.getFullYear() + '-' + String(tw.getMonth()+1).padStart(2,'0') + '-' + String(tw.getDate()).padStart(2,'0');
          const notifyModal = document.getElementById('todo-notify-modal');
          if (notifyModal && notifyModal.classList.contains('active')) {
            renderTodoNotifyModal(todos.filter(t => !t.done), todayStr);
          }
        }
      } catch(err) {
        debugLog('⚠️ 待辦事項雲端讀取失敗：' + err.message);
      }
    }

    function toggleAddPreparedIssues(value) {
      // 舊的 wrapper 已移除，改為控制第二議題欄位
      const secondRow = document.getElementById('add-second-issue-row');
      const issueLabel = document.querySelector('#add-case-form label[data-issue-label]');
      if (secondRow) {
        secondRow.style.display = value === 'life' ? 'block' : 'none';
      }
      // 若是生活訪，清空第二議題欄位
      if (value !== 'life') {
        const input2 = document.getElementById('add-issue-name-2');
        if (input2) input2.value = '';
      }
    }

    function submitAddCase(event) {
      // 防止 form 原生送出導致頁面重整
      if (event) event.preventDefault();
      const name = document.getElementById('add-client-name').value.trim();
      const issue = document.getElementById('add-issue-name').value.trim();
      if (!name) {
        showToast('請填寫客戶姓名！', 'error');
        return;
      }
      if (!issue) {
        showToast('請填寫議題名稱！', 'error');
        return;
      }

      const visitType = document.getElementById('add-visit-type').value;
      const type = document.getElementById('add-case-type').value;
      const caseSource = document.getElementById('add-case-source').value;
      const source = document.getElementById('add-source').value;
      const referrerName = document.getElementById('add-referrer-name').value.trim();
      const contactDetail = document.getElementById('add-contact-detail').value.trim();

      // 取得第二議題（生活訪專屬）
      const issue2El = document.getElementById('add-issue-name-2');
      const issue2 = issue2El ? issue2El.value.trim() : '';

      const newCase = {
        id: "case-" + Date.now(),
        visitType: visitType,
        preparedIssues: visitType === 'life' ? [issue, issue2].filter(Boolean) : [],
        type: type,
        caseSource: caseSource,
        source: source,
        clientName: name,
        referrerName: source === 'referral' ? referrerName : '',
        contactMethods: ["LINE"],
        contactDetail: contactDetail,
        issueName: issue,
        issueDate: new Date().toISOString().split('T')[0],
        issueNote: "",
        currentPhase: "SA",
        saDetails: {
          sendState: "dim",
          sendDate: "",
          replyState: "dim",
          replyDate: "",
          intentState: "dim",
          intentDate: "",
          agreeState: "dim",
          agreeDate: "",
          meetTimeSlot: ""
        },
        oaDetails: {
          meetDate: "",
          meetState: "",
          meetTimeSlot: "",
          planState: "dim",
          planDate: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: ""
        },
        pcDetails: {
          meetDate: "",
          meetState: "",
          meetTimeSlot: "",
          planState: "dim",
          planDate: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: ""
        },
        cDetails: {
          meetDate: "",
          meetState: "",
          meetTimeSlot: "",
          planState: "dim",
          planDate: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: "",
          planNotes: "",
          discussNotes: "",
          rescheduleHistory: []
        },
        sDetails: {
          meetDate: "",
          meetState: "",
          meetTimeSlot: "",
          planState: "dim",
          planDate: "",
          practiceState: "dim",
          practiceDate: "",
          discussState: "dim",
          discussDate: "",
          planNotes: "",
          discussNotes: ""
        }
      };

      addCase(newCase);
      toggleAddCaseModal(false);
      showToast('成功建立案件！', 'success');

      // 自動開啟新案件的抽屜
      setTimeout(() => {
        openDrawer(newCase.id, 'client');
      }, 300);
    }

    // === Urgency Countdown Badge ===
    function getUrgencyBadge(c) {
      return ''; // 已移除剛幾天功能
    }



    // === 全域變數用以支援日期選擇器 ===
    let currentDatePickerTarget = null;
    let datePickerCurrentDate = new Date();

    // === 實作日期選擇器觸發與定位 ===
    function showCustomDatePicker(element, caseId, field, type) {
      currentDatePickerTarget = { element, caseId, field, type };
      
      const val = element.value;
      if (val) {
        datePickerCurrentDate = new Date(val);
      } else {
        datePickerCurrentDate = new Date();
      }

      let dp = document.getElementById('custom-datepicker');
      if (!dp) {
        dp = document.createElement('div');
        dp.id = 'custom-datepicker';
        dp.className = 'custom-datepicker-container';
        dp.style.position = 'absolute';
        dp.style.zIndex = '9999';
        document.body.appendChild(dp);
        
        // 點擊外面時隱藏日期選擇器
        document.addEventListener('click', (e) => {
          if (!dp.contains(e.target) && (!currentDatePickerTarget || e.target !== currentDatePickerTarget.element)) {
            dp.style.display = 'none';
          }
        });
      }
      
      const rect = element.getBoundingClientRect();
      dp.style.left = `${rect.left + window.scrollX}px`;
      dp.style.top = `${rect.bottom + window.scrollY + 5}px`;
      dp.style.display = 'block';

      renderDatePicker(dp);
    }

    // === 實作常規議題維護 Modal 切換 ===
    function toggleTopicModal(show) {
      const modal = document.getElementById('topic-modal');
      if (modal) {
        if (show) {
          modal.classList.add('active');
          renderModalTopicList();
        } else {
          modal.classList.remove('active');
        }
      }
    }

    // === 實作基本屬性與各階段欄位更新 ===
    function updateCaseField(caseId, field, value) {
      const isNote = field === 'note' || field === 'issueNote' || field === 'remark';
      updateCase(caseId, c => {
        c[field] = value;
      }, isNote);
    }

    function updateSADate(caseId, field, value) {
      const isNote = field.endsWith('Notes') || field.endsWith('Note') || field === 'notes';
      updateCase(caseId, c => {
        if (!c.saDetails) c.saDetails = {};
        c.saDetails[field] = value;
      }, isNote);
    }

    // 連動 OA 欄位變更與抽屜渲染
    function updateOAField(caseId, field, value) {
      const isNote = field.endsWith('Notes') || field.endsWith('Note');
      const isStateOrSlot = field === 'meetState' || field === 'meetTimeSlot';
      updateCase(caseId, c => {
        if (!c.oaDetails) c.oaDetails = {};
        if (!c.saDetails) c.saDetails = {};
        if (field === 'meetState') {
          const targetValue = (c.oaDetails.meetState === value) ? '' : value;
          c.oaDetails.meetState = targetValue;
          if (targetValue === '') {
            // 完全清空：OA 時間清除，SA 亮燈同步還原
            c.oaDetails.meetDate = '';
            c.saDetails.agreeState = 'dim';
            c.saDetails.agreeDate = '';
          } else if (targetValue === 'confirmed') {
            // 時間已確定：同步點亮 SA「已約定」
            c.saDetails.agreeState = 'active';
            if (!c.saDetails.agreeDate) {
              c.saDetails.agreeDate = new Date().toISOString().split('T')[0];
            }
          } else if (targetValue === 'pending') {
            // 喬時間中：SA「已約定」退回暗燈，並將意願狀態設為 intent-pending，以使 SA 第三燈同步轉為「喬時間」
            c.saDetails.agreeState = 'dim';
            c.saDetails.intentState = 'intent-pending';
            c.saDetails.agreeDate = '';
          }
        } else {
          c.oaDetails[field] = value;
          
          const subTagFields = ['planDate', 'practiceDate', 'discussDate'];
          if (subTagFields.includes(field)) {
            const stateKey = field.replace('Date', 'State');
            if (value === '') {
              c.oaDetails[stateKey] = 'dim';
            } else {
              if (c.oaDetails[stateKey] !== 'active') {
                c.oaDetails[stateKey] = 'ongoing';
              }
            }
          }
        }
        if (field === 'meetDate') {
          // 直接在 OA 抽屜設定會面日期時，自動推進狀態並同步 SA
          if (value) {
            c.oaDetails.meetState = 'confirmed';
            c.saDetails.agreeState = 'active';
            if (!c.saDetails.agreeDate) {
              c.saDetails.agreeDate = new Date().toISOString().split('T')[0];
            }
          } else {
            c.oaDetails.meetState = '';
            c.saDetails.agreeState = 'dim';
            c.saDetails.agreeDate = '';
          }
        }
      }, isNote);
      if (!isNote && !isStateOrSlot) {
        const c = cases.find(item => item.id === caseId);
        const drawerContent = document.getElementById(`drawer-content-${caseId}`);
        if (drawerContent) {
          renderOADrawer(c, drawerContent);
        }
      } else if (isStateOrSlot) {
        saveCasesToStorage();
        const drawerRow = document.getElementById(`drawer-row-${caseId}`);
        if (drawerRow && drawerRow.style.display === 'block') {
          const activeSection = drawerRow.dataset.activeSection || 'OA';
          const c = cases.find(item => item.id === caseId);
          refreshDrawerContent(caseId, activeSection, c);
        }
      }
    }

    // === 實作抽屜內部子任務勾選狀態切換 ===
    function toggleOAPrepState(caseId, stateKey) {
      updateCase(caseId, c => {
        if (!c.oaDetails) c.oaDetails = {};
        const isCurrentlyActive = c.oaDetails[stateKey] === 'active';
        c.oaDetails[stateKey] = isCurrentlyActive ? 'dim' : 'active';
        const dateKey = stateKey.replace('State', 'Date');
        c.oaDetails[dateKey] = isCurrentlyActive ? '' : new Date().toISOString().split('T')[0];
      });
      const c = cases.find(item => item.id === caseId);
      const drawerContent = document.getElementById(`drawer-content-${caseId}`);
      if (drawerContent) renderOADrawer(c, drawerContent);
    }

    let cBtnClickTimeout = null;

    // 抽屜按鈕單擊事件：標記為「進行中」並自動開啟日曆
    function handleCBtnClick(caseId, stateKey, phase) {
      if (cBtnClickTimeout) {
        clearTimeout(cBtnClickTimeout);
        cBtnClickTimeout = null;
      }
      
      cBtnClickTimeout = setTimeout(() => {
        const c = cases.find(item => item.id === caseId);
        if (!c) return;
        
        const details = phase === 'oa' ? c.oaDetails :
                        phase === 'pc' ? c.pcDetails :
                        phase === 'c' ? c.cDetails : c.sDetails;
        if (!details) return;
        
        const cur = details[stateKey] || 'dim';
        if (cur === 'dim') {
          details[stateKey] = 'ongoing';
        }
        
        // 局部刷新抽屜 UI，讓呼吸燈立刻亮起，不發送全域重繪與 API
        const drawerContent = document.getElementById(`drawer-content-${caseId}`);
        if (drawerContent) {
          if (phase === 'oa') renderOADrawer(c, drawerContent);
          else if (phase === 'pc') renderPCDrawer(c, drawerContent);
          else if (phase === 'c') renderCDrawer(c, drawerContent);
          else if (phase === 's') renderSDrawer(c, drawerContent);
        }
        
        // 緊接著開啟日曆選擇器
        setTimeout(() => {
          const dateInput = document.getElementById(`date-input-${caseId}-${stateKey}`);
          if (dateInput) {
            dateInput.click();
          }
        }, 80);

        cBtnClickTimeout = null;
      }, 250);
    }

    // 抽屜按鈕雙擊事件：標記為「已完成」或重置為「未開始」
    function handleCBtnDblClick(caseId, stateKey, phase) {
      if (cBtnClickTimeout) {
        clearTimeout(cBtnClickTimeout);
        cBtnClickTimeout = null;
      }
      
      updateCase(caseId, c => {
        const details = phase === 'oa' ? c.oaDetails :
                        phase === 'pc' ? c.pcDetails :
                        phase === 'c' ? c.cDetails : c.sDetails;
        if (!details) return;
        
        const cur = details[stateKey] || 'dim';
        const dateKey = stateKey.replace('State', 'Date');
        
        if (cur === 'active') {
          details[stateKey] = 'dim';
          details[dateKey] = '';
        } else {
          details[stateKey] = 'active';
          // 優先保留原本已選定的約定討論/演練日期，若沒有才預設填入今天
          details[dateKey] = details[dateKey] || new Date().toISOString().split('T')[0];
        }
      });
      
      const c = cases.find(item => item.id === caseId);
      const drawerContent = document.getElementById(`drawer-content-${caseId}`);
      if (drawerContent) {
        if (phase === 'oa') renderOADrawer(c, drawerContent);
        else if (phase === 'pc') renderPCDrawer(c, drawerContent);
        else if (phase === 'c') renderCDrawer(c, drawerContent);
        else if (phase === 's') renderSDrawer(c, drawerContent);
      }
    }

    // === 實作議題自動完成下拉選單 ===
    function showTopicAutocomplete(caseId, val) {
      const dropdown = document.getElementById(`dropdown-${caseId}`);
      if (!dropdown) return;
      
      const valLower = val.trim().toLowerCase();
      const customIssues = getCustomIssues().map(i => i.name);
      const matches = valLower === '' ? customIssues : customIssues.filter(t => t.toLowerCase().includes(valLower));
      
      if (matches.length === 0) {
        dropdown.style.display = 'none';
        return;
      }
      
      dropdown.innerHTML = matches.map(t => {
        return `<div class="autocomplete-item" onclick="selectTopic('${caseId}', '${t.replace(/'/g, "\\\\'")}')">${t}</div>`;
      }).join('');
      dropdown.style.display = 'block';
    }

    function selectTopic(caseId, topic) {
      const input = document.getElementById(`input-issue-name-${caseId}`);
      if (input) {
        input.value = topic;
      }
      updateCaseField(caseId, 'issueName', topic);
      const dropdown = document.getElementById(`dropdown-${caseId}`);
      if (dropdown) dropdown.style.display = 'none';
    }

    // 點擊外面時隱藏議題自動完成選單
    document.addEventListener('click', (e) => {
      if (!e.target.classList.contains('autocomplete-item') && !e.target.closest('.autocomplete-wrapper')) {
        document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.style.display = 'none');
      }
    });

    // === 實作 SA 節點子標籤的直接點擊切換邏輯與事件阻斷 ===
    function toggleSASendDirect(caseId, event) {
      if (event) event.stopPropagation();
      const c = cases.find(item => item.id === caseId);
      if (!c) return;

      const isCurrentlyActive = (c.saDetails && c.saDetails.sendState === 'active');
      
      if (!isCurrentlyActive) {
        // 未亮燈 (未發出) -> 亮燈 (已發出)：單擊即可推進
        updateCase(caseId, item => {
          if (!item.saDetails) item.saDetails = {};
          item.saDetails.sendState = 'active';
          if (!item.saDetails.sendDate) {
            item.saDetails.sendDate = new Date().toISOString().split('T')[0];
          }
        });
      } else {
        // 已亮燈 (已發出)：雙擊防呆才還原 (未發出)
        if (event && event.detail >= 2) {
          updateCase(caseId, item => {
            if (!item.saDetails) item.saDetails = {};
            item.saDetails.sendState = 'dim';
            item.saDetails.sendDate = '';
          });
        }
      }
    }

    function cycleSAReplyDirect(caseId, event) {
      if (event) event.stopPropagation();
      const c = cases.find(item => item.id === caseId);
      if (!c) return;

      const isCurrentlyActive = (c.saDetails && c.saDetails.replyState === 'active');
      
      if (!isCurrentlyActive) {
        // 未亮燈 (未回覆) -> 亮燈第一個狀態 (互動中)：單擊即可推進
        updateCase(caseId, item => {
          if (!item.saDetails) item.saDetails = {};
          item.saDetails.replyState = 'active';
          item.saDetails.intentState = 'intent-pending';
          if (!item.saDetails.replyDate) {
            item.saDetails.replyDate = new Date().toISOString().split('T')[0];
          }
        });
      } else {
        // 已亮燈 (互動中 或 無意願)：雙擊防呆才切換下個狀態或還原
        if (event && event.detail >= 2) {
          updateCase(caseId, item => {
            if (!item.saDetails) item.saDetails = {};
            const currentIntent = item.saDetails.intentState || '';
            if (currentIntent === 'intent-pending') {
              // 互動中 -> 無意願
              item.saDetails.intentState = 'intent-no';
            } else {
              // 無意願 -> 未回覆 (還原)
              item.saDetails.replyState = 'dim';
              item.saDetails.intentState = '';
              item.saDetails.replyDate = '';
            }
          });
        }
      }
    }

    let agreeClickTimer = null;

    function toggleSAAgreeDirect(caseId, event) {
      if (event) event.stopPropagation();
      
      // 如果已經有定時器，代表這是雙擊事件！
      if (agreeClickTimer) {
        clearTimeout(agreeClickTimer);
        agreeClickTimer = null;
        
        updateCase(caseId, item => {
          if (!item.saDetails) item.saDetails = {};
          if (!item.oaDetails) item.oaDetails = {};
          
          const currentMeetPending = item.oaDetails.meetState === 'pending' || item.saDetails.intentState === 'intent-pending';
          const currentAgreeHold = item.saDetails.intentState === 'intent-hold';
          const currentAgreeActive = item.saDetails.agreeState === 'active';

          if (currentMeetPending && !currentAgreeHold && !currentAgreeActive) {
            // 1. 喬時間 -> 擱置中
            item.saDetails.agreeState = 'dim';
            item.saDetails.intentState = 'intent-hold';
            item.saDetails.agreeDate = '';
            item.oaDetails.meetState = ''; // 移出喬時間狀態
            item.oaDetails.meetDate = '';
          } else if (currentAgreeHold) {
            // 2. 擱置中 -> 已約定
            item.saDetails.agreeState = 'active';
            item.saDetails.intentState = 'intent-yes';
            item.saDetails.agreeDate = new Date().toISOString().split('T')[0];
            item.oaDetails.meetState = 'confirmed';
            if (!item.oaDetails.meetDate) {
              item.oaDetails.meetDate = new Date().toISOString().split('T')[0];
            }
          } else {
            // 3. 已約定 -> 未約定 (還原)
            item.saDetails.agreeState = 'dim';
            item.saDetails.intentState = 'dim';
            item.saDetails.agreeDate = '';
            item.oaDetails.meetState = '';
            item.oaDetails.meetDate = '';
          }
        });
        return;
      }

      // 否則，這是一次單擊，我們等待 250 毫秒看看是否有雙擊
      agreeClickTimer = setTimeout(() => {
        agreeClickTimer = null;
        
        const c = cases.find(item => item.id === caseId);
        if (!c) return;
        
        const isAgreeActive = (c.saDetails && c.saDetails.agreeState === 'active');
        const isAgreeHold = (c.saDetails && c.saDetails.intentState === 'intent-hold');
        const isMeetPending = (c.oaDetails && c.oaDetails.meetState === 'pending') || (c.saDetails && c.saDetails.intentState === 'intent-pending');

        if (!isAgreeActive && !isAgreeHold && !isMeetPending) {
          // 未約定 -> 喬時間 (單擊推進)
          updateCase(caseId, item => {
            if (!item.saDetails) item.saDetails = {};
            if (!item.oaDetails) item.oaDetails = {};
            item.saDetails.agreeState = 'dim';
            item.saDetails.intentState = 'intent-pending';
            item.oaDetails.meetState = 'pending';
            item.saDetails.agreeDate = '';
          });
        }
        
        // 彈出抽屜
        openDrawer(caseId, 'SA');
      }, 250);
    }


    // === 單擊與雙擊防呆調度器 ===
    let clickTimer = null;
    function onNodeClick(event, caseId, phase) {
      event.stopPropagation();
      // Tablet Fix: 觸控裝置偵測，稍微拉長雙擊判定間隔至 300ms 以配合觸控動作，一般滑鼠則維持 220ms
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const delay = isTouch ? 300 : 220;

      if (clickTimer) {
        // 雙擊事件
        clearTimeout(clickTimer);
        clickTimer = null;
        changePhaseDirect(caseId, phase);
      } else {
        // 單擊事件
        clickTimer = setTimeout(() => {
          clickTimer = null;
          openDrawer(caseId, phase);
        }, delay);
      }
    }

    // ===================================================
    // ===== 待辦事項管理系統 (Todo Task Manager) =========
    // ===================================================

    // --- 次標籤選項對應表 ---
    const TODO_SUBTAG_MAP = {
      SA: [
        { value: 'sa_visit',   label: '約訪準備' },
        { value: 'sa_collect', label: '資料蒐集' },
        { value: 'sa_contact', label: '接觸聯繫' },
      ],
      OA: [
        { value: 'oa_visit',   label: '初訪拜訪' },
        { value: 'oa_needs',   label: '需求分析' },
        { value: 'oa_discuss', label: '訪後討論' },
      ],
      PC: [
        { value: 'pc_plan',    label: '計畫說明' },
        { value: 'pc_sign',    label: '要保簽署' },
        { value: 'pc_discuss', label: '訪後討論' },
      ],
      C: [
        { value: 'c_plan',    label: '文件準備' },
        { value: 'c_sign',    label: '簽約' },
        { value: 'c_remedy',  label: '補件' },
        { value: 'c_submit',  label: '送件' },
        { value: 'c_insure',  label: '要保簽署' },
        { value: 'c_premium', label: '保費首扣' },
      ],
      S: [
        { value: 's_service', label: '服務維繫' },
        { value: 's_review',  label: '年度回顧' },
        { value: 's_refer',   label: '轉介紹跟進' },
      ],
    };

    // --- 資料存取 ---
    let todos = [];

    function loadTodos() {
      try {
        const raw = localStorage.getItem('crm_todos');
        todos = raw ? JSON.parse(raw) : [];
      } catch(e) {
        todos = [];
      }
    }

    function saveTodos() {
      localStorage.setItem('crm_todos', JSON.stringify(todos));
      // 若有雲端 API，非同步同步至 Google Sheet
      syncTodosToCloud();
    }



    // 將整份 todos 同步覆蓋寫入 Google Sheet（非同步，不阻塞 UI）
    async function syncTodosToCloud() {
      if (!crmSettings || crmSettings.isOffline || !crmSettings.apiUrl) return;
      try {
        await fetch(crmSettings.apiUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'saveTodos', todos: todos }),
        });
        debugLog('☁️ 待辦事項已同步至雲端：' + todos.length + ' 筆');
      } catch(err) {
        debugLog('⚠️ 待辦事項雲端同步失敗：' + err.message);
      }
    }

    function genTodoId() {
      return 'todo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    // --- 頁面切換 ---
    function toggleTodoPage() {
      const page = document.getElementById('todo-page');
      if (!page) return;
      const isActive = page.classList.contains('active');
      if (isActive) {
        page.classList.remove('active');
      } else {
        loadTodos();
        renderTodoPage();
        page.classList.add('active');
        // 關閉送件提醒 Modal（若開著）
        const reminderModal = document.getElementById('reminder-modal');
        if (reminderModal && reminderModal.classList.contains('active')) {
          reminderModal.classList.remove('active');
        }
      }
    }

    // --- 渲染待辦頁面 ---
    function renderTodoPage() {
      const body = document.getElementById('todo-body');
      if (!body) return;

      // 取得今日字串
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const tw = new Date(utc + 3600000 * 8);
      const todayStr = tw.getFullYear() + '-' +
        String(tw.getMonth() + 1).padStart(2, '0') + '-' +
        String(tw.getDate()).padStart(2, '0');

      if (todos.length === 0) {
        body.innerHTML = `<div class="todo-empty-state">🎉 目前沒有任何待辦事項！<br><span style="font-size:0.75rem; margin-top:8px; display:block;">點擊「＋ 新增待辦」建立第一筆任務</span></div>`;
        return;
      }

      const pending = todos.filter(t => !t.done);
      const done    = todos.filter(t =>  t.done);

      // 優先度排序輔助：Q1(1) -> Q2(2) -> Q3(3) -> Q4(4) -> 未分類(5)
      const getTodoWeight = (t) => {
        const meta = getPriorityMeta(t.urgent, t.important);
        if (!meta) return 5;
        return meta.q;
      };

      // 排序未完成待辦：優先度優先，再依到期日排序（無日期排同級最後）
      pending.sort((a, b) => {
        const wA = getTodoWeight(a);
        const wB = getTodoWeight(b);
        if (wA !== wB) return wA - wB;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });

      // 已完成待辦依最後更新或建立時間排序即可
      done.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      // 分組顯示未完成待辦
      const overdue = pending.filter(t => t.dueDate && t.dueDate < todayStr);
      const activeTodos = pending.filter(t => !t.dueDate || t.dueDate >= todayStr);

      let html = '';

      if (overdue.length > 0) {
        html += `<div class="todo-section-label" style="color:#f87171; border-color: rgba(239,68,68,0.3);">⚠ 已逾期 (${overdue.length})</div>`;
        html += overdue.map(t => renderTodoCard(t, todayStr)).join('');
      }
      if (activeTodos.length > 0) {
        html += `<div class="todo-section-label">📋 進行中 (${activeTodos.length})</div>`;
        html += activeTodos.map(t => renderTodoCard(t, todayStr)).join('');
      }
      if (done.length > 0) {
        html += `<div class="todo-section-label" style="margin-top: 16px;">✓ 已完成 (${done.length})</div>`;
        html += done.map(t => renderTodoCard(t, todayStr)).join('');
      }

      body.innerHTML = html;
    }

    function renderTodoCard(t, todayStr) {
      // 找案件名稱
      let caseName = '';
      if (t.caseId && window.cases) {
        const c = window.cases.find(x => x.id === t.caseId);
        caseName = c ? c.clientName : '';
      }

      // 次標籤顯示
      let subTagLabel = '';
      if (t.stage && t.subTag && TODO_SUBTAG_MAP[t.stage]) {
        const sub = TODO_SUBTAG_MAP[t.stage].find(x => x.value === t.subTag);
        subTagLabel = sub ? sub.label : t.subTag;
      }

      // 到期日顯示
      let dueHtml = '';
      if (t.dueDate) {
        let cls = 'todo-due';
        let label = '到期：' + t.dueDate;
        if (!t.done) {
          if (t.dueDate < todayStr)       { cls += ' overdue'; label = '⚠ 逾期：' + t.dueDate; }
          else if (t.dueDate === todayStr) { cls += ' today';   label = '🔔 今日：' + t.dueDate; }
        }
        dueHtml = `<span class="${cls}">${label}</span>`;
      }

      // 優先度標籤
      let priorityHtml = '';
      const pMeta = getPriorityMeta(t.urgent, t.important);
      if (pMeta) {
        priorityHtml = `<span class="priority-badge ${pMeta.class}" title="${pMeta.title}">${pMeta.label}</span>`;
      }

      // 累計時間小標籤
      let timeSpentHtml = '';
      if (t.totalTimeSpent && parseInt(t.totalTimeSpent, 10) > 0) {
        timeSpentHtml = `<span class="todo-meta-tag" style="background: rgba(16, 185, 129, 0.08); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); font-family: monospace;">⏱️ ${formatSecondsToShortTime(t.totalTimeSpent)}</span>`;
      }

      const stageLabel = t.stage ? `<span class="todo-meta-tag stage-tag">${t.stage}</span>` : '';
      const caseTag    = caseName ? `<span class="todo-meta-tag case-tag">${caseName}</span>` : '';
      const subTagHtml = subTagLabel ? `<span class="todo-meta-tag subtag-tag">${subTagLabel}</span>` : '';
      const noteHtml   = t.note ? `<div class="todo-note">${t.note}</div>` : '';
      const checkIcon  = t.done ? '✓' : '';
      const doneClass  = t.done ? ' done' : '';

      return `<div class="todo-card${doneClass}" id="todo-card-${t.id}" ondblclick="openTodoTimerModal('${t.id}')" style="cursor:pointer; display:flex; align-items:center; justify-content:flex-start; text-align:left;" title="雙擊開啟計時面板與歷史紀錄">
        <div class="todo-check" ondblclick="event.stopPropagation(); toggleTodoDone('${t.id}')" title="雙擊切換完成狀態">${checkIcon}</div>
        <div class="todo-info" style="display:flex; align-items:center; justify-content:flex-start; text-align:left; gap:8px; flex-wrap:nowrap; flex:1; min-width:0; overflow:hidden;">
          <div class="todo-title" style="font-weight:bold; font-size:0.85rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px; margin:0; flex-shrink:0; text-align:left;">${t.title}</div>
          ${priorityHtml ? `<div style="flex-shrink:0; display:flex; justify-content:flex-start; align-items:center;">${priorityHtml}</div>` : ''}
          <div class="todo-meta" style="margin:0; display:flex; align-items:center; justify-content:flex-start; gap:6px; flex-wrap:nowrap; white-space:nowrap; flex-shrink:0;">${caseTag}${stageLabel}${subTagHtml}${timeSpentHtml}${dueHtml}</div>
          ${t.note ? `<span style="font-size:0.72rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; margin-left:4px; flex-shrink:1; text-align:left;" title="${t.note}">(${t.note})</span>` : ''}
        </div>
        <div class="todo-actions" style="margin-left:auto; flex-shrink:0; display:flex; align-items:center; gap:6px;">
          <button class="todo-action-btn" onclick="openTodoModal('${t.id}')" title="編輯">✏</button>
          <button class="todo-action-btn del" ondblclick="deleteTodo('${t.id}')" title="雙擊刪除">🗑</button>
        </div>
      </div>`;
    }

    // --- CRUD ---
    function toggleTodoDone(id) {
      const t = todos.find(x => x.id === id);
      if (!t) return;
      t.done = !t.done;
      saveTodos();
      // 微動畫
      const card = document.getElementById('todo-card-' + id);
      if (card) {
        card.style.transition = 'all 0.2s';
        card.style.transform = 'scale(0.97)';
        setTimeout(() => {
          card.style.transform = '';
          renderTodoPage();
          updateTodoBadge();
        }, 200);
      } else {
        renderTodoPage();
        updateTodoBadge();
      }
    }

    function deleteTodo(id) {
      const idx = todos.findIndex(x => x.id === id);
      if (idx === -1) return;
      const card = document.getElementById('todo-card-' + id);
      if (card) {
        card.style.transition = 'all 0.25s';
        card.style.transform = 'translateX(30px)';
        card.style.opacity = '0';
        setTimeout(() => {
          todos.splice(idx, 1);
          saveTodos();
          renderTodoPage();
          updateTodoBadge();
        }, 250);
      } else {
        todos.splice(idx, 1);
        saveTodos();
        renderTodoPage();
        updateTodoBadge();
      }
    }

    // 優先級選擇輔助
    function selectPriorityCell(cell, urgent, important) {
      // 清除同層選取狀態
      const cells = document.querySelectorAll('.priority-cell');
      cells.forEach(c => c.classList.remove('active'));

      const inputUrgent = document.getElementById('todo-input-urgent');
      const inputImportant = document.getElementById('todo-input-important');

      // 若點擊的是已經選取的，則取消選取 (留白分類)
      if (cell.dataset.active === 'true') {
        cells.forEach(c => c.dataset.active = 'false');
        inputUrgent.value = '';
        inputImportant.value = '';
      } else {
        cells.forEach(c => c.dataset.active = 'false');
        cell.classList.add('active');
        cell.dataset.active = 'true';
        inputUrgent.value = urgent ? 'true' : 'false';
        inputImportant.value = important ? 'true' : 'false';
      }
    }

    function getPriorityMeta(urgent, important) {
      if (urgent === true && important === true) return { q: 1, label: '🔴 緊急重要', color: '#ef4444', class: 'q1', title: '緊急且重要' };
      if (urgent === true && important === false) return { q: 2, label: '🟠 緊急', color: '#f97316', class: 'q2', title: '緊急但重要性低' };
      if (urgent === false && important === true) return { q: 3, label: '🟡 重要', color: '#eab308', class: 'q3', title: '重要但不緊急' };
      if (urgent === false && important === false) return { q: 4, label: '⚪ 一般', color: '#9ca3af', class: 'q4', title: '不緊急且不重要' };
      return null; // 未分類
    }

    // --- Modal ---
    let todoModalCallback = null;
    function openTodoModal(editId, prefillCaseId, callback) {
      const modal = document.getElementById('add-todo-modal');
      const titleEl = document.getElementById('todo-modal-title');
      if (!modal) return;
      todoModalCallback = callback || null;

      // 清除優先度選取狀態
      const cells = document.querySelectorAll('.priority-cell');
      cells.forEach(c => {
        c.classList.remove('active');
        c.dataset.active = 'false';
      });
      document.getElementById('todo-input-urgent').value = '';
      document.getElementById('todo-input-important').value = '';

      // 填充案件下拉
      const caseSelect = document.getElementById('todo-input-case');
      if (caseSelect && typeof cases !== 'undefined') {
        // 過濾未封存案件 (isArchived 為 true 代表已封存，因此用 !c.isArchived)
        const activeCases = cases.filter(c => !c.isArchived);
        
        // 主要排序：客戶姓名，次要排序：議題名稱
        activeCases.sort((a, b) => {
          const nameA = a.clientName || '';
          const nameB = b.clientName || '';
          const cmp = nameA.localeCompare(nameB, 'zh-Hant');
          if (cmp !== 0) return cmp;
          const issueA = a.issueName || '';
          const issueB = b.issueName || '';
          return issueA.localeCompare(issueB, 'zh-Hant');
        });

        caseSelect.innerHTML = '<option value="">— 不指定案件 —</option>' +
          activeCases.map(c => {
            const client = c.clientName || '未知客戶';
            const issue = c.issueName ? ` ｜ 議題: ${c.issueName}` : '';
            return `<option value="${c.id}">👤 客戶: ${client}${issue}</option>`;
          }).join('');
      }

      if (editId) {
        const t = todos.find(x => x.id === editId);
        if (!t) return;
        titleEl.textContent = '編輯待辦事項';
        document.getElementById('todo-edit-id').value = t.id;
        document.getElementById('todo-input-title').value = t.title || '';
        document.getElementById('todo-input-case').value  = t.caseId || '';
        document.getElementById('todo-input-stage').value = t.stage  || '';
        document.getElementById('todo-input-due').value   = t.dueDate || '';
        document.getElementById('todo-input-note').value  = t.note   || '';
        
        // 設定優先度 active 狀態
        if (t.urgent !== undefined && t.important !== undefined) {
          const uVal = t.urgent === true || t.urgent === 'true';
          const iVal = t.important === true || t.important === 'true';
          document.getElementById('todo-input-urgent').value = uVal ? 'true' : 'false';
          document.getElementById('todo-input-important').value = iVal ? 'true' : 'false';
          let qIdx = 4;
          if (uVal && iVal) qIdx = 1;
          else if (uVal && !iVal) qIdx = 2;
          else if (!uVal && iVal) qIdx = 3;
          
          const cell = document.querySelector(`.priority-cell[data-q="${qIdx}"]`);
          if (cell) {
            cell.classList.add('active');
            cell.dataset.active = 'true';
          }
        }

        onTodoStageChange();
        setTimeout(() => { document.getElementById('todo-input-subtag').value = t.subTag || ''; }, 0);
      } else {
        titleEl.textContent = '新增待辦事項';
        document.getElementById('todo-edit-id').value = '';
        document.getElementById('todo-input-title').value = '';
        document.getElementById('todo-input-case').value  = prefillCaseId || '';
        document.getElementById('todo-input-stage').value = '';
        document.getElementById('todo-input-subtag').innerHTML = '<option value="">— 不指定次標籤 —</option>';
        document.getElementById('todo-input-due').value   = '';
        document.getElementById('todo-input-note').value  = '';
      }

      modal.classList.add('active');
      setTimeout(() => { document.getElementById('todo-input-title').focus(); }, 80);
    }

    function closeTodoModal() {
      const modal = document.getElementById('add-todo-modal');
      if (modal) modal.classList.remove('active');
      if (todoModalCallback) {
        const cb = todoModalCallback;
        todoModalCallback = null;
        cb();
      }
    }

    function onTodoStageChange() {
      const stage = document.getElementById('todo-input-stage').value;
      const subtagSelect = document.getElementById('todo-input-subtag');
      if (!subtagSelect) return;
      const options = TODO_SUBTAG_MAP[stage] || [];
      subtagSelect.innerHTML = '<option value="">— 不指定次標籤 —</option>' +
        options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    }

    function saveTodo() {
      const title = (document.getElementById('todo-input-title').value || '').trim();
      if (!title) {
        document.getElementById('todo-input-title').style.borderColor = '#f87171';
        document.getElementById('todo-input-title').focus();
        return;
      }
      document.getElementById('todo-input-title').style.borderColor = '';

      const editId  = document.getElementById('todo-edit-id').value;
      const caseId  = document.getElementById('todo-input-case').value;
      const stage   = document.getElementById('todo-input-stage').value;
      const subTag  = document.getElementById('todo-input-subtag').value;
      const dueDate = document.getElementById('todo-input-due').value;
      const note    = (document.getElementById('todo-input-note').value || '').trim();
      
      const urgentVal = document.getElementById('todo-input-urgent').value;
      const importantVal = document.getElementById('todo-input-important').value;
      const urgent = urgentVal === '' ? undefined : urgentVal === 'true';
      const important = importantVal === '' ? undefined : importantVal === 'true';

      if (editId) {
        const t = todos.find(x => x.id === editId);
        if (t) { 
          t.title = title; 
          t.caseId = caseId; 
          t.stage = stage; 
          t.subTag = subTag; 
          t.dueDate = dueDate; 
          t.note = note;
          t.urgent = urgent;
          t.important = important;
        }
      } else {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const tw = new Date(utc + 3600000 * 8);
        const createdAt = tw.getFullYear() + '-' + String(tw.getMonth()+1).padStart(2,'0') + '-' + String(tw.getDate()).padStart(2,'0');
        todos.unshift({ id: genTodoId(), title, caseId, stage, subTag, dueDate, note, done: false, createdAt, urgent, important });
      }

      saveTodos();
      closeTodoModal(); // 這會自動觸發 todoModalCallback
      renderTodoPage();
      updateTodoBadge();
    }

    // --- 頂部角標更新 ---
    function updateTodoBadge() {
      const badge = document.getElementById('todo-global-badge');
      if (!badge) return;
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const tw = new Date(utc + 3600000 * 8);
      const todayStr = tw.getFullYear() + '-' + String(tw.getMonth()+1).padStart(2,'0') + '-' + String(tw.getDate()).padStart(2,'0');
      const urgentCount = todos.filter(t => !t.done && t.dueDate && t.dueDate <= todayStr).length;
      if (urgentCount > 0) {
        badge.textContent = urgentCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // ==========================================
    // === 待辦事項計時器模組 (Time Tracker) ===
    // ==========================================
    let activeTodoTimer = {
      todoId: null,
      seconds: 0,
      intervalId: null,
      isPaused: false,
      startTime: null,
      isPomodoro: false,
      pomodoroRemaining: 1500
    };

    // 格式化秒數為番茄鐘格式 MM:SS
    function formatPomodoroTime(totalSeconds) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // 格式化秒數為碼表格式 00:00:00
    function formatSecondsToClock(totalSeconds) {
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // 格式化秒數為累計易讀格式 (如：1小時20分10秒)
    function formatSecondsToShortTime(totalSeconds) {
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      let result = '';
      if (hrs > 0) result += `${hrs} 小時 `;
      if (mins > 0 || hrs > 0) result += `${mins} 分 `;
      result += `${secs} 秒`;
      return result;
    }

    // 無條件重設所有計時器按鈕與顯示 UI 到初始狀態
    function resetTimerButtonsUI() {
      // 1. 碼錶數字與狀態
      if (activeTodoTimer.isPomodoro) {
        document.getElementById('timer-clock-display').textContent = formatPomodoroTime(activeTodoTimer.pomodoroRemaining);
        document.getElementById('timer-clock-display').className = 'timer-display pomodoro';
      } else {
        document.getElementById('timer-clock-display').textContent = '00:00:00';
        document.getElementById('timer-clock-display').className = 'timer-display';
      }
      
      // 2. 開始按鈕啟用
      document.getElementById('btn-timer-start').disabled = false;
      
      // 3. 暫停按鈕還原為「暫停計時」與黃色樣式，並禁用
      const pauseBtn = document.getElementById('btn-timer-pause');
      pauseBtn.disabled = true;
      pauseBtn.textContent = '暫停計時';
      pauseBtn.style.color = '#f59e0b';
      pauseBtn.style.borderColor = '#f59e0b';
      pauseBtn.style.background = 'rgba(245, 158, 11, 0.1)';
      
      // 4. 結束按鈕禁用
      document.getElementById('btn-timer-stop').disabled = true;
      
      // 5. 當次備忘清空
      document.getElementById('timer-current-note').value = '';
      
      // 6. 重置番茄鐘按鈕啟用
      const pomoBtn = document.getElementById('btn-timer-pomodoro');
      if (pomoBtn) {
        pomoBtn.disabled = false;
        pomoBtn.textContent = '🍅 啟動番茄專注 (25分鐘)';
        pomoBtn.style.background = 'rgba(239, 68, 68, 0.15)';
        pomoBtn.style.borderColor = '#ef4444';
        pomoBtn.style.color = '#f87171';
      }
    }

    // 開啟待辦計時 Modal
    function openTodoTimerModal(todoId) {
      // 防呆：如果原本就有其他任務正在計時，警告使用者
      if (activeTodoTimer.todoId && activeTodoTimer.todoId !== todoId && activeTodoTimer.intervalId) {
        alert('目前已有另一個待辦事項正在計時中，請先結束該任務計時！');
        return;
      }

      const t = todos.find(x => x.id === todoId);
      if (!t) return;

      activeTodoTimer.todoId = todoId;
      activeTodoTimer.isPomodoro = false;
      activeTodoTimer.pomodoroRemaining = 1500;
      
      // 更新標題與關聯資訊
      document.getElementById('timer-todo-title').textContent = `🎯 ${t.title}`;
      let caseName = '無關聯客戶';
      if (t.caseId && window.cases) {
        const c = window.cases.find(x => x.id === t.caseId);
        if (c) caseName = `👤 客戶: ${c.clientName}`;
      }
      const stageLabel = t.stage ? ` ｜ 階段: ${t.stage}` : '';
      document.getElementById('timer-todo-meta').textContent = `${caseName}${stageLabel}`;

      // 初始化當次計時顯示
      if (!activeTodoTimer.intervalId) {
        resetTimerButtonsUI();
      } else {
        // 若此任務本來就在計時中，維持畫面按鈕與發光狀態
        document.getElementById('timer-clock-display').className = 'timer-display running';
        document.getElementById('btn-timer-start').disabled = true;
        document.getElementById('btn-timer-pause').disabled = false;
        document.getElementById('btn-timer-stop').disabled = false;
      }

      // 渲染累計時間與歷史紀錄
      renderTimerHistory(t);

      // 開啟 Modal
      document.getElementById('todo-timer-modal').classList.add('active');
    }

    // 關閉待辦計時 Modal (防呆版)
    function closeTodoTimerModal() {
      // 如果還在計時中（定時器還在跑），禁止關閉面板
      if (activeTodoTimer.intervalId) {
        alert('⚠️ 尚未結束當次！請先結束當次計時後再關閉面板。');
        return;
      }
      document.getElementById('todo-timer-modal').classList.remove('active');
    }

    // 開始計時
    function startTodoTimer() {
      if (activeTodoTimer.intervalId && !activeTodoTimer.isPaused) return;

      activeTodoTimer.isPaused = false;
      activeTodoTimer.startTime = activeTodoTimer.startTime || new Date();
      
      const displayEl = document.getElementById('timer-clock-display');
      displayEl.className = 'timer-display running' + (activeTodoTimer.isPomodoro ? ' pomodoro' : '');

      document.getElementById('btn-timer-start').disabled = true;
      const pomoBtn = document.getElementById('btn-timer-pomodoro');
      if (pomoBtn) {
        pomoBtn.disabled = true;
        pomoBtn.textContent = '🍅 番茄專注倒數中...';
      }

      document.getElementById('btn-timer-pause').disabled = false;
      document.getElementById('btn-timer-stop').disabled = false;

      if (!activeTodoTimer.intervalId) {
        activeTodoTimer.intervalId = setInterval(() => {
          if (!activeTodoTimer.isPaused) {
            if (activeTodoTimer.isPomodoro) {
              activeTodoTimer.seconds++;
              activeTodoTimer.pomodoroRemaining--;
              displayEl.textContent = formatPomodoroTime(activeTodoTimer.pomodoroRemaining);
              
              if (activeTodoTimer.pomodoroRemaining <= 0) {
                // 自動結束當次計時並儲存，觸發番茄鐘完工彈窗
                stopTodoTimer();
              }
            } else {
              activeTodoTimer.seconds++;
              displayEl.textContent = formatSecondsToClock(activeTodoTimer.seconds);
            }
          }
        }, 1000);
      }
    }

    // 暫停計時
    function pauseTodoTimer() {
      if (!activeTodoTimer.intervalId) return;
      
      activeTodoTimer.isPaused = !activeTodoTimer.isPaused;
      const pauseBtn = document.getElementById('btn-timer-pause');
      const displayEl = document.getElementById('timer-clock-display');
      
      if (activeTodoTimer.isPaused) {
        pauseBtn.textContent = '繼續計時';
        pauseBtn.style.color = '#f59e0b';
        pauseBtn.style.borderColor = '#f59e0b';
        pauseBtn.style.background = 'rgba(245, 158, 11, 0.1)';
        displayEl.className = 'timer-display' + (activeTodoTimer.isPomodoro ? ' pomodoro' : ''); // 取消綠光
      } else {
        pauseBtn.textContent = '暫停計時';
        pauseBtn.style.color = '#f59e0b';
        pauseBtn.style.borderColor = '#f59e0b';
        pauseBtn.style.background = 'rgba(245, 158, 11, 0.1)';
        displayEl.className = 'timer-display running' + (activeTodoTimer.isPomodoro ? ' pomodoro' : ''); // 恢復綠光
      }
    }

    // 結束當次計時並儲存
    function stopTodoTimer() {
      if (!activeTodoTimer.intervalId) return;

      // 停止定時器
      clearInterval(activeTodoTimer.intervalId);
      
      const todoId = activeTodoTimer.todoId;
      const spentSeconds = activeTodoTimer.seconds;
      const noteText = activeTodoTimer.isPomodoro 
        ? '🍅 完成 25 分鐘番茄鐘專注' 
        : document.getElementById('timer-current-note').value.trim();

      const wasPomodoro = activeTodoTimer.isPomodoro;

      // 重設計時器狀態（但保留當前 todoId，以相容同一個面板內進行第二輪計時）
      activeTodoTimer.seconds = 0;
      activeTodoTimer.intervalId = null;
      activeTodoTimer.isPaused = false;
      activeTodoTimer.startTime = null;
      activeTodoTimer.isPomodoro = false;
      activeTodoTimer.pomodoroRemaining = 1500;

      // 儲存至資料庫
      const t = todos.find(x => x.id === todoId);
      if (t) {
        // 解析舊紀錄
        let logList = [];
        if (t.timeLog) {
          try {
            logList = typeof t.timeLog === 'string' ? JSON.parse(t.timeLog) : t.timeLog;
            if (!Array.isArray(logList)) logList = [];
          } catch (e) {
            logList = [];
          }
        }

        // 新增當次紀錄
        const now = new Date();
        const twOffset = 8 * 60 * 60 * 1000;
        const localTimeStr = new Date(now.getTime() + twOffset).toISOString().slice(0, 19).replace('T', ' ');
        
        logList.push({
          date: localTimeStr,
          duration: spentSeconds,
          note: noteText || '無工作備忘'
        });

        t.timeLog = JSON.stringify(logList);
        t.totalTimeSpent = (parseInt(t.totalTimeSpent, 10) || 0) + spentSeconds;

        // 同步並刷新
        saveTodos();
        renderTodoPage();
        
        // 如果 Modal 還開著，重新渲染其歷史清單
        if (document.getElementById('todo-timer-modal').classList.contains('active')) {
          renderTimerHistory(t);
          
          // 重設按鈕與顯示 UI
          resetTimerButtonsUI();
        }

        // 觸發番茄鐘完工多巴胺提醒
        if (wasPomodoro) {
          showPomodoroSuccessModal(t.title);
        }
      }
    }

    // 渲染 Modal 右側的歷史紀錄清單
    function renderTimerHistory(t) {
      // 1. 總時間
      const totalSeconds = parseInt(t.totalTimeSpent, 10) || 0;
      document.getElementById('timer-total-accumulated').textContent = formatSecondsToShortTime(totalSeconds);

      // 2. 歷史紀錄
      const historyListEl = document.getElementById('timer-history-list');
      historyListEl.innerHTML = '';

      let logList = [];
      if (t.timeLog) {
        try {
          logList = typeof t.timeLog === 'string' ? JSON.parse(t.timeLog) : t.timeLog;
          if (!Array.isArray(logList)) logList = [];
        } catch (e) {
          logList = [];
        }
      }

      if (logList.length === 0) {
        historyListEl.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding: 40px 0; font-size:0.75rem;">⏱️ 尚無任何計時工作紀錄！<br>點選左方「開始計時」建立您的第一次紀錄。</div>`;
        return;
      }

      // 將 index 綁在 HTML 上，方便我們定位操作原本陣列中的第幾個元素
      const reversedLogs = logList.map((log, index) => ({ log, index })).reverse();
      
      reversedLogs.forEach(({ log, index }) => {
        const item = document.createElement('div');
        item.style.cssText = 'background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; font-size: 0.72rem; text-align: left; display:flex; flex-direction:column; gap:4px; position:relative;';
        
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--text-primary); padding-right:85px;">
            <span style="color:var(--color-sa);">${formatSecondsToShortTime(log.duration)}</span>
            <span style="font-size:0.65rem; color:var(--text-secondary); font-family:monospace;">${log.date}</span>
          </div>
          <div style="color:#fff; font-size: 0.74rem; padding-right:85px;">${log.note}</div>
          <div style="position:absolute; right:8px; top:50%; transform:translateY(-50%); display:flex; gap:6px;">
            <button onclick="editTimerLog('${t.id}', ${index})" style="background:none; border:none; color:#f59e0b; cursor:pointer; font-size:0.68rem; font-weight:bold; padding: 2px;" title="修改工作時間與備忘">[修改]</button>
            <button onclick="deleteTimerLog('${t.id}', ${index})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.68rem; font-weight:bold; padding: 2px;" title="刪除此計時紀錄">[刪除]</button>
          </div>
        `;
        historyListEl.appendChild(item);
      });
    }

    // 編輯特定一次的計時紀錄 (系統 UI 風格對話框版)
    function editTimerLog(todoId, logIndex) {
      const t = todos.find(x => x.id === todoId);
      if (!t) return;

      let logList = [];
      try {
        logList = typeof t.timeLog === 'string' ? JSON.parse(t.timeLog) : t.timeLog;
      } catch (e) {
        return;
      }

      const log = logList[logIndex];
      if (!log) return;

      // 填入 Modal 欄位
      document.getElementById('edit-log-todo-id').value = todoId;
      document.getElementById('edit-log-index').value = logIndex;
      document.getElementById('edit-log-duration').value = Math.round(log.duration / 60);
      document.getElementById('edit-log-note').value = log.note || '';

      // 開啟 Modal
      document.getElementById('edit-log-modal').classList.add('active');
    }

    function closeEditLogModal() {
      document.getElementById('edit-log-modal').classList.remove('active');
    }

    function submitEditLogModal() {
      const todoId = document.getElementById('edit-log-todo-id').value;
      const logIndex = parseInt(document.getElementById('edit-log-index').value, 10);
      const newMins = parseInt(document.getElementById('edit-log-duration').value, 10);
      const newNote = document.getElementById('edit-log-note').value.trim();

      if (isNaN(newMins) || newMins < 0) {
        alert("請輸入大於或等於 0 的分鐘數！");
        return;
      }

      const t = todos.find(x => x.id === todoId);
      if (!t) return;

      let logList = [];
      try {
        logList = typeof t.timeLog === 'string' ? JSON.parse(t.timeLog) : t.timeLog;
      } catch (e) {
        return;
      }

      const log = logList[logIndex];
      if (!log) return;

      const newDuration = newMins * 60;

      // 重新計算總時間
      t.totalTimeSpent = (parseInt(t.totalTimeSpent, 10) || 0) - log.duration + newDuration;
      if (t.totalTimeSpent < 0) t.totalTimeSpent = 0;

      // 更新紀錄
      log.note = newNote || '無工作備忘';
      log.duration = newDuration;

      t.timeLog = JSON.stringify(logList);

      // 存檔與渲染
      saveTodos();
      renderTodoPage();
      renderTimerHistory(t);
      closeEditLogModal();
    }

    // 刪除特定一次的計時紀錄 (系統 UI 風格對話框版)
    function deleteTimerLog(todoId, logIndex) {
      const t = todos.find(x => x.id === todoId);
      if (!t) return;

      let logList = [];
      try {
        logList = typeof t.timeLog === 'string' ? JSON.parse(t.timeLog) : t.timeLog;
      } catch (e) {
        return;
      }

      const log = logList[logIndex];
      if (!log) return;

      // 填充 Modal 欄位
      document.getElementById('del-log-todo-id').value = todoId;
      document.getElementById('del-log-index').value = logIndex;
      document.getElementById('del-log-message').textContent = `您確定要刪除這筆計時紀錄嗎？\n該次花費時間為：${formatSecondsToShortTime(log.duration)}。\n刪除後此時間將會自該待辦任務的總時數中扣除。`;

      // 開啟 Modal
      document.getElementById('timer-confirm-modal').classList.add('active');
    }

    function closeTimerConfirmModal() {
      document.getElementById('timer-confirm-modal').classList.remove('active');
    }

    function submitTimerConfirmModal() {
      const todoId = document.getElementById('del-log-todo-id').value;
      const logIndex = parseInt(document.getElementById('del-log-index').value, 10);

      const t = todos.find(x => x.id === todoId);
      if (!t) return;

      let logList = [];
      try {
        logList = typeof t.timeLog === 'string' ? JSON.parse(t.timeLog) : t.timeLog;
      } catch (e) {
        return;
      }

      const log = logList[logIndex];
      if (!log) return;

      // 扣除時間
      t.totalTimeSpent = (parseInt(t.totalTimeSpent, 10) || 0) - log.duration;
      if (t.totalTimeSpent < 0) t.totalTimeSpent = 0;

      // 刪除紀錄
      logList.splice(logIndex, 1);
      t.timeLog = JSON.stringify(logList);

      // 存檔與渲染
      saveTodos();
      renderTodoPage();
      renderTimerHistory(t);
      closeTimerConfirmModal();
    }

    // 完成待辦任務並結案
    function timerMarkAsDone() {
      const todoId = activeTodoTimer.todoId;
      if (!todoId) return;

      // 如果當前仍在計時中，自動幫使用者結束並儲存
      if (activeTodoTimer.intervalId) {
        if (confirm('當前計時器仍在運行中，結案前將會自動結束並儲存當次計時，是否確定？')) {
          stopTodoTimer();
        } else {
          return;
        }
      }

      // 標記任務完成
      toggleTodoDone(todoId);
      closeTodoTimerModal();
    }


    // --- 待辦通知雙 Tab 看板 ---
    let currentTodoNotifyTab = 'priority';

    let todoNotifyModalCallback = null;
    function toggleTodoNotifyModal(show, callback) {
      const modal = document.getElementById('todo-notify-modal');
      if (!modal) return;
      if (show) {
        todoNotifyModalCallback = callback || null;
        modal.classList.add('active');
      } else {
        modal.classList.remove('active');
        if (todoNotifyModalCallback) {
          const cb = todoNotifyModalCallback;
          todoNotifyModalCallback = null;
          cb();
        }
      }
    }

    function switchTodoNotifyTab(tabName) {
      currentTodoNotifyTab = tabName;
      const btnPriority = document.getElementById('tab-btn-priority');
      const btnTimeline = document.getElementById('tab-btn-timeline');
      const panelPriority = document.getElementById('todo-notify-panel-priority');
      const panelTimeline = document.getElementById('todo-notify-panel-timeline');

      if (tabName === 'priority') {
        if (btnPriority) btnPriority.classList.add('active');
        if (btnTimeline) btnTimeline.classList.remove('active');
        if (panelPriority) panelPriority.classList.add('active');
        if (panelTimeline) panelTimeline.classList.remove('active');
      } else {
        if (btnPriority) btnPriority.classList.remove('active');
        if (btnTimeline) btnTimeline.classList.add('active');
        if (panelPriority) panelPriority.classList.remove('active');
        if (panelTimeline) panelTimeline.classList.add('active');
      }
    }

    // 在通知看板中雙擊結案完成
    function toggleTodoDoneInNotify(id) {
      toggleTodoDone(id);
      // toggleTodoDone 內部會 saveTodos 並更新 badge。我們在延遲 200ms 動畫後刷新 Modal 本身
      setTimeout(() => {
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const tw = new Date(utc + 3600000 * 8);
        const todayStr = tw.getFullYear() + '-' + String(tw.getMonth()+1).padStart(2,'0') + '-' + String(tw.getDate()).padStart(2,'0');
        renderTodoNotifyModal(todos.filter(t => !t.done), todayStr);
      }, 250);
    }

    function renderTodoNotifyModal(allPending, todayStr) {
      const panelPriority = document.getElementById('todo-notify-panel-priority');
      const panelTimeline = document.getElementById('todo-notify-panel-timeline');
      if (!panelPriority || !panelTimeline) return;

      const renderItemHtml = (t) => {
        let caseName = '';
        if (t.caseId && typeof cases !== 'undefined') {
          const c = cases.find(x => x.id === t.caseId);
          caseName = c ? c.clientName : '';
        }
        
        // 解析次標籤 Label
        let subTagLabel = '';
        if (t.stage && t.subTag && TODO_SUBTAG_MAP[t.stage]) {
          const sub = TODO_SUBTAG_MAP[t.stage].find(x => x.value === t.subTag);
          subTagLabel = sub ? sub.label : t.subTag;
        }

        const stageText = t.stage ? ` ／ ${t.stage}` : '';
        const subTagText = subTagLabel ? ` (次標籤: ${subTagLabel})` : '';
        
        let dueLabel = '';
        if (t.dueDate) {
          if (t.dueDate < todayStr) dueLabel = `<span style="color:#ef4444; font-size:0.68rem; font-family:monospace; margin-left:auto;">⚠ 逾期 ${t.dueDate}</span>`;
          else if (t.dueDate === todayStr) dueLabel = `<span style="color:#f59e0b; font-size:0.68rem; font-family:monospace; margin-left:auto;">🔔 今日 ${t.dueDate}</span>`;
          else dueLabel = `<span style="color:var(--text-secondary); font-size:0.68rem; font-family:monospace; margin-left:auto;">🕐 到期 ${t.dueDate}</span>`;
        } else {
          dueLabel = `<span style="color:var(--text-secondary); font-size:0.65rem; margin-left:auto;">(未設時間)</span>`;
        }

        const uVal = t.urgent === true || t.urgent === 'true';
        const iVal = t.important === true || t.important === 'true';
        const pMeta = getPriorityMeta(uVal, iVal);
        const pBadge = pMeta ? `<span class="priority-badge ${pMeta.class}" style="font-size:0.6rem; padding:1px 4px; border-radius:3px;">${pMeta.label}</span>` : '';

        // 累計時間小標籤
        let timeSpentHtml = '';
        if (t.totalTimeSpent && parseInt(t.totalTimeSpent, 10) > 0) {
          timeSpentHtml = `<span style="background: rgba(16, 185, 129, 0.08); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); font-family: monospace; font-size: 0.65rem; padding: 1px 4px; border-radius: 3px; display: inline-block;">⏱️ ${formatSecondsToShortTime(t.totalTimeSpent)}</span>`;
        }

        return `<div ondblclick="openTodoTimerModal('${t.id}')" style="display:flex; align-items:center; justify-content:flex-start; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); padding:8px 10px; border-radius:8px; margin-bottom:8px; gap:10px; cursor:pointer;" title="雙擊開啟計時面板與歷史紀錄">
          <div class="todo-check" ondblclick="event.stopPropagation(); toggleTodoDoneInNotify('${t.id}')" title="雙擊切換完成狀態" style="margin-right:2px; flex-shrink:0;"></div>
          <div style="display:flex; align-items:center; justify-content:flex-start; gap:8px; flex-wrap:nowrap; flex:1; min-width:0; overflow:hidden; text-align:left;">
            <div style="font-weight:bold; font-size:0.8rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; margin:0; flex-shrink:0;">${t.title}</div>
            ${pBadge ? `<div style="flex-shrink:0; display:flex;">${pBadge}</div>` : ''}
            ${timeSpentHtml ? `<div style="flex-shrink:0; display:flex;">${timeSpentHtml}</div>` : ''}
            ${(caseName || stageText || subTagText) ? `<span style="font-size:0.7rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; flex-shrink:1;">[${caseName}${stageText}${subTagText}]</span>` : ''}
          </div>
          <div style="margin-left:auto; flex-shrink:0; display:flex; align-items:center;">
            ${dueLabel}
          </div>
        </div>`;
      };

      // Tab A: 優先度分組 (相容字串與布林過濾)
      const q1 = allPending.filter(t => (t.urgent === true || t.urgent === 'true') && (t.important === true || t.important === 'true'));
      const q2 = allPending.filter(t => (t.urgent === true || t.urgent === 'true') && (t.important === false || t.important === 'false'));
      const q3 = allPending.filter(t => (t.urgent === false || t.urgent === 'false') && (t.important === true || t.important === 'true'));
      const q4 = allPending.filter(t => (t.urgent === false || t.urgent === 'false') && (t.important === false || t.important === 'false'));
      const unclassified = allPending.filter(t => t.urgent === undefined || t.urgent === '' || t.important === undefined || t.important === '');

      let pGroupsHtml = '';
      const appendGroup = (title, items, borderStyle, headerBg) => {
        if (items.length === 0) return;
        pGroupsHtml += `
          <div style="margin-bottom:12px; border:1px solid ${borderStyle}; border-radius:8px; overflow:hidden;">
            <div class="priority-group-header" style="background:${headerBg}; margin:0; border-radius:0; color:#fff; padding:6px 10px;">${title} (${items.length})</div>
            <div style="padding:8px 8px 1px 8px; background:rgba(0,0,0,0.1);">
              ${items.map(renderItemHtml).join('')}
            </div>
          </div>
        `;
      };

      appendGroup('🔴 緊急且重要 (Q1)', q1, 'rgba(239,68,68,0.2)', 'rgba(239,68,68,0.18)');
      appendGroup('🟠 緊急但重要性低 (Q2)', q2, 'rgba(249,115,22,0.2)', 'rgba(249,115,22,0.18)');
      appendGroup('🟡 重要但不緊急 (Q3)', q3, 'rgba(234,179,8,0.2)', 'rgba(234,179,8,0.18)');
      appendGroup('⚪ 不緊急且不重要 (Q4)', q4, 'rgba(107,114,128,0.2)', 'rgba(107,114,128,0.18)');
      appendGroup('📋 未分類任務', unclassified, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)');

      if (pGroupsHtml === '') {
        pGroupsHtml = `<div style="color:var(--text-secondary); text-align:center; padding:40px 10px; font-size:0.75rem;">🎉 暫無任何待辦任務</div>`;
      }
      panelPriority.innerHTML = pGroupsHtml;

      // Tab B: 時間序分組
      const timedTodos = allPending.filter(t => t.dueDate);
      timedTodos.sort((a,b) => a.dueDate.localeCompare(b.dueDate));

      if (timedTodos.length === 0) {
        panelTimeline.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding:40px 10px; font-size:0.75rem;">🎉 暫無設定到期日的待辦任務</div>`;
      } else {
        panelTimeline.innerHTML = `<div style="padding:8px 0; max-height: 380px; overflow-y: auto;">${timedTodos.map(renderItemHtml).join('')}</div>`;
      }
    }

    function checkAndShowTodoReminders() {
      loadTodos();
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const tw = new Date(utc + 3600000 * 8);
      const todayStr = tw.getFullYear() + '-' + String(tw.getMonth()+1).padStart(2,'0') + '-' + String(tw.getDate()).padStart(2,'0');

      const pending = todos.filter(t => !t.done);
      updateTodoBadge();

      renderTodoNotifyModal(pending, todayStr);
      switchTodoNotifyTab('priority');
      toggleTodoNotifyModal(true);
    }

    function dismissTodoToast() {
      const toast = document.getElementById('todo-toast');
      if (toast) toast.classList.remove('show');
    }

    function goToTodoPage() {
      dismissTodoToast();
      toggleTodoNotifyModal(false);
      const page = document.getElementById('todo-page');
      if (page && !page.classList.contains('active')) {
        loadTodos();
        renderTodoPage();
        page.classList.add('active');
      }
    }


    // --- Toast 提醒 ---


    // --- ESC 關閉所有 Modal (ADHD 防呆優化版) ---
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const editLogModal = document.getElementById('edit-log-modal');
        if (editLogModal && editLogModal.classList.contains('active')) {
          closeEditLogModal();
          return;
        }
        const confirmModal = document.getElementById('timer-confirm-modal');
        if (confirmModal && confirmModal.classList.contains('active')) {
          closeTimerConfirmModal();
          return;
        }
        const timerModal = document.getElementById('todo-timer-modal');
        if (timerModal && timerModal.classList.contains('active')) {
          closeTodoTimerModal();
          return;
        }
        const addCaseModal = document.getElementById('add-case-modal');
        if (addCaseModal && addCaseModal.classList.contains('active')) {
          toggleAddCaseModal(false);
          return;
        }
        const todoModal = document.getElementById('add-todo-modal');
        if (todoModal && todoModal.classList.contains('active')) {
          closeTodoModal();
          return;
        }
        const reminderModal = document.getElementById('reminder-modal');
        if (reminderModal && reminderModal.classList.contains('active')) {
          toggleReminderModal(false);
          return;
        }
        const todoNotifyModal = document.getElementById('todo-notify-modal');
        if (todoNotifyModal && todoNotifyModal.classList.contains('active')) {
          toggleTodoNotifyModal(false);
          return;
        }
      }
    });

    // === 案件排序三態切換與自訂優先級引擎 ===
    window.cycleSortMode = function() {
      const modes = ['manual', 'status', 'time'];
      let idx = modes.indexOf(crmSettings.currentSortMode || 'manual');
      idx = (idx + 1) % modes.length;
      crmSettings.currentSortMode = modes[idx];
      
      // 儲存設定
      localStorage.setItem('crm_settings', JSON.stringify(crmSettings));
      showToast(`已切換排序模式為：${
        crmSettings.currentSortMode === 'manual' ? '🖐️ 手動排序' :
        crmSettings.currentSortMode === 'status' ? '⚡ 智能狀態' : '⏳ 冷案追蹤'
      }`, 'success');
      
      renderCases();
    };

    window.renderRulesPriorityList = function() {
      const listContainer = document.getElementById('rules-priority-list');
      if (!listContainer) return;
      
      const priorityMap = crmSettings.customSubTagPriority || {};
      let html = '';
      
      // 定義實存於案件主幹道/抽屜中的次標籤（以大階段固定順序排列，點擊 +/- 絕不跑位跳行）
      // 擴展狀態：將「喬時間中」、「考慮中」與「沒意願」狀態獨立拆分，以便自訂優先級。
      const sortingTags = [
        { phase: 'SA', value: 'sa_send', label: '已發出' },
        { phase: 'SA', value: 'sa_reply', label: '互動中' },
        { phase: 'SA', value: 'sa_agree', label: '已約定' },
        { phase: 'SA', value: 'sa_pending', label: '喬時間中' },
        { phase: 'SA', value: 'sa_intent_pending', label: '考慮中/未約定' },
        { phase: 'SA', value: 'sa_intent_no', label: '沒意願/已擱置' },
        
        { phase: 'OA', value: 'oa_plan', label: '訪前規劃' },
        { phase: 'OA', value: 'oa_practice', label: '訪前演練' },
        { phase: 'OA', value: 'oa_discuss', label: '訪後討論' },
        { phase: 'OA', value: 'oa_pending', label: '喬時間中' },
        
        { phase: 'PC', value: 'pc_plan', label: '規劃建議' },
        { phase: 'PC', value: 'pc_discuss', label: '已傳建議' },
        { phase: 'PC', value: 'pc_practice', label: '講解演練' },
        { phase: 'PC', value: 'pc_pending', label: '喬時間中' },
        
        { phase: 'C', value: 'c_plan', label: '文件準備' },
        { phase: 'C', value: 'c_sign', label: '簽約' },
        { phase: 'C', value: 'c_practice', label: '要保簽署' },
        { phase: 'C', value: 'c_remedy', label: '補件' },
        { phase: 'C', value: 'c_submit', label: '送件' },
        { phase: 'C', value: 'c_discuss', label: '保費首扣' },
        { phase: 'C', value: 'c_pending', label: '喬時間中' },
        
        { phase: 'S', value: 's_plan', label: '保單送達' },
        { phase: 'S', value: 's_practice', label: '契撤追蹤' },
        { phase: 'S', value: 's_discuss', label: '週年服務' },
        { phase: 'S', value: 's_pending', label: '喬時間中' }
      ];
      
      const items = sortingTags.map(item => {
        const weight = priorityMap[item.value] !== undefined ? priorityMap[item.value] : 5;
        return { ...item, weight };
      });
      
      html = items.map(item => {
        const isZero = item.weight === 0;
        const weightStyle = isZero ? 'color:#6c757d; font-weight:normal;' : '';
        const weightDisplay = isZero ? '0 (不排序)' : item.weight;
        return `<div class="priority-sort-item">
          <span style="font-weight:600;"><span style="color:${getPhaseColor(item.phase)}; font-size:0.7rem; font-family:monospace; margin-right:4px;">${item.phase}</span> ${item.label}</span>
          <div class="priority-weight-control">
            <button type="button" class="priority-btn" onclick="changePriorityWeight('${item.value}', -1)">-</button>
            <span class="priority-weight-display" id="weight-display-${item.value}" style="${weightStyle}">${weightDisplay}</span>
            <button type="button" class="priority-btn" onclick="changePriorityWeight('${item.value}', 1)">+</button>
          </div>
        </div>`;
      }).join('');
      
      listContainer.innerHTML = html;
    };

    window.changePriorityWeight = function(subTag, delta) {
      if (!crmSettings.customSubTagPriority) crmSettings.customSubTagPriority = {};
      let current = crmSettings.customSubTagPriority[subTag] !== undefined ? crmSettings.customSubTagPriority[subTag] : 5;
      current += delta;
      if (current < 0) current = 0; // 下限改為 0，表示不參與排序
      if (current > 10) current = 10;
      
      crmSettings.customSubTagPriority[subTag] = current;
      localStorage.setItem('crm_settings', JSON.stringify(crmSettings));
      
      const display = document.getElementById(`weight-display-${subTag}`);
      if (display) {
        if (current === 0) {
          display.textContent = '0 (不排序)';
          display.style.color = '#6c757d';
          display.style.fontWeight = 'normal';
        } else {
          display.textContent = current;
          display.style.color = '';
          display.style.fontWeight = '600';
        }
      }
      
      // 更新權重後只重新排序渲染案件卡片，不再重繪自訂列表以防跳行
      renderCases();
    };

    window.applyRulesTemplate = function(type) {
      if (type === 'close') {
        // 臨門一腳優先 (收單/補件優先)
        crmSettings.customSubTagPriority = {
          "sa_send": 3, "sa_reply": 4, "sa_agree": 5,
          "sa_pending": 3, "sa_intent_pending": 2, "sa_intent_no": 0,
          "oa_plan": 5, "oa_practice": 6, "oa_discuss": 7, "oa_pending": 3,
          "pc_plan": 7, "pc_discuss": 8, "pc_practice": 6, "pc_pending": 3,
          "c_plan": 9, "c_sign": 9, "c_practice": 8, "c_remedy": 10, "c_submit": 10, "c_discuss": 7, "c_pending": 3,
          "s_plan": 4, "s_practice": 3, "s_discuss": 3, "s_pending": 3
        };
        showToast('已套用：🎯 臨門一腳收單優先模版', 'success');
      } else if (type === 'dev') {
        // 新客開發優先 (約訪/說明優先)
        crmSettings.customSubTagPriority = {
          "sa_send": 8, "sa_reply": 9, "sa_agree": 10,
          "sa_pending": 8, "sa_intent_pending": 5, "sa_intent_no": 0,
          "oa_plan": 9, "oa_practice": 8, "oa_discuss": 6, "oa_pending": 6,
          "pc_plan": 8, "pc_discuss": 6, "pc_practice": 7, "pc_pending": 6,
          "c_plan": 6, "c_sign": 5, "c_practice": 5, "c_remedy": 5, "c_submit": 5, "c_discuss": 4, "c_pending": 4,
          "s_plan": 3, "s_practice": 2, "s_discuss": 2, "s_pending": 3
        };
        showToast('已套用：✨ 新客開發優先模版', 'success');
      }
      
      localStorage.setItem('crm_settings', JSON.stringify(crmSettings));
      renderRulesPriorityList();
      renderCases();
    };

    // ===================================================
    // ===== 今日到訪提醒系統 (Today's Visit Reminder) =====
    // 檢查今天是否有到訪約定，並更新今日到訪按鈕顯示狀態
    function checkTodayVisits() {
      const btn = document.getElementById('btn-visit-today');
      if (!btn) return;

      // 取得台灣時間今日
      const now = new Date();
      const twOffset = 8 * 60 * 60 * 1000;
      const twNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + twOffset);
      const yyyy = twNow.getFullYear();
      const mm = String(twNow.getMonth() + 1).padStart(2, '0');
      const dd = String(twNow.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      // 掃描未封存案件中，今天有約訪的案件 (超強聯集判定，徹底解決跨階段排程漏算問題)
      const activeCases = cases.filter(c => !c.archived);
      const todayCases = activeCases.filter(c => {
        const saDate = (c.saDetails && c.saDetails.agreeDate) || '';
        const oaDate = (c.oaDetails && c.oaDetails.meetDate) || '';
        const pcDate = (c.pcDetails && c.pcDetails.meetDate) || '';
        const cDate = (c.cDetails && (c.cDetails.meetDate || c.cDetails.practiceDate)) || '';
        const sDate = (c.sDetails && c.sDetails.meetDate) || '';
        
        const allDates = [saDate, oaDate, pcDate, cDate, sDate].map(d => d.replace(/\//g, '-').trim());
        return allDates.includes(todayStr);
      });

      if (todayCases.length > 0) {
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '4px';
        btn.innerHTML = `🚗 今日到訪 (${todayCases.length})`;
      } else {
        btn.style.display = 'none';
      }
    }
    window.checkTodayVisits = checkTodayVisits;

    // 控制到訪抽屜的開啟與關閉
    function toggleVisitDrawer(show) {
      const overlay = document.getElementById('visit-drawer-overlay');
      const drawer = document.getElementById('visit-drawer');
      if (!overlay || !drawer) return;

      if (show) {
        // 先渲染今天
        renderVisitDrawer();
        overlay.classList.add('active');
        drawer.classList.add('active');
      } else {
        overlay.classList.remove('active');
        drawer.classList.remove('active');
      }
    }
    window.toggleVisitDrawer = toggleVisitDrawer;

    // 渲染到訪防呆抽屜
    function renderVisitDrawer() {
      const body = document.getElementById('visit-drawer-body');
      if (!body) return;

      // 取得台灣時間今日
      const now = new Date();
      const twOffset = 8 * 60 * 60 * 1000;
      const twNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + twOffset);
      const yyyy = twNow.getFullYear();
      const mm = String(twNow.getMonth() + 1).padStart(2, '0');
      const dd = String(twNow.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      const activeCases = cases.filter(c => !c.archived);
      const todayCases = activeCases.filter(c => {
        const saDate = (c.saDetails && c.saDetails.agreeDate) || '';
        const oaDate = (c.oaDetails && c.oaDetails.meetDate) || '';
        const pcDate = (c.pcDetails && c.pcDetails.meetDate) || '';
        const cDate = (c.cDetails && (c.cDetails.meetDate || c.cDetails.practiceDate)) || '';
        const sDate = (c.sDetails && c.sDetails.meetDate) || '';
        
        const allDates = [saDate, oaDate, pcDate, cDate, sDate].map(d => d.replace(/\//g, '-').trim());
        return allDates.includes(todayStr);
      });

      if (todayCases.length === 0) {
        body.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-secondary); font-size:0.85rem;">
          🚗 今天沒有安排任何約訪！
        </div>`;
        return;
      }

      let html = '';

      todayCases.forEach(c => {
        const phase = c.currentPhase || 'SA';
        const phaseLabels = { SA: '約訪/SA', OA: '初訪/OA', PC: '建議書/PC', C: '送件/C', S: '售服/S' };
        const phaseColor = getPhaseColor(phase);

        // 預設的出門備忘 (Checklist)
        const defaultChecklistKey = `visit_checklist_${c.id}_${todayStr}`;
        let localChecklist = {};
        // 讀取該階段的現場任務規劃
        const detailsKey = `${phase.toLowerCase()}Details`;
        const visitTasks = (c[detailsKey] && c[detailsKey].visitTasks) || [];

        let visitTasksHtml = '';
        if (visitTasks.length === 0) {
          visitTasksHtml = `
            <div style="font-size:0.72rem; color:var(--text-secondary); text-align:center; padding:10px 0; border: 1px dashed rgba(255,255,255,0.06); border-radius:6px; background:rgba(255,255,255,0.01); width:100%; box-sizing:border-box;">
              📭 無特定現場任務，可點開案件抽屜進行任務規劃
            </div>
          `;
        } else {
          visitTasksHtml = visitTasks.map(t => {
            return `
              <div class="visit-checklist-item ${t.done ? 'checked' : ''}" onclick="toggleVisitTask('${c.id}', '${phase}', '${t.id}')" style="width:100%; box-sizing:border-box;">
                <span class="visit-checklist-checkbox">${t.done ? '✓' : ''}</span>
                <span class="visit-checklist-text" style="${t.done ? 'text-decoration:line-through; color:var(--text-secondary);' : ''}">${t.text}</span>
              </div>
            `;
          }).join('');
        }

        // 讀取該案件今天到期的待辦事項
        const caseTodos = todos.filter(t => !t.done && t.caseId === c.id && t.dueDate === todayStr);

        html += `
          <div class="visit-case-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-weight:700; font-size:1rem; color:#fff;">${c.clientName}</span>
              <span class="status-badge" style="background:${phaseColor}20; color:${phaseColor}; border:1px solid ${phaseColor}40; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700;">
                ${phaseLabels[phase] || phase}
              </span>
            </div>
            
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:12px;">
              📍 階段進度備忘：${c.summaryDescription || '無備忘描述'}
            </div>
            
            <!-- 現場執行任務清單 -->
            <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--accent); margin-bottom:6px; display:flex; align-items:center; gap:4px;">
                🧳 現場執行任務防呆檢核
              </div>
              ${visitTasksHtml}
            </div>

            <!-- 當日關聯待辦 -->
            ${caseTodos.length > 0 ? `
            <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:8px; margin-top:8px;">
              <div style="font-size:0.75rem; font-weight:700; color:#f59e0b; margin-bottom:6px;">
                🎯 本日關聯任務 (${caseTodos.length})
              </div>
              ${caseTodos.map(t => `
                <div class="visit-checklist-item" onclick="quickCompleteTodo('${t.id}', event)">
                  <span class="visit-checklist-checkbox"></span>
                  <span class="visit-checklist-text" style="color:#fdba74;">${t.title}</span>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <!-- 防呆雙擊快速按鈕 -->
            <div style="margin-top:12px; display:flex; gap:8px;">
              <button class="btn" ondblclick="quickCompleteVisit('${c.id}', '${phase}')" title="雙擊以完成此到訪" style="flex:1; font-size:0.75rem; padding:4px 8px; border-color:#10b981; color:#10b981; background:rgba(16,185,129,0.05);">
                🤝 雙擊完成到訪
              </button>
            </div>
          </div>
        `;
      });

      body.innerHTML = html;
    }
    window.renderVisitDrawer = renderVisitDrawer;

    // 點擊切換出門物品勾選狀態
    window.toggleVisitCheckItem = function(caseId, key) {
      // 取得台灣時間今日
      const now = new Date();
      const twOffset = 8 * 60 * 60 * 1000;
      const twNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + twOffset);
      const yyyy = twNow.getFullYear();
      const mm = String(twNow.getMonth() + 1).padStart(2, '0');
      const dd = String(twNow.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const storageKey = `visit_checklist_${caseId}_${todayStr}`;

      let localChecklist = {};
      try {
        localChecklist = JSON.parse(localStorage.getItem(storageKey)) || {
          props: false, docs: false, device: false, gift: false, note: false
        };
      } catch(e) {
        localChecklist = { props: false, docs: false, device: false, gift: false, note: false };
      }

      localChecklist[key] = !localChecklist[key];
      localStorage.setItem(storageKey, JSON.stringify(localChecklist));
      
      renderVisitDrawer();
    }

    // 快速完成待辦項目
    window.quickCompleteTodo = async function(todoId, event) {
      if (event) event.stopPropagation();
      const t = todos.find(x => x.id === todoId);
      if (t) {
        t.done = true;
        t.completedAt = getTaiwanTimestampString();
        saveTodos();
        
        // 推送同步
        if (!crmSettings.isOffline && crmSettings.apiUrl) {
          syncTodoChange('update', t);
        }
        
        showToast(`任務「\${t.title}」已完成！🎉`);
        renderVisitDrawer();
        renderTodoPage();
        updateTodoBadges();
      }
    }

    // 雙擊快速完成到訪，並轉入後續整理
    window.quickCompleteVisit = async function(caseId, phase) {
      const c = cases.find(x => x.id === caseId);
      if (!c) return;

      let nextTodoTitle = '';
      let nextSubTag = '';
      if (phase === 'SA') {
        nextTodoTitle = `${c.clientName} - SA 約訪後討論與計畫備忘`;
        nextSubTag = 'sa_contact';
      } else if (phase === 'OA') {
        nextTodoTitle = `${c.clientName} - OA 訪後討論與需求整理`;
        nextSubTag = 'oa_discuss';
      } else if (phase === 'PC') {
        nextTodoTitle = `${c.clientName} - PC 計畫說明訪後整理`;
        nextSubTag = 'pc_discuss';
      } else if (phase === 'C') {
        nextTodoTitle = `${c.clientName} - C 送件簽約後追蹤`;
        nextSubTag = 'c_premium';
      } else {
        nextTodoTitle = `${c.clientName} - 到訪後維繫整理`;
        nextSubTag = 's_service';
      }

      const newT = {
        id: 'T_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: nextTodoTitle,
        dueDate: getTaiwanTodayString(),
        urgent: 'N',
        important: 'Y',
        note: '系統自動生成：約訪雙擊完成後的訪後整理任務。',
        caseId: c.id,
        stage: phase,
        subTag: nextSubTag,
        done: false,
        createdAt: getTaiwanTimestampString()
      };
      
      todos.push(newT);
      saveTodos();

      if (!crmSettings.isOffline && crmSettings.apiUrl) {
        syncTodoChange('add', newT);
      }

      showToast(`已完成與 \${c.clientName} 的到訪！並自動建立訪後整理任務。🤝`);
      
      checkTodayVisits();
      renderVisitDrawer();
      renderTodoPage();
      updateTodoBadges();
      renderCases();
      
      // 若沒有今日到訪了，自動關閉
      const now = new Date();
      const twOffset = 8 * 60 * 60 * 1000;
      const twNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + twOffset);
      const yyyy = twNow.getFullYear();
      const mm = String(twNow.getMonth() + 1).padStart(2, '0');
      const dd = String(twNow.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const activeCases = cases.filter(c => !c.archived);
      const stillVisits = activeCases.some(c => {
        let targetDate = '';
        const ph = c.currentPhase || 'SA';
        if (ph === 'SA') {
          if (c.saDetails && (c.saDetails.agreeState === 'active' || c.saDetails.intentState === 'intent-yes')) {
            targetDate = c.saDetails.agreeDate || '';
          }
        } else if (ph === 'OA') {
          if (c.oaDetails && c.oaDetails.meetState === 'confirmed') {
            targetDate = c.oaDetails.meetDate || '';
          }
        } else if (ph === 'PC') {
          if (c.pcDetails && c.pcDetails.meetState === 'confirmed') {
            targetDate = c.pcDetails.meetDate || '';
          }
        } else if (ph === 'C') {
          if (c.cDetails && c.cDetails.meetState === 'confirmed') {
            targetDate = c.cDetails.meetDate || '';
          }
        } else if (ph === 'S') {
          if (c.sDetails && c.sDetails.meetState === 'confirmed') {
            targetDate = c.sDetails.meetDate || '';
          }
        }
        return targetDate.replace(/\//g, '-') === todayStr;
      });

      if (!stillVisits) {
        toggleVisitDrawer(false);
      }
    }

    window.addVisitTask = function(caseId, phase, taskText) {
      if (!taskText || !taskText.trim()) return;
      updateCase(caseId, c => {
        const detailsKey = `${phase.toLowerCase()}Details`;
        if (!c[detailsKey]) c[detailsKey] = {};
        if (!c[detailsKey].visitTasks) c[detailsKey].visitTasks = [];
        c[detailsKey].visitTasks.push({
          id: 'vt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          text: taskText.trim(),
          done: false
        });
      }, false);
      saveCasesToStorage();
      const updatedC = cases.find(item => item.id === caseId);
      refreshDrawerContent(caseId, phase, updatedC);
      
      // 新增後自動聚焦回輸入框，方便連續輸入現場任務
      setTimeout(() => {
        const inputEl = document.getElementById(`new-visit-task-input-${caseId}-${phase}`);
        if (inputEl) {
          inputEl.focus();
        }
      }, 50);
    };

    window.toggleVisitTask = function(caseId, phase, taskId) {
      updateCase(caseId, c => {
        const detailsKey = `${phase.toLowerCase()}Details`;
        if (c[detailsKey] && c[detailsKey].visitTasks) {
          const task = c[detailsKey].visitTasks.find(t => t.id === taskId);
          if (task) {
            task.done = !task.done;
          }
        }
      }, false);
      saveCasesToStorage();
      const updatedC = cases.find(item => item.id === caseId);
      refreshDrawerContent(caseId, phase, updatedC);
      const visitDrawer = document.getElementById('visit-drawer');
      if (visitDrawer && visitDrawer.classList.contains('active')) {
        renderVisitDrawer();
      }
    };

    window.deleteVisitTask = function(caseId, phase, taskId) {
      updateCase(caseId, c => {
        const detailsKey = `${phase.toLowerCase()}Details`;
        if (c[detailsKey] && c[detailsKey].visitTasks) {
          c[detailsKey].visitTasks = c[detailsKey].visitTasks.filter(t => t.id !== taskId);
        }
      }, false);
      saveCasesToStorage();
      const updatedC = cases.find(item => item.id === caseId);
      refreshDrawerContent(caseId, phase, updatedC);
      const visitDrawer = document.getElementById('visit-drawer');
      if (visitDrawer && visitDrawer.classList.contains('active')) {
        renderVisitDrawer();
      }
    };

    function renderVisitTasksSection(c, phase) {
      const detailsKey = `${phase.toLowerCase()}Details`;
      const details = c[detailsKey] || {};
      const tasks = details.visitTasks || [];
      const phaseColor = getPhaseColor(phase) || 'var(--accent)';

      let tasksHtml = '';
      if (tasks.length === 0) {
        tasksHtml = `<div style="color:var(--text-secondary); font-size:0.72rem; text-align:center; padding:15px 0;">無現場任務，請於上方輸入新增</div>`;
      } else {
        tasksHtml = tasks.map(t => {
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); padding:4px 6px; border-radius:4px; margin-bottom:4px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:0.72rem; cursor:pointer; color:#fff; flex:1; min-width:0; user-select:none;">
                <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleVisitTask('${c.id}', '${phase}', '${t.id}')" style="accent-color:${phaseColor}; cursor:pointer;">
                <span style="${t.done ? 'text-decoration:line-through; color:var(--text-secondary);' : ''}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.text}</span>
              </label>
              <button onclick="deleteVisitTask('${c.id}', '${phase}', '${t.id}')" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:0.7rem; padding:2px 4px; display:flex; align-items:center; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-secondary)'">🗑️</button>
            </div>
          `;
        }).join('');
      }

      return `
        <div style="flex: 1.8; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px; display:flex; flex-direction:column; gap:6px; min-width: 0; height:100%;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:2px;">📋 現場任務規劃</div>
          


          <!-- 新增任務輸入框與按鈕 -->
          <div style="display:flex; gap:4px; margin-bottom:4px;">
            <input type="text" id="new-visit-task-input-${c.id}-${phase}" placeholder="輸入現場任務..." style="flex:1; padding:2px 6px; font-size:0.72rem; height:22px; background:var(--bg-input); border:1px solid var(--border-color); color:#fff; border-radius:4px;" onkeydown="if(event.key === 'Enter') { addVisitTask('${c.id}', '${phase}', this.value); this.value=''; }">
            <button onclick="const input = document.getElementById('new-visit-task-input-${c.id}-${phase}'); addVisitTask('${c.id}', '${phase}', input.value); input.value='';" class="btn" style="height:22px; padding:0 6px; font-size:0.72rem; border-color:${phaseColor}; color:${phaseColor}; background:${phaseColor}10; display:flex; align-items:center; justify-content:center;">＋</button>
          </div>

          <!-- 現場任務 Checklist 列表 -->
          <div style="flex:1; overflow-y:auto; max-height:160px; padding-right:2px;">
            ${tasksHtml}
          </div>
        </div>
      `;
    }

    // ===================================================

    // 頁面載入初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        debugLog("DOMContentLoaded 觸發，執行 init()");
        init();
      });
    } else {
      debugLog("document 已載入完畢，直接執行 init()");
      init();
    }

    // 啟動番茄鐘模式
    window.startPomodoroMode = function() {
      if (activeTodoTimer.intervalId) return;
      
      activeTodoTimer.isPomodoro = true;
      activeTodoTimer.pomodoroRemaining = 1500; // 25 分鐘
      activeTodoTimer.seconds = 0;
      
      // 更新時鐘為 25:00
      document.getElementById('timer-clock-display').textContent = '25:00';
      document.getElementById('timer-clock-display').className = 'timer-display pomodoro';
      
      startTodoTimer();
    };

    // 顯示多巴胺滿格專注成功 Modal
    function showPomodoroSuccessModal(taskTitle) {
      document.getElementById('pomodoro-completed-task-title').textContent = `專注任務：${taskTitle}`;
      const overlay = document.getElementById('pomodoro-success-modal');
      overlay.style.display = 'flex';
      setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('.modal-box').style.transform = 'scale(1)';
      }, 50);
      
      // 播放提示聲 (使用原生 Audio API API 產出簡短的叮咚聲反饋)
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.45); // C6
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      } catch (e) {
        console.warn('音效播放失敗', e);
      }
    }

    window.closePomodoroSuccessModal = function() {
      const overlay = document.getElementById('pomodoro-success-modal');
      overlay.style.opacity = '0';
      overlay.querySelector('.modal-box').style.transform = 'scale(0.9)';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 300);
    };

    window.startNextPomodoro = function() {
      closePomodoroSuccessModal();
      setTimeout(() => {
        startPomodoroMode();
      }, 400);
    };


    // ===== 🔍 客戶案件快速跳轉側欄模組 (Left Sidebar Navigation) =====

    // 開啟側欄
    window.openLeftSidebar = function() {
      const sidebar = document.getElementById('left-sidebar');
      const overlay = document.getElementById('left-sidebar-overlay');
      if (sidebar && overlay) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        renderSidebarList(); // 每次開啟都動態重新渲染清單
      }
    };

    // 關閉側欄
    window.closeLeftSidebar = function() {
      const sidebar = document.getElementById('left-sidebar');
      const overlay = document.getElementById('left-sidebar-overlay');
      if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }
    };

    // 渲染側欄案件清單
    function renderSidebarList() {
      const listContainer = document.getElementById('sidebar-list');
      if (!listContainer) return;

      if (!cases || cases.length === 0) {
        listContainer.innerHTML = '<div style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:20px; opacity:0.6;">（尚無案件資料）</div>';
        return;
      }

      // 取得維護中心常規議題的順序
      let globalTopics = [];
      try {
        const _topicsRaw = localStorage.getItem('global_topics');
        globalTopics = _topicsRaw ? JSON.parse(_topicsRaw) : [];
        if (!Array.isArray(globalTopics)) globalTopics = [];
      } catch(e) {
        globalTopics = [];
      }

      // 複製一份案件資料進行排序
      const sortedCases = [...cases];

      sortedCases.sort((a, b) => {
        const aIssue = a.issueName || '';
        const bIssue = b.issueName || '';
        
        const aIdx = globalTopics.indexOf(aIssue);
        const bIdx = globalTopics.indexOf(bIssue);
        
        const aInOrder = aIdx !== -1;
        const bInOrder = bIdx !== -1;
        
        // 規則 1：不在維護中心的擺在最前面
        if (!aInOrder && bInOrder) return -1;
        if (aInOrder && !bInOrder) return 1;
        
        if (!aInOrder && !bInOrder) {
          // 規則 2：都不在維護中心，以案件字首筆劃升冪排序
          return (a.clientName || '').localeCompare(b.clientName || '', 'zh-Hant-TW');
        }
        
        // 規則 3：都在維護中心，以維護中心設定順序排序
        return aIdx - bIdx;
      });

      // 渲染為 HTML，格式為 [姓名]｜[議題名稱]
      listContainer.innerHTML = sortedCases.map(c => {
        const displayName = `${c.clientName || '未命名'}｜${c.issueName || '無議題'}`;
        return `<div class="sidebar-item" onclick="scrollToCaseRow('${c.id}')" title="${displayName}">${displayName}</div>`;
      }).join('');
    }

    // 點擊側欄項目跳轉並高亮
    window.scrollToCaseRow = function(caseId) {
      closeLeftSidebar();
      setTimeout(() => {
        const row = document.getElementById(`case-row-${caseId}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // 高亮閃爍特效 (0.1秒視覺聚焦，加強多巴胺反饋)
          row.classList.add('neon-flash');
          setTimeout(() => {
            row.classList.remove('neon-flash');
          }, 2000);
        }
      }, 250); // 延遲 250ms 等側欄收合動畫完成後再平滑跳轉，體驗更佳
    };

    // 平板/手機邊緣向右滑動拉出側欄手勢監聽
    (function() {
      let swipeStartX = 0;
      let swipeStartY = 0;
      
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          swipeStartX = touch.clientX;
          swipeStartY = touch.clientY;
        }
      }, { passive: true });
      
      document.addEventListener('touchend', (e) => {
        if (e.changedTouches.length > 0) {
          const touch = e.changedTouches[0];
          const deltaX = touch.clientX - swipeStartX;
          const deltaY = Math.abs(touch.clientY - swipeStartY);
          
          // 只有起點在最左側邊緣 40px 內，且往右滑動大於 80px，垂直偏移小於 50px 時觸發
          if (swipeStartX < 40 && deltaX > 80 && deltaY < 50) {
            openLeftSidebar();
          }
        }
      }, { passive: true });
    })();

    // ===== 🧠 ADHD 快速開工線性引導流 (Linear Startup Flow) =====
    // 依序跳出：新增案件 ➔ 新增待辦 ➔ 送件時程提醒 ➔ 今日待辦提醒
    async function startADHDStartupFlow() {
      debugLog("🧠 ADHD 啟動流：步驟 1 - 新增案件");
      await new Promise(resolve => {
        toggleAddCaseModal(true, resolve);
      });

      debugLog("🧠 ADHD 啟動流：步驟 2 - 新增待辦");
      await new Promise(resolve => {
        openTodoModal(null, null, resolve);
      });

      debugLog("🧠 ADHD 啟動流：步驟 3 - 送件提醒看板");
      await new Promise(resolve => {
        // 先載入並渲染
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const twDate = new Date(utc + (3600000 * 8));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = yyyy + "-" + mm + "-" + dd;
        const limitDays = crmSettings.reminderDaysLimit || 14;
        const limitDate = new Date(twDate.getTime() + (limitDays * 24 * 60 * 60 * 1000));
        const ly = limitDate.getFullYear();
        const lm = String(limitDate.getMonth() + 1).padStart(2, '0');
        const ld = String(limitDate.getDate()).padStart(2, '0');
        const limitDateStr = ly + "-" + lm + "-" + ld;

        const expired = [];
        const today = [];
        const future = [];

        if (cases && cases.length > 0) {
          cases.forEach(c => {
            if (c.cDetails && c.cDetails.submitDate && c.cDetails.submitProcessed !== 'processed') {
              const sDate = c.cDetails.submitDate.replace(/\//g, '-');
              if (sDate < todayStr) expired.push(c);
              else if (sDate === todayStr) today.push(c);
              else if (sDate > todayStr && sDate <= limitDateStr) future.push(c);
            }
          });
        }
        updateGlobalReminderIcon(expired.length, today.length, future.length, expired, today, future);
        renderReminderBoard(expired, today, future);
        toggleReminderModal(true, resolve);
      });

      debugLog("🧠 ADHD 啟動流：步驟 4 - 今日待辦提醒");
      await new Promise(resolve => {
        loadTodos();
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const tw = new Date(utc + 3600000 * 8);
        const todayStr = tw.getFullYear() + '-' + String(tw.getMonth()+1).padStart(2,'0') + '-' + String(tw.getDate()).padStart(2,'0');
        const pending = todos.filter(t => !t.done);
        updateTodoBadge();
        renderTodoNotifyModal(pending, todayStr);
        switchTodoNotifyTab('priority');
        toggleTodoNotifyModal(true, resolve);
      });
      
      debugLog("🧠 ADHD 啟動流全部完成！");
    }

    // ==========================================================================
    // 👥 三態視角切換器 & 客戶 360° 畫布控制核心
    // ==========================================================================
    
    let activeC360CustomerId = null;

    window.cycleViewMode = function() {
      const modes = ['case', 'todo', 'customer'];
      let nextIdx = (modes.indexOf(currentViewMode) + 1) % modes.length;
      switchViewMode(modes[nextIdx]);
      
      const modeNames = { 'case': '📊 案件管理', 'todo': '📋 待辦事項', 'customer': '👥 客戶畫布' };
      showToast(`已切換至：${modeNames[modes[nextIdx]]}`, 'success');
    };

    window.switchViewMode = function(mode) {
      currentViewMode = mode;
      
      // 控制主頁面顯示隱藏
      const weeklyCalendar = document.getElementById('weekly-calendar-bar');
      const canvasContainer = document.getElementById('canvas-container');
      const todoPage = document.getElementById('todo-page');
      const customerPage = document.getElementById('customer-page');
      
      if (weeklyCalendar) weeklyCalendar.style.display = mode === 'case' ? '' : 'none';
      if (canvasContainer) canvasContainer.style.display = mode === 'case' ? '' : 'none';
      
      if (todoPage) {
        if (mode === 'todo') {
          todoPage.style.display = 'block';
          todoPage.classList.add('active');
          loadTodos();
          renderTodoPage();
        } else {
          todoPage.style.display = 'none';
          todoPage.classList.remove('active');
        }
      }
      
      if (customerPage) {
        if (mode === 'customer') {
          customerPage.style.display = 'block';
          loadCustomers();
          renderCustomerPage();
        } else {
          customerPage.style.display = 'none';
        }
      }
    };
    
    window.toggleTodoPage = function() {
      if (currentViewMode === 'todo') {
        switchViewMode('case');
      } else {
        switchViewMode('todo');
      }
    };

    // 渲染客戶畫布卡片列表
    window.renderCustomerPage = function() {
      const grid = document.getElementById('customer-grid');
      if (!grid) return;
      grid.innerHTML = '';
      
      if (customers.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-secondary); opacity:0.6;">（尚無客戶資料，點擊右上角新增）</div>';
        return;
      }
      
      customers.forEach(cust => {
        const custCases = cases.filter(c => c.clientName === cust.name);
        const activeCount = custCases.filter(c => !c.isArchived).length;
        
        let framework = {};
        try {
          framework = typeof cust.framework === 'string' ? JSON.parse(cust.framework) : (cust.framework || {});
        } catch(e) { framework = {}; }
        const checkedCount = Object.values(framework).filter(v => v === true).length;
        
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.onclick = () => openCustomer360Drawer(cust.id);
        
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:1.15rem; font-weight:800; color:#fff;">👤 ${cust.name}</span>
            <span style="font-size:0.75rem; color:var(--text-secondary); font-family:monospace;">${cust.phone || '無電話'}</span>
          </div>
          <div style="display:flex; gap:12px; font-size:0.8rem; color:var(--text-secondary);">
            <span>📁 進行中案件: <strong style="color:var(--color-sa); font-weight:bold;">${activeCount}</strong></span>
            <span>🛡️ 已檢核保障: <strong style="color:#10b981; font-weight:bold;">${checkedCount}項</strong></span>
          </div>
        `;
        grid.appendChild(card);
      });
    };

    // --- 新增 / 編輯客戶彈窗 ---
    window.openAddCustomerModal = function(editId) {
      const modal = document.getElementById('add-customer-modal');
      const title = document.getElementById('customer-modal-title');
      if (!modal) return;
      
      if (editId) {
        const cust = customers.find(c => c.id === editId);
        if (!cust) return;
        title.textContent = '編輯客戶資料';
        document.getElementById('customer-edit-id').value = cust.id;
        document.getElementById('customer-input-name').value = cust.name || '';
        document.getElementById('customer-input-phone').value = cust.phone || '';
      } else {
        title.textContent = '新增客戶資料';
        document.getElementById('customer-edit-id').value = '';
        document.getElementById('customer-input-name').value = '';
        document.getElementById('customer-input-phone').value = '';
      }
      modal.classList.add('active');
    };

    window.closeAddCustomerModal = function() {
      const modal = document.getElementById('add-customer-modal');
      if (modal) modal.classList.remove('active');
    };

    window.saveCustomer = function() {
      const name = (document.getElementById('customer-input-name').value || '').trim();
      const phone = (document.getElementById('customer-input-phone').value || '').trim();
      
      if (!name) {
        document.getElementById('customer-input-name').focus();
        return;
      }
      
      const editId = document.getElementById('customer-edit-id').value;
      const twTime = new Date(new Date().getTime() + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
      
      if (editId) {
        const cust = customers.find(c => c.id === editId);
        if (cust) {
          cust.name = name;
          cust.phone = phone;
          cust.lastUpdated = twTime;
        }
      } else {
        customers.push({
          id: 'cust_' + Math.random().toString(36).substr(2, 9),
          name: name,
          phone: phone,
          family: '[]',
          framework: '{}',
          campaigns: '{}',
          lastUpdated: twTime
        });
      }
      
      saveCustomers();
      closeAddCustomerModal();
      renderCustomerPage();
      showToast('客戶資料儲存成功！', 'success');
    };

    // --- 客戶 360° 畫布面板核心功能 ---
    window.openCustomer360Drawer = function(customerId) {
      activeC360CustomerId = customerId;
      const cust = customers.find(c => c.id === customerId);
      if (!cust) return;
      
      // 填充基本資料
      document.getElementById('c360-client-name').textContent = cust.name;
      document.getElementById('c360-client-phone').textContent = cust.phone || '無電話欄位';
      
      // 綁定編輯按鈕
      document.getElementById('c360-edit-btn').onclick = () => {
        openAddCustomerModal(cust.id);
      };
      
      // 渲染三欄
      renderC360Family(cust);
      renderC360Framework(cust);
      renderC360Campaigns(cust);
      renderC360Timeline(cust);
      renderC360Todos(cust);
      renderC360Notes(cust);
      
      // 打開抽屜
      document.getElementById('customer-360-overlay').classList.add('active');
      document.getElementById('customer-360-drawer').classList.add('active');
    };

    window.closeCustomer360Drawer = function() {
      document.getElementById('customer-360-overlay').classList.remove('active');
      document.getElementById('customer-360-drawer').classList.remove('active');
      activeC360CustomerId = null;
    };

    // --- 左欄：家人家庭關係與基本保障框架 ---
    function renderC360Family(cust) {
      const container = document.getElementById('c360-family-list');
      if (!container) return;
      container.innerHTML = '';
      
      let family = [];
      try {
        family = typeof cust.family === 'string' ? JSON.parse(cust.family) : (cust.family || []);
      } catch(e) { family = []; }
      
      if (family.length === 0) {
        container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); opacity:0.6; text-align:center; padding:10px;">（暫無關聯家人）</div>';
        return;
      }
      
      family.forEach(rel => {
        const item = document.createElement('div');
        item.className = 'c360-list-item';
        
        // 尋找此家人是否已存在於客戶庫中
        const member = customers.find(c => c.name === rel.name);
        if (member) {
          item.innerHTML = `
            <span style="font-weight:700; color:var(--accent); cursor:pointer;" onclick="openCustomer360Drawer('${member.id}')">👤 ${rel.name} (聯結跳轉)</span>
            <span style="font-size:0.75rem; color:var(--text-secondary);">${rel.relation}</span>
          `;
        } else {
          item.innerHTML = `
            <span>👤 ${rel.name}</span>
            <span style="font-size:0.75rem; color:var(--text-secondary);">${rel.relation}</span>
          `;
        }
        container.appendChild(item);
      });
    }

    window.openAddFamilyModal = function() {
      const select = document.getElementById('family-input-target-id');
      if (!select) return;
      
      // 填充除了當前客戶以外的所有客戶下拉選單
      select.innerHTML = '<option value="">— 請選擇客戶 —</option>' +
        customers.filter(c => c.id !== activeC360CustomerId)
          .map(c => `<option value="${c.name}">👤 ${c.name}</option>`).join('');
      
      document.getElementById('family-input-relation').value = '';
      document.getElementById('add-family-modal').classList.add('active');
    };

    window.closeAddFamilyModal = function() {
      document.getElementById('add-family-modal').classList.remove('active');
    };

    window.saveFamilyRelation = function() {
      const targetName = document.getElementById('family-input-target-id').value;
      const relation = (document.getElementById('family-input-relation').value || '').trim();
      
      if (!targetName || !relation) return;
      
      const cust = customers.find(c => c.id === activeC360CustomerId);
      if (!cust) return;
      
      let family = [];
      try {
        family = typeof cust.family === 'string' ? JSON.parse(cust.family) : (cust.family || []);
      } catch(e) { family = []; }
      
      family.push({ name: targetName, relation: relation });
      cust.family = JSON.stringify(family);
      
      // 同時反向建立關聯 (A是B的配偶，B也是A的配偶)
      const targetCust = customers.find(c => c.name === targetName);
      if (targetCust) {
        let targetFamily = [];
        try {
          targetFamily = typeof targetCust.family === 'string' ? JSON.parse(targetCust.family) : (targetCust.family || []);
        } catch(e) { targetFamily = []; }
        
        let counterRelation = '家人';
        if (relation === '配偶') counterRelation = '配偶';
        else if (relation === '父親' || relation === '母親') counterRelation = '子女';
        else if (relation.includes('子') || relation.includes('女')) counterRelation = '父母';
        
        targetFamily.push({ name: cust.name, relation: counterRelation });
        targetCust.family = JSON.stringify(targetFamily);
      }
      
      saveCustomers();
      closeAddFamilyModal();
      renderC360Family(cust);
      showToast('建立家庭關聯成功！', 'success');
    };

    // --- 🛡️ 保險框架勾選 ---
    const INSURANCE_TYPES = [
      { key: 'life', label: '壽險保障' },
      { key: 'accident', label: '意外防護' },
      { key: 'cancer', label: '癌症保障' },
      { key: 'illness', label: '重大傷病' },
      { key: 'medical', label: '實支實付醫療' },
      { key: 'ltc', label: '長期照顧險' },
      { key: 'disability', label: '失能扶助險' },
      { key: 'saving', label: '儲蓄/投資/年金' }
    ];

    function renderC360Framework(cust) {
      const grid = document.getElementById('c360-framework-grid');
      if (!grid) return;
      grid.innerHTML = '';
      
      let framework = {};
      try {
        framework = typeof cust.framework === 'string' ? JSON.parse(cust.framework) : (cust.framework || {});
      } catch(e) { framework = {}; }
      
      INSURANCE_TYPES.forEach(item => {
        const isChecked = framework[item.key] === true;
        const el = document.createElement('div');
        el.className = `c360-framework-item ${isChecked ? 'checked' : 'unchecked'}`;
        el.innerHTML = `
          <span>${isChecked ? '🟢' : '🔴'}</span>
          <span>${item.label}</span>
        `;
        el.onclick = () => toggleFrameworkChecked(cust.id, item.key);
        grid.appendChild(el);
      });
    }

    window.toggleFrameworkChecked = function(customerId, key) {
      const cust = customers.find(c => c.id === customerId);
      if (!cust) return;
      
      let framework = {};
      try {
        framework = typeof cust.framework === 'string' ? JSON.parse(cust.framework) : (cust.framework || {});
      } catch(e) { framework = {}; }
      
      framework[key] = !framework[key];
      cust.framework = JSON.stringify(framework);
      
      saveCustomers();
      renderC360Framework(cust);
      renderCustomerPage(); // 同步重繪主卡片
    };

    // --- 中欄：行銷議題邀約矩陣 ---
    function renderC360Campaigns(cust) {
      const container = document.getElementById('c360-campaigns-list');
      if (!container) return;
      container.innerHTML = '';
      
      // 同步取得維護中心所有常規議題名稱
      let globalTopics = [];
      try {
        const _topicsRaw = localStorage.getItem('global_topics');
        globalTopics = _topicsRaw ? JSON.parse(_topicsRaw) : [];
        if (!Array.isArray(globalTopics)) globalTopics = [];
      } catch(e) { globalTopics = []; }
      
      if (globalTopics.length === 0) {
        container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); opacity:0.6; text-align:center; padding:10px;">（請先到設定 ⚙️ 新增維護中心議題）</div>';
        return;
      }
      
      let campaigns = {};
      try {
        campaigns = typeof cust.campaigns === 'string' ? JSON.parse(cust.campaigns) : (cust.campaigns || {});
      } catch(e) { campaigns = {}; }
      
      globalTopics.forEach(topic => {
        const state = campaigns[topic] || '未接觸';
        const item = document.createElement('div');
        item.className = 'c360-list-item';
        
        let stateColor = 'var(--text-secondary)';
        if (state === '已約訪') stateColor = 'var(--color-sa)';
        else if (state === '已簽單') stateColor = '#10b981';
        else if (state === '拒絕') stateColor = '#ef4444';
        
        item.innerHTML = `
          <span style="font-weight:600;">${topic}</span>
          <select class="c360-status-select" style="color:${stateColor}; border-color:${stateColor};" onchange="changeCampaignState('${cust.id}', '${topic}', this.value)">
            <option value="未接觸" ${state === '未接觸' ? 'selected' : ''}>⚪ 未接觸</option>
            <option value="已約訪" ${state === '已約訪' ? 'selected' : ''}>🟡 已約訪</option>
            <option value="拒絕" ${state === '拒絕' ? 'selected' : ''}>🔴 拒絕</option>
            <option value="已簽單" ${state === '已簽單' ? 'selected' : ''}>🟢 已簽單</option>
          </select>
        `;
        container.appendChild(item);
      });
    }

    window.changeCampaignState = function(customerId, topic, newState) {
      const cust = customers.find(c => c.id === customerId);
      if (!cust) return;
      
      let campaigns = {};
      try {
        campaigns = typeof cust.campaigns === 'string' ? JSON.parse(cust.campaigns) : (cust.campaigns || {});
      } catch(e) { campaigns = {}; }
      
      campaigns[topic] = newState;
      cust.campaigns = JSON.stringify(campaigns);
      
      saveCustomers();
      
      // 智慧連鎖防呆：如果選擇了「已約訪」或「已簽單」，提示是否自動建立案件
      if (newState === '已約訪') {
        showCustomConfirmDialog(
          '智慧連鎖建案提示',
          `要為客戶 ${cust.name} 建立一個「${topic}」的進行中案件，並加入案件管理嗎？`,
          () => {
            // 自動建立案件
            const newCase = {
              id: 'case_' + Math.random().toString(36).substr(2, 9),
              clientName: cust.name,
              issueName: topic,
              type: 'life',
              visitType: 'issue',
              caseSource: 'outbound',
              source: 'relative',
              currentPhase: 'SA',
              archived: false,
              lastUpdated: new Date(new Date().getTime() + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19)
            };
            cases.push(newCase);
            saveCases();
            renderCases();
            renderC360Timeline(cust);
            showToast('案件自動建立成功！', 'success');
          }
        );
      } else {
        renderC360Campaigns(cust);
      }
    };

    // --- 中欄：進行中案件時間軸 ---
    function renderC360Timeline(cust) {
      const container = document.getElementById('c360-timeline-container');
      if (!container) return;
      container.innerHTML = '';
      
      // 過濾此客戶的案件
      const custCases = cases.filter(c => c.clientName === cust.name);
      
      if (custCases.length === 0) {
        container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); opacity:0.6; text-align:center; padding:10px;">（暫無關聯案件，可從行銷邀約矩陣或主面板＋案件新增）</div>';
        return;
      }
      
      custCases.forEach(c => {
        const item = document.createElement('div');
        item.className = 'c360-timeline-item';
        
        let phaseText = c.currentPhase || 'SA';
        let phaseColor = 'var(--accent)';
        if (c.isArchived) {
          phaseText = '📦 已封存';
          phaseColor = 'var(--text-secondary)';
        }
        
        item.innerHTML = `
          <div class="c360-timeline-header">
            <span style="color:#fff;">📂 ${c.issueName || '未命名議題'}</span>
            <span style="background:rgba(99,102,241,0.15); color:${phaseColor}; border:1px solid ${phaseColor}; font-size:0.7rem; padding:2px 8px; border-radius:12px; font-weight:bold;">${phaseText}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:0.72rem; color:var(--text-secondary);">進度軸: SA ➔ OA ➔ PC ➔ C ➔ S</div>
            <button class="btn" style="font-size:0.7rem; padding:2px 8px; border-color:var(--color-sa); color:var(--color-sa); background:transparent;" onclick="jumpToCaseRow('${c.id}')">↩ 轉向案件管理</button>
          </div>
        `;
        container.appendChild(item);
      });
    }

    // 雙向跳轉
    window.jumpToCaseRow = function(caseId) {
      closeCustomer360Drawer();
      switchViewMode('case');
      setTimeout(() => {
        const row = document.getElementById(`case-row-${caseId}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('neon-flash');
          setTimeout(() => {
            row.classList.remove('neon-flash');
          }, 2000);
        }
      }, 500);
    };

    // --- 右欄：待辦事項 ---
    function renderC360Todos(cust) {
      const container = document.getElementById('c360-todos-list');
      if (!container) return;
      container.innerHTML = '';
      
      const custTodos = todos.filter(t => !t.done && t.caseId && cases.find(c => c.id === t.caseId && c.clientName === cust.name));
      
      if (custTodos.length === 0) {
        container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); opacity:0.6; text-align:center; padding:10px;">（暫無未完成待辦）</div>';
        return;
      }
      
      custTodos.forEach(t => {
        const item = document.createElement('div');
        item.className = 'c360-list-item';
        item.innerHTML = `
          <span style="font-weight:600; text-decoration:${t.done ? 'line-through' : 'none'};">${t.title}</span>
          <button class="btn" style="font-size:0.65rem; padding:2px 6px; border-color:#10b981; color:#10b981;" onclick="completeTodoFromC360('${t.id}')">✓ 完成</button>
        `;
        container.appendChild(item);
      });
    }

    window.openAddTodoFromC360 = function() {
      // 尋找該客戶名下的第一個案件 (如果有) 進行預填
      const cust = customers.find(c => c.id === activeC360CustomerId);
      if (!cust) return;
      const firstCase = cases.find(c => c.clientName === cust.name);
      const prefillId = firstCase ? firstCase.id : '';
      
      openTodoModal(null, prefillId, () => {
        renderC360Todos(cust);
      });
    };

    window.completeTodoFromC360 = function(todoId) {
      const t = todos.find(x => x.id === todoId);
      if (t) {
        t.done = true;
        saveTodos();
        renderTodoPage();
        updateTodoBadge();
        const cust = customers.find(c => c.id === activeC360CustomerId);
        if (cust) renderC360Todos(cust);
        showToast('待辦任務已標記為完成！', 'success');
      }
    };

    // --- 右欄：面談紀要備忘錄 ---
    function renderC360Notes(cust) {
      const container = document.getElementById('c360-notes-list');
      if (!container) return;
      container.innerHTML = '';
      
      let notes = [];
      try {
        notes = localStorage.getItem('notes_' + cust.id);
        notes = notes ? JSON.parse(notes) : [];
      } catch(e) { notes = []; }
      
      if (notes.length === 0) {
        container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); opacity:0.6; text-align:center; padding:10px;">（暫無面談紀要，點擊下方新增）</div>';
        return;
      }
      
      notes.sort((a,b) => b.date.localeCompare(a.date));
      
      notes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'c360-list-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'flex-start';
        item.style.gap = '4px';
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; width:100%; font-size:0.75rem; color:var(--text-secondary); font-weight:bold;">
            <span>📅 ${n.date}</span>
            <span style="cursor:pointer; color:#ef4444;" onclick="deleteCustomerNote('${cust.id}', '${n.id}')">✕ 刪除</span>
          </div>
          <div style="font-size:0.8rem; color:#fff; white-space:pre-wrap; width:100%;">${n.content}</div>
        `;
        container.appendChild(item);
      });
    }

    window.openAddNoteModal = function() {
      document.getElementById('note-input-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('note-input-content').value = '';
      document.getElementById('add-note-modal').classList.add('active');
    };

    window.closeAddNoteModal = function() {
      document.getElementById('add-note-modal').classList.remove('active');
    };

    window.saveCustomerNote = function() {
      const date = document.getElementById('note-input-date').value;
      const content = (document.getElementById('note-input-content').value || '').trim();
      
      if (!date || !content) return;
      
      let notes = [];
      try {
        notes = localStorage.getItem('notes_' + activeC360CustomerId);
        notes = notes ? JSON.parse(notes) : [];
      } catch(e) { notes = []; }
      
      notes.push({
        id: 'note_' + Math.random().toString(36).substr(2, 9),
        date: date,
        content: content
      });
      
      localStorage.setItem('notes_' + activeC360CustomerId, JSON.stringify(notes));
      closeAddNoteModal();
      
      const cust = customers.find(c => c.id === activeC360CustomerId);
      if (cust) renderC360Notes(cust);
      showToast('儲存面談備忘成功！', 'success');
    };

    window.deleteCustomerNote = function(customerId, noteId) {
      showCustomConfirmDialog(
        '刪除確認',
        '確定要刪除這筆面談紀要嗎？刪除後無法恢復。',
        () => {
          let notes = [];
          try {
            notes = localStorage.getItem('notes_' + customerId);
            notes = notes ? JSON.parse(notes) : [];
          } catch(e) { notes = []; }
          
          notes = notes.filter(n => n.id !== noteId);
          localStorage.setItem('notes_' + customerId, JSON.stringify(notes));
          
          const cust = customers.find(c => c.id === customerId);
          if (cust) renderC360Notes(cust);
          showToast('面談紀要已成功刪除。', 'success');
        }
      );
    };

    // --- 點擊案件客戶姓名跳轉 360° 畫布 ---
    // 這會在 app.js 重繪案件行時綁定
    window.openC360FromCaseRow = function(clientName) {
      // 尋找此客戶，如果不存在則先自動建立
      loadCustomers();
      let cust = customers.find(c => c.name === clientName);
      if (!cust) {
        cust = {
          id: 'cust_' + Math.random().toString(36).substr(2, 9),
          name: clientName,
          phone: '',
          family: '[]',
          framework: '{}',
          campaigns: '{}',
          lastUpdated: new Date(new Date().getTime() + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19)
        };
        customers.push(cust);
        saveCustomers();
      }
      
      // 切換視角並打開 360 面板
      switchViewMode('customer');
      openCustomer360Drawer(cust.id);
    };

# 橘蘋課程資源查詢工具（Teacher/Student）

以 Google Apps Script 為後端、純前端 HTML 為介面的課程資源查詢工具。

- 教師端：選擇課程/課堂/章節取得當日 6 位數 PIN 與連結；需以邀請碼（uuid）開啟或於頁面提示輸入。
- 學生端：選擇課程/課堂/章節後輸入老師提供的 6 位數 PIN，通過後端驗證後顯示連結。
- PIN 每日依 salt 計算更新；多連結會以列表呈現。


## 專案結構

- `code.gs`：Google Apps Script 後端
- `index.html`：入口頁（導向學生/教師端）
- `teacher.html`：教師端頁面（`?uuid=` 驗證；缺少/錯誤時會提示輸入並寫回網址）
- `student.html`：學生端頁面（6 位數 PIN，輸滿即自動查詢）
- `favicon.png`：網站圖示


## 試算表設定

本專案預期 Apps Script 綁定於一份 Google 試算表（容器綁定）。需建立兩個工作表：

1) `data`（第一列為標題）：

| 課程 | 課堂 | 章節 | 連結 |
| ---- | ---- | ---- | ---- |

 - 清單過濾規範（自 2025-08-21 起）：
	 - 課程清單：僅列出「至少存在一筆資料，其課堂/章節/連結皆非空」的課程。
	 - 課堂清單：在指定課程下，僅列出「至少存在一筆資料，其章節/連結皆非空」的課堂。
	 - 章節清單：僅列出「連結非空」的章節。
 - 維運填表建議：
	 - 欄位值請避免前後空白；數字型章節（如 01, 02）建議以文字格式存放，避免被自動轉為數字影響排序。
	 - 若某課程或課堂目前尚無任何連結，請先不要建立該列，以免清單顯示不一致。

2) `admin`（第一列為標題）：

| 教師端介面邀請碼 | salt |
| ---------------- | ---- |

- 將允許開啟教師端的 uuid 填入「教師端介面邀請碼」。
- 需提供一個名為 `salt` 的欄位，內容由管理者維護（用於 PIN 計算）。


## 後端部署（Apps Script）

1) 於試算表中開啟 Apps Script 專案。
2) 將 `code.gs` 內容貼入（取代原始碼）。
3) 設定腳本時區（建議 Asia/Taipei）：檔案 → 專案設定 → 時區。
4) 部署為網頁應用程式（建議「任何擁有連結的人」）。
5) 複製部署後的網址作為前端 `API_URL`。


## 前端設定與使用

請將 `teacher.html` 與 `student.html` 內的 `API_URL` 改為 Apps Script 部署網址。

### 教師端（`teacher.html`）

- 使用方式：以 `?uuid=` 參數開啟，例如：
	- `https://your.host/teacher.html?uuid=xxxx-xxxx-...`
- 若網址缺少或驗證失敗，頁面會提示輸入邀請碼並在成功後把 uuid 寫回網址。
- 驗證通過後，選擇課程/課堂/章節，後端回傳當日 PIN 與連結（呼叫 `action=pin` 會附帶 uuid）。

#### URL 參數快速導引（教師端）
- 支援英文/中文鍵名：`course|lesson|chapter` 或 `課程|課堂|章節`
- 行為：
	- `?course=...`：鎖定「課程」選單，直接請「課堂」清單（不發課程清單請求）。
	- `?course=...&lesson=...`：鎖定「課程」「課堂」，直接請「章節」清單（不發課程/課堂清單請求）。
	- `?course=...&lesson=...&chapter=...`：鎖定三個選單，直接預覽 PIN 與連結（仍需已通過 `uuid` 驗證）。
- 防呆：任一選單（課程/課堂/章節）缺值時不會送出任何預覽請求。

### 學生端（`student.html`）

- 直接開啟頁面，依序選擇課程/課堂/章節。
- 顯示密碼欄時，輸入 6 位數 PIN（僅數字）；輸入滿 6 位自動送出查詢。
- 查詢期間會暫時鎖定選單與密碼欄，避免重複送出。

#### URL 參數快速導引（學生端）
- 支援英文/中文鍵名：`course|lesson|chapter|password|pin` 或 `課程|課堂|章節|密碼`
- 行為：
	- `?course=...`：鎖定「課程」選單，直接請「課堂」清單（不發課程清單請求）。
	- `?course=...&lesson=...`：鎖定「課程」「課堂」，直接請「章節」清單（不發課程/課堂清單請求）。
	- `?course=...&lesson=...&chapter=...`：鎖定三個選單，準備查連結；
		- 若同時帶 6 碼 `password/pin/密碼`，會立刻送出查詢並顯示連結。
		- 若未帶密碼，僅提示輸入密碼；輸滿 6 位自動查詢。
- 防呆：僅當三個選單皆有有效值時才會顯示密碼欄；缺任一值時不顯示密碼且不送出查詢。


## API 說明（`code.gs`）

基底：`GET {API_URL}`

通用回應：`{ status: 'success' | 'error' | 'forbidden' | 'not_found', ... }`

參數別名支援：除中文鍵名外，同時接受英文鍵名 `course/lesson/chapter` 與 `pin`。

1) 取得清單（級聯下拉）
- 課程：`?action=list&level=course`
- 課堂：`?action=list&level=lesson&課程={course}`
- 章節：`?action=list&level=chapter&課程={course}&課堂={lesson}`（僅回傳有連結者）

回應：`{ status: 'success', items: string[] }`
 
 備註：
 - 課程/課堂兩層也會依最終是否有「連結非空的章節」進行過濾，避免使用者選到下一層為空。

2) 取得當日 PIN（教師端）
- `?action=pin&課程={course}&課堂={lesson}&章節={chapter}&uuid={uuid}`
- 成功：`{ status: 'success', pin: '000000' }`
- 失敗：`{ status: 'forbidden' | 'error', message }`

3) 取得連結（需要 PIN）
- `?課程={course}&課堂={lesson}&章節={chapter}&密碼={pin}`（或 `pin` 參數名）
- 成功：`{ status: 'success', link: string, links: string[] }`
- 失敗：
	- PIN 錯誤或缺少：`{ status: 'forbidden', message }`
	- 找不到：`{ status: 'not_found', message }`

4) 教師端邀請碼驗證
- `?action=teacher_auth&uuid={uuid}` → `{ status: 'success' }` 或 `{ status: 'forbidden', message }`


## 安全性設計

- 後端做最終驗證：前端僅傳遞 PIN，後端依組合值計算比對。
- 6 位數 PIN，且 `action=pin` 必須提供有效 uuid 才會回傳。
- 不揭露與 salt 相關資訊；salt 存放於 `admin` 表，僅管理者可存取。


## 疑難排解

- 教師端顯示「邀請碼缺失或錯誤」或不進入主畫面：
	- 檢查網址 `?uuid=` 與 `admin` 表「教師端介面邀請碼」。
	- 檢查前端 `API_URL` 是否為最新部署網址。

- 學生端章節列表為空：
	- 僅列出「連結」非空的章節，請檢查 `data` 表。
	- 若課程或課堂未出現在清單：代表目前沒有任何「連結非空的章節」可用，請確認欄位是否完整與無多餘空白。

- 學生端提示「密碼錯誤或缺少密碼」：
	- 確認使用當日 PIN（PIN 每日更新）。

- 取得 PIN 失敗（教師端）：
	- 確認 `admin` 表存在並包含「教師端介面邀請碼」與 `salt` 欄位，且皆有有效值。


## 開發備註

- 前端使用 Tailwind（CDN）。
- 以標題名稱建立欄位索引，降低欄位順序變動風險。
- 同章節多筆連結會彙整去重後回傳。


## 授權

此專案供內部教學用途，可依需要調整與擴充。

# 課程資源查詢（Teacher/Student）

使用 Google Apps Script 作為後端、純前端 HTML 作為介面的課程資源查詢工具。

- 教師端：選擇課程/課堂/章節取得當日 6 位數 PIN 與連結；必須以邀請碼（uuid）開啟。
- 學生端：選擇課程/課堂/章節後輸入老師提供的 6 位數 PIN，通過後端驗證後顯示連結。
- PIN 會每日依設定自動更新；多連結會以列表呈現。


## 專案結構

- `code.gs`：Google Apps Script 後端
- `teacher.html`：教師端頁面（需以 `?uuid=` 邀請碼開啟，載入時顯示驗證 Loading）
- `student.html`：學生端頁面（6 位數 PIN，自動送出與鎖定控制）
- `example.csv`：資料工作表欄位範例（`data` 表）
- `teacher.csv`：邀請碼範例（可作為 `admin` 表的資料來源）


## 試算表設定

本專案預期 Apps Script 綁定於一份 Google 試算表（容器綁定）。需建立兩個工作表：

1) `data`（第一列為標題）：

| 課程 | 課堂 | 章節 | 連結 |
| ---- | ---- | ---- | ---- |

- 標題需與上表一致（支援欄位順序變動）。
- 可重複課程/課堂/章節；連結會彙整去重。
- 僅「連結」非空的章節會出現在前端章節清單。

2) `admin`（第一列為標題）：

| 教師端介面邀請碼 | salt |
| ---------------- | ---- |

- 將允許開啟教師端的 uuid 填入「教師端介面邀請碼」。
- 需提供一個名為 `salt` 的欄位，內容由管理者維護或自動產生；本文件不揭露其格式或來源細節。


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
- 載入時會顯示「正在驗證邀請碼…」。
	- 驗證成功：顯示主畫面，選擇課程/課堂/章節後由後端提供當日 PIN 與連結（呼叫 `action=pin` 會附帶 uuid）。
	- 驗證失敗或缺少 uuid：不顯示主畫面並以 alert 提示。

### 學生端（`student.html`）

- 使用方式：直接開啟頁面，依序選擇課程/課堂/章節。
- 顯示密碼欄時，輸入 6 位數 PIN（僅數字）；輸入滿 6 位自動送出查詢。
- 查詢期間會暫時鎖定選單與密碼欄，避免重複送出。


## API 說明（`code.gs`）

基底：`GET {API_URL}`

通用回應：`{ status: 'success' | 'error' | 'forbidden' | 'not_found', ... }`

1) 取得清單（級聯下拉）
- 課程：`?action=list&level=course`
- 課堂：`?action=list&level=lesson&課程={course}`
- 章節：`?action=list&level=chapter&課程={course}&課堂={lesson}`（僅回傳有連結者）

回應：`{ status: 'success', items: string[] }`

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
- 6 位數 PIN，且 `action=pin` 需要有效 uuid 才會回傳。
- 不回傳或揭露與 salt 相關的資訊；salt 存放於 `admin` 表，僅管理者可存取。


## 疑難排解

- 教師頁「邀請碼缺失或錯誤」：
	- 檢查網址 `?uuid=` 與 `admin` 表「教師端介面邀請碼」。
	- 檢查前端 `API_URL` 是否為最新部署網址。

- 學生端章節列表為空：
	- 僅列出「連結」非空的章節，請檢查 `data` 表資料。

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

import { db } from "./firebase-config.js";
// نحتاج استيراد دوال القراءة (getDoc, getDocs, query, orderBy, limit, where)
import { collection, writeBatch, doc, getDoc, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- دالة تحميل الإحصائيات (تعمل عند فتح الصفحة) ---
async function loadAnalytics() {
    const totalSearchesNum = document.getElementById('totalSearchesNum');
    const dailyVisitorsNum = document.getElementById('dailyVisitorsNum');
    const topSearchTerm = document.getElementById('topSearchTerm');
    const recentSearchesTableBody = document.getElementById('recentSearchesTableBody');

    try {
        // 1. جلب إجمالي عمليات البحث (من العداد السريع)
        const counterRef = doc(db, "analytics_counters", "general_stats");
        const counterSnap = await getDoc(counterRef);
        if (counterSnap.exists()) {
            totalSearchesNum.innerText = counterSnap.data().totalSearches.toLocaleString('ar-EG');
        } else {
            totalSearchesNum.innerText = "0";
        }

        // 2. جلب تحليلات اليوم (زوار فريدين + أكثر كلمة بحثاً)
        const todayStr = new Date().toISOString().split('T')[0];
        const todayQuery = query(
            collection(db, "analytics_logs"),
            where("dateStr", "==", todayStr)
            // ملاحظة: لجلب كل سجلات اليوم قد نحتاج لفهرس (Index) إذا كانت كثيرة
        );
        const todaySnap = await getDocs(todayQuery);
        
        let todayVisitors = new Set();
        let searchTermsCounts = {};
        
        todaySnap.forEach(doc => {
            const data = doc.data();
            if(data.visitorId) todayVisitors.add(data.visitorId);
            
            const term = data.term.toLowerCase().trim();
            searchTermsCounts[term] = (searchTermsCounts[term] || 0) + 1;
        });

        dailyVisitorsNum.innerText = todayVisitors.size.toLocaleString('ar-EG');

        // إيجاد أكثر كلمة تكررت اليوم
        let mostPopularTerm = '-';
        let maxCount = 0;
        for (const [term, count] of Object.entries(searchTermsCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostPopularTerm = term;
            }
        }
        topSearchTerm.innerText = mostPopularTerm;


        // 3. جلب آخر 10 عمليات بحث (للجدول)
        const recentQuery = query(
            collection(db, "analytics_logs"),
            orderBy("timestamp", "desc"),
            limit(10)
        );
        const recentSnap = await getDocs(recentQuery);
        
        recentSearchesTableBody.innerHTML = '';
        if (recentSnap.empty) {
             recentSearchesTableBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-gray-400">لا توجد بيانات حديثة</td></tr>';
        } else {
            recentSnap.forEach(doc => {
                const data = doc.data();
                // تنسيق الوقت بطريقة مقروءة
                const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'}) : '-';
                
                const row = `
                    <tr class="bg-white border-b hover:bg-gray-50">
                        <td class="px-4 py-3 font-medium text-gray-900">${data.term}</td>
                        <td class="px-4 py-3 text-gray-500 text-left text-xs">${timeStr}</td>
                    </tr>
                `;
                recentSearchesTableBody.innerHTML += row;
            });
        }

    } catch (error) {
        console.error("Error loading analytics:", error);
        totalSearchesNum.innerText = "خطأ";
        dailyVisitorsNum.innerText = "خطأ";
        topSearchTerm.innerText = "خطأ";
        recentSearchesTableBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-red-500">فشل تحميل البيانات. تأكد من الإنترنت أو الفهرسة.</td></tr>';
    }
}

// تشغيل دالة التحميل بمجرد فتح الصفحة
loadAnalytics();

// =========================================
// كود رفع ملفات الإكسل (كما هو بدون تغيير)
// =========================================
window.processExcel = async function() {
    // ... (نفس الكود القديم تماماً لـ processExcel) ...
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const statusArea = document.getElementById('statusArea');
    
    if (!fileInput.files.length) { alert("من فضلك اختر ملفاً أولاً"); return; }

    const file = fileInput.files[0];
    const fileName = file.name.replace(/\.[^/.]+$/, "").trim(); 

    statusArea.classList.remove('hidden');
    progressBar.style.width = "0%";
    progressBar.classList.remove('bg-green-600'); 
    progressBar.classList.add('bg-blue-600');
    statusText.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        جاري قراءة الملف...
    `;
    statusText.classList.remove("text-red-600", "text-green-600");
    statusText.classList.add("text-blue-800");


    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let allRows = [];

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                let headerIndex = -1;
                for (let i = 0; i < jsonSheet.length && i < 50; i++) {
                    const rowStr = JSON.stringify(jsonSheet[i]);
                    if (rowStr.includes("رقم الطعن") && (rowStr.includes("السنة") || rowStr.includes("الطاعن"))) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) return; 

                // قراءة التاريخ كنص (raw: false)
                const rawData = XLSX.utils.sheet_to_json(worksheet, { 
                    range: headerIndex,
                    raw: false, 
                    dateNF: 'dd/mm/yyyy'
                });

                rawData.forEach(row => {
                    let cleanRow = {};
                    for (let key in row) {
                        cleanRow[key.toString().trim()] = row[key];
                    }

                    const caseNum = cleanRow['رقم الطعن'];
                    const year = cleanRow['السنة'] || '0';
                    let sessionDateRaw = cleanRow['تاريخ الجلسة'];
                    const sessionDate = (sessionDateRaw && sessionDateRaw.trim() !== '') ? sessionDateRaw : fileName;
                    
                    if (caseNum) {
                        const plaintiff = cleanRow['الطاعن'] || '';
                        const defendant = cleanRow['المطعون ضده'] || '';
                        const decision1 = cleanRow['الحكم'] || '';
                        const decision2 = cleanRow['الحكم 2'] || '';
                        const fullDecision = (decision1 + ' ' + decision2).trim();
                        const judge = cleanRow['القاضي'] || '';
                        const notes = cleanRow['Notes'] || cleanRow['ملاحظات'] || '';
                        const roll = cleanRow['الرول'] || '';
                        const dataClass = cleanRow['تصنيف البيانات'] || '';
                        const source = cleanRow['مصدر البيانات'] || sheetName;

                        const sanitize = (str) => String(str).replace(/[^a-zA-Z0-9]/g, "");
                        const docID = `${sanitize(caseNum)}_${sanitize(year)}_${sanitize(sessionDate)}`;

                        const record = {
                            id: docID,
                            caseNumber: String(caseNum).trim(),
                            year: String(year).trim(),
                            sessionDate: String(sessionDate).trim(), 
                            plaintiff: String(plaintiff).trim(),
                            defendant: String(defendant).trim(),
                            decision: fullDecision,
                            judge: String(judge).trim(),
                            notes: String(notes).trim(),
                            roll: String(roll).trim(),
                            dataClass: String(dataClass).trim(),
                            dataSource: String(source).trim(),
                            uploadedAt: new Date(),
                            searchKeywords: generateKeywords(caseNum, year, plaintiff, defendant, fullDecision)
                        };
                        allRows.push(record);
                    }
                });
            });

            if (allRows.length === 0) {
                statusText.innerText = "الملف لا يحتوي على بيانات أو أسماء الأعمدة غير مطابقة!";
                statusText.classList.remove("text-blue-800");
                statusText.classList.add("text-red-600");
                return;
            }

            statusText.innerHTML = `
                <svg class="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                جاري رفع ${allRows.length} سجل...
            `;
            
            const batchSize = 450; 
            let batches = [];
            let currentBatch = writeBatch(db);
            let count = 0;

            allRows.forEach(docData => {
                const docRef = doc(db, "rulings", docData.id);
                currentBatch.set(docRef, docData); 
                count++;
                if (count === batchSize) {
                    batches.push(currentBatch);
                    currentBatch = writeBatch(db);
                    count = 0;
                }
            });
            if (count > 0) batches.push(currentBatch);

            for (let i = 0; i < batches.length; i++) {
                await batches[i].commit();
                let percent = Math.round(((i+1)/batches.length)*100);
                progressBar.style.width = percent + "%";
                statusText.innerHTML = `
                    <svg class="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    تم رفع ${percent}% ...
                `;
            }

            statusText.innerHTML = `✅ تم التحديث بنجاح! (${allRows.length} سجل)`;
            statusText.classList.remove("text-blue-800");
            statusText.classList.add("text-green-600");
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-green-600');
            setTimeout(() => {
                 alert(`تمت العملية بنجاح. العدد: ${allRows.length}`);
            }, 500);


        } catch (err) {
            console.error(err);
            statusText.innerText = "خطأ تقني: " + err.message;
            statusText.classList.remove("text-blue-800");
            statusText.classList.add("text-red-600");
        }
    };
    reader.readAsArrayBuffer(file);
};

function generateKeywords(caseNum, year, p, d, dec) {
    let keywords = [];
    let c = String(caseNum).trim();
    for (let i = 1; i <= c.length; i++) {
        keywords.push(c.substring(0, i));
    }
    let text = `${year} ${p} ${d} ${dec}`;
    let otherWords = text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ') 
                         .split(/\s+/)
                         .filter(w => w.length > 2);
    return [...keywords, ...otherWords];
}

import { db } from "./firebase-config.js";
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    
    if (!fileInput.files.length) { alert("اختر الملف أولاً"); return; }

    const file = fileInput.files[0];
    
    // استخراج التاريخ من اسم الملف (مثال: 2-9-2024)
    // هذا التاريخ جزء مهم جداً لمنع التكرار
    const fileName = file.name.replace(/\.[^/.]+$/, ""); 
    const sessionDate = fileName.trim(); 

    statusText.innerText = `جاري المعالجة (جلسة ${sessionDate})...`;
    statusText.classList.remove("text-red-600");
    
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
                // البحث عن صف العناوين
                for (let i = 0; i < jsonSheet.length && i < 30; i++) {
                    const rowStr = JSON.stringify(jsonSheet[i]);
                    if (rowStr.includes("رقم الطعن") || rowStr.includes("سنة") || rowStr.includes("مقام من")) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) return;

                const rawData = XLSX.utils.sheet_to_json(worksheet, { range: headerIndex });

                rawData.forEach(row => {
                    let cleanRow = {};
                    for (let key in row) cleanRow[key.trim()] = row[key];

                    const caseNum = cleanRow['رقم الطعن'] || cleanRow['الطعن'];
                    
                    if (caseNum) {
                        const year = cleanRow['سنة'] || cleanRow['السنة'] || '0';
                        const plaintiff = cleanRow['مقام من'] || cleanRow['المدعي'] || '';
                        const defendant = cleanRow['ضد'] || cleanRow['المدعى عليه'] || '';
                        const decision = (cleanRow['القرار الصادر'] || '') + ' ' + (cleanRow['القرار الصادر 2'] || '');
                        const judge = cleanRow['أسم العضو'] || cleanRow['اسم العضو'] || '';

                        // --- السحر هنا: إنشاء ID مميز ---
                        // الـ ID سيكون مثل: 1234_54_2-9-2024
                        // سنقوم بتنظيفه من أي رموز غريبة قد ترفضها قاعدة البيانات
                        const cleanCaseNum = String(caseNum).replace(/[^a-zA-Z0-9]/g, "");
                        const cleanYear = String(year).replace(/[^a-zA-Z0-9]/g, "");
                        const cleanDate = String(sessionDate).replace(/[^a-zA-Z0-9-]/g, "");
                        
                        // هذا هو مفتاح المستند
                        const docID = `${cleanCaseNum}_${cleanYear}_${cleanDate}`;

                        const record = {
                            id: docID, // نخزن الـ ID داخل البيانات أيضاً
                            caseNumber: String(caseNum).trim(),
                            year: String(year).trim(),
                            plaintiff: String(plaintiff).trim(),
                            defendant: String(defendant).trim(),
                            decision: String(decision).trim(),
                            judge: String(judge).trim(),
                            sessionDate: sessionDate,
                            uploadedAt: new Date(),
                            searchKeywords: generateKeywords(caseNum, year, plaintiff, defendant, decision, sessionDate)
                        };
                        allRows.push(record);
                    }
                });
            });

            if (allRows.length === 0) {
                statusText.innerText = "الملف فارغ أو التنسيق غير معروف!";
                return;
            }

            statusText.innerText = `جاري تحديث/إضافة ${allRows.length} حكم...`;
            
            const batchSize = 450; 
            let batches = [];
            let currentBatch = writeBatch(db);
            let count = 0;

            allRows.forEach(docData => {
                // بدلاً من doc(collection(...)) التي تنشئ ID عشوائي
                // نستخدم doc(db, "rulings", docData.id) لنحدد نحن الـ ID
                const docRef = doc(db, "rulings", docData.id);
                
                // set بدلاً من add لضمان التحديث لو كان موجوداً
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
                progressBar.style.width = Math.round(((i+1)/batches.length)*100) + "%";
            }

            statusText.innerText = "تمت المزامنة بنجاح! ✅ (لن يتم تكرار البيانات)";
            alert(`تم معالجة ${allRows.length} سجل. البيانات المكررة تم تحديثها، والجديدة تم إضافتها.`);

        } catch (err) {
            console.error(err);
            statusText.innerText = "خطأ: " + err.message;
        }
    };
    reader.readAsArrayBuffer(file);
};

function generateKeywords(caseNum, year, p, d, dec, date) {
    let text = `${caseNum} ${year} ${p} ${d} ${dec} ${date}`;
    return text.split(" ")
        .map(w => w.trim())
        .filter(w => w.length > 2);
}

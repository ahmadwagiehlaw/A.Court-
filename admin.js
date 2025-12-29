import { db } from "./firebase-config.js";
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const statusArea = document.getElementById('statusArea'); // 1. استدعينا العنصر الأب
    
    if (!fileInput.files.length) { alert("اختر الملف أولاً"); return; }

    const file = fileInput.files[0];
    const fileName = file.name.replace(/\.[^/.]+$/, ""); 
    const sessionDate = fileName.trim(); 

    // 2. أهم خطوة: إظهار شريط التحميل وتصفيره
    statusArea.classList.remove('hidden'); 
    progressBar.style.width = "0%";
    progressBar.classList.remove('bg-green-600');
    progressBar.classList.add('bg-blue-600');

    statusText.innerText = `جاري تحليل ملف جلسة ${sessionDate}...`;
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

                        // توليد الـ ID لمنع التكرار
                        const cleanCaseNum = String(caseNum).replace(/[^a-zA-Z0-9]/g, "");
                        const cleanYear = String(year).replace(/[^a-zA-Z0-9]/g, "");
                        const cleanDate = String(sessionDate).replace(/[^a-zA-Z0-9-]/g, "");
                        const docID = `${cleanCaseNum}_${cleanYear}_${cleanDate}`;

                        const record = {
                            id: docID,
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
                statusText.classList.add("text-red-600");
                return;
            }

            statusText.innerText = `جاري معالجة ${allRows.length} حكم...`;
            
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

            // تنفيذ الرفع وتحديث الشريط
            for (let i = 0; i < batches.length; i++) {
                await batches[i].commit();
                // تحديث النسبة المئوية
                let percent = Math.round(((i+1)/batches.length)*100);
                progressBar.style.width = percent + "%";
                statusText.innerText = `تم رفع ${percent}% ...`;
            }

            statusText.innerText = "تم الرفع بنجاح! ✅";
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-green-600');
            alert(`تم الانتهاء! تمت معالجة ${allRows.length} حكم.`);

        } catch (err) {
            console.error(err);
            statusText.innerText = "خطأ: " + err.message;
            statusText.classList.add("text-red-600");
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

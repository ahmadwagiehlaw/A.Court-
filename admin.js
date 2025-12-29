import { db } from "./firebase-config.js";
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    
    if (!fileInput.files.length) { alert("اختر الملف أولاً"); return; }

    const file = fileInput.files[0];
    
    // --- الذكاء البرمجي: استخراج التاريخ من اسم الملف ---
    // اسم الملف: "2-9-2024.xlsx" -> النتيجة: "2-9-2024"
    // ولو الاسم فيه كلام زيادة مثل "2-9-2024 اجندة" سيأخذه كما هو
    const fileName = file.name.replace(/\.[^/.]+$/, ""); // حذف الامتداد
    const sessionDate = fileName; // سنستخدم هذا المتغير

    statusText.innerText = `جاري استخراج البيانات من جلسة: ${sessionDate}...`;
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

                // البحث عن رأس الجدول
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
                        const year = cleanRow['سنة'] || cleanRow['السنة'] || '';
                        const plaintiff = cleanRow['مقام من'] || cleanRow['المدعي'] || '';
                        const defendant = cleanRow['ضد'] || cleanRow['المدعى عليه'] || '';
                        const decision = (cleanRow['القرار الصادر'] || '') + ' ' + (cleanRow['القرار الصادر 2'] || '');
                        const judge = cleanRow['أسم العضو'] || cleanRow['اسم العضو'] || '';

                        const record = {
                            caseNumber: String(caseNum).trim(),
                            year: String(year).trim(),
                            plaintiff: String(plaintiff).trim(),
                            defendant: String(defendant).trim(),
                            decision: String(decision).trim(),
                            judge: String(judge).trim(),
                            
                            // --- إضافة حقل التاريخ الجديد ---
                            sessionDate: sessionDate, // أخذناه من اسم الملف
                            
                            uploadedAt: new Date(),
                            // نضيف التاريخ لكلمات البحث أيضاً
                            searchKeywords: generateKeywords(caseNum, year, plaintiff, defendant, decision, sessionDate)
                        };
                        allRows.push(record);
                    }
                });
            });

            if (allRows.length === 0) {
                statusText.innerText = "لم يتم العثور على بيانات!";
                statusText.classList.add("text-red-600");
                return;
            }

            statusText.innerText = `جاري رفع ${allRows.length} حكم لتاريخ ${sessionDate}...`;
            
            const batchSize = 450; 
            let batches = [];
            let currentBatch = writeBatch(db);
            let count = 0;

            allRows.forEach(docData => {
                const docRef = doc(collection(db, "rulings"));
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

            statusText.innerText = "تم الرفع بنجاح! ✅";
            alert(`تم رفع الجلسة ${sessionDate} بنجاح.`);

        } catch (err) {
            console.error(err);
            statusText.innerText = "خطأ: " + err.message;
        }
    };
    reader.readAsArrayBuffer(file);
};

function generateKeywords(caseNum, year, p, d, dec, date) {
    // دمجنا التاريخ في البحث
    let text = `${caseNum} ${year} ${p} ${d} ${dec} ${date}`;
    return text.split(" ")
        .map(w => w.trim())
        .filter(w => w.length > 2);
}

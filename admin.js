// admin.js
import { db } from "./firebase-config.js";
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    
    if (!fileInput.files.length) { alert("اختر الملف أولاً"); return; }

    statusText.innerText = "جاري القراءة...";
    statusText.classList.remove("text-red-600");
    
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let allRows = [];

            // اللف على كل الشيتات
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // قراءة كصفوف خام

                // 1. البحث عن رقم الصف الذي يحتوي على "رقم الطعن"
                let headerIndex = -1;
                for (let i = 0; i < jsonSheet.length && i < 30; i++) {
                    const rowStr = JSON.stringify(jsonSheet[i]);
                    // نبحث عن كلمات مميزة في الرول
                    if (rowStr.includes("رقم الطعن") || rowStr.includes("سنة") || rowStr.includes("مقام من")) {
                        headerIndex = i;
                        console.log(`تم العثور على بداية الجدول في الشيت ${sheetName} عند الصف ${i}`);
                        break;
                    }
                }

                if (headerIndex === -1) return; // تخطي الشيت لو مفيهوش جدول

                // 2. قراءة البيانات الحقيقية
                const rawData = XLSX.utils.sheet_to_json(worksheet, { range: headerIndex });

                // 3. تنظيف البيانات
                rawData.forEach(row => {
                    // تنظيف المفاتيح من المسافات
                    let cleanRow = {};
                    for (let key in row) {
                        cleanRow[key.trim()] = row[key];
                    }

                    // استخراج البيانات المهمة
                    const caseNum = cleanRow['رقم الطعن'] || cleanRow['الطعن'];
                    
                    if (caseNum) { // فقط لو فيه رقم طعن
                        const year = cleanRow['سنة'] || cleanRow['السنة'] || '';
                        const plaintiff = cleanRow['مقام من'] || cleanRow['المدعي'] || '';
                        const defendant = cleanRow['ضد'] || cleanRow['المدعى عليه'] || '';
                        const decision = (cleanRow['القرار الصادر'] || '') + ' ' + (cleanRow['القرار الصادر 2'] || '');
                        const judge = cleanRow['أسم العضو'] || cleanRow['اسم العضو'] || '';

                        // تكوين الكائن النهائي
                        const record = {
                            caseNumber: String(caseNum).trim(),
                            year: String(year).trim(),
                            plaintiff: String(plaintiff).trim(),
                            defendant: String(defendant).trim(),
                            decision: String(decision).trim(),
                            judge: String(judge).trim(),
                            uploadedAt: new Date(),
                            // كلمات البحث (مهمة جداً)
                            searchKeywords: generateKeywords(caseNum, year, plaintiff, defendant, decision)
                        };
                        allRows.push(record);
                    }
                });
            });

            if (allRows.length === 0) {
                statusText.innerText = "لم يتم العثور على بيانات! تأكد من شكل الجدول.";
                statusText.classList.add("text-red-600");
                return;
            }

            // 4. الرفع لفايربيس (Batch Upload)
            statusText.innerText = `جاري رفع ${allRows.length} حكم...`;
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

            // تنفيذ الرفع
            for (let i = 0; i < batches.length; i++) {
                await batches[i].commit();
                progressBar.style.width = Math.round(((i+1)/batches.length)*100) + "%";
            }

            statusText.innerText = "تم الرفع بنجاح! ✅";
            alert("تم رفع البيانات بنجاح، يمكنك البحث الآن.");

        } catch (err) {
            console.error(err);
            statusText.innerText = "حدث خطأ: " + err.message;
        }
    };
    reader.readAsArrayBuffer(file);
};

// دالة مساعدة لتوليد كلمات البحث
function generateKeywords(caseNum, year, p, d, dec) {
    let text = `${caseNum} ${year} ${p} ${d} ${dec}`;
    return text.split(" ")
        .map(w => w.trim())
        .filter(w => w.length > 2); // نخزن الكلمات الأكبر من حرفين
}

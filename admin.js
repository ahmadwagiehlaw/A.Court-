import { db } from "./firebase-config.js";
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const statusArea = document.getElementById('statusArea');
    
    if (!fileInput.files.length) { alert("من فضلك اختر ملفاً أولاً"); return; }

    const file = fileInput.files[0];
    // اسم الملف كاحتياطي لو "مصدر البيانات" فاضي
    const fileName = file.name.replace(/\.[^/.]+$/, "").trim(); 

    // إعداد الواجهة
    statusArea.classList.remove('hidden');
    progressBar.style.width = "0%";
    progressBar.classList.remove('bg-green-600'); 
    progressBar.classList.add('bg-blue-600');
    statusText.innerText = `جاري قراءة الملف...`;
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

                // البحث عن بداية الجدول (الصف الذي يحتوي على "رقم الطعن")
                let headerIndex = -1;
                for (let i = 0; i < jsonSheet.length && i < 30; i++) {
                    const rowStr = JSON.stringify(jsonSheet[i]);
                    if (rowStr.includes("رقم الطعن")) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) return; // تخطي الشيت لو مفيهوش جدول

                const rawData = XLSX.utils.sheet_to_json(worksheet, { range: headerIndex });

                rawData.forEach(row => {
                    // تنظيف مفاتيح الصف (إزالة المسافات من أسماء الأعمدة)
                    let cleanRow = {};
                    for (let key in row) cleanRow[key.trim()] = row[key];

                    // قراءة البيانات حسب الأسماء الجديدة
                    const caseNum = cleanRow['رقم الطعن'];
                    
                    if (caseNum) {
                        const sessionDate = cleanRow['تاريخ الجلسة'] || ''; // العمود الجديد
                        const year = cleanRow['السنة'] || '0';
                        const plaintiff = cleanRow['الطاعن'] || '';
                        const defendant = cleanRow['المطعون ضده'] || '';
                        const judge = cleanRow['القاضي'] || '';
                        const roll = cleanRow['الرول'] || '';
                        const dataClass = cleanRow['تصنيف البيانات'] || '';
                        const notes = cleanRow['Notes'] || cleanRow['ملاحظات'] || '';
                        const distLetter = cleanRow['حرف التوزيع'] || '';
                        
                        // مصدر البيانات: لو العمود فاضي، نأخذه من اسم الملف أو اسم الشيت
                        const source = cleanRow['مصدر البيانات'] || sheetName; 

                        // دمج الحكم 1 والحكم 2
                        const decisionPart1 = cleanRow['الحكم'] || '';
                        const decisionPart2 = cleanRow['الحكم 2'] || '';
                        const fullDecision = (decisionPart1 + ' ' + decisionPart2).trim();

                        // توليد ID فريد (يعتمد على الرقم والسنة والتاريخ)
                        const cleanCaseNum = String(caseNum).replace(/[^a-zA-Z0-9]/g, "");
                        const cleanYear = String(year).replace(/[^a-zA-Z0-9]/g, "");
                        const cleanDate = String(sessionDate).replace(/[^a-zA-Z0-9-]/g, "");
                        
                        // الـ ID: رقم_سنة_تاريخ (لضمان عدم التكرار لنفس الجلسة)
                        const docID = `${cleanCaseNum}_${cleanYear}_${cleanDate}`;

                        const record = {
                            id: docID,
                            caseNumber: String(caseNum).trim(),
                            year: String(year).trim(),
                            sessionDate: String(sessionDate).trim(), // تاريخ الجلسة
                            dataSource: String(source).trim(),       // مصدر البيانات
                            dataClass: String(dataClass).trim(),     // التصنيف
                            roll: String(roll).trim(),               // الرول
                            plaintiff: String(plaintiff).trim(),
                            defendant: String(defendant).trim(),
                            decision: fullDecision,                  // الحكم المدمج
                            judge: String(judge).trim(),
                            notes: String(notes).trim(),             // ملاحظات
                            distLetter: String(distLetter).trim(),   // حرف التوزيع
                            uploadedAt: new Date(),
                            
                            // كلمات البحث (للبحث الجزئي والشامل)
                            searchKeywords: generateKeywords(caseNum, year, plaintiff, defendant, fullDecision, sessionDate)
                        };
                        allRows.push(record);
                    }
                });
            });

            if (allRows.length === 0) {
                statusText.innerText = "لم يتم العثور على بيانات! تأكد من وجود عمود 'رقم الطعن'";
                statusText.classList.add("text-red-600");
                return;
            }

            // الرفع (Batch Upload)
            statusText.innerText = `جاري رفع ${allRows.length} سجل...`;
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
                statusText.innerText = `تم رفع ${percent}% ...`;
            }

            statusText.innerText = "تم التحديث بنجاح! ✅";
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-green-600');
            alert(`تمت العملية بنجاح. العدد: ${allRows.length}`);

        } catch (err) {
            console.error(err);
            statusText.innerText = "خطأ: " + err.message;
            statusText.classList.add("text-red-600");
        }
    };
    reader.readAsArrayBuffer(file);
};

// دالة توليد كلمات البحث (بحث جزئي وكامل)
function generateKeywords(caseNum, year, p, d, dec, date) {
    let keywords = [];
    
    // 1. تجزئة رقم الطعن للبحث الجزئي (1, 12, 123...)
    let c = String(caseNum).trim();
    for (let i = 1; i <= c.length; i++) {
        keywords.push(c.substring(0, i));
    }

    // 2. باقي الكلمات
    let text = `${year} ${p} ${d} ${dec} ${date}`;
    // تنظيف النص وتقسيمه لكلمات
    let otherWords = text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ') // إبقاء العربية والإنجليزية والأرقام
                         .split(/\s+/)
                         .filter(w => w.length > 2);

    return [...keywords, ...otherWords];
}

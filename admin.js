import { db } from "./firebase-config.js";
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const statusArea = document.getElementById('statusArea');
    
    if (!fileInput.files.length) { alert("من فضلك اختر ملفاً أولاً"); return; }

    const file = fileInput.files[0];
    const fileName = file.name.replace(/\.[^/.]+$/, "").trim(); // اسم الملف كاحتياطي

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

                // 1. البحث عن الصف الذي يحتوي على العناوين الرئيسية
                let headerIndex = -1;
                for (let i = 0; i < jsonSheet.length && i < 50; i++) {
                    const rowStr = JSON.stringify(jsonSheet[i]);
                    // نتأكد إن ده صف العناوين بوجود عمودين أساسيين على الأقل
                    if (rowStr.includes("رقم الطعن") && (rowStr.includes("السنة") || rowStr.includes("الطاعن"))) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) {
                    console.warn(`الشيت ${sheetName} لا يحتوي على جدول بيانات معروف.`);
                    return; 
                }

                // قراءة البيانات بدءاً من صف العناوين
                const rawData = XLSX.utils.sheet_to_json(worksheet, { range: headerIndex });

                rawData.forEach(row => {
                    // تنظيف مفاتيح الصف (إزالة المسافات الزائدة من أسماء الأعمدة)
                    let cleanRow = {};
                    for (let key in row) {
                        cleanRow[key.toString().trim()] = row[key];
                    }

                    // --- تعيين البيانات للمتغيرات بدقة ---
                    // البيانات الأساسية (Core Data)
                    const caseNum = cleanRow['رقم الطعن'];
                    const year = cleanRow['السنة'] || '0';
                    const sessionDate = cleanRow['تاريخ الجلسة'] || fileName; // الأولوية للعمود، ثم اسم الملف
                    
                    if (caseNum) {
                        // البيانات النصية
                        const plaintiff = cleanRow['الطاعن'] || '';
                        const defendant = cleanRow['المطعون ضده'] || '';
                        
                        // دمج الحكم
                        const decision1 = cleanRow['الحكم'] || '';
                        const decision2 = cleanRow['الحكم 2'] || '';
                        const fullDecision = (decision1 + ' ' + decision2).trim();

                        // البيانات الهامشية (Marginal Data)
                        const judge = cleanRow['القاضي'] || '';
                        const notes = cleanRow['Notes'] || cleanRow['ملاحظات'] || '';
                        const roll = cleanRow['الرول'] || '';
                        const dataClass = cleanRow['تصنيف البيانات'] || '';
                        const source = cleanRow['مصدر البيانات'] || sheetName;

                        // --- إنشاء ID فريد ---
                        // الـ ID = رقم الطعن + السنة + تاريخ الجلسة
                        // نستخدم دالة تنظيف لإزالة أي رموز غريبة قد تكسر الـ ID
                        const sanitize = (str) => String(str).replace(/[^a-zA-Z0-9]/g, "");
                        const docID = `${sanitize(caseNum)}_${sanitize(year)}_${sanitize(sessionDate)}`;

                        const record = {
                            id: docID,
                            // الحقول كما طلبتها بالضبط
                            caseNumber: String(caseNum).trim(),
                            year: String(year).trim(),
                            sessionDate: String(sessionDate).trim(),
                            plaintiff: String(plaintiff).trim(),
                            defendant: String(defendant).trim(),
                            decision: fullDecision,
                            // الحقول الهامشية
                            judge: String(judge).trim(),
                            notes: String(notes).trim(),
                            roll: String(roll).trim(),
                            dataClass: String(dataClass).trim(),
                            dataSource: String(source).trim(),
                            uploadedAt: new Date(),
                            
                            // كلمات البحث (نبحث في الأساسيات فقط للسرعة والدقة)
                            searchKeywords: generateKeywords(caseNum, year, plaintiff, defendant, fullDecision)
                        };
                        allRows.push(record);
                    }
                });
            });

            if (allRows.length === 0) {
                statusText.innerText = "الملف لا يحتوي على بيانات أو أسماء الأعمدة غير مطابقة!";
                statusText.classList.add("text-red-600");
                return;
            }

            // --- مرحلة الرفع ---
            statusText.innerText = `جاري رفع ${allRows.length} سجل...`;
            const batchSize = 450; 
            let batches = [];
            let currentBatch = writeBatch(db);
            let count = 0;

            allRows.forEach(docData => {
                const docRef = doc(db, "rulings", docData.id);
                currentBatch.set(docRef, docData); // Set لتحديث البيانات لو مكررة
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
            alert(`تم بنجاح معالجة ${allRows.length} حكم.`);

        } catch (err) {
            console.error(err);
            statusText.innerText = "خطأ تقني: " + err.message;
            statusText.classList.add("text-red-600");
        }
    };
    reader.readAsArrayBuffer(file);
};

// دالة توليد كلمات البحث (معدلة للبحث الجزئي)
function generateKeywords(caseNum, year, p, d, dec) {
    let keywords = [];
    
    // 1. بحث جزئي برقم الطعن
    let c = String(caseNum).trim();
    for (let i = 1; i <= c.length; i++) {
        keywords.push(c.substring(0, i));
    }

    // 2. الكلمات النصية (الطاعن، المطعون ضده، الحكم)
    let text = `${year} ${p} ${d} ${dec}`;
    // نسمح بالأحرف العربية والإنجليزية والأرقام
    let otherWords = text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ') 
                         .split(/\s+/)
                         .filter(w => w.length > 2); // نتجاهل الكلمات القصيرة جداً

    return [...keywords, ...otherWords];
}

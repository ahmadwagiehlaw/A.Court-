import { db } from "./firebase-config.js";
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const statusArea = document.getElementById('statusArea');
    
    if (!fileInput.files.length) { alert("من فضلك اختر ملفاً أولاً"); return; }

    const file = fileInput.files[0];
    // اسم الملف كاحتياطي لو عمود التاريخ فاضي
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
                // قراءة أولية لتحديد مكان الهيدر
                const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                let headerIndex = -1;
                for (let i = 0; i < jsonSheet.length && i < 50; i++) {
                    const rowStr = JSON.stringify(jsonSheet[i]);
                    if (rowStr.includes("رقم الطعن") && (rowStr.includes("السنة") || rowStr.includes("الطاعن"))) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) {
                    console.warn(`الشيت ${sheetName} لا يحتوي على جدول بيانات معروف.`);
                    return; 
                }

                // =====================================================================
                // التعديل الهام جداً هنا: إصلاح قراءة التواريخ
                // =====================================================================
                // أضفنا { raw: false } لكي يقرأ التاريخ كنص منسق كما يظهر في الإكسل
                const rawData = XLSX.utils.sheet_to_json(worksheet, { 
                    range: headerIndex,
                    raw: false, // هذا هو السر! يمنع قراءة التاريخ كرقم غريب
                    dateNF: 'dd/mm/yyyy' // تنسيق احتياطي لو احتاج الامر
                });

                rawData.forEach(row => {
                    let cleanRow = {};
                    for (let key in row) {
                        cleanRow[key.toString().trim()] = row[key];
                    }

                    const caseNum = cleanRow['رقم الطعن'];
                    const year = cleanRow['السنة'] || '0';
                    
                    // الآن هذا المتغير سيحمل التاريخ بشكل صحيح (مثلاً: 15/03/2024)
                    // الأولوية للعمود، ولو فاضي يأخذ اسم الملف
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

                        // ID فريد
                        const sanitize = (str) => String(str).replace(/[^a-zA-Z0-9]/g, "");
                        // نستخدم التاريخ النظيف في الـ ID
                        const docID = `${sanitize(caseNum)}_${sanitize(year)}_${sanitize(sessionDate)}`;

                        const record = {
                            id: docID,
                            caseNumber: String(caseNum).trim(),
                            year: String(year).trim(),
                            sessionDate: String(sessionDate).trim(), // سيتم تخزينه الآن بشكل صحيح
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
                statusText.classList.add("text-red-600");
                return;
            }

            // الرفع
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
            alert(`تم إصلاح التواريخ ورفع ${allRows.length} حكم بنجاح.`);

        } catch (err) {
            console.error(err);
            statusText.innerText = "خطأ تقني: " + err.message;
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

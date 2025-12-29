import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDrqEXzA5Js-0gw2Qm7QhXZwq4SWhbpIlk",
  authDomain: "a-courtsearch.firebaseapp.com",
  projectId: "a-courtsearch",
  storageBucket: "a-courtsearch.firebasestorage.app",
  messagingSenderId: "711752634270",
  appId: "1:711752634270:web:e1890acac484821974d08f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const statusArea = document.getElementById('statusArea');

    if (!fileInput.files.length) {
        alert("من فضلك اختر ملف إكسل أولاً");
        return;
    }

    statusArea.classList.remove('hidden');
    statusText.innerText = "جاري قراءة الملف...";
    progressBar.style.width = "0%";
    progressBar.classList.remove('bg-green-600');
    progressBar.classList.add('bg-blue-600');

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            let allRulings = []; // تجميع كل الأحكام من كل الشيتات

            // التكرار على جميع الشيتات في الملف
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                
                // 1. البحث عن رقم الصف الذي يحتوي على العناوين
                // نحول الشيت لمصفوفة مصفوفات (Array of Arrays) للبحث السهل
                const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                let headerRowIndex = -1;
                for (let i = 0; i < jsonSheet.length && i < 20; i++) { // نبحث في أول 20 صف فقط
                    const row = jsonSheet[i];
                    // نتأكد أن الصف فيه بيانات ونبحث عن كلمة مميزة مثل "رقم الطعن" أو "القرار"
                    const rowString = JSON.stringify(row); 
                    if (rowString.includes("رقم الطعن") || rowString.includes("الطعن") || rowString.includes("مقام من")) {
                        headerRowIndex = i;
                        console.log(`تم العثور على بداية الجدول في الشيت "${sheetName}" عند الصف رقم ${i + 1}`);
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    console.warn(`تخطى الشيت "${sheetName}": لم يتم العثور على رأس الجدول.`);
                    return; // تخطي هذا الشيت
                }

                // 2. قراءة البيانات بداية من صف العناوين
                // نستخدم range لتحديد بداية القراءة
                const rawData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });

                // 3. تنظيف البيانات وتوحيد الأسماء
                const cleanData = rawData.map(row => {
                    const newRow = {};
                    // تنظيف المفاتيح (Headers)
                    for (let key in row) {
                        newRow[key.trim()] = row[key];
                    }
                    return newRow;
                }).filter(row => {
                    // تصفية الصفوف الفارغة أو التي لا تحتوي على رقم طعن
                    const caseNum = row['رقم الطعن'] || row['الطعن'];
                    return caseNum !== undefined && caseNum !== null; 
                });

                // 4. تحويل البيانات للصيغة النهائية (Mapping)
                cleanData.forEach(row => {
                    const caseNum = row['رقم الطعن'] || row['الطعن'] || '';
                    const yearVal = row['سنة'] || row['السنة'] || '';
                    const plaintiffVal = row['مقام من'] || row['المدعي'] || '';
                    const defendantVal = row['ضد'] || row['المدعى عليه'] || '';
                    const dec1 = row['القرار الصادر'] || '';
                    const dec2 = row['القرار الصادر 2'] || '';
                    const judgeName = row['أسم العضو'] || row['اسم العضو'] || '';

                    // دمج القرارات
                    let fullDecision = (String(dec1) + ' ' + String(dec2)).trim();
                    if (fullDecision === 'undefined undefined') fullDecision = '';

                    const record = {
                        caseNumber: String(caseNum).trim(),
                        year: String(yearVal).trim(),
                        plaintiff: String(plaintiffVal).trim(),
                        defendant: String(defendantVal).trim(),
                        decision: fullDecision,
                        judge: String(judgeName).trim(),
                        sourceSheet: sheetName, // للاحتفاظ باسم الشيت المأخوذ منه
                        uploadedAt: new Date()
                    };

                    // كلمات البحث
                    let keywords = [
                        record.caseNumber, 
                        record.year, 
                        ...record.plaintiff.split(' '), 
                        ...record.defendant.split(' '),
                        ...record.decision.split(' ')
                    ];
                    
                    record.searchKeywords = keywords
                        .map(k => String(k).trim())
                        .filter(k => k && k.length > 2); // تخزين الكلمات أكبر من حرفين

                    allRulings.push(record);
                });
            });

            if (allRulings.length === 0) {
                alert("لم يتم العثور على أي أحكام صالحة في الملف! تأكد من أسماء الأعمدة.");
                statusText.innerText = "فشل القراءة.";
                return;
            }

            statusText.innerText = `جاري رفع ${allRulings.length} حكم لقاعدة البيانات...`;
            console.log("عينة من البيانات الجاهزة للرفع:", allRulings[0]);

            // عملية الرفع (Batch Upload)
            const batchSize = 450; 
            let batches = [];
            let currentBatch = writeBatch(db);
            let count = 0;

            for (let i = 0; i < allRulings.length; i++) {
                const docRef = doc(collection(db, "rulings"));
                currentBatch.set(docRef, allRulings[i]);
                count++;

                if (count === batchSize) {
                    batches.push(currentBatch);
                    currentBatch = writeBatch(db);
                    count = 0;
                }
            }
            if (count > 0) batches.push(currentBatch);

            // تنفيذ الرفع الفعلي
            let totalBatches = batches.length;
            for (let j = 0; j < totalBatches; j++) {
                await batches[j].commit();
                let percent = Math.round(((j + 1) / totalBatches) * 100);
                progressBar.style.width = percent + "%";
                statusText.innerText = `تم رفع المجموعة ${j + 1} من ${totalBatches}...`;
            }
            
            statusText.innerText = `تم بنجاح رفع ${allRulings.length} حكم! ✅`;
            progressBar.classList.add('bg-green-600');
            alert(`تم إضافة ${allRulings.length} حكم بنجاح.`);

        } catch (error) {
            console.error("Error parsing excel: ", error);
            statusText.innerText = "حدث خطأ أثناء المعالجة، راجع الـ Console";
            alert("حدث خطأ: " + error.message);
        }
    };

    reader.readAsArrayBuffer(file);
};

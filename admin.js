// استيراد دوال فايربيس الضرورية
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// إعدادات مشروعك (كما أرسلتها)
const firebaseConfig = {
  apiKey: "AIzaSyDrqEXzA5Js-0gw2Qm7QhXZwq4SWhbpIlk",
  authDomain: "a-courtsearch.firebaseapp.com",
  projectId: "a-courtsearch",
  storageBucket: "a-courtsearch.firebasestorage.app",
  messagingSenderId: "711752634270",
  appId: "1:711752634270:web:e1890acac484821974d08f"
};

// تهيئة فايربيس
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// دالة المعالجة الرئيسية
window.processExcel = async function() {
    const fileInput = document.getElementById('excelFile');
    const statusArea = document.getElementById('statusArea');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');

    if (!fileInput.files.length) {
        alert("من فضلك اختر ملف إكسل أولاً");
        return;
    }

    statusArea.classList.remove('hidden');
    statusText.innerText = "جاري قراءة الملف...";

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // قراءة أول شيت فقط
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // تحويل الإكسل إلى JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            alert("الملف فارغ!");
            return;
        }

        statusText.innerText = `تم قراءة ${jsonData.length} صف. جاري الرفع لقاعدة البيانات...`;
        
        // عملية الرفع (سنستخدم Batch لسرعة الرفع)
        // فايربيس يسمح بـ 500 عملية في الـ Batch الواحد
        const batchSize = 450; 
        let batches = [];
        let currentBatch = writeBatch(db);
        let count = 0;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // تجهيز شكل البيانات كما نريدها في قاعدة البيانات
            // نتأكد من تنظيف البيانات (مسح المسافات الزائدة)
            const record = {
                caseNumber: String(row['رقم الطعن'] || '').trim(),
                year: String(row['سنة'] || '').trim(),
                plaintiff: String(row['مقام من'] || '').trim(), // المدعي
                defendant: String(row['ضد'] || '').trim(), // المدعى عليه
                // دمج القرارين لسهولة البحث
                decision: (String(row['القرار الصادر'] || '') + ' ' + String(row['القرار الصادر 2'] || '')).trim(),
                nextSession: String(row['الجلسة القادمة'] || '').trim(),
                judge: String(row['أسم العضو'] || '').trim(),
                searchKeywords: [] // سنملؤه لاحقاً لتسهيل البحث
            };

            // إنشاء كلمات مفتاحية للبحث (Array) لتسهيل الفلترة
            // مثلاً نضيف رقم الطعن والمدعي والقرار ككلمات مفتاحية
            let keywords = [
                record.caseNumber, 
                record.year, 
                ...record.plaintiff.split(' '), 
                ...record.decision.split(' ')
            ];
            // تنظيف الكلمات المفتاحية
            record.searchKeywords = keywords.filter(k => k && k.length > 2);
            // إضافة تاريخ الرفع
            record.uploadedAt = new Date();

            // إضافة المستند للـ Batch
            const docRef = doc(collection(db, "rulings")); // "rulings" هو اسم الجدول في فايربيس
            currentBatch.set(docRef, record);
            
            count++;

            // إذا امتلأ الـ Batch، نجهزه للإرسال ونبدأ واحد جديد
            if (count === batchSize) {
                batches.push(currentBatch);
                currentBatch = writeBatch(db);
                count = 0;
            }
        }

        // إضافة آخر Batch إذا كان فيه بيانات
        if (count > 0) {
            batches.push(currentBatch);
        }

        // تنفيذ الرفع
        try {
            let totalBatches = batches.length;
            for (let j = 0; j < totalBatches; j++) {
                await batches[j].commit();
                // تحديث شريط التقدم
                let percent = Math.round(((j + 1) / totalBatches) * 100);
                progressBar.style.width = percent + "%";
                statusText.innerText = `تم رفع المجموعة ${j + 1} من ${totalBatches}...`;
            }
            
            statusText.innerText = "تم رفع جميع البيانات بنجاح! ✅";
            progressBar.classList.remove('bg-blue-600');
            progressBar.classList.add('bg-green-600');
            alert("تم الرفع بنجاح");

        } catch (error) {
            console.error("Error adding document: ", error);
            statusText.innerText = "حدث خطأ أثناء الرفع، راجع الـ Console";
            statusText.classList.add('text-red-600');
        }
    };

    reader.readAsArrayBuffer(file);
};

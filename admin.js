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
    
    if (!fileInput.files.length) {
        alert("اختر الملف أولاً");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // سنقرأ أول شيت فقط للتجربة
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // تحويل الشيت لـ JSON خام لنرى كل شيء
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // header: 1 يعطينا مصفوفة صفوف

        console.log("--- بداية تحليل الملف ---");
        
        // البحث عن صف العناوين
        let headerRow = null;
        let headerIndex = -1;

        for (let i = 0; i < 20 && i < rawData.length; i++) {
            const row = rawData[i];
            const rowStr = JSON.stringify(row);
            // طباعة كل صف لنرى ماذا يوجد بداخله
            console.log(`الصف رقم ${i}:`, row);
            
            if (rowStr.includes("رقم الطعن") || rowStr.includes("الطعن")) {
                headerRow = row;
                headerIndex = i;
                console.log(`✅ وجدنا العناوين في الصف رقم ${i}`);
                break;
            }
        }

        if (!headerRow) {
            alert("لم أتمكن من العثور على صف العناوين! راجع الكونسول.");
            return;
        }

        // قراءة البيانات الفعلية بناءً على مكان العناوين
        const realData = XLSX.utils.sheet_to_json(worksheet, { range: headerIndex });
        
        // طباعة أول صف بيانات بعد المعالجة لنرى المفاتيح
        if (realData.length > 0) {
            console.log("--- شكل البيانات التي قرأها الكود (أول صف) ---");
            console.log(realData[0]);
            console.log("--- أسماء الأعمدة الموجودة هي: ---");
            console.log(Object.keys(realData[0]));
        }

        // هنا سنعرف المشكلة.. هل الاسم "رقم الطعن" أم "رقم الطعن " (بمسافة)؟
        alert("افتح الكونسول (F12) وصور لي النتيجة، لنرى أسماء الأعمدة بالضبط.");
    };

    reader.readAsArrayBuffer(file);
};

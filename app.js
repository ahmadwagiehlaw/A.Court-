// app.js
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// دالة البحث الرئيسية
window.searchRulings = async function() {
    const inputVal = document.getElementById('searchInput').value.trim();
    const resultsArea = document.getElementById('resultsArea');
    
    if (inputVal.length < 1) { 
        alert("اكتب كلمة للبحث"); 
        return; 
    }
    
    // مؤشر التحميل
    resultsArea.innerHTML = `
        <div class="text-center py-10">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mx-auto"></div>
            <p class="mt-2 text-gray-500">جاري البحث...</p>
        </div>`;

    try {
        // البحث داخل مصفوفة الكلمات المفتاحية
        const q = query(
            collection(db, "rulings"),
            where("searchKeywords", "array-contains", inputVal),
            limit(30) // أقصى عدد نتائج
        );

        const querySnapshot = await getDocs(q);
        resultsArea.innerHTML = ''; // مسح اللودر

        if (querySnapshot.empty) {
            resultsArea.innerHTML = `
                <div class="text-center py-8 bg-white rounded shadow">
                    <p class="text-lg text-gray-600">لا توجد نتائج مطابقة لـ "${inputVal}"</p>
                </div>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dateDisplay = data.sessionDate || 'غير محدد';
            
            // تصميم الكارت
            const card = `
                <div class="bg-white p-5 rounded-lg shadow-md border-r-4 border-yellow-500 hover:shadow-xl transition-all duration-300">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-bold text-xl text-gray-800">
                                طعن رقم ${data.caseNumber} 
                                <span class="text-sm font-normal text-gray-500 mr-2">سنة ${data.year}</span>
                            </h3>
                        </div>
                        <div class="bg-blue-50 text-blue-900 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                            جلسة: ${dateDisplay}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700 mb-4 bg-gray-50 p-3 rounded border border-gray-100">
                        <p><span class="font-bold text-gray-900">المدعي:</span> ${data.plaintiff}</p>
                        <p><span class="font-bold text-gray-900">ضد:</span> ${data.defendant}</p>
                        <p class="md:col-span-2"><span class="font-bold text-gray-900">عضو الدائرة:</span> ${data.judge}</p>
                    </div>

                    <div class="mt-2">
                        <h4 class="text-xs font-bold text-gray-400 uppercase mb-1">القرار / المنطوق:</h4>
                        <p class="text-gray-800 leading-relaxed text-sm font-medium pr-2 border-r-2 border-gray-300">
                            ${data.decision || 'لا يوجد تفاصيل للقرار'}
                        </p>
                    </div>
                </div>
            `;
            resultsArea.innerHTML += card;
        });

    } catch (e) {
        console.error("Search Error:", e);
        // التحقق مما إذا كان الخطأ بسبب الفهرسة
        if(e.message.includes("index")) {
            resultsArea.innerHTML = '<p class="text-red-600 text-center font-bold">⚠️ خطأ: قاعدة البيانات تحتاج لفهرسة (Index). راجع الـ Console.</p>';
        } else {
            resultsArea.innerHTML = '<p class="text-red-500 text-center">حدث خطأ في الاتصال. تأكد من الإنترنت.</p>';
        }
    }
};

// دالة الفلترة السريعة (مربوطة بأزرار السنوات)
window.filterByYear = function(year) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = year;
    window.searchRulings();
};

// تشغيل زر Enter
document.getElementById('searchInput').addEventListener("keypress", (e) => {
    if (e.key === "Enter") window.searchRulings();
});

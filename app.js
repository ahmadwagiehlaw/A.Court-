// app.js
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.searchRulings = async function() {
    const inputVal = document.getElementById('searchInput').value.trim();
    const resultsArea = document.getElementById('resultsArea');
    
    if (inputVal.length < 2) { alert("اكتب كلمة بحث أوضح"); return; }
    
    resultsArea.innerHTML = '<p class="text-center text-gray-500">جاري البحث...</p>';

    try {
        const q = query(
            collection(db, "rulings"),
            where("searchKeywords", "array-contains", inputVal), // بحث دقيق في الكلمات
            limit(20)
        );

        const querySnapshot = await getDocs(q);
        resultsArea.innerHTML = ''; // مسح رسالة التحميل

        if (querySnapshot.empty) {
            resultsArea.innerHTML = '<p class="text-center">لا توجد نتائج.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            // تحسين عرض التاريخ (لو كان طويلاً نختصره)
    const displayDate = data.sessionDate || 'غير محدد';

    const card = `
        <div class="bg-white p-5 rounded-lg shadow-md mb-4 border-r-4 border-yellow-500 hover:shadow-xl transition-shadow duration-300">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="font-bold text-xl text-gray-800">
                        طعن رقم ${data.caseNumber} 
                        <span class="text-sm font-normal text-gray-500 mr-2">سنة ${data.year}</span>
                    </h3>
                </div>
                <div class="bg-blue-100 text-blue-900 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                    جلسة: ${displayDate}
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm text-gray-700 mb-4 bg-gray-50 p-3 rounded border border-gray-100">
                <p><span class="font-bold text-gray-900">المدعي:</span> ${data.plaintiff}</p>
                <p><span class="font-bold text-gray-900">ضد:</span> ${data.defendant}</p>
                <p class="md:col-span-2"><span class="font-bold text-gray-900">عضو الدائرة:</span> ${data.judge}</p>
            </div>

            <div class="mt-2">
                <h4 class="text-xs font-bold text-gray-400 uppercase mb-1">منطوق الحكم/القرار:</h4>
                <p class="text-gray-800 leading-relaxed text-sm font-medium border-r-2 border-gray-300 pr-3">
                    ${data.decision || 'لا يوجد قرار مسجل'}
                </p>
            </div>
        </div>
    `;
    resultsArea.innerHTML += card;
});

    } catch (e) {
        console.error(e);
        resultsArea.innerHTML = '<p class="text-red-500 text-center">حدث خطأ في الاتصال.</p>';
    }
};

// تشغيل زر Enter للبحث
document.getElementById('searchInput').addEventListener("keypress", (e) => {
    if (e.key === "Enter") window.searchRulings();
});

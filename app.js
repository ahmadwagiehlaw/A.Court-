import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let debounceTimer;

// دالة البحث (تعمل أوتوماتيكياً)
window.searchRulings = async function() {
    const inputVal = document.getElementById('searchInput').value.trim();
    const resultsArea = document.getElementById('resultsArea');
    
    // لو مسح الكلام، نخفي النتائج
    if (inputVal.length < 1) { 
        resultsArea.innerHTML = '';
        return; 
    }
    
    // مؤشر تحميل صغير
    resultsArea.innerHTML = `
        <div class="flex justify-center items-center py-6 text-gray-500">
            <svg class="animate-spin h-5 w-5 mr-3 text-blue-900" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            جاري البحث...
        </div>`;

    try {
        const q = query(
            collection(db, "rulings"),
            where("searchKeywords", "array-contains", inputVal),
            limit(20)
        );

        const querySnapshot = await getDocs(q);
        resultsArea.innerHTML = ''; 

        if (querySnapshot.empty) {
            resultsArea.innerHTML = `
                <div class="text-center py-4 bg-white rounded shadow text-gray-500 text-sm">
                    لا توجد نتائج لـ "${inputVal}"
                </div>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // تنسيق القيم الفارغة
            const show = (val) => val && val !== 'undefined' ? val : '-';

            const card = `
                <div class="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 mb-3 border border-gray-200 overflow-hidden">
                    
                    <div class="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-blue-900 text-lg">📝 ${data.caseNumber}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">سنة ${data.year}</span>
                            ${data.dataClass ? `<span class="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">${data.dataClass}</span>` : ''}
                        </div>
                        <div class="text-xs text-gray-500 font-bold">
                            📅 ${show(data.sessionDate)}
                        </div>
                    </div>

                    <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700">
                        <p><span class="font-bold text-gray-400 ml-1">الطاعن:</span> ${show(data.plaintiff)}</p>
                        <p><span class="font-bold text-gray-400 ml-1">المطعون ضده:</span> ${show(data.defendant)}</p>
                        <p><span class="font-bold text-gray-400 ml-1">القاضي:</span> ${show(data.judge)}</p>
                        <p><span class="font-bold text-gray-400 ml-1">الرول:</span> ${show(data.roll)} | <span class="font-bold text-gray-400 ml-1">توزيع:</span> ${show(data.distLetter)}</p>
                    </div>

                    <div class="px-4 pb-2">
                        <div class="bg-yellow-50 p-3 rounded border border-yellow-100 text-gray-800 text-sm leading-relaxed">
                            <span class="font-bold text-yellow-700 block mb-1 text-xs">منطوق الحكم:</span>
                            ${show(data.decision)}
                        </div>
                    </div>

                    <div class="px-4 py-2 bg-gray-50 text-xs text-gray-400 flex justify-between border-t border-gray-100">
                        <span>🏷️ المصدر: ${show(data.dataSource)}</span>
                        ${data.notes ? `<span class="text-red-400 font-bold">⚠️ ${data.notes}</span>` : ''}
                    </div>
                </div>
            `;
            resultsArea.innerHTML += card;
        });

    } catch (e) {
        console.error(e);
        if(e.message.includes("index")) {
            resultsArea.innerHTML = '<div class="p-4 bg-red-100 text-red-700 rounded text-center text-sm">مطلوب تفعيل الفهرسة (Index). راجع الـ Console.</div>';
        }
    }
};

// --- تفعيل البحث اللحظي (Debounce) ---
// هذا الكود يجعل البحث يعمل وأنت تكتب، لكن ينتظر قليلاً لعدم إرهاق السيرفر
const searchInput = document.getElementById('searchInput');

searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    // انتظر 300 مللي ثانية بعد التوقف عن الكتابة ثم ابحث
    debounceTimer = setTimeout(() => {
        window.searchRulings();
    }, 400); 
});

// الفلترة بالسنة
window.filterByYear = function(year) {
    searchInput.value = year;
    window.searchRulings();
};

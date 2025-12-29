import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let debounceTimer;

// دالة البحث التلقائي
window.searchRulings = async function() {
    const inputVal = document.getElementById('searchInput').value.trim();
    const resultsArea = document.getElementById('resultsArea');
    
    // إخفاء النتائج لو مربع البحث فارغ
    if (inputVal.length < 1) { 
        resultsArea.innerHTML = '';
        return; 
    }
    
    // لودر التحميل
    resultsArea.innerHTML = `
        <div class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
            <span class="mr-3 text-gray-600 font-bold">جاري البحث...</span>
        </div>`;

    try {
        const q = query(
            collection(db, "rulings"),
            where("searchKeywords", "array-contains", inputVal),
            limit(20) // أقصى عدد نتائج في المرة الواحدة
        );

        const querySnapshot = await getDocs(q);
        resultsArea.innerHTML = ''; 

        if (querySnapshot.empty) {
            resultsArea.innerHTML = `
                <div class="text-center py-6 bg-white rounded-lg shadow border border-gray-100">
                    <p class="text-gray-500">لا توجد نتائج لـ "${inputVal}"</p>
                </div>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // دالة مساعدة لعرض شرطة لو البيان فارغ
            const val = (v) => (v && v !== 'undefined') ? v : '-';

            const card = `
                <div class="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 mb-4 border border-gray-200 overflow-hidden">
                    
                    <div class="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-blue-900 text-lg">⚖️ طعن رقم ${val(data.caseNumber)}</span>
                            <span class="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">سنة ${val(data.year)}</span>
                        </div>
                        <div class="text-sm font-semibold text-gray-600">
                            جلسة: <span class="text-gray-900">${val(data.sessionDate)}</span>
                        </div>
                    </div>

                    <div class="p-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 text-sm">
                            <div class="bg-blue-50 p-2 rounded border border-blue-100">
                                <span class="text-blue-400 text-xs font-bold block">الطاعن</span>
                                <span class="font-bold text-gray-800">${val(data.plaintiff)}</span>
                            </div>
                            <div class="bg-red-50 p-2 rounded border border-red-100">
                                <span class="text-red-400 text-xs font-bold block">المطعون ضده</span>
                                <span class="font-bold text-gray-800">${val(data.defendant)}</span>
                            </div>
                        </div>

                        <div class="mb-2">
                            <h4 class="text-xs font-bold text-gray-400 uppercase mb-1">منطوق الحكم / القرار:</h4>
                            <p class="text-gray-800 text-sm font-semibold leading-relaxed bg-gray-50 p-3 rounded border-r-4 border-yellow-500">
                                ${val(data.decision)}
                            </p>
                        </div>
                    </div>

                    <div class="bg-gray-100 px-4 py-2 text-xs text-gray-500 border-t border-gray-200 flex flex-wrap gap-4 justify-between items-center">
                        <div class="flex gap-4">
                            <span>👨‍⚖️ القاضي: ${val(data.judge)}</span>
                            <span>🔢 الرول: ${val(data.roll)}</span>
                            <span>📂 التصنيف: ${val(data.dataClass)}</span>
                        </div>
                        
                        <div class="flex gap-2 items-center">
                            ${data.notes ? `<span class="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded font-bold">⚠️ ملاحظة: ${data.notes}</span>` : ''}
                            <span class="text-gray-400" title="المصدر">${val(data.dataSource)}</span>
                        </div>
                    </div>
                </div>
            `;
            resultsArea.innerHTML += card;
        });

    } catch (e) {
        console.error(e);
        if(e.message && e.message.includes("index")) {
            resultsArea.innerHTML = '<div class="text-red-600 text-center p-4">⚠️ يرجى تفعيل الفهرسة (Index) من خلال الرابط في الـ Console</div>';
        }
    }
};

// --- تفعيل البحث اللحظي (Debounce) ---
// ينتظر 400 مللي ثانية بعد التوقف عن الكتابة ثم يبحث
const searchInput = document.getElementById('searchInput');

if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            window.searchRulings();
        }, 400); 
    });
}

// دالة الفلترة بالسنة
window.filterByYear = function(year) {
    if(searchInput) {
        searchInput.value = year;
        window.searchRulings();
    }
};

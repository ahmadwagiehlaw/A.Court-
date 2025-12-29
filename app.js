import { db } from "./firebase-config.js";
// نحتاج استيراد دوال إضافية للتسجيل (addDoc, updateDoc, increment)
import { collection, query, where, getDocs, limit, orderBy, addDoc, doc, updateDoc, increment, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let debounceTimer;

// --- دالة مساعدة: الحصول على معرف زائر مجهول (لإحصائيات الزوار الفريدين) ---
function getVisitorId() {
    let visitorId = localStorage.getItem('visitor_id');
    if (!visitorId) {
        // إنشاء معرف عشوائي وحفظه في متصفح المستخدم
        visitorId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('visitor_id', visitorId);
    }
    return visitorId;
}

// --- دالة تسجيل التحليلات (Analytics Tracking) ---
async function trackSearch(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return;

    const visitorId = getVisitorId();
    const todayStr = new Date().toISOString().split('T')[0]; // مثال: 2024-01-01

    try {
        // 1. تسجيل عملية البحث في سجل مفصل
        await addDoc(collection(db, "analytics_logs"), {
            term: searchTerm,
            timestamp: new Date(),
            visitorId: visitorId,
            dateStr: todayStr // لتسهيل الفلترة اليومية
        });

        // 2. تحديث العداد العام لإجمالي عمليات البحث (للسرعة في العرض)
        const counterRef = doc(db, "analytics_counters", "general_stats");
        
        // نتأكد الأول إن وثيقة العداد موجودة
        const counterSnap = await getDoc(counterRef);
        if (!counterSnap.exists()) {
            await setDoc(counterRef, { totalSearches: 1 });
        } else {
            await updateDoc(counterRef, {
                totalSearches: increment(1)
            });
        }

        console.log("Search tracked successfully");

    } catch (e) {
        console.error("Error tracking search analytics:", e);
        // لا نريد أن نوقف تجربة المستخدم لو فشل التسجيل، لذا فقط نطبع الخطأ
    }
}


window.searchRulings = async function() {
    const searchInputElem = document.getElementById('searchInput');
    if (!searchInputElem) return;
    const inputVal = searchInputElem.value.trim();
    const resultsArea = document.getElementById('resultsArea');
    const statsArea = document.getElementById('searchStatsArea');
    
    if (inputVal.length < 1) { 
        resultsArea.innerHTML = '';
        statsArea.innerHTML = '';
        return; 
    }
    
    // --- تسجيل النشاط هنا قبل بدء البحث ---
    // نستخدم setTimeout لكي لا نؤثر على سرعة استجابة البحث اللحظي
    setTimeout(() => {
        trackSearch(inputVal);
    }, 1000); // نسجل بعد ثانية من توقف الكتابة

    resultsArea.innerHTML = `
        <div class="flex flex-col justify-center items-center py-12 opacity-70 dark:opacity-90">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-blue-900 dark:border-blue-400 mb-3"></div>
            <span class="text-gray-600 dark:text-gray-300 font-semibold animate-pulse">جاري البحث في السجلات...</span>
        </div>`;
    statsArea.innerHTML = '';

    try {
        const q = query(
            collection(db, "rulings"),
            where("searchKeywords", "array-contains", inputVal),
            limit(50)
        );

        const querySnapshot = await getDocs(q);
        resultsArea.innerHTML = ''; 

        if (querySnapshot.empty) {
            // ... (نفس كود عرض الرسالة الفارغة السابق) ...
            resultsArea.innerHTML = `
                <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-gray-500 dark:text-gray-400 text-lg font-medium">لا توجد نتائج مطابقة لـ "${inputVal}"</p>
                    <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">جرب البحث بكلمات مختلفة أو جزء من الرقم</p>
                </div>`;
             statsArea.innerHTML = `<span class="glass-effect px-4 py-2 rounded-full text-white/80 border border-white/10">0 نتائج</span>`;
            return;
        }

        let totalResults = querySnapshot.size;
        let uniqueYears = new Set();
        let uniqueJudges = new Set();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.year && data.year !== '0') uniqueYears.add(data.year);
            if (data.judge && data.judge.length > 2) uniqueJudges.add(data.judge);
            
            const val = (v) => (v && v !== 'undefined') ? v : '-';

            // ... (نفس كود تصميم الكارت السابق تماماً بدون تغيير) ...
            const card = `
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md dark:shadow-gray-900/30 transition-all duration-300 mb-3 border border-gray-200 dark:border-gray-700/50 overflow-hidden group">
                    <div class="bg-gray-50 dark:bg-gray-800/80 px-5 py-3 border-b border-gray-200 dark:border-gray-700/50 flex justify-between items-center transition-colors">
                        <div class="flex items-center gap-3">
                            <span class="font-black text-blue-950 dark:text-blue-300 text-lg flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-700 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                طعن ${val(data.caseNumber)}
                            </span>
                            <span class="text-xs font-extrabold bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800/30">سنة ${val(data.year)}</span>
                        </div>
                        <div class="text-sm font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1 bg-white dark:bg-gray-700/50 px-2 py-1 rounded-md border border-gray-100 dark:border-transparent">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span class="text-gray-800 dark:text-gray-300">${val(data.sessionDate)}</span>
                        </div>
                    </div>
                    <div class="p-5">
                        <div class="flex flex-wrap gap-y-4 gap-x-6 mb-5 text-sm">
                            <div class="flex-1 min-w-[200px]">
                                <span class="text-slate-600 dark:text-gray-400 text-xs font-extrabold block mb-1 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                                    الطاعن
                                </span>
                                <span class="font-bold text-gray-900 dark:text-gray-100 bg-slate-50 dark:bg-gray-700/30 px-3 py-2 rounded-md block border-r-4 border-blue-300 dark:border-blue-500/30 shadow-sm">${val(data.plaintiff)}</span>
                            </div>
                            <div class="flex-1 min-w-[200px]">
                                <span class="text-slate-600 dark:text-gray-400 text-xs font-extrabold block mb-1 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                                    المطعون ضده
                                </span>
                                <span class="font-bold text-gray-900 dark:text-gray-100 bg-slate-50 dark:bg-gray-700/30 px-3 py-2 rounded-md block border-r-4 border-red-300 dark:border-red-500/30 shadow-sm">${val(data.defendant)}</span>
                            </div>
                        </div>
                        <div class="mb-1 relative">
                            <h4 class="text-sm font-black text-blue-900 dark:text-gray-300 uppercase mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                منطوق الحكم / القرار:
                            </h4>
                            <p class="text-gray-900 dark:text-gray-100 text-sm font-bold leading-relaxed bg-yellow-50/80 dark:bg-yellow-900/20 p-4 rounded-xl border-2 border-yellow-200 dark:border-yellow-700/30 relative shadow-sm">
                                ${val(data.decision)}
                            </p>
                        </div>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-800/80 px-5 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700/50 flex flex-wrap gap-y-2 gap-x-4 justify-between items-center transition-colors">
                        <div class="flex flex-wrap gap-3 items-center font-semibold">
                            <span class="flex items-center gap-1" title="القاضي"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg> ${val(data.judge)}</span>
                            <span class="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded transition-colors border border-gray-300 dark:border-transparent">رول: ${val(data.roll)}</span>
                            <span class="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded transition-colors border border-gray-300 dark:border-transparent">تصنيف: ${val(data.dataClass)}</span>
                        </div>
                        <div class="flex gap-2 items-center">
                            ${data.notes ? `<span class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded font-bold border border-red-200 dark:border-red-800/30 flex items-center gap-1 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg> ${data.notes}</span>` : ''}
                            <span class="text-gray-400 dark:text-gray-500 flex items-center gap-1 font-semibold" title="المصدر"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> ${val(data.dataSource)}</span>
                        </div>
                    </div>
                </div>
            `;
            resultsArea.innerHTML += card;
        });

        // ... (نفس كود عرض الإحصائيات السابق) ...
        statsArea.innerHTML = `
            <div class="glass-effect px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg>
                <span class="font-bold text-white">${totalResults}</span> <span class="text-gray-200">نتائج</span>
            </div>
            ${uniqueYears.size > 0 ? `
            <div class="glass-effect px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-sm">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span class="font-bold text-white">${uniqueYears.size}</span> <span class="text-gray-200">سنوات</span>
            </div>` : ''}
            ${uniqueJudges.size > 0 ? `
            <div class="glass-effect px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-sm">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-300" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                <span class="font-bold text-white">${uniqueJudges.size}</span> <span class="text-gray-200">قضاة</span>
            </div>` : ''}
        `;

    } catch (e) {
        // ... (نفس كود معالجة الأخطاء السابق) ...
        console.error(e);
        if(e.message && e.message.includes("index")) {
            resultsArea.innerHTML = '<div class="text-red-600 dark:text-red-400 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">⚠️ يرجى تفعيل الفهرسة (Index) من خلال الرابط في الـ Console</div>';
        } else {
            resultsArea.innerHTML = '<div class="text-red-500 text-center p-4">حدث خطأ في الاتصال. حاول مرة أخرى.</div>';
        }
    }
};

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            window.searchRulings();
        }, 400); 
    });
}

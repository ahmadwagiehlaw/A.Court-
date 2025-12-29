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
            const data = doc.data();
            const card = `
                <div class="bg-white p-4 rounded shadow mb-4 border-r-4 border-blue-900">
                    <h3 class="font-bold text-lg">طعن رقم ${data.caseNumber} <span class="text-sm text-gray-500">سنة ${data.year}</span></h3>
                    <p class="text-gray-700 mt-2"><strong>المدعي:</strong> ${data.plaintiff}</p>
                    <p class="text-gray-700"><strong>ضد:</strong> ${data.defendant}</p>
                    <p class="text-blue-900 mt-2 bg-blue-50 p-2 rounded text-sm">${data.decision}</p>
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

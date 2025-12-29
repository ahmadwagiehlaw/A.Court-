import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// دالة البحث الرئيسية
window.searchRulings = async function() {
    const searchInput = document.getElementById('searchInput').value.trim();
    const resultsArea = document.getElementById('resultsArea');
    const loader = document.getElementById('loader');

    if (searchInput.length < 2) {
        alert("من فضلك اكتب كلمة بحث أطول (رقم الطعن، اسم، سنة...)");
        return;
    }

    // إظهار اللودر وإخفاء النتائج القديمة
    resultsArea.innerHTML = ''; 
    resultsArea.appendChild(loader);
    loader.classList.remove('hidden');

    try {
        const rulingsRef = collection(db, "rulings");
        let q;

        // منطق البحث:
        // بما أن فايربيس محدود قليلاً في البحث النصي الجزئي، سنعتمد على مصفوفة الكلمات المفتاحية التي أنشأناها
        // سنبحث عما إذا كانت مصفوفة searchKeywords تحتوي على كلمة البحث
        
        q = query(
            rulingsRef, 
            where("searchKeywords", "array-contains", searchInput),
            limit(20) // نكتفي بـ 20 نتيجة لسرعة العرض
        );

        const querySnapshot = await getDocs(q);
        
        loader.classList.add('hidden');

        if (querySnapshot.empty) {
            resultsArea.innerHTML = `
                <div class="text-center py-8 text-gray-500 bg-white rounded shadow">
                    <p class="text-xl">لا توجد نتائج مطابقة لـ "${searchInput}"</p>
                    <p class="text-sm mt-2">جرب البحث برقم الطعن فقط، أو اسم المدعي</p>
                </div>
            `;
            return;
        }

        // عرض النتائج
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = "bg-white rounded-lg shadow-md p-6 border-r-4 border-blue-900 mb-4 hover:shadow-lg transition duration-200";
            
            // تنسيق البيانات للعرض
            const decisionShort = data.decision ? data.decision.substring(0, 150) + '...' : 'لا يوجد تفاصيل للقرار';
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">طعن رقم: ${data.caseNumber}</h3>
                        <span class="text-sm text-blue-800 font-semibold">لسنة ${data.year}</span>
                    </div>
                    <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">جلسة: ${data.nextSession || 'غير محدد'}</span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                    <p><span class="font-bold">المدعي:</span> ${data.plaintiff}</p>
                    <p><span class="font-bold">ضد:</span> ${data.defendant}</p>
                    <p><span class="font-bold">العضو:</span> ${data.judge}</p>
                </div>

                <p class="text-gray-700 mb-4 font-cairo">
                    <span class="font-bold text-blue-900">القرار:</span> ${decisionShort}
                </p>

                <div class="flex justify-between items-center border-t pt-4 mt-2">
                     <span class="text-xs text-gray-400">تاريخ الرفع: ${new Date(data.uploadedAt.seconds * 1000).toLocaleDateString('ar-EG')}</span>
                     </div>
            `;
            resultsArea.appendChild(card);
        });

    } catch (error) {
        console.error("Error searching: ", error);
        loader.classList.add('hidden');
        resultsArea.innerHTML = `<div class="text-red-500 text-center">حدث خطأ في الاتصال بقاعدة البيانات</div>`;
    }
};

// تفعيل البحث عند الضغط على Enter
document.getElementById('searchInput').addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        window.searchRulings();
    }
});

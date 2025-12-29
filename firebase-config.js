// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDrqEXzA5Js-0gw2Qm7QhXZwq4SWhbpIlk",
  authDomain: "a-courtsearch.firebaseapp.com",
  projectId: "a-courtsearch",
  storageBucket: "a-courtsearch.firebasestorage.app",
  messagingSenderId: "711752634270",
  appId: "1:711752634270:web:e1890acac484821974d08f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

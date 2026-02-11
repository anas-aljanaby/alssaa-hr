import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRZzMN3KEFZGbDAwTHYmNyGactQv6_VP8",
  authDomain: "alssaa-attendance.firebaseapp.com",
  projectId: "alssaa-attendance",
  storageBucket: "alssaa-attendance.firebasestorage.app",
  messagingSenderId: "838052677983",
  appId: "1:838052677983:web:d76527c76439322fdc4eea"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

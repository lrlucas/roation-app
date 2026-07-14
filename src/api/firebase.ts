import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGXS3rpum4UpeaVw7d9hsdLMYb0P82xgI",
  authDomain: "rotation-app-a3562.firebaseapp.com",
  projectId: "rotation-app-a3562",
  storageBucket: "rotation-app-a3562.firebasestorage.app",
  messagingSenderId: "574664618775",
  appId: "1:574664618775:web:62204d9be632f3741abd52"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Firebase has been removed from the frontend.
// This file provides no-op exports to avoid import errors while the app is migrated.
export const app = null;
export const auth = null;
export const db = null;

// Solo necesitas exportar `app` adicionalmente
export { app };






// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyBnhltDK9ZDW2Q9xUxBk87fNXNphSYXvSY",
//   authDomain: "uml-flow-72c9f.firebaseapp.com",
//   projectId: "uml-flow-72c9f",
//   storageBucket: "uml-flow-72c9f.firebasestorage.app",
//   messagingSenderId: "240488429315",
//   appId: "1:240488429315:web:334cdd389bd23d86be1b36"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);



// // src/firebase-confing/Firebase.js
// import { initializeApp } from "firebase/app";
// import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore";
// import { getAnalytics, isSupported } from "firebase/analytics";

// const configuracionFirebase = {
//   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//   storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//   appId: import.meta.env.VITE_FIREBASE_APP_ID,
//   measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // opcional
// };

// const aplicacionFirebase = initializeApp(configuracionFirebase);
// const auth = getAuth(aplicacionFirebase);
// const db = getFirestore(aplicacionFirebase);

// let analytics = null;
// if (configuracionFirebase.measurementId) {
//   isSupported().then((ok) => { if (ok) analytics = getAnalytics(aplicacionFirebase); });
// }

// export { aplicacionFirebase, auth, db, analytics };

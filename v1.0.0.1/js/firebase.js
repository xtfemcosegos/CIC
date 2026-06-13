import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA05gexuh4zNt4ro_Rh2TJFMYfoicW8nbg",
  authDomain: "cic-os.firebaseapp.com",
  databaseURL: "https://cic-os-default-rtdb.firebaseio.com",
  projectId: "cic-os",
  storageBucket: "cic-os.firebasestorage.app",
  messagingSenderId: "628160285586",
  appId: "1:628160285586:web:cb265d10e256697ab68f4b",
  measurementId: "G-Y76LMVF819"
};

// Inicializar Firebase y Autenticación
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth, signInWithEmailAndPassword };
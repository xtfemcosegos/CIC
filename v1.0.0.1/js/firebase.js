import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

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

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LfMdh4tAAAAAIso_7lN3m0EpNFeIUDRf7oM6pNb'),
  isTokenAutoRefreshEnabled: true // Permite que el token invisible se renueve automáticamente
});
const functions = getFunctions(app);

export { app, auth, signInWithEmailAndPassword, functions, httpsCallable };
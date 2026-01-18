/**
 * Configuración de Firebase para el proyecto Protección Patrimonial - CIC.
 * Este archivo es consumido por index.html para inicializar los servicios de Auth y Firestore.
 */

const firebaseConfig = {
  apiKey: "AIzaSyCd4p8USmJeFOie1cJj0Hi80-z8IbLAGqU",
  authDomain: "cic6-pp-web.firebaseapp.com",
  projectId: "cic6-pp-web",
  storageBucket: "cic6-pp-web.firebasestorage.app",
  messagingSenderId: "248659087868",
  appId: "1:248659087868:web:a277ef700d83c7f1d22279",
  measurementId: "G-ZMC7H7710Z"
};

/**
 * Función auxiliar para obtener la configuración.
 * Puede ser utilizada en otros módulos si es necesario.
 */
function getFirebaseConfig() {
    return firebaseConfig;
}
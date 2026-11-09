// Vorlage für lokale Entwicklung: als firebase-config.local.js speichern und die Werte aus der
// Firebase-Konsole eintragen (Projekteinstellungen → Allgemein → Meine Apps → Web-App → Konfiguration).
// Nur nötig für `npm start` (localhost). Auf Firebase Hosting lädt die App die Werte automatisch.
// Diese Werte sind nicht geheim – geschützt werden die Daten durch Anmeldung und firestore.rules.
export const firebaseConfig = {
  apiKey: 'DEIN-API-KEY',
  authDomain: 'dein-projekt.firebaseapp.com',
  projectId: 'dein-projekt',
  storageBucket: 'dein-projekt.firebasestorage.app',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
};

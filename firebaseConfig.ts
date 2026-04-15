import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBsMI63q-M7ZScj_y49kkyIVJ0CqghZvHU",
  authDomain: "organizar-financas.firebaseapp.com",
  databaseURL: "https://organizar-financas-default-rtdb.firebaseio.com",
  projectId: "organizar-financas",
  storageBucket: "organizar-financas.firebasestorage.app",
  messagingSenderId: "488498688717",
  appId: "1:488498688717:web:7df589eb6881cd190d2f84"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o banco de dados para usarmos nos outros arquivos
export const db = getDatabase(app);
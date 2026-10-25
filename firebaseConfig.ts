import { getApp, getApps, initializeApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import { getDatabase } from "firebase/database";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyBsMI63q-M7ZScj_y49kkyIVJ0CqghZvHU",
  authDomain: "organizar-financas.firebaseapp.com",
  databaseURL: "https://organizar-financas-default-rtdb.firebaseio.com",
  projectId: "organizar-financas",
  storageBucket: "organizar-financas.firebasestorage.app",
  messagingSenderId: "488498688717",
  appId: "1:488498688717:web:7df589eb6881cd190d2f84"
};

// Inicializa o Firebase (reaproveita se já existir, evita erro no hot reload)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Exporta o banco de dados para usarmos nos outros arquivos
export const db = getDatabase(app);

// LOGIN
// No celular, a sessão só fica salva no aparelho (e não pede senha de novo)
// se o AsyncStorage estiver instalado. No navegador a sessão já é salva sozinha.
function criarAuth() {
  if (Platform.OS === "web") return FirebaseAuth.getAuth(app);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence;
    if (AsyncStorage && getReactNativePersistence) {
      return FirebaseAuth.initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  } catch (e) {
    // Já inicializado (hot reload) ou AsyncStorage não instalado: cai no padrão abaixo
  }
  return FirebaseAuth.getAuth(app);
}

export const auth = criarAuth();

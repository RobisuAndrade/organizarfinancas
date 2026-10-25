import { Slot } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import TelaLogin from '../components/TelaLogin';
import { Colors } from '../constants/theme';
import { auth } from '../firebaseConfig';
import { DialogoProvider } from '../hooks/useDialogo';
import { PrivacidadeProvider } from '../hooks/usePrivacidade';

// Portão do app: sem estar logado, só aparece a tela de login.
// A sessão fica salva no aparelho, então depois do 1º login não pede de novo.
export default function RootLayout() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUsuario(u);
      setVerificando(false);
    });
    return () => unsub();
  }, []);

  let conteudo;
  if (verificando) {
    conteudo = (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.lime} size="large" />
      </View>
    );
  } else if (!usuario) {
    conteudo = <TelaLogin />;
  } else {
    conteudo = (
      <PrivacidadeProvider>
        <Slot />
      </PrivacidadeProvider>
    );
  }

  // Diálogos do app (substituem Alert/confirm do sistema) ficam por fora de tudo
  return <DialogoProvider>{conteudo}</DialogoProvider>;
}

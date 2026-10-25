import { Feather } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';
import { auth } from '../firebaseConfig';

function traduzirErro(codigo: string) {
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Espere um pouco e tente de novo.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    case 'auth/user-disabled':
      return 'Esse acesso foi desativado.';
    default:
      return 'Não foi possível entrar. Tente novamente.';
  }
}

export default function TelaLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const entrar = async () => {
    if (!email.trim() || !senha) {
      setErro('Preencha o e-mail e a senha.');
      return;
    }
    setErro('');
    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      // O portão em app/_layout.tsx percebe o login e libera o app sozinho
    } catch (e: any) {
      setErro(traduzirErro(e?.code || ''));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Feather name="lock" size={30} color={Colors.background} />
          </View>
          <Text style={styles.titulo}>Finanças</Text>
          <Text style={styles.subtitulo}>Robinho & Vanessinha</Text>

          <View style={styles.card}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={Colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />

            <Text style={styles.label}>Senha</Text>
            <View style={styles.senhaLinha}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="••••••••"
                placeholderTextColor={Colors.muted}
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!verSenha}
                autoCapitalize="none"
                autoComplete="password"
                onSubmitEditing={entrar}
              />
              <TouchableOpacity onPress={() => setVerSenha(!verSenha)} style={styles.btnOlho}>
                <Feather name={verSenha ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            {!!erro && <Text style={styles.erro}>{erro}</Text>}

            <TouchableOpacity style={styles.botao} onPress={entrar} disabled={carregando} activeOpacity={0.85}>
              {carregando ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.botaoTexto}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.rodape}>Depois de entrar, este aparelho fica lembrado e não pede a senha de novo.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.lime, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  titulo: { fontSize: 30, fontWeight: '900', color: Colors.text },
  subtitulo: { fontSize: 14, color: Colors.lavender, fontWeight: '600', marginTop: 4, marginBottom: 28 },
  card: { width: '100%', maxWidth: 420, backgroundColor: Colors.surface, borderRadius: 28, padding: 22, borderWidth: 1, borderColor: Colors.surface3 },
  label: { color: Colors.lime, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { height: 54, backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 15, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.surface3, marginBottom: 16 },
  senhaLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  btnOlho: { width: 54, height: 54, borderRadius: 14, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.surface3, justifyContent: 'center', alignItems: 'center' },
  erro: { color: Colors.danger, fontSize: 13, fontWeight: '600', marginBottom: 14 },
  botao: { height: 56, borderRadius: 16, backgroundColor: Colors.lime, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  botaoTexto: { color: Colors.background, fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  rodape: { color: Colors.muted, fontSize: 11, textAlign: 'center', marginTop: 20, maxWidth: 300 },
});

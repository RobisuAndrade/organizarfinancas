import { Stack } from 'expo-router';

export default function Layout() {
  return (
    // O Stack organiza as telas como uma pilha.
    // O headerShown: false esconde o cabeçalho padrão para usarmos o nosso.
    <Stack screenOptions={{ headerShown: false }}>
      
      {/* Aqui nós avisamos o sistema quais telas existem */}
      <Stack.Screen name="(tabs)/index" />
      <Stack.Screen name="(tabs)/compras" />
      
    </Stack>
  );
}
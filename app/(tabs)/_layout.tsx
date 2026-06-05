import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="resumo" />
      <Stack.Screen name="gastos" />
      <Stack.Screen name="compras" />
      <Stack.Screen name="metas" />
      <Stack.Screen name="renda" />
    </Stack>
  );
}
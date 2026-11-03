import { useRouter } from 'expo-router';
import { TelaAlertas } from '../../components/AlertasPromo';

// Tela cheia dos alertas de promoção (ícone de sino na barra de baixo).
export default function Alertas() {
  const router = useRouter();
  return <TelaAlertas aoVoltar={() => router.back()} />;
}

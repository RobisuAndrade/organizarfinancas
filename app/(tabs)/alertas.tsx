import { TelaAlertas } from '../../components/AlertasPromo';
import { useVoltar } from '../../hooks/useVoltar';

// Tela cheia dos alertas de promoção (ícone de sino na barra de baixo).
export default function Alertas() {
  const voltar = useVoltar();
  return <TelaAlertas aoVoltar={voltar} />;
}

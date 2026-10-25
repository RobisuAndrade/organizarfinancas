import { createContext, Fragment, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { definirValoresOcultos } from '../utils/formatadores';

const CHAVE = 'privacidade_ocultar_valores';

// AsyncStorage é opcional: se não estiver instalado, só não lembra a escolha entre aberturas do app
function pegarStorage(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    return null;
  }
}

type PrivacidadeContextType = {
  oculto: boolean;
  alternar: () => void;
};

const PrivacidadeContext = createContext<PrivacidadeContextType>({ oculto: false, alternar: () => {} });

export const usePrivacidade = () => useContext(PrivacidadeContext);

export function PrivacidadeProvider({ children }: { children: ReactNode }) {
  const [oculto, setOculto] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Carrega a última escolha antes de mostrar qualquer valor (evita "piscar" dinheiro à mostra)
  useEffect(() => {
    const storage = pegarStorage();
    if (!storage) {
      setPronto(true);
      return;
    }
    storage
      .getItem(CHAVE)
      .then((v: string | null) => setOculto(v === '1'))
      .catch(() => {})
      .finally(() => setPronto(true));
  }, []);

  // Precisa estar certo ANTES dos filhos renderizarem
  definirValoresOcultos(oculto);

  const alternar = useCallback(() => {
    setOculto((atual) => {
      const novo = !atual;
      pegarStorage()?.setItem(CHAVE, novo ? '1' : '0')?.catch?.(() => {});
      return novo;
    });
  }, []);

  if (!pronto) return null;

  return (
    <PrivacidadeContext.Provider value={{ oculto, alternar }}>
      {/* a "key" refaz as telas para todos os valores serem redesenhados já mascarados (ou não) */}
      <Fragment key={oculto ? 'oculto' : 'visivel'}>{children}</Fragment>
    </PrivacidadeContext.Provider>
  );
}

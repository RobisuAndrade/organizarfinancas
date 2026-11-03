// Seta de voltar das telas: volta para a tela anterior de verdade.
// Se o "voltar" não sair do lugar (ex.: a tela anterior é a própria tela com outro filtro, ou não há
// histórico depois de um F5 no navegador), cai no Início para a seta nunca ficar "morta".
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

export function useVoltar() {
  const router = useRouter();
  const pathname = usePathname();
  const atual = useRef(pathname);
  atual.current = pathname;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback(() => {
    if (!router.canGoBack()) {
      router.replace('/');
      return;
    }
    const antes = atual.current;
    router.back();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (atual.current === antes) router.replace('/');
    }, 400);
  }, [router]);
}

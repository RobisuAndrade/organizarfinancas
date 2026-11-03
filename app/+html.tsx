import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Página base do site (só na web): define o nome que aparece na guia do navegador e o ícone.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>ROVAN</title>
        <meta name="application-name" content="ROVAN" />
        <meta name="apple-mobile-web-app-title" content="ROVAN" />
        <link rel="icon" type="image/png" href="/financa.png" />
        <link rel="apple-touch-icon" href="/financa.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

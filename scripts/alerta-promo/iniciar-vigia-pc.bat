@echo off
title Vigia de promocoes (PC)
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando o que falta, so na primeira vez...
  call npm install --no-audit --no-fund
)

:inicio
node pc-vigia.mjs
if %errorlevel%==2 (
  echo.
  echo Corrija o que esta acima no arquivo .env e abra este arquivo de novo.
  pause
  exit /b
)
echo.
echo O vigia parou. Reiniciando em 15 segundos... (feche esta janela para parar de vez)
timeout /t 15 /nobreak >nul
goto inicio

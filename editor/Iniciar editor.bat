@echo off
rem Se reabre dentro de una ventana que no se cierra sola, para poder leer cualquier mensaje.
if not "%~1"=="k" ( start "Editor de RELIEVE" cmd /k ""%~f0" k" & exit /b )
chcp 65001 >nul
cd /d "%~dp0"
title Editor de RELIEVE

rem Programas que necesita el editor: Node.js y Git. Si faltan, se instalan solos con winget (viene con Windows 10 y 11).
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Git\cmd"

where node >nul 2>nul
if errorlevel 1 (
  echo Instalando Node.js... Windows te pedira permiso: responde Si.
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
)
where git >nul 2>nul
if errorlevel 1 (
  echo Instalando Git... Windows te pedira permiso: responde Si.
  winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
)
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Git\cmd"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se pudo instalar Node.js. Instala la version LTS desde https://nodejs.org y abre este archivo otra vez.
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se pudo instalar Git. Instalalo desde https://git-scm.com y abre este archivo otra vez.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Primera vez: instalando el editor...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo No se pudo instalar. & pause & exit /b 1 )
)
node server.js
echo.
echo El editor se detuvo. Copia el mensaje de arriba si hay un error.

@echo off
rem Abre la web Taller de Deadlock en local.
rem 1. Trae de GitHub los datos que la tarea diaria publica cada manana (si hay internet y git).
rem 2. Regenera index.html y data/datos.js.
rem 3. Abre index.html en el navegador predeterminado.
rem Todo va en un solo bloque ( ... ): cmd lo lee entero antes de empezar, asi que funciona
rem aunque el git pull traiga una version nueva de este mismo archivo.
chcp 65001 >nul
title Taller de Deadlock
cd /d "%~dp0"
(
  where node >nul 2>nul
  if errorlevel 1 (
    echo No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a intentarlo.
    echo Mientras tanto puedes usar la version publicada: https://cory2030.github.io/taller-deadlock/
    pause
    exit /b 1
  )

  where git >nul 2>nul
  if not errorlevel 1 (
    echo Buscando los datos de hoy en GitHub...
    rem index.html y artefacto.html son generados: se descartan para que el pull no choque y se regeneran abajo.
    git checkout -- index.html artefacto.html >nul 2>nul
    git pull --ff-only -q >nul 2>nul
    if errorlevel 1 (
      echo No se pudieron traer datos nuevos. Se abre con los que ya hay.
      timeout /t 4 >nul
    )
  )

  node scripts\construir.js >nul
  if errorlevel 1 (
    echo No se pudo generar la web. Revisa la carpeta src.
    pause
    exit /b 1
  )

  start "" "%~dp0index.html"
  exit /b 0
)

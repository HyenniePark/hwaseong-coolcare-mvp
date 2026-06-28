@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 화성 쿨케어 프론트엔드

echo [화성 쿨케어] 프론트엔드를 시작합니다.

if not exist "node_modules" (
  echo node_modules가 없어 npm install을 실행합니다.
  npm.cmd install
  if errorlevel 1 (
    echo npm install에 실패했습니다. Node.js와 npm 설치를 확인해 주세요.
    pause
    exit /b 1
  )
)

echo.
echo 프론트 주소: http://127.0.0.1:5173
echo 이 창을 닫으면 프론트엔드가 꺼집니다.
echo.
npm.cmd run dev
pause

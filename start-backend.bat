@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 화성 쿨케어 백엔드

echo [화성 쿨케어] 백엔드를 시작합니다.

if not exist "backend.venvScriptspython.exe" (
  echo Python 가상환경이 없어 새로 만듭니다.
  python -m venv backend.venv
  if errorlevel 1 (
    echo Python 실행에 실패했습니다. Python 설치를 확인해 주세요.
    pause
    exit /b 1
  )
)

echo 필요한 백엔드 패키지를 확인합니다.
"backend.venvScriptspython.exe" -m pip install -r backendequirements.txt
if errorlevel 1 (
  echo 백엔드 패키지 설치에 실패했습니다.
  pause
  exit /b 1
)

echo.
echo 백엔드 주소: http://127.0.0.1:8000
echo 상태 확인: http://127.0.0.1:8000/api/health
echo 날씨 확인: http://127.0.0.1:8000/api/weather
echo 이 창을 닫으면 백엔드가 꺼집니다.
echo.
"backend.venvScriptspython.exe" -m uvicorn backend.app.main:app --reload --port 8000
pause

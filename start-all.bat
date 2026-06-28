@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 화성 쿨케어 전체 실행

echo [화성 쿨케어] 백엔드와 프론트엔드를 각각 새 창으로 엽니다.
echo 두 창을 모두 열어둔 상태에서 앱을 사용하면 됩니다.
echo.
start "화성 쿨케어 백엔드" cmd /k ""%~dp0start-backend.bat""
timeout /t 2 /nobreak >nul
start "화성 쿨케어 프론트엔드" cmd /k ""%~dp0start-frontend.bat""
timeout /t 4 /nobreak >nul
start http://127.0.0.1:5173

echo 브라우저가 열렸습니다. 이 창은 닫아도 됩니다.
pause

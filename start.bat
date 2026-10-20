@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/2] 正在构建静态看板...
call node server\build.js --no-sync
if errorlevel 1 goto err
echo.
echo [2/2] 启动预览服务...
node server\serve.js
goto end
:err
echo 构建失败，请检查 Node 是否已安装。
pause
:end

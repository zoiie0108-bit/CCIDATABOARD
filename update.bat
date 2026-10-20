@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在抓取官方栏目并重新构建...
call node server\build.js
if errorlevel 1 goto err
echo.
echo 完成。刷新页面即可看到最新数据。
pause
goto end
:err
echo 更新失败，请查看上方日志。
pause
:end

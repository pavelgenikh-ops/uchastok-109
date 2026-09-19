@echo off
rem Сборка переносимого архива приложения.
rem Кладёт ZIP рядом с папкой проекта: "Ландшафт 3D - архив ГГГГ-ММ-ДД.zip"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_arhiv.ps1"
pause

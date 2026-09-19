@echo off
rem Sobiraet papku docs dlya GitHub Pages
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_publish_site.ps1"
pause

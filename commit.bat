@echo off
cd /d "C:\Users\ayush\Desktop\Ayush\lead-engine"
del /f /q ".git\index.lock" 2>nul
git add -A
git commit -m "Initial commit - LeadGen Engine Next.js app"
echo.
echo Done! You can close this window and push via GitHub Desktop.
pause

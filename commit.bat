@echo off
cd /d "C:\Users\ayush\Desktop\Ayush\lead-engine"
del /f /q ".git\index.lock" 2>nul
git add -A
git commit -m "Feature: pagination, sorting, date filters, Google Drive export, validation, improved search"
git push origin main
echo.
echo Done! Pushed to GitHub — Vercel will auto-deploy.
pause

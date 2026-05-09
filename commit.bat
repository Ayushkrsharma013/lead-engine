@echo off
cd /d "C:\Users\ayush\Desktop\Ayush\lead-engine"
del /f /q ".git\index.lock" 2>nul
git add -A
git commit -m "Redesign: persistent storage, filter panel, multi-tab UI, Sales Nav"
git push origin main
echo.
echo Done! Pushed to GitHub — Vercel will auto-deploy.
pause

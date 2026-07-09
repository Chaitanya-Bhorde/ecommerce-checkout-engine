@echo off
echo ========================================
echo  E-Commerce Chatbot - START BOTH SERVERS
echo ========================================
echo.
echo  This single command runs BOTH:
echo  - Backend (port 5000)
echo  - Frontend (port 5173)
echo.
echo  Open http://localhost:5173 after it starts
echo ========================================
echo.

npm run run:all

pause
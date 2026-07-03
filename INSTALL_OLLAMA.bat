@echo off
echo ========================================
echo  Installing Ollama for AI Chatbot
echo ========================================
echo.

echo Step 1: Downloading Ollama...
powershell -Command "Invoke-WebRequest -Uri 'https://ollama.ai/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe'"

echo.
echo Step 2: Installing Ollama (silent install)...
start /wait "" "%TEMP%\OllamaSetup.exe" /S

echo.
echo Step 3: Waiting for installation to complete...
timeout /t 10 /nobreak >nul

echo.
echo Step 4: Downloading Llama 3 model (this may take a few minutes)...
ollama pull llama3

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo You can now use the AI chatbot!
echo.
echo To test Ollama, run: ollama run llama3
echo.
pause
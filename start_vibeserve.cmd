@echo off
cd /d "C:\Users\User\Desktop\Coding Trio\VibeServe-main"
set GOOGLE_API_KEY=AIzaSyC5LgmB5TXvi1gmdNY1ShmpXhH3WIEIpKE
set DEFAULT_LLM_PROVIDER=gemini
set ROUTING_SIMPLE=gemini
set ROUTING_MEDIUM=gemini
set ROUTING_COMPLEX=gemini
set ROUTING_CRITICAL=gemini
set VIBESERVE_HTTP_PORT=8000
python -m vibeserve --http

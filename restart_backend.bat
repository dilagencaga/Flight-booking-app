@echo off
echo ===================================================
echo FORCE REBUILDING ALL SERVICES (CLEARING CACHE)
echo ===================================================

echo 1. Stopping containers...
docker compose down

echo 2. Rebuilding Flight Service (Backend)...
docker compose build flight-service --no-cache

echo 3. Rebuilding Client (Frontend)...
docker compose build client --no-cache

echo 3.5. Rebuilding Gateway (Swagger)...
docker compose build gateway --no-cache

echo 4. Starting everything...
docker compose up -d

echo ===================================================
echo DONE! 
echo Please refresh your browser (Ctrl + F5).
echo You should see "v2.1 (CORRECTED)" in bottom right.
echo ===================================================
pause

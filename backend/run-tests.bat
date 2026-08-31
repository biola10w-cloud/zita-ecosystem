@echo off
REM ZITA Backend Test Runner
REM This batch file runs the Vitest test suite

cd /d "%~dp0"

echo.
echo ========================================
echo ZITA Backend Test Suite
echo ========================================
echo.

echo Checking Docker containers...
docker ps --filter "name=backend" --quiet

echo.
echo Running tests...
echo.

node node_modules/vitest/vitest.mjs run --reporter=verbose

echo.
echo Test run complete!
echo.
pause

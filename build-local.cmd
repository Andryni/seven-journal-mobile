@echo off
rem Build local Android (contourne le quota EAS).
rem Signature : keystore EAS branche dans android/app/build.gradle (upload-keystore.jks),
rem l'APK produit remplace l'app installee via: adb install -r chemin\vers\app-release.apk
set "JAVA_HOME=C:\Users\ANDRY\Documents\seven-journal-mobile\tools\jdk-17.0.20.1+1"
set "ANDROID_HOME=C:\Users\ANDRY\AppData\Local\Android\Sdk"
cd /d "C:\Users\ANDRY\Documents\seven-journal-mobile\android"
echo [build-local] dossier courant: %CD%
echo [build-local] demarrage gradle (ABIs telephone uniquement)...
call "%CD%\gradlew.bat" assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a --console=plain
echo [build-local] exit code %ERRORLEVEL%
echo [build-local] APK: %CD%\app\build\outputs\apk\release\app-release.apk

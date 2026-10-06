@REM ----------------------------------------------------------------------------
@REM Apache Maven Wrapper startup script, version 3.3.2
@REM
@REM Required ENV vars:
@REM JAVA_HOME - location of a JDK home dir
@REM ----------------------------------------------------------------------------

@SET WRAPPER_JAR=%~dp0.mvn\wrapper\maven-wrapper.jar
@SET WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
@IF EXIST "%WRAPPER_JAR%" (GOTO launchMaven)

@IF "%__MVNW_ARG0_NAME__%"=="" (SET __MVNW_ARG0_NAME__=%~nx0)

@ECHO Downloading Maven Wrapper...
@powershell -noprofile -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "(New-Object System.Net.WebClient).DownloadFile('%DOWNLOAD_URL%', '%WRAPPER_JAR%')"

:launchMaven
@IF NOT DEFINED JAVA_HOME SET "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
@SET "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
@IF NOT EXIST "%JAVA_EXE%" SET "JAVA_EXE=java.exe"

"%JAVA_EXE%" %MAVEN_OPTS% "-Dmaven.multiModuleProjectDirectory=%~dp0." -classpath "%WRAPPER_JAR%" %WRAPPER_LAUNCHER% %*

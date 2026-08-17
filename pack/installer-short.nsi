; DeepSeek Harness 社区增强版安装程序
; 打包内容 = 便携目录（应用 + 社区插件 + profile 模板 + 启动脚本）
; 安装完成后静默执行 portable-fixup.mjs 完成用户 profile 初始化，
; 安装结果与 ZIP 解压后通过 启动.bat 运行的效果完全一致。

Unicode true
Name "DeepSeek Harness"
OutFile "E:\111111项目\DeepSeek\DeepSeek Harness 聚合\DeepSeek-Harness-Setup-0.1.0.exe"
InstallDir "$LOCALAPPDATA\Programs\DeepSeek Harness"
InstallDirRegKey HKCU "Software\DeepSeek Harness" "InstallDir"
RequestExecutionLevel user
SetCompressor zlib
ShowInstDetails show
ShowUninstDetails show
AutoCloseWindow false

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "E:\111111项目\DeepSeek\DeepSeek Harness 聚合\app-icon.ico"
!define MUI_UNICON "E:\111111项目\DeepSeek\DeepSeek Harness 聚合\app-icon.ico"
!define MUI_WELCOMEPAGE_TITLE "DeepSeek Harness 社区增强版"
!define MUI_WELCOMEPAGE_TEXT "本安装包包含 DeepSeek Harness 桌面端、社区插件中心和 7 个功能插件（任务看板、Git 图、实时统计、modlens、Aegis、自动权限、更好侧边栏）。不包含历史对话、个人背景图片或视频、个人皮肤设置，也不预装社区皮肤；安装后使用官方默认皮肤。$\r$\n$\r$\n点击「下一步」继续。"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\启动.bat"
!define MUI_FINISHPAGE_RUN_TEXT "初始化并运行 DeepSeek Harness"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "主程序" SEC01
  SetOutPath "$INSTDIR"
  File /r "E:\a\*.*"

  WriteRegStr HKCU "Software\DeepSeek Harness" "InstallDir" "$INSTDIR"

  ; 创建开始菜单与桌面快捷方式（指向 启动.bat 所在目录的 exe）
  CreateDirectory "$SMPROGRAMS\DeepSeek Harness"
  CreateShortCut "$SMPROGRAMS\DeepSeek Harness\DeepSeek Harness.lnk" "$INSTDIR\启动.bat" "" "$INSTDIR\DeepSeek Harness.exe" 0
  CreateShortCut "$SMPROGRAMS\DeepSeek Harness\初始化并启动.lnk" "$INSTDIR\启动.bat" "" "$INSTDIR\DeepSeek Harness.exe" 0
  CreateShortCut "$SMPROGRAMS\DeepSeek Harness\卸载.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\DeepSeek Harness.lnk" "$INSTDIR\启动.bat" "" "$INSTDIR\DeepSeek Harness.exe" 0

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeek Harness" "DisplayName" "DeepSeek Harness 社区增强版"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeek Harness" "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeek Harness" "Publisher" "DeepSeek Harness Community"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeek Harness" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeek Harness" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeek Harness" "NoRepair" 1

  ; 静默执行初始化（profile 复制 + junction + 路径改写），不启动 GUI
  DetailPrint "初始化 profile 与插件链接…"
  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "1")'
  nsExec::ExecToLog '"$INSTDIR\DeepSeek Harness.exe" --expose-internals "$INSTDIR\modules\dsh-community-plugins\scripts\portable-fixup.mjs" "$INSTDIR"'
  Pop $0
  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "")'
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\DeepSeek Harness.lnk"
  RMDir /r "$SMPROGRAMS\DeepSeek Harness"
  RMDir /r "$INSTDIR"
  RMDir /r "$LOCALAPPDATA\DeepSeek Harness\profile\.dsh-runtime"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeepSeek Harness"
  DeleteRegKey HKCU "Software\DeepSeek Harness"
SectionEnd

; Windows: register URL protocols at install time so the browser extension can
; launch the app even before its first run (setAsDefaultProtocolClient only runs on launch).
!macro registerUrlProtocol PROTO
  WriteRegStr SHCTX "Software\Classes\${PROTO}" "" "URL:Indirme Yoneticisi"
  WriteRegStr SHCTX "Software\Classes\${PROTO}" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\${PROTO}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHCTX "Software\Classes\${PROTO}\shell\open\command" "" '"$appExe" "%1"'
!macroend

!macro customInstall
  !insertmacro registerUrlProtocol "indirmeyoneticisi"
  !insertmacro registerUrlProtocol "tarus-dm"
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegKey SHCTX "Software\Classes\indirmeyoneticisi"
    DeleteRegKey SHCTX "Software\Classes\tarus-dm"
    DeleteRegKey HKCU "Software\Classes\indirmeyoneticisi"
    DeleteRegKey HKCU "Software\Classes\tarus-dm"
  ${endIf}
!macroend

package main

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

//go:embed icon.ico
var iconICO []byte

const (
	wmDestroy     = 0x0002
	wmCommand     = 0x0111
	wmUser        = 0x0400
	wmTray        = wmUser + 1
	wmShowBalloon = wmUser + 2
	wmRButtonUp   = 0x0205
	wmLButtonUp   = 0x0202
	nimAdd        = 0
	nimModify     = 1
	nimDelete     = 2
	nifMessage    = 0x00000001
	nifIcon       = 0x00000002
	nifTip        = 0x00000004
	nifInfo       = 0x00000010
	niifInfo      = 0x00000001
	idiApplication = 32512
	imageIcon     = 1
	lrLoadFromFile = 0x0010
	mfString      = 0x00000000
	tpmBottom     = 0x0020
	tpmRightButton = 0x0002
	wsOverlapped  = 0x00000000
	idExit        = 1
	errorAlreadyExists = 183
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")

	procRegisterClassEx     = user32.NewProc("RegisterClassExW")
	procCreateWindowEx      = user32.NewProc("CreateWindowExW")
	procDefWindowProc       = user32.NewProc("DefWindowProcW")
	procGetMessage          = user32.NewProc("GetMessageW")
	procTranslateMessage    = user32.NewProc("TranslateMessage")
	procDispatchMessage     = user32.NewProc("DispatchMessageW")
	procPostQuitMessage     = user32.NewProc("PostQuitMessage")
	procPostMessage         = user32.NewProc("PostMessageW")
	procDestroyWindow       = user32.NewProc("DestroyWindow")
	procLoadIcon            = user32.NewProc("LoadIconW")
	procLoadImage           = user32.NewProc("LoadImageW")
	procCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	procAppendMenu          = user32.NewProc("AppendMenuW")
	procTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	procGetCursorPos        = user32.NewProc("GetCursorPos")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procFindWindow          = user32.NewProc("FindWindowW")
	procShellNotifyIcon     = shell32.NewProc("Shell_NotifyIconW")
	procCreateMutex         = kernel32.NewProc("CreateMutexW")
	procGetLastError        = kernel32.NewProc("GetLastError")
	procGetModuleHandle     = kernel32.NewProc("GetModuleHandleW")
)

var (
	trayHwnd   syscall.Handle
	trayIcon   syscall.Handle
	pythonCmd  *exec.Cmd
	className  = syscall.StringToUTF16Ptr("VozClaraMotorWnd")
)

type wndClassEx struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     syscall.Handle
	hIcon         syscall.Handle
	hCursor       syscall.Handle
	hbrBackground syscall.Handle
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       syscall.Handle
}

type notifyIconData struct {
	cbSize           uint32
	hWnd             syscall.Handle
	uID              uint32
	uFlags           uint32
	uCallbackMessage uint32
	hIcon            syscall.Handle
	szTip            [128]uint16
	dwState          uint32
	dwStateMask      uint32
	szInfo           [256]uint16
	uVersion         uint32
	szInfoTitle      [64]uint16
	dwInfoFlags      uint32
	guidItem         [16]byte
	hBalloonIcon     syscall.Handle
}

type point struct{ x, y int32 }

type msg struct {
	hwnd    syscall.Handle
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      point
}

func utf16Copy(dst []uint16, s string) {
	u := syscall.StringToUTF16(s)
	n := len(u)
	if n > len(dst) {
		n = len(dst)
		u[n-1] = 0
	}
	copy(dst, u[:n])
}

func singleInstance() bool {
	name, _ := syscall.UTF16PtrFromString("VozClaraMotorMutex")
	procCreateMutex.Call(0, 1, uintptr(unsafe.Pointer(name)))
	errNo, _, _ := procGetLastError.Call()
	if errNo == errorAlreadyExists {
		hwnd, _, _ := procFindWindow.Call(uintptr(unsafe.Pointer(className)), 0)
		if hwnd != 0 {
			procPostMessage.Call(hwnd, wmShowBalloon, 0, 0)
		}
		return false
	}
	return true
}

func loadIconFile() syscall.Handle {
	path := filepath.Join(os.TempDir(), "vozclara-tray.ico")
	_ = os.WriteFile(path, iconICO, 0644)
	p, _ := syscall.UTF16PtrFromString(path)
	h, _, _ := procLoadImage.Call(0, uintptr(unsafe.Pointer(p)), imageIcon, 16, 16, lrLoadFromFile)
	if h != 0 {
		return syscall.Handle(h)
	}
	app, _, _ := procLoadIcon.Call(0, idiApplication)
	return syscall.Handle(app)
}

func nidBase(hwnd syscall.Handle) notifyIconData {
	var d notifyIconData
	d.cbSize = uint32(unsafe.Sizeof(d))
	d.hWnd = hwnd
	d.uID = 1
	d.uFlags = nifMessage | nifIcon | nifTip
	d.uCallbackMessage = wmTray
	d.hIcon = trayIcon
	utf16Copy(d.szTip[:], "VozClara Motor — ligado")
	return d
}

func addTray(hwnd syscall.Handle) {
	d := nidBase(hwnd)
	d.uFlags |= nifInfo
	utf16Copy(d.szInfoTitle[:], "VozClara Motor")
	utf16Copy(d.szInfo[:], "Ligado perto do relógio. O WhatsApp usa este motor. Áudio não sai do PC.")
	d.dwInfoFlags = niifInfo
	procShellNotifyIcon.Call(nimAdd, uintptr(unsafe.Pointer(&d)))
}

func balloon(hwnd syscall.Handle, text string) {
	d := nidBase(hwnd)
	d.uFlags |= nifInfo
	utf16Copy(d.szInfoTitle[:], "VozClara Motor")
	utf16Copy(d.szInfo[:], text)
	d.dwInfoFlags = niifInfo
	procShellNotifyIcon.Call(nimModify, uintptr(unsafe.Pointer(&d)))
}

func removeTray(hwnd syscall.Handle) {
	d := nidBase(hwnd)
	procShellNotifyIcon.Call(nimDelete, uintptr(unsafe.Pointer(&d)))
}

func showMenu(hwnd syscall.Handle) {
	menu, _, _ := procCreatePopupMenu.Call()
	procAppendMenu.Call(menu, mfString, 0, uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr("VozClara Motor — ligado"))))
	procAppendMenu.Call(menu, mfString, idExit, uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr("Sair"))))
	var pt point
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	procSetForegroundWindow.Call(uintptr(hwnd))
	procTrackPopupMenu.Call(menu, tpmBottom|tpmRightButton, uintptr(pt.x), uintptr(pt.y), 0, uintptr(hwnd), 0)
}

func wndProc(hwnd syscall.Handle, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case wmTray:
		if lParam == wmRButtonUp || lParam == wmLButtonUp {
			showMenu(hwnd)
		}
	case wmShowBalloon:
		balloon(hwnd, "Já estou ligado, ao lado do relógio.")
	case wmCommand:
		if wParam == idExit {
			stopPython()
			procDestroyWindow.Call(uintptr(hwnd))
		}
	case wmDestroy:
		removeTray(hwnd)
		procPostQuitMessage.Call(0)
	default:
		r, _, _ := procDefWindowProc.Call(uintptr(hwnd), uintptr(msg), wParam, lParam)
		return r
	}
	return 0
}

func startPythonHidden() error {
	dest := destDir()
	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dest, "server.py"), serverPy, 0644); err != nil {
		return err
	}
	py, err := findPython()
	if err != nil {
		return err
	}
	logf, _ := os.OpenFile(filepath.Join(dest, "engine.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	cmd := exec.Command(py, "server.py", "--model", "nemotron")
	cmd.Dir = dest
	cmd.Env = append(os.Environ(), "VOZCLARA_PACKAGED=1")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if logf != nil {
		cmd.Stdout = logf
		cmd.Stderr = logf
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	pythonCmd = cmd
	go func() {
		_ = cmd.Wait()
	}()
	return nil
}

func watchPython() {
	for {
		time.Sleep(4 * time.Second)
		if pythonCmd == nil || pythonCmd.Process == nil {
			_ = startPythonHidden()
			continue
		}
		if pythonCmd.ProcessState != nil && pythonCmd.ProcessState.Exited() {
			_ = startPythonHidden()
		}
	}
}

func stopPython() {
	if pythonCmd != nil && pythonCmd.Process != nil {
		_ = pythonCmd.Process.Kill()
	}
}

func runTray() error {
	if !singleInstance() {
		return nil
	}
	if err := startPythonHidden(); err != nil {
		return err
	}
	go watchPython()
	trayIcon = loadIconFile()
	hInst, _, _ := procGetModuleHandle.Call(0)
	wc := wndClassEx{
		lpfnWndProc:   syscall.NewCallback(wndProc),
		hInstance:     syscall.Handle(hInst),
		hIcon:         trayIcon,
		lpszClassName: className,
	}
	wc.cbSize = uint32(unsafe.Sizeof(wc))
	procRegisterClassEx.Call(uintptr(unsafe.Pointer(&wc)))
	hwnd, _, _ := procCreateWindowEx.Call(0, uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr("VozClara Motor"))),
		wsOverlapped, 0, 0, 0, 0, 0, 0, hInst, 0)
	if hwnd == 0 {
		return errWindow()
	}
	trayHwnd = syscall.Handle(hwnd)
	addTray(trayHwnd)
	var m msg
	for {
		r, _, _ := procGetMessage.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessage.Call(uintptr(unsafe.Pointer(&m)))
	}
	stopPython()
	return nil
}

func errWindow() error {
	return fmt.Errorf("não criei a bandeja do Windows")
}

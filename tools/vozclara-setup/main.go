package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

//go:embed ui.html
var uiHTML []byte

//go:embed server.py
var serverPy []byte

var neededLibs = []string{
	"transformers", "torch", "torchaudio", "accelerate", "soundfile",
	"librosa", "scipy", "numpy", "soxr", "einops",
	"llama-cpp-python",
}

// pip name → importlib name (llama-cpp-python instala o módulo llama_cpp)
func libImportName(pipName string) string {
	if pipName == "llama-cpp-python" {
		return "llama_cpp"
	}
	return pipName
}

func destDir() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.Getenv("USERPROFILE")
	}
	return filepath.Join(base, "VozClara")
}

func destExePath(dest string) string {
	return filepath.Join(dest, "VozClara-Motor-Setup.exe")
}

func hasFlag(name string) bool {
	for _, a := range os.Args[1:] {
		if strings.EqualFold(a, name) {
			return true
		}
	}
	return false
}

func fileExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && !st.IsDir()
}

func samePath(a, b string) bool {
	aa, err1 := filepath.Abs(a)
	bb, err2 := filepath.Abs(b)
	if err1 != nil || err2 != nil {
		return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
	}
	return strings.EqualFold(aa, bb)
}

func main() {
	if hasFlag("/run") || hasFlag("--run") {
		if err := runMotor(); err != nil {
			msgBox("VozClara Motor", err.Error())
		}
		return
	}
	forceUI := hasFlag("/install") || hasFlag("--install")
	if !forceUI && motorReady() {
		if err := openInstalled(); err != nil {
			msgBox("VozClara Motor", "Não liguei o motor: "+err.Error())
			serveInstaller()
			return
		}
		return
	}
	serveInstaller()
}

func serveInstaller() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		msgBox("VozClara Motor", "Não abri o instalador: "+err.Error())
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(uiHTML)
	})
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/start", handleStart)
	mux.HandleFunc("/api/install", handleInstall)
	go http.Serve(ln, mux)

	url := "http://" + ln.Addr().String() + "/"
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()

	select {}
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	py, pyErr := findPython()
	_ = json.NewEncoder(w).Encode(map[string]any{
		"installed": fileExists(filepath.Join(destDir(), "server.py")),
		"libs":      pyErr == nil && libsPresent(py),
		"python":    py,
	})
}

func handleStart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := openInstalled(); err != nil {
		w.WriteHeader(500)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	go func() {
		time.Sleep(800 * time.Millisecond)
		os.Exit(0)
	}()
}

func handleInstall(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	fl, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "stream", 500)
		return
	}
	send := func(event, data string) {
		data = strings.ReplaceAll(data, "\n", " ")
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
		fl.Flush()
	}

	dest := destDir()
	send("step", "copy")
	if err := os.MkdirAll(dest, 0755); err != nil {
		send("error", "Não criei a pasta do motor: "+err.Error())
		return
	}
	if err := os.WriteFile(filepath.Join(dest, "server.py"), serverPy, 0644); err != nil {
		send("error", "Não copiei o motor: "+err.Error())
		return
	}
	self, _ := os.Executable()
	destExe := destExePath(dest)
	if self != "" && !samePath(self, destExe) {
		_ = copyFile(self, destExe)
	} else if self != "" {
		destExe = self
	}
	send("ok", "copy")
	send("log", "Arquivos em "+dest)

	send("step", "python")
	py, err := findPython()
	if err != nil {
		send("log", "Python não encontrado. Tentando instalar…")
		if inst := installPython(send); inst != nil {
			send("error", inst.Error())
			return
		}
		py, err = findPython()
	}
	if err != nil {
		send("error", "Instale o Python em python.org (marque Add python.exe to PATH) e clique Instalar de novo.")
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", "https://www.python.org/downloads/windows/").Start()
		return
	}
	send("log", "Python: "+py)
	send("ok", "python")

	send("step", "libs")
	if libsPresent(py) {
		send("log", "Bibliotecas já estão neste PC. Nada para baixar.")
	} else {
		send("log", "Baixando bibliotecas. Na primeira vez demora.")
		if err := runLogged(send, dest, py, "-m", "pip", "install", "--user", "--upgrade", "pip"); err != nil {
			send("error", "Não atualizei o pip: "+err.Error())
			return
		}
		args := append([]string{"-m", "pip", "install", "--user"}, neededLibs...)
		args = append(args, "--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/cpu")
		if err := runLogged(send, dest, py, args...); err != nil {
			send("error", "Não instalei as bibliotecas: "+err.Error())
			return
		}
	}
	send("ok", "libs")

	send("step", "shortcut")
	if err := writeShortcuts(dest, destExe); err != nil {
		send("log", "Atalho: "+err.Error())
	}
	send("ok", "shortcut")

	send("step", "start")
	if err := spawnRun(destExe); err != nil {
		send("error", "Não liguei o motor: "+err.Error())
		return
	}
	send("ok", "start")
	send("done", "ok")
	go func() {
		time.Sleep(1500 * time.Millisecond)
		os.Exit(0)
	}()
}

func motorReady() bool {
	if !fileExists(filepath.Join(destDir(), "server.py")) {
		return false
	}
	py, err := findPython()
	if err != nil {
		return false
	}
	return libsPresent(py)
}

func libsPresent(py string) bool {
	if py == "" {
		return false
	}
	quoted := make([]string, len(neededLibs))
	for i, m := range neededLibs {
		quoted[i] = "'" + libImportName(m) + "'"
	}
	code := "import importlib.util, sys\nneed=[" + strings.Join(quoted, ",") + "]\n" +
		"sys.exit(0 if all(importlib.util.find_spec(m) for m in need) else 1)"
	cmd := exec.Command(py, "-c", code)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run() == nil
}

func openInstalled() error {
	dest := destDir()
	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dest, "server.py"), serverPy, 0644); err != nil {
		return err
	}
	destExe := destExePath(dest)
	self, err := os.Executable()
	if err != nil {
		return err
	}
	exe := self
	if !samePath(self, destExe) {
		if copyErr := copyFile(self, destExe); copyErr == nil {
			exe = destExe
		}
	}
	_ = writeShortcuts(dest, exe)
	return spawnRun(exe)
}

func spawnRun(exe string) error {
	if exe == "" {
		self, err := os.Executable()
		if err != nil {
			return err
		}
		exe = self
	}
	registerProtocol(exe)
	cmd := exec.Command(exe, "/run")
	return cmd.Start()
}

func findPython() (string, error) {
	home := os.Getenv("LOCALAPPDATA")
	roots := []string{
		filepath.Join(home, `Programs\Python\Python312\python.exe`),
		filepath.Join(home, `Programs\Python\Python313\python.exe`),
		filepath.Join(home, `Programs\Python\Python311\python.exe`),
	}
	if entries, err := filepath.Glob(filepath.Join(home, `Programs\Python\Python3*\python.exe`)); err == nil {
		roots = append(roots, entries...)
	}
	for _, p := range roots {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}
	for _, name := range []string{"py", "python", "python3"} {
		if p, err := exec.LookPath(name); err == nil {
			return p, nil
		}
	}
	return "", fmt.Errorf("python ausente")
}

func installPython(send func(string, string)) error {
	winget, err := exec.LookPath("winget")
	if err != nil {
		return fmt.Errorf("sem Python e sem winget. Instale em python.org marcando o PATH")
	}
	cmd := exec.Command(winget, "install", "-e", "--id", "Python.Python.3.12",
		"--scope", "user", "--accept-package-agreements", "--accept-source-agreements")
	out, err := cmd.CombinedOutput()
	send("log", trim(string(out)))
	if err != nil {
		return fmt.Errorf("o Windows não instalou o Python sozinho. Instale em python.org")
	}
	os.Setenv("PATH", filepath.Join(os.Getenv("LOCALAPPDATA"), `Programs\Python\Python312`)+";"+
		filepath.Join(os.Getenv("LOCALAPPDATA"), `Programs\Python\Python312\Scripts`)+";"+os.Getenv("PATH"))
	time.Sleep(2 * time.Second)
	return nil
}

func runLogged(send func(string, string), dir, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()
	if err := cmd.Start(); err != nil {
		return err
	}
	copyLog := func(r io.Reader) {
		buf := make([]byte, 2048)
		for {
			n, err := r.Read(buf)
			if n > 0 {
				for _, line := range strings.Split(string(buf[:n]), "\n") {
					line = strings.TrimSpace(line)
					if line != "" {
						send("log", line)
					}
				}
			}
			if err != nil {
				return
			}
		}
	}
	go copyLog(stdout)
	go copyLog(stderr)
	return cmd.Wait()
}

func writeShortcuts(dest, exe string) error {
	if exe == "" {
		exe = destExePath(dest)
	}
	registerProtocol(exe)
	ps := fmt.Sprintf(`
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$start = [Environment]::GetFolderPath('StartMenu')
$startup = [Environment]::GetFolderPath('Startup')
foreach ($dir in @($desktop, $start, $startup)) {
  $l = $ws.CreateShortcut((Join-Path $dir 'VozClara Motor.lnk'))
  $l.TargetPath = %q
  $l.Arguments = '/run'
  $l.WorkingDirectory = %q
  $l.WindowStyle = 7
  $l.Description = 'Motor Nemotron da VozClara (bandeja)'
  $l.Save()
}
`, exe, dest)
	cmd := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %s", err, trim(string(out)))
	}
	return nil
}

func registerProtocol(exe string) {
	cmdLine := `"` + exe + `" /run`
	cmds := [][]string{
		{"reg", "add", `HKCU\Software\Classes\vozclara`, "/ve", "/d", "URL:VozClara Motor", "/f"},
		{"reg", "add", `HKCU\Software\Classes\vozclara`, "/v", "URL Protocol", "/d", "", "/f"},
		{"reg", "add", `HKCU\Software\Classes\vozclara\shell\open\command`, "/ve", "/d", cmdLine, "/f"},
	}
	for _, a := range cmds {
		c := exec.Command(a[0], a[1:]...)
		c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		_ = c.Run()
	}
}

func runMotor() error {
	return runTray()
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func trim(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 400 {
		return s[len(s)-400:]
	}
	return s
}

func msgBox(title, text string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	proc.Call(0, uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(text))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(title))), 0x10)
}

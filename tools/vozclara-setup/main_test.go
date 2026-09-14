package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHasFlag(t *testing.T) {
	old := os.Args
	t.Cleanup(func() { os.Args = old })
	os.Args = []string{"setup.exe", "/run"}
	if !hasFlag("/run") {
		t.Fatal("expected /run")
	}
	if hasFlag("/install") {
		t.Fatal("did not expect /install")
	}
	os.Args = []string{"setup.exe", "--install"}
	if !hasFlag("--install") {
		t.Fatal("expected --install")
	}
}

func TestSamePath(t *testing.T) {
	a := filepath.Join("C:\\Users", "teco", "VozClara", "VozClara-Motor-Setup.exe")
	b := filepath.Join("C:\\Users", "teco", "VozClara", "VozClara-Motor-Setup.exe")
	if !samePath(a, b) {
		t.Fatal("same paths should match")
	}
}

func TestDestExePath(t *testing.T) {
	got := destExePath(`C:\Users\teco\AppData\Local\VozClara`)
	if filepath.Base(got) != "VozClara-Motor-Setup.exe" {
		t.Fatalf("got %s", got)
	}
}

func TestNeededLibs(t *testing.T) {
	if len(neededLibs) < 8 {
		t.Fatalf("missing libs: %v", neededLibs)
	}
}

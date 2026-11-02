#!/usr/bin/env python3
"""Run every build that makes sense on the current machine.

Usage: python3 scripts/build-all.py [--desktop-only | --android-only] [--dry-run]

Builds:
  desktop  electron-builder for the host OS (npm run dist:mac / dist:win / dist:linux)
           -> dist/
  android  sync web assets into the Capacitor project, then a debug APK via Gradle
           -> android/app/build/outputs/apk/debug/app-debug.apk
           Skipped (not failed) if android/, the Android SDK, or a JDK can't be found.

Exits non-zero if any build that ran failed.
"""
import argparse
import os
import platform
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID_DIR = os.path.join(ROOT, 'android')
IS_WIN = sys.platform == 'win32'

DESKTOP_TARGETS = {'Darwin': 'mac', 'Windows': 'win', 'Linux': 'linux'}


def run(cmd, cwd=ROOT, env=None, dry_run=False):
    print('\n$ ' + ' '.join(cmd), flush=True)
    if dry_run:
        return True
    # npm is a .cmd shim on Windows, which needs the shell to resolve.
    return subprocess.call(cmd, cwd=cwd, env=env, shell=IS_WIN) == 0


def find_android_sdk():
    for var in ('ANDROID_HOME', 'ANDROID_SDK_ROOT'):
        if os.environ.get(var) and os.path.isdir(os.environ[var]):
            return os.environ[var]
    local_props = os.path.join(ANDROID_DIR, 'local.properties')
    if os.path.isfile(local_props):
        with open(local_props) as f:
            for line in f:
                if line.startswith('sdk.dir='):
                    path = line.split('=', 1)[1].strip().replace('\\:', ':').replace('\\\\', '\\')
                    if os.path.isdir(path):
                        return path
    home = os.path.expanduser('~')
    candidates = [
        os.path.join(home, 'Library', 'Android', 'sdk'),               # macOS (Android Studio)
        os.path.join(home, 'Android', 'Sdk'),                          # Linux (Android Studio)
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk'),  # Windows
    ]
    for path in candidates:
        if os.path.isdir(path):
            return path
    return None


def find_java_home():
    if os.environ.get('JAVA_HOME') and os.path.isdir(os.environ['JAVA_HOME']):
        return os.environ['JAVA_HOME']
    # Android Studio bundles a JDK; prefer it over whatever java is on PATH.
    candidates = [
        '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
        '/opt/android-studio/jbr',
        os.path.expanduser('~/android-studio/jbr'),
        r'C:\Program Files\Android\Android Studio\jbr',
    ]
    for path in candidates:
        if os.path.isdir(path):
            return path
    return None  # Gradle will fall back to java on PATH, if any


def build_desktop(dry_run):
    target = DESKTOP_TARGETS.get(platform.system())
    if not target:
        return 'skipped', 'unsupported host OS: ' + platform.system()
    ok = run(['npm', 'run', 'dist:' + target], dry_run=dry_run)
    return ('ok' if ok else 'FAILED'), 'dist/'


def build_android(dry_run):
    if not os.path.isdir(ANDROID_DIR):
        return 'skipped', 'no android/ project (run: npx cap add android)'
    sdk = find_android_sdk()
    if not sdk:
        return 'skipped', 'Android SDK not found (install via Android Studio, or set ANDROID_HOME)'
    if IS_WIN and not shutil.which('rsync'):
        return 'skipped', 'copy:web needs rsync, which is not on PATH'

    env = dict(os.environ, ANDROID_HOME=sdk)
    java_home = find_java_home()
    if java_home:
        env['JAVA_HOME'] = java_home

    if not run(['npm', 'run', 'cap:sync'], dry_run=dry_run):
        return 'FAILED', 'cap:sync'
    gradlew = os.path.join(ANDROID_DIR, 'gradlew.bat' if IS_WIN else 'gradlew')
    if not run([gradlew, 'assembleDebug'], cwd=ANDROID_DIR, env=env, dry_run=dry_run):
        return 'FAILED', 'gradle assembleDebug'
    return 'ok', 'android/app/build/outputs/apk/debug/app-debug.apk'


def main():
    parser = argparse.ArgumentParser(description='Run all builds for the current platform.')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--desktop-only', action='store_true', help='skip the Android build')
    group.add_argument('--android-only', action='store_true', help='skip the desktop build')
    parser.add_argument('--dry-run', action='store_true', help='print commands without running them')
    args = parser.parse_args()

    if not shutil.which('npm'):
        sys.exit('npm not found on PATH; install Node.js first.')
    if not os.path.isdir(os.path.join(ROOT, 'node_modules')):
        sys.exit('node_modules/ missing; run `npm install` first.')

    builds = []
    if not args.android_only:
        builds.append(('desktop', build_desktop))
    if not args.desktop_only:
        builds.append(('android', build_android))

    results = []
    for name, fn in builds:
        print('\n=== %s ===' % name, flush=True)
        start = time.time()
        status, detail = fn(args.dry_run)
        results.append((name, status, detail, time.time() - start))
        if status == 'skipped':
            print('skipped: ' + detail)

    print('\n=== summary ===')
    for name, status, detail, secs in results:
        print('  %-8s %-8s %5.0fs  %s' % (name, status, secs, detail))

    sys.exit(1 if any(status == 'FAILED' for _, status, _, _ in results) else 0)


if __name__ == '__main__':
    main()

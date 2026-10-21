import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import os from 'os';

const router = Router();

// Current application version
export const CURRENT_DESKTOP_VERSION = '3.0.0';

// Global state for in-flight download progress
interface DownloadState {
  status: 'idle' | 'downloading' | 'ready' | 'error';
  percent: number;
  receivedMB: number;
  totalMB: number;
  targetPath?: string;
  error?: string;
  latestVersion?: string;
}

let downloadState: DownloadState = {
  status: 'idle',
  percent: 0,
  receivedMB: 0,
  totalMB: 0
};

// Helper: compare semantic versions (returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
function compareVersions(v1: string, v2: string): number {
  const p1 = (v1 || '0').replace(/^v/, '').split('.').map(Number);
  const p2 = (v2 || '0').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * GET /api/desktop/version
 * Public version manifest defining latest desktop release
 */
router.get('/version', (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3001';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;

  res.json({
    latestVersion: CURRENT_DESKTOP_VERSION,
    currentVersion: CURRENT_DESKTOP_VERSION,
    releaseDate: '2026-10-21T11:30:00Z',
    minSupportedVersion: '3.0.0',
    changelog: [
      'New brand logo and typography across all screens',
      'Desktop Edition badge and local DB status banner',
      'Automatic Excel CSV exports (all_leads, saved_leads, harvested_leads)',
      'Direct data persistence in Documents\\Strovr',
      'In-app update engine with local network and cloud discovery'
    ],
    downloadUrl: `${baseUrl}/api/desktop/download-latest`,
    portableZipUrl: `${baseUrl}/downloads/Strovr-Desktop-Portable.zip`,
    fileName: 'Strovr.exe'
  });
});

/**
 * GET /api/desktop/download-latest
 * Binary stream of latest Strovr.exe
 */
router.get('/download-latest', (_req: Request, res: Response) => {
  const candidatePaths = [
    path.resolve(__dirname, '../../../desktop-app/Strovr.exe'),
    path.resolve(__dirname, '../../../desktop-app/Strovr 3.0.0.exe'),
    path.resolve(__dirname, '../../data/Strovr.exe')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      res.setHeader('Content-Disposition', 'attachment; filename="Strovr.exe"');
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.sendFile(candidate);
    }
  }

  res.status(404).json({ error: 'Latest desktop binary not found on this server' });
});

/**
 * POST /api/desktop/check-for-updates
 * Checks whether an update is available either locally or from a remote server
 */
router.post('/check-for-updates', async (req: Request, res: Response) => {
  try {
    const customServer = req.body?.serverUrl?.trim();
    const candidateUrls: string[] = [];

    if (customServer) {
      candidateUrls.push(customServer.replace(/\/$/, '') + '/api/desktop/version');
    }
    // Also check cloud server and localhost
    candidateUrls.push('https://strovr.space/api/desktop/version');

    let manifest: any = null;
    let successfulUrl = '';

    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
          manifest = await resp.json();
          successfulUrl = url;
          break;
        }
      } catch (_) {
        // Continue to next candidate
      }
    }

    if (!manifest) {
      // Fallback to local manifest if offline
      manifest = {
        latestVersion: CURRENT_DESKTOP_VERSION,
        releaseDate: new Date().toISOString(),
        changelog: ['Local workspace runtime active.'],
        downloadUrl: `http://localhost:${process.env.PORT || 3001}/api/desktop/download-latest`
      };
    }

    const currentVersion = req.body?.currentVersion || CURRENT_DESKTOP_VERSION;
    const hasUpdate = compareVersions(manifest.latestVersion, currentVersion) > 0;

    res.json({
      hasUpdate,
      currentVersion,
      latestVersion: manifest.latestVersion,
      releaseDate: manifest.releaseDate,
      changelog: manifest.changelog || [],
      downloadUrl: manifest.downloadUrl,
      sourceUrl: successfulUrl || 'local'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check for updates' });
  }
});

/**
 * POST /api/desktop/download-update
 * Initiates the download stream for the update
 */
router.post('/download-update', (req: Request, res: Response) => {
  const downloadUrl = req.body?.downloadUrl;
  const targetVersion = req.body?.targetVersion || 'update';

  if (!downloadUrl) {
    return res.status(400).json({ error: 'Missing downloadUrl in request' });
  }

  if (downloadState.status === 'downloading') {
    return res.json({ message: 'Download already in progress', state: downloadState });
  }

  const tempDir = path.join(os.tmpdir(), 'Strovr_Update');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const targetFile = path.join(tempDir, `Strovr_New_${Date.now()}.exe`);
  const fileStream = fs.createWriteStream(targetFile);

  downloadState = {
    status: 'downloading',
    percent: 0,
    receivedMB: 0,
    totalMB: 0,
    targetPath: targetFile,
    latestVersion: targetVersion
  };

  const client = downloadUrl.startsWith('https') ? https : http;

  client.get(downloadUrl, (response) => {
    // Handle HTTP redirect (301, 302, 307)
    if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      const redirectUrl = response.headers.location;
      const redirectClient = redirectUrl.startsWith('https') ? https : http;
      redirectClient.get(redirectUrl, (redResp) => {
        handleDownloadStream(redResp, fileStream, targetFile, targetVersion);
      }).on('error', (err) => {
        handleDownloadError(err, targetFile);
      });
      return;
    }

    handleDownloadStream(response, fileStream, targetFile, targetVersion);
  }).on('error', (err) => {
    handleDownloadError(err, targetFile);
  });

  res.json({ message: 'Download started', state: downloadState });
});

function handleDownloadStream(response: http.IncomingMessage, fileStream: fs.WriteStream, targetFile: string, targetVersion: string) {
  const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
  let receivedBytes = 0;

  response.on('data', (chunk: Buffer) => {
    receivedBytes += chunk.length;
    const percent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;
    downloadState = {
      status: 'downloading',
      percent,
      receivedMB: Number((receivedBytes / (1024 * 1024)).toFixed(1)),
      totalMB: Number((totalBytes / (1024 * 1024)).toFixed(1)),
      targetPath: targetFile,
      latestVersion: targetVersion
    };
  });

  response.pipe(fileStream);

  fileStream.on('finish', () => {
    fileStream.close();
    downloadState.status = 'ready';
    downloadState.percent = 100;
  });
}

function handleDownloadError(err: Error, targetFile: string) {
  downloadState = {
    status: 'error',
    percent: 0,
    receivedMB: 0,
    totalMB: 0,
    error: err.message
  };
  try { if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile); } catch (_) {}
}

/**
 * GET /api/desktop/download-status
 * Polls the current download state
 */
router.get('/download-status', (_req: Request, res: Response) => {
  res.json(downloadState);
});

/**
 * POST /api/desktop/apply-update
 * Spawns the detached Windows batch script and terminates current application
 */
router.post('/apply-update', (req: Request, res: Response) => {
  if (downloadState.status !== 'ready' || !downloadState.targetPath || !fs.existsSync(downloadState.targetPath)) {
    return res.status(400).json({ error: 'No update binary ready to apply.' });
  }

  const newExePath = downloadState.targetPath;
  const targetExe = process.env.STROVR_EXE_PATH || 
    (process.env.PORTABLE_EXECUTABLE_FILE ? process.env.PORTABLE_EXECUTABLE_FILE : path.resolve(__dirname, '../../../desktop-app/Strovr.exe'));

  const tempDir = path.dirname(newExePath);
  const helperScript = path.join(tempDir, 'update_helper.bat');
  const parentPid = process.pid;

  const batContent = `@echo off
title Strovr Update Engine
echo ===================================================
echo             STROVR DESKTOP UPDATER
echo ===================================================
echo Applying update to: "${targetExe}"
echo Waiting for existing instance to close (PID: ${parentPid})...

:WAIT_LOOP
tasklist /FI "PID eq ${parentPid}" 2>NUL | find /I /N "${parentPid}">NUL
if "%ERRORLEVEL%"=="0" (
    timeout /t 1 /nobreak >nul
    goto WAIT_LOOP
)

echo Replacing executable binary...
move /y "${newExePath}" "${targetExe}"
if errorlevel 1 (
    echo [ERROR] Failed to replace executable. File might be locked.
    timeout /t 4 >nul
    exit /b 1
)

echo Launching updated Strovr...
start "" "${targetExe}"
del "%~f0"
exit
`;

  try {
    fs.writeFileSync(helperScript, batContent, 'utf8');

    // Respond first so client knows restart is underway
    res.json({ message: 'Update script spawned. Restarting application...' });

    // Spawn detached helper and shut down process after 500ms
    setTimeout(() => {
      spawn('cmd.exe', ['/c', helperScript], {
        detached: true,
        stdio: 'ignore'
      }).unref();

      process.exit(0);
    }, 500);

  } catch (err: any) {
    res.status(500).json({ error: `Failed to prepare update swap: ${err.message}` });
  }
});

export default router;

// ============================================================
// Orbiton Panel - Blueprint Extension & Theme Installer
// Handles upload, extract, asset mapping, and frontend rebuild.
// ============================================================
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const unzipper = require('unzipper');
const { exec } = require('child_process');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(process.env.APPDATA || require('os').homedir(), 'orbiton-data') : '/opt/orbiton-data');
const BLUEPRINTS_JSON = path.join(DATA_DIR, 'blueprints.json');

// Helper to read installed blueprints
function getInstalledBlueprints() {
  if (!fs.existsSync(BLUEPRINTS_JSON)) return [];
  try {
    return JSON.parse(fs.readFileSync(BLUEPRINTS_JSON, 'utf8') || '[]');
  } catch {
    return [];
  }
}

// Helper to save installed blueprints
function saveInstalledBlueprints(list) {
  fs.writeFileSync(BLUEPRINTS_JSON, JSON.stringify(list, null, 2), 'utf8');
}

// GET /api/blueprint/list - Get all installed extensions
router.get('/list', (req, res) => {
  res.json(getInstalledBlueprints());
});

// POST /api/blueprint/install - Upload & Install blueprint.zip package
router.post('/install', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No blueprint.zip file uploaded.' });

  const tempExtractPath = path.join(DATA_DIR, 'tmp', `blueprint_${Date.now()}`);
  fs.mkdirSync(tempExtractPath, { recursive: true });

  try {
    // 1. Extract ZIP file
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(unzipper.Extract({ path: tempExtractPath }))
        .on('close', resolve)
        .on('error', reject);
    });

    // 2. Read manifest (blueprint.json)
    const manifestPath = path.join(tempExtractPath, 'blueprint.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Invalid blueprint package: blueprint.json manifest not found.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8') || '{}');
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error('Invalid manifest format: id, name, and version are required.');
    }

    // 3. Map assets & inject code
    // Source paths
    const srcFrontend = path.join(tempExtractPath, 'frontend');
    const srcPanel = path.join(tempExtractPath, 'panel');

    // Target paths
    const targetFrontend = path.join(__dirname, '..', '..', 'frontend');
    const targetPanel = path.join(__dirname, '..');

    // Helper function to recursively copy files
    const copyRecursiveSync = (src, dest) => {
      const exists = fs.existsSync(src);
      const stats = exists && fs.statSync(src);
      const isDirectory = exists && stats.isDirectory();
      if (isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((childItemName) => {
          copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    };

    if (fs.existsSync(srcFrontend)) {
      copyRecursiveSync(srcFrontend, path.join(targetFrontend, 'src'));
    }
    if (fs.existsSync(srcPanel)) {
      copyRecursiveSync(srcPanel, targetPanel);
    }

    // 4. Save metadata into database/config
    const list = getInstalledBlueprints();
    const existingIdx = list.findIndex(item => item.id === manifest.id);
    const meta = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      author: manifest.author || 'Unknown',
      description: manifest.description || 'No description provided',
      installedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      list[existingIdx] = meta;
    } else {
      list.push(meta);
    }
    saveInstalledBlueprints(list);

    // 5. Trigger asynchronous Web Frontend rebuild
    console.log(`[Blueprint System] Rebuilding web assets for newly installed extension: ${manifest.name}...`);
    exec('npm run build', { cwd: targetFrontend }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[Blueprint System Error] Frontend rebuild failed:`, err.message);
        return;
      }
      console.log(`[Blueprint System Success] Frontend rebuild complete.\nStdout: ${stdout}`);
    });

    // Clean up uploaded zip & temp folder
    fs.unlinkSync(req.file.path);
    fs.rmSync(tempExtractPath, { recursive: true, force: true });

    res.json({
      success: true,
      message: `Blueprint '${manifest.name}' successfully installed. Web frontend rebuild is currently running in the background. Please refresh in a few seconds.`,
      manifest
    });

  } catch (err) {
    // Clean up on error
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (fs.existsSync(tempExtractPath)) fs.rmSync(tempExtractPath, { recursive: true, force: true });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

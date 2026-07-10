// ============================================================
// System Routes - CPU, RAM, Disk, Network, Runtime checks
// ============================================================
const express  = require('express');
const si       = require('systeminformation');
const os       = require('os');
const { exec } = require('child_process');
const router   = express.Router();

// GET /api/system/stats
router.get('/stats', async (req, res) => {
  try {
    const [cpu, mem, disk, network, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.osInfo(),
    ]);

    res.json({
      cpu: {
        usage:  Math.round(cpu.currentLoad * 10) / 10,
        cores:  os.cpus().length,
        model:  os.cpus()[0]?.model || 'Unknown',
        load:   os.loadavg(),
      },
      memory: {
        total:       mem.total,
        used:        mem.used,
        free:        mem.free,
        usedPercent: Math.round((mem.used / mem.total) * 100),
      },
      disk: disk.filter(d => d.size > 0).map(d => ({
        fs:          d.fs,
        mount:       d.mount,
        size:        d.size,
        used:        d.used,
        usedPercent: Math.round(d.use),
      })),
      network: network.map(n => ({
        iface:  n.iface,
        rx:     n.rx_bytes,
        tx:     n.tx_bytes,
        rxSec:  Math.round(n.rx_sec || 0),
        txSec:  Math.round(n.tx_sec || 0),
      })),
      os: {
        platform: osInfo.platform,
        distro:   osInfo.distro,
        release:  osInfo.release,
        arch:     osInfo.arch,
        hostname: osInfo.hostname,
        uptime:   os.uptime(),
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/runtimes - Check which runtimes are installed
router.get('/runtimes', (req, res) => {
  const checks = [
    { name: 'Node.js',    cmd: 'node --version',     key: 'nodejs'  },
    { name: 'NPM',        cmd: 'npm --version',       key: 'npm'     },
    { name: 'Python 3',   cmd: 'python3 --version',   key: 'python3' },
    { name: 'Pip 3',      cmd: 'pip3 --version',      key: 'pip3'    },
    { name: 'Java',       cmd: 'java --version',      key: 'java'    },
    { name: 'Docker',     cmd: 'docker --version',    key: 'docker'  },
    { name: 'Git',        cmd: 'git --version',       key: 'git'     },
    { name: 'Curl',       cmd: 'curl --version',      key: 'curl'    },
    { name: 'Wget',       cmd: 'wget --version',      key: 'wget'    },
    { name: 'Gradle',     cmd: 'gradle --version',    key: 'gradle'  },
    { name: 'Maven',      cmd: 'mvn --version',       key: 'mvn'     },
    { name: 'Go',         cmd: 'go version',          key: 'go'      },
    { name: 'Rust',       cmd: 'rustc --version',     key: 'rust'    },
    { name: 'Deno',       cmd: 'deno --version',      key: 'deno'    },
    { name: 'Bun',        cmd: 'bun --version',       key: 'bun'     },
    { name: 'PHP',        cmd: 'php --version',       key: 'php'     },
    { name: 'Ruby',       cmd: 'ruby --version',      key: 'ruby'    },
    { name: 'Perl',       cmd: 'perl --version',      key: 'perl'    },
    { name: 'Lua',        cmd: 'lua -v',              key: 'lua'     },
    { name: 'Bash',       cmd: 'bash --version',      key: 'bash'    },
  ];

  const results = {};
  let done = 0;

  checks.forEach(({ name, cmd, key }) => {
    exec(cmd, { timeout: 3000 }, (err, stdout, stderr) => {
      const out = (stdout + stderr).trim().split('\n')[0].slice(0, 80);
      results[key] = {
        name,
        installed: !err,
        version:   !err ? out : null,
      };
      done++;
      if (done === checks.length) res.json(results);
    });
  });
});

// GET /api/system/processes - Top processes by CPU
router.get('/processes', async (req, res) => {
  try {
    const procs = await si.processes();
    const top = procs.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 25)
      .map(p => ({
        pid:  p.pid,
        name: p.name,
        cpu:  Math.round(p.cpu * 10) / 10,
        mem:  Math.round(p.mem * 10) / 10,
        cmd:  (p.command || p.name).slice(0, 100),
      }));
    res.json({ count: procs.all, list: top });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

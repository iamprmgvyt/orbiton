// ============================================================
// Orbiton Panel - Cron Job Scheduler Manager
// Initializes and reloads system/app scheduled cron tasks.
// ============================================================
const cron = require('node-cron');
const { db } = require('../db/database');
const { daemonRequest } = require('../utils/daemonApi');

let activeTasks = [];

function initCronScheduler() {
  try {
    const jobs = db.prepare('SELECT * FROM cron_jobs').all();
    console.log(`📅 Initializing Cron Scheduler: Loaded ${jobs.length} jobs.`);

    for (let job of jobs) {
      if (!cron.validate(job.expression)) {
        console.warn(`⚠ Invalid cron expression for job "${job.name}": ${job.expression}`);
        continue;
      }

      const task = cron.schedule(job.expression, async () => {
        console.log(`⏰ Triggering Cron Job [${job.name}] for App [${job.app_id}]`);
        
        const dateStr = new Date().toISOString();
        db.prepare('UPDATE cron_jobs SET status = ?, last_run = ? WHERE id = ?')
          .run('running', dateStr, job.id);

        try {
          const app = db.prepare('SELECT node_id FROM apps WHERE id = ?').get(job.app_id);
          if (app) {
            // Request daemon to execute shell command in app workspace
            await daemonRequest(
              `/api/apps/${job.app_id}/execute`,
              'POST',
              { command: job.command },
              app.node_id
            );
          }
          db.prepare('UPDATE cron_jobs SET status = ? WHERE id = ?').run('idle', job.id);
        } catch (err) {
          console.error(`❌ Cron Job [${job.name}] execution failed:`, err.message);
          db.prepare('UPDATE cron_jobs SET status = ? WHERE id = ?').run('failed', job.id);
        }
      });

      activeTasks.push({ id: job.id, task });
    }
  } catch (err) {
    console.error('❌ Failed to initialize cron scheduler:', err.message);
  }
}

function reloadCronScheduler() {
  console.log('🔄 Reloading Cron Scheduler tasks...');
  // Stop all running task schedules
  for (let item of activeTasks) {
    if (item.task) item.task.stop();
  }
  activeTasks = [];
  // Re-initialize schedules
  initCronScheduler();
}

module.exports = { initCronScheduler, reloadCronScheduler };

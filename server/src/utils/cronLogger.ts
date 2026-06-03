import pool from '../config/database.js';

/**
 * Wraps a cron job execution and automatically logs its status to cron_job_logs
 * for Tableau monitoring.
 *
 * @param jobName Name of the cron job
 * @param jobFn Async function containing the job logic
 */
export async function withCronLogger(jobName: string, jobFn: () => Promise<void> | void) {
  const start = performance.now();
  let status = 'SUCCESS';
  
  console.log(`[Cron] Starting job: ${jobName}`);
  try {
    await jobFn();
  } catch (error: any) {
    status = 'FAILED';
    console.error(`[Cron] Job ${jobName} failed:`, error.message);
  } finally {
    const end = performance.now();
    const durationMs = Math.round(end - start);
    
    try {
      await pool.query(
        `INSERT INTO cron_job_logs (job_name, status, duration_ms) VALUES ($1, $2, $3)`,
        [jobName, status, durationMs]
      );
    } catch (dbErr: any) {
      console.error(`[Cron] Failed to log job status to DB:`, dbErr.message);
    }
  }
}

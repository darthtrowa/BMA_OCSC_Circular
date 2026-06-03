import os from 'os';
import pool from '../config/database.js';

let previousCpuUsage = process.cpuUsage();
let previousTime = Date.now();

/**
 * Calculates CPU usage percentage of the current Node process.
 */
function getCpuUsagePercent(): number {
  const currentCpuUsage = process.cpuUsage(previousCpuUsage);
  const currentTime = Date.now();
  
  const timeDifferenceMs = currentTime - previousTime;
  
  // Total CPU time spent by the process (user + system) in microseconds
  const totalProcessCpuTimeMs = (currentCpuUsage.user + currentCpuUsage.system) / 1000;
  
  // Percentage = (Process CPU time / Total elapsed time) * 100
  // Note: This can exceed 100% on multi-core systems, but that's normal.
  const cpuPercent = (totalProcessCpuTimeMs / timeDifferenceMs) * 100;
  
  previousCpuUsage = process.cpuUsage();
  previousTime = currentTime;
  
  return parseFloat(cpuPercent.toFixed(2));
}

export async function collectMetrics() {
  try {
    // RAM usage (Resident Set Size) in MB
    const ramUsageMb = process.memoryUsage().rss / 1024 / 1024;
    
    // DB Health and Latency
    let dbHealth = false;
    let dbResponseTimeMs = 0;
    
    const start = performance.now();
    try {
      await pool.query('SELECT 1');
      dbHealth = true;
    } catch (e) {
      dbHealth = false;
    }
    const end = performance.now();
    dbResponseTimeMs = parseFloat((end - start).toFixed(2));
    
    // CPU Usage
    const cpuUsagePercent = getCpuUsagePercent();

    // Insert into Tableau monitoring table
    await pool.query(
      `INSERT INTO system_metrics (cpu_usage_percent, ram_usage_mb, db_response_time_ms, db_health)
       VALUES ($1, $2, $3, $4)`,
      [cpuUsagePercent, parseFloat(ramUsageMb.toFixed(2)), dbResponseTimeMs, dbHealth]
    );

    // console.log(`[Metrics] Collected: CPU ${cpuUsagePercent}%, RAM ${ramUsageMb.toFixed(2)}MB, DB ${dbResponseTimeMs}ms`);
  } catch (err: any) {
    console.error('❌ Failed to collect system metrics:', err.message);
  }
}

let collectorInterval: NodeJS.Timeout | null = null;

export function startMetricsCollector(intervalMs = 60000) {
  if (collectorInterval) {
    clearInterval(collectorInterval);
  }
  // Initial collection
  collectMetrics();
  // Schedule
  collectorInterval = setInterval(collectMetrics, intervalMs);
  console.log(`✅ Tableau Metrics Collector started (interval: ${intervalMs}ms)`);
}

export function stopMetricsCollector() {
  if (collectorInterval) {
    clearInterval(collectorInterval);
    collectorInterval = null;
  }
}

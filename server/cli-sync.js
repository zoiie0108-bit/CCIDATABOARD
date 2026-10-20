'use strict';

/* 命令行同步：可用于 Windows 计划任务 / cron
   用法：node server/cli-sync.js
*/

const { runSync } = require('./sync');

(async () => {
  const started = Date.now();
  try {
    const run = await runSync((msg) => console.log(msg));
    console.log('');
    console.log(`状态：${run.status}`);
    console.log(`新增 ${run.totals.newCount} 条，重复 ${run.totals.duplicateCount} 条，失败 ${run.totals.errorCount} 次`);
    console.log(`用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
    process.exit(run.status === 'failed' ? 1 : 0);
  } catch (err) {
    console.error('同步失败：', err);
    process.exit(1);
  }
})();

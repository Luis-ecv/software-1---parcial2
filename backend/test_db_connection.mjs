import pool from './src/config/db.js';

(async () => {
  try {
    const res = await pool.query('SELECT NOW() as now');
    console.log(JSON.stringify({ success: true, now: res.rows[0].now }));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  }
})();

/**
 * PM2 Ecosystem Configuration
 *
 * IMPORTANT: This app uses SQLite — single instance (fork mode) only.
 * Multiple instances would corrupt the database.
 *
 * Usage:
 *   pm2 start ecosystem.config.js       # Start
 *   pm2 restart ecosystem.config.js     # Restart after update
 *   pm2 stop chicken-backend            # Stop
 *   pm2 logs chicken-backend            # View logs
 *   pm2 save                            # Persist across reboots
 */
module.exports = {
    apps: [
        {
            name: 'chicken-backend',
            script: 'dist/main.js',
            cwd: '/home/chicken/app/backend',

            // SQLite requires single-process — never use cluster mode
            instances: 1,
            exec_mode: 'fork',

            // Reliability
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            restart_delay: 3000,

            // Load .env automatically
            env_file: '/home/chicken/app/backend/.env',

            // Always enforce production
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },

            // Logs
            out_file: '/home/chicken/logs/backend-out.log',
            error_file: '/home/chicken/logs/backend-error.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
    ],
};

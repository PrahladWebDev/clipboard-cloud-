module.exports = {
  apps: [
    {
      name: 'clipboard-api',
      script: 'dist/src/main.js',
      cwd: '/var/www/projects/clipboard-cloud/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5008,
      },
    },
    {
      name: 'clipboard-frontend',
      script: 'npm',
      args: 'start',
      interpreter: 'none',
      cwd: '/var/www/projects/clipboard-cloud/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};

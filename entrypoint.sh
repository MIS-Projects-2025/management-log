#!/bin/sh
chown -R 1000:33 /var/www/storage /var/www/bootstrap/cache 2>/dev/null
chmod -R 775 /var/www/storage /var/www/bootstrap/cache 2>/dev/null
exec "$@"

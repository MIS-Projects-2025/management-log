#!/bin/sh
find /var/www -path "*/storage*" -exec chown www-data:www-data {} + \
  && find /var/www -path "*/storage*" -exec chmod 775 {} +
find /var/www -path "*/bootstrap/cache*" -exec chown www-data:www-data {} + \
  && find /var/www -path "*/bootstrap/cache*" -exec chmod 775 {} +

exec "$@"
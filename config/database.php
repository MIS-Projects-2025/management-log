<?php

use Illuminate\Support\Str;

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    |
    | Here you may specify which of the database connections below you wish
    | to use as your default connection for database operations. This is
    | the connection which will be utilized unless another connection
    | is explicitly specified when you execute a query / statement.
    |
    */

    'default' => env('DB_CONNECTION', 'sqlite'),

    /*
    |--------------------------------------------------------------------------
    | Database Connections
    |--------------------------------------------------------------------------
    |
    | Below are all of the database connections defined for your application.
    | An example configuration is provided for each database system which
    | is supported by Laravel. You're free to add / remove connections.
    |
    */

    'connections' => [

        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DB_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
            'busy_timeout' => null,
            'journal_mode' => null,
            'synchronous' => null,
        ],

        'dtr' => [
            'driver' => 'mysql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => env('DB_CHARSET', 'utf8mb4'),
            'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'scheduler' => [
            'driver' => 'mysql',
            'url' => env('ADB_URL'),
            'host' => env('SDB_HOST', '127.0.0.1'),
            'port' => env('SDB_PORT', '3306'),
            'database' => env('SDB_DATABASE', 'laravel'),
            'username' => env('SDB_USERNAME', 'root'),
            'password' => env('SDB_PASSWORD', ''),
            'unix_socket' => env('SDB_SOCKET', ''),
            'charset' => env('SDB_CHARSET', 'utf8mb4'),
            'collation' => env('SDB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'masterlist' => [
            'driver' => 'mysql',
            'url' => env('ADB_URL'),
            'host' => env('MDB_HOST', '127.0.0.1'),
            'port' => env('MDB_PORT', '3306'),
            'database' => env('MDB_DATABASE', 'laravel'),
            'username' => env('MDB_USERNAME', 'root'),
            'password' => env('MDB_PASSWORD', ''),
            'unix_socket' => env('MDB_SOCKET', ''),
            'charset' => env('MDB_CHARSET', 'utf8mb4'),
            'collation' => env('MDB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'leave' => [
            'driver' => 'mysql',
            'url' => env('LDB_URL'),
            'host' => env('LDB_HOST', '127.0.0.1'),
            'port' => env('LDB_PORT', '3306'),
            'database' => env('LDB_DATABASE', 'laravel'),
            'username' => env('LDB_USERNAME', 'root'),
            'password' => env('LDB_PASSWORD', ''),
            'unix_socket' => env('LDB_SOCKET', ''),
            'charset' => env('LDB_CHARSET', 'utf8mb4'),
            'collation' => env('LDB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'ob' => [
            'driver' => 'mysql',
            'url' => env('ODB_URL'),
            'host' => env('ODB_HOST', '127.0.0.1'),
            'port' => env('ODB_PORT', '3306'),
            'database' => env('ODB_DATABASE', 'laravel'),
            'username' => env('ODB_USERNAME', 'root'),
            'password' => env('ODB_PASSWORD', ''),
            'unix_socket' => env('ODB_SOCKET', ''),
            'charset' => env('ODB_CHARSET', 'utf8mb4'),
            'collation' => env('ODB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'authify' => [
            'driver' => 'mysql',
            'url' => env('ADB_URL'),
            'host' => env('ADB_HOST', '127.0.0.1'),
            'port' => env('ADB_PORT', '3306'),
            'database' => env('ADB_DATABASE', 'laravel'),
            'username' => env('ADB_USERNAME', 'root'),
            'password' => env('ADB_PASSWORD', ''),
            'unix_socket' => env('ADB_SOCKET', ''),
            'charset' => env('ADB_CHARSET', 'utf8mb4'),
            'collation' => env('ADB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],


        // 'mariadb' => [
        //     'driver' => 'mariadb',
        //     'url' => env('DB_URL'),
        //     'host' => env('DB_HOST', '127.0.0.1'),
        //     'port' => env('DB_PORT', '3306'),
        //     'database' => env('DB_DATABASE', 'laravel'),
        //     'username' => env('DB_USERNAME', 'root'),
        //     'password' => env('DB_PASSWORD', ''),
        //     'unix_socket' => env('DB_SOCKET', ''),
        //     'charset' => env('DB_CHARSET', 'utf8mb4'),
        //     'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
        //     'prefix' => '',
        //     'prefix_indexes' => true,
        //     'strict' => true,
        //     'engine' => null,
        //     'options' => extension_loaded('pdo_mysql') ? array_filter([
        //         PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
        //     ]) : [],
        // ],

        // 'pgsql' => [
        //     'driver' => 'pgsql',
        //     'url' => env('DB_URL'),
        //     'host' => env('DB_HOST', '127.0.0.1'),
        //     'port' => env('DB_PORT', '5432'),
        //     'database' => env('DB_DATABASE', 'laravel'),
        //     'username' => env('DB_USERNAME', 'root'),
        //     'password' => env('DB_PASSWORD', ''),
        //     'charset' => env('DB_CHARSET', 'utf8'),
        //     'prefix' => '',
        //     'prefix_indexes' => true,
        //     'search_path' => 'public',
        //     'sslmode' => 'prefer',
        // ],

        // 'sqlsrv' => [
        //     'driver' => 'sqlsrv',
        //     'url' => env('DB_URL'),
        //     'host' => env('DB_HOST', 'localhost'),
        //     'port' => env('DB_PORT', '1433'),
        //     'database' => env('DB_DATABASE', 'laravel'),
        //     'username' => env('DB_USERNAME', 'root'),
        //     'password' => env('DB_PASSWORD', ''),
        //     'charset' => env('DB_CHARSET', 'utf8'),
        //     'prefix' => '',
        //     'prefix_indexes' => true,
        //     // 'encrypt' => env('DB_ENCRYPT', 'yes'),
        //     // 'trust_server_certificate' => env('DB_TRUST_SERVER_CERTIFICATE', 'false'),
        // ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Migration Repository Table
    |--------------------------------------------------------------------------
    |
    | This table keeps track of all the migrations that have already run for
    | your application. Using this information, we can determine which of
    | the migrations on disk haven't actually been run on the database.
    |
    */

    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Redis Databases
    |--------------------------------------------------------------------------
    |
    | Redis is an open source, fast, and advanced key-value store that also
    | provides a richer body of commands than a typical key-value system
    | such as Memcached. You may define your connection settings here.
    |
    */

    'redis' => [

        'client' => env('REDIS_CLIENT', 'phpredis'),

        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_') . '_database_'),
            'persistent' => env('REDIS_PERSISTENT', false),
        ],

        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],

        'cache' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],

    ],

];

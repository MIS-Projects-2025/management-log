<?php

use App\Http\Middleware\AuthMiddleware;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ScanLogController;
use App\Http\Controllers\ImportScanLogController;

$app_name = env('APP_NAME', '');

Route::redirect('/', "/$app_name");

Route::prefix($app_name)->middleware(AuthMiddleware::class)->group(function () {

    // Scan Logs Routes
    // scan.php
    Route::get('/scan-logs', [ScanLogController::class, 'index'])
        ->name('scan-logs.index');  // ← was 'scan-logs'

    Route::post('/scan-logs/store', [ScanLogController::class, 'store'])
        ->name('scan-logs.store');

    Route::post('/scan-logs/fingerprint-identify', [ScanLogController::class, 'fingerprintIdentify'])
        ->name('scan-logs.fingerprint-identify');

    Route::post('/import-scan-logs', [ImportScanLogController::class, 'store'])
        ->name('import-scan-logs.store');
});
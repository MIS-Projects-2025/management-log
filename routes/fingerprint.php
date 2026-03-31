<?php

use App\Http\Middleware\AuthMiddleware;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RegisterFingerprintController;

$app_name = env('APP_NAME', '');

Route::prefix($app_name)
    ->middleware(['web', AuthMiddleware::class]) // ← 'web' is required for CSRF
    ->group(function () {

        Route::get('/register-fingerprint', [RegisterFingerprintController::class, 'index'])
            ->name('register-fingerprint.index');

        Route::post('/register-fingerprint/capture', [RegisterFingerprintController::class, 'capture'])
            ->name('register-fingerprint.capture');

        Route::post('/register-fingerprint/store', [RegisterFingerprintController::class, 'store'])
            ->name('register-fingerprint.store');

        Route::delete('/register-fingerprint/destroy', [RegisterFingerprintController::class, 'destroy'])
            ->name('register-fingerprint.destroy');

        Route::patch('/register-fingerprint/toggle', [RegisterFingerprintController::class, 'toggleActive'])
            ->name('register-fingerprint.toggle');
    });
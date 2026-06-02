<?php

use App\Http\Middleware\AuthMiddleware;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ManagementLogsController;

$app_name = env('APP_NAME', '');

Route::redirect('/', "/$app_name");

Route::prefix($app_name)->middleware(AuthMiddleware::class)->group(function () {

    // Management Logs Routes
    Route::get('/management-logs', [ManagementLogsController::class, 'index'])->name('management-logs.index');
    Route::get('/management-logs/by-range', [ManagementLogsController::class, 'getLogsByRange'])->name('management-logs.by-range');
    Route::get('/management-logs/by-date', [ManagementLogsController::class, 'getLogsByDate'])->name('management-logs.by-date');
    Route::get('/management-logs/employee/{employeeId}', [ManagementLogsController::class, 'getEmployeeLogs'])->name('management-logs.employee');
    Route::post('/management-logs/export', [ManagementLogsController::class, 'export'])->name('management-logs.export');

    Route::prefix('vip-logs')->group(function () {
    Route::get('/by-range', [ManagementLogsController::class, 'getLogsByRange'])->name('vip-logs.by-range');
    Route::get('/employee/{employeeId}', [ManagementLogsController::class, 'getEmployeeLogs'])->name('vip-logs.employee');
    Route::get('/by-date', [ManagementLogsController::class, 'getLogsByDate'])->name('vip-logs.by-date');
    Route::post('/export', [ManagementLogsController::class, 'export'])->name('vip-logs.export');
    Route::post('/management-logs/export',          [ManagementLogsController::class, 'exportDispatch'])->name('mgmt-logs.export');
    Route::get('/management-logs/export-progress',  [ManagementLogsController::class, 'exportProgress'])->name('mgmt-logs.export-progress');
    Route::get('/management-logs/export-download',  [ManagementLogsController::class, 'exportDownload'])->name('mgmt-logs.export-download');
    Route::post('/vip-logs/upsert', [ManagementLogsController::class, 'upsertLog'])->name('vip-logs.upsert');
    Route::post('/vip-logs/add-single', [ManagementLogsController::class, 'addSingleLog'])->name('vip-logs.add-single');
});

});
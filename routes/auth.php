<?php

use App\Http\Controllers\AuthenticationController;
use App\Http\Controllers\DashboardController;
use App\Http\Middleware\AuthMiddleware;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

$app_name = env('APP_NAME', '');

Route::prefix($app_name)->group(function () {


  Route::middleware(AuthMiddleware::class)->group(function () {
    Route::get("/logout", [AuthenticationController::class, 'logout'])->name('logout');
  });

  Route::get("/unauthorized", function () {
    return Inertia::render('Unauthorized');
  })->name(name: 'unauthorized');
});

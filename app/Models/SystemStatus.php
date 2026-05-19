<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemStatus extends Model
{
    protected $table = 'system_status';
    protected $fillable = ['status', 'message', 'updated_at'];

    const STATUS_ONLINE      = 'online';
    const STATUS_MAINTENANCE = 'maintenance';
}

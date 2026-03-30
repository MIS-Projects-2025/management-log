<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkScheduler extends Model
{
    use HasFactory;

    protected $connection = 'scheduler'; // custom database connection
    protected $table = 'work_scheduler';
    protected $primaryKey = 'ID';

    public $timestamps = false; // we will manage datetime fields manually

    protected $fillable = [
        'EMPID',
        'EMPNAME',
        'SCHEDULE',
        'WORK_SCHED_STATUS',
        'PAYROLL_DATE_START',
        'PAYROLL_DATE_END',
        'SUPERVISOR_ID',
        'APPROVER2_ID',
        'DEPARTMENT',
        'SHIFT',
        'REMARKS',
        'CREATED_BY',
        'DATE_CREATED',
        'DATE_UPDATED',
    ];

    protected $casts = [
        'SCHEDULE' => 'array',          // auto convert JSON to array
        'WORK_SCHED_STATUS' => 'boolean',
        'PAYROLL_DATE_START' => 'date',
        'PAYROLL_DATE_END' => 'date',
        'DATE_CREATED' => 'datetime',
        'DATE_UPDATED' => 'datetime',
    ];
}
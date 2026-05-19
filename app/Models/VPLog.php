<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class VPLog extends Model
{
    use HasFactory;

    /**
     * The database connection for DTR logs
     *
     * @var string
     */
    protected $connection = 'dtr';

    /**
     * The table associated with the model
     *
     * @var string
     */
    protected $table = 'vp_logs';

    /**
     * The primary key for the model
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The attributes that are mass assignable
     *
     * @var array<string>
     */
    protected $fillable = [
        'employee_id',
        'employee_name',
        'department',
        'job_title',
        'prodline',
        'station',
        'log_time',
        'log_date',
        'log_type',
    ];

    /**
     * The attributes that should be cast
     *
     * @var array<string, string>
     */
    protected $casts = [
        'log_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

/**
     * Log type constants for type safety
     */
    public const LOG_TYPE_CHECK_IN = 'check_in';
    public const LOG_TYPE_CHECK_OUT = 'check_out';

    /**
     * Get all valid log types
     *
     * @return array<string>
     */
    public static function getValidLogTypes(): array
    {
        return [
            self::LOG_TYPE_CHECK_IN,
            self::LOG_TYPE_CHECK_OUT,
        ];
    }

    /**
     * Get formatted log time
     *
     * @return string
     */
    public function getFormattedLogTimeAttribute(): string
    {
        return Carbon::parse($this->log_time)->format('h:i A');
    }

    /**
     * Get formatted log date
     *
     * @return string
     */
    public function getFormattedLogDateAttribute(): string
    {
        return $this->log_date->format('M d, Y');
    }

    /**
     * Get formatted created at timestamp
     *
     * @return string
     */
    public function getFormattedCreatedAtAttribute(): string
    {
        return $this->created_at->format('M d, Y h:i A');
    }

    /**
     * Scope to filter by employee
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $employeeId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForEmployee($query, string $employeeId)
    {
        return $query->where('employee_id', $employeeId);
    }

    /**
     * Scope to filter by log type
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $logType
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfType($query, string $logType)
    {
        return $query->where('log_type', $logType);
    }

    /**
     * Scope to filter by date
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $date
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOnDate($query, string $date)
    {
        return $query->whereDate('log_date', $date);
    }

    /**
     * Scope to get logs for today
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeToday($query)
    {
        return $query->whereDate('log_date', Carbon::today());
    }

    /**
     * Scope to get latest logs first
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeLatest($query)
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Get the employee relationship (if you have an Employee model)
     * Uncomment if you want to add relationship
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    // public function employee()
    // {
    //     return $this->belongsTo(EmployeeMasterlist::class, 'employee_id', 'EMPLOYID');
    // }
}
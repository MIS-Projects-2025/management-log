<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeLeave extends Model
{
    /**
     * Use the masterlist database connection
     */
    protected $connection = 'leave';

    /**
     * Table name
     */
    protected $table = 'employee_leaves';

    /**
     * Primary key
     */
    protected $primaryKey = 'LEAVEID';

    /**
     * Primary key is auto-incrementing
     */
    public $incrementing = true;

    /**
     * Primary key type
     */
    protected $keyType = 'int';

    /**
     * Disable Laravel default timestamps
     */
    public $timestamps = false;

    /**
     * Custom timestamp columns
     */
    protected $dates = [
        'DATESTART',
        'DATEEND',
        'DATEPOSTED',
        'APPROVEDDATE',
        'APPROVEDDATE2',
        'date_created',
        'date_updated',
    ];

    /**
     * Mass assignable fields
     */
    protected $fillable = [
        'EMPLOYID',
        'EMPNAME',
        'DATESTART',
        'DATEEND',
        'LEAVE_DURATION',
        'TIMESTART',
        'TIMEEND',
        'NOOFHOURS',
        'SHIFTTYPE',
        'TYPEOFLEAVE',
        'REASON',
        'LEAVESTATUS',
        'REMARKS',
        'ADMINREMARKS',
        'DATEPOSTED',
        'APPROVER1',
        'APPROVER2',
        'APPROVEDDATE',
        'APPROVEDDATE2',
        'APPROVER1_REMARKS',
        'APPROVER2_REMARKS',
        'PERIOD',
        'LATEFILING',
        'TOTAL_LEAVE_HRS',
        'PAID_LEAVE_HOURS',
        'UNPAID_LEAVE_HOURS',
        'REMAINING_LEAVE',
        'WITH_APPEAL',
        'APPEAL_STATUS',
        'NO_OF_OFFENSE',
        'ISBATCH',
        'date_created',
        'date_updated',
    ];
}
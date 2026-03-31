<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ObRecord extends Model
{
    // Use the "ob" database connection
    protected $connection = 'ob';

    // Table name
    protected $table = 'ob_record';

    // Primary key
    protected $primaryKey = 'ID';

    // Auto-incrementing primary key
    public $incrementing = true;

    // Primary key type
    protected $keyType = 'int';

    // Timestamps (you are using custom column names)
    const CREATED_AT = 'date_created';
    const UPDATED_AT = 'date_updated';

    // Mass assignable fields
    protected $fillable = [
        'EMPID',
        'EMPNAME',
        'DATE_FILE',
        'EMPSTATUS',
        'DEPARTMENT',
        'DESTINATION_COMPANY',
        'DESTINATION_ADDRESS',
        'DATE_OB_FROM',
        'DATE_OB_TO',
        'TIME_FROM',
        'TIME_TO',
        'PURPOSE',
        'REQUESTED_BY',
        'APPROVED_BY',
        'NOTED_BY',
        'STATUS',
        'REMARKS',
        'FORM_TYPE',
        'VEHICLE',
        'DRIVER_CHOICE',
        'EMPPOSITION',
        'DATE_OF_APPROVED',
        'DATE_OF_NOTED',
        'EMAIL_STATUS',
        'GROUP_ID',
        'DRIVER_ID',
        'DRIVER_NAME',
        'PLATE_NUMBER',
        'DATE_OF_HANDLED',
    ];

    // Casts for datetime fields
    protected $casts = [
        'DATE_FILE'        => 'datetime',
        'DATE_OF_APPROVED' => 'datetime',
        'DATE_OF_NOTED'    => 'datetime',
        'DATE_OF_HANDLED'  => 'datetime',
        'date_created'     => 'datetime',
        'date_updated'     => 'datetime',
    ];
}
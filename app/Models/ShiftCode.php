<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShiftCode extends Model
{
    use HasFactory;

    protected $connection = 'scheduler'; // same custom connection
    protected $table = 'shift_codes';
    protected $primaryKey = 'SHIFT_CODE_ID';

    public $timestamps = false; // we'll map custom timestamp columns

    protected $fillable = [
        'SHIFT_CODE_STATUS',
        'SHIFTCODE',
        'SHIFTCODE_VALUE',
        'SHIFTCODE_DESC',
        'SHIFT_GROUP',
        'SHIFTCODE_BG_COLOR',
        'SHIFTCODE_FONT_COLOR',
        'TIME_WINDOWS',
        'OT_HRS',
        'CREATED_AT',
        'CREATED_BY',
        'UPDATED_AT',
        'UPDATED_BY',
    ];

    protected $casts = [
        'TIME_WINDOWS' => 'array', // JSON → array
        'CREATED_AT' => 'datetime',
        'UPDATED_AT' => 'datetime',
    ];
}
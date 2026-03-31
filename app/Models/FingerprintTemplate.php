<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FingerprintTemplate extends Model
{
    protected $connection = 'dtr';
    protected $table      = 'fingerprint_templates';
    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $fillable = [
        'employid',
        'template_data',
        'device_type',
        'finger_index',
        'quality',
        'registered_by',
        'is_active',
    ];

    /**
     * IMPORTANT: template_data is a raw binary BLOB.
     * Hiding it prevents "Malformed UTF-8 characters" errors when Laravel
     * tries to json_encode() the model anywhere in the app.
     */
    protected $hidden = [
        'template_data',
    ];

    protected $casts = [
        'finger_index' => 'integer',
        'quality'      => 'integer',
        'is_active'    => 'boolean',
    ];

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', 1);
    }

    public function scopeInactive($query)
    {
        return $query->where('is_active', 0);
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function employee()
    {
        return $this->belongsTo(EmployeeMasterlist::class, 'employid', 'EMPLOYID');
    }
}
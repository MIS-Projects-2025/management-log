<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeMasterlist extends Model
{
    /**
     * Database connection
     */
    protected $connection = 'masterlist';

    /**
     * Table name
     */
    protected $table = 'employee_masterlist';

    /**
     * Primary key
     */
    protected $primaryKey = 'EMPID';

    /**
     * Primary key type
     */
    protected $keyType = 'int';

    /**
     * Auto increment
     */
    public $incrementing = true;

    /**
     * Disable default timestamps
     */
    public $timestamps = false;

    /**
     * Mass assignable fields
     */
    protected $fillable = [
        'EMPLOYID',
        'EMPNAME',
        'EMPPOSITION',
        'JOB_TITLE',
        'COMPANY',
        'DEPARTMENT',
        'PRODLINE',
        'STATION',
        'TEAM',
        'EMPSTATUS',
        'EMPCLASS',
        'SHIFTTYPE',
        'EMPSEX',
        'BIRTHDAY',
        'DATEHIRED',
        'DATEREG',
        'EMAIL',
        'USERNAME',
        'PASSWRD',
        'ACCSTATUS',
        'APPROVER1',
        'APPROVER1_1',
        'APPROVER2',
        'APPROVER2_1',
        'APPROVER2_2',
        'APPROVER3',
        'SICKLEAVE',
        'VACATIONLEAVE',
        'BIRTHDAYLEAVE',
        'BEREAVEMENTLEAVE',
        'MATERNITYLEAVE',
        'PATERNITYLEAVE',
        'EMERGENCYLEAVE',
        'VAWC',
        'SLW',
        'SPL',
        'MILITARY',
        'SIL',
        'SLINCR',
        'VLINCR',
        'DATEMONTHLYINCR',
        'VLYEARLYINCR',
        'VLSLRESETDATE',
        'VLEXCESS',
        'CONVERTCASH',
        'LASTNAME',
        'FIRSTNAME',
        'MIDDLENAME',
        'MIDDLE_INITIAL',
        'ADDRESS',
        'HOUSE_NO',
        'BRGY',
        'CITY',
        'PROVINCE',
        'PERMA_ADDRESS',
        'PERMA_HOUSE_NO',
        'PERMA_CITY',
        'PERMA_BRGY',
        'PERMA_PROVINCE',
        'CONTACT_NO',
        'CIVIL_STATUS',
        'TIN_NO',
        'SSS_NO',
        'PHILHEALTH_NO',
        'PAG_IBIG_NO',
        'BANK_ACCT_NO',
        'EDUC_ATTAINMENT',
        'DATE_SEPARATION',
        'CLEARANCE_UPDATE',
        'AGE',
        'NICKNAME',
        'CONTACT_PERSON',
        'RELATION_TO_CONTACT_PERSON',
        'ADDRESS_OF_CONTACT_PERSON',
        'CONTACT_NO_OF_CONTACT_PERSON',
        'SHUTTLE',
        'SERVICE_LENGTH',
        'REPORT_TO',
        'AREA',
        'SEPARATION_REASON',
        'SG_CATEGORY',
        'EDUC_LEVEL',
        'SG_DESIGNATION',
        'RATE_CODE',
        'EMPLEVEL',
        'BENEFIT_LEVEL',
        'HMO_LEVEL',
        'GROUP_LIFE_INSURANCE_CLASS',
        'PRINCIPAL_HMO_CERT_NO',
        'CERTIFICATION_STATUS',
        'FATHERS_NAME',
        'FATHERS_BDAY',
        'FATHERS_AGE',
        'FATHERS_HMO_CERT_NO',
        'MOTHERS_NAME',
        'MOTHERS_BDAY',
        'MOTHERS_AGE',
        'MOTHERS_HMO_CERT_NO',
        'SPOUSE_NAME',
        'DATE_OF_MARRIAGE',
        'SPOUSE_BDAY',
        'SPOUSE_AGE',
        'SPOUSE_HMO_CERT_NO',
        'CHILDREN1_NAME',
        'CHILDREN1_BDAY',
        'CHILDREN1_AGE',
        'CHILDREN1_HMO_CERT_NO',
        'CHILDREN2_NAME',
        'CHILDREN2_BDAY',
        'CHILDREN2_AGE',
        'CHILDREN2_HMO_CERT_NO',
        'CHILDREN3_NAME',
        'CHILDREN3_BDAY',
        'CHILDREN3_AGE',
        'CHILDREN3_HMO_CERT_NO',
        'TRAININGS_SEMINARS1',
        'TRAININGS_SEMINARS2',
        'MONTH_YEAR_ATTENDED1',
        'MONTH_YEAR_ATTENDED2',
        'EMPLOYER',
        'AGENCY_CO',
        'INSURANCE_AMOUNT',
        'DD_LIMIT',
        'RMBRD_RMTYPE',
        'pa_level',
        'date_created',
        'BIOMETRIC_STATUS',
    ];

    /**
     * Attribute casting
     */
    protected $casts = [
        'BIRTHDAY'          => 'date',
        'DATEHIRED'         => 'date',
        'DATEREG'           => 'date',
        'DATE_OF_MARRIAGE'  => 'date',
        'DATEMONTHLYINCR'   => 'date',
        'VLYEARLYINCR'      => 'date',
        'VLSLRESETDATE'     => 'date',
        'date_created'      => 'datetime',

        'SICKLEAVE'         => 'float',
        'VACATIONLEAVE'     => 'float',
        'BIRTHDAYLEAVE'     => 'float',
        'BEREAVEMENTLEAVE'  => 'float',
        'MATERNITYLEAVE'    => 'float',
        'PATERNITYLEAVE'    => 'float',
        'EMERGENCYLEAVE'    => 'float',
        'pa_level'          => 'decimal:2',
    ];
}
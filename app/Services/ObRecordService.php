<?php

namespace App\Services;

use App\Models\ObRecord;
use Carbon\Carbon;

class ObRecordService
{
    /**
     * Get approved OB/PB records for employees
     */
    public function getApprovedRecords(array $employeeIds, string $startDate, string $endDate = null)
    {
        $endDate = $endDate ?? Carbon::now()->format('Y-m-d');
        
        return ObRecord::whereIn('EMPID', $employeeIds)
            ->whereIn('STATUS', ['1', '2'])
            ->where(function($query) use ($startDate, $endDate) {
                // Overlap: record starts before period ends AND record ends after period starts
                $query->whereDate('DATE_OB_FROM', '<=', $endDate)
                      ->whereDate('DATE_OB_TO', '>=', $startDate);
            })
            ->select(
                'ID', 'EMPID', 'EMPNAME', 'DATE_FILE', 'DEPARTMENT',
                'DESTINATION_COMPANY', 'DESTINATION_ADDRESS', 'DATE_OB_FROM',
                'DATE_OB_TO', 'TIME_FROM', 'TIME_TO', 'PURPOSE',
                'STATUS', 'FORM_TYPE', 'EMPPOSITION'
            )
            ->get()
            ->map(fn($record) => $this->formatObRecord($record, $startDate, $endDate));
    }

    /**
     * Format OB record data
     */
    private function formatObRecord($record, ?string $clampStart = null, ?string $clampEnd = null)
    {
        $obStart = Carbon::parse($record->DATE_OB_FROM);
        $obEnd   = Carbon::parse($record->DATE_OB_TO);

        $effectiveStart = $clampStart ? Carbon::parse($clampStart)->max($obStart) : $obStart;
        $effectiveEnd   = $clampEnd   ? Carbon::parse($clampEnd)->min($obEnd)     : $obEnd;

        $durationInDays = $effectiveStart->diffInDays($effectiveEnd) + 1;

        return [
            'ID' => $record->ID,
            'EMPID' => (string) $record->EMPID,
            'EMPNAME' => $record->EMPNAME,
            'DATE_FILE' => $record->DATE_FILE,
            'DEPARTMENT' => $record->DEPARTMENT,
            'DESTINATION_COMPANY' => $record->DESTINATION_COMPANY,
            'DESTINATION_ADDRESS' => $record->DESTINATION_ADDRESS,
            'DATE_OB_FROM' => $record->DATE_OB_FROM,
            'DATE_OB_TO' => $record->DATE_OB_TO,
            'TIME_FROM' => $record->TIME_FROM,
            'TIME_TO' => $record->TIME_TO,
            'PURPOSE' => $record->PURPOSE,
            'STATUS' => (string) $record->STATUS,
            'FORM_TYPE' => strtolower((string) $record->FORM_TYPE),
            'EMPPOSITION' => $record->EMPPOSITION,
            'DURATION_DAYS' => $durationInDays,
        ];
    }
}
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use App\Services\ExcelScanLogImportService;

class ImportScanLogController extends Controller
{
    private ExcelScanLogImportService $importService;

    public function __construct(ExcelScanLogImportService $importService)
    {
        $this->importService = $importService;
    }

    /**
     * Handle the Excel file upload and import.
     * Returns a redirect back with flash data for Inertia (same pattern as ScanLogController).
     */
    public function store(Request $request): RedirectResponse
    {
        if (session('emp_data.emp_dept') === 'Human Resource') {
            abort(403, 'Unauthorized access.');
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240'],
        ]);

        try {
            $result = $this->importService->import($request->file('file'));

            return back()->with('import_result', $result);

        } catch (\Exception $e) {
            Log::error('Excel scan log import failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors([
                'file' => 'Import failed: ' . $e->getMessage(),
            ]);
        }
    }
}
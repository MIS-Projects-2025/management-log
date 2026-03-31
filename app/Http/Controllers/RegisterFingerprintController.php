<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\VipLogsService;
use App\Services\FingerprintService;
use App\Models\FingerprintTemplate;
use Illuminate\Support\Facades\Auth;

class RegisterFingerprintController extends Controller
{
    public function __construct(
        protected VipLogsService     $vipLogsService,
        protected FingerprintService $fingerprintService,
    ) {}

    public function index(Request $request): \Inertia\Response
    {
        $employees   = $this->vipLogsService->getVipEmployees();
        $employeeIds = $employees->pluck('employee_id')->map(fn($id) => (string)$id)->toArray();

        $templates = FingerprintTemplate::whereIn('employid', $employeeIds)
            ->select('employid', 'finger_index', 'quality', 'is_active', 'created_at')
            ->orderBy('finger_index')
            ->get()
            ->groupBy(fn($t) => (string)$t->employid)
            ->map(fn($rows) => $rows->map(fn($t) => [
                'finger_index'  => $t->finger_index,
                'quality'       => $t->quality,
                'is_active'     => $t->is_active,
                'registered_at' => $t->created_at?->format('Y-m-d H:i'),
            ])->values()->toArray())
            ->toArray();

        $employees = $employees->map(function ($emp) use ($templates) {
            $empId = (string) $emp['employee_id'];
            $emp['fingerprints'] = $templates[$empId] ?? [];
            return $emp;
        });

        return Inertia::render('RegisterFingerprint', [
            'tableData' => ['employees' => $employees],
        ]);
    }

    public function capture(Request $request): JsonResponse
    {
        try {
            $result = $this->fingerprintService->capture();
            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function store(Request $request): JsonResponse
        {
            $request->validate([
                'employid'     => 'required|string',
                'template'     => 'required|string',
                'quality'      => 'required|integer|min:0|max:100',
                'finger_index' => 'required|integer|min:0|max:9',
            ]);

            $templateBase64 = preg_replace('/\s+/', '', $request->template);
            $rawBinary      = base64_decode($templateBase64, true);

            if ($rawBinary === false || strlen($rawBinary) < 32) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid fingerprint template — decode failed.',
                ], 422);
            }

            try {
                // Delete existing template for same finger first
                FingerprintTemplate::where('employid',     $request->employid)
                                ->where('finger_index', $request->finger_index)
                                ->delete();

                // Use raw PDO with PARAM_LOB to handle binary BLOB correctly
                $pdo  = \DB::connection('dtr')->getPdo();
                $stmt = $pdo->prepare("
                    INSERT INTO fingerprint_templates
                        (employid, template_data, device_type, finger_index, quality, registered_by, is_active, created_at, updated_at)
                    VALUES
                        (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ");

                $stmt->bindValue(1, $request->employid);
                $stmt->bindValue(2, $rawBinary,                    \PDO::PARAM_LOB);
                $stmt->bindValue(3, 'secugen');                    // match your ENUM value
                $stmt->bindValue(4, (int) $request->finger_index, \PDO::PARAM_INT);
                $stmt->bindValue(5, (int) $request->quality,      \PDO::PARAM_INT);
                $stmt->bindValue(6, Auth::user()->name ?? 'system');
                $stmt->bindValue(7, 1,                             \PDO::PARAM_INT);
                $stmt->execute();

            } catch (\Throwable $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to save fingerprint: ' . $e->getMessage(),
                ], 500);
            }

            $activeCount = FingerprintTemplate::where('employid', $request->employid)
                ->where('is_active', 1)
                ->count();

            $fingerLabel = collect([
                0 => 'Right Thumb',  1 => 'Right Index',  2 => 'Right Middle',
                3 => 'Right Ring',   4 => 'Right Little',
                5 => 'Left Thumb',   6 => 'Left Index',   7 => 'Left Middle',
                8 => 'Left Ring',    9 => 'Left Little',
            ])->get($request->finger_index, "Finger {$request->finger_index}");

            return response()->json([
                'success' => true,
                'message' => "{$fingerLabel} registered successfully.",
                'biometric_status'  => $activeCount > 0 ? 'REGISTERED' : 'NOT REGISTERED',
                'fingerprint_count' => $activeCount,
            ]);
        }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'employid'     => 'required|string',
            'finger_index' => 'required|integer',
        ]);

        FingerprintTemplate::where('employid',     $request->employid)
                           ->where('finger_index', $request->finger_index)
                           ->delete();

        return response()->json(['success' => true, 'message' => 'Fingerprint removed.']);
    }

    public function toggleActive(Request $request): JsonResponse
    {
        $request->validate([
            'employid'     => 'required|string',
            'finger_index' => 'required|integer',
            'is_active'    => 'required|boolean',
        ]);

        FingerprintTemplate::where('employid',     $request->employid)
                           ->where('finger_index', $request->finger_index)
                           ->update(['is_active' => $request->is_active]);

        return response()->json(['success' => true]);
    }
}
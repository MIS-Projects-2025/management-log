<?php

namespace App\Http\Controllers\General;

use App\Http\Controllers\Controller;
use App\Services\DataTableService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AdminController extends Controller
{
    protected $datatable;
    protected $datatable1;

    public function __construct(DataTableService $datatable)
    {
        $this->datatable = $datatable;
    }


    public function index(Request $request)
    {
        $result = $this->datatable->handle(
            $request,
            'mysql',
            'admin',
            [
                'searchColumns' => ['EMPNAME', 'EMPLOYID', 'JOB_TITLE', 'DEPARTMENT'],
            ]
        );

        // FOR CSV EXPORTING
        if ($result instanceof \Symfony\Component\HttpFoundation\StreamedResponse) {
            return $result;
        }

        return Inertia::render('Admin/Admin', [
            'tableData' => $result['data'],
            'tableFilters' => $request->only([
                'search',
                'perPage',
                'sortBy',
                'sortDirection',
                'start',
                'end',
                'dropdownSearchValue',
                'dropdownFields',
            ]),
        ]);
    }

    public function index_addAdmin(Request $request)
    {
        $result = $this->datatable->handle(
            $request,
            'masterlist',
            'employee_masterlist',
            [
                'conditions' => function ($query) {
                    return $query
                        ->where('ACCSTATUS', 1)
                        ->whereNot('EMPLOYID', 0);
                },

                'searchColumns' => ['EMPNAME', 'EMPLOYID', 'JOB_TITLE', 'DEPARTMENT'],
            ]
        );

        // FOR CSV EXPORTING
        if ($result instanceof \Symfony\Component\HttpFoundation\StreamedResponse) {
            return $result;
        }

        return Inertia::render('Admin/NewAdmin', [
            'tableData' => $result['data'],
            'tableFilters' => $request->only([
                'search',
                'perPage',
                'sortBy',
                'sortDirection',
                'start',
                'end',
                'dropdownSearchValue',
                'dropdownFields',
            ]),
        ]);
    }

    public function addAdmin(Request $request)
    {

        // dd($request->all());
        $checkIfExists = DB::table('admin')
            ->where('emp_id', $request->input('id'))
            ->exists();

        if (!$checkIfExists) {
            DB::table('admin')
                ->insert([
                    'emp_id' => $request->input('id'),
                    'emp_name' => $request->input('name'),
                    'emp_role' => $request->input('role'),
                    'last_updated_by' => session('emp_data')['emp_id'],
                ]);
        }

        return back()->with('success', 'Admin added successfully.');
    }

    public function removeAdmin(Request $request)
    {
        DB::table('admin')
            ->where('emp_id', $request->input('id'))
            ->delete();

        return back()->with('success', 'Admin removed successfully.');
    }

    public function changeAdminRole(Request $request)
    {
        $id = $request->input('id');
        $role = $request->input('role');

        DB::table('admin')
            ->where('emp_id', $id)
            ->update([
                'emp_role' => $role,
                'last_updated_by' => session('emp_data')['emp_id'],
            ]);

        // Update session data if the current user is the one whose role is being changed
        if (session('emp_data')['emp_id'] == $id) {
            $empData = session('emp_data');
            $empData['emp_system_role'] = $role;
            session()->put('emp_data', $empData);
        }


        return back()->with('success', 'Admin role changed successfully.');
    }
}

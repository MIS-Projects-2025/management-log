<?php

namespace App\Http\Controllers;

use App\Services\DataTableService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DemoController extends Controller
{

    protected DataTableService $tableService;

    //  Inject the service into the controller
    public function __construct(DataTableService $tableService)
    {
        $this->tableService = $tableService;
    }

    public function index(Request $request)
    {
        $result = $this->tableService->handle(
            $request,
            'mysql', // connection
            'admin', // table
            [
                'defaultSortBy' => 'emp_id', // sort by field
                'defaultSortDirection' => 'desc', // sort direction
                'dateColumn' => 'created_at', // column for date filtering

                'searchColumns' => ['emp_id'], // columns for fuzzy search: if empty, it will search through all the columns of a table

                // Joins
                // 'joins' => [
                //     [
                //         'table' => 'roles',
                //         'first' => 'users.role_id',
                //         'second' => 'roles.id',
                //         'type' => 'leftJoin',
                //     ],
                // ],

                // Conditions
                'conditions' => function ($query) use ($request) {
                    // standard conditions
                    // $query->where('users.status', 'active');

                    // search using dropdown
                    if ($request->filled('dropdownSearchValue') && $request->filled('dropdownFields')) {
                        $value = $request->input('dropdownSearchValue');
                        $fields = explode(',', $request->input('dropdownFields')); // expect comma-separated values

                        $query->where(function ($q) use ($fields, $value) {
                            foreach ($fields as $field) {
                                $q->orWhere($field, 'like', "%$value%");
                            }
                        });
                    }

                    return $query;
                },

                'filename' => 'users_export', // Filename for export
                'exportColumns' => ['emp_id', 'emp_name', 'emp_role'], // Only these columns will appear in CSV
            ]
        );

        // FOR CSV EXPORTING (exporting will not work without this)
        if ($result instanceof \Symfony\Component\HttpFoundation\StreamedResponse) {
            return $result;
        }

        // dd($result);
        return Inertia::render('DemoPage', [
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
}

<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DataTableService
{
  public function handle(Request $request, string $connectionName, string $tableName, array $options = [])
  {
    $search         = $request->input('search');
    $perPage        = (int) $request->input('perPage', 10);
    $sortBy         = $request->input('sortBy', $options['defaultSortBy'] ?? null);
    $sortDirection  = $request->input('sortDirection', $options['defaultSortDirection'] ?? 'desc');
    $export         = $request->boolean('export');
    $startDate      = $this->parseDate($request->input('start'), 'start');
    $endDate        = $this->parseDate($request->input('end'), 'end');
    $dateColumn     = $options['dateColumn'] ?? null;

    $connection = DB::connection($connectionName);
    $query = $connection->table($tableName);

    // Apply joins
    if (!empty($options['joins']) && is_array($options['joins'])) {
      foreach ($options['joins'] as $join) {
        $type = $join['type'] ?? 'join';
        $query->{$type}(
          $join['table'],
          $join['first'],
          $join['operator'] ?? '=',
          $join['second']
        );
      }
    }

    // Fetch base columns
    $columns = $connection->getSchemaBuilder()->getColumnListing($tableName);
    $exportColumns = $options['exportColumns'] ?? $columns;

    // Determine which columns to search
    $searchColumns = $options['searchColumns'] ?? $columns;

    // Apply search
    $query->when($search, fn($q) => $this->applySearch($q, $searchColumns, $search));

    // Apply date range filter
    if ($startDate && $endDate && $dateColumn) {
      $query->whereBetween(DB::raw("DATE($dateColumn)"), [$startDate, $endDate]);
    }

    // Apply sorting
    if ($sortBy) {
      $query->orderBy($sortBy, $sortDirection);
    }

    // Additional conditions
    if (!empty($options['conditions']) && is_callable($options['conditions'])) {
      $query = $options['conditions']($query);
    }

    // Export to CSV
    if ($export) {
      $filename = $options['filename'] ?? null;
      return $this->exportCsv($query->get(), $exportColumns, $tableName, $filename);
    }

    return [
      'data' => $query->paginate($perPage)->withQueryString(),
      'columns' => $columns,
    ];
  }

  private function parseDate(?string $date, string $type): ?string
  {
    if (
      !$date ||
      in_array(strtolower($date), ['undefined', 'null'])
    ) {
      return null;
    }

    try {
      $carbon = Carbon::parse($date);
      return $type === 'start'
        ? $carbon->startOfDay()->format('Y-m-d')
        : $carbon->endOfDay()->format('Y-m-d');
    } catch (\Exception $e) {
      return null;
    }
  }

  private function applySearch($query, array $columns, string $search)
  {
    return $query->where(function ($q) use ($columns, $search) {
      foreach ($columns as $column) {
        $q->orWhere($column, 'like', "%{$search}%");
      }
    });
  }

  private function exportCsv($data, array $columns, string $tableName, ?string $customFilename = null)
  {
    $filename = $customFilename
      ? $customFilename . '_' . now()->format('Ymd_His') . '.csv'
      : $tableName . '_' . now()->format('Ymd_His') . '.csv';

    $headers = [
      'Content-Type' => 'text/csv',
      'Content-Disposition' => "attachment; filename=\"$filename\"",
    ];

    $callback = function () use ($data, $columns) {
      $output = fopen('php://output', 'w');
      fputcsv($output, $columns);

      foreach ($data as $row) {
        fputcsv($output, array_map(fn($col) => $row->$col ?? '', $columns));
      }

      fclose($output);
    };

    return response()->stream($callback, 200, $headers);
  }
}

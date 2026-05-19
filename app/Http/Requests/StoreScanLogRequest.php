<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\VPLog;

/**
 * Form request for storing scan logs
 */
class StoreScanLogRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        // Add authorization logic if needed
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'string', 'max:50'],
            'employee_name' => ['required', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:100'],
            'job_title' => ['nullable', 'string', 'max:100'],
            'prodline' => ['nullable', 'string', 'max:100'],
            'station' => ['nullable', 'string', 'max:100'],
            'log_type' => ['required', 'string', 'in:' . implode(',', VPLog::getValidLogTypes())],
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'employee_id' => 'employee ID',
            'employee_name' => 'employee name',
            'log_type' => 'log type',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'employee_id.required' => 'Employee ID is required for logging.',
            'employee_name.required' => 'Employee name is required for logging.',
            'log_type.required' => 'Please select a valid log type.',
            'log_type.in' => 'The selected log type is invalid.',
        ];
    }

    /**
     * Prepare the data for validation.
     *
     * @return void
     */
    protected function prepareForValidation(): void
    {
        // Trim whitespace from string inputs
        $this->merge([
            'employee_id' => trim($this->employee_id ?? ''),
            'employee_name' => trim($this->employee_name ?? ''),
            'department' => $this->department ? trim($this->department) : null,
            'job_title' => $this->job_title ? trim($this->job_title) : null,
            'prodline' => $this->prodline ? trim($this->prodline) : null,
            'station' => $this->station ? trim($this->station) : null,
        ]);
    }
}
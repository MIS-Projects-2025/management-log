<?php

namespace App\Http\Requests\VipLogs;

use Illuminate\Foundation\Http\FormRequest;

class ExportVipLogsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Add your authorization logic here
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'date_from' => ['required', 'date', 'date_format:Y-m-d'],
            'date_to' => ['required', 'date', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'date_from.required' => 'The start date is required.',
            'date_to.required' => 'The end date is required.',
            'date_to.after_or_equal' => 'The end date must be equal to or after the start date.',
            'date_from.date_format' => 'The start date must be in Y-m-d format.',
            'date_to.date_format' => 'The end date must be in Y-m-d format.',
        ];
    }
}
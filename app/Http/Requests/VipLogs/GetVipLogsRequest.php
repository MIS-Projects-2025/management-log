<?php

namespace App\Http\Requests\VipLogs;

use Illuminate\Foundation\Http\FormRequest;

class GetVipLogsRequest extends FormRequest
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
            'employee_id' => ['nullable', 'string'],
            'date_from' => ['nullable', 'date', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'date' => ['nullable', 'date', 'date_format:Y-m-d'],
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
            'date_to.after_or_equal' => 'The end date must be equal to or after the start date.',
            'date_from.date_format' => 'The date from must be in Y-m-d format.',
            'date_to.date_format' => 'The date to must be in Y-m-d format.',
        ];
    }
}
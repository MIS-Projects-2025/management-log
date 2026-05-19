<?php

namespace App\Repositories;

use App\Models\SystemStatus;

class SystemStatusRepository
{
    public function getCurrent(): SystemStatus
    {
        return SystemStatus::firstOrCreate(
            ['id' => 1],
            [
                'status'  => SystemStatus::STATUS_ONLINE,
                'message' => null,
            ]
        );
    }

    public function update(array $data): SystemStatus
    {
        $status = $this->getCurrent();
        $status->update($data);
        return $status->fresh();
    }
}

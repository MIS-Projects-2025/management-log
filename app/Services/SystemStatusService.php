<?php

namespace App\Services;

use App\Models\SystemStatus;
use App\Repositories\SystemStatusRepository;

class SystemStatusService
{
    public function __construct(
        protected SystemStatusRepository $repo
    ) {}

    public function getCurrent(): SystemStatus
    {
        return $this->repo->getCurrent();
    }

    public function setMaintenance(string $message = 'System is currently under maintenance.'): SystemStatus
    {
        return $this->repo->update([
            'status'  => SystemStatus::STATUS_MAINTENANCE,
            'message' => $message,
        ]);
    }

    public function setOnline(): SystemStatus
    {
        return $this->repo->update([
            'status'  => SystemStatus::STATUS_ONLINE,
            'message' => null,
        ]);
    }

    public function isInMaintenance(): bool
    {
        return $this->getCurrent()->status === SystemStatus::STATUS_MAINTENANCE;
    }
}

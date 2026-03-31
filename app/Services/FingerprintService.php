<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class FingerprintService
{
    const CANDIDATE_PORTS       = [8000, 8001, 8080, 8443, 9000, 9001];
    const CACHE_KEY             = 'secugen_active_port';
    const CACHE_TTL             = 300; // 5 minutes
    const STATUS_TIMEOUT_S      = 2;   // short probe to detect port
    const CAPTURE_BUFFER_S      = 10;  // added on top of SecuGen Timeout param

    const ERROR_MAP = [
        1   => 'Fingerprint reader not correctly installed or driver error.',
        2   => 'Wrong type of fingerprint reader or not correctly installed.',
        54  => 'Timeout — no finger detected. Please try again.',
        55  => 'Device not found. Make sure the HU20-A reader is plugged in.',
        59  => 'Device busy. Please wait and try again.',
        101 => 'Very low minutiae — press your finger firmly and try again.',
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // Port discovery
    // Tries each candidate port with a short timeout.
    //   timeout (curl error 28) → service IS running, waiting for finger ✅
    //   connection refused      → nothing on this port, try next ❌
    // ─────────────────────────────────────────────────────────────────────────

    private function discoverPort(): ?int
    {
        $cached = Cache::get(self::CACHE_KEY);
        if ($cached !== null) return (int) $cached;

        foreach (self::CANDIDATE_PORTS as $port) {
            try {
                Http::timeout(self::STATUS_TIMEOUT_S)
                    ->withHeaders(['Origin' => "http://localhost:{$port}"])
                    ->get("http://127.0.0.1:{$port}/SGIFPCapture", [
                        'Timeout' => 10000,
                        'Quality' => 50,
                    ]);

                // Got a real response — service is on this port
                Cache::put(self::CACHE_KEY, $port, self::CACHE_TTL);
                return $port;

            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $msg = strtolower($e->getMessage());

                if (str_contains($msg, 'timed out') || str_contains($msg, 'curl error 28')) {
                    // Timeout = service IS running here, waiting for finger
                    Cache::put(self::CACHE_KEY, $port, self::CACHE_TTL);
                    return $port;
                }

                // Connection refused = nothing on this port, try next
                continue;

            } catch (\Exception) {
                continue;
            }
        }

        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Capture a fingerprint from the connected device.
    // ─────────────────────────────────────────────────────────────────────────

    public function capture(): array
    {
        $port = $this->discoverPort();

        if ($port === null) {
            throw new \RuntimeException(
                'SecuGen service not found. Make sure "SecuGen Biometric HTTP" is running.'
            );
        }

        $curlTimeout = 15 + self::CAPTURE_BUFFER_S;

        try {
            $response = Http::timeout($curlTimeout)
                ->withHeaders(['Origin' => "http://localhost:{$port}"])
                ->get("http://127.0.0.1:{$port}/SGIFPCapture", [
                    'Timeout'        => 15000,
                    'Quality'        => 50,
                    'TemplateFormat' => 'ISO',
                    'ImageWSQRate'   => 0,
                ]);

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            // Port went away — clear cache so next request rediscovers
            Cache::forget(self::CACHE_KEY);

            throw new \RuntimeException(
                "SecuGen service on port {$port} stopped responding. Please reconnect and try again."
            );
        }

        if (!$response->successful()) {
            throw new \RuntimeException(
                'SecuGen service returned HTTP ' . $response->status()
            );
        }

        $data      = $response->json();
        $errorCode = $data['ErrorCode'] ?? -1;

        if ($errorCode !== 0) {
            throw new \RuntimeException(
                self::ERROR_MAP[$errorCode] ?? "SecuGen error code: {$errorCode}"
            );
        }

        if (empty($data['TemplateBase64'])) {
            throw new \RuntimeException('No template returned from SecuGen service.');
        }

        return [
            'template'     => $data['TemplateBase64'],
            'quality'      => $data['ImageQuality'] ?? 0,
            'image'        => $data['BMPBase64']    ?? null,
            'detectedPort' => $port,
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Match two ISO templates.
    // ─────────────────────────────────────────────────────────────────────────

    public function match(string $template1Base64, string $template2Base64): array
    {
        $port = $this->discoverPort();

        if ($port === null) {
            throw new \RuntimeException('SecuGen service not found.');
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders(['Origin' => "http://localhost:{$port}"])
                ->post("http://127.0.0.1:{$port}/SGIMatchScore", [
                    'Template1'      => $template1Base64,
                    'Template2'      => $template2Base64,
                    'TemplateFormat' => 'ISO',
                ]);

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Cache::forget(self::CACHE_KEY);
            throw new \RuntimeException('Match service did not respond.');
        }

        if (!$response->successful()) {
            throw new \RuntimeException('Match service returned HTTP ' . $response->status());
        }

        $data  = $response->json();
        $score = $data['MatchingScore'] ?? 0;

        return [
            'match' => $score >= 40,
            'score' => $score,
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Force rediscovery (call this from a status-check endpoint)
    // ─────────────────────────────────────────────────────────────────────────

    public function forgetPort(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    public function getActivePort(): ?int
    {
        return $this->discoverPort();
    }
}
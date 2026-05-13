<?php

namespace App\Http\Middleware;

use App\Services\SystemStatusService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class AuthMiddleware
{
    public function __construct(
        protected SystemStatusService $systemStatusService
    ) {}

    public function handle(Request $request, Closure $next)
    {
        $cookieName = env('SSO_COOKIE_NAME', 'sso_token');

        // 1️⃣ Get token sources (priority: query → cookie → session)
        $tokenFromQuery   = $request->query('key');
        $tokenFromCookie  = $request->cookie($cookieName);
        $tokenFromSession = session('emp_data.token');

        $token = $tokenFromQuery ?? $tokenFromCookie ?? $tokenFromSession;

        Log::info('AuthMiddleware token check', [
            'query'   => $tokenFromQuery,
            'cookie'  => $tokenFromCookie,
            'session' => $tokenFromSession,
            'used'    => $token,
        ]);

        // 🔹 No token → redirect to login
        if (!$token) {
            return $this->redirectToLogin($request);
        }

        // 🔹 Session exists & token matches → continue
        if (session()->has('emp_data') && session('emp_data.token') === $token) {
            $cookie = cookie($cookieName, $token, 60 * 24 * 7);

            // Remove ?key from URL if present (only once)
            if ($tokenFromQuery) {
                $url = $request->url();
                $query = $request->query();
                unset($query['key']);
                if (!empty($query)) {
                    $url .= '?' . http_build_query($query);
                }
                return redirect($url)->withCookie($cookie);
            }

            // 🔹 Check maintenance mode — skip for logout & system-status routes
            if (!$this->isBypassRoute($request)) {
                $maintenanceResponse = $this->checkMaintenance($request);
                if ($maintenanceResponse) {
                    return $maintenanceResponse;
                }
            }

            $response = $next($request);
        if ($response instanceof \Symfony\Component\HttpFoundation\BinaryFileResponse) {
            return $response;
        }
        return $response->withCookie($cookie);
        }

        // 🔹 Fetch user from authify if session missing or token mismatch
        $currentUser = DB::connection('authify')
            ->table('authify_sessions')
            ->where('token', $token)
            ->first();

        if (!$currentUser) {
            session()->forget('emp_data');
            // Clear this system's own cookie only
            $expiredCookie = cookie()->forget($cookieName);
            return $this->redirectToLogin($request)->withCookie($expiredCookie);
        }

        $isFromAllowed = $currentUser->emp_from === null;

        $allowedEmpIds = [845, 1284, 12812];

        $canAccess = (
            in_array($currentUser->emp_id, $allowedEmpIds) ||
            $currentUser->emp_dept === 'Security' ||
            $currentUser->emp_position >= 3
        ) && $isFromAllowed;

        if (!$canAccess) {
            session()->forget('emp_data');
            session()->flush();
            $redirectUrl = urlencode(route('dashboard'));
            $authifyUrl  = "http://192.168.2.221:8200/logout?redirect={$redirectUrl}";

            return Inertia::render('Unauthorized', [
                'logoutUrl' => $authifyUrl,
                'message'   => 'Access Restricted: You do not have permission to access this app.',
            ])->toResponse($request)->setStatusCode(403);
        }

        $userId = $currentUser->emp_id;

        Log::info('User roles fetched', ['emp_id' => $userId]);

        // 🔹 Set session
        session(['emp_data' => [
            'token'         => $currentUser->token,
            'emp_id'        => $currentUser->emp_id,
            'emp_name'      => $currentUser->emp_name,
            'emp_firstname' => $currentUser->emp_firstname,
            'emp_jobtitle'  => $currentUser->emp_jobtitle,
            'emp_dept'      => $currentUser->emp_dept,
            'emp_prodline'  => $currentUser->emp_prodline,
            'emp_station'   => $currentUser->emp_station,
            'emp_position'  => $currentUser->emp_position,
            'generated_at'  => $currentUser->generated_at,
        ]]);

        session()->save();

        $request->setUserResolver(fn() => (object) session('emp_data'));

        $cookie = cookie($cookieName, $currentUser->token, 60 * 24 * 7);

        // 🔹 Redirect once if token came from query
        if ($tokenFromQuery) {
            $url = $request->url();
            $query = $request->query();
            unset($query['key']);
            if (!empty($query)) {
                $url .= '?' . http_build_query($query);
            }
            return redirect($url)->withCookie($cookie);
        }

        // 🔹 Check maintenance mode — skip for logout & system-status routes
        if (!$this->isBypassRoute($request)) {
            $maintenanceResponse = $this->checkMaintenance($request);
            if ($maintenanceResponse) {
                return $maintenanceResponse;
            }
        }

                    $response = $next($request);
            if ($response instanceof \Symfony\Component\HttpFoundation\BinaryFileResponse) {
                return $response;
            }
            return $response->withCookie($cookie);
    }

    /**
     * Routes that should bypass the maintenance check.
     * Logout and system-status toggles must always be reachable.
     */
    private function isBypassRoute(Request $request): bool
    {
        return $request->routeIs('logout')
            || $request->routeIs('system-status.online')
            || $request->routeIs('system-status.maintenance');
    }

    /**
     * Returns an Inertia maintenance response if system is in maintenance.
     */
    private function checkMaintenance(Request $request): mixed
    {
        if (!$this->systemStatusService->isInMaintenance()) {
            return null;
        }

        $logoutUrl = route('logout');
        $status    = $this->systemStatusService->getCurrent();

        return Inertia::render('Maintenance', [
            'emp_data'  => session('emp_data'),
            'message'   => $status->message,
            'logoutUrl' => $logoutUrl,
        ])->toResponse($request)->setStatusCode(503);
    }

    private function redirectToLogin(Request $request)
    {
        $redirectUrl = urlencode($request->fullUrl());
        return Inertia::location("http://192.168.2.221:8200/login?redirect={$redirectUrl}");
    }
}

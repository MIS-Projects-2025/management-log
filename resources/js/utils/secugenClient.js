/**
 * secugenClient.js
 *
 * Calls the SecuGen HTTP service running on the CLIENT's local machine.
 * This must run in the browser — never on the server — because the USB
 * fingerprint reader is attached to the user's PC, not the Docker host.
 */

const CANDIDATE_PORTS = [8000, 8001, 8080, 8443, 9000, 9001];
const QUALITY_GATE = 70;
const CAPTURE_TIMEOUT = 25_000; // ms — must exceed SecuGen's own timeout

let _cachedPort = null;

async function probePort(port) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
        // A timed-out fetch (AbortError) means SecuGen is listening — it just
        // needs a finger.  A TypeError (network error / CORS refused) means
        // nothing is on that port.
        await fetch(
            `http://127.0.0.1:${port}/SGIFPCapture?Timeout=1000&Quality=50`,
            {
                signal: controller.signal,
                mode: "cors",
            },
        );
        return true; // got a real response
    } catch (err) {
        if (err.name === "AbortError") return true; // timeout → service IS there
        return false; // network error → nothing here
    } finally {
        clearTimeout(timer);
    }
}

async function discoverPort() {
    if (_cachedPort !== null) return _cachedPort;
    for (const port of CANDIDATE_PORTS) {
        if (await probePort(port)) {
            _cachedPort = port;
            return port;
        }
    }
    return null;
}

/**
 * Capture a fingerprint from the local SecuGen device.
 *
 * @returns {{ template: string, quality: number, image: string|null }}
 * @throws  Error with a user-friendly message on any failure
 */
export async function captureFingerprint() {
    const port = await discoverPort();
    if (port === null) {
        throw new Error(
            "SecuGen service not found on this PC. " +
                "Make sure the SecuGen Biometric HTTP service is running.",
        );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT);

    let response;
    try {
        response = await fetch(
            `http://127.0.0.1:${port}/SGIFPCapture` +
                `?Timeout=15000&Quality=50&TemplateFormat=ISO&ImageWSQRate=0`,
            { mode: "cors", signal: controller.signal },
        );
    } catch (err) {
        _cachedPort = null; // force rediscovery next time
        if (err.name === "AbortError") {
            throw new Error("Fingerprint scan timed out. Please try again.");
        }
        throw new Error(
            "Cannot reach SecuGen service. " +
                "Make sure it is running and the reader is plugged in.",
        );
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        throw new Error(`SecuGen service returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    const errorCode = data.ErrorCode ?? -1;

    const ERROR_MAP = {
        1: "Fingerprint reader not correctly installed or driver error.",
        2: "Wrong type of reader or not correctly installed.",
        54: "Timeout — no finger detected. Please try again.",
        55: "Device not found. Make sure the HU20-A reader is plugged in.",
        59: "Device busy. Please wait and try again.",
        101: "Very low quality — press your finger firmly and try again.",
    };

    if (errorCode !== 0) {
        throw new Error(
            ERROR_MAP[errorCode] ?? `SecuGen error code: ${errorCode}`,
        );
    }

    if (!data.TemplateBase64) {
        throw new Error("No template returned from SecuGen service.");
    }

    const quality = data.ImageQuality ?? 0;
    if (quality < QUALITY_GATE) {
        throw new Error(
            `Fingerprint quality too low (${quality}/100). ` +
                "Please press your finger firmly and try again.",
        );
    }

    return {
        template: data.TemplateBase64,
        quality,
        image: data.BMPBase64 ?? null,
    };
}

/** Force port rediscovery (call if the service was restarted). */
export function resetPortCache() {
    _cachedPort = null;
}

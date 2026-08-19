/**
 * One place that decides what camera and microphone we can actually get.
 *
 * The call paths used to do this:
 *
 *     await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo })
 *
 * which is all-or-nothing. A machine with a working microphone but no webcam
 * — every desktop tower, every Mac Studio / Mac mini, any laptop with the
 * camera disabled in firmware — rejects the WHOLE request with NotFoundError.
 * The caller then treated that as "user refused": starting a call bailed out,
 * and answering one called onDecline(), so the person calling saw "Declined"
 * from someone who never chose to decline and would have been perfectly happy
 * to talk. A missing webcam should cost you your video, not the call.
 *
 * So: ask for everything, and if that fails, work out WHY and fall back
 * instead of giving up. The distinction between "no device exists",
 * "permission was refused" and "something else is already using it" matters —
 * they need completely different things from the user, and the old single
 * message ("Camera And Microphone Required. Please Allow Access") told
 * someone with no webcam to go grant a permission that would never help.
 */

export type MediaProblem =
  | 'ok'
  /** Mic works, no camera on this machine. Perfectly callable — audio only. */
  | 'no-camera'
  /** Camera works, no mic. Can be seen, cannot be heard. */
  | 'no-mic'
  /** Neither exists. Can still JOIN and watch/listen, just cannot publish. */
  | 'no-devices'
  /** The browser blocked us — a decision only the user can reverse. */
  | 'permission-denied'
  /** Hardware exists but another app (Zoom, Photo Booth, OBS) holds it. */
  | 'in-use'
  /** No getUserMedia at all: insecure origin, or an ancient browser. */
  | 'unsupported'
  | 'error';

export interface MediaPreflight {
  /** Publish video? False when there is no camera or it was refused. */
  video: boolean;
  /** Publish audio? False when there is no mic or it was refused. */
  audio: boolean;
  problem: MediaProblem;
  /** One sentence, already in the app's Title Case, safe to toast verbatim. */
  message: string;
  /** True when the call is worth joining at all (you can at least watch). */
  canJoin: boolean;
}

function errName(err: unknown): string {
  const e = err as { name?: string; message?: string } | null;
  return (e?.name || e?.message || '').toString();
}

/** NotFoundError / OverconstrainedError => the hardware simply is not there. */
function isMissingDevice(err: unknown): boolean {
  return /NotFoundError|OverconstrainedError|DevicesNotFound/i.test(errName(err));
}

/** NotAllowedError / SecurityError => blocked by the user or by policy. */
function isDenied(err: unknown): boolean {
  return /NotAllowedError|SecurityError|PermissionDenied/i.test(errName(err));
}

/** NotReadableError / AbortError / TrackStart => held by another application. */
function isBusy(err: unknown): boolean {
  return /NotReadableError|AbortError|TrackStartError|NotReadable/i.test(errName(err));
}

/** Stop every track — we only ever wanted the grant, never the stream. */
function release(stream: MediaStream | null) {
  if (!stream) return;
  for (const t of stream.getTracks()) {
    try { t.stop(); } catch { /* already dead */ }
  }
}

/**
 * Ask for mic (+ camera if this is a video call) and report what we actually
 * got. MUST be called inside the user-gesture that started or answered the
 * call: iOS Safari only persists a permission grant when the prompt is raised
 * synchronously from a click, not from a later async continuation.
 *
 * Never throws. The worst case is a truthful description of why there is no
 * media, with canJoin still true where joining is useful.
 */
export async function preflightMedia(wantVideo: boolean): Promise<MediaPreflight> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      video: false,
      audio: false,
      problem: 'unsupported',
      message: 'This Browser Cannot Access A Camera Or Microphone. Try Chrome, Edge, Or Safari Over HTTPS.',
      canJoin: false,
    };
  }

  // Best case: everything we asked for.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
    // Trust the tracks we were handed rather than the request: a browser can
    // satisfy a request partially, and publishing a camera we do not have
    // produces a black rectangle for everyone else.
    const gotVideo = stream.getVideoTracks().length > 0;
    const gotAudio = stream.getAudioTracks().length > 0;
    release(stream);
    return {
      video: wantVideo && gotVideo,
      audio: gotAudio,
      problem: gotAudio ? (wantVideo && !gotVideo ? 'no-camera' : 'ok') : 'no-mic',
      message:
        !gotAudio
          ? 'No Microphone Found — You Will Be Able To Hear, But Not Be Heard.'
          : wantVideo && !gotVideo
            ? 'No Camera Found — Joining With Audio Only.'
            : '',
      canJoin: true,
    };
  } catch (firstErr) {
    // A refusal covering everything is final — retrying cannot change it, and
    // a second prompt just annoys someone who already said no.
    if (isDenied(firstErr)) {
      return {
        video: false,
        audio: false,
        problem: 'permission-denied',
        message: 'Camera And Microphone Access Was Blocked. Allow Access In Your Browser Settings, Then Try Again.',
        canJoin: false,
      };
    }

    // The most common real failure: video call, no webcam. Drop the camera
    // and see whether the microphone alone works — it almost always does.
    if (wantVideo) {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        const gotAudio = audioOnly.getAudioTracks().length > 0;
        release(audioOnly);
        if (gotAudio) {
          return {
            video: false,
            audio: true,
            problem: isBusy(firstErr) ? 'in-use' : 'no-camera',
            message: isBusy(firstErr)
              ? 'Your Camera Is In Use By Another App — Joining With Audio Only.'
              : 'No Camera Found — Joining With Audio Only.',
            canJoin: true,
          };
        }
      } catch (audioErr) {
        if (isDenied(audioErr)) {
          return {
            video: false,
            audio: false,
            problem: 'permission-denied',
            message: 'Microphone Access Was Blocked. Allow Access In Your Browser Settings, Then Try Again.',
            canJoin: false,
          };
        }
        // Fall through: no mic either.
      }
    }

    // No usable capture hardware. Joining is still worth it — audio playback
    // and incoming video need no permission at all, so you can watch and
    // listen. Far better than being bounced out of the meeting.
    if (isMissingDevice(firstErr)) {
      return {
        video: false,
        audio: false,
        problem: 'no-devices',
        message: 'No Camera Or Microphone Found — You Can Watch And Listen, But Not Be Seen Or Heard.',
        canJoin: true,
      };
    }
    if (isBusy(firstErr)) {
      return {
        video: false,
        audio: false,
        problem: 'in-use',
        message: 'Your Camera Or Microphone Is In Use By Another App. Close It, Then Try Again.',
        canJoin: true,
      };
    }
    return {
      video: false,
      audio: false,
      problem: 'error',
      message: 'Could Not Start Your Camera Or Microphone. You Can Still Watch And Listen.',
      canJoin: true,
    };
  }
}

/**
 * What hardware exists, without prompting for anything.
 *
 * Labels are hidden until a grant exists, but the KINDS are visible, which is
 * all we need to decide whether to ask LiveKit to publish a camera. Safari
 * reports nothing before a grant, so an empty result means "unknown", never
 * "absent" — callers must treat undefined as "go ahead and try".
 */
export async function listDeviceKinds(): Promise<{ camera?: boolean; mic?: boolean }> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return {};
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.length === 0) return {};
    return {
      camera: devices.some((d) => d.kind === 'videoinput'),
      mic: devices.some((d) => d.kind === 'audioinput'),
    };
  } catch {
    return {};
  }
}

/**
 * Can this device capture its own screen at all?
 *
 * Feature detection, not user-agent sniffing. iOS Safari and Chrome on
 * Android genuinely do not implement getDisplayMedia — there is no web API to
 * capture a phone's screen. Sniffing got this wrong in both directions:
 * iPadOS Safari reports itself as "Macintosh", so an iPad was offered a
 * button that could only fail, while a desktop browser behind an unusual
 * user-agent was denied one that would have worked.
 */
export function canShareScreen(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

'use strict';

// ============================================================================
// Visit controller - synchronous video encounters (Phase 9).
// ----------------------------------------------------------------------------
//   POST  /api/patient/visits             - patient requests a visit
//   GET   /api/patient/visits             - patient lists their visits
//   GET   /api/patient/visits/:visitId    - patient reads one visit
//   GET   /api/admin/visits               - admin work queue
//   PATCH /api/admin/visits/:visitId      - admin schedules / updates
//
// PHI separation: the patient-facing handlers project via the model's
// PATIENT_COLUMNS so the provider clinical note (provider_notes) is never
// returned to the patient. The admin handler returns the full row.
//
// Participant tracking: requestVisit records the patient row in
// visit_participants; adminUpdateVisit records the provider row when an
// assignment lands. The visit_scheduled notification fires when an admin
// flips a request to 'scheduled' with a room URL so the patient knows
// their join link is ready.
// ============================================================================

const visitModel = require('../models/visit.model');
const visitService = require('../services/visit');
const providerModel = require('../models/provider.model');
const dependentModel = require('../models/dependent.model');
const notificationService = require('../services/notification');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');
const logger = require('../utils/logger');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_VISIT_STATUSES = [
  'requested', 'scheduled', 'in_progress', 'completed',
  'cancelled', 'no_show',
];

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

// Shape a row for the patient API. Strips provider_notes (PHI clinical
// note) regardless of what the model returned.
function presentVisitForPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    providerId: row.provider_id,
    dependentId: row.dependent_id,
    status: row.status,
    protocolCategory: row.protocol_category,
    requestedAt: row.requested_at,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    videoRoomProvider: row.video_room_provider,
    videoRoomUrl: row.video_room_url,
    patientReason: row.patient_reason,
  };
}

// Shape a row for the admin API. Includes the clinical note.
function presentVisitForAdmin(row) {
  if (!row) return null;
  return Object.assign(presentVisitForPatient(row), {
    providerNotes: row.provider_notes,
  });
}

// POST /api/patient/visits
// Patient initiates a visit request.
async function requestVisit(req, res, next) {
  try {
    const body = req.body || {};
    const patientReason =
      typeof body.patientReason === 'string'
        ? body.patientReason.trim()
        : '';
    if (patientReason.length === 0) {
      return next(errors.badRequest('A Reason For The Visit Is Required.'));
    }
    if (patientReason.length > 2000) {
      return next(errors.badRequest('Visit Reason Is Too Long.'));
    }
    const subscriptionId =
      typeof body.subscriptionId === 'string' && UUID_RE.test(body.subscriptionId)
        ? body.subscriptionId
        : null;
    // Phase 12: optional dependent linkage. UUID-validate, then verify
    // the dependent belongs to the requesting parent. Reject otherwise.
    let dependentId = null;
    if (typeof body.dependentId === 'string' && body.dependentId.trim() !== '') {
      const trimmed = body.dependentId.trim();
      if (!UUID_RE.test(trimmed)) {
        return next(errors.badRequest('That Dependent Reference Is Not Valid.'));
      }
      const dep = await dependentModel.findById(trimmed);
      if (!dep || dep.parent_user_id !== req.user.id) {
        return next(errors.forbidden('You May Only Submit For Your Own Dependents.'));
      }
      if (!dep.is_active) {
        return next(errors.badRequest('That Dependent Has Been Removed. Restore Them Before Submitting New Care.'));
      }
      dependentId = trimmed;
    }
    const created = await visitModel.create({
      userId: req.user.id,
      subscriptionId: subscriptionId,
      dependentId: dependentId,
      protocolCategory:
        typeof body.protocolCategory === 'string'
          ? body.protocolCategory
          : null,
      patientReason: patientReason,
    });
    // Record the patient as a participant. The provider row is added when
    // an admin schedules the visit and assigns a provider. addParticipant
    // is idempotent so a retry won't double-insert.
    try {
      await visitModel.addParticipant({
        visitId: created.id,
        userId: req.user.id,
        role: 'patient',
      });
    } catch (err) {
      logger.warn('visit.requestVisit: addParticipant failed', {
        visitId: created.id,
        message: err && err.message,
      });
    }
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'visit.requested',
      entityType: 'visit',
      entityId: created.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    res.status(201).json({ visit: presentVisitForPatient(created) });
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/visits
async function listMyVisits(req, res, next) {
  try {
    const rows = await visitModel.findByUser(req.user.id);
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'visit.list.viewed',
      entityType: 'user',
      entityId: req.user.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { count: rows.length },
    });
    res.status(200).json({ visits: rows.map(presentVisitForPatient) });
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/visits/:visitId
async function getMyVisit(req, res, next) {
  try {
    const visitId =
      typeof req.params.visitId === 'string'
        ? req.params.visitId.trim()
        : '';
    if (!UUID_RE.test(visitId)) {
      return next(errors.badRequest('That Visit Reference Is Not Valid.'));
    }
    const row = await visitModel.findByIdForPatient(visitId);
    if (!row) {
      return next(errors.notFound('Visit Not Found.'));
    }
    if (row.user_id !== req.user.id) {
      return next(errors.forbidden('You May Only View Your Own Visits.'));
    }
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'visit.viewed',
      entityType: 'visit',
      entityId: row.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    res.status(200).json({ visit: presentVisitForPatient(row) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/visits/:visitId
// Admin schedules a visit. Auto-provisions the video room when status is
// being flipped to 'scheduled' or 'in_progress' and no URL is set yet.
async function adminUpdateVisit(req, res, next) {
  try {
    const visitId =
      typeof req.params.visitId === 'string'
        ? req.params.visitId.trim()
        : '';
    if (!UUID_RE.test(visitId)) {
      return next(errors.badRequest('That Visit Reference Is Not Valid.'));
    }
    const body = req.body || {};
    const data = {};
    if (typeof body.status === 'string') {
      if (ALLOWED_VISIT_STATUSES.indexOf(body.status) === -1) {
        return next(errors.badRequest('That Status Is Not Valid.'));
      }
      data.status = body.status;
    }
    if (typeof body.providerId === 'string') {
      const trimmedProvider = body.providerId.trim();
      if (trimmedProvider === '') {
        // Explicit clear: admin removed the provider from the input.
        // The model's dynamic SET writes null so the column is reset.
        data.providerId = null;
      } else if (!UUID_RE.test(trimmedProvider)) {
        return next(errors.badRequest('That Provider Reference Is Not Valid.'));
      } else {
        data.providerId = trimmedProvider;
      }
    }
    if (typeof body.scheduledFor === 'string') {
      const trimmedSchedule = body.scheduledFor.trim();
      if (trimmedSchedule === '') {
        // Explicit clear: admin removed the scheduled time, e.g. to
        // unschedule before cancelling or rescheduling.
        data.scheduledFor = null;
      } else {
        const parsed = new Date(trimmedSchedule);
        if (Number.isNaN(parsed.getTime())) {
          return next(errors.badRequest('That Scheduled Time Is Not Valid.'));
        }
        data.scheduledFor = parsed.toISOString();
      }
    }
    if (typeof body.videoRoomUrl === 'string') {
      data.videoRoomUrl = body.videoRoomUrl.trim() || null;
    }
    if (typeof body.videoRoomProvider === 'string') {
      data.videoRoomProvider = body.videoRoomProvider.trim() || null;
    }

    const current = await visitModel.findById(visitId);
    if (!current) {
      return next(errors.notFound('Visit Not Found.'));
    }

    const needsRoom =
      (data.status === 'scheduled' || data.status === 'in_progress') &&
      !data.videoRoomUrl &&
      !current.video_room_url;
    if (needsRoom) {
      const room = await visitService.createRoom(visitId);
      data.videoRoomProvider = room.provider;
      data.videoRoomUrl = room.url;
    }

    const updated = await visitModel.updateScheduling(visitId, data);
    if (!updated) {
      return next(errors.notFound('Visit Not Found.'));
    }

    // If a provider was assigned (now or earlier), record them in
    // visit_participants. providers.user_id is the users.id behind the
    // clinician identity; addParticipant is idempotent so re-scheduling
    // is safe.
    if (updated.provider_id) {
      try {
        const provider = await providerModel.findById(updated.provider_id);
        if (provider && provider.user_id) {
          await visitModel.addParticipant({
            visitId: updated.id,
            userId: provider.user_id,
            role: 'provider',
          });
        }
      } catch (err) {
        logger.warn('visit.adminUpdateVisit: addParticipant failed', {
          visitId: updated.id,
          message: err && err.message,
        });
      }
    }

    // Notify the patient when an admin lands them at 'scheduled' with a
    // join URL AND an actual scheduled time. Without scheduled_for the
    // email body would say "You will receive the time shortly" while the
    // patient may already have a prior fully-formed email; sending that
    // half-formed follow-up is spammy. Dedupe key includes scheduled_for
    // so a reschedule (different ISO) fires a fresh email. Notification
    // service never throws into us.
    if (
      updated.status === 'scheduled' &&
      updated.video_room_url &&
      updated.scheduled_for
    ) {
      const scheduledIso = new Date(updated.scheduled_for).toISOString();
      await notificationService.send({
        userId: updated.user_id,
        template: 'visit_scheduled',
        payload: {
          scheduledFor: scheduledIso,
          joinUrl: updated.video_room_url,
        },
        dedupeKey: 'visit_scheduled:' + updated.id + ':' + scheduledIso,
      });
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'visit.admin.updated',
      entityType: 'visit',
      entityId: updated.id,
      // PHI true: the handler read provider_notes + patient_reason
      // via findById and returns provider_notes in the admin projection.
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        status: updated.status,
        roomProvisioned: needsRoom,
      },
    });

    res.status(200).json({ visit: presentVisitForAdmin(updated) });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/visits
// Staff work queue. Optional ?status=requested filter narrows to a single
// state; absent filter returns the most recent 200 visits across all
// statuses. Returns the full admin projection (includes provider_notes).
async function listAllVisits(req, res, next) {
  try {
    const status =
      typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status && ALLOWED_VISIT_STATUSES.indexOf(status) === -1) {
      return next(errors.badRequest('That Status Filter Is Not Valid.'));
    }
    const rows = await visitModel.findAll(status ? { status: status } : {});
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'visit.admin.list.viewed',
      entityType: 'visit',
      entityId: null,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: status || 'all', count: rows.length },
    });
    res.status(200).json({ visits: rows.map(presentVisitForAdmin) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requestVisit: requestVisit,
  listMyVisits: listMyVisits,
  getMyVisit: getMyVisit,
  adminUpdateVisit: adminUpdateVisit,
  listAllVisits: listAllVisits,
};

'use strict';

// ============================================================================
// Urgent controller - acute / urgent care line (Phase 11).
// ----------------------------------------------------------------------------
//   POST  /api/patient/urgent-visits                    - patient requests
//   GET   /api/patient/urgent-visits                    - patient list
//   GET   /api/patient/urgent-visits/:visitId           - patient detail
//   GET   /api/admin/urgent-visits                      - staff work queue
//   PATCH /api/admin/urgent-visits/:visitId             - staff triage / update
//
// PHI separation: patient-facing handlers project via the model's
// findByIdForPatient / findByUser, which strip triage_note + recommendation.
// Admin handlers return the full row (admin role-gated upstream).
//
// Auto-triage: requestUrgent calls services/urgent.autoTriage on the
// concern_text. 'emergent' classifications short-circuit the room create
// and land at status='escalated_ed' with an ED-warning email. All other
// routes auto-provision a stub video room and land at 'triaged'.
// ============================================================================

const urgentModel = require('../models/urgent.model');
const urgentService = require('../services/urgent');
const dependentModel = require('../models/dependent.model');
const notificationService = require('../services/notification');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');
const logger = require('../utils/logger');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const URGENT_STATUSES = [
  'requested', 'triaged', 'in_progress', 'completed',
  'escalated_ed', 'cancelled',
];

const URGENT_URGENCIES = [
  'routine', 'elevated', 'urgent', 'emergent',
];

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

function presentForPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    dependentId: row.dependent_id,
    status: row.status,
    urgency: row.urgency,
    concernText: row.concern_text,
    triagedAt: row.triaged_at,
    videoRoomProvider: row.video_room_provider,
    videoRoomUrl: row.video_room_url,
    providerId: row.provider_id,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function presentForAdmin(row) {
  if (!row) return null;
  return Object.assign(presentForPatient(row), {
    triagedByUserId: row.triaged_by_user_id,
    triageNote: row.triage_note,
    recommendation: row.recommendation,
  });
}

async function requestUrgent(req, res, next) {
  try {
    const body = req.body || {};
    const concernText =
      typeof body.concernText === 'string' ? body.concernText.trim() : '';
    if (concernText.length === 0) {
      return next(errors.badRequest('A Description Of Your Concern Is Required.'));
    }
    if (concernText.length > 5000) {
      return next(errors.badRequest('Your Concern Description Is Too Long.'));
    }
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
    const created = await urgentModel.createVisit({
      userId: req.user.id,
      concernText: concernText,
      dependentId: dependentId,
    });
    const triage = urgentService.autoTriage(concernText);
    const updateData = {
      urgency: triage.urgency,
      triagedAt: new Date().toISOString(),
    };
    if (triage.route === 'escalated_ed') {
      updateData.status = 'escalated_ed';
    } else {
      updateData.status = 'triaged';
      try {
        const room = await urgentService.createRoom(created.id);
        updateData.videoRoomProvider = room.provider;
        updateData.videoRoomUrl = room.url;
      } catch (err) {
        logger.warn('urgent.requestUrgent: createRoom failed', {
          urgentVisitId: created.id,
          message: err && err.message,
        });
      }
    }
    const updated = await urgentModel.updateVisit(created.id, updateData);
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'urgent.requested',
      entityType: 'urgent_visit',
      entityId: updated.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { urgency: updated.urgency, status: updated.status },
    });
    // Dedupe key includes status so a later state transition (e.g.
    // 'triaged' -> 'in_progress') re-fires a fresh email. Without
    // the status segment a single global key would forever block
    // re-notification when an admin updates the visit later.
    await notificationService.send({
      userId: updated.user_id,
      template: 'urgent_visit_triaged',
      payload: {
        joinUrl: updated.video_room_url || '',
        escalatedToEd: updated.status === 'escalated_ed' ? 'true' : 'false',
      },
      dedupeKey:
        'urgent_visit_triaged:' + updated.id + ':' + updated.status,
    });
    res.status(201).json({ urgentVisit: presentForPatient(updated) });
  } catch (err) {
    next(err);
  }
}

async function listMyUrgent(req, res, next) {
  try {
    const rows = await urgentModel.findByUser(req.user.id);
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'urgent.list.viewed',
      entityType: 'user',
      entityId: req.user.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { count: rows.length },
    });
    res.status(200).json({ urgentVisits: rows.map(presentForPatient) });
  } catch (err) {
    next(err);
  }
}

async function getMyUrgent(req, res, next) {
  try {
    const visitId =
      typeof req.params.visitId === 'string'
        ? req.params.visitId.trim()
        : '';
    if (!UUID_RE.test(visitId)) {
      return next(errors.badRequest('That Urgent Visit Reference Is Not Valid.'));
    }
    const row = await urgentModel.findByIdForPatient(visitId);
    if (!row) {
      return next(errors.notFound('Urgent Visit Not Found.'));
    }
    if (row.user_id !== req.user.id) {
      return next(errors.forbidden('You May Only View Your Own Urgent Visits.'));
    }
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'urgent.viewed',
      entityType: 'urgent_visit',
      entityId: row.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    res.status(200).json({ urgentVisit: presentForPatient(row) });
  } catch (err) {
    next(err);
  }
}

async function listAllUrgent(req, res, next) {
  try {
    const status =
      typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status && URGENT_STATUSES.indexOf(status) === -1) {
      return next(errors.badRequest('That Status Filter Is Not Valid.'));
    }
    const rows = await urgentModel.findAll(status ? { status: status } : {});
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'urgent.admin.list.viewed',
      entityType: 'urgent_visit',
      entityId: null,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: status || 'all', count: rows.length },
    });
    res.status(200).json({ urgentVisits: rows.map(presentForAdmin) });
  } catch (err) {
    next(err);
  }
}

async function adminUpdateUrgent(req, res, next) {
  try {
    const visitId =
      typeof req.params.visitId === 'string'
        ? req.params.visitId.trim()
        : '';
    if (!UUID_RE.test(visitId)) {
      return next(errors.badRequest('That Urgent Visit Reference Is Not Valid.'));
    }
    const body = req.body || {};
    const data = {};

    if (typeof body.status === 'string') {
      if (URGENT_STATUSES.indexOf(body.status) === -1) {
        return next(errors.badRequest('That Status Is Not Valid.'));
      }
      data.status = body.status;
    }
    if (typeof body.urgency === 'string') {
      if (URGENT_URGENCIES.indexOf(body.urgency) === -1) {
        return next(errors.badRequest('That Urgency Is Not Valid.'));
      }
      data.urgency = body.urgency;
    }
    if (typeof body.providerId === 'string') {
      const trimmed = body.providerId.trim();
      if (trimmed === '') {
        data.providerId = null;
      } else if (!UUID_RE.test(trimmed)) {
        return next(errors.badRequest('That Provider Reference Is Not Valid.'));
      } else {
        data.providerId = trimmed;
      }
    }
    if (typeof body.videoRoomUrl === 'string') {
      const trimmed = body.videoRoomUrl.trim();
      data.videoRoomUrl = trimmed === '' ? null : trimmed;
    }
    if (typeof body.videoRoomProvider === 'string') {
      const trimmed = body.videoRoomProvider.trim();
      data.videoRoomProvider = trimmed === '' ? null : trimmed;
    }
    if (typeof body.triageNote === 'string') {
      const trimmed = body.triageNote.trim();
      data.triageNote = trimmed === '' ? null : trimmed;
    }
    if (typeof body.recommendation === 'string') {
      const trimmed = body.recommendation.trim();
      data.recommendation = trimmed === '' ? null : trimmed;
    }
    if (typeof body.triagedAt === 'string') {
      const trimmed = body.triagedAt.trim();
      if (trimmed === '') {
        data.triagedAt = null;
      } else {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
          return next(errors.badRequest('That Triage Time Is Not Valid.'));
        }
        data.triagedAt = parsed.toISOString();
      }
    }
    if (typeof body.resolvedAt === 'string') {
      const trimmed = body.resolvedAt.trim();
      if (trimmed === '') {
        data.resolvedAt = null;
      } else {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
          return next(errors.badRequest('That Resolution Time Is Not Valid.'));
        }
        data.resolvedAt = parsed.toISOString();
      }
    }

    const current = await urgentModel.findById(visitId);
    if (!current) {
      return next(errors.notFound('Urgent Visit Not Found.'));
    }

    if (
      Object.prototype.hasOwnProperty.call(data, 'triageNote') &&
      data.triageNote !== null
    ) {
      if (!current.triaged_at && !Object.prototype.hasOwnProperty.call(data, 'triagedAt')) {
        data.triagedAt = new Date().toISOString();
      }
      if (!current.triaged_by_user_id) {
        data.triagedByUserId = req.user.id;
      }
    }

    const needsRoom =
      data.status === 'in_progress' &&
      !data.videoRoomUrl &&
      !current.video_room_url;
    if (needsRoom) {
      try {
        const room = await urgentService.createRoom(visitId);
        data.videoRoomProvider = room.provider;
        data.videoRoomUrl = room.url;
      } catch (err) {
        logger.warn('urgent.adminUpdateUrgent: createRoom failed', {
          urgentVisitId: visitId,
          message: err && err.message,
        });
      }
    }

    const updated = await urgentModel.updateVisit(visitId, data);
    if (!updated) {
      return next(errors.notFound('Urgent Visit Not Found.'));
    }

    // Phase 11 F2/G1: route the notification by the actual transition.
    // Each lifecycle event gets its own template so the body honestly
    // reflects what happened. Dedupe key includes status so each
    // distinct transition fires at most once. The guard
    // current.status !== updated.status keeps no-op saves silent.
    if (current.status !== updated.status) {
      let template = null;
      if (updated.status === 'escalated_ed') {
        template = 'urgent_visit_triaged';
      } else if (updated.status === 'in_progress') {
        template = 'urgent_visit_in_progress';
      } else if (updated.status === 'completed') {
        template = 'urgent_visit_completed';
      }
      if (template) {
        await notificationService.send({
          userId: updated.user_id,
          template: template,
          payload: {
            joinUrl: updated.video_room_url || '',
            escalatedToEd: updated.status === 'escalated_ed' ? 'true' : 'false',
          },
          dedupeKey:
            template + ':' + updated.id + ':' + updated.status,
        });
      }
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'urgent.admin.updated',
      entityType: 'urgent_visit',
      entityId: updated.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        status: updated.status,
        urgency: updated.urgency,
        roomProvisioned: needsRoom,
      },
    });
    res.status(200).json({ urgentVisit: presentForAdmin(updated) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requestUrgent: requestUrgent,
  listMyUrgent: listMyUrgent,
  getMyUrgent: getMyUrgent,
  listAllUrgent: listAllUrgent,
  adminUpdateUrgent: adminUpdateUrgent,
  URGENT_STATUSES: URGENT_STATUSES,
  URGENT_URGENCIES: URGENT_URGENCIES,
};

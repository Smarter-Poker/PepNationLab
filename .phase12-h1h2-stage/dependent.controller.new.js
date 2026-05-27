'use strict';

// ============================================================================
// Dependent controller - Pediatric Care endpoints (Phase 12).
// ----------------------------------------------------------------------------
//   GET    /api/patient/dependents                       - parent's list
//   GET    /api/patient/dependents/:dependentId          - parent reads one
//   POST   /api/patient/dependents                       - parent creates
//   PATCH  /api/patient/dependents/:dependentId          - parent updates
//   DELETE /api/patient/dependents/:dependentId          - parent deactivates
//   GET    /api/admin/dependents                         - staff list
//
// Ownership: every patient-scoped handler verifies the row's parent_user_id
// matches req.user.id before returning or mutating.
// Validation: DOB must parse and fall in (now() - 120y, now()].
// Relationship must be in the enum when provided.
// ============================================================================

const dependentModel = require('../models/dependent.model');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RELATIONSHIPS = [
  'child', 'stepchild', 'foster_child', 'ward', 'other',
];

const MAX_NAME_LEN = 100;
const MAX_NOTES_LEN = 2000;
const MAX_AGE_YEARS = 120;

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

function present(row) {
  if (!row) return null;
  return {
    id: row.id,
    parentUserId: row.parent_user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    relationship: row.relationship,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Parse a YYYY-MM-DD or full ISO date string into a Date. Returns null
// if unparseable or out of range. The range guard rejects future dates
// and births more than MAX_AGE_YEARS ago - either is a data-entry error.
function parseDateOfBirth(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  if (parsed.getTime() > now.getTime()) return null;
  const earliest = new Date(now.getTime());
  earliest.setFullYear(earliest.getFullYear() - MAX_AGE_YEARS);
  if (parsed.getTime() < earliest.getTime()) return null;
  return parsed;
}

// Coerce a date value (either Date instance or value) into 'YYYY-MM-DD'
// for storage as a DATE column.
function dateOnly(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

// GET /api/patient/dependents
async function listMine(req, res, next) {
  try {
    const includeInactive = req.query && req.query.includeInactive === 'true';
    const rows = await dependentModel.findByParent(req.user.id, {
      includeInactive: includeInactive,
    });
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'dependent.list.viewed',
      entityType: 'user',
      entityId: req.user.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { count: rows.length, includeInactive: includeInactive },
    });
    res.status(200).json({ dependents: rows.map(present) });
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/dependents/:dependentId
async function getMine(req, res, next) {
  try {
    const dependentId =
      typeof req.params.dependentId === 'string'
        ? req.params.dependentId.trim()
        : '';
    if (!UUID_RE.test(dependentId)) {
      return next(errors.badRequest('That Dependent Reference Is Not Valid.'));
    }
    const row = await dependentModel.findById(dependentId);
    if (!row) {
      return next(errors.notFound('Dependent Not Found.'));
    }
    if (row.parent_user_id !== req.user.id) {
      return next(errors.forbidden('You May Only View Your Own Dependents.'));
    }
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'dependent.viewed',
      entityType: 'dependent',
      entityId: row.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    res.status(200).json({ dependent: present(row) });
  } catch (err) {
    next(err);
  }
}

// POST /api/patient/dependents
async function createMine(req, res, next) {
  try {
    const body = req.body || {};
    const firstName =
      typeof body.firstName === 'string' ? body.firstName.trim() : '';
    if (firstName.length === 0 || firstName.length > MAX_NAME_LEN) {
      return next(errors.badRequest('A Valid First Name Is Required.'));
    }
    const lastName =
      typeof body.lastName === 'string' ? body.lastName.trim() : '';
    if (lastName.length === 0 || lastName.length > MAX_NAME_LEN) {
      return next(errors.badRequest('A Valid Last Name Is Required.'));
    }
    const dobDate = parseDateOfBirth(body.dateOfBirth);
    if (!dobDate) {
      return next(errors.badRequest('A Valid Date Of Birth Is Required.'));
    }
    let relationship = 'child';
    if (typeof body.relationship === 'string' && body.relationship.trim() !== '') {
      const trimmed = body.relationship.trim();
      if (RELATIONSHIPS.indexOf(trimmed) === -1) {
        return next(errors.badRequest('That Relationship Is Not Valid.'));
      }
      relationship = trimmed;
    }
    let notes = null;
    if (typeof body.notes === 'string' && body.notes.trim() !== '') {
      const trimmedNotes = body.notes.trim();
      if (trimmedNotes.length > MAX_NOTES_LEN) {
        return next(errors.badRequest('Notes Are Too Long.'));
      }
      notes = trimmedNotes;
    }

    const created = await dependentModel.create({
      parentUserId: req.user.id,
      firstName: firstName,
      lastName: lastName,
      dateOfBirth: dateOnly(dobDate),
      relationship: relationship,
      notes: notes,
    });

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'dependent.created',
      entityType: 'dependent',
      entityId: created.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { relationship: created.relationship },
    });
    res.status(201).json({ dependent: present(created) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/patient/dependents/:dependentId
async function updateMine(req, res, next) {
  try {
    const dependentId =
      typeof req.params.dependentId === 'string'
        ? req.params.dependentId.trim()
        : '';
    if (!UUID_RE.test(dependentId)) {
      return next(errors.badRequest('That Dependent Reference Is Not Valid.'));
    }
    const body = req.body || {};
    const data = {};

    if (typeof body.firstName === 'string') {
      const trimmed = body.firstName.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_NAME_LEN) {
        return next(errors.badRequest('A Valid First Name Is Required.'));
      }
      data.firstName = trimmed;
    }
    if (typeof body.lastName === 'string') {
      const trimmed = body.lastName.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_NAME_LEN) {
        return next(errors.badRequest('A Valid Last Name Is Required.'));
      }
      data.lastName = trimmed;
    }
    if (typeof body.dateOfBirth === 'string') {
      const dobDate = parseDateOfBirth(body.dateOfBirth);
      if (!dobDate) {
        return next(errors.badRequest('A Valid Date Of Birth Is Required.'));
      }
      data.dateOfBirth = dateOnly(dobDate);
    }
    if (typeof body.relationship === 'string') {
      const trimmed = body.relationship.trim();
      if (RELATIONSHIPS.indexOf(trimmed) === -1) {
        return next(errors.badRequest('That Relationship Is Not Valid.'));
      }
      data.relationship = trimmed;
    }
    if (typeof body.notes === 'string') {
      const trimmedNotes = body.notes.trim();
      if (trimmedNotes.length > MAX_NOTES_LEN) {
        return next(errors.badRequest('Notes Are Too Long.'));
      }
      // Clear-semantics: empty string means clear to null.
      data.notes = trimmedNotes === '' ? null : trimmedNotes;
    }

    // Block is_active flips via this route. Use DELETE for soft-delete.
    if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
      return next(errors.badRequest('Use The Remove Action To Deactivate A Dependent.'));
    }

    const current = await dependentModel.findById(dependentId);
    if (!current) {
      return next(errors.notFound('Dependent Not Found.'));
    }
    if (current.parent_user_id !== req.user.id) {
      return next(errors.forbidden('You May Only Update Your Own Dependents.'));
    }
    if (!current.is_active) {
      return next(errors.badRequest('That Dependent Has Been Removed. Restore Them Before Editing.'));
    }

    const updated = await dependentModel.update(dependentId, data);
    if (!updated) {
      return next(errors.notFound('Dependent Not Found.'));
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'dependent.updated',
      entityType: 'dependent',
      entityId: updated.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    res.status(200).json({ dependent: present(updated) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/patient/dependents/:dependentId
async function deactivateMine(req, res, next) {
  try {
    const dependentId =
      typeof req.params.dependentId === 'string'
        ? req.params.dependentId.trim()
        : '';
    if (!UUID_RE.test(dependentId)) {
      return next(errors.badRequest('That Dependent Reference Is Not Valid.'));
    }
    const current = await dependentModel.findById(dependentId);
    if (!current) {
      return next(errors.notFound('Dependent Not Found.'));
    }
    if (current.parent_user_id !== req.user.id) {
      return next(errors.forbidden('You May Only Remove Your Own Dependents.'));
    }
    const updated = await dependentModel.deactivate(dependentId);
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'dependent.deactivated',
      entityType: 'dependent',
      entityId: dependentId,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    res.status(200).json({ dependent: present(updated) });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/dependents
async function adminListAll(req, res, next) {
  try {
    const filters = {};
    if (typeof req.query.parentUserId === 'string' && req.query.parentUserId.trim() !== '') {
      const trimmed = req.query.parentUserId.trim();
      if (!UUID_RE.test(trimmed)) {
        return next(errors.badRequest('That Parent Reference Is Not Valid.'));
      }
      filters.parentUserId = trimmed;
    }
    const rows = await dependentModel.findAll(filters);
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'dependent.admin.list.viewed',
      entityType: 'dependent',
      entityId: null,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        count: rows.length,
        parentUserId: filters.parentUserId || 'all',
      },
    });
    res.status(200).json({ dependents: rows.map(present) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMine: listMine,
  getMine: getMine,
  createMine: createMine,
  updateMine: updateMine,
  deactivateMine: deactivateMine,
  adminListAll: adminListAll,
  RELATIONSHIPS: RELATIONSHIPS,
};
